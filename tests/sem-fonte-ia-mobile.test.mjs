import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

// Spec 08 (c20ed0f; pedido do dono de 20/11, "Nao quero que mostre nunca a fonte, ia deepseek"): o provedor e o modelo
// de IA nunca aparecem como fonte, em tela nenhuma do app; só as telas de privacidade dizem a quem o dado vai.

const raiz = new URL('../', import.meta.url);
const pasta = new URL('apps/mobile/src/', raiz);
const PROVEDOR = /deepseek|openai|gpt-|flash/i;
// As telas de privacidade (Apple 5.1.2(i)): o aviso do material, a voz e a conversa por voz.
const PRIVACIDADE = /rivacidade|vozProvedor/;

test('nenhum texto do contrato cita provedor ou modelo fora das telas de privacidade', () => {
  const fora = [];
  const andar = (valor, caminho) => {
    if (typeof valor === 'string') { if (PROVEDOR.test(valor) && !PRIVACIDADE.test(caminho)) fora.push(caminho); return; }
    if (typeof valor === 'function') {
      for (const argumento of ['x', 'openai', 'deepseek', 'falsa']) {
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
