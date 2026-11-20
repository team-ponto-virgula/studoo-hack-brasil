import type { CodigoErro } from "@studoo/contratos";
import { mensagensApi } from "@/mensagens/erros-api";
import type { CanalSessao } from "@/servidor/banco/gerado/client";
import { lerCookieSessao, origemStudoo } from "./origem";
import { usuarioDaSessao } from "./sessao";

const statusErros: Record<CodigoErro, number> = {
  material_invalido: 400, material_ilegivel: 422, reforco_indisponivel: 409, limite_estudio: 429,
  voz_indisponivel: 503, voz_vazia: 422, voz_tempo: 504, voz_falha: 502,
  google_indisponivel: 503,
  google_invalido: 400,
  google_conta_existente: 409,
  recuperacao_indisponivel: 503,
  codigo_invalido: 400,
  limite_recuperacao: 429,

  invalido: 400,
  nao_autenticado: 401,
  nao_encontrado: 404,
  origem_invalida: 403,
  falha: 500,
  proposta_invalida: 400,
  avaliacao_invalida: 400,
  credenciais_invalidas: 401,
  limite_login: 429,
  limite_visitante: 429,
  ia_indisponivel: 503,
  limite_geracoes: 429,
  link_inativo: 404,
  limite_compartilhar: 429,
  perfil_incompleto: 409,
  compartilhar_visitante: 403,
  trilha_recebida: 409,
  trilha_propria: 409,
  foto_invalida: 422,
  limite_foto: 429,
  explorar_material: 409,
  limite_comunidade: 429,
  seguir_invalido: 409,
  conteudo_recusado: 422,
  consentimento_ia: 428,
  confirmacao_invalida: 400,
};

export class FalhaApi extends Error {
  constructor(public readonly codigo: CodigoErro) {
    super(codigo);
  }
}

export const cabecalhosSeguros = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export function responder(dados: unknown, status = 200) {
  const headers = cabecalhosSeguros;
  return status === 204 ? new Response(null, { status, headers }) : Response.json(dados, { status, headers });
}

export async function lerJson(request: Request, maximo = 8192): Promise<unknown> {
  const tipo = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json" || !request.body || Number(request.headers.get("content-length")) > maximo) {
    throw new FalhaApi("invalido");
  }

  const leitura = request.body.getReader();
  const decodificador = new TextDecoder("utf-8", { fatal: true });
  let texto = "";
  let total = 0;
  try {
    while (true) {
      const { done, value } = await leitura.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximo) throw new FalhaApi("invalido");
      texto += decodificador.decode(value, { stream: true });
    }
    return JSON.parse(texto + decodificador.decode());
  } catch {
    await leitura.cancel().catch(() => undefined);
    throw new FalhaApi("invalido");
  } finally {
    leitura.releaseLock();
  }
}

async function tratarRota(acao: () => Promise<Response>): Promise<Response> {
  const inicio = performance.now();
  try {
    return await acao();
  } catch (erro) {
    const codigo = erro instanceof FalhaApi ? erro.codigo : "falha";
    const status = statusErros[codigo];
    const correlationId = crypto.randomUUID();
    if (status >= 500) {
      console.error(JSON.stringify({ correlationId, codigo, status, duracaoMs: Math.round(performance.now() - inicio) }));
    }
    const resposta = responder({ codigo, mensagem: mensagensApi[codigo] }, status);
    resposta.headers.set("X-Correlation-Id", correlationId);
    return resposta;
  }
}

function validarOrigemWeb(request: Request) {
  const origem = request.headers.get("origin");
  const leitura = request.method === "GET" || request.method === "HEAD";
  const permitida = origemStudoo();
  if ((!leitura || origem !== null) && (!permitida || origem !== permitida)) {
    throw new FalhaApi("origem_invalida");
  }
}

function validarCanalMobile(request: Request, indisponivel: "nao_encontrado" | "nao_autenticado") {
  if (request.headers.has("origin")) throw new FalhaApi("origem_invalida");
  if (request.headers.has("cookie")) throw new FalhaApi("nao_autenticado");

  const piloto = process.env.STUDOO_SESSAO_MOBILE_PILOTO === "1";
  const origem = origemStudoo();
  if (!piloto || !origem?.startsWith("https:")) throw new FalhaApi(indisponivel);

  const url = new URL(request.url);
  const autorizada = new URL(origem);
  if (process.env.STUDOO_PROXY_HTTPS === "1") {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    const hostEncaminhado = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
    if ((proto !== "https" && url.protocol !== "https:") || hostEncaminhado !== autorizada.host) {
      throw new FalhaApi(indisponivel);
    }
    return;
  }
  // O Next normaliza o host interno de Request.url no HTTPS local.
  if (url.protocol !== "https:" || url.port !== autorizada.port || request.headers.get("host") !== autorizada.host) {
    throw new FalhaApi(indisponivel);
  }
}

export function rotaPublica(request: Request, acao: () => Promise<Response>): Promise<Response> {
  return tratarRota(async () => {
    validarOrigemWeb(request);
    if (request.headers.has("authorization")) throw new FalhaApi("nao_autenticado");
    return acao();
  });
}

/**
 * Rota pública que também aceita sessão (cookie da web ou Bearer do app), sem exigir: a prévia de um link
 * compartilhado diz a quem está logado se a trilha já é dela. Sem sessão válida, segue como visitante anônimo.
 */
export function rotaPublicaComSessao(
  request: Request,
  acao: (usuarioId: string | null) => Promise<Response>,
): Promise<Response> {
  return tratarRota(async () => {
    if (request.headers.get("authorization") === null) {
      validarOrigemWeb(request);
      const token = lerCookieSessao(request);
      return acao(token ? await usuarioDaSessao(token, "WEB") : null);
    }
    const credencial = lerCredencial(request);
    return acao(await usuarioDaSessao(credencial.token, credencial.canal));
  });
}

export function rotaEntradaMobile(request: Request, acao: () => Promise<Response>): Promise<Response> {
  return tratarRota(async () => {
    validarCanalMobile(request, "nao_encontrado");
    if (request.headers.has("authorization")) throw new FalhaApi("nao_autenticado");
    return acao();
  });
}

type CredencialSessao = { canal: CanalSessao; token: string };

function lerCredencial(request: Request): CredencialSessao {
  const autorizacao = request.headers.get("authorization");
  if (autorizacao === null) {
    validarOrigemWeb(request);
    const token = lerCookieSessao(request);
    if (!token) throw new FalhaApi("nao_autenticado");
    return { canal: "WEB", token };
  }

  validarCanalMobile(request, "nao_autenticado");
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(autorizacao)?.[1];
  if (!token) throw new FalhaApi("nao_autenticado");
  return { canal: "MOBILE", token };
}

export function rotaPrivada(
  request: Request,
  acao: (usuarioId: string, credencial: CredencialSessao) => Promise<Response>,
): Promise<Response> {
  return tratarRota(async () => {
    const credencial = lerCredencial(request);
    const usuarioId = await usuarioDaSessao(credencial.token, credencial.canal);
    if (!usuarioId) throw new FalhaApi("nao_autenticado");
    return acao(usuarioId, credencial);
  });
}
