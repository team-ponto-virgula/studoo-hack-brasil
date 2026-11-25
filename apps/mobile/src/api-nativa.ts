import { CABECALHO_CAPACIDADES, criarClienteStudoo, ErroStudoo, type EscolhaNoSuaVez, type EventoGeracao, type TransporteStudoo } from '@studoo/contratos';
import { fetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { codigoDaResposta, lerEventos } from './geracao-ao-vivo';
import { tocaSons } from './sons';

/**
 * O que ESTE app sabe desenhar (spec 15): vai em toda chamada no cabeçalho `X-Studoo-Capacidades`. É uma constante do app, não a
 * do contrato (`CAPACIDADES_DESTE_CLIENTE`): o contrato pode subir antes de o app desenhar os tipos novos, e o app só pede o que
 * sabe mostrar. `visuais@2` desde o marco 12a: o app desenha o gráfico de função (`funcao`). Sem o cabeçalho (build 3), o servidor
 * manda o desenho como PNG no `recurso`.
 */
export const CAPACIDADES_DO_APP = 'visuais@2,resolucao@1';

const tempoLimiteMs = 15_000;
const tempoLimiteDoEstudioMs = 90_000;
// As etapas de geração e revisão da IA têm prazos próprios no servidor; aguardar também a resposta HTTP de erro.
const temposDaCriacaoMs: Readonly<Record<string, number>> = {
  '/api/aprendizado/diagnostico': 85_000,
  '/api/aprendizado/propostas': 120_000,
  '/api/aprendizado/planos': 300_000,
  '/api/estudio/materiais': 120_000,
};

function tempoDoPedido(caminho: string, metodo: string) {
  if (metodo === 'POST') {
    if (Object.hasOwn(temposDaCriacaoMs, caminho)) return temposDaCriacaoMs[caminho];
    if (/^\/api\/estudio\/materiais\/[^/]+\/proposta$/.test(caminho)) return 150_000;
    if (caminho.startsWith('/api/estudio/')) return tempoLimiteDoEstudioMs;
  }
  if (metodo === 'PUT' && caminho === '/api/perfil/foto') return tempoLimiteDoEstudioMs;
  return tempoLimiteMs;
}

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

/** O token da sessão em memória, só para as imagens da própria pessoa em revisão (`fonteDaMidiaDaDona`). */
let tokenEmMemoria: string | null = null;

export async function lerToken() {
  const chave = chaveDoToken();
  try {
    tokenEmMemoria = await SecureStore.getItemAsync(chave);
    return tokenEmMemoria;
  } catch {
    throw new FalhaMobile('armazenamento');
  }
}

export async function guardarToken(token: string) {
  const chave = chaveDoToken();
  try {
    await SecureStore.setItemAsync(chave, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    tokenEmMemoria = token;
  } catch {
    throw new FalhaMobile('armazenamento');
  }
}

export async function apagarToken() {
  const chave = chaveDoToken();
  tokenEmMemoria = null;
  try {
    await SecureStore.deleteItemAsync(chave);
  } catch {
    throw new FalhaMobile('armazenamento');
  }
}

/**
 * A fonte de uma imagem da própria pessoa (foto do perfil, capa): a foto ou a capa em revisão só abre para a dona, com a
 * sessão (spec 14, contrato c66a33d). O token vai só para o host da API configurada; qualquer outro endereço vai sem ele.
 */
export function fonteDaMidiaDaDona(uri: string): { uri: string; headers?: Record<string, string> } {
  try {
    if (tokenEmMemoria && new URL(uri).origin === origemConfigurada().origin) return { uri, headers: { Authorization: `Bearer ${tokenEmMemoria}` } };
  } catch {
    // Endereço inválido: sem o token.
  }
  return { uri };
}

/** O transporte do app: a origem configurada, o tempo limite e, com sessão, o token no Authorization (sem cookie). */
function transporteNativo(token?: string): TransporteStudoo {
  return async (caminho, opcoes) => {
    const origem = origemConfigurada().origin;
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), tempoDoPedido(caminho, opcoes.method));

    try {
      const resposta = await fetch(`${origem}${caminho}`, {
        ...opcoes,
        credentials: 'omit',
        redirect: 'error',
        signal: controle.signal,
        headers: {
          'Cache-Control': 'no-store',
          [CABECALHO_CAPACIDADES]: CAPACIDADES_DO_APP,
          ...opcoes.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (token && resposta.status === 401) throw new ErroStudoo('nao_autenticado');

      const corpo = resposta.status === 204 ? null : await resposta.json().catch(() => null);
      if (controle.signal.aborted) throw new FalhaMobile('conexao');
      // Uma API sem essa rota pode devolver 404 em HTML. Um erro JSON continua a cargo do contrato.
      if (caminho === '/api/aprendizado/diagnostico' && resposta.status === 404 && corpo === null) {
        throw new ErroStudoo('nao_encontrado');
      }
      return { status: resposta.status, ok: resposta.ok, json: async () => corpo };
    } catch (erro) {
      if (erro instanceof ErroStudoo || erro instanceof FalhaMobile) throw erro;
      // Sem rede numa ação da pessoa (pedido que não é GET), o som de erro de rede, como a web; as leituras falham caladas.
      if ((opcoes.method ?? 'GET').toUpperCase() !== 'GET') void tocaSons.tocarEfeito('erro_rede');
      throw new FalhaMobile('conexao');
    } finally {
      clearTimeout(limite);
    }
  };
}

export function criarClienteNativo(token?: string) {
  const cliente = criarClienteStudoo(transporteNativo(token));
  // /api/auth/config é pública e recusa pedido com Authorization (rotaPublica responde 401): vai sempre sem o token. Antes,
  // com sessão, a configuração nunca chegava (o aviso do material ficava sem o provedor e o compartilhar não aparecia).
  const semSessao = token ? criarClienteStudoo(transporteNativo()) : cliente;

  return {
    ...cliente,
    configuracaoAcesso: semSessao.configuracaoAcesso,
    gerarTrilhaAoVivo: (objetivo: string, sinal: AbortSignal, diagnosticoId?: string) => gerarTrilhaAoVivo(objetivo, sinal, token, diagnosticoId),
    responderSuaVez: (id: string, escolha: EscolhaNoSuaVez) => responderSuaVez(transporteNativo(token), id, escolha),
  };
}

/**
 * O "Sua vez" do "Resolva comigo" (spec 15): `POST /api/aprendizado/licoes/[id]/resolucao` com a opção e a tentativa. Devolve o
 * corpo cru (quem chama confere a forma); erro da API vira `ErroStudoo`, sem rede vira `FalhaMobile('conexao')`.
 */
async function responderSuaVez(transporte: TransporteStudoo, id: string, escolha: EscolhaNoSuaVez): Promise<unknown> {
  const resposta = await transporte(`/api/aprendizado/licoes/${encodeURIComponent(id)}/resolucao`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opcao: escolha.opcao, tentativa: escolha.tentativa }),
  });
  const corpo: unknown = await resposta.json();
  if (!resposta.ok) throw new ErroStudoo(codigoDaResposta(corpo));
  return corpo;
}

/**
 * Geração ao vivo (spec 03), o mesmo pedido da web com o token no lugar do cookie: a resposta chega em NDJSON e cada linha
 * vira um evento validado pelo contrato. O tempo limite vale até a resposta começar; depois, a trilha segue chegando enquanto
 * a pessoa acompanha, e `sinal` (Cancelar, sair da tela) interrompe o pedido, como na web. O servidor não guarda nada até o aceite.
 */
async function* gerarTrilhaAoVivo(objetivo: string, sinal: AbortSignal, token?: string, diagnosticoId?: string): AsyncGenerator<EventoGeracao> {
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
        [CABECALHO_CAPACIDADES]: CAPACIDADES_DO_APP,
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ objetivo, diagnosticoId }),
    });
    if (token && resposta.status === 401) throw new ErroStudoo('nao_autenticado');
    // Erro antes do início (validação, limite, sessão): o servidor responde no JSON de erro de sempre.
    if (!resposta.ok || !resposta.body || !resposta.headers.get('content-type')?.includes('application/x-ndjson')) {
      const corpo: unknown = await resposta.json().catch(() => null);
      if (controle.signal.aborted) throw new FalhaMobile('conexao');
      throw new ErroStudoo(codigoDaResposta(corpo), corpo);
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
