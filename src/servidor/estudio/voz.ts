import { FalhaApi } from '../acesso/http';
import { configuracaoOpenAi } from '../ia/openai';
import { validarArquivo } from './arquivos';
import { quota } from './materiais';

export async function transcrever(usuarioId: string, entrada: unknown) {
  await quota(usuarioId, 'voz', 10);
  const { arquivo, bytes } = validarArquivo(entrada);
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
  if (process.env.IA !== 'openai' || !config)
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
  try {
    const response = await fetch(`${config.base}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.chave}` },
      redirect: 'error',
      body: corpo,
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error();
    const dado = await response.json();
    if (
      typeof dado.text !== 'string' ||
      !dado.text.trim() ||
      dado.text.length > 3000
    )
      throw new Error();
    return { texto: dado.text.trim() };
  } catch {
    throw new FalhaApi('voz_indisponivel');
  }
}
