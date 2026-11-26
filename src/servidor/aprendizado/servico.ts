import { dataLocalDoEstudo } from './progresso-perfil';
import { perfilDiagnosticoValido, type PerfilDiagnostico } from '@studoo/contratos';
import { ORIGEM_GERADA, origemDoConteudo } from "@/dominio/aprendizado/plano";
import { conteudosDoMaterial } from '../estudio/materiais';
import type {
  AutoAvaliacao,
  ResumoConclusao,
  Avaliacao,
  Conclusao,
  LicaoDetalhe,
  PlanoDetalhe,
  PlanoResumo,
  PropostaPlano,
} from "@studoo/contratos";
import { motivoParaRever, normalizarResolucao, responderSuaVez, type Capacidades, type EscolhaNoSuaVez, type EstadoCriacao, type EtapaDaCriacao, type RespostaDoSuaVez, pedidoIdValido } from "@studoo/contratos";
import {
  apresentarExercicio,
  avaliarResposta,
  calcularProgresso,
  conteudoValido,
  type AmostraDemonstrada,
  type ConteudoLicao,
  type EsqueletoPlano,
} from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { banco } from "@/servidor/banco/cliente";
import type { Prisma } from "@/servidor/banco/gerado/client";
import { exigirLicoesSeguras, exigirTrilhaSegura } from "@/servidor/ia/seguranca-trilhas";
import { GERADOR_OPENAI } from "@/servidor/ia/openai";
import { consumirLimite } from "@/servidor/acesso/seguranca";
import { obterGerador, provedorIaAtivo } from "@/servidor/ia/gerador";
import { podeUsarIa } from "@/servidor/privacidade/consentimento";
import { emitirComprovante, lerComprovante } from "./comprovantes";
import { refinarAvaliacao } from "./correcao";
import { consumirGeracaoPersistente } from "@/servidor/ia/limite";
import { iniciarGeracao } from "./geracao";
import {
  aguardarLoteAlheio, avancarEtapa, concluirPedido, consultarPedido, descreverFalha, esperaDoLimiteDoStudoo, falharPedido, manterDono, registrarCriacao, registrarPedido, tomarAVezDeGravar,
  type FalhaDescrita,
} from "./pedidos";
import { ordemDoSuaVez } from "./ordem-sua-vez";
import { SEM_CAPACIDADES, comFormulasParaOCliente, comTextoLinear, comVisuais, conteudoEhDeMatematica, semCifraoSolto, visualDoRetorno } from "./visuais";
import { marcasDasTrilhas } from "@/servidor/compartilhar/servico";
import { demoPelaChave } from "@/servidor/ia/demos";
import { MATERIAL_COMPARTILHADO, TEMAS, type Tema } from "@studoo/contratos";

/** Lições escritas ao mesmo tempo no aceite (`STUDOO_GERACAO_PARALELA`, de 1 a 10; padrão 10, todas juntas). */
export function geracaoParalela(): number {
  const valor = Number(process.env.STUDOO_GERACAO_PARALELA?.trim());
  return Number.isInteger(valor) && valor >= 1 && valor <= 10 ? valor : 10;
}

/** Prazo compartilhado pelas lições e reparos. Uma onda tem até 220 s, com teto total de 240 s. */
export function tempoDoAceite(licoes: number, paralelas = geracaoParalela()): number {
  const ondas = Math.max(1, Math.ceil(licoes / paralelas));
  return Math.min(240_000, 220_000 * ondas);
}
const DURACAO_AVALIACAO = 15 * 60 * 1000;

const selecaoPlano = {
  id: true,
  titulo: true,
  capa: true,
  tema: true,
  objetivo: true,
  diagnostico: true,
  origem: true,
  origemNome: true,
  origemPerfilId: true,
  origemCodigo: true,
  fluxos: {
    orderBy: { ordem: "asc" },
    select: {
      id: true,
      titulo: true,
      licoes: {
        orderBy: { ordem: "asc" },
        select: {
          id: true,
          titulo: true,
          conclusao: { select: { licaoId: true, segundos: true, acertosDePrimeira: true, exercicios: true, pratica: true } },
          apoio: { select: { reforco: true, reforcoConcluido: true } },
        },
      },
    },
  },
} satisfies Prisma.PlanoAprendizadoSelect;

type PlanoPersistido = Prisma.PlanoAprendizadoGetPayload<{ select: typeof selecaoPlano }>;

/** Proposta de uma vez, para o cliente que não acompanha a geração (POST /propostas). */
export async function gerarProposta(usuarioId: string, objetivo: string, diagnostico?: PerfilDiagnostico, amostrasDemonstradas?: AmostraDemonstrada[]): Promise<PropostaPlano> {
  const geracao = iniciarGeracao(usuarioId, objetivo, { verificarLimite: false, diagnostico, amostrasDemonstradas });
  if (!(await consumirGeracaoPersistente(usuarioId))) {
    throw new FalhaApi("limite_geracoes");
  }
  for await (const evento of geracao.eventos(new AbortController().signal, { aoVivo: false })) {
    if (evento.tipo === "pronto") return evento.proposta;
    if (evento.tipo === "erro") throw new FalhaApi(evento.codigo);
  }
  throw new FalhaApi("falha");
}

function apresentarPlano(plano: PlanoPersistido): PlanoDetalhe {
  const fluxos = plano.fluxos.map(({ id, titulo, licoes }) => {
    const licoesPublicas = licoes.map(({ id, titulo, conclusao, apoio }) => {
      // Vale rever: a maior parte dos exercícios saiu errada antes do acerto ou a prática ainda não saiu.
      const rever = conclusao ? motivoParaRever(conclusao) : null;
      return {
        id,
        titulo,
        concluida: conclusao !== null,
        ...(apoio?.reforco ? { ponte: { concluida: apoio.reforcoConcluido || Boolean((apoio.reforco as { algumaConcluida?: boolean } | null)?.algumaConcluida) } } : {}),
        ...(rever ? { rever } : {}),
      };
    });
    const concluidas = licoesPublicas.filter((licao) => licao.concluida).length;
    const proximaLicao = licoesPublicas.find((licao) => !licao.concluida);
    return {
      id,
      titulo,
      progresso: calcularProgresso(concluidas, licoesPublicas.length),
      proximaLicaoId: proximaLicao?.id ?? null,
      licoes: licoesPublicas,
    };
  });

  const concluidas = fluxos.reduce((total, fluxo) => total + fluxo.progresso.concluidas, 0);
  const total = fluxos.reduce((total, fluxo) => total + fluxo.progresso.total, 0);
  // Somas das lições concluídas que trouxeram o resumo (as de antes desta versão ficam de fora).
  const resumos = plano.fluxos.flatMap(({ licoes }) => licoes.map(({ conclusao }) => conclusao))
    .filter((conclusao) => conclusao?.segundos != null && conclusao.exercicios != null && conclusao.acertosDePrimeira != null);
  return {
    id: plano.id,
    titulo: plano.titulo,
    objetivo: plano.objetivo,
    ...(perfilDiagnosticoValido(plano.diagnostico) && { diagnostico: plano.diagnostico }),
    origem: origemDoConteudo(plano.origem),
    ...(plano.capa ? { capa: plano.capa } : {}),
    ...(plano.tema && (TEMAS as readonly string[]).includes(plano.tema) ? { tema: plano.tema as Tema } : {}),
    progresso: calcularProgresso(concluidas, total),
    fluxos,
    ...(resumos.length > 0 ? {
      estatisticas: {
        segundos: resumos.reduce((soma, item) => soma + (item?.segundos ?? 0), 0),
        acertosDePrimeira: resumos.reduce((soma, item) => soma + (item?.acertosDePrimeira ?? 0), 0),
        exercicios: resumos.reduce((soma, item) => soma + (item?.exercicios ?? 0), 0),
      },
    } : {}),
  };
}

function lerPlano(usuarioId: string, id: string) {
  return banco.planoAprendizado.findUnique({
    where: { usuarioId_id: { usuarioId, id } },
    select: selecaoPlano,
  });
}

export async function buscarPlano(usuarioId: string, id: string): Promise<PlanoDetalhe> {
  const plano = await lerPlano(usuarioId, id);
  if (!plano) {
    throw new FalhaApi("nao_encontrado");
  }
  const marcas = await marcasDasTrilhas(usuarioId, [plano]);
  return { ...apresentarPlano(plano), ...marcas.get(plano.id) };
}

/**
 * Apaga uma trilha da pessoa, com as partes, as lições, as conclusões e o apoio delas, tudo de uma vez. Trilha de outra
 * pessoa (ou que não existe) responde `nao_encontrado`, como na leitura.
 */
export async function apagarPlano(usuarioId: string, id: string): Promise<void> {
  await banco.$transaction(async (tx) => {
    const plano = await tx.planoAprendizado.findUnique({ where: { usuarioId_id: { usuarioId, id } }, select: { id: true } });
    if (!plano) throw new FalhaApi("nao_encontrado");
    const fluxos = (await tx.fluxo.findMany({ where: { usuarioId, planoId: id }, select: { id: true } })).map((fluxo) => fluxo.id);
    const licoes = (await tx.licao.findMany({ where: { usuarioId, fluxoId: { in: fluxos } }, select: { id: true } })).map((licao) => licao.id);
    await tx.registroEstudo.deleteMany({ where: { usuarioId, licaoId: { in: licoes } } });
    await tx.apoioLicao.deleteMany({ where: { usuarioId, licaoId: { in: licoes } } });
    await tx.licao.deleteMany({ where: { usuarioId, id: { in: licoes } } });
    await tx.fluxo.deleteMany({ where: { usuarioId, planoId: id } });
    await tx.planoAprendizado.delete({ where: { usuarioId_id: { usuarioId, id } } });
    // O pedido de criação da trilha (spec 04, Retomada da criação) acaba com ela: depois, quem pergunta por ele recebe "não recebido".
    await tx.pedidoCriacao.deleteMany({ where: { usuarioId, id } });
  });
}

export async function listarPlanos(usuarioId: string): Promise<PlanoResumo[]> {
  const planos = await banco.planoAprendizado.findMany({
    where: { usuarioId },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    select: selecaoPlano,
  });

  const marcas = await marcasDasTrilhas(usuarioId, planos);
  return planos.map((plano) => {
    const { id, titulo, progresso, capa, tema, diagnostico } = apresentarPlano(plano);
    return { id, titulo, progresso, ...(capa ? { capa } : {}), ...(tema ? { tema } : {}), ...(diagnostico && { diagnostico }), ...marcas.get(id) };
  });
}

/** Pede ao gerador o conteúdo de cada lição do esqueleto aceito e valida o que voltou. */
async function gerarConteudos(usuarioId: string, plano: EsqueletoPlano, aoEtapa: (etapa: EtapaDaCriacao) => void = () => undefined): Promise<ConteudoLicao[][]> {
  const pedido = {
    titulo: plano.titulo, objetivo: plano.objetivo, diagnostico: plano.diagnostico,
    amostrasDemonstradas: plano.amostrasDemonstradas, fluxos: plano.fluxos,
  };
  if (plano.gerador === "material-v1" && plano.materialId) {
    const conteudos = await conteudosDoMaterial(usuarioId, plano.materialId);
    aoEtapa("revisao");
    await exigirLicoesSeguras(pedido, conteudos.flat());
    return conteudos;
  }
  await exigirTrilhaSegura({ plano: pedido });
  aoEtapa("licoes");
  const gerador = obterGerador();
  // Uma chamada por lição, no máximo `geracaoParalela()` em andamento. Contas com limite baixo por minuto (a OpenAI do
  // dono: 10 mil tokens/min) usam 1 ou 2; com todas juntas, as chamadas estouram o limite ao mesmo tempo (429 em todas).
  // Cada chamada mantém as novas tentativas do 429 (`comNovasTentativas`). Na primeira falha, nenhuma nova começa.
  const tarefas = plano.fluxos.flatMap((fluxo, indiceFluxo) => fluxo.licoes.map((_licao, indiceLicao) => ({ indiceFluxo, indiceLicao })));
  const paralelas = geracaoParalela();
  // Na primeira falha, as chamadas que ainda estão no ar também param: um lote que falhou não deixa pedidos soltos ao provedor (nem esperas de novas tentativas) por trás, para
  // não somar com o lote seguinte nem gastar o limite à toa.
  const cancelar = new AbortController();
  const sinal = AbortSignal.any([AbortSignal.timeout(tempoDoAceite(tarefas.length, paralelas)), cancelar.signal]);
  const conteudos: ConteudoLicao[][] = plano.fluxos.map(() => []);
  let proxima = 0;
  let falhou = false;
  let primeiraFalha: unknown;
  async function trabalhar() {
    while (!falhou && !sinal.aborted && proxima < tarefas.length) {
      const { indiceFluxo, indiceLicao } = tarefas[proxima++];
      try {
        conteudos[indiceFluxo][indiceLicao] = await gerador.gerarConteudo(plano, indiceFluxo, indiceLicao, sinal, { prazoCompartilhado: true });
      } catch (erro) {
        // A causa que vale é a da PRIMEIRA falha: as outras chamadas, paradas por ela, só dizem "tempo".
        if (!falhou) primeiraFalha = erro;
        falhou = true;
        cancelar.abort();
        throw erro;
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(paralelas, tarefas.length) }, trabalhar));
  } catch (erro) {
    throw falhou ? primeiraFalha : erro;
  }
  if (sinal.aborted) throw new FalhaApi("ia_indisponivel", undefined, "tempo");
  aoEtapa("revisao");
  const revisados = gerador.revisarConteudos ? await gerador.revisarConteudos(plano, conteudos, sinal) : conteudos;
  if (!revisados.every((licoes) => licoes.every(conteudoValido))) {
    throw new FalhaApi("ia_indisponivel", undefined, "conteudo_invalido");
  }
  await exigirLicoesSeguras(pedido, revisados.flat());
  return revisados;
}

/**
 * Aceites em andamento, por pessoa e proposta. Com a IA real, o aceite escreve todas as lições (vários pedidos ao
 * provedor): um segundo aceite igual, enquanto o primeiro corre, espera o mesmo resultado em vez de gerar tudo de novo.
 */
const aceitesEmAndamento = new Map<string, Promise<PlanoDetalhe>>();

export async function aceitarProposta(usuarioId: string, token: string): Promise<PlanoDetalhe> {
  const proposta = lerComprovante("proposta", usuarioId, token);
  if (!proposta?.plano) {
    throw new FalhaApi("nao_encontrado");
  }

  const id = proposta.id;
  const existente = await lerPlano(usuarioId, id);
  if (existente) {
    void concluirPedido(usuarioId, id).catch(() => undefined);
    return apresentarPlano(existente);
  }
  if (proposta.expiraEm <= Date.now()) {
    throw new FalhaApi("proposta_invalida");
  }

  const chave = `${usuarioId}:${id}`;
  const emAndamento = aceitesEmAndamento.get(chave);
  if (emAndamento) return emAndamento;
  const aceite = executarAceite(usuarioId, id, proposta.plano, new Date(proposta.expiraEm)).finally(() => aceitesEmAndamento.delete(chave));
  aceitesEmAndamento.set(chave, aceite);
  return aceite;
}

/**
 * O aceite com o pedido registrado (spec 04, Retomada da criação): um só lote por conta e proposta, em qualquer instância. Quem chega com um lote vivo de outra instância espera o
 * resultado dele; só um lote que falhou ou foi abandonado deixa outro começar, e só por este POST (a consulta nunca começa nada).
 */
async function executarAceite(usuarioId: string, id: string, plano: EsqueletoPlano, propostaExpiraEm: Date): Promise<PlanoDetalhe> {
  for (let volta = 0; volta < 4; volta += 1) {
    const posicao = await registrarPedido(usuarioId, id, propostaExpiraEm);
    if (posicao.acao === "pronto") {
      const existente = await lerPlano(usuarioId, id);
      if (existente) return apresentarPlano(existente);
      // Pedido pronto sem plano: a trilha foi apagada. O registro acaba e o aceite recomeça como um pedido novo.
      await banco.pedidoCriacao.deleteMany({ where: { usuarioId, id, estado: "pronto" } });
      continue;
    }
    if (posicao.acao === "recusar") {
      throw new FalhaApi(posicao.falha.codigo, undefined, posicao.falha.motivo, posicao.falha.esperaMs);
    }
    if (posicao.acao === "aguardar") {
      registrarCriacao(id, { evento: "entrou_no_lote" });
      const resultado = await aguardarLoteAlheio(usuarioId, id, async () => (await lerPlano(usuarioId, id)) !== null);
      if (resultado === "pronto") {
        const pronto = await lerPlano(usuarioId, id);
        if (pronto) return apresentarPlano(pronto);
        continue;
      }
      if (resultado === "abandonado") continue;
      throw new FalhaApi(resultado.falha.codigo, undefined, resultado.falha.motivo);
    }
    return criarPlanoAceito(usuarioId, id, plano, posicao.tentativa, posicao.origem);
  }
  throw new FalhaApi("ia_indisponivel", undefined, "tempo");
}

/**
 * O que houve com o aceite de uma proposta (GET /api/aprendizado/pedidos/{pedidoId}). Só lê: nunca chama a IA nem começa lote, e o id de outra conta responde "não recebido".
 * O plano salvo manda sobre o registro.
 */
export async function consultarCriacao(usuarioId: string, pedidoId: string): Promise<EstadoCriacao> {
  if (!pedidoIdValido(pedidoId)) throw new FalhaApi("invalido");
  return consultarPedido(usuarioId, pedidoId, async (conta, id) => {
    const plano = await lerPlano(conta, id);
    if (!plano) return null;
    const marcas = await marcasDasTrilhas(conta, [plano]);
    return { ...apresentarPlano(plano), ...marcas.get(plano.id) };
  });
}

/** O lote perdeu a vez de gravar: outro lote assumiu o pedido (ou ele acabou) enquanto este escrevia. */
class PerdeuAVez extends Error {}

async function descricaoDaFalha(usuarioId: string, erro: unknown): Promise<FalhaDescrita> {
  const descricao = descreverFalha(erro);
  if (descricao.causa === "limite" && descricao.esperaMs === undefined && descricao.codigo === "limite_geracoes") {
    // O limite do Studoo por conta: o prazo é conhecido (o fim da janela da conta). O do provedor só tem prazo se ele disse (Retry-After).
    const espera = await esperaDoLimiteDoStudoo(`ia:aceite:${usuarioId}`, 60 * 60_000).catch(() => null);
    if (espera) return { ...descricao, esperaMs: espera };
  }
  return descricao;
}

async function criarPlanoAceito(usuarioId: string, id: string, plano: EsqueletoPlano, tentativa: number, origemDoLote: "novo" | "reenvio" | "assumido"): Promise<PlanoDetalhe> {
  const inicio = Date.now();
  const decorrido = () => Date.now() - inicio;
  let etapaAtual: EtapaDaCriacao = "triagem";
  const etapa = (nova: EtapaDaCriacao) => {
    etapaAtual = nova;
    registrarCriacao(id, { evento: "etapa", etapa: nova, tentativa, decorridoMs: decorrido() });
    void avancarEtapa(usuarioId, id, tentativa, nova).catch(() => undefined);
  };
  registrarCriacao(id, { evento: "lote", origem: origemDoLote, tentativa, material: plano.gerador === "material-v1" });
  const pararRenovacao = manterDono(usuarioId, id, tentativa);
  try {
    etapa("triagem");
    if (provedorIaAtivo() === "openai") {
      const permitido = await banco.$transaction(tx => consumirLimite(tx, `ia:aceite:${usuarioId}`, 20, 60 * 60_000));
      if (!permitido) throw new FalhaApi("limite_geracoes");
      // O token preserva a proposta; a origem e o adaptador refletem quem realmente escreve as lições no aceite.
      if (plano.gerador !== "material-v1") plano = { ...plano, gerador: GERADOR_OPENAI, origem: ORIGEM_GERADA };
    }
    const conteudos = await gerarConteudos(usuarioId, plano, etapa);
    etapa("gravacao");
    const fluxos = plano.fluxos.map(({ titulo }, indice) => ({
      usuarioId,
      id: `${id}-${indice + 1}`,
      planoId: id,
      titulo,
      ordem: indice + 1,
    }));
    const licoes = plano.fluxos.flatMap((fluxo, indiceFluxo) => {
      const fluxoId = fluxos[indiceFluxo].id;
      return fluxo.licoes.map(({ titulo }, indiceLicao) => ({
        usuarioId,
        id: `${fluxoId}-${indiceLicao + 1}`,
        fluxoId,
        titulo,
        ordem: indiceLicao + 1,
        // Cópia JSON pura: campos opcionais ausentes não viram `undefined` no banco.
        conteudo: JSON.parse(JSON.stringify(conteudos[indiceFluxo][indiceLicao])) as Prisma.InputJsonValue,
      }));
    });

    try {
      // O plano e o pedido pronto andam juntos, e só quem ainda é o dono do lote grava: se outro lote assumiu (ou o pedido acabou), esta transação não publica nada.
      await banco.$transaction(async (tx) => {
        if (!await tomarAVezDeGravar(tx, usuarioId, id, tentativa, decorrido())) throw new PerdeuAVez();
        await tx.planoAprendizado.create({
          data: { usuarioId, id, titulo: plano.titulo, objetivo: plano.objetivo, origem: origemDoConteudo(plano.origem),
            ...(plano.diagnostico && { diagnostico: plano.diagnostico as unknown as Prisma.InputJsonValue }) },
        });
        await tx.fluxo.createMany({ data: fluxos });
        await tx.licao.createMany({ data: licoes });
      }, { maxWait: 10_000, timeout: 30_000 });
    } catch (erro) {
      if (erro instanceof PerdeuAVez) {
        // Outro lote assumiu o pedido enquanto este escrevia: a trilha é a dele (se já saiu); este lote não grava nada.
        registrarCriacao(id, { evento: "resultado", resultado: "perdeu_a_vez", tentativa, duracaoMs: decorrido() }, true);
        const dele = await lerPlano(usuarioId, id);
        if (dele) return apresentarPlano(dele);
        throw new FalhaApi("ia_indisponivel", undefined, "interrompida");
      }
      if (typeof erro !== "object" || erro === null || !("code" in erro) || erro.code !== "P2002") {
        throw erro;
      }
      const simultaneo = await lerPlano(usuarioId, id);
      if (!simultaneo) {
        throw erro;
      }
      await concluirPedido(usuarioId, id, decorrido()).catch(() => undefined);
      registrarCriacao(id, { evento: "resultado", resultado: "pronto", origem: "plano_ja_existia", tentativa, duracaoMs: decorrido() });
      return apresentarPlano(simultaneo);
    }

    // Se a consulta já tinha dado o lote por falho (passou do teto) mas o plano foi salvo, o pedido fecha como pronto.
    void concluirPedido(usuarioId, id, decorrido()).catch(() => undefined);
    registrarCriacao(id, { evento: "resultado", resultado: "pronto", tentativa, duracaoMs: decorrido(), licoes: licoes.length, fluxos: fluxos.length });
    return await buscarPlano(usuarioId, id);
  } catch (erro) {
    const descricao = await descricaoDaFalha(usuarioId, erro);
    registrarCriacao(id, {
      evento: "resultado", resultado: "falha", causa: descricao.causa, codigo: descricao.codigo, etapa: etapaAtual, tentativa, duracaoMs: decorrido(),
      ...(descricao.motivo ? { motivo: descricao.motivo } : {}), ...(descricao.esperaMs ? { espera_ms: descricao.esperaMs } : {}),
    }, true);
    await falharPedido(usuarioId, id, tentativa, descricao, decorrido()).catch(() => undefined);
    throw erro;
  } finally {
    pararRenovacao();
  }
}

async function lerLicao(usuarioId: string, id: string) {
  const licao = await banco.licao.findUnique({
    where: { usuarioId_id: { usuarioId, id } },
    select: {
      id: true,
      titulo: true,
      fluxoId: true,
      conteudo: true,
      fluxo: { select: { planoId: true, plano: { select: { origemNome: true } } } },
      conclusao: { select: { concluidoEm: true } },
    },
  });

  if (!licao) {
    throw new FalhaApi("nao_encontrado");
  }
  if (!conteudoValido(licao.conteudo)) {
    throw new FalhaApi("falha");
  }

  return { ...licao, conteudo: licao.conteudo };
}

/** Conteúdo interno da lição (com gabarito), para o reforço sem IA montar uma pergunta sobre o exercício errado. */
export async function conteudoDaLicao(usuarioId: string, id: string): Promise<ConteudoLicao> {
  const { conteudo } = await lerLicao(usuarioId, id);
  // Quem lê o conteúdo por aqui (reforço, ponte, voz) escreve para qualquer cliente: as fórmulas em linha vão em texto linear.
  return conteudoEhDeMatematica(conteudo) ? comTextoLinear(semCifraoSolto(conteudo)) : conteudo;
}

/** A lição é de matemática? Para o texto de IA que volta sem passar pela lição (a ponte do reforço e o "Ensine o Stu"), que chega em texto linear a todos os clientes. */
export async function licaoEhDeMatematica(usuarioId: string, id: string): Promise<boolean> {
  const { conteudo } = await lerLicao(usuarioId, id);
  return conteudoEhDeMatematica(conteudo);
}

/**
 * A lição como a pessoa a vê. `capacidades` vem do cabeçalho `X-Studoo-Capacidades`: sem `visuais@1` (build 3, site antigo) a
 * lição não leva campo novo e o desenho de matemática vai como PNG em `recurso` (se `desenharPng`); com ele, vão `visuais`, o
 * `visual` dos exercícios e, com `resolucao@1`, a resolução até o "Sua vez". Lição sem visual sai como sempre.
 */
export async function buscarLicao(
  usuarioId: string, id: string, opcoes: { capacidades?: Capacidades; desenharPng?: boolean } = {},
): Promise<LicaoDetalhe> {
  const licao = await lerLicao(usuarioId, id);
  const { objetivo, conceito, exemplo, origem, exercicio, extras, exemploTipo, passos, recurso: recursoSalvo, falas, pratica, referencias } = licao.conteudo;
  // Cópias antigas da trilha exemplo de Violão tiveram a ilustração numerada removida por `conteudoParaCopia`:
  // restaura a figura pública do catálogo de forma confiável (nunca em lições de material privado).
  const licaoViolaoCatalogo = demoPelaChave("violao")?.plano.fluxos[0]?.licoes[0];
  const recurso = recursoSalvo ?? (
    !referencias?.length &&
    licaoViolaoCatalogo?.recurso &&
    licao.titulo === licaoViolaoCatalogo.titulo &&
    exemplo === licaoViolaoCatalogo.exemplo
      ? licaoViolaoCatalogo.recurso
      : undefined
  );
  const exercicios = [exercicio, ...(extras ?? [])].map(apresentarExercicio);
  const detalhe: LicaoDetalhe = {
    id: licao.id,
    planoId: licao.fluxo.planoId,
    fluxoId: licao.fluxoId,
    titulo: licao.titulo,
    objetivo,
    conceito,
    exemplo,
    ...(exemploTipo ? { exemploTipo } : {}),
    ...(passos ? { passos } : {}),
    ...(recurso ? { recurso } : {}),
    ...(falas ? { falas } : {}),
    origem: origemDoConteudo(origem),
    exercicio: exercicios[0],
    exercicios,
    ...(pratica ? { pratica } : {}),
    ...(referencias ? { referencias } : {}),
    concluida: licao.conclusao !== null,
    // Lição de material numa trilha recebida: a aula diz "material de Ana" e não oferece nada que busque o material.
    // Vale mesmo com a flag desligada depois: a cópia nunca pode dizer "seu material".
    ...(licao.fluxo.plano.origemNome && referencias?.some((ref) => ref.materialId === MATERIAL_COMPARTILHADO)
      ? { materialDe: licao.fluxo.plano.origemNome }
      : {}),
  };
  const capacidades = opcoes.capacidades ?? SEM_CAPACIDADES;
  const completa = await comVisuais(detalhe, licao.conteudo, { capacidades, desenharPng: opcoes.desenharPng ?? false, usuarioId });
  // Sem `visuais@1` o cliente não desenha a fórmula em linha: `$x_A$` chega como texto linear, sem cifrão. Com ele, as marcas
  // chegam completas (os tokens soltos, `x_A`, também) e só em lição de matemática.
  return comFormulasParaOCliente(completa, licao.conteudo, capacidades);
}

/**
 * O "Sua vez" do "Resolva comigo": corrige a escolha e, no acerto ou na segunda errada, devolve a revelação do passo e os
 * passos que faltam (antes disso nada disso vai ao cliente). Lição sem resolução: `nao_encontrado`.
 */
export async function responderSuaVezDaLicao(usuarioId: string, id: string, escolha: EscolhaNoSuaVez): Promise<RespostaDoSuaVez> {
  const licao = await lerLicao(usuarioId, id);
  const resolucao = licao.conteudo.resolucao ? normalizarResolucao(licao.conteudo.resolucao) : null;
  if (!resolucao) throw new FalhaApi("nao_encontrado");
  // O índice que chega é o que a lição mostrou: a mesma ordem por (conta, lição) que ela usou, desfeita aqui.
  const resposta = responderSuaVez(resolucao, escolha, ordemDoSuaVez(usuarioId, licao.id));
  if (!resposta) throw new FalhaApi("invalido");
  return resposta;
}

/** Avalia a resposta do exercício `indice` da lição (0 é o principal). */
export async function avaliarLicao(
  usuarioId: string, id: string, resposta: string, indice = 0, capacidades: Capacidades = SEM_CAPACIDADES,
): Promise<Avaliacao> {
  const licao = await lerLicao(usuarioId, id);
  const exercicio = [licao.conteudo.exercicio, ...(licao.conteudo.extras ?? [])][indice];
  const local = exercicio ? avaliarResposta(exercicio, resposta) : null;
  if (!exercicio || !local) {
    throw new FalhaApi("invalido");
  }
  // Sem o aceite do envio a IA de terceiros, vale só a correção local (nada da resposta sai do servidor).
  const avaliacao = await podeUsarIa(usuarioId)
    ? await refinarAvaliacao({ titulo: licao.titulo, conceito: licao.conteudo.conceito }, exercicio, resposta, local)
    : local;

  if (!avaliacao.correta) await banco.apoioLicao.upsert({
    where: { usuarioId_licaoId: { usuarioId, licaoId: id } },
    create: { usuarioId, licaoId: id, erros: 1, ultimaResposta: resposta, ultimoIndice: indice },
    update: { erros: { increment: 1 }, ultimaResposta: resposta, ultimoIndice: indice },
  });
  const comprovante = emitirComprovante("avaliacao", usuarioId, {
    id,
    expiraEm: Date.now() + DURACAO_AVALIACAO,
  });
  // Exercício com figura, para quem desenha (`visuais@1`): quem acertou vê o procurado virar resposta.
  const visual = avaliacao.correta ? visualDoRetorno(licao.conteudo, indice, capacidades) : undefined;
  const resultado = { ...avaliacao, ...(visual ? { visual } : {}), comprovante };
  return comFormulasParaOCliente(resultado, licao.conteudo, capacidades);
}

/** Registra a conclusão (uma vez) e, quando a lição tem prática, como ela foi (a mais recente fica). */
export async function concluirLicao(
  usuarioId: string, id: string, token: string, pratica?: AutoAvaliacao, resumo?: ResumoConclusao,
): Promise<Conclusao> {
  const licao = await lerLicao(usuarioId, id);
  const comprovante = lerComprovante("avaliacao", usuarioId, token);
  if (comprovante?.id !== id) {
    throw new FalhaApi("avaliacao_invalida");
  }

  let conclusao = licao.conclusao;
  if (!conclusao) {
    if (comprovante.expiraEm <= Date.now()) {
      throw new FalhaApi("avaliacao_invalida");
    }

    await banco.$transaction(async tx => {
      const concluidoEm = new Date();
      const criada = await tx.registroEstudo.createMany({
        data: [{ usuarioId, licaoId: id, concluidoEm, pratica: pratica ?? null, ...(resumo ?? {}) }],
        skipDuplicates: true,
      });
      if (criada.count) {
        const { fuso } = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { fuso: true } });
        await tx.diaDeEstudo.createMany({
          data: [{ usuarioId, dia: dataLocalDoEstudo(concluidoEm, fuso) }],
          skipDuplicates: true,
        });
      }
    });
    conclusao = await banco.registroEstudo.findUniqueOrThrow({
      where: { usuarioId_licaoId: { usuarioId, licaoId: id } },
      select: { concluidoEm: true },
    });
  } else if (pratica || resumo) {
    // Refazer a lição vale: fica o resultado da vez mais recente (o "Vale rever" some quando a pessoa refaz sem erro).
    await banco.registroEstudo.update({
      where: { usuarioId_licaoId: { usuarioId, licaoId: id } },
      data: { ...(pratica ? { pratica } : {}), ...(resumo ?? {}) },
    });
  }

  return {
    concluidaEm: conclusao.concluidoEm.toISOString(),
    plano: await buscarPlano(usuarioId, licao.fluxo.planoId),
  };
}
