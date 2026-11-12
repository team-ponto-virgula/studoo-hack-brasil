import { criarClienteStudoo, ErroStudoo } from '@studoo/contratos';
import { fetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';

const tempoLimiteMs = 15_000;

export class FalhaMobile extends Error {
  constructor(public readonly codigo: 'conexao' | 'configuracao' | 'armazenamento') {
    super(codigo);
  }
}

function origemConfigurada() {
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
  return criarClienteStudoo(async (caminho, opcoes) => {
    const origem = origemConfigurada().origin;
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), tempoLimiteMs);

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
}

export type ClienteNativo = ReturnType<typeof criarClienteNativo>;

export function sessaoInvalida(erro: unknown) {
  return erro instanceof ErroStudoo && erro.codigo === 'nao_autenticado';
}
