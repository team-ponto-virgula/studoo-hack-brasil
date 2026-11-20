import { publicacaoRevisada } from './fixtures/moderacao.mjs';
// Perfil rico (spec 10, etapa A): resumo, interesses, foto e alcance. Provedores simulados, banco real.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import sharp from 'sharp';
import { GET as perfilGet, PUT as perfilPut } from '../src/app/api/perfil/route.ts';
import { PUT as fotoPut, DELETE as fotoDelete } from '../src/app/api/perfil/foto/route.ts';
import { GET as fotoGet } from '../src/app/api/fotos/[token]/[tamanho]/route.ts';
import { POST as criarPost } from '../src/app/api/aprendizado/planos/[id]/compartilhar/route.ts';
import { GET as linkGet, PATCH as linkPatch } from '../src/app/api/compartilhar/[codigo]/route.ts';
import { POST as adicionarPost } from '../src/app/api/compartilhar/[codigo]/adicionar/route.ts';
import { GET as perfisGet } from '../src/app/api/perfis/[perfilId]/route.ts';
import { GET as planosGet } from '../src/app/api/aprendizado/planos/route.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { assinatura } from '../src/servidor/acesso/seguranca.ts';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { DOMINIO_EMAIL_VISITANTE, PREFIXO_EMAIL_VISITANTE } from '../src/servidor/acesso/visitante.ts';
import { aceitarProposta, gerarProposta } from '../src/servidor/aprendizado/servico.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import { tipoDaImagem } from '../src/servidor/compartilhar/foto.ts';
import { LIMITES_FOTO, TEMAS, enderecoFoto, interessesValidos, motivoResumoInvalido, normalizarResumoPerfil } from '@studoo/contratos';

const origem = process.env.STUDOO_ORIGEM || 'http://localhost:3000';
const usuarios = [];
process.env.IA = 'falsa';
process.env.STUDOO_IA_FALSA_PAUSA_MS = '0';
process.env.STUDOO_COMPARTILHAR = '1';

after(async () => {
  for (const id of usuarios) {
    await banco.licao.deleteMany({ where: { usuarioId: id } });
    await banco.fluxo.deleteMany({ where: { usuarioId: id } });
    await banco.planoAprendizado.deleteMany({ where: { usuarioId: id } });
    await banco.sessao.deleteMany({ where: { usuarioId: id } });
    await banco.tentativaLogin.deleteMany({ where: { chave: { in: [`ia:geracao:${id}`, `perfil:${id}`, `foto:${id}`, `compartilhar:criar:${id}`, `compartilhar:adicionar:${id}`].map(assinatura) } } });
    await banco.usuario.delete({ where: { id } }); // a foto sai em cascata
  }
  await banco.tentativaLogin.deleteMany({ where: { chave: { in: ['compartilhar:global', 'foto:ler:global'].map(assinatura) } } });
  await banco.$disconnect();
});

async function pessoa(email = `perfil-rico-${randomUUID()}@example.test`) {
  const u = await banco.usuario.create({ data: { email, fuso: 'UTC' } });
  usuarios.push(u.id);
  const { token } = await criarSessao(u.id);
  return { id: u.id, email, token };
}

function pedido(caminho, { metodo = 'GET', token, corpo } = {}) {
  const headers = { origin: origem };
  if (token) headers.cookie = cookieSessao(token);
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  return new Request(`${origem}${caminho}`, { method: metodo, headers, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
}
const ctx = (params) => ({ params: Promise.resolve(params) });
const json = async (promessa) => { const resposta = await promessa; return { status: resposta.status, corpo: await resposta.json() }; };
const salvar = (quem, corpo) => json(perfilPut(pedido('/api/perfil', { metodo: 'PUT', token: quem.token, corpo })));
const enviarFoto = (quem, bytes) => json(fotoPut(pedido('/api/perfil/foto', { metodo: 'PUT', token: quem.token, corpo: { base64: Buffer.from(bytes).toString('base64') } })));
const lerFoto = (token, tamanho = 512, sessao) => fotoGet(pedido(enderecoFoto(token, tamanho), { token: sessao }), ctx({ token, tamanho: String(tamanho) }));

/** Foto de teste: metade esquerda vermelha e direita azul; com orientação 6 (girar 90° horário) vira cima/baixo. */
async function fotoTeste({ formato = 'jpeg', orientacao, largura = 600, altura = 300 } = {}) {
  const metade = Math.floor(largura / 2);
  let imagem = sharp({ create: { width: largura, height: altura, channels: 3, background: '#ff0000' } })
    .composite([{ input: { create: { width: largura - metade, height: altura, channels: 3, background: '#0000ff' } }, left: metade, top: 0 }]);
  imagem = sharp(await imagem.png().toBuffer());
  if (formato === 'jpeg') {
    imagem = imagem.jpeg({ quality: 90 }).withExif({
      IFD0: { Copyright: 'segredo-exif-copyright', Artist: 'segredo-exif-autor' },
      IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '23/1 33/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '46/1 38/1 0/1' },
    });
    if (orientacao) imagem = imagem.withMetadata({ orientation: orientacao });
  } else if (formato === 'png') imagem = imagem.png();
  else imagem = imagem.webp();
  return imagem.toBuffer();
}

async function trilhaCompartilhada(dona) {
  const proposta = await gerarProposta(dona.id, 'Aprender frações na cozinha');
  const plano = await aceitarProposta(dona.id, proposta.token);
  const { corpo: link } = await json(criarPost(pedido(`/api/aprendizado/planos/${plano.id}/compartilhar`, { metodo: 'POST', token: dona.token, corpo: {} }), ctx({ id: plano.id })));
  await publicacaoRevisada(dona.id, link.codigo);
  return { plano, link };
}

test('regras do resumo e dos interesses (contrato)', () => {
  assert.equal(normalizarResumoPerfil('  Gosto de   física \n e violão  '), 'Gosto de física e violão');
  assert.equal(motivoResumoInvalido(''), null);
  assert.equal(motivoResumoInvalido('Estudo à noite, depois do trabalho.'), null);
  assert.equal(motivoResumoInvalido('a'.repeat(160)), null);
  assert.equal(motivoResumoInvalido('a'.repeat(161)), 'longo');
  assert.equal(motivoResumoInvalido('<script>'), 'caracteres');
  assert.equal(motivoResumoInvalido('oi​'), 'caracteres');
  for (const resumo of ['me acha em ana.com.br', 'ana@exemplo.com', 'https://x', 'www.ana']) assert.equal(motivoResumoInvalido(resumo), 'endereco', resumo);
  assert.equal(TEMAS.length, 12);
  assert.deepEqual(interessesValidos(['ciencias', 'idiomas']), ['idiomas', 'ciencias']);
  assert.deepEqual(interessesValidos([]), []);
  assert.equal(interessesValidos(['idiomas', 'idiomas']), null);
  assert.equal(interessesValidos(['astrologia']), null);
  assert.equal(interessesValidos(TEMAS.slice(0, 6)), null);
  assert.equal(interessesValidos('idiomas'), null);
});

test('resumo e interesses: salvar, manter quando não vêm, recusar inválidos e aparecer no perfil público e no /t', async () => {
  const ana = await pessoa();
  let r = await salvar(ana, { nome: 'Ana', cor: 'roxo', resumo: '  Estudo  à noite. ', interesses: ['saude', 'idiomas'] });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resumo, 'Estudo à noite.');
  assert.deepEqual(r.corpo.interesses, ['idiomas', 'saude']);
  assert.deepEqual(r.corpo.alcance, { trilhas: 0, pessoas: 0 });
  assert.equal(r.corpo.foto, null);
  // O app antigo manda só nome e cor: resumo e interesses ficam.
  r = await salvar(ana, { nome: 'Ana Maria', cor: 'roxo' });
  assert.equal(r.corpo.resumo, 'Estudo à noite.');
  assert.deepEqual(r.corpo.interesses, ['idiomas', 'saude']);
  // Resumo vazio apaga.
  r = await salvar(ana, { nome: 'Ana', cor: 'roxo', resumo: '', interesses: ['idiomas'] });
  assert.equal(r.corpo.resumo, null);
  for (const corpo of [
    { nome: 'Ana', cor: 'roxo', resumo: 'veja ana.com.br' },
    { nome: 'Ana', cor: 'roxo', resumo: 'x'.repeat(161) },
    { nome: 'Ana', cor: 'roxo', resumo: 42 },
    { nome: 'Ana', cor: 'roxo', interesses: ['idiomas', 'idiomas'] },
    { nome: 'Ana', cor: 'roxo', interesses: TEMAS.slice(0, 6) },
    { nome: 'Ana', cor: 'roxo', interesses: ['astrologia'] },
  ]) assert.equal((await salvar(ana, corpo)).status, 400, JSON.stringify(corpo).slice(0, 60));
  await salvar(ana, { nome: 'Ana', cor: 'roxo', resumo: 'Cozinho e ensino frações.', interesses: ['matematica', 'culinaria'] });

  const { link } = await trilhaCompartilhada(ana);
  const bia = await pessoa();
  await json(adicionarPost(pedido(`/api/compartilhar/${link.codigo}/adicionar`, { metodo: 'POST', token: bia.token, corpo: {} }), ctx({ codigo: link.codigo })));
  // O alcance da dona é o mesmo da página pública: trilhas fora do perfil (só com o link) não entram.
  await trilhaCompartilhada(ana);
  r = await json(perfilGet(pedido('/api/perfil', { token: ana.token })));
  assert.deepEqual(r.corpo.alcance, { trilhas: 0, pessoas: 0 });
  assert.equal(r.corpo.links.length, 2, 'o total vai no título da lista');

  const previa = await json(linkGet(pedido(`/api/compartilhar/${link.codigo}`), ctx({ codigo: link.codigo })));
  assert.equal(previa.corpo.dono.resumo, 'Cozinho e ensino frações.');
  assert.equal(previa.corpo.dono.foto, null);

  await json(linkPatch(pedido(`/api/compartilhar/${link.codigo}`, { metodo: 'PATCH', token: ana.token, corpo: { noPerfil: true } }), ctx({ codigo: link.codigo })));
  const publico = await json(perfisGet(pedido(`/api/perfis/${r.corpo.perfilId}`), ctx({ perfilId: r.corpo.perfilId })));
  assert.equal(publico.status, 200);
  assert.equal(publico.corpo.resumo, 'Cozinho e ensino frações.');
  assert.deepEqual(publico.corpo.interesses, ['matematica', 'culinaria']);
  assert.deepEqual(publico.corpo.alcance, { trilhas: 1, pessoas: 1 });
  assert.deepEqual((await json(perfilGet(pedido('/api/perfil', { token: ana.token })))).corpo.alcance, publico.corpo.alcance, 'cartão da dona = página pública');
  assert.ok(!JSON.stringify(publico.corpo).includes(ana.email));
});

test('foto: confere pelos bytes, recusa o que não é JPEG, PNG ou WebP, base64 torto, mais de 2 MB e pixels demais', async () => {
  const ana = await pessoa();
  await salvar(ana, { nome: 'Ana', cor: 'azul' });
  assert.equal(tipoDaImagem(await fotoTeste()), 'jpeg');
  assert.equal(tipoDaImagem(await fotoTeste({ formato: 'png' })), 'png');
  assert.equal(tipoDaImagem(await fotoTeste({ formato: 'webp' })), 'webp');
  const gif = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } }).gif().toBuffer();
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><script>alert(1)</script></svg>');
  const jpegQuebrado = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7)]);
  for (const [nome, bytes] of [['gif', gif], ['svg', svg], ['jpeg quebrado', jpegQuebrado], ['texto', Buffer.from('oi')]]) {
    const r = await enviarFoto(ana, bytes);
    assert.equal(r.status, 422, nome);
    assert.equal(r.corpo.codigo, 'foto_invalida', nome);
  }
  // Base64 que não volta igual (espaços, caracteres extras).
  const torto = await json(fotoPut(pedido('/api/perfil/foto', { metodo: 'PUT', token: ana.token, corpo: { base64: ` ${(await fotoTeste()).toString('base64')}` } })));
  assert.equal(torto.corpo.codigo, 'foto_invalida');
  // Mais de 2 MB (cabeçalho JPEG válido na frente).
  const grande = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(LIMITES_FOTO.bytes, 1)]);
  const r = await json(fotoPut(pedido('/api/perfil/foto', { metodo: 'PUT', token: ana.token, corpo: { base64: grande.toString('base64') } })));
  assert.ok([400, 422].includes(r.status));
  // Bomba de pixels: PNG pequeno em bytes com 49 milhões de pixels.
  const bomba = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: '#fff' } }).png({ compressionLevel: 9 }).toBuffer();
  assert.ok(bomba.length < LIMITES_FOTO.bytes);
  assert.equal((await enviarFoto(ana, bomba)).corpo.codigo, 'foto_invalida');
  assert.equal((await json(perfilGet(pedido('/api/perfil', { token: ana.token })))).corpo.foto, null);
});

test('foto: orientação corrigida, corte em 512 e 128, WebP sem EXIF nem GPS, cabeçalhos de cache privado e fora de buscadores', async () => {
  const ana = await pessoa();
  await salvar(ana, { nome: 'Ana', cor: 'azul' });
  const original = await fotoTeste({ orientacao: 6 });
  assert.ok(original.includes('segredo-exif-copyright'));
  const r = await enviarFoto(ana, original);
  assert.equal(r.status, 200);
  assert.match(r.corpo.foto, /^[A-Za-z0-9_-]{16}$/);
  assert.equal((await lerFoto(r.corpo.foto, 512)).status, 404);
  const resposta = await lerFoto(r.corpo.foto, 512, ana.token);
  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get('content-type'), 'image/webp');
  assert.equal(resposta.headers.get('cache-control'), 'private, no-store');
  assert.equal(resposta.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(resposta.headers.get('x-content-type-options'), 'nosniff');
  const grande = Buffer.from(await resposta.arrayBuffer());
  const meta = await sharp(grande).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 512);
  assert.equal(meta.height, 512);
  assert.equal(meta.exif, undefined);
  assert.equal(meta.orientation, undefined);
  for (const segredo of ['segredo-exif', 'GPS', 'Exif']) assert.ok(!grande.includes(segredo), segredo);
  // Girada: o vermelho (esquerda do arquivo) fica em cima, o azul embaixo.
  const { data } = await sharp(grande).raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [...data.subarray((y * 512 + x) * 3, (y * 512 + x) * 3 + 3)];
  assert.ok(pixel(256, 20)[0] > 200 && pixel(256, 20)[2] < 60, `cima ${pixel(256, 20)}`);
  assert.ok(pixel(256, 490)[2] > 200 && pixel(256, 490)[0] < 60, `baixo ${pixel(256, 490)}`);
  const pequena = await sharp(Buffer.from(await (await lerFoto(r.corpo.foto, 128, ana.token)).arrayBuffer())).metadata();
  assert.equal(pequena.width, 128);
  assert.equal(pequena.format, 'webp');
  // Tamanho fora da lista, token fora do formato ou inexistente: não encontrado.
  assert.equal((await lerFoto(r.corpo.foto, 256)).status, 404);
  assert.equal((await lerFoto('AAAAAAAAAAAAAAAA')).status, 404);
  assert.equal((await fotoGet(new Request(`${origem}/api/fotos/x/512`), ctx({ token: '../x', tamanho: '512' }))).status, 404);
  // PNG e WebP também entram.
  assert.equal((await enviarFoto(ana, await fotoTeste({ formato: 'png' }))).status, 200);
  assert.equal((await enviarFoto(ana, await fotoTeste({ formato: 'webp' }))).status, 200);
});

test('foto: token novo a cada troca (o antigo some), remover volta à inicial, e a foto aparece no /t e no "Compartilhada por"', async () => {
  const ana = await pessoa();
  await salvar(ana, { nome: 'Ana', cor: 'azul' });
  const primeira = (await enviarFoto(ana, await fotoTeste())).corpo.foto;
  const segunda = (await enviarFoto(ana, await fotoTeste({ formato: 'png' }))).corpo.foto;
  assert.notEqual(primeira, segunda);
  assert.equal((await lerFoto(primeira)).status, 404);
  assert.equal((await lerFoto(segunda)).status, 404);
  await banco.fotoPerfil.update({ where: { token: segunda }, data: { moderacao: 'aprovado' } });
  const perfil = (await json(perfilGet(pedido('/api/perfil', { token: ana.token })))).corpo;
  assert.ok(!segunda.includes(perfil.perfilId) && !perfil.perfilId.includes(segunda));

  const { link } = await trilhaCompartilhada(ana);
  const previa = await json(linkGet(pedido(`/api/compartilhar/${link.codigo}`), ctx({ codigo: link.codigo })));
  assert.equal(previa.corpo.dono.foto, segunda);
  const bia = await pessoa();
  await json(adicionarPost(pedido(`/api/compartilhar/${link.codigo}/adicionar`, { metodo: 'POST', token: bia.token, corpo: {} }), ctx({ codigo: link.codigo })));
  let lista = (await json(planosGet(pedido('/api/aprendizado/planos', { token: bia.token })))).corpo;
  assert.equal(lista.find((plano) => plano.recebida)?.recebida.foto, segunda);

  const removida = await json(fotoDelete(pedido('/api/perfil/foto', { metodo: 'DELETE', token: ana.token })));
  assert.equal(removida.status, 200);
  assert.equal(removida.corpo.foto, null);
  assert.equal((await lerFoto(segunda)).status, 404);
  lista = (await json(planosGet(pedido('/api/aprendizado/planos', { token: bia.token })))).corpo;
  assert.equal(lista.find((plano) => plano.recebida)?.recebida.foto, null);
  assert.equal((await json(linkGet(pedido(`/api/compartilhar/${link.codigo}`), ctx({ codigo: link.codigo })))).corpo.dono.foto, null);
});

test('foto: 10 trocas por hora; visitante não tem foto; sem a flag a rota não existe', async () => {
  const ana = await pessoa();
  await salvar(ana, { nome: 'Ana', cor: 'azul' });
  const bytes = await fotoTeste({ largura: 64, altura: 64 });
  for (let i = 0; i < LIMITES_FOTO.trocasPorHora; i++) assert.equal((await enviarFoto(ana, bytes)).status, 200, `troca ${i + 1}`);
  const excesso = await enviarFoto(ana, bytes);
  assert.equal(excesso.status, 429);
  assert.equal(excesso.corpo.codigo, 'limite_foto');
  // Remover não conta no limite.
  assert.equal((await json(fotoDelete(pedido('/api/perfil/foto', { metodo: 'DELETE', token: ana.token })))).status, 200);

  const visitante = await pessoa(`${PREFIXO_EMAIL_VISITANTE}${Date.now()}-${randomUUID().slice(0, 12)}${DOMINIO_EMAIL_VISITANTE}`);
  assert.equal((await enviarFoto(visitante, bytes)).corpo.codigo, 'compartilhar_visitante');

  delete process.env.STUDOO_COMPARTILHAR;
  try {
    assert.equal((await enviarFoto(ana, bytes)).status, 404);
    assert.equal((await lerFoto('AAAAAAAAAAAAAAAA')).status, 404);
  } finally {
    process.env.STUDOO_COMPARTILHAR = '1';
  }
});
