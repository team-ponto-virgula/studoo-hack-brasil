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

// Spec 16, item 35 (web): com o material lido (a prévia), "Criar trilha deste material" é a ação presa da tela. Até 767 px ela fica 12 px acima da cápsula, com as margens da ilha (16), até 480 px
// de largura e sempre à vista; "Remover material" fica no fim do conteúdo, no fluxo; o fim da rolagem reserva a altura da ação mais 12; com o teclado aberto a ação volta ao fluxo. No tablet e
// no computador as ações principais seguem no fluxo da página (como a do próximo passo da trilha), e o botão fica ao lado de "Remover material" como era.
test('item 35: com o material lido, "Criar trilha deste material" é a ação presa (AcaoPrincipal medida) e "Remover material" vem depois dela, no fluxo', () => {
  assert.equal(mensagens.estudio.gerar, 'Criar trilha deste material');
  assert.equal(mensagens.estudio.remover, 'Remover material');
  const fonte = ler('src/app/estudio.tsx');
  assert.match(fonte, /import \{ AcaoPrincipal, Botao, Stu \} from '\.\.\/ui';/);
  assert.match(fonte, /import \{ medirAcaoFixa \} from '\.\.\/ui\/rodape-movel';/);
  const inicio = fonte.indexOf('<div className="estudio-acoes estudio-acoes--previa">');
  assert.ok(inicio > 0, 'a linha de ações da prévia tem a marca que a reserva do fim da rolagem usa');
  const previa = fonte.slice(inicio);
  const presa = /<AcaoPrincipal ref=\{medirAcaoFixa\}>([\s\S]*?)<\/AcaoPrincipal>/.exec(previa);
  assert.ok(presa, 'a ação presa da prévia, medida (a altura dela vira --altura-acao-fixa)');
  assert.match(presa[1], /\{m\.gerar\}/);
  assert.doesNotMatch(presa[1], /\{m\.remover\}/, '"Remover material" não vai junto na ação presa');
  assert.match(presa[1], /cliente\.proporMaterial\(\s*material\.id,\s*objetivo\.trim\(\) \|\| m\.objetivo,\s*\)/, 'o clique continua propondo a trilha do material');
  const depois = previa.slice(presa.index + presa[0].length);
  assert.match(depois, /^\s*<Botao\s+variante="texto"[\s\S]*?cliente\.excluirMaterial\(material\.id\)[\s\S]*?\{m\.remover\}/, '"Remover material" vem logo depois, no fluxo, como botão de texto');
  // Antes de escolher o material nada é preso: "Escolher arquivo", "Usar a câmera" e "Experimentar com frações" ficam na linha normal.
  const antes = fonte.slice(fonte.indexOf('{!material ? ('), inicio);
  const semMaterial = antes.slice(0, antes.indexOf(') : ('));
  assert.ok(semMaterial.length > 200, 'o trecho de antes de escolher foi achado');
  assert.doesNotMatch(semMaterial, /AcaoPrincipal/);
  assert.equal((fonte.match(/<AcaoPrincipal/g) ?? []).length, 1, 'uma única ação presa em todo o estúdio');
});

test('item 35: até 767 px a ação da prévia entra na reserva do fim da rolagem (altura + 12), que a tela Nova trilha soma aos 40 px de sempre; o teclado aberto zera a reserva', () => {
  const css = ler('src/app/globals.css');
  const reserva = /@media \(max-width: 767px\) \{\s*html:has\(\.estudo\[data-navegacao\] :is\(([^)]*)\)\) \{\s*--espaco-acao-fixa: calc\(var\(--altura-acao-fixa, 48px\) \+ 12px\);/.exec(css);
  assert.ok(reserva, 'a regra que liga --espaco-acao-fixa só até 767 px');
  assert.match(reserva[1], /\.estudio-acoes--previa/, 'a prévia do material liga a reserva');
  assert.match(reserva[1], /\.trilha-proximo/, 'o próximo passo da trilha segue na lista');
  assert.match(reserva[1], /\.trilha-vazia/, 'a trilha vazia segue na lista');
  assert.match(css, /\.estudo\[data-navegacao\] \.estudo-principal:has\(\.painel--pedido\) \{ padding-bottom: calc\(40px \+ var\(--altura-navegacao\) \+ var\(--espaco-acao-fixa, 0px\)\); \}/, 'o fim da rolagem de Nova trilha soma a reserva da ação presa');
  // Sem a ação presa (a tela de pedido sem prévia, o tablet) a variável não existe: o valor cai para 0 e a conta é a de antes (40 px + a cápsula).
  assert.match(css, /html\[data-teclado='true'\]:has\(\.estudo\[data-navegacao\]\) \{\s*--altura-navegacao: 0px;\s*--espaco-acao-fixa: 0px;\s*\}/);
});

test('item 35: a ação presa fica 12 px acima da cápsula, com as margens da ilha (16), até 480 px; com o teclado aberto volta ao fluxo', () => {
  const css = ler('src/app/globals.css');
  assert.match(css, /--margem-ilha-esq: max\(16px, calc\(env\(safe-area-inset-left\) \+ 8px\)\);/);
  assert.match(css, /--margem-ilha-dir: max\(16px, calc\(env\(safe-area-inset-right\) \+ 8px\)\);/);
  assert.match(css, /\.estudo\[data-navegacao\] \.acao-principal \{\s*inset: auto var\(--margem-ilha-dir\) calc\(var\(--altura-navegacao\) \+ 12px\) var\(--margem-ilha-esq\);\s*max-width: 480px;\s*margin-inline: auto;/);
  assert.match(css, /html\[data-teclado='true'\] \.estudo\[data-navegacao\] :is\(\.acao-principal, \.editor-perfil__barra\) \{ position: static; \}/);
  // O envoltório é o `.acao-principal` de todas as telas (fixo, só até 767 px); a pílula do app não existe aqui: a ação fica à vista, presa.
  const base = /@media \(max-width: 767px\) \{[^@]*?\.acao-principal \{\s*display: flex;\s*position: fixed;/.exec(css);
  assert.ok(base, 'a ação principal só flutua até 767 px');
});

test('item 35: no tablet, no computador e com o teclado aberto o envoltório não é caixa (o botão fica na linha, como era); até 600 px a largura da presa vem das margens, não de 100%', () => {
  const css = ler('src/app/estudio.css');
  assert.match(css, /@media \(min-width: 768px\) \{\s*\.estudio-acoes > \.acao-principal \{ display: contents; \}\s*\}/);
  assert.match(css, /html\[data-teclado='true'\] \.estudio-acoes > \.acao-principal \{ display: contents; \}/);
  const ate600 = css.indexOf('.estudio-acoes > * {');
  assert.ok(ate600 > 0, 'a regra que estica as ações a 100% no celular');
  assert.match(css.slice(ate600, ate600 + 520), /\.estudio-acoes > \.acao-principal \{\s*width: auto;\s*\}/, 'a ação presa fica de fora dos 100%: o fixo com margens dos dois lados precisa de largura automática');
  // O resto da linha de ações não mudou: o botão de "Remover material" continua com 100% no celular.
  assert.match(css, /\.estudio-acoes \.botao \{ width: 100%; \}/);
});
