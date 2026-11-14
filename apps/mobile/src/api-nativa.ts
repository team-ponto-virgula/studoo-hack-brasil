import { criarClienteStudoo, ErroStudoo, type EventoGeracao } from '@studoo/contratos';
import { fetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { codigoDaResposta, lerEventos } from './geracao-ao-vivo';

const tempoLimiteMs = 15_000;
/** O aceite cria o conteúdo de todas as lições; com a IA real, isso leva mais que um pedido comum. */
const tempoLimiteDoAceiteMs = 90_000;

export class FalhaMobile extends Error {
  constructor(public readonly codigo: 'conexao' | 'configuracao' | 'armazenamento') {
    super(codigo);
  }
}

export function origemConfigurada() {
  try {
    const url = new URL(process.env.EXPO_PUBLIC_STUDOO_API_URL ?? '');
    if (url.protocol === 'https:' && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash) {
      return url;
    }
  } catch {
    // A configuração inválida é tratada como estado de erro na entrada.
  }
  throw new FalhaMobile('configuracao');
}

function chaveDoToken() {
  const { host } = origemConfigurada();
  return `studoo.sessao.${host.replace(/[^a-z0-9._-]/gi, '_')}`;
}

export async function lerToken() {
  const chave = chaveDoToken();
  try {
    return await SecureStore.getItemAsync(chave);
  } catch {
    throw new FalhaMobile('armazenamento');
  }
}

export async function guardarToken(token: string) {
  const chave = chaveDoToken();
  try {
    await SecureStore.setItemAsync(chave, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } catch {
    throw new FalhaMobile('armazenamento');
  }
}

export async function apagarToken() {
  const chave = chaveDoToken();
  try {
    await SecureStore.deleteItemAsync(chave);
  } catch {
    throw new FalhaMobile('armazenamento');
  }
}

export function criarClienteNativo(token?: string) {
  const cliente = criarClienteStudoo(async (caminho, opcoes) => {
    const origem = origemConfigurada().origin;
    const controle = new AbortController();
    const aceite = opcoes.method === 'POST' && (caminho === '/api/aprendizado/planos' || caminho.startsWith('/api/estudio/'));
    const limite = setTimeout(() => controle.abort(), aceite ? tempoLimiteDoAceiteMs : tempoLimiteMs);

    try {
      const resposta = await fetch(`${origem}${caminho}`, {
        ...opcoes,
        credentials: 'omit',
        redirect: 'error',
        signal: controle.signal,
        headers: {
          'Cache-Control': 'no-store',
          ...opcoes.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (token && resposta.status === 401) throw new ErroStudoo('nao_autenticado');

      const corpo = resposta.status === 204 ? null : await resposta.json().catch(() => null);
      if (controle.signal.aborted) throw new FalhaMobile('conexao');
      return { status: resposta.status, ok: resposta.ok, json: async () => corpo };
    } catch (erro) {
      if (erro instanceof ErroStudoo || erro instanceof FalhaMobile) throw erro;
      throw new FalhaMobile('conexao');
    } finally {
      clearTimeout(limite);
    }
  });

  return {
    ...cliente,
    gerarTrilhaAoVivo: (objetivo: string, sinal: AbortSignal) => gerarTrilhaAoVivo(objetivo, sinal, token),
  };
}

/**
 * Geração ao vivo (spec 03), o mesmo pedido da web com o token no lugar do cookie: a resposta chega em NDJSON e cada linha
 * vira um evento validado pelo contrato. O tempo limite vale até a resposta começar; depois, a trilha segue chegando enquanto
 * a pessoa acompanha, e `sinal` (Cancelar, sair da tela) interrompe o pedido, como na web. O servidor não guarda nada até o aceite.
 */
async function* gerarTrilhaAoVivo(objetivo: string, sinal: AbortSignal, token?: string): AsyncGenerator<EventoGeracao> {
  const origem = origemConfigurada().origin;
  const controle = new AbortController();
  const interromper = () => controle.abort();
  sinal.addEventListener('abort', interromper);
  if (sinal.aborted) interromper();
  const limite = setTimeout(interromper, tempoLimiteMs);

  try {
    const resposta = await fetch(`${origem}/api/aprendizado/propostas/ao-vivo`, {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      signal: controle.signal,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ objetivo }),
    });
    if (token && resposta.status === 401) throw new ErroStudoo('nao_autenticado');
    // Erro antes do início (validação, limite, sessão): o servidor responde no JSON de erro de sempre.
    if (!resposta.ok || !resposta.body || !resposta.headers.get('content-type')?.includes('application/x-ndjson')) {
      const corpo: unknown = await resposta.json().catch(() => null);
      if (controle.signal.aborted) throw new FalhaMobile('conexao');
      throw new ErroStudoo(codigoDaResposta(corpo));
    }
    clearTimeout(limite);
    yield* lerEventos(resposta.body);
  } catch (erro) {
    if (erro instanceof ErroStudoo || erro instanceof FalhaMobile) throw erro;
    throw new FalhaMobile('conexao');
  } finally {
    clearTimeout(limite);
    sinal.removeEventListener('abort', interromper);
  }
}

export type ClienteNativo = ReturnType<typeof criarClienteNativo>;

export function sessaoInvalida(erro: unknown) {
  return erro instanceof ErroStudoo && erro.codigo === 'nao_autenticado';
}

/** Código de uma falha da API ou do app, para a tela escolher a mensagem e a ação; fora deles, `falha`. */
export function codigoDaFalha(erro: unknown): string {
  return erro instanceof ErroStudoo || erro instanceof FalhaMobile ? erro.codigo : 'falha';
}
