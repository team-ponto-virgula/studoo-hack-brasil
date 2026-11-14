import { conteudosDoMaterial } from '../estudio/materiais';
import type {
  Avaliacao,
  Conclusao,
  LicaoDetalhe,
  PlanoDetalhe,
  PlanoResumo,
  PropostaPlano,
} from "@studoo/contratos";
import {
  apresentarExercicio,
  avaliarResposta,
  calcularProgresso,
  conteudoValido,
  type ConteudoLicao,
  type EsqueletoPlano,
} from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { banco } from "@/servidor/banco/cliente";
import type { Prisma } from "@/servidor/banco/gerado/client";
import { obterGerador } from "@/servidor/ia/gerador";
import { emitirComprovante, lerComprovante } from "./comprovantes";
import { iniciarGeracao } from "./geracao";

/** Tempo para criar o conteúdo de todas as lições no aceite (com a IA real, em paralelo e com uma segunda tentativa). */
const TEMPO_CONTEUDO = 75_000;
const DURACAO_AVALIACAO = 15 * 60 * 1000;

const selecaoPlano = {
  id: true,
  titulo: true,
  objetivo: true,
  origem: true,
  fluxos: {
    orderBy: { ordem: "asc" },
    select: {
      id: true,
      titulo: true,
      licoes: {
        orderBy: { ordem: "asc" },
        select: { id: true, titulo: true, conclusao: { select: { licaoId: true } }, apoio: { select: { reforco: true, reforcoConcluido: true } } },
      },
    },
  },
} satisfies Prisma.PlanoAprendizadoSelect;

type PlanoPersistido = Prisma.PlanoAprendizadoGetPayload<{ select: typeof selecaoPlano }>;

/** Proposta de uma vez, para o cliente que não acompanha a geração (POST /propostas). */
export async function gerarProposta(usuarioId: string, objetivo: string): Promise<PropostaPlano> {
  const geracao = iniciarGeracao(usuarioId, objetivo);
  for await (const evento of geracao.eventos(new AbortController().signal, { aoVivo: false })) {
    if (evento.tipo === "pronto") return evento.proposta;
    if (evento.tipo === "erro") throw new FalhaApi(evento.codigo);
  }
  throw new FalhaApi("falha");
}

function apresentarPlano(plano: PlanoPersistido): PlanoDetalhe {
  const fluxos = plano.fluxos.map(({ id, titulo, licoes }) => {
    const licoesPublicas = licoes.map(({ id, titulo, conclusao, apoio }) => ({
      id,
      titulo,
      concluida: conclusao !== null,
      ...(apoio?.reforco ? { ponte: { concluida: apoio.reforcoConcluido } } : {}),
    }));
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
  return {
    id: plano.id,
    titulo: plano.titulo,
    objetivo: plano.objetivo,
    origem: plano.origem,
    progresso: calcularProgresso(concluidas, total),
    fluxos,
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
  return apresentarPlano(plano);
}

export async function listarPlanos(usuarioId: string): Promise<PlanoResumo[]> {
  const planos = await banco.planoAprendizado.findMany({
    where: { usuarioId },
    orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
    select: selecaoPlano,
  });

  return planos.map((plano) => {
    const { id, titulo, progresso } = apresentarPlano(plano);
    return { id, titulo, progresso };
  });
}

/** Pede ao gerador o conteúdo de cada lição do esqueleto aceito e valida o que voltou. */
async function gerarConteudos(usuarioId: string, plano: EsqueletoPlano): Promise<ConteudoLicao[][]> {
  if (plano.gerador === "material-v1" && plano.materialId) return conteudosDoMaterial(usuarioId, plano.materialId);
  const gerador = obterGerador();
  const sinal = AbortSignal.timeout(TEMPO_CONTEUDO);
  const conteudos = await Promise.all(plano.fluxos.map((fluxo, indiceFluxo) =>
    Promise.all(fluxo.licoes.map((_licao, indiceLicao) =>
      gerador.gerarConteudo(plano, indiceFluxo, indiceLicao, sinal)))));
  if (!conteudos.every((licoes) => licoes.every(conteudoValido))) {
    throw new FalhaApi("ia_indisponivel");
  }
  return conteudos;
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
    return apresentarPlano(existente);
  }
  if (proposta.expiraEm <= Date.now()) {
    throw new FalhaApi("proposta_invalida");
  }

  const chave = `${usuarioId}:${id}`;
  const emAndamento = aceitesEmAndamento.get(chave);
  if (emAndamento) return emAndamento;
  const aceite = criarPlanoAceito(usuarioId, id, proposta.plano).finally(() => aceitesEmAndamento.delete(chave));
  aceitesEmAndamento.set(chave, aceite);
  return aceite;
}

async function criarPlanoAceito(usuarioId: string, id: string, plano: EsqueletoPlano): Promise<PlanoDetalhe> {
  const conteudos = await gerarConteudos(usuarioId, plano);
  const fluxos = plano.fluxos.map(({ titulo }, indice) => ({
    usuarioId,
    id: `${id}-${indice + 1}`,
    planoId: id,
    titulo,
    ordem: indice + 1,
  }));
  const licoes = plano.fluxos.flatMap((fluxo, indiceFluxo) => {
    const fluxoId = fluxos[indiceFluxo].id;
    return fluxo.licoes.map(({ titulo }, indiceLicao) => {
      const { exercicio, ...conteudo } = conteudos[indiceFluxo][indiceLicao];
      return {
        usuarioId,
        id: `${fluxoId}-${indiceLicao + 1}`,
        fluxoId,
        titulo,
        ordem: indiceLicao + 1,
        conteudo: { ...conteudo, exercicio: { ...exercicio } },
      };
    });
  });

  try {
    await banco.$transaction([
      banco.planoAprendizado.create({
        data: { usuarioId, id, titulo: plano.titulo, objetivo: plano.objetivo, origem: plano.origem },
      }),
      banco.fluxo.createMany({ data: fluxos }),
      banco.licao.createMany({ data: licoes }),
    ]);
  } catch (erro) {
    if (typeof erro !== "object" || erro === null || !("code" in erro) || erro.code !== "P2002") {
      throw erro;
    }
    const simultaneo = await lerPlano(usuarioId, id);
    if (!simultaneo) {
      throw erro;
    }
    return apresentarPlano(simultaneo);
  }

  return buscarPlano(usuarioId, id);
}

async function lerLicao(usuarioId: string, id: string) {
  const licao = await banco.licao.findUnique({
    where: { usuarioId_id: { usuarioId, id } },
    select: {
      id: true,
      titulo: true,
      fluxoId: true,
      conteudo: true,
      fluxo: { select: { planoId: true } },
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

export async function buscarLicao(usuarioId: string, id: string): Promise<LicaoDetalhe> {
  const licao = await lerLicao(usuarioId, id);
  const { objetivo, conceito, exemplo, origem, exercicio } = licao.conteudo;
  return {
    id: licao.id,
    planoId: licao.fluxo.planoId,
    fluxoId: licao.fluxoId,
    titulo: licao.titulo,
    objetivo,
    conceito,
    exemplo,
    origem,
    exercicio: apresentarExercicio(exercicio),
    ...(licao.conteudo.referencias ? { referencias: licao.conteudo.referencias } : {}),
    concluida: licao.conclusao !== null,
  };
}

export async function avaliarLicao(usuarioId: string, id: string, resposta: string): Promise<Avaliacao> {
  const licao = await lerLicao(usuarioId, id);
  const avaliacao = avaliarResposta(licao.conteudo.exercicio, resposta);
  if (!avaliacao) {
    throw new FalhaApi("invalido");
  }

  if (!avaliacao.correta) await banco.apoioLicao.upsert({
    where: { usuarioId_licaoId: { usuarioId, licaoId: id } },
    create: { usuarioId, licaoId: id, erros: 1, ultimaResposta: resposta },
    update: { erros: { increment: 1 }, ultimaResposta: resposta },
  });
  const comprovante = emitirComprovante("avaliacao", usuarioId, {
    id,
    expiraEm: Date.now() + DURACAO_AVALIACAO,
  });
  return { ...avaliacao, comprovante };
}

export async function concluirLicao(usuarioId: string, id: string, token: string): Promise<Conclusao> {
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

    await banco.registroEstudo.createMany({ data: [{ usuarioId, licaoId: id }], skipDuplicates: true });
    conclusao = await banco.registroEstudo.findUniqueOrThrow({
      where: { usuarioId_licaoId: { usuarioId, licaoId: id } },
      select: { concluidoEm: true },
    });
  }

  return {
    concluidaEm: conclusao.concluidoEm.toISOString(),
    plano: await buscarPlano(usuarioId, licao.fluxo.planoId),
  };
}
