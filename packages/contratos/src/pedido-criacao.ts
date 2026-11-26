import type { CodigoErro, PlanoDetalhe } from './aprendizado';

/*
 * Retomada da criação da trilha (spec 04, Retomada da criação). "Começar a lição 1" e "Salvar para depois" mandam o aceite da proposta (POST /api/aprendizado/planos), que escreve
 * as lições e pode levar minutos. Se a resposta se perde (rede, segundo plano, app fechado), o cliente não pode adivinhar o que houve: ele pergunta ao servidor.
 *
 * - Identidade: `PropostaPlano.pedidoId`. É o mesmo id que o comprovante assinado (`token`) já carrega e que vira o id do plano (`PlanoDetalhe.id`). Sozinho não
 *   autoriza nada: a consulta é autenticada e por conta (o par conta + pedidoId), e um id de outra conta responde `nao_recebido`.
 * - Consulta: GET /api/aprendizado/pedidos/{pedidoId} (`cliente.consultarCriacao`). Nunca chama a IA, nunca inicia lote e não leva token nem conteúdo na URL.
 * - Reenvio: POST /api/aprendizado/planos com o MESMO `token`. O servidor deduplica por conta + pedidoId: um segundo envio entra no lote em curso (e devolve o plano
 *   quando termina) ou, se o lote falhou ou foi interrompido, é a única forma de iniciar outro (`tentativas` sobe). O POST segue devolvendo `PlanoDetalhe`.
 */

/** As etapas que o servidor percorre num lote, em ordem. `null` no estado enquanto ele ainda não começou a primeira. */
export const ETAPAS_DA_CRIACAO = ['triagem', 'licoes', 'revisao', 'gravacao'] as const;
export type EtapaDaCriacao = (typeof ETAPAS_DA_CRIACAO)[number];

/**
 * Por que o servidor deu o pedido por falho, em palavras que o cliente sabe diferenciar (cada uma tem o seu texto em `mensagens.geracao.falhaDaCriacao`):
 * - `resposta_ia`: a IA respondeu, mas não deu uma lição utilizável (ou ficou fora do ar);
 * - `limite`: um limite temporário (o do Studoo por conta ou o do provedor). O prazo só vem em `aguardarSegundos` quando é conhecido;
 * - `tempo`: o lote estourou o prazo;
 * - `interrompida`: o servidor parou de trabalhar nele (reinício ou queda) antes de terminar;
 * - `seguranca`: a triagem de segurança recusou o tema ou o conteúdo (não adianta repetir);
 * - `proposta_expirada`: a proposta venceu (30 minutos) antes de o lote terminar ou começar;
 * - `outra`: qualquer outra falha do servidor, sem diagnóstico inventado.
 */
export const CAUSAS_DE_FALHA_DA_CRIACAO = ['resposta_ia', 'limite', 'tempo', 'interrompida', 'seguranca', 'proposta_expirada', 'outra'] as const;
export type CausaDeFalhaDaCriacao = (typeof CAUSAS_DE_FALHA_DA_CRIACAO)[number];

/** O servidor não tem registro deste pedido (nem plano). Pode ser que o envio nunca tenha chegado, ou que ainda esteja a caminho: veja `decidirDepoisDaConsulta`. */
export interface CriacaoNaoRecebida {
  estado: 'nao_recebido';
  pedidoId: string;
}

/** Um lote está escrevendo as lições. `etapa` é só informação; `consultarEmMs` é o ritmo que o servidor sugere. */
export interface CriacaoEmPreparo {
  estado: 'em_preparo';
  pedidoId: string;
  /** Quantos lotes o servidor iniciou para este pedido (1 no normal; consulta e reenvio em curso não aumentam). É a prova de "uma geração só". */
  tentativas: number;
  etapa: EtapaDaCriacao | null;
  /** Há quanto tempo o lote atual começou, pelo relógio do servidor (sem depender do relógio do aparelho). */
  decorridoMs: number;
  /** O teto do lote: passado esse tempo sem terminar, o servidor dá o pedido por falho (`tempo` ou `interrompida`). Nunca fica em preparo para sempre. */
  limiteMs: number;
  consultarEmMs: number;
}

/** A trilha foi salva, com o plano. `tentativas` falta nas trilhas criadas antes desta versão (o servidor não tem o registro do pedido). */
export interface CriacaoPronta {
  estado: 'pronto';
  pedidoId: string;
  tentativas?: number;
  duracaoMs?: number;
  plano: PlanoDetalhe;
}

/** O servidor confirmou que o lote falhou. `repetivel`: o mesmo `token` ainda serve para um novo envio (a proposta não venceu e a causa não é a segurança). */
export interface CriacaoFalhou {
  estado: 'falha';
  pedidoId: string;
  tentativas: number;
  codigo: CodigoErro;
  causa: CausaDeFalhaDaCriacao;
  repetivel: boolean;
  /** Só quando o servidor sabe quanto falta (o limite do Studoo por conta). Sem ele, o texto não promete prazo. */
  aguardarSegundos?: number;
}

/** O que o servidor responde a GET /api/aprendizado/pedidos/{pedidoId}. */
export type EstadoCriacao = CriacaoNaoRecebida | CriacaoEmPreparo | CriacaoPronta | CriacaoFalhou;

/**
 * O que o cliente sabe depois de tentar consultar. `desconhecido` só existe no cliente: a consulta em si falhou (sem rede, tempo esgotado, erro do servidor, sessão vencida),
 * e isso NUNCA vale como "não recebido".
 */
export type EstadoCriacaoNoCliente =
  | EstadoCriacao
  | { estado: 'desconhecido'; pedidoId: string; motivo: 'rede' | 'servidor' | 'sessao' };

/** Classifica o erro de uma consulta que não chegou a ter um estado do servidor. Erro de rede, de tempo ou do servidor deixa o estado desconhecido, nunca ausente. */
export function estadoDaConsultaQueFalhou(pedidoId: string, erro: unknown): EstadoCriacaoNoCliente {
  const codigo = erro instanceof Error && erro.name === 'ErroStudoo' ? (erro as { codigo?: unknown }).codigo : undefined;
  if (codigo === 'nao_autenticado') return { estado: 'desconhecido', pedidoId, motivo: 'sessao' };
  if (codigo !== undefined) return { estado: 'desconhecido', pedidoId, motivo: 'servidor' };
  return { estado: 'desconhecido', pedidoId, motivo: 'rede' };
}

/**
 * Junta o que o cliente já sabia com uma resposta nova, na ordem em que as respostas CHEGAM (que não é a ordem em que saíram):
 * - `pronto` é final: nenhum erro, ausência ou "em preparo" que chegue depois o desfaz;
 * - uma resposta de uma tentativa mais antiga que a já conhecida é ignorada;
 * - fora isso, a mais recente vale, inclusive `desconhecido` (a consulta mais nova não conseguiu falar com o servidor).
 */
export function aplicarConsultaDaCriacao(atual: EstadoCriacaoNoCliente | null, recebido: EstadoCriacaoNoCliente): EstadoCriacaoNoCliente {
  if (!atual) return recebido;
  if (atual.pedidoId !== recebido.pedidoId) return atual;
  if (atual.estado === 'pronto') return atual;
  if (recebido.estado === 'pronto') return recebido;
  const antiga = 'tentativas' in atual && 'tentativas' in recebido && typeof atual.tentativas === 'number' && typeof recebido.tentativas === 'number'
    && recebido.tentativas < atual.tentativas;
  return antiga ? atual : recebido;
}

/** Os ritmos da consulta, iguais na web e no app. */
export const CONSULTA_DA_CRIACAO = {
  /** Logo depois de enviar, "não recebido" pode ser só uma corrida: reconfere neste ritmo, por esta janela, sem chamar a IA. */
  reconferirAusenteACadaMs: 2_000,
  reconferirAusentePorMs: 20_000,
  /** Em preparo: o ritmo mínimo e o máximo aceitos, qualquer que seja a sugestão do servidor. */
  emPreparoMinimoMs: 1_500,
  emPreparoMaximoMs: 10_000,
  /** Sem conseguir falar com o servidor: esperas crescentes entre as consultas, e a última se repete. */
  semRespostaEsperasMs: [2_000, 4_000, 8_000, 15_000],
} as const;

export type AcaoDaCriacao =
  | { acao: 'concluir'; plano: PlanoDetalhe }
  | { acao: 'falhou'; falha: CriacaoFalhou }
  | { acao: 'esperar'; emMs: number }
  /** Ausência confirmada e a janela de reconferência acabou: oferece reenviar, a um toque, com a mesma proposta e o mesmo pedidoId. */
  | { acao: 'reenviar' }
  /** Não deu para saber (rede, servidor): continua "verificando", sem erro e sem reenviar, e consulta de novo depois de `emMs`. */
  | { acao: 'verificar_depois'; emMs: number }
  /** A sessão venceu: o cliente vai ao login e guarda o pedido para retomar na mesma conta. */
  | { acao: 'entrar' };

/**
 * O que fazer depois de cada consulta. `enviadoHaMs`: quanto tempo se passou desde o envio do POST (relógio do cliente); `semRespostaSeguidas`: quantas consultas seguidas deixaram o
 * estado desconhecido, para o ritmo crescer.
 */
export function decidirDepoisDaConsulta(
  estado: EstadoCriacaoNoCliente,
  contexto: { enviadoHaMs: number; semRespostaSeguidas?: number },
): AcaoDaCriacao {
  const c = CONSULTA_DA_CRIACAO;
  switch (estado.estado) {
    case 'pronto':
      return { acao: 'concluir', plano: estado.plano };
    case 'falha':
      return { acao: 'falhou', falha: estado };
    case 'em_preparo':
      return { acao: 'esperar', emMs: Math.min(c.emPreparoMaximoMs, Math.max(c.emPreparoMinimoMs, estado.consultarEmMs)) };
    case 'nao_recebido':
      return contexto.enviadoHaMs < c.reconferirAusentePorMs ? { acao: 'esperar', emMs: c.reconferirAusenteACadaMs } : { acao: 'reenviar' };
    case 'desconhecido': {
      if (estado.motivo === 'sessao') return { acao: 'entrar' };
      const esperas = c.semRespostaEsperasMs;
      const posicao = Math.min(Math.max(0, (contexto.semRespostaSeguidas ?? 1) - 1), esperas.length - 1);
      return { acao: 'verificar_depois', emMs: esperas[posicao] };
    }
  }
}

/** O que o cliente guarda ANTES de enviar o aceite e apaga quando a criação termina (ou a pessoa desiste). Por conta e só no armazenamento do aparelho. */
export interface CriacaoPendente {
  versao: 1;
  pedidoId: string;
  /** O comprovante assinado, necessário para reenviar. Nunca vai na URL nem no log. */
  token: string;
  intencao: 'comecar' | 'salvar';
  titulo: string;
  licoes: number;
  partes: number;
  /** Epoch ms do primeiro envio. */
  enviadoEm: number;
  /** Epoch ms em que a proposta vence, se o servidor informou. */
  propostaExpiraEm?: number;
}

const ID_DO_PEDIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function pedidoIdValido(valor: unknown): valor is string {
  return typeof valor === 'string' && ID_DO_PEDIDO.test(valor);
}

/** Valida um pedido pendente já lido do armazenamento. Qualquer coisa fora do formato (versão antiga, texto estragado) vira `null`. */
export function criacaoPendenteValida(dado: unknown): CriacaoPendente | null {
  if (typeof dado !== 'object' || dado === null) return null;
  const x = dado as Record<string, unknown>;
  const inteiro = (valor: unknown): valor is number => typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0;
  if (x.versao !== 1 || !pedidoIdValido(x.pedidoId) || typeof x.token !== 'string' || x.token.length === 0 || x.token.length > 6000) return null;
  if (x.intencao !== 'comecar' && x.intencao !== 'salvar') return null;
  if (typeof x.titulo !== 'string' || !inteiro(x.licoes) || !inteiro(x.partes) || !inteiro(x.enviadoEm)) return null;
  if (x.propostaExpiraEm !== undefined && !inteiro(x.propostaExpiraEm)) return null;
  return {
    versao: 1,
    pedidoId: x.pedidoId,
    token: x.token,
    intencao: x.intencao,
    titulo: x.titulo.slice(0, 200),
    licoes: x.licoes,
    partes: x.partes,
    enviadoEm: x.enviadoEm,
    ...(x.propostaExpiraEm !== undefined ? { propostaExpiraEm: x.propostaExpiraEm } : {}),
  };
}

/** Quantos pedidos pendentes o aparelho guarda por conta (a pessoa pode ter mandado outra proposta antes de a primeira terminar). */
export const MAXIMO_DE_CRIACOES_PENDENTES = 5;

/**
 * Lê a lista guardada no aparelho: só os itens válidos, sem repetir o pedidoId, do mais antigo para o mais novo. Texto estragado ou de outra versão vira lista vazia, e o cliente segue
 * sem pedido pendente.
 */
export function lerCriacoesPendentes(texto: string | null | undefined): CriacaoPendente[] {
  if (!texto) return [];
  let dado: unknown;
  try {
    dado = JSON.parse(texto);
  } catch {
    return [];
  }
  if (!Array.isArray(dado)) return [];
  const vistos = new Set<string>();
  const lista: CriacaoPendente[] = [];
  for (const item of dado) {
    const valido = criacaoPendenteValida(item);
    if (valido && !vistos.has(valido.pedidoId)) {
      vistos.add(valido.pedidoId);
      lista.push(valido);
    }
  }
  return lista.sort((a, b) => a.enviadoEm - b.enviadoEm).slice(-MAXIMO_DE_CRIACOES_PENDENTES);
}

export function textoDasCriacoesPendentes(lista: readonly CriacaoPendente[]): string {
  return JSON.stringify(lista);
}

/** Põe (ou troca, pelo mesmo pedidoId) um pedido na lista; passando do máximo, o mais antigo sai. */
export function comCriacaoPendente(lista: readonly CriacaoPendente[], pendente: CriacaoPendente): CriacaoPendente[] {
  return [...lista.filter((item) => item.pedidoId !== pendente.pedidoId), pendente]
    .sort((a, b) => a.enviadoEm - b.enviadoEm)
    .slice(-MAXIMO_DE_CRIACOES_PENDENTES);
}

export function semCriacaoPendente(lista: readonly CriacaoPendente[], pedidoId: string): CriacaoPendente[] {
  return lista.filter((item) => item.pedidoId !== pedidoId);
}

/** A chave do armazenamento do aparelho: uma por conta (`conta` vem de GET /api/sessao), para que outra conta no mesmo aparelho nunca veja nem reenvie o pedido. Guarda a lista inteira. */
export function chaveDaCriacaoPendente(conta: string): string {
  return `studoo.criacao.pendente.${conta}`;
}
