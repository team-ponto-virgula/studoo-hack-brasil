// Refinamento da UI (spec 16), lote 3, P2, item 28: "Escolher arquivo" e "Usar a câmera" eram tracejados (o desenho de área de soltar arquivo, que não existe no celular e parece rascunho).
// Até 767 px viram botões secundários comuns; a área tracejada fica só na web a partir de 768 px.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mensagens } from '@studoo/contratos/experiencia';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');

test('item 28: os dois seletores de arquivo usam as classes do botão secundário, com o campo de arquivo por cima (continua o seletor do sistema)', () => {
  assert.equal(mensagens.inicio.arquivo, 'Escolher arquivo');
  assert.equal(mensagens.inicio.camera, 'Usar a câmera');
  const fonte = ler('src/app/estudio.tsx');
  assert.equal((fonte.match(/<label className="estudio-arquivo botao botao--secundario">/g) ?? []).length, 2, 'os dois: arquivo e câmera');
  assert.doesNotMatch(fonte, /<label className="estudio-arquivo">/, 'nenhum ficou só com a classe do tracejado');
  assert.match(fonte, /\{mensagens\.inicio\.arquivo\}\s*<input\s+type="file"/);
  assert.match(fonte, /\{mensagens\.inicio\.camera\}\s*<input\s+type="file"[^>]*capture="environment"/);
});

test('item 28: o tracejado só existe a partir de 768 px; até 767 px o seletor é o botão secundário de sempre (borda sólida, relevo)', () => {
  const css = ler('src/app/estudio.css');
  const inicio = css.indexOf('.estudio-arquivo { position: relative; }');
  assert.ok(inicio > 0, 'a base comum: só o posicionamento do campo de arquivo');
  const fim = css.indexOf('.estudio-arquivo:focus-within', inicio);
  const bloco = css.slice(inicio, fim);
  assert.equal((bloco.match(/dashed/g) ?? []).length, 1, 'um único tracejado');
  const media = /@media \(min-width: 768px\) \{\s*\.estudio-arquivo\.botao \{([^}]*)\}\s*\}/.exec(bloco);
  assert.ok(media, 'o tracejado está dentro da consulta de 768 px, com a especificidade para ganhar do botão secundário');
  assert.match(media[1], /border: 2px dashed var\(--acao\);/);
  assert.match(media[1], /border-radius: 14px;/);
  assert.match(media[1], /box-shadow: none;/, 'sem o relevo do botão na área de soltar');
  // Fora da consulta (o celular), nada do tracejado: o resto do bloco é só `position: relative`.
  const foraDaMedia = bloco.replace(media[0], '');
  assert.doesNotMatch(foraDaMedia, /dashed|border-radius/);
  // O campo de arquivo transparente por cima e o anel de foco seguem em todas as larguras.
  assert.match(css, /\.estudio-arquivo input \{\s*position: absolute;\s*inset: 0;\s*opacity: 0;\s*width: 100%;\s*cursor: pointer;\s*\}/);
  assert.match(css, /\.estudio-arquivo:focus-within \{\s*outline: 3px solid var\(--acao\);/);
  // O botão secundário de verdade (borda sólida no gelo e relevo) é o de globals.css.
  assert.match(ler('src/app/globals.css'), /\.botao--secundario \{ --labio: var\(--gelo\); border-color: var\(--gelo\); \}/);
});
