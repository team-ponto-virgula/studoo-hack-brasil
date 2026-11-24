import { ORIGEM_APP_STUDOO } from '@/enderecos-publicos';
import { LIMITES_GERACAO } from '@studoo/contratos';

/** O navegador não envia o fragmento ao servidor nem no endereço de referência. */
export function enderecoParaExperimentar(ideia?: string): string {
  const destino = new URL('/conheca/continuar', ORIGEM_APP_STUDOO);
  const dados = new URLSearchParams({ iniciar: '1' });
  if (ideia) dados.set('assunto', ideia.slice(0, LIMITES_GERACAO.objetivoMax));
  destino.hash = dados.toString();
  return destino.href;
}

export function lerContinuacao(fragmento: string) {
  const dados = new URLSearchParams(fragmento.replace(/^#/, ''));
  if (dados.get('iniciar') !== '1') return null;
  return { ideia: dados.get('assunto')?.trim().slice(0, LIMITES_GERACAO.objetivoMax) };
}
