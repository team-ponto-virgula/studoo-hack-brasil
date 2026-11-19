// Item 6 da noite na web (spec 10, "Revisão do dono", e o fechamento do Designer): o aviso do gesto só na primeira
// curtida, o aviso visível do visitante sem botão, as ações da confirmação pela spec 11, as chaves de 39f72e9 e o erro de
// campo que agora aparece na barra no celular (o toque no "Salvar" não cai mais fora dele).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (arquivo) => readFileSync(join(raiz, arquivo), 'utf8');
const comunidade = ler('src/app/comunidade.tsx');
const perfil = ler('src/app/perfil.tsx');

test('Curtir: o aviso que explica o gesto só na primeira curtida; o visitante vê o aviso sem botão e o coração volta', () => {
  assert.match(comunidade, /explicado = localStorage\.getItem\(CHAVE_GESTO_EXPLICADO\) === '1'; if \(!explicado\) localStorage\.setItem\(CHAVE_GESTO_EXPLICADO, '1'\);/);
  assert.match(comunidade, /if \(!explicado\) avisar\(c\.valeuAviso\(/);
  assert.match(comunidade, /avisar\(c\.valeuContaTemporaria, \{ duracao: 8000 \}\);/);
  assert.doesNotMatch(comunidade.slice(comunidade.indexOf("erro === 'compartilhar_visitante'"), comunidade.indexOf("erro === 'compartilhar_visitante'") + 300), /\bacao:/);
  assert.match(ler('packages/contratos/src/experiencia.ts'), /contaTemporaria: 'Curtidas precisam de uma conta\. Como visitante, você continua estudando normalmente\.'/);
});

test('confirmação (spec 11): "Cancelar" à esquerda e com o foco; se não cabe, uma por linha com a ação em cima', () => {
  assert.match(ler('src/app/compartilhar.css'), /\.folha-acoes\.folha-acoes--metades \{ display: flex; flex-wrap: wrap-reverse; gap: 8px; \}/);
  const dialogo = ler('src/app/compartilhar.tsx');
  assert.match(dialogo, /A ação segura \(cancelar\) recebe o foco/);
  assert.match(ler('src/app/estudo.tsx'), /titulo: mensagens\.planos\.apagarTitulo\(plano\.titulo\)/);
});

test('as chaves do fechamento (39f72e9): "Foto do perfil", "Não salvo" até 400 px e o rótulo do menu', () => {
  assert.match(perfil, /<FolhaDeAcoes titulo=\{p\.fotoFolhaTitulo\}/);
  assert.match(perfil, /curto: p\.naoSalvoCurto/);
  assert.match(ler('src/app/perfil.css'), /@media \(max-width: 400px\) \{\s*\.barra-salvar\[data-com-cancelar\] \.barra-salvar__longo \{ display: none; \}\s*\.barra-salvar\[data-com-cancelar\] \.barra-salvar__curto \{ display: inline; \}/);
  assert.match(comunidade, /aria-label=\{mensagens\.componentes\.menuRotulo\(1\)\}/);
  assert.match(ler('src/app/estudo.tsx'), /mensagens\.componentes\.menuRotulo\(1 \+ \(compartilhar \? 1 : 0\) \+ \(configurar \? 1 : 0\)\)/);
});

test('celular: ao tocar num botão saindo de um campo, a barra de abas só volta depois do toque (o erro chega à barra)', () => {
  const movimento = ler('src/ui/movimento.tsx');
  assert.match(movimento, /if \(evento\) adiado = window\.setTimeout\(\(\) => \{ raiz\.dataset\.teclado = 'false'; \}, 350\);\s*else raiz\.dataset\.teclado = 'false';/);
  assert.doesNotMatch(movimento, /if \(evento\?\.type === 'focusout'\) adiado/, 'o focusin do botão não cancela mais a espera');
});
