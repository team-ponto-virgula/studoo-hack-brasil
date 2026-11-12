import { randomUUID } from "node:crypto";
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
  planoValido,
  type PlanoInterno,
} from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { banco } from "@/servidor/banco/cliente";
import type { Prisma } from "@/servidor/banco/gerado/client";
import { carregarPlanoFalso, reconhecerObjetivoSql, VERSAO_PLANO_SQL } from "@/servidor/ia/falsa";
import { emitirComprovante, lerComprovante } from "./comprovantes";

const DURACAO_PROPOSTA = 30 * 60 * 1000;
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
        select: { id: true, titulo: true, conclusao: { select: { licaoId: true } } },
      },
    },
  },
} satisfies Prisma.PlanoAprendizadoSelect;

type PlanoPersistido = Prisma.PlanoAprendizadoGetPayload<{ select: typeof selecaoPlano }>;

function planoDaVersao(versao: string): PlanoInterno {
  const plano = carregarPlanoFalso(versao);
  if (!planoValido(plano)) {
    throw new FalhaApi("ia_indisponivel");
  }
  return plano;
}

export function gerarProposta(usuarioId: string, objetivo: string): PropostaPlano {
  const texto = objetivo.trim();
  if (!texto || texto.length > 1000) {
    throw new FalhaApi("invalido");
  }
  if (process.env.IA !== "falsa") {
    throw new FalhaApi("ia_indisponivel");
  }
  if (!reconhecerObjetivoSql(texto)) {
    throw new FalhaApi("objetivo_fora_do_piloto");
  }

  const plano = planoDaVersao(VERSAO_PLANO_SQL);
  const token = emitirComprovante("proposta", usuarioId, {
    id: randomUUID(),
    expiraEm: Date.now() + DURACAO_PROPOSTA,
    versao: VERSAO_PLANO_SQL,
  });

  return {
    token,
    titulo: plano.titulo,
    objetivo: plano.objetivo,
    origem: plano.origem,
    fluxos: plano.fluxos.map(({ titulo, licoes }) => ({
      titulo,
      licoes: licoes.map((licao) => ({ titulo: licao.titulo })),
    })),
  };
}

function apresentarPlano(plano: PlanoPersistido): PlanoDetalhe {
  const fluxos = plano.fluxos.map(({ id, titulo, licoes }) => {
    const licoesPublicas = licoes.map(({ id, titulo, conclusao }) => ({
      id,
      titulo,
      concluida: conclusao !== null,
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

export async function aceitarProposta(usuarioId: string, token: string): Promise<PlanoDetalhe> {
  const proposta = lerComprovante("proposta", usuarioId, token);
  if (!proposta?.versao) {
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

  const plano = planoDaVersao(proposta.versao);
  const fluxos = plano.fluxos.map(({ titulo }, indice) => ({
    usuarioId,
    id: `${id}-${indice + 1}`,
    planoId: id,
    titulo,
    ordem: indice + 1,
  }));
  const licoes = plano.fluxos.flatMap((fluxo, indiceFluxo) => {
    const fluxoId = fluxos[indiceFluxo].id;
    return fluxo.licoes.map(({ titulo, exercicio, ...conteudo }, indiceLicao) => ({
      usuarioId,
      id: `${fluxoId}-${indiceLicao + 1}`,
      fluxoId,
      titulo,
      ordem: indiceLicao + 1,
      conteudo: { ...conteudo, exercicio: { ...exercicio } },
    }));
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
    concluida: licao.conclusao !== null,
  };
}

export async function avaliarLicao(usuarioId: string, id: string, resposta: string): Promise<Avaliacao> {
  const licao = await lerLicao(usuarioId, id);
  const avaliacao = avaliarResposta(licao.conteudo.exercicio, resposta);
  if (!avaliacao) {
    throw new FalhaApi("invalido");
  }

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
