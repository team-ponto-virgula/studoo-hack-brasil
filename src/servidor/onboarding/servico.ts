import {
  VERSAO_ONBOARDING, metaLicoesDiaValida, objetivoOnboardingValido,
  type EstadoOnboarding, type MetaLicoesDia, type RespostaOnboarding, type ResumoRetencao,
} from '@studoo/contratos/onboarding';
import { FalhaApi } from '@/servidor/acesso/http';
import { hashToken } from '@/servidor/acesso/sessao';
import { ehEmailVisitante } from '@/servidor/acesso/visitante';
import { dataLocalDoEstudo, indicadoresDosDias } from '@/servidor/aprendizado/progresso-perfil';
import { banco } from '@/servidor/banco/cliente';
import type { CanalSessao, OnboardingConta, Prisma } from '@/servidor/banco/gerado/client';

type Credencial = { canal: CanalSessao; token: string };
type Transacao = Prisma.TransactionClient;
const metaValidaOuPadrao = (meta: number): MetaLicoesDia => metaLicoesDiaValida(meta) ? meta : 1;

function apresentar(onboarding: OnboardingConta | null, meta: MetaLicoesDia): EstadoOnboarding | null {
  if (!onboarding) return null;
  return {
    versao: VERSAO_ONBOARDING,
    etapa: onboarding.etapa as EstadoOnboarding['etapa'],
    objetivo: onboarding.objetivo,
    modo: onboarding.modo as EstadoOnboarding['modo'],
    metaLicoesDia: meta,
    planoId: onboarding.planoId,
    iniciadoEm: onboarding.iniciadoEm.toISOString(),
    atualizadoEm: onboarding.atualizadoEm.toISOString(),
    adiadoEm: onboarding.adiadoEm?.toISOString() ?? null,
    concluidoEm: onboarding.concluidoEm?.toISOString() ?? null,
  };
}

async function bloquear(tx: Transacao, usuarioId: string) {
  await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtextextended(${'onboarding:' + usuarioId}, 0::bigint))`;
}

/** A conclusão é derivada somente de RegistroEstudo emitido pelo percurso real da própria conta. */
async function reconciliar(tx: Transacao, usuarioId: string, registro: OnboardingConta | null, agora: Date) {
  if (!registro || registro.concluidoEm) return registro;
  let atual = registro;
  const inicioDoObjetivo = registro.preparadoEm ?? registro.iniciadoEm;
  if (atual.planoId && !await tx.planoAprendizado.findUnique({
    where: { usuarioId_id: { usuarioId, id: atual.planoId } }, select: { id: true },
  })) {
    atual = await tx.onboardingConta.update({ where: { usuarioId }, data: {
      planoId: null, etapa: atual.objetivo ? 'trilha' : 'preparacao',
    } });
  }

  // Se a resposta de vincular-plano se perdeu, recupera a conclusão da trilha criada durante a jornada.
  // Uma trilha antiga ou de outra conta não pode concluir este onboarding.
  const conclusao = await tx.registroEstudo.findFirst({
    where: {
      usuarioId, concluidoEm: { gte: atual.iniciadoEm, lte: agora },
      licao: { usuarioId, fluxo: {
        usuarioId, ...(atual.planoId ? { planoId: atual.planoId } : {}),
        plano: { usuarioId, criadoEm: { gte: inicioDoObjetivo } },
      } },
    },
    orderBy: [{ concluidoEm: 'asc' }, { licaoId: 'asc' }],
    select: { concluidoEm: true, licao: { select: { fluxo: { select: { planoId: true } } } } },
  });
  if (conclusao) return tx.onboardingConta.update({ where: { usuarioId }, data: {
    etapa: 'concluido', planoId: conclusao.licao.fluxo.planoId, concluidoEm: conclusao.concluidoEm, adiadoEm: null,
  } });

  if (!atual.planoId && atual.objetivo) {
    const plano = await tx.planoAprendizado.findFirst({
      where: { usuarioId, criadoEm: { gte: inicioDoObjetivo } },
      orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }], select: { id: true },
    });
    if (plano) atual = await tx.onboardingConta.update({ where: { usuarioId }, data: { planoId: plano.id, etapa: 'licao' } });
  }
  return atual;
}

/** Contagem de primeiras conclusões por dia local; refazer uma lição não cria um segundo registro. */
export async function resumoRetencao(usuarioId: string, fuso: string, metaLicoesDia: MetaLicoesDia, planoOnboarding: string | null, agora = new Date()): Promise<ResumoRetencao> {
  const [conclusoes, dias, ultima] = await Promise.all([
    banco.registroEstudo.findMany({ where: { usuarioId, concluidoEm: { lte: agora } }, select: { concluidoEm: true } }),
    banco.diaDeEstudo.findMany({ where: { usuarioId }, select: { dia: true } }),
    banco.registroEstudo.findFirst({
      where: { usuarioId, concluidoEm: { lte: agora } }, orderBy: [{ concluidoEm: 'desc' }, { licaoId: 'asc' }],
      select: { concluidoEm: true, licao: { select: { fluxo: { select: { planoId: true } } } } },
    }),
  ]);
  const hoje = dataLocalDoEstudo(agora, fuso);
  const licoesHoje = conclusoes.filter(item => dataLocalDoEstudo(item.concluidoEm, fuso) === hoje).length;
  const planoPreferido = planoOnboarding ?? ultima?.licao.fluxo.planoId ?? null;
  const selecao = {
    id: true, titulo: true, fluxoId: true,
    fluxo: { select: { planoId: true, plano: { select: { titulo: true } } } },
  } satisfies Prisma.LicaoSelect;
  let proxima = planoPreferido ? await banco.licao.findFirst({
    where: { usuarioId, conclusao: null, fluxo: { usuarioId, planoId: planoPreferido } },
    orderBy: [{ fluxo: { ordem: 'asc' } }, { ordem: 'asc' }], select: selecao,
  }) : null;
  proxima ??= await banco.licao.findFirst({
    where: { usuarioId, conclusao: null },
    orderBy: [{ fluxo: { plano: { criadoEm: 'desc' } } }, { fluxo: { ordem: 'asc' } }, { ordem: 'asc' }], select: selecao,
  });
  const indicadores = indicadoresDosDias(dias.map(item => item.dia), fuso, agora);
  return {
    metaLicoesDia, licoesHoje, metaAtingida: licoesHoje >= metaLicoesDia,
    totalLicoesConcluidas: conclusoes.length,
    diasSeguidos: indicadores.diasSeguidos, diasDeEstudo: indicadores.diasDeEstudo,
    ultimaAtividadeEm: ultima?.concluidoEm.toISOString() ?? null,
    proximoPasso: proxima ? {
      planoId: proxima.fluxo.planoId, planoTitulo: proxima.fluxo.plano.titulo,
      fluxoId: proxima.fluxoId, licaoId: proxima.id, licaoTitulo: proxima.titulo,
    } : null,
  };
}

export async function obterOnboarding(usuarioId: string, credencial?: Credencial, agora = new Date()): Promise<RespostaOnboarding> {
  const resultado = await banco.$transaction(async tx => {
    await bloquear(tx, usuarioId);
    const usuario = await tx.usuario.findUnique({
      where: { id: usuarioId }, select: { email: true, fuso: true, metaLicoesDia: true, onboarding: true },
    });
    if (!usuario) throw new FalhaApi('nao_autenticado');
    const onboarding = ehEmailVisitante(usuario.email) ? null : await reconciliar(tx, usuarioId, usuario.onboarding, agora);
    const sessao = credencial ? await tx.sessao.findFirst({
      where: { usuarioId, tokenHash: hashToken(credencial.token), canal: credencial.canal, expiraEm: { gt: agora } },
      select: { onboardingInicial: true },
    }) : null;
    const meta = metaValidaOuPadrao(usuario.metaLicoesDia);
    return {
      onboarding: apresentar(onboarding, meta), fuso: usuario.fuso, meta,
      iniciarAutomaticamente: Boolean(sessao?.onboardingInicial && onboarding && !onboarding.concluidoEm && !onboarding.adiadoEm),
    };
  });
  return {
    onboarding: resultado.onboarding, iniciarAutomaticamente: resultado.iniciarAutomaticamente,
    retencao: await resumoRetencao(usuarioId, resultado.fuso, resultado.meta,
      resultado.onboarding?.concluidoEm ? null : resultado.onboarding?.planoId ?? null, agora),
  };
}

function validarFuso(fuso: unknown): string | undefined {
  if (fuso === undefined) return undefined;
  if (typeof fuso !== 'string' || fuso.length > 100) throw new FalhaApi('invalido');
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: fuso }).format(); } catch { throw new FalhaApi('invalido'); }
  return fuso;
}

export async function atualizarOnboarding(usuarioId: string, entrada: unknown, credencial?: Credencial): Promise<RespostaOnboarding> {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new FalhaApi('invalido');
  const dados = entrada as Record<string, unknown>;
  const acao = dados.acao;
  if (typeof acao !== 'string' || !['iniciar', 'preparar', 'vincular-plano', 'adiar', 'retomar', 'definir-meta'].includes(acao)) throw new FalhaApi('invalido');
  const mudaMeta = acao === 'preparar' || acao === 'definir-meta';
  if (mudaMeta && !metaLicoesDiaValida(dados.metaLicoesDia)) throw new FalhaApi('invalido');
  if (acao === 'preparar' && !objetivoOnboardingValido(dados.objetivo)) throw new FalhaApi('invalido');
  if (acao === 'preparar' && dados.modo !== undefined && dados.modo !== 'assunto' && dados.modo !== 'material') throw new FalhaApi('invalido');
  if (acao === 'vincular-plano' && (typeof dados.planoId !== 'string' || !dados.planoId || dados.planoId.length > 200)) throw new FalhaApi('invalido');
  const fuso = mudaMeta ? validarFuso(dados.fuso) : undefined;

  await banco.$transaction(async tx => {
    await bloquear(tx, usuarioId);
    const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { email: true, onboarding: true } });
    if (!usuario) throw new FalhaApi('nao_autenticado');
    if (ehEmailVisitante(usuario.email)) throw new FalhaApi('invalido');
    const onboarding = await reconciliar(tx, usuarioId, usuario.onboarding, new Date());
    if (acao !== 'definir-meta' && !onboarding) throw new FalhaApi('nao_encontrado');

    if (mudaMeta) await tx.usuario.update({ where: { id: usuarioId }, data: {
      metaLicoesDia: dados.metaLicoesDia as MetaLicoesDia, ...(fuso ? { fuso } : {}),
    } });
    if (acao === 'preparar') {
      if (onboarding!.concluidoEm) throw new FalhaApi('invalido');
      const objetivo = (dados.objetivo as string).trim();
      const modo = (dados.modo as EstadoOnboarding['modo'] | undefined) ?? onboarding!.modo;
      const mesmaPreparacao = objetivo === onboarding!.objetivo && modo === onboarding!.modo;
      const preservaPlano = mesmaPreparacao && onboarding!.planoId;
      await tx.onboardingConta.update({ where: { usuarioId }, data: {
        objetivo, modo, etapa: preservaPlano ? 'licao' : 'trilha', planoId: preservaPlano || null, adiadoEm: null,
        preparadoEm: mesmaPreparacao && onboarding!.preparadoEm ? onboarding!.preparadoEm : new Date(),
      } });
    }
    if (acao === 'vincular-plano') {
      const plano = await tx.planoAprendizado.findUnique({
        where: { usuarioId_id: { usuarioId, id: dados.planoId as string } }, select: { id: true, criadoEm: true },
      });
      if (!plano || plano.criadoEm < (onboarding!.preparadoEm ?? onboarding!.iniciadoEm)) throw new FalhaApi('nao_encontrado');
      if (!onboarding!.concluidoEm) await tx.onboardingConta.update({ where: { usuarioId }, data: {
        planoId: plano.id, etapa: 'licao', adiadoEm: null,
      } });
    }
    if (acao === 'adiar' && !onboarding!.concluidoEm) {
      await tx.onboardingConta.update({ where: { usuarioId }, data: { adiadoEm: new Date() } });
    }
    if (acao === 'retomar' && !onboarding!.concluidoEm) {
      await tx.onboardingConta.update({ where: { usuarioId }, data: { adiadoEm: null } });
    }
    if (credencial && acao !== 'definir-meta') await tx.sessao.updateMany({
      where: { usuarioId, tokenHash: hashToken(credencial.token), canal: credencial.canal }, data: { onboardingInicial: false },
    });
  });
  return obterOnboarding(usuarioId, credencial);
}
