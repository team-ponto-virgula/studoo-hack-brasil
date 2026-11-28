import type { PerfilDiagnostico, PropostaPlano } from '@studoo/contratos';
import { randomUUID } from 'node:crypto';

const bancoLocal = URL.parse(process.env.DATABASE_URL ?? '');
const ia = process.env.IA;
if (!bancoLocal || !['localhost', '127.0.0.1', '[::1]'].includes(bancoLocal.hostname)
  || ia !== 'openai') {
  throw new Error('Use banco local migrado e selecione IA=openai para a conferência.');
}

const { iniciarGeracao } = await import('@/servidor/aprendizado/geracao');
const { aceitarProposta, buscarPlano, buscarLicao } = await import('@/servidor/aprendizado/servico');
const { lerComprovante } = await import('@/servidor/aprendizado/comprovantes');
const { excluirConta } = await import('@/servidor/privacidade/conta');
const { banco } = await import('@/servidor/banco/cliente');
const objetivo = 'Equação do primeiro grau';
const perfis: PerfilDiagnostico[] = [
  { nivel: 'basico', escopo: objetivo, demonstrados: [], lacunas: ['Preservar a igualdade'] },
  { nivel: 'basico', escopo: objetivo, demonstrados: ['Isolar a incógnita', 'Resolver equações com x dos dois lados'], lacunas: [] },
];

const usuario = await banco.usuario.create({
  data: { email: `qa-feedback-${randomUUID()}@example.test`, fuso: 'America/Sao_Paulo' }, select: { id: true },
});
try {
  const provas: { titulo: string; exercicio: string }[] = [];
  for (const diagnostico of perfis) {
    let proposta: PropostaPlano | undefined;
    for await (const ev of iniciarGeracao(usuario.id, objetivo, { diagnostico, verificarLimite: false }).eventos(AbortSignal.timeout(90_000))) {
      if (ev.tipo === 'erro') throw new Error('Falha na proposta: ' + ev.codigo);
      if (ev.tipo === 'pronto') proposta = ev.proposta;
    }
    if (!proposta) throw new Error('O provedor não devolveu uma proposta.');
    const gerador = lerComprovante('proposta', usuario.id, proposta.token)?.plano?.gerador;
    if (!gerador?.startsWith(ia + '-')) throw new Error('A geração caiu na reserva; esta execução não valida o provedor selecionado.');
    const salvo = await aceitarProposta(usuario.id, proposta.token);
    const reaberto = await buscarPlano(usuario.id, salvo.id);
    const primeira = reaberto.fluxos.find(f => f.proximaLicaoId)?.proximaLicaoId;
    if (!primeira || reaberto.progresso.concluidas !== 0) throw new Error('A trilha reaberta não está no início.');
    const licao = await buscarLicao(usuario.id, primeira);
    const prova = { titulo: licao.titulo, exercicio: licao.exercicio.enunciado };
    provas.push(prova);
    console.log(JSON.stringify({ ia, diagnostico, titulos: proposta.fluxos.flatMap(f => f.licoes.map(l => l.titulo)), primeiraLicao: prova }));
  }
  if (provas[0].titulo === provas[1].titulo || provas[0].exercicio === provas[1].exercicio) {
    throw new Error('Os dois diagnósticos produziram o mesmo começo. Confira o resultado do provedor.');
  }
} finally {
  try {
    await excluirConta(usuario.id, 'EXCLUIR');
  } finally {
    await banco.$disconnect();
  }
}
