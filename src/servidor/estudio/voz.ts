import { FalhaApi } from '../acesso/http';
import { configuracaoOpenAi } from '../ia/openai';
import { provedorIaAtivo } from '../ia/provedor';
import { comNovasTentativas } from '../ia/novas-tentativas';
import { validarArquivo } from './arquivos';
import { quota } from './materiais';

/** A transcrição usa um modelo especializado da OpenAI. */
export function transcricaoDisponivel(): boolean {
  return provedorIaAtivo() !== 'falsa' && configuracaoOpenAi() !== null;
}

export async function transcrever(usuarioId: string, entrada: unknown, idioma?: unknown) {
  await quota(usuarioId, 'voz', 10);
  const { arquivo, bytes } = validarArquivo(entrada);
  const idiomaBruto = typeof idioma === 'string'
    ? idioma.trim()
    : typeof (entrada as { idioma?: unknown })?.idioma === 'string'
      ? String((entrada as { idioma?: unknown }).idioma).trim()
      : '';
  const lingua = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/i.test(idiomaBruto)
    ? idiomaBruto.split('-')[0].toLowerCase()
    : undefined;
  const tipo = arquivo.tipo.split(';')[0];
  const webm =
    ['audio/webm', 'video/webm'].includes(tipo) &&
    bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const mp4 =
    ['audio/mp4', 'audio/m4a', 'audio/x-m4a'].includes(tipo) &&
    bytes.subarray(4, 8).toString() === 'ftyp';
  const wav =
    ['audio/wav', 'audio/x-wav'].includes(tipo) &&
    bytes.subarray(0, 4).toString() === 'RIFF' &&
    bytes.subarray(8, 12).toString() === 'WAVE';
  const ogg =
    tipo === 'audio/ogg' && bytes.subarray(0, 4).toString() === 'OggS';
  if (!webm && !mp4 && !wav && !ogg) throw new FalhaApi('invalido');
  const config = configuracaoOpenAi();
  if (!transcricaoDisponivel() || !config)
    throw new FalhaApi('voz_indisponivel');
  const corpo = new FormData();
  corpo.append(
    'model',
    process.env.OPENAI_MODELO_TRANSCRICAO?.trim() || 'gpt-transcribe',
  );
  corpo.append(
    'file',
    new Blob([new Uint8Array(bytes)], { type: tipo }),
    `explicacao.${webm ? 'webm' : mp4 ? 'm4a' : wav ? 'wav' : 'ogg'}`,
  );
  corpo.append('response_format', 'json');
  if (lingua) corpo.append('language', lingua);
  try {
    const sinal = AbortSignal.timeout(60_000);
    const response = await comNovasTentativas(() => fetch(`${config.base}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.chave}` },
      redirect: 'error',
      body: corpo,
      signal: sinal,
    }), { rota: 'voz-transcricao', sinal });
    if (!response.ok) throw new FalhaApi('voz_falha');
    const dado = await response.json();
    if (typeof dado?.text !== 'string' || dado.text.length > 3000) {
      throw new FalhaApi('voz_falha');
    }
    if (!dado.text.trim()) {
      throw new FalhaApi('voz_vazia');
    }
    return { texto: dado.text.trim() };
  } catch (erro) {
    if (erro instanceof FalhaApi) throw erro;
    if (erro instanceof Error && (erro.name === 'TimeoutError' || erro.name === 'AbortError')) {
      throw new FalhaApi('voz_tempo');
    }
    throw new FalhaApi('voz_falha');
  }
}
