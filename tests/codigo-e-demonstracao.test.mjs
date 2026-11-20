// Etapa C1 (spec 10): Código Studoo lido com endereços reais e foto no centro, e o conteúdo de demonstração.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import sharp from 'sharp';
import jsQR from 'jsqr';
import zx from '@zxing/library';
import { CORES_PERFIL, FUNDO_DA_COR, geometriaCodigoStudoo, svgCodigoDoLink } from '@studoo/contratos';
import { GET as explorarGet } from '../src/app/api/explorar/route.ts';
import { GET as perfisGet } from '../src/app/api/perfis/[perfilId]/route.ts';
import { GET as linkGet } from '../src/app/api/compartilhar/[codigo]/route.ts';
import { POST as adicionarPost } from '../src/app/api/compartilhar/[codigo]/adicionar/route.ts';
import { POST as recuperarPost } from '../src/app/api/senha/recuperar/route.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { assinatura } from '../src/servidor/acesso/seguranca.ts';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import { classificacaoDaSemana, zerarCacheEmAlta } from '../src/servidor/compartilhar/comunidade.ts';
import { DOMINIO_DEMO, criarDemonstracao, removerDemonstracao } from '../src/servidor/compartilhar/demonstracao.ts';

const { BinaryBitmap, DecodeHintType, HybridBinarizer, QRCodeReader, RGBLuminanceSource } = zx;
const origem = process.env.STUDOO_ORIGEM || 'http://localhost:3000';
process.env.IA = 'falsa';
process.env.STUDOO_COMPARTILHAR = '1';
process.env.STUDOO_COMUNIDADE = '1';
const usuarios = [];
// O banco local é compartilhado: se a demonstração já existia antes da suíte, ela volta no fim (com datas novas).
// Toda busca pela demonstração filtra também pelo domínio: outros arquivos de teste, rodando em paralelo no mesmo banco,
// criam perfis com perfilDemo e e-mail @example.test (por exemplo, seguir.test.mjs).
const DONO_DEMO = { perfilDemo: true, email: { endsWith: `@${DOMINIO_DEMO}` } };
const demoAntes = (await banco.usuario.count({ where: DONO_DEMO })) > 0;

after(async () => {
  process.env.STUDOO_COMUNIDADE_DEMO = '1';
  if (demoAntes) await criarDemonstracao(); else await removerDemonstracao();
  for (const id of usuarios) {
    await banco.licao.deleteMany({ where: { usuarioId: id } });
    await banco.fluxo.deleteMany({ where: { usuarioId: id } });
    await banco.planoAprendizado.deleteMany({ where: { usuarioId: id } });
    await banco.sessao.deleteMany({ where: { usuarioId: id } });
    await banco.tentativaLogin.deleteMany({ where: { chave: { in: [`compartilhar:adicionar:${id}`].map(assinatura) } } });
    await banco.usuario.delete({ where: { id } });
  }
  await banco.tentativaLogin.deleteMany({ where: { chave: assinatura('compartilhar:global') } });
  await banco.$disconnect();
});

async function ler(svg, lado) {
  const { data, info } = await sharp(Buffer.from(svg)).resize(lado, lado).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  const viaJsqr = jsQR(rgba, info.width, info.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  const lum = new Uint8ClampedArray(info.width * info.height);
  for (let i = 0; i < lum.length; i++) lum[i] = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000;
  let viaZxing = null;
  try { viaZxing = new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, info.width, info.height))), new Map([[DecodeHintType.TRY_HARDER, true]])).getText(); } catch { /* não leu */ }
  return { viaJsqr, viaZxing };
}

test('Código Studoo dos links reais (trilha e perfil com foto no centro) é lido por jsQR e ZXing em 240 e 600 px, nas 6 cores', async () => {
  const foto = `data:image/png;base64,${(await sharp({ create: { width: 64, height: 64, channels: 3, background: '#222' } }).png().toBuffer()).toString('base64')}`;
  const casos = [
    { texto: 'https://studoo.exemplo.com.br/t/AbCdEfGhIjKlMn_-', fotoHref: null },
    { texto: 'https://studoo.exemplo.com.br/p/ZyXwVuTsRqPoNm-_', fotoHref: foto },
    { texto: 'http://localhost:3000/t/AbCdEfGhIjKlMn_-', fotoHref: null },
  ];
  for (const { texto, fotoHref } of casos) for (const cor of CORES_PERFIL) {
    const svg = svgCodigoDoLink(texto, { mioloCor: FUNDO_DA_COR[cor], fotoHref, tamanho: 1200 });
    for (const lado of [240, 600]) {
      const { viaJsqr, viaZxing } = await ler(svg, lado);
      assert.equal(viaJsqr, texto, `jsQR ${cor} ${lado} ${texto}`);
      assert.equal(viaZxing, texto, `ZXing ${cor} ${lado} ${texto}`);
    }
  }
  // A foto no centro não deixa escapar aspas nem tags.
  assert.ok(!svgCodigoDoLink('x', { fotoHref: '"><script>' }).includes('<script>'));
});

test('Código Studoo com links do tamanho do de produção (75 car.) e maiores (90, 106, 107 e 120): sempre com clareira e lido pelos dois leitores', async () => {
  // O site de prévia tem domínio longo. A configuração (nível, versão, máscara, ponte e clareira) sai da conta da folga
  // (tests/codigo-folga.test.mjs); aqui, os centros e as cores em três tamanhos.
  const link = (n, tipo) => { const fim = `/${tipo}/AbCdEfGhIjKlMn_-`; return `https://${'studoo-previa-hackbrasil.exemplo.com.br'.padEnd(n, 'x').slice(0, n - 8 - fim.length)}${fim}`; };
  const foto = `data:image/png;base64,${(await sharp({ create: { width: 64, height: 64, channels: 3, background: '#222' } }).png().toBuffer()).toString('base64')}`;
  for (const n of [75, 90, 106, 107, 120]) {
    for (const tipo of ['t', 'p']) {
      const texto = link(n, tipo);
      assert.equal(texto.length, n);
      const g = geometriaCodigoStudoo(texto);
      assert.ok(g.clareira && g.clareira.lado >= 5, `${n}: clareira (${g.nivel} v${g.versao})`);
      assert.ok(g.versao <= 7, `${n}: versão ${g.versao} (módulo grande)`);
      for (const [centro, opcoes] of [['sorriso', {}], ['foto', { fotoHref: foto }], ['inicial', { inicial: 'A' }]]) {
        for (const cor of ['azul', 'laranja']) {
          const svg = svgCodigoDoLink(texto, { mioloCor: FUNDO_DA_COR[cor], tamanho: 1200, ...opcoes });
          for (const lado of [160, 240, 600]) {
            const { viaJsqr, viaZxing } = await ler(svg, lado);
            assert.equal(viaJsqr, texto, `jsQR ${n} ${centro} ${cor} ${lado}`);
            assert.equal(viaZxing, texto, `ZXing ${n} ${centro} ${cor} ${lado}`);
          }
        }
      }
    }
  }
  // O de 75 caracteres fica na versão 5 (37 módulos), com o centro e a ponte (fina quando a cheia gastaria a folga).
  const g75 = geometriaCodigoStudoo(link(75, 't'));
  assert.equal(g75.versao, 5);
  assert.ok(g75.clareira && g75.configuracao.ponte !== 'nenhuma');
});

test('demonstração: só com a flag, idempotente (renova datas), 8+ trilhas em 6+ temas, Em alta cheio, sem login', async () => {
  delete process.env.STUDOO_COMUNIDADE_DEMO;
  await assert.rejects(() => criarDemonstracao(), /STUDOO_COMUNIDADE_DEMO=1/);
  process.env.STUDOO_COMUNIDADE_DEMO = '1';
  const antes = new Date(Date.now() - 3 * 24 * 60 * 60_000);
  const primeiro = await criarDemonstracao(antes);
  assert.ok(primeiro.perfis >= 4 && primeiro.perfis <= 6);
  assert.ok(primeiro.trilhas >= 8 && primeiro.trilhas <= 12);
  assert.ok(primeiro.temas >= 6);
  const datasAntes = (await banco.linkTrilha.findMany({ where: { plano: { usuario: DONO_DEMO } }, select: { publicadaEm: true } })).map((l) => l.publicadaEm.getTime());
  const segundo = await criarDemonstracao();
  await banco.usuario.updateMany({ where: DONO_DEMO, data: { perfilModeracao: 'aprovado' } });
  await banco.linkTrilha.updateMany({ where: { plano: { usuario: DONO_DEMO } }, data: { moderacao: 'aprovado' } });
  assert.deepEqual(segundo, primeiro, 'rodar de novo não duplica');
  assert.equal(await banco.usuario.count({ where: DONO_DEMO }), primeiro.perfis);
  assert.equal(await banco.linkTrilha.count({ where: { plano: { usuario: DONO_DEMO } } }), primeiro.trilhas);
  const datasDepois = (await banco.linkTrilha.findMany({ where: { plano: { usuario: DONO_DEMO } }, select: { publicadaEm: true } })).map((l) => l.publicadaEm.getTime());
  assert.ok(Math.min(...datasDepois) > Math.max(...datasAntes) - 3 * 24 * 60 * 60_000 + 60_000, 'as datas andaram');
  // Eventos só dos perfis de demonstração, nos últimos 7 dias, depois da publicação.
  const eventos = await banco.eventoTrilha.findMany({ where: { link: { plano: { usuario: DONO_DEMO } } }, select: { criadoEm: true, usuario: { select: { perfilDemo: true } }, link: { select: { publicadaEm: true } } } });
  assert.ok(eventos.length > 20);
  for (const e of eventos) {
    assert.ok(e.usuario.perfilDemo);
    assert.ok(e.criadoEm >= e.link.publicadaEm && e.criadoEm <= new Date());
    assert.ok(Date.now() - e.criadoEm.getTime() < 7 * 24 * 60 * 60_000);
  }
  // Sem login: sem senha, sem Google, sem sessão, e-mail .invalid; recuperar senha não cria código.
  const perfis = await banco.usuario.findMany({ where: DONO_DEMO, select: { id: true, email: true, senhaHash: true, googleSub: true, _count: { select: { sessoes: true } } } });
  for (const p of perfis) {
    assert.ok(p.email.endsWith(`@${DOMINIO_DEMO}`));
    assert.equal(p.senhaHash, null);
    assert.equal(p.googleSub, null);
    assert.equal(p._count.sessoes, 0);
  }
  await recuperarPost(new Request(`${origem}/api/senha/recuperar`, { method: 'POST', headers: { origin: origem, 'content-type': 'application/json' }, body: JSON.stringify({ email: perfis[0].email }) })).catch(() => undefined);
  assert.equal(await banco.recuperacaoSenha.count({ where: { usuarioId: perfis[0].id } }), 0);

  // Na classificação da semana, todas as trilhas de demonstração têm ponto (o Em alta enche com elas num banco limpo).
  zerarCacheEmAlta();
  const codigosDemo = (await banco.linkTrilha.findMany({ where: { plano: { usuario: DONO_DEMO } }, select: { codigo: true } })).map((l) => l.codigo);
  const pontuadas = (await classificacaoDaSemana()).filter((item) => codigosDemo.includes(item.codigo));
  assert.equal(pontuadas.length, primeiro.trilhas, 'todas no Em alta da semana');
  assert.ok(new Set(pontuadas.map((item) => item.pontos)).size >= 6, 'pontos variados: um top de verdade');
  const pagina = await (await explorarGet(new Request(`${origem}/api/explorar`, { headers: { origin: origem } }))).json();
  assert.ok([...pagina.emAlta, ...pagina.novas].filter((c) => codigosDemo.includes(c.codigo)).every((c) => c.dono.demo === true), 'selo no dono');
  assert.ok(!JSON.stringify(pagina).includes(DOMINIO_DEMO), 'sem e-mail');
  // Nenhuma tela mostra dois cartões com o mesmo título nem dois retratos iguais: títulos e retratos únicos.
  const titulos = (await banco.linkTrilha.findMany({ where: { plano: { usuario: DONO_DEMO } }, select: { plano: { select: { titulo: true } } } })).map((l) => l.plano.titulo);
  assert.equal(new Set(titulos).size, titulos.length, `títulos repetidos: ${titulos.join(' | ')}`);
  const fotos = await banco.fotoPerfil.findMany({ where: { usuario: DONO_DEMO }, select: { pequena: true } });
  assert.equal(fotos.length, primeiro.perfis);
  assert.equal(new Set(fotos.map((f) => Buffer.from(f.pequena).toString('base64'))).size, fotos.length, 'retratos únicos');
});

test('demonstração: sem a flag no servidor, some do Explorar, do /p e do /t; uma pessoa de verdade que adicionou fica com a cópia ao remover', async () => {
  process.env.STUDOO_COMUNIDADE_DEMO = '1';
  await criarDemonstracao();
  await banco.usuario.updateMany({ where: DONO_DEMO, data: { perfilModeracao: 'aprovado' } });
  await banco.linkTrilha.updateMany({ where: { plano: { usuario: DONO_DEMO } }, data: { moderacao: 'aprovado' } });
  const link = await banco.linkTrilha.findFirst({ where: { plano: { usuario: DONO_DEMO } }, select: { codigo: true, adicoes: true, plano: { select: { usuario: { select: { perfilId: true } } } } } });
  const pessoa = await banco.usuario.create({ data: { email: `demo-real-${randomUUID()}@example.test`, fuso: 'UTC' } });
  usuarios.push(pessoa.id);
  const { token } = await criarSessao(pessoa.id);
  const adicionada = await adicionarPost(new Request(`${origem}/api/compartilhar/${link.codigo}/adicionar`, { method: 'POST', headers: { origin: origem, cookie: cookieSessao(token), 'content-type': 'application/json' }, body: '{}' }), { params: Promise.resolve({ codigo: link.codigo }) });
  assert.equal(adicionada.status, 200);
  // Renovar mantém quem é de verdade no "estudando".
  await criarDemonstracao();
  assert.equal((await banco.linkTrilha.findUnique({ where: { codigo: link.codigo } })).adicoes, link.adicoes + 1);

  delete process.env.STUDOO_COMUNIDADE_DEMO;
  try {
    zerarCacheEmAlta();
    const pagina = await (await explorarGet(new Request(`${origem}/api/explorar`, { headers: { origin: origem } }))).json();
    assert.ok(![...pagina.emAlta, ...pagina.novas].some((c) => c.dono.demo), 'nada de demonstração sem a flag');
    const perfilId = link.plano.usuario.perfilId;
    assert.equal((await perfisGet(new Request(`${origem}/api/perfis/${perfilId}`, { headers: { origin: origem } }), { params: Promise.resolve({ perfilId }) })).status, 404);
    assert.equal((await linkGet(new Request(`${origem}/api/compartilhar/${link.codigo}`, { headers: { origin: origem } }), { params: Promise.resolve({ codigo: link.codigo }) })).status, 404);
    await assert.rejects(() => removerDemonstracao(), /STUDOO_COMUNIDADE_DEMO=1/);
  } finally {
    process.env.STUDOO_COMUNIDADE_DEMO = '1';
  }
  const { perfis } = await removerDemonstracao();
  assert.ok(perfis >= 4);
  assert.equal(await banco.usuario.count({ where: DONO_DEMO }), 0);
  assert.equal(await banco.planoAprendizado.count({ where: { usuarioId: pessoa.id, origemCodigo: link.codigo } }), 1, 'a cópia da pessoa fica');
  zerarCacheEmAlta();
});
