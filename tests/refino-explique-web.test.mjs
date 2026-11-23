// Refinamento da UI (spec 16), lote 3, o "Explique com suas palavras" na web. Item 24: com o "Explique" aberto, o rodapé do acerto vira UMA linha de 64 px (o visto e o título à esquerda, "Continuar" à direita,
// no mesmo verde claro), sem o texto do retorno. Item 25: os três passos do "Explique" (antes pílulas com borda, que pareciam filtros) viram uma linha só de indicador, como a da ponte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mensagens } from '@studoo/contratos/experiencia';
import { linhaDoPassoDoEnsino, nomeDaEtapaDoEnsino, passoAtivoDoEnsino } from '../src/app/ensino-passos.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const m = mensagens.estudio;

test('item 25: o nome do passo sai sem o número da lista antiga, e o "Passo n de 3" é o da ponte', () => {
  assert.deepEqual(m.ensinoEtapas.map(nomeDaEtapaDoEnsino), ['Gravar ou escrever', 'Revisar texto', 'Ver retorno do Stu']);
  assert.equal(nomeDaEtapaDoEnsino(m.vozAoVivo.passoComVoz), 'Conversar, gravar ou escrever');
  assert.equal(nomeDaEtapaDoEnsino('Sem número'), 'Sem número');
  assert.equal(m.ponteIndicador(1), 'Passo 1 de 3');
  assert.equal(m.ponteIndicador(3), 'Passo 3 de 3');
});

test('item 25: o passo ativo é o 1º enquanto grava ou conversa, o 3º com o retorno do Stu, o 2º com texto para revisar e o 1º sem texto (a conta do app)', () => {
  const ativo = (extra) => passoAtivoDoEnsino({ gravando: false, vozAtiva: false, temRetorno: false, temTexto: false, ...extra });
  assert.equal(ativo({}), 0, 'sem texto');
  assert.equal(ativo({ temTexto: true }), 1, 'com texto para revisar');
  assert.equal(ativo({ temTexto: true, temRetorno: true }), 2, 'com o retorno do Stu');
  assert.equal(ativo({ temRetorno: true }), 2);
  assert.equal(ativo({ gravando: true, temTexto: true }), 0, 'gravando: o 1º');
  assert.equal(ativo({ vozAtiva: true, temTexto: true, temRetorno: true }), 0, 'conversando ao vivo: o 1º, mesmo com o retorno de antes na tela');
  assert.equal(ativo({ gravando: true, temRetorno: true }), 0);
});

test('item 25: a linha mostra "Passo 1 de 3 · Gravar ou escrever" e o leitor de tela ouve "Passo 1 de 3: Gravar ou escrever"', () => {
  const etapas = [m.ensinoEtapas[0], m.ensinoEtapas[1], m.ensinoEtapas[2]];
  assert.deepEqual(linhaDoPassoDoEnsino(0, etapas, m.ponteIndicador), { visivel: 'Passo 1 de 3 · Gravar ou escrever', leitor: 'Passo 1 de 3: Gravar ou escrever' });
  assert.deepEqual(linhaDoPassoDoEnsino(1, etapas, m.ponteIndicador), { visivel: 'Passo 2 de 3 · Revisar texto', leitor: 'Passo 2 de 3: Revisar texto' });
  assert.deepEqual(linhaDoPassoDoEnsino(2, etapas, m.ponteIndicador), { visivel: 'Passo 3 de 3 · Ver retorno do Stu', leitor: 'Passo 3 de 3: Ver retorno do Stu' });
  const comVoz = [m.vozAoVivo.passoComVoz, m.ensinoEtapas[1], m.ensinoEtapas[2]];
  assert.equal(linhaDoPassoDoEnsino(0, comVoz, m.ponteIndicador).visivel, 'Passo 1 de 3 · Conversar, gravar ou escrever', 'com a voz ao vivo liberada, a 1ª etapa muda de nome');
});

test('item 25: a web desenha uma linha só (não tocável), com a conta do app, e as pílulas com borda saíram do código e do CSS', () => {
  const fonte = ler('src/app/estudio.tsx');
  assert.match(fonte, /import \{ linhaDoPassoDoEnsino, passoAtivoDoEnsino \} from '\.\/ensino-passos';/);
  assert.match(fonte, /passoAtivoDoEnsino\(\{ gravando, vozAtiva: etapaVoz === 'ativa', temRetorno: Boolean\(ensino\), temTexto: Boolean\(texto\.trim\(\)\) \}\)/);
  assert.match(fonte, /\[vozAoVivoDisponivel \? m\.vozAoVivo\.passoComVoz : m\.ensinoEtapas\[0\], m\.ensinoEtapas\[1\], m\.ensinoEtapas\[2\]\],\s*m\.ponteIndicador,/);
  const linha = /<p className="ensino-indicador">([\s\S]*?)<\/p>/.exec(fonte)?.[1] ?? '';
  assert.match(linha, /<span aria-hidden="true">\{passoDoEnsino\.visivel\}<\/span>\s*<span className="somente-leitor">\{passoDoEnsino\.leitor\}<\/span>/, 'o que se vê é escondido do leitor, que ouve a versão com ":"');
  assert.doesNotMatch(linha, /<button|<a |tabIndex|onClick|role=/, 'a linha não é tocável nem focável nem região viva');
  assert.doesNotMatch(fonte, /className="ensino-passos"|<ol\b|ensinoEtapasLabel/, 'as três pílulas saíram');
  const css = ler('src/app/estudio.css');
  assert.match(css, /\.estudio-card \.ensino-indicador \{ margin: 0 0 12px; color: #5e6a85; font-size: 0\.875rem; font-weight: 800; line-height: 1\.4286; \}/, '14/20, 800, #5E6A85 (ganha de ".estudio-card p")');
  assert.doesNotMatch(css, /\.ensino-passos/, 'o CSS das pílulas saiu');
});

