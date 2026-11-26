// Entrada no celular (spec 04, revisão de banca da noite, item 1): cabe sem rolar, com "Entrar" junto dos campos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { elementos, porId, renderizarCadastro, renderizarEntrada, visivel } from './auxiliares/render-acesso.mjs';

const raiz = resolve(import.meta.dirname, '..');
const css = readFileSync(join(raiz, 'src/app/globals.css'), 'utf8');

test('entrada e cadastro apresentam Google como alternativa depois da ação por e-mail, com marca decorativa', () => {
  for (const documento of [renderizarEntrada(), renderizarCadastro()]) {
    const controles = elementos(documento, '*').filter(e => ['input', 'button', 'a'].includes(e.tagName) && visivel(e));
    const google = controles.find(e => e.tagName === 'button' && e.textContent.includes('Continuar com Google'));
    const principal = controles.find(e => e.tagName === 'button' && e.getAttribute('type') === 'submit');
    assert.ok(google && principal);
    assert.ok(controles.indexOf(principal) < controles.indexOf(google), 'a ação de e-mail vem primeiro');
    const imagem = elementos(google, 'img')[0];
    assert.equal(imagem.getAttribute('alt'), '');
    assert.equal(imagem.getAttribute('aria-hidden'), 'true');
    assert.equal(imagem.getAttribute('width'), '20');
    assert.equal(imagem.getAttribute('height'), '20');
    assert.match(imagem.getAttribute('srcset') || imagem.getAttribute('srcSet'), /2x.*3x/);
  }
  for (const [nome, tamanho] of [['google-g.png', 20], ['google-g@2x.png', 40], ['google-g@3x.png', 60]]) {
    const imagem = readFileSync(join(raiz, 'packages/contratos/assets', nome));
    assert.deepEqual([imagem.readUInt32BE(16), imagem.readUInt32BE(20)], [tamanho, tamanho]);
  }
});

test('a conta sem trilhas abre o pedido (sem foco sozinho até 1023 px, para a cápsula aparecer), mas sua aba de trilhas tem um vazio próprio', () => {
  const estudo = readFileSync(join(raiz, 'src/app/estudo.tsx'), 'utf8');
  assert.match(estudo, /ativos\.length === 0 \|\| abriuComRascunho\.current\) \{(?:\s*\/\/[^\n]*)*\s*setTela\(\{ tipo: 'objetivo' \}\);/);
  assert.match(estudo, /visivel && tela\.tipo === 'objetivo' && \(\s*<Pedido/);
  const inicio = estudo.indexOf('className="painel planos-sem-trilhas"');
  const fim = estudo.indexOf('</section>', inicio);
  assert.ok(inicio > 0);
  const vazio = estudo.slice(inicio, fim);
  assert.match(vazio, /data-testid="planos-vazio"/);
  assert.match(vazio, /expressao="stu-curioso" tamanho=\{96\}/);
  assert.match(vazio, /vazioTitulo[\s\S]*vazioTexto[\s\S]*focarCampo: true[\s\S]*vazioAcao/);
  assert.doesNotMatch(vazio, /<Pedido|role="dialog"/);
  assert.match(estudo, /const abaNovaTrilha = tela\.tipo === 'objetivo';/);
});

test('o login começa pelo e-mail, mantém a senha no formulário e oferece recuperação sem misturar apresentação', () => {
  const documento = renderizarEntrada();
  const formulario = elementos(documento, 'form')[0];
  assert.ok(formulario);
  const email = porId(documento, 'email');
  const senha = porId(documento, 'senha');
  assert.ok(visivel(email));
  assert.equal(email.getAttribute('autoComplete'), 'username');
  assert.equal(senha.getAttribute('autoComplete'), 'current-password');
  assert.equal(visivel(senha), false, 'a senha aparece somente na etapa seguinte');
  const principal = elementos(formulario, 'button').find(e => e.getAttribute('type') === 'submit');
  assert.equal(principal.textContent.trim(), 'Continuar');
  assert.ok(elementos(documento, 'a').some(e => e.getAttribute('href') === '/recuperar'));
  assert.ok(elementos(documento, 'a').some(e => e.getAttribute('href') === '/privacidade'));
  assert.equal(elementos(documento, 'h1').length, 1);
});

test('no celular: sem faixa até 860 px de altura (120 px acima), título 28/34, texto 15/22 e Entrar de 48 na largura toda', () => {
  const bloco = css.slice(css.lastIndexOf('/* Entrada no celular'));
  assert.match(bloco, /\.entrada-entrar > \.botao \{ width: 100%; min-height: 48px; \}/);
  assert.match(bloco, /\.entrada-banner \{ height: 120px;/);
  assert.match(bloco, /\.entrada-cabecalho h1 \{ font-size: 28px; line-height: 34px;/);
  assert.match(bloco, /\.entrada-cabecalho \.introducao \{ font-size: 15px; line-height: 22px; \}/);
  assert.match(bloco, /@media \(max-width: 767px\) and \(max-height: 860px\) \{ \.entrada-banner \{ display: none; \} \}/);
  assert.match(bloco, /\.entrada-cabecalho \.acesso-link \{ min-height: 44px; \}/);
});

test('no pedido as sugestões formam uma fileira rolável e Surpreenda-me fecha a lista', () => {
  const pedido = readFileSync(join(raiz, 'src/app/pedido.tsx'), 'utf8');
  const estilo = readFileSync(join(raiz, 'src/app/pedido.css'), 'utf8');
  const ideias = pedido.indexOf('tema.exemplos.map');
  assert.ok(pedido.indexOf('className="pedido-alternar"') < ideias);
  assert.ok(ideias > 0 && pedido.indexOf('onClick={surpreender}') > ideias);
  assert.doesNotMatch(pedido, /pedido-alternar__selo|pedido\.seuMaterial/);
  assert.match(estilo, /\.pedido-ideias\s*\{[^}]*overflow-x: auto/);
  assert.match(estilo, /\.pedido-ideias\s*\{[^}]*flex-wrap: nowrap/);
  assert.match(estilo, /\.pedido-ideia\s*\{[^}]*min-height: 44px/);
});
