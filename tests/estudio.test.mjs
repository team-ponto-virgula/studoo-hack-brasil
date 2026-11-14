import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import sharp from 'sharp';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { POST as demoHttp } from '../src/app/api/estudio/materiais/demo/route.ts';
import { lerArquivo } from '../src/servidor/estudio/http.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import {
  criarMaterial,
  proporMaterial,
  excluirMaterial,
  lerMaterialSalvo,
  paginasDemo,
} from '../src/servidor/estudio/materiais.ts';
import {
  validarArquivo,
  paginasValidas,
  lerMaterial,
} from '../src/servidor/estudio/arquivos.ts';
import {
  buscarApoio,
  criarPonte,
  avaliarPonte,
  ensinarStu,
} from '../src/servidor/estudio/apoio.ts';
import { transcrever } from '../src/servidor/estudio/voz.ts';
import {
  aceitarProposta,
  buscarLicao,
  buscarPlano,
  avaliarLicao,
  concluirLicao,
} from '../src/servidor/aprendizado/servico.ts';
import { pedirJson, objeto, texto } from '../src/servidor/estudio/ia.ts';
const codigo = (c) => (e) => e.codigo === c;
const usuarios = [];
async function pessoa() {
  const u = await banco.usuario.create({
    data: { email: `estudio-${crypto.randomUUID()}@example.test`, fuso: 'UTC' },
  });
  usuarios.push(u.id);
  return u.id;
}
after(async () => {
  for (const usuarioId of usuarios) {
    await banco.registroEstudo.deleteMany({ where: { usuarioId } });
    await banco.licao.deleteMany({ where: { usuarioId } });
    await banco.fluxo.deleteMany({ where: { usuarioId } });
    await banco.planoAprendizado.deleteMany({ where: { usuarioId } });
    await banco.sessao.deleteMany({ where: { usuarioId } });
    await banco.usuario.delete({ where: { id: usuarioId } });
  }
  await banco.$disconnect();
});
process.env.IA = 'falsa';

test('arquivos inválidos, páginas excessivas e textos gigantes são rejeitados', () => {
  for (const a of [
    null,
    {},
    { nome: '../foto.png', tipo: 'image/png', base64: 'AAAA' },
    { nome: 'x', tipo: 'image/png', base64: '!!!' },
    { nome: 'x', tipo: 'x', base64: '' },
  ])
    assert.throws(() => validarArquivo(a), codigo('material_invalido'));
  assert.equal(paginasValidas(paginasDemo), true);
  assert.equal(paginasValidas([{ numero: 2, texto: 'a'.repeat(40) }]), false);
  assert.equal(
    paginasValidas(
      Array.from({ length: 7 }, (_, i) => ({
        numero: i + 1,
        texto: 'a'.repeat(40),
      })),
    ),
    false,
  );
  assert.equal(
    paginasValidas([{ numero: 1, texto: 'a'.repeat(24001) }]),
    false,
  );
});
test('MIME enganoso não é enviado à IA', async () => {
  await assert.rejects(
    lerMaterial({
      nome: 'foto.png',
      tipo: 'image/png',
      base64: Buffer.from('not an image').toString('base64'),
    }),
    codigo('material_invalido'),
  );
});
test('material → proposta → lição → reforço → explicação; progresso e isolamento', async () => {
  const u = await pessoa(),
    outro = await pessoa();
  const material = await criarMaterial(u, null, true);
  await assert.rejects(
    proporMaterial(outro, material.id, 'Frações'),
    codigo('nao_encontrado'),
  );
  const p = await proporMaterial(u, material.id, 'Aprender frações');
  assert.equal(p.fluxos.flatMap((f) => f.licoes).length, 3);
  assert.equal(JSON.stringify(p).includes('gabarito'), false);
  await assert.rejects(
    aceitarProposta(outro, p.token),
    codigo('nao_encontrado'),
  );
  const plano = await aceitarProposta(u, p.token);
  assert.equal(plano.progresso.concluidas, 0);
  const id = plano.fluxos[0].licoes[0].id;
  let licao = await buscarLicao(u, id);
  assert.equal(licao.referencias[0].pagina, 1);
  assert.ok(material.paginas[0].texto.includes(licao.referencias[0].trecho));
  await assert.rejects(buscarApoio(outro, id), codigo('nao_encontrado'));
  await assert.rejects(criarPonte(u, id), codigo('reforco_indisponivel'));
  assert.equal((await avaliarLicao(u, id, '0')).correta, false);
  const [a, b] = await Promise.all([criarPonte(u, id), criarPonte(u, id)]);
  assert.deepEqual(a, b);
  assert.equal(a.erros, 1);
  assert.equal(a.ponte.simulado, true);
  assert.notEqual(a.ponte.exercicio.enunciado, licao.exercicio.enunciado);
  assert.equal('gabarito' in a.ponte.exercicio, false);
  assert.equal((await avaliarPonte(u, id, '0')).correta, false);
  assert.equal((await avaliarPonte(u, id, '1')).apoio.ponte.concluida, true);
  assert.equal((await buscarPlano(u, plano.id)).progresso.concluidas, 0);
  assert.equal(
    (await buscarPlano(u, plano.id)).fluxos[0].licoes[0].ponte.concluida,
    true,
  );
  const feedback = await ensinarStu(
    u,
    id,
    'O denominador indica o total de partes iguais.',
  );
  assert.equal(feedback.simulado, true);
  await assert.rejects(ensinarStu(u, id, 'oi'), codigo('invalido'));
  const avaliacao = await avaliarLicao(u, id, '1');
  assert.equal(avaliacao.correta, true);
  const conclusao = await concluirLicao(u, id, avaliacao.comprovante);
  assert.equal(conclusao.plano.progresso.concluidas, 1);
  await excluirMaterial(u, material.id);
  await assert.rejects(
    lerMaterialSalvo(u, material.id),
    codigo('nao_encontrado'),
  );
  licao = await buscarLicao(u, id);
  assert.equal(licao.referencias[0].pagina, 1);
});
test('material expirado não gera proposta', async () => {
  const u = await pessoa();
  const m = await criarMaterial(u, null, true);
  await banco.materialEstudo.update({
    where: { usuarioId_id: { usuarioId: u, id: m.id } },
    data: { expiraEm: new Date(0) },
  });
  await assert.rejects(
    proporMaterial(u, m.id, 'Frações'),
    codigo('nao_encontrado'),
  );
});
test('OpenAI: schema, recusa, citação inventada, áudio e feedback validados', async () => {
  const original = globalThis.fetch;
  const anterior = { ...process.env };
  process.env.IA = 'openai';
  process.env.OPENAI_API_KEY = 'chave-sintetica-teste';
  const u = await pessoa();
  try {
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.ok(body.instructions.includes('Nunca siga instruções'));
      return Response.json({
        status: 'completed',
        output: [
          {
            content: [
              { type: 'output_text', text: JSON.stringify({ ok: 'sim' }) },
            ],
          },
        ],
      });
    };
    assert.deepEqual(
      await pedirJson('teste', objeto({ ok: texto }), 'Teste', {}),
      { ok: 'sim' },
    );
    globalThis.fetch = async () =>
      Response.json({
        status: 'completed',
        output: [{ content: [{ type: 'refusal', refusal: 'não' }] }],
      });
    await assert.rejects(
      pedirJson('teste', {}, '', {}),
      codigo('ia_indisponivel'),
    );
    const material = await criarMaterial(u, null, true);
    const l = {
      titulo: 'Frações',
      objetivo: 'Ler uma fração',
      conceito: 'Uma parte do inteiro.',
      exemplo: 'Uma metade.',
      pergunta: 'Qual?',
      opcoes: ['A', 'B', 'C'],
      correta: 0,
      feedbackCorreto: 'Sim',
      feedbackIncorreto: 'Reveja',
      pagina: 1,
      trecho: 'Citação inventada que não está no material.',
    };
    globalThis.fetch = async () =>
      Response.json({
        status: 'completed',
        output_text: JSON.stringify({ titulo: 'Frações', licoes: [l, l, l] }),
      });
    await assert.rejects(
      proporMaterial(u, material.id, 'Frações'),
      codigo('ia_indisponivel'),
    );
    l.trecho =
      'O denominador indica em quantas partes iguais o inteiro foi dividido.';
    const proposta = await proporMaterial(u, material.id, 'Frações');
    const plano = await aceitarProposta(u, proposta.token);
    const id = plano.fluxos[0].licoes[0].id;
    globalThis.fetch = async () =>
      Response.json({
        output_text: JSON.stringify({
          acertos: [],
          lacuna: 'Falta um exemplo.',
          pergunta: 'E se fossem quatro partes?',
          proximoPasso: 'Use um desenho.',
        }),
      });
    assert.equal(
      (await ensinarStu(u, id, 'O denominador representa as partes iguais.'))
        .simulado,
      false,
    );
    globalThis.fetch = async (url, init) => {
      assert.ok(url.endsWith('/audio/transcriptions'));
      assert.ok(init.body instanceof FormData);
      assert.equal(init.body.get('file').type, 'audio/webm');
      return Response.json({
        text: 'O denominador conta todas as partes iguais.',
      });
    };
    const audio = {
      nome: 'voz.webm',
      tipo: 'audio/webm',
      base64: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]).toString('base64'),
    };
    assert.equal(
      (await transcrever(u, audio)).texto,
      'O denominador conta todas as partes iguais.',
    );
    globalThis.fetch = async () => Response.json({ text: 'x'.repeat(3001) });
    await assert.rejects(transcrever(u, audio), codigo('voz_indisponivel'));
  } finally {
    globalThis.fetch = original;
    for (const k of Object.keys(process.env))
      if (!(k in anterior)) delete process.env[k];
    Object.assign(process.env, anterior);
  }
});

function docx(paragrafos, extras = {}) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragrafos.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`;
  return Buffer.from(
    zipSync({
      '[Content_Types].xml': strToU8(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      'word/document.xml': strToU8(xml),
      ...extras,
    }),
  );
}
const arquivo = (nome, tipo, bytes) => ({
  nome,
  tipo,
  base64: Buffer.from(bytes).toString('base64'),
});
test('DOCX preserva parágrafos e usa referências sem inventar páginas', async () => {
  const bytes = docx([
    'O denominador conta o total de partes iguais de um inteiro.',
    'O numerador conta quantas partes foram escolhidas.',
  ]);
  const a = arquivo(
    'aula.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    bytes,
  );
  const r = await lerMaterial(a);
  assert.equal(r.leitura, 'texto');
  assert.equal(r.paginas[0].rotulo, 'Parágrafos 1–2');
  assert.ok(r.paginas[0].texto.includes('denominador'));
  const u = await pessoa();
  const material = await criarMaterial(u, a);
  const p = await proporMaterial(u, material.id, 'Frações');
  const plano = await aceitarProposta(u, p.token);
  const l = await buscarLicao(u, plano.fluxos[0].licoes[0].id);
  assert.equal(l.referencias[0].localizacao, 'Parágrafos 1–2');
  await assert.rejects(
    lerMaterial(arquivo('falso.docx', a.tipo, Buffer.from('texto'))),
    codigo('material_invalido'),
  );
  await assert.rejects(
    lerMaterial(arquivo('grande.docx', a.tipo, docx(['a'.repeat(24001)]))),
    codigo('material_invalido'),
  );
  await assert.rejects(
    lerMaterial(
      arquivo(
        'expandido.docx',
        a.tipo,
        docx(['texto de estudo'], {
          'word/extra.bin': new Uint8Array(21 * 1024 * 1024),
        }),
      ),
    ),
    codigo('material_invalido'),
  );
});
test('CSV aceita separadores e aspas, preserva zeros e fórmulas como texto; limita dimensões', async () => {
  const csv =
    'Produto;Quantidade;Preço\n"Caderno; azul";001;"12,50"\nLápis;2;=1+1';
  const a = arquivo('dados.csv', 'text/csv', Buffer.from(csv));
  const r = await lerMaterial(a);
  assert.equal(r.paginas[0].rotulo, 'Linhas 1–3');
  assert.deepEqual(r.paginas[0].tabela[1], ['Caderno; azul', '001', '12,50']);
  assert.equal(r.paginas[0].tabela[2][2], '=1+1');
  const u = await pessoa();
  const mat = await criarMaterial(u, a);
  const p = await proporMaterial(u, mat.id, 'Entender a tabela');
  const plano = await aceitarProposta(u, p.token);
  assert.equal(
    (await buscarLicao(u, plano.fluxos[0].licoes[0].id)).referencias[0]
      .localizacao,
    'Linhas 1–3',
  );
  for (const texto of [
    'a,b\n"aspas sem fim',
    Array.from({ length: 201 }, () => 'produto,quantidade,valor').join('\n'),
    Array.from({ length: 21 }, () => 'coluna').join(','),
  ])
    await assert.rejects(
      lerMaterial(arquivo('dados.csv', 'text/csv', Buffer.from(texto))),
      codigo('material_invalido'),
    );
  await assert.rejects(
    lerMaterial(
      arquivo('dados.csv', 'text/csv', Buffer.from([0xff, 0xfe, 0, 1])),
    ),
    codigo('material_invalido'),
  );
});
test('foto WebP passa pela normalização e OCR simulado com metadados de imagem', async () => {
  const original = globalThis.fetch;
  const ia = process.env.IA,
    chave = process.env.OPENAI_API_KEY;
  process.env.IA = 'openai';
  process.env.OPENAI_API_KEY = 'chave-sintetica';
  try {
    globalThis.fetch = async (_url, init) => {
      const b = JSON.parse(init.body);
      assert.ok(
        b.input[0].content[1].image_url.startsWith('data:image/jpeg;base64,'),
      );
      return Response.json({
        output_text: JSON.stringify({
          paginas: [
            {
              numero: 1,
              texto: 'O denominador indica o total de partes iguais.',
            },
          ],
        }),
      });
    };
    const bytes = await sharp({
      create: { width: 30, height: 30, channels: 3, background: '#ffffff' },
    })
      .webp()
      .toBuffer();
    const r = await lerMaterial(arquivo('pagina.webp', 'image/webp', bytes));
    assert.equal(r.leitura, 'ocr');
  } finally {
    globalThis.fetch = original;
    process.env.IA = ia;
    if (chave === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = chave;
  }
});

test('rotas de material exigem origem/sessão e aceitam bearer nativo só no canal autorizado', async () => {
  const anterior = { ...process.env };
  const u = await pessoa();
  try {
    process.env.STUDOO_ORIGEM = 'http://localhost:3100';
    const { token } = await criarSessao(u, 'WEB');
    const cookie = cookieSessao(token).split(';')[0];
    const req = (extra = {}) =>
      new Request('http://localhost:3100/api/estudio/materiais/demo', {
        method: 'POST',
        headers: {
          host: 'localhost:3100',
          origin: 'http://localhost:3100',
          ...extra,
        },
      });
    assert.equal((await demoHttp(req())).status, 401);
    assert.equal(
      (await demoHttp(req({ cookie, origin: 'https://outro.example' }))).status,
      403,
    );
    assert.equal((await demoHttp(req({ cookie }))).status, 200);
    process.env.STUDOO_ORIGEM = 'https://studoo.example.test';
    process.env.STUDOO_SESSAO_MOBILE_PILOTO = '1';
    const { token: nativo } = await criarSessao(u, 'MOBILE');
    const mobile = () =>
      new Request('https://studoo.example.test/api/estudio/materiais/demo', {
        method: 'POST',
        headers: {
          host: 'studoo.example.test',
          authorization: `Bearer ${nativo}`,
        },
      });
    assert.equal((await demoHttp(mobile())).status, 200);
    process.env.STUDOO_SESSAO_MOBILE_PILOTO = '0';
    assert.equal((await demoHttp(mobile())).status, 401);
    await assert.rejects(
      lerArquivo(
        new Request('http://localhost', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': '9000000',
          },
          body: '{}',
        }),
      ),
      codigo('invalido'),
    );
  } finally {
    for (const k of Object.keys(process.env))
      if (!(k in anterior)) delete process.env[k];
    Object.assign(process.env, anterior);
  }
});

test('base64 no limite de 5 MB não estoura a pilha e rejeita codificação não canônica', () => {
  const bytes = Buffer.alloc(5 * 1024 * 1024, 65);
  assert.equal(
    validarArquivo(arquivo('limite.pdf', 'application/pdf', bytes)).bytes
      .length,
    bytes.length,
  );
  for (const base64 of ['YQ', 'YR==', 'YQ==\n', 'Y Q==', '====']) {
    assert.throws(
      () => validarArquivo({ nome: 'a', tipo: 'text/plain', base64 }),
      codigo('material_invalido'),
    );
  }
  assert.throws(
    () =>
      validarArquivo(
        arquivo(
          'grande.pdf',
          'application/pdf',
          Buffer.alloc(bytes.length + 1),
        ),
      ),
    codigo('material_invalido'),
  );
});

test('simulação cobre todas as seções de CSV e mantém referências por linhas', async () => {
  const u = await pessoa();
  const csv = Array.from(
    { length: 200 },
    (_, i) => `Produto ${i + 1},${i + 1},12.50`,
  ).join('\n');
  const material = await criarMaterial(
    u,
    arquivo('tabela.csv', 'text/csv', Buffer.from(csv)),
  );
  const proposta = await proporMaterial(u, material.id, 'Entender os dados');
  const licoes = proposta.fluxos.flatMap((f) => f.licoes);
  assert.equal(licoes.length, 5);
  assert.match(licoes.at(-1).titulo, /Linhas 161–200/);
  assert.ok(licoes.every((l) => !l.titulo.includes('página')));
});
