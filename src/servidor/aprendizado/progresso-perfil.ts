import type { EstudoNoPerfil } from '@studoo/contratos';
import { banco } from '@/servidor/banco/cliente';

function calendario(fuso: string) {
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
  }
}

const diaAnterior = (dia: string) => new Date(Date.parse(dia + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);

export const dataLocalDoEstudo = (data: Date, fuso: string) => calendario(fuso).format(data);

export function indicadoresDosDias(datas: string[], fuso: string, agora = new Date()): Omit<EstudoNoPerfil, 'trilhasConcluidas'> {
  const hoje = dataLocalDoEstudo(agora, fuso);
  const dias = new Set(datas.filter(data => data <= hoje));
  let proximo = dias.has(hoje) ? hoje : diaAnterior(hoje);
  let diasSeguidos = 0;
  while (dias.has(proximo)) {
    diasSeguidos++;
    proximo = diaAnterior(proximo);
  }
  return {
    diasSeguidos,
    diasDeEstudo: dias.size,
    diasRecentes: [...dias].sort().reverse().slice(0, 7),
  };
}

export async function progressoNoPerfil(usuarioId: string, fuso: string): Promise<EstudoNoPerfil> {
  const [conclusoes, trilhasConcluidas] = await Promise.all([
    banco.diaDeEstudo.findMany({ where: { usuarioId }, select: { dia: true } }),
    banco.planoAprendizado.count({ where: {
      usuarioId,
      fluxos: {
        some: { licoes: { some: {} } },
        none: { licoes: { some: { conclusao: null } } },
      },
    } }),
  ]);
  return { trilhasConcluidas, ...indicadoresDosDias(conclusoes.map(r => r.dia), fuso) };
}
