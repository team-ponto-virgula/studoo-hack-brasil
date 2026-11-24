import { TEMAS, type Tema } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';

export type AbaExplorar = 'todos' | 'seguindo';

export type FiltroExplorarUrl = {
  aba: AbaExplorar;
  tema: Tema | null;
  busca: string;
};

export type EstadoRotaWeb =
  | { tipo: 'planos' }
  | { tipo: 'objetivo' }
  | { tipo: 'perfil' }
  | { tipo: 'explorar'; filtro: FiltroExplorarUrl }
  | { tipo: 'plano'; planoId: string }
  | { tipo: 'configuracoes'; planoId: string }
  | { tipo: 'licao'; planoId: string; licaoId: string };

const ehTema = (valor: string | null): valor is Tema =>
  valor !== null && (TEMAS as readonly string[]).includes(valor);

export const CHAVE_ORIGEM_EXPLORAR = 'studoo.explorar.origem';

export type TipoAlvoExplorar = 'titulo' | 'dono';
export type SecaoAlvoExplorar = 'em-alta' | 'novas';

export type OrigemExplorar = {
  url: string;
  scrollY: number;
  alvoHref: string;
  alvoCodigo?: string;
  alvoTipo?: TipoAlvoExplorar;
  alvoSecao?: SecaoAlvoExplorar;
  paginas?: number;
  em: number;
};

export function normalizarPaginasOrigem(valor?: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 1 ? Math.floor(valor) : 1;
}

export function lerFiltroExplorarDaUrl(search: string | URLSearchParams): FiltroExplorarUrl {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const temaBruto = params.get('tema');
  const aba: AbaExplorar = params.get('aba') === 'seguindo' ? 'seguindo' : 'todos';
  const busca = (params.get('q') ?? '').trim().slice(0, 80);
  return {
    aba,
    tema: ehTema(temaBruto) ? temaBruto : null,
    busca,
  };
}

export function urlDoExplorar(filtro: Partial<FiltroExplorarUrl>): string {
  const params = new URLSearchParams();
  if (filtro.aba === 'seguindo') params.set('aba', 'seguindo');
  if (filtro.tema) params.set('tema', filtro.tema);
  const busca = filtro.busca?.trim().slice(0, 80);
  if (busca) params.set('q', busca);
  const qs = params.toString();
  return qs ? `/explorar?${qs}` : '/explorar';
}

export function lerRotaDaUrl(pathname: string, search: string): EstadoRotaWeb | null {
  if (pathname === '/explorar') {
    return { tipo: 'explorar', filtro: lerFiltroExplorarDaUrl(search) };
  }
  if (pathname !== '/') return null;
  const params = new URLSearchParams(search);
  const trilha = params.get('trilha')?.trim();
  const licao = params.get('licao')?.trim();
  const config = params.get('config') === '1';
  if (trilha && licao) return { tipo: 'licao', planoId: trilha, licaoId: licao };
  if (trilha && config) return { tipo: 'configuracoes', planoId: trilha };
  if (trilha) return { tipo: 'plano', planoId: trilha };
  const tela = params.get('tela');
  if (tela === 'trilhas') return { tipo: 'planos' };
  if (tela === 'nova') return { tipo: 'objetivo' };
  if (tela === 'perfil') return { tipo: 'perfil' };
  return null;
}

export function urlDaTelaWeb(rota: EstadoRotaWeb): string {
  switch (rota.tipo) {
    case 'explorar':
      return urlDoExplorar(rota.filtro);
    case 'planos':
      return '/?tela=trilhas';
    case 'objetivo':
      return '/?tela=nova';
    case 'perfil':
      return '/?tela=perfil';
    case 'plano':
      return `/?trilha=${encodeURIComponent(rota.planoId)}`;
    case 'configuracoes':
      return `/?trilha=${encodeURIComponent(rota.planoId)}&config=1`;
    case 'licao':
      return `/?trilha=${encodeURIComponent(rota.planoId)}&licao=${encodeURIComponent(rota.licaoId)}`;
  }
}

export function tituloDaTelaWeb(
  tipo: string,
  detalhe?: { planoTitulo?: string; licaoTitulo?: string; tema?: Tema | null; aba?: AbaExplorar },
): string {
  const nome = mensagens.nome;
  switch (tipo) {
    case 'planos':
      return `${mensagens.planos.titulo} · ${nome}`;
    case 'objetivo':
      return `${mensagens.planos.novo} · ${nome}`;
    case 'perfil':
      return `${mensagens.perfil.titulo} · ${nome}`;
    case 'explorar': {
      if (detalhe?.aba === 'seguindo') return `${mensagens.comunidade.abaSeguindo} · ${mensagens.comunidade.titulo} · ${nome}`;
      if (detalhe?.tema) return `${mensagens.temas[detalhe.tema]} · ${mensagens.comunidade.titulo} · ${nome}`;
      return `${mensagens.comunidade.titulo} · ${nome}`;
    }
    case 'plano':
      return detalhe?.planoTitulo ? `${detalhe.planoTitulo} · ${nome}` : nome;
    case 'configuracoes':
      return detalhe?.planoTitulo ? `${mensagens.configuracoes.titulo} · ${detalhe.planoTitulo} · ${nome}` : `${mensagens.configuracoes.titulo} · ${nome}`;
    case 'licao':
      return detalhe?.licaoTitulo ? `${detalhe.licaoTitulo} · ${nome}` : nome;
    case 'concluida':
      return `${mensagens.licao.concluida} · ${nome}`;
    case 'geracao':
    case 'proposta':
      return `${mensagens.planos.novo} · ${nome}`;
    default:
      return nome;
  }
}

export function mesmaUrlExplorar(a: string, b: string): boolean {
  if (!a.startsWith('/explorar') || !b.startsWith('/explorar')) return false;
  const searchA = a.includes('?') ? a.slice(a.indexOf('?')) : '';
  const searchB = b.includes('?') ? b.slice(b.indexOf('?')) : '';
  return urlDoExplorar(lerFiltroExplorarDaUrl(searchA)) === urlDoExplorar(lerFiltroExplorarDaUrl(searchB));
}

export function salvarOrigemExplorar(
  alvoHref: string,
  detalhe?: { codigo?: string; tipo?: TipoAlvoExplorar; secao?: SecaoAlvoExplorar; paginas?: number },
): void {
  if (typeof window === 'undefined') return;
  try {
    const paginas = normalizarPaginasOrigem(detalhe?.paginas);
    const origem: OrigemExplorar = {
      url: `${window.location.pathname}${window.location.search}`,
      scrollY: window.scrollY,
      alvoHref,
      ...(detalhe?.codigo ? { alvoCodigo: detalhe.codigo } : {}),
      ...(detalhe?.tipo ? { alvoTipo: detalhe.tipo } : {}),
      ...(detalhe?.secao ? { alvoSecao: detalhe.secao } : {}),
      paginas,
      em: Date.now(),
    };
    window.sessionStorage.setItem(CHAVE_ORIGEM_EXPLORAR, JSON.stringify(origem));
  } catch {
    // Sem sessionStorage, a navegação segue normalmente.
  }
}

export function paginaContemCodigoExplorar(
  pagina: { emAlta: readonly { codigo: string }[]; novas: readonly { codigo: string }[] },
  codigo?: string | null,
): boolean {
  if (!codigo) return false;
  return pagina.novas.some((item) => item.codigo === codigo) || pagina.emAlta.some((item) => item.codigo === codigo);
}

/**
 * Recarrega páginas do Explorar até alcançar as páginas carregadas na origem e o cartão realmente aberto,
 * sem limite fixo de páginas. Interrompe no fim real do catálogo (`cursor: null`), no cancelamento/troca de consulta
 * (`ativo() === false`) ou se o cursor não avançar (cursor repetido ou página sem novos cartões).
 */
export async function carregarPaginasOrigemExplorar<
  TItem extends { codigo: string },
  TPagina extends { emAlta: readonly TItem[]; novas: TItem[]; cursor: string | null },
>({
  inicial,
  origem,
  buscarProxima,
  ativo,
}: {
  inicial: TPagina;
  origem: Pick<OrigemExplorar, 'paginas' | 'alvoCodigo'>;
  buscarProxima: (cursor: string) => Promise<TPagina>;
  ativo: () => boolean;
}): Promise<TPagina | null> {
  let acumulada = inicial;
  let totalPaginas = 1;
  const paginasAlvo = normalizarPaginasOrigem(origem.paginas);
  const alvoCodigo = origem.alvoCodigo ?? null;
  const vistos = new Set(acumulada.novas.map((item) => item.codigo));
  const cursoresUsados = new Set<string>();

  const precisaMais = () => {
    if (!acumulada.cursor) return false;
    if (totalPaginas < paginasAlvo) return true;
    if (alvoCodigo && !paginaContemCodigoExplorar(acumulada, alvoCodigo)) return true;
    return false;
  };

  while (ativo() && precisaMais()) {
    const cursorAtual = acumulada.cursor;
    if (!cursorAtual || cursoresUsados.has(cursorAtual)) break;
    cursoresUsados.add(cursorAtual);
    const proxima = await buscarProxima(cursorAtual);
    if (!ativo()) return null;
    const novasUnicas = proxima.novas.filter((item) => !vistos.has(item.codigo));
    for (const item of novasUnicas) vistos.add(item.codigo);
    const cursorRepetido = Boolean(proxima.cursor && (proxima.cursor === cursorAtual || cursoresUsados.has(proxima.cursor)));
    const semProgresso = novasUnicas.length === 0;
    acumulada = {
      ...acumulada,
      novas: [...acumulada.novas, ...novasUnicas],
      cursor: cursorRepetido ? null : proxima.cursor,
    };
    totalPaginas += 1;
    if (cursorRepetido || semProgresso) break;
  }

  return ativo() ? acumulada : null;
}

export function encontrarLinkOrigemExplorar<T extends { getAttribute(nome: string): string | null }>(
  links: Iterable<T>,
  origem: Pick<OrigemExplorar, 'alvoHref' | 'alvoCodigo' | 'alvoTipo' | 'alvoSecao'>,
): T | null {
  const lista = Array.from(links);
  if (origem.alvoCodigo && origem.alvoTipo) {
    if (origem.alvoSecao) {
      const chaveExata = `${origem.alvoSecao}:${origem.alvoCodigo}:${origem.alvoTipo}`;
      const exato = lista.find((link) => link.getAttribute('data-origem-cartao') === chaveExata);
      if (exato) return exato;
    }
    const sufixo = `:${origem.alvoCodigo}:${origem.alvoTipo}`;
    const peloCartao = lista.find((link) => link.getAttribute('data-origem-cartao')?.endsWith(sufixo));
    if (peloCartao) return peloCartao;
  }
  return lista.find((link) => link.getAttribute('href') === origem.alvoHref) ?? null;
}

export function lerOrigemExplorar(consumir = false): OrigemExplorar | null {
  if (typeof window === 'undefined') return null;
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_ORIGEM_EXPLORAR);
    if (!bruto) return null;
    if (consumir) window.sessionStorage.removeItem(CHAVE_ORIGEM_EXPLORAR);
    const dado = JSON.parse(bruto) as Partial<OrigemExplorar>;
    if (
      typeof dado.url !== 'string' ||
      !dado.url.startsWith('/explorar') ||
      typeof dado.scrollY !== 'number' ||
      typeof dado.alvoHref !== 'string' ||
      typeof dado.em !== 'number' ||
      Date.now() - dado.em > 30 * 60_000
    ) {
      return null;
    }
    const paginas = normalizarPaginasOrigem(dado.paginas);
    return {
      url: dado.url,
      scrollY: dado.scrollY,
      alvoHref: dado.alvoHref,
      ...(typeof dado.alvoCodigo === 'string' && dado.alvoCodigo ? { alvoCodigo: dado.alvoCodigo } : {}),
      ...(dado.alvoTipo === 'titulo' || dado.alvoTipo === 'dono' ? { alvoTipo: dado.alvoTipo } : {}),
      ...(dado.alvoSecao === 'em-alta' || dado.alvoSecao === 'novas' ? { alvoSecao: dado.alvoSecao } : {}),
      paginas,
      em: dado.em,
    };
  } catch {
    return null;
  }
}
