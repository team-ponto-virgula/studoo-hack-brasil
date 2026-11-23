import { origemDoConteudo } from "@/dominio/aprendizado/plano";
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
import { motivoParaRever, normalizarResolucao, responderSuaVez, type Capacidades, type EscolhaNoSuaVez, type RespostaDoSuaVez } from "@studoo/contratos";
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
import { podeUsarIa } from "@/servidor/privacidade/consentimento";
import { emitirComprovante, lerComprovante } from "./comprovantes";
import { refinarAvaliacao } from "./correcao";
import { consumirGeracaoPersistente } from "@/servidor/ia/limite";
import { iniciarGeracao } from "./geracao";
import { ordemDoSuaVez } from "./ordem-sua-vez";
import { SEM_CAPACIDADES, comFormulasParaOCliente, comTextoLinear, comVisuais, conteudoEhDeMatematica, semCifraoSolto, visualDoRetorno } from "./visuais";
import { marcasDasTrilhas } from "@/servidor/compartilhar/servico";
import { MATERIAL_COMPARTILHADO, TEMAS, type Tema } from "@studoo/contratos";

/** Lições escritas ao mesmo tempo no aceite (`STUDOO_GERACAO_PARALELA`, de 1 a 10; padrão 10, todas juntas). */
export function geracaoParalela(): number {
  const valor = Number(process.env.STUDOO_GERACAO_PARALELA?.trim());
  return Number.isInteger(valor) && valor >= 1 && valor <= 10 ? valor : 10;
}

/**
 * Tempo para criar o conteúdo de todas as lições no aceite. As lições (de 7 a 10) saem em ondas de até
 * `geracaoParalela()` chamadas; cada onda cabe nos 75 s de sempre (o que valia para todas em paralelo: uma chamada tem
 * prazo próprio de 40 s, a segunda tentativa de formato e as novas tentativas do 429, até 8 s, cabem quase sempre
 * aí). Teto = 75 s × ondas, limitado a 240 s: com o padrão (10) e até 10 lições, 1 onda = 75 s, como antes; com 3 e 8
 * lições, 3 ondas = 225 s; com 1 (em série), 240 s.
 */
export function tempoDoAceite(licoes: number, paralelas = geracaoParalela()): number {
  const ondas = Math.max(1, Math.ceil(licoes / paralelas));
  return Math.min(240_000, 75_000 * ondas);
}
const DURACAO_AVALIACAO = 15 * 60 * 1000;

const selecaoPlano = {
  id: true,
  titulo: true,
  capa: true,
  tema: true,
  objetivo: true,
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
export async function gerarProposta(usuarioId: string, objetivo: string): Promise<PropostaPlano> {
  const geracao = iniciarGeracao(usuarioId, objetivo, { verificarLimite: false });
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
    const { id, titulo, progresso, capa, tema } = apresentarPlano(plano);
    return { id, titulo, progresso, ...(capa ? { capa } : {}), ...(tema ? { tema } : {}), ...marcas.get(id) };
  });
}

/** Pede ao gerador o conteúdo de cada lição do esqueleto aceito e valida o que voltou. */
export async function gerarConteudos(usuarioId: string, plano: EsqueletoPlano): Promise<ConteudoLicao[][]> {
  if (plano.gerador === "material-v1" && plano.materialId) return conteudosDoMaterial(usuarioId, plano.materialId);
  const gerador = obterGerador();
  // Uma chamada por lição, no máximo `geracaoParalela()` em andamento. Contas com limite baixo por minuto (a OpenAI do
  // dono: 10 mil tokens/min) usam 1 ou 2; com todas juntas, as chamadas estouram o limite ao mesmo tempo (429 em todas).
  // Cada chamada mantém as novas tentativas do 429 (`comNovasTentativas`). Na primeira falha, nenhuma nova começa.
  const tarefas = plano.fluxos.flatMap((fluxo, indiceFluxo) => fluxo.licoes.map((_licao, indiceLicao) => ({ indiceFluxo, indiceLicao })));
  const paralelas = geracaoParalela();
  const sinal = AbortSignal.timeout(tempoDoAceite(tarefas.length, paralelas));
  const conteudos: ConteudoLicao[][] = plano.fluxos.map(() => []);
  let proxima = 0;
  let falhou = false;
  async function trabalhar() {
    while (!falhou && proxima < tarefas.length) {
      const { indiceFluxo, indiceLicao } = tarefas[proxima++];
      try {
        conteudos[indiceFluxo][indiceLicao] = await gerador.gerarConteudo(plano, indiceFluxo, indiceLicao, sinal);
      } catch (erro) {
        falhou = true;
        throw erro;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(paralelas, tarefas.length) }, trabalhar));
  if (!conteudos.every((licoes) => licoes.every(conteudoValido))) {
    throw new FalhaApi("ia_indisponivel", undefined, "conteudo_invalido");
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
    await banco.$transaction([
      banco.planoAprendizado.create({
        data: { usuarioId, id, titulo: plano.titulo, objetivo: plano.objetivo, origem: origemDoConteudo(plano.origem) },
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
  const { objetivo, conceito, exemplo, origem, exercicio, extras, exemploTipo, passos, recurso, falas, pratica, referencias } = licao.conteudo;
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

    await banco.registroEstudo.createMany({
      data: [{ usuarioId, licaoId: id, pratica: pratica ?? null, ...(resumo ?? {}) }],
      skipDuplicates: true,
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
