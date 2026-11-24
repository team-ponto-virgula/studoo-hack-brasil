// Regressão das 4 falhas do Explorar reportadas na validação de integração (24/11/2026):
// 1. Busca em catálogo > 500 publicações encontra item antigo (além das 500 candidatas iniciais) e pagina sem omissões.
// 2. Resposta atrasada de "Ver mais trilhas" (corrida) é descartada ao trocar a consulta.
// 3. Voltar de trilha/perfil na página 2+ preserva quantidade de páginas carregadas, rolagem e foco.
// 4. Voltar de perfil quando a mesma autora tem 2+ cartões foca o link exato do cartão acionado.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { GET as explorarGet } from '../src/app/api/explorar/route.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import {
  carregarPaginasOrigemExplorar,
  encontrarLinkOrigemExplorar,
  lerOrigemExplorar,
  mesmaUrlExplorar,
  salvarOrigemExplorar,
} from '../src/app/navegacao-web.ts';

const raiz = resolve(import.meta.dirname, '..');
const origem = process.env.STUDOO_ORIGEM || 'http://127.0.0.1:3000';
const usuariosCriados = [];

process.env.STUDOO_COMPARTILHAR = '1';
process.env.STUDOO_COMUNIDADE = '1';

function req(caminho, { metodo = 'GET', token, corpo } = {}) {
  const headers = { origin: origem };
  if (token) headers.cookie = cookieSessao(token);
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  return new Request(`${origem}${caminho}`, {
    method: metodo,
    headers,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
}

after(async () => {
  for (const id of usuariosCriados) {
    await banco.linkTrilha.deleteMany({ where: { usuarioId: id } });
    await banco.licao.deleteMany({ where: { usuarioId: id } });
    await banco.fluxo.deleteMany({ where: { usuarioId: id } });
    await banco.planoAprendizado.deleteMany({ where: { usuarioId: id } });
    await banco.sessao.deleteMany({ where: { usuarioId: id } });
    await banco.usuario.deleteMany({ where: { id } });
  }
  await banco.$disconnect();
});

test('caso 1 (catálogo > 500): busca encontra publicação antiga após 501 recentes sem o termo e pagina 43 correspondências sem duplicar', async () => {
  const usuario = await banco.usuario.create({
    data: {
      email: `catalogo-longo-${randomUUID()}@example.test`,
      fuso: 'UTC',
      perfilNome: 'Érica Sintética',
      perfilCor: 'azul',
      perfilId: randomBytes(12).toString('base64url'),
      perfilModeracao: 'aprovado',
    },
  });
  usuariosCriados.push(usuario.id);
  const { token } = await criarSessao(usuario.id);

  // Datas antigas (> 1 ano atrás) mantêm o lote fora do Em alta (7 dias) e abaixo de publicações recentes de outros testes.
  const agora = Date.now() - 400 * 86_400_000;
  const planosData = [];
  const linksData = [];
  const termoAntigo = `heliotropioazul${randomBytes(3).toString('hex')}`;

  // 1 publicação antiga (mais antiga que as 501 recentes) em História com termo único
  const planoAntigoId = randomUUID();
  const codigoAntigo = randomBytes(12).toString('base64url');
  planosData.push({
    id: planoAntigoId,
    usuarioId: usuario.id,
    origem: 'falsa',
    objetivo: 'Estudar história antiga',
    titulo: `Crônica antiga do ${termoAntigo}`,
  });
  linksData.push({
    codigo: codigoAntigo,
    usuarioId: usuario.id,
    planoId: planoAntigoId,
    noPerfil: true,
    noExplorar: true,
    oculta: false,
    moderacao: 'aprovado',
    tema: 'historia',
    legenda: `Relato raro sobre ${termoAntigo} na antiguidade.`,
    publicadaEm: new Date(agora - 600 * 60_000),
  });

  // 501 publicações recentes em História SEM o termo
  for (let i = 0; i < 501; i++) {
    const planoId = randomUUID();
    planosData.push({
      id: planoId,
      usuarioId: usuario.id,
      origem: 'falsa',
      objetivo: `História geral ${i}`,
      titulo: `Capítulo histórico recente ${i + 1}`,
    });
    linksData.push({
      codigo: randomBytes(12).toString('base64url'),
      usuarioId: usuario.id,
      planoId,
      noPerfil: true,
      noExplorar: true,
      oculta: false,
      moderacao: 'aprovado',
      tema: 'historia',
      legenda: 'Linha do tempo sem o termo buscado.',
      publicadaEm: new Date(agora - i * 1_000),
    });
  }

  // 43 publicações em Artes com "Aquarela Cromática" + sufixo único da execução para validar paginação 20 + 20 + 3
  const loteTag = randomBytes(4).toString('hex');
  const codigosAquarela = new Set();
  for (let i = 1; i <= 43; i++) {
    const planoId = randomUUID();
    const codigo = randomBytes(12).toString('base64url');
    codigosAquarela.add(codigo);
    planosData.push({
      id: planoId,
      usuarioId: usuario.id,
      origem: 'falsa',
      objetivo: `Aquarela ${i}`,
      titulo: `Aquarela Cromática ${loteTag} ${i}`,
    });
    linksData.push({
      codigo,
      usuarioId: usuario.id,
      planoId,
      noPerfil: true,
      noExplorar: true,
      oculta: false,
      moderacao: 'aprovado',
      tema: 'artes',
      legenda: 'Mistura de pigmentos transparentes.',
      publicadaEm: new Date(agora - (1000 + (43 - i)) * 1_000),
    });
  }

  await banco.planoAprendizado.createMany({ data: planosData });
  await banco.linkTrilha.createMany({ data: linksData });

  // 1a) Busca pelo termo antigo além das 501 recentes (sem acento)
  const rAntiga = await explorarGet(req(`/api/explorar?tema=historia&q=${encodeURIComponent(termoAntigo)}`, { token }));
  assert.equal(rAntiga.status, 200);
  const corpoAntiga = await rAntiga.json();
  assert.deepEqual(corpoAntiga.emAlta, []);
  assert.equal(corpoAntiga.cursor, null);
  assert.equal(corpoAntiga.novas.length, 1, 'encontra a publicação antiga além das 500 candidatas iniciais');
  assert.equal(corpoAntiga.novas[0].codigo, codigoAntigo);

  // 1b) Busca acento-insensível paginada: 20 + 20 + 3 = 43 distintos, cursor null no fim
  const encontrados = [];
  let cursor = null;
  const tamanhos = [];
  for (let p = 0; p < 5; p++) {
    const qs = `/api/explorar?tema=artes&q=${encodeURIComponent(`AQUARELA CROMATICA ${loteTag}`)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const r = await explorarGet(req(qs, { token }));
    assert.equal(r.status, 200);
    const dados = await r.json();
    assert.deepEqual(dados.emAlta, []);
    tamanhos.push(dados.novas.length);
    encontrados.push(...dados.novas.map((c) => c.codigo));
    cursor = dados.cursor;
    if (!cursor) break;
  }
  assert.deepEqual(tamanhos, [20, 20, 3]);
  assert.equal(cursor, null);
  assert.equal(new Set(encontrados).size, 43);
  for (const cod of codigosAquarela) assert.ok(encontrados.includes(cod));
});

test('casos 3 e 4 (origem do Explorar): salva páginas carregadas e foca o link exato entre dois cartões da mesma autora', () => {
  const store = new Map();
  const prevWindow = globalThis.window;
  globalThis.window = {
    location: { pathname: '/explorar', search: '?tema=artes&q=AQUARELA+CROMATICA' },
    scrollY: 4826,
    sessionStorage: {
      setItem: (k, v) => store.set(k, v),
      getItem: (k) => store.get(k) ?? null,
      removeItem: (k) => store.delete(k),
    },
  };
  try {
    salvarOrigemExplorar('/p/erica-id', {
      codigo: 'card-32',
      tipo: 'dono',
      secao: 'novas',
      paginas: 2,
    });
    const lida = lerOrigemExplorar(false);
    assert.ok(lida);
    assert.equal(lida.scrollY, 4826);
    assert.equal(lida.paginas, 2);
    assert.equal(lida.alvoCodigo, 'card-32');
    assert.equal(lida.alvoTipo, 'dono');
    assert.equal(lida.alvoSecao, 'novas');
    assert.equal(mesmaUrlExplorar(lida.url, '/explorar?tema=artes&q=AQUARELA%20CROMATICA'), true);

    // Dois cartões da mesma autora (/p/erica-id): deve focar o cartão 32, NÃO o primeiro cartão 43!
    const link = (href, chave) => ({
      href,
      chave,
      getAttribute: (nome) => (nome === 'href' ? href : nome === 'data-origem-cartao' ? chave : null),
    });
    const linksNaPagina = [
      link('/t/card-43', 'novas:card-43:titulo'),
      link('/p/erica-id', 'novas:card-43:dono'),
      link('/t/card-32', 'novas:card-32:titulo'),
      link('/p/erica-id', 'novas:card-32:dono'),
    ];
    const alvo = encontrarLinkOrigemExplorar(linksNaPagina, lida);
    assert.equal(alvo?.chave, 'novas:card-32:dono', 'foca o link exato da autora no cartão 32, não o primeiro cartão da autora');

    // Fallback se o cartão mudou de seção (em-alta -> novas)
    const alvoOutraSecao = encontrarLinkOrigemExplorar(linksNaPagina, {
      ...lida,
      alvoSecao: 'em-alta',
    });
    assert.equal(alvoOutraSecao?.chave, 'novas:card-32:dono');

    // Fallback legado sem alvoCodigo
    const alvoLegado = encontrarLinkOrigemExplorar(linksNaPagina, { alvoHref: '/t/card-32' });
    assert.equal(alvoLegado?.chave, 'novas:card-32:titulo');
  } finally {
    globalThis.window = prevWindow;
  }
});

test('caso 2 (corrida em Ver mais trilhas): comunidade.tsx guarda geração da consulta e descarta página atrasada', () => {
  const fonte = readFileSync(join(raiz, 'src/app/comunidade.tsx'), 'utf8');
  assert.match(fonte, /const consultaAtual = useRef\(0\);/);
  const idxVerMais = fonte.indexOf('async function verMais()');
  assert.ok(idxVerMais > 0);
  const blocoVerMais = fonte.slice(idxVerMais, idxVerMais + 900);
  assert.match(blocoVerMais, /const geracao = consultaAtual\.current;/);
  assert.match(blocoVerMais, /if \(geracao !== consultaAtual\.current\) return;/);
  assert.match(blocoVerMais, /atual\.cursor !== cursorUsado/);
});

test('página 21+ (425 cartões): origem preserva páginas > 20 sem corte, restaura cartão #421 e respeita fim real, cancelamento e cursor sem progresso', async () => {
  const store = new Map();
  const prevWindow = globalThis.window;
  globalThis.window = {
    location: { pathname: '/explorar', search: '?tema=historia&q=serie425' },
    scrollY: 54120,
    sessionStorage: {
      setItem: (k, v) => store.set(k, v),
      getItem: (k) => store.get(k) ?? null,
      removeItem: (k) => store.delete(k),
    },
  };

  try {
    // 1) Sem teto de 20 páginas: salva e lê página 22 intacta
    salvarOrigemExplorar('/p/autora-unica', {
      codigo: 'card-421',
      tipo: 'dono',
      secao: 'novas',
      paginas: 22,
    });
    const origem22 = lerOrigemExplorar(false);
    assert.ok(origem22);
    assert.equal(origem22.paginas, 22, 'não limita páginas salvas a 20');
    assert.equal(origem22.alvoCodigo, 'card-421');

    // Monta catálogo sintético de 425 cartões da MESMA autora (22 páginas: 21x20 + 5)
    const todos = Array.from({ length: 425 }, (_, i) => ({
      codigo: `card-${i + 1}`,
      hrefDono: '/p/autora-unica',
    }));
    const buscarPagina = async (cursor) => {
      const inicio = cursor ? Number(cursor) : 0;
      const fatia = todos.slice(inicio, inicio + 20);
      const prox = inicio + 20 < todos.length ? String(inicio + 20) : null;
      return { emAlta: [], novas: fatia, cursor: prox };
    };

    // 2) Restaura até a página 22 (425 cartões) e encontra o link exato da autora no cartão #421
    const inicial = await buscarPagina(null);
    let chamadas = 0;
    const restaurada = await carregarPaginasOrigemExplorar({
      inicial,
      origem: origem22,
      buscarProxima: async (c) => { chamadas += 1; return buscarPagina(c); },
      ativo: () => true,
    });
    assert.ok(restaurada);
    assert.equal(chamadas, 21, 'busca páginas 2..22 sem corte');
    assert.equal(restaurada.novas.length, 425);
    assert.equal(restaurada.cursor, null);
    assert.ok(restaurada.novas.some((c) => c.codigo === 'card-421'));

    const links = restaurada.novas.map((c) => ({
      chave: `novas:${c.codigo}:dono`,
      getAttribute: (nome) => (nome === 'href' ? c.hrefDono : nome === 'data-origem-cartao' ? `novas:${c.codigo}:dono` : null),
    }));
    const linkExato = encontrarLinkOrigemExplorar(links, origem22);
    assert.equal(linkExato?.chave, 'novas:card-421:dono');

    // 3) Mesmo que novas publicações empurrem o cartão #421 para além da página salva (paginas=20), continua até encontrá-lo
    let chamadasDeslocado = 0;
    const restauradaDeslocado = await carregarPaginasOrigemExplorar({
      inicial,
      origem: { paginas: 20, alvoCodigo: 'card-421' },
      buscarProxima: async (c) => { chamadasDeslocado += 1; return buscarPagina(c); },
      ativo: () => true,
    });
    assert.ok(restauradaDeslocado);
    assert.equal(chamadasDeslocado, 21);
    assert.ok(restauradaDeslocado.novas.some((c) => c.codigo === 'card-421'));

    // 4) Fim real do catálogo (cartão removido): para ao atingir cursor: null
    let chamadasFim = 0;
    const restauradaFim = await carregarPaginasOrigemExplorar({
      inicial,
      origem: { paginas: 25, alvoCodigo: 'card-removido' },
      buscarProxima: async (c) => { chamadasFim += 1; return buscarPagina(c); },
      ativo: () => true,
    });
    assert.ok(restauradaFim);
    assert.equal(chamadasFim, 21);
    assert.equal(restauradaFim.cursor, null);

    // 5) Cancelamento / troca de consulta no meio da restauração: interrompe imediatamente e devolve null
    let ativo = true;
    let chamadasCancel = 0;
    const restauradaCancel = await carregarPaginasOrigemExplorar({
      inicial,
      origem: { paginas: 22, alvoCodigo: 'card-421' },
      buscarProxima: async (c) => {
        chamadasCancel += 1;
        if (chamadasCancel === 3) ativo = false;
        return buscarPagina(c);
      },
      ativo: () => ativo,
    });
    assert.equal(restauradaCancel, null);
    assert.equal(chamadasCancel, 3);

    // 6) Cursor sem progresso (repetido ou página sem novos cartões): encerra sem laço infinito
    let chamadasTravado = 0;
    const restauradaTravado = await carregarPaginasOrigemExplorar({
      inicial: { emAlta: [], novas: [{ codigo: 'card-1' }], cursor: 'cursor-fixo' },
      origem: { paginas: 25, alvoCodigo: 'card-421' },
      buscarProxima: async () => {
        chamadasTravado += 1;
        return { emAlta: [], novas: [{ codigo: 'card-1' }], cursor: 'cursor-fixo' };
      },
      ativo: () => true,
    });
    assert.ok(restauradaTravado);
    assert.equal(chamadasTravado, 1);
    assert.equal(restauradaTravado.cursor, null);

    let chamadasSemNovos = 0;
    const restauradaSemNovos = await carregarPaginasOrigemExplorar({
      inicial: { emAlta: [], novas: [{ codigo: 'card-1' }], cursor: 'c1' },
      origem: { paginas: 25, alvoCodigo: 'card-421' },
      buscarProxima: async () => {
        chamadasSemNovos += 1;
        return { emAlta: [], novas: [], cursor: `c-vazio-${chamadasSemNovos}` };
      },
      ativo: () => true,
    });
    assert.ok(restauradaSemNovos);
    assert.equal(chamadasSemNovos, 1);
  } finally {
    globalThis.window = prevWindow;
  }
});
