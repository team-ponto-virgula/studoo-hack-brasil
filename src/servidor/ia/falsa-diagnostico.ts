import type { PerfilDiagnostico } from '@studoo/contratos';
import type { LicaoInterna, PlanoInterno } from '@/dominio/aprendizado/plano';
import { assuntoDoDiagnostico, EQUACAO, SOLAR, type QuestaoDeAplicacao } from '@/servidor/aprendizado/diagnostico-catalogo';

const origem = 'Conteúdo de demonstração do Studoo';
export const GERADOR_DIAGNOSTICO_FALSO = 'falsa-diagnostico-v1';

function licao(q: QuestaoDeAplicacao): LicaoInterna {
  return {
    titulo: q.habilidade, objetivo: q.habilidade, conceito: q.conceito, exemplo: q.exemplo, origem,
    exercicio: {
      tipo: 'multipla_escolha', enunciado: q.enunciado,
      opcoes: q.opcoes.map((texto, i) => ({ id: String(i), texto })),
      gabarito: [String(q.correta)],
      feedbackCorreto: 'Isso mesmo. ' + q.conceito,
      feedbackIncorreto: 'Veja o que muda ao aplicar a ideia. ' + q.conceito,
    },
  };
}

export function planoFalsoDiagnostico(objetivo: string, perfil: PerfilDiagnostico): PlanoInterno | null {
  const assunto = assuntoDoDiagnostico(objetivo);
  if (!assunto) return null;
  const ordem = assunto === 'equacao' ? (perfil.demonstrados.includes(EQUACAO[0].habilidade) ? [2, 3, 4, 1, 0] : [1, 0, 2, 3, 4])
    : perfil.escopo === 'Como os astros se movem' ? [2, 3, 1, 0]
      : perfil.escopo === 'Planetas e suas luas' ? [0, 1, 2, 3] : [0, 2, 1, 3];
  const banco = assunto === 'equacao' ? EQUACAO : SOLAR;
  const quantidade = assunto === 'equacao' ? (perfil.demonstrados.length >= 2 ? 2 : 3)
    : perfil.nivel === 'basico' ? 2 : perfil.nivel === 'intermediario' ? 3 : 4;
  const candidatas = ordem.map(i => banco[i]).filter(q => !perfil.demonstrados.includes(q.habilidade));
  return {
    titulo: assunto === 'equacao' ? 'Equação do primeiro grau' : 'Sistema solar: ' + perfil.escopo.toLowerCase(),
    objetivo, origem, fluxos: [{ titulo: 'Seu percurso', licoes: candidatas.slice(0, quantidade).map(licao) }],
  };
}
