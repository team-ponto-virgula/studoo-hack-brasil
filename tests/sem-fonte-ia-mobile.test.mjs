import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mensagens } from '../packages/contratos/src/experiencia.ts';
import { origemDemonstracao } from '../packages/contratos/src/licao.ts';

// Spec 08: a interface usa uma indicação genérica de IA. O provedor aparece no aviso de privacidade.

const raiz = new URL('../', import.meta.url);
const pasta = new URL('apps/mobile/src/', raiz);
const PROVEDOR = /openai|gpt-|provedor-legado|modelo-legado/i;
// As telas de privacidade (Apple 5.1.2(i)): o aviso do material, a voz e a conversa por voz.
const PRIVACIDADE = /rivacidade|vozProvedor/;

test('nenhum texto do contrato cita provedor ou modelo fora das telas de privacidade', () => {
  const fora = [];
  const andar = (valor, caminho) => {
    if (typeof valor === 'string') { if (PROVEDOR.test(valor) && !PRIVACIDADE.test(caminho)) fora.push(caminho); return; }
    if (typeof valor === 'function') {
      for (const argumento of ['x', 'openai', 'gpt-6-luna', 'provedor-legado', 'falsa']) {
        let texto; try { texto = valor(argumento, 1, 1); } catch { continue; }
        // Um texto que só repete o argumento (o nome passado) não é uma tela citando o provedor.
        if (typeof texto === 'string' && PROVEDOR.test(texto.replaceAll(argumento, '')) && !PRIVACIDADE.test(caminho)) { fora.push(`${caminho}()`); break; }
      }
      return;
    }
    if (valor && typeof valor === 'object') for (const [chave, filho] of Object.entries(valor)) andar(filho, `${caminho}.${chave}`);
  };
  andar(mensagens, 'mensagens');
  assert.deepEqual(fora, []);
});

test('origens históricas e atuais recebem a mesma indicação genérica na proposta', () => {
  for (const origem of ['IA de provedor-legado (modelo-legado)', 'IA da OpenAI (gpt-6-luna)']) {
    assert.equal(origemDemonstracao(origem), false);
  }
  assert.doesNotMatch(mensagens.geracao.ia, PROVEDOR);
  assert.equal(origemDemonstracao('Modo demonstração: conteúdo de exemplo'), true);
});

test('o app não desenha a origem gerada (lição, proposta, prévia de compartilhar e Explorar)', async () => {
  const arquivos = (await readdir(pasta)).filter((nome) => /\.tsx?$/.test(nome));
  const comOrigem = [];
  for (const nome of arquivos) {
    const fonte = await readFile(new URL(nome, pasta), 'utf8');
    if (/origemLegivel/.test(fonte)) comOrigem.push(nome);
  }
  assert.deepEqual(comOrigem, [], 'origemLegivel não aparece em apps/mobile/src');
  const licao = await readFile(new URL('licao.tsx', pasta), 'utf8');
  assert.doesNotMatch(licao, /\{t\.origem\} ·/, 'sem "Fonte · …" no balão "O Stu explica"');
  const estudo = await readFile(new URL('estudo.tsx', pasta), 'utf8');
  assert.doesNotMatch(estudo, /mensagens\.geracao\.origem\(/, 'sem "Fonte: …" na proposta');
  assert.match(estudo, /origemDemonstracao\(proposta\.origem\) \? mensagens\.geracao\.demonstracao : mensagens\.geracao\.ia/, '"Gerada por IA…" continua');
  for (const nome of ['social.tsx', 'comunidade.tsx']) {
    const fonte = await readFile(new URL(nome, pasta), 'utf8');
    assert.doesNotMatch(fonte, /totalLicoes\(trilha\.totalLicoes\)\} · /, `${nome}: "N lições" sem a origem`);
  }
  // Os marcadores [n] do material da própria pessoa continuam.
  assert.match(licao, /<CartaoFonte ref=\{cartaoCitacao\} referencia=\{licao\.referencias\[citacaoAberta\]\}/);
});
