import type { CodigoErro } from "@/contratos/aprendizado";
import { mensagensApi } from "@/mensagens/erros-api";
import { lerCookieSessao, origemStudoo } from "./origem";
import { usuarioDaSessao } from "./sessao";

const statusErros: Record<CodigoErro, number> = {
  invalido: 400,
  nao_autenticado: 401,
  nao_encontrado: 404,
  origem_invalida: 403,
  falha: 500,
  objetivo_fora_do_piloto: 422,
  proposta_invalida: 400,
  avaliacao_invalida: 400,
  credenciais_invalidas: 401,
  limite_login: 429,
  ia_indisponivel: 503,
};

export class FalhaApi extends Error {
  constructor(public readonly codigo: CodigoErro) {
    super(codigo);
  }
}

export function responder(dados: unknown, status = 200) {
  const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
  return status === 204 ? new Response(null, { status, headers }) : Response.json(dados, { status, headers });
}

export async function lerJson(request: Request): Promise<unknown> {
  const maximo = 8192;
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

export async function rotaPublica(request: Request, acao: () => Promise<Response>): Promise<Response> {
  const inicio = performance.now();
  try {
    const origem = request.headers.get("origin");
    const leitura = request.method === "GET" || request.method === "HEAD";
    const permitida = origemStudoo();
    if ((!leitura || origem !== null) && (!permitida || origem !== permitida)) {
      throw new FalhaApi("origem_invalida");
    }
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

export function rotaPrivada(request: Request, acao: (usuarioId: string) => Promise<Response>): Promise<Response> {
  return rotaPublica(request, async () => {
    const token = lerCookieSessao(request);
    const usuarioId = token ? await usuarioDaSessao(token) : null;
    if (!usuarioId) throw new FalhaApi("nao_autenticado");
    return acao(usuarioId);
  });
}
