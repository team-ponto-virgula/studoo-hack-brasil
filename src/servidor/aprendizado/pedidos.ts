import type { CausaDeFalhaDaCriacao, CodigoErro, EstadoCriacao, EtapaDaCriacao } from "@studoo/contratos";
import { FalhaApi } from "@/servidor/acesso/http";
import { assinatura } from "@/servidor/acesso/seguranca";
import { banco } from "@/servidor/banco/cliente";
import type { Prisma } from "@/servidor/banco/gerado/client";

/*
 * O pedido de criação de uma trilha (spec 04, Retomada da criação). O aceite da proposta escreve todas as lições e pode levar minutos. Antes de gerar, o servidor registra o
 * pedido (um por conta e proposta: o id é o do comprovante e o do plano), para que o cliente recupere o resultado se a resposta se perder.
 *
 * - Um só lote por pedido: o registro é uma linha de chave (conta, id), então duas instâncias disputando criam uma linha só; a outra espera o resultado.
 * - O dono do lote renova `validoAte` a cada poucos segundos. Se o processo cai ou reinicia, o prazo vence e a consulta passa a mostrar a falha `interrompida` (sem gerar nada e
 *   sem consultar a IA): ninguém fica em "preparando" para sempre. Passado o teto do lote, vale `tempo`.
 * - Só um envio explícito (o POST do aceite) começa outro lote, e só se o anterior falhou ou foi abandonado. A consulta SÓ LÊ: nunca começa lote, nem escreve; o "abandonado" e o
 *   "estourou o teto" que ela mostra são calculados na hora, para exibição.
 * - O plano e o "pronto" são gravados na mesma transação, e só por quem ainda é o dono do lote (a tentativa que perdeu a vez não consegue gravar). Por isso a consulta lê o
 *   registro ANTES do plano: um registro pronto garante que o plano já está à vista na leitura seguinte. O plano salvo manda sobre qualquer linha.
 * - Sem token, tema, e-mail nem conteúdo no registro nem no log; a conta nunca aparece no log, só os 8 primeiros caracteres do id do pedido.
 */

/** O teto de um lote: o mesmo da rota (`maxDuration` de POST /api/aprendizado/planos). Passado esse tempo sem terminar, o servidor dá o pedido por falho. */
export const LIMITE_DO_LOTE_MS = 300_000;
/** Quanto tempo os pedidos terminados (prontos ou falhos) ficam guardados. */
export const GUARDA_DO_PEDIDO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * `validadeMs`: por quanto tempo o dono do lote vale sem renovar. `renovarMs`: de quanto em quanto ele renova (bem menor, para tolerar uma renovação perdida).
 * `entranteMs`: de quanto em quanto o POST que entrou num lote alheio olha o resultado.
 */
const tempos = { validadeMs: 45_000, renovarMs: 10_000, entranteMs: 1_500 };

/** Só para teste: troca os tempos acima por valores curtos (sem argumentos, volta aos de sempre). */
export function configurarTemposDoPedido(novos: Partial<typeof tempos> = { validadeMs: 45_000, renovarMs: 10_000, entranteMs: 1_500 }): void {
  Object.assign(tempos, novos);
}

/** Causas em que repetir o mesmo token não ajuda (a triagem recusou) ou não é possível (a proposta venceu). */
const SEM_REPETIR = new Set<CausaDeFalhaDaCriacao>(["seguranca", "proposta_expirada"]);

/** O que o servidor sabe de uma falha, em campos que cabem no registro. */
export interface FalhaDescrita {
  codigo: CodigoErro;
  causa: CausaDeFalhaDaCriacao;
  /** Motivo curto, só do servidor (o log e o registro; nunca vai ao cliente). */
  motivo?: string;
  /** Quanto falta para o limite acabar, se o servidor sabe (o Retry-After real da OpenAI ou o limite do Studoo). */
  esperaMs?: number;
}

const MOTIVO = /^[a-z][a-z0-9_]{0,23}$/;

export function descreverFalha(erro: unknown): FalhaDescrita {
  if (erro instanceof FalhaApi) {
    const { codigo, motivo, esperaMs } = erro;
    const curto = motivo && MOTIVO.test(motivo) ? motivo : undefined;
    const espera = typeof esperaMs === "number" && Number.isFinite(esperaMs) && esperaMs > 0 ? Math.ceil(esperaMs) : undefined;
    if (codigo === "conteudo_nocivo") return { codigo, causa: "seguranca", ...(curto ? { motivo: curto } : {}) };
    if (codigo === "proposta_invalida") return { codigo, causa: "proposta_expirada", ...(curto ? { motivo: curto } : {}) };
    if (codigo === "limite_geracoes" || curto === "limite_provedor") {
      return { codigo, causa: "limite", ...(curto ? { motivo: curto } : {}), ...(espera ? { esperaMs: espera } : {}) };
    }
    if (codigo === "ia_indisponivel") return { codigo, causa: curto === "tempo" ? "tempo" : "resposta_ia", ...(curto ? { motivo: curto } : {}) };
    return { codigo, causa: "outra", ...(curto ? { motivo: curto } : {}) };
  }
  return { codigo: "falha", causa: "outra" };
}

/** Quanto falta, em ms, para o limite do Studoo por conta (a janela da conta) acabar; `null` se não houver contagem vigente. */
export async function esperaDoLimiteDoStudoo(escopo: string, janelaMs: number): Promise<number | null> {
  const contagem = await banco.tentativaLogin.findUnique({ where: { chave: assinatura(escopo) }, select: { janelaInicio: true } });
  if (!contagem) return null;
  const restante = contagem.janelaInicio.getTime() + janelaMs - Date.now();
  return restante > 0 ? restante : null;
}

type Registro = NonNullable<Awaited<ReturnType<typeof lerRegistro>>>;

function lerRegistro(usuarioId: string, id: string) {
  return banco.pedidoCriacao.findUnique({ where: { usuarioId_id: { usuarioId, id } } });
}

function codigoDoErro(valor: string | null): CodigoErro {
  return (valor ?? "falha") as CodigoErro;
}

/** O registro do log: correlaciona etapa, resultado e duração pelo começo do id, sem conta, token nem tema. */
export function registrarCriacao(pedidoId: string, dados: Record<string, unknown>, falha = false) {
  const linha = JSON.stringify({ rota: "criacao-trilha", pedido: pedidoId.slice(0, 8), ...dados });
  if (falha) console.error(linha);
  else console.info(linha);
}

export type Posicao =
  /** Este processo é o dono do lote: gera e salva. `origem`: pedido novo, reenvio depois de falha ou lote assumido de um dono que parou. */
  | { acao: "iniciar"; tentativa: number; origem: "novo" | "reenvio" | "assumido" }
  /** Já existe um lote em curso (de outra instância): espera o resultado em vez de gerar de novo. */
  | { acao: "aguardar" }
  /** O pedido falhou de um jeito que repetir o mesmo token não resolve (ou ainda é cedo): devolve a mesma falha, sem gerar. */
  | { acao: "recusar"; falha: FalhaDescrita }
  /** O registro diz pronto: quem chama confere o plano. */
  | { acao: "pronto" };

function falhaDoRegistro(registro: Registro): FalhaDescrita {
  return {
    codigo: codigoDoErro(registro.codigo),
    causa: (registro.causa ?? "outra") as CausaDeFalhaDaCriacao,
    ...(registro.motivo ? { motivo: registro.motivo } : {}),
  };
}

/**
 * Registra o pedido ANTES de gerar, ou diz o que fazer com o que já existe. É o único caminho que pode começar um lote, e só o aceite explícito passa por aqui.
 */
export async function registrarPedido(usuarioId: string, id: string, propostaExpiraEm: Date, ganchos: { aposLer?: () => Promise<void> } = {}): Promise<Posicao> {
  const agora = new Date();
  const valido = new Date(agora.getTime() + tempos.validadeMs);
  try {
    await banco.pedidoCriacao.create({
      data: { usuarioId, id, estado: "em_preparo", tentativas: 1, iniciadoEm: agora, atualizadoEm: agora, validoAte: valido, propostaExpiraEm },
    });
    void limparPedidosAntigos();
    return { acao: "iniciar", tentativa: 1, origem: "novo" };
  } catch (erro) {
    if (typeof erro !== "object" || erro === null || !("code" in erro) || erro.code !== "P2002") throw erro;
  }

  const atual = await lerRegistro(usuarioId, id);
  if (!atual) return registrarPedido(usuarioId, id, propostaExpiraEm, ganchos); // apagado entre as duas leituras: tenta de novo
  await ganchos.aposLer?.(); // só para teste: o que acontece entre a leitura e a troca
  if (atual.estado === "pronto") return { acao: "pronto" };

  if (atual.estado === "em_preparo") {
    const vivo = atual.validoAte !== null && atual.validoAte.getTime() > agora.getTime() && agora.getTime() - atual.iniciadoEm.getTime() < LIMITE_DO_LOTE_MS;
    if (vivo) return { acao: "aguardar" };
    return assumir(atual, "assumido", agora, valido);
  }

  // Falhou: a segurança e a proposta vencida não se repetem com o mesmo token; o limite com prazo conhecido também não, até o prazo passar.
  const falha = falhaDoRegistro(atual);
  if (falha.causa === "seguranca") return { acao: "recusar", falha };
  if (propostaExpiraEm.getTime() <= agora.getTime() || atual.propostaExpiraEm.getTime() <= agora.getTime()) {
    return { acao: "recusar", falha: { codigo: "proposta_invalida", causa: "proposta_expirada" } };
  }
  if (falha.causa === "limite" && atual.aguardarAte && atual.aguardarAte.getTime() > agora.getTime()) return { acao: "recusar", falha };
  return assumir(atual, "reenvio", agora, valido);
}

/** Começa outro lote, se ninguém chegou antes: a troca é condicional ao número de tentativas que lemos, então só um processo ganha. */
async function assumir(atual: Registro, origem: "reenvio" | "assumido", agora: Date, valido: Date): Promise<Posicao> {
  // Um dono em preparo só perde o lote se o prazo AINDA estiver vencido (ou o teto estourado) na hora da troca: uma renovação que chegou depois da leitura vale.
  const parado = atual.estado === "em_preparo"
    ? { OR: [{ validoAte: null }, { validoAte: { lte: new Date() } }, { iniciadoEm: { lte: new Date(Date.now() - LIMITE_DO_LOTE_MS) } }] }
    : {};
  const ganhou = await banco.pedidoCriacao.updateMany({
    where: { usuarioId: atual.usuarioId, id: atual.id, tentativas: atual.tentativas, estado: atual.estado, ...parado },
    data: {
      estado: "em_preparo", tentativas: { increment: 1 }, etapa: null, iniciadoEm: agora, atualizadoEm: agora, validoAte: valido,
      concluidoEm: null, duracaoMs: null, codigo: null, causa: null, motivo: null, aguardarAte: null,
    },
  });
  if (ganhou.count !== 1) return { acao: "aguardar" };
  if (atual.estado === "em_preparo") {
    registrarCriacao(atual.id, { evento: "lote_abandonado", causa: Date.now() - atual.iniciadoEm.getTime() >= LIMITE_DO_LOTE_MS ? "tempo" : "interrompida", tentativa: atual.tentativas, duracaoMs: Date.now() - atual.iniciadoEm.getTime() }, true);
  }
  return { acao: "iniciar", tentativa: atual.tentativas + 1, origem };
}

/** O dono do lote anuncia a etapa e renova o prazo. Devolve `false` se o lote deixou de ser dele (outro assumiu depois de o prazo vencer). */
export async function avancarEtapa(usuarioId: string, id: string, tentativa: number, etapa: EtapaDaCriacao | null): Promise<boolean> {
  const agora = new Date();
  const feito = await banco.pedidoCriacao.updateMany({
    where: { usuarioId, id, estado: "em_preparo", tentativas: tentativa },
    data: { ...(etapa ? { etapa } : {}), atualizadoEm: agora, validoAte: new Date(agora.getTime() + tempos.validadeMs) },
  });
  return feito.count === 1;
}

/** Pede ao dono do lote que renove o prazo enquanto ele trabalha; devolve a função que para a renovação. */
export function manterDono(usuarioId: string, id: string, tentativa: number): () => void {
  const relogio = setInterval(() => {
    avancarEtapa(usuarioId, id, tentativa, null).catch(() => undefined);
  }, tempos.renovarMs);
  relogio.unref?.();
  return () => clearInterval(relogio);
}

/** O lote terminou mal: registra a falha, se o lote ainda é o dono do pedido. */
export async function falharPedido(usuarioId: string, id: string, tentativa: number, descricao: FalhaDescrita, duracaoMs: number): Promise<void> {
  const agora = new Date();
  await banco.pedidoCriacao.updateMany({
    where: { usuarioId, id, estado: "em_preparo", tentativas: tentativa },
    data: {
      estado: "falha", etapa: null, atualizadoEm: agora, validoAte: null, concluidoEm: agora, duracaoMs: Math.round(duracaoMs),
      codigo: descricao.codigo, causa: descricao.causa, motivo: descricao.motivo ?? null,
      aguardarAte: descricao.esperaMs ? new Date(agora.getTime() + descricao.esperaMs) : null,
    },
  });
}

/** Marca o pedido como pronto (usada quando o plano já existia, sem passar pela gravação do lote). */
export async function concluirPedido(usuarioId: string, id: string, duracaoMs?: number): Promise<void> {
  const agora = new Date();
  await banco.pedidoCriacao.updateMany({
    where: { usuarioId, id, estado: { not: "pronto" } },
    data: { estado: "pronto", etapa: null, atualizadoEm: agora, validoAte: null, concluidoEm: agora, codigo: null, causa: null, motivo: null, aguardarAte: null,
      ...(duracaoMs !== undefined ? { duracaoMs: Math.round(duracaoMs) } : {}) },
  });
}

/**
 * A primeira coisa da transação que grava o plano: o pedido vira "pronto" SE este lote ainda é o dono (a mesma tentativa, em preparo, ou dada por falha só porque o prazo venceu e
 * ninguém assumiu depois). Devolve `false` se perdeu a vez (outro lote assumiu, ou o pedido acabou): a transação então não grava nada.
 */
export async function tomarAVezDeGravar(tx: Prisma.TransactionClient, usuarioId: string, id: string, tentativa: number, duracaoMs: number): Promise<boolean> {
  const agora = new Date();
  const feito = await tx.pedidoCriacao.updateMany({
    where: { usuarioId, id, tentativas: tentativa, OR: [{ estado: "em_preparo" }, { estado: "falha", causa: { in: ["interrompida", "tempo"] } }] },
    data: { estado: "pronto", etapa: null, atualizadoEm: agora, validoAte: null, concluidoEm: agora, duracaoMs: Math.round(duracaoMs), codigo: null, causa: null, motivo: null, aguardarAte: null },
  });
  return feito.count === 1;
}

/** Apaga os pedidos antigos (prontos e falhos acabam em poucos dias; um em preparo parado há dias também). Chamada de passagem, sem esperar. */
export async function limparPedidosAntigos(): Promise<void> {
  try {
    await banco.pedidoCriacao.deleteMany({ where: { atualizadoEm: { lt: new Date(Date.now() - GUARDA_DO_PEDIDO_MS) } } });
  } catch {
    // A limpeza é de passagem: se falhar, a próxima tenta.
  }
}

function consultarEmMs(decorridoMs: number): number {
  if (decorridoMs < 20_000) return 2_000;
  if (decorridoMs < 120_000) return 3_000;
  return 5_000;
}

/**
 * O que o servidor sabe do pedido, sem chamar a IA, sem começar lote e SEM ESCREVER. `planoPronto` entrega o plano salvo (se houver): ele manda sobre qualquer linha.
 * Um pedido em preparo cujo dono parou, ou que passou do teto, aparece como falha (`interrompida` ou `tempo`), calculada na hora: o registro só muda no envio explícito.
 * Ordem das leituras: o registro primeiro, o plano depois (o plano e o "pronto" entram juntos, então registro pronto implica plano à vista).
 */
export async function consultarPedido(
  usuarioId: string,
  pedidoId: string,
  planoPronto: (usuarioId: string, id: string) => Promise<Extract<EstadoCriacao, { estado: "pronto" }>["plano"] | null>,
): Promise<EstadoCriacao> {
  const registro = await lerRegistro(usuarioId, pedidoId);
  const plano = await planoPronto(usuarioId, pedidoId);
  const agora = Date.now();

  if (plano) {
    return {
      estado: "pronto", pedidoId, plano,
      ...(registro ? { tentativas: registro.tentativas } : {}),
      ...(registro?.duracaoMs != null ? { duracaoMs: registro.duracaoMs } : {}),
    };
  }
  // Sem plano: sem registro, ou com um "pronto" cuja trilha foi apagada depois, é como se o servidor nunca tivesse recebido o pedido.
  if (!registro || registro.estado === "pronto") return { estado: "nao_recebido", pedidoId };

  if (registro.estado === "em_preparo") {
    const decorrido = agora - registro.iniciadoEm.getTime();
    const estourou = decorrido >= LIMITE_DO_LOTE_MS;
    const abandonado = registro.validoAte === null || registro.validoAte.getTime() <= agora;
    if (!estourou && !abandonado) {
      return {
        estado: "em_preparo", pedidoId, tentativas: registro.tentativas, etapa: (registro.etapa as EtapaDaCriacao | null) ?? null,
        decorridoMs: Math.max(0, decorrido), limiteMs: LIMITE_DO_LOTE_MS, consultarEmMs: consultarEmMs(decorrido),
      };
    }
    return falhaConfirmada({ ...registro, estado: "falha", codigo: "ia_indisponivel", causa: estourou ? "tempo" : "interrompida", motivo: null, aguardarAte: null }, agora);
  }

  return falhaConfirmada(registro, agora);
}

function falhaConfirmada(registro: Registro, agora: number): Extract<EstadoCriacao, { estado: "falha" }> {
  const causaGuardada = (registro.causa ?? "outra") as CausaDeFalhaDaCriacao;
  const venceu = registro.propostaExpiraEm.getTime() <= agora;
  // Vencida a proposta, o que importa é montar de novo (a segurança continua sendo a segurança).
  const expirada = venceu && causaGuardada !== "seguranca";
  const causa: CausaDeFalhaDaCriacao = expirada ? "proposta_expirada" : causaGuardada;
  const restante = registro.aguardarAte ? Math.ceil((registro.aguardarAte.getTime() - agora) / 1000) : 0;
  const esperando = causa === "limite" && restante > 0;
  return {
    estado: "falha",
    pedidoId: registro.id,
    tentativas: registro.tentativas,
    codigo: expirada ? "proposta_invalida" : codigoDoErro(registro.codigo),
    causa,
    repetivel: !SEM_REPETIR.has(causa) && !esperando,
    ...(esperando ? { aguardarSegundos: restante } : {}),
  };
}

/** Espera o resultado de um lote que é de outra instância. Devolve o registro terminal, ou `null` se o dono parou (quem espera pode assumir). */
export async function aguardarLoteAlheio(usuarioId: string, id: string, temPlano: () => Promise<boolean>): Promise<"pronto" | { falha: FalhaDescrita } | "abandonado"> {
  const inicio = Date.now();
  while (Date.now() - inicio < LIMITE_DO_LOTE_MS) {
    if (await temPlano()) return "pronto";
    const registro = await lerRegistro(usuarioId, id);
    if (!registro) return "abandonado";
    if (registro.estado === "pronto") return "pronto";
    if (registro.estado === "falha") return { falha: falhaDoRegistro(registro) };
    const parado = registro.validoAte === null || registro.validoAte.getTime() <= Date.now() || Date.now() - registro.iniciadoEm.getTime() >= LIMITE_DO_LOTE_MS;
    if (parado) return "abandonado";
    await new Promise((resolver) => setTimeout(resolver, tempos.entranteMs));
  }
  return "abandonado";
}
