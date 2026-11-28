// Refinamento da UI (spec 16), lote 1, a aula na web: item 4 (Conceito e Exemplo curtos), 5 (a dica das teclas), 6 (o quadrinho da letra), 8 (a contagem da resposta aberta) e 11 (a frase
// sobre pular). As contas (itens 4 e 8) são puras e vivem no contrato, para o app usar a mesma (tests/refino-aula-contrato.test.mjs); aqui o fonte e o CSS da tela conferem o resto. A prova no navegador está nas capturas antes e depois da entrega.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const css = ler('src/app/aula.css');
const aula = ler('src/app/aula.tsx');
/** O corpo da primeira regra com este seletor exato. */
const regra = (folha, seletor) => {
  const inicio = folha.indexOf(`${seletor} {`);
  assert.ok(inicio >= 0, `regra ${seletor}`);
  return folha.slice(inicio, folha.indexOf('}', inicio));
};

test('item 4: o Conceito e o Exemplo (fora do "Resolva comigo") medem a folga; o miolo recebe data-folga; o Stu só entra no Exemplo, acima do cartão, decorativo', () => {
  assert.match(aula, /useFolgaDaEtapa\(etapa\.tipo === 'conceito' \|\| \(etapa\.tipo === 'exemplo' && !resolva\.ativo\)\)/);
  assert.match(aula, /<div className="aula-miolo" key=\{`\$\{passo\}-\$\{rodadaDeOpcoes\}`\} ref=\{refDoMiolo\} data-folga=\{folga \|\| undefined\}>/);
  assert.match(aula, /\{etapa\.tipo === 'exemplo' && !resolva\.ativo && folga && \(\s*<div className="aula-folga-stu" data-folga-stu="" aria-hidden="true"><Stu expressao="stu-feliz" tamanho=\{72\} \/><\/div>\s*\)\}/);
  // O Stu do Conceito já fica ao lado do balão: ele não ganha um segundo.
  assert.equal((aula.match(/aula-folga-stu/g) ?? []).length, 1);
  const hook = ler('src/app/aula-folga.ts');
  assert.match(hook, /'folgaStu' in filho\.dataset/, 'o Stu da folga não conta como conteúdo (senão ligaria e desligaria a folga em laço)');
  assert.match(hook, /conteudo\.length - 1/, 'os vãos entre os filhos contam');
  assert.match(hook, /new ResizeObserver\(conferir\)/, 'confere de novo quando um filho muda de altura (fórmula, fonte, citação)');
  assert.doesNotMatch(hook, /marginTop|marginBottom/, 'as margens automáticas valem o que sobra e inflariam a conta');
});

test('item 4: com folga o miolo vira coluna e o conjunto fica no meio do que sobra; sem folga nada muda', () => {
  assert.match(css, /\.aula-miolo\[data-folga\] \{ display: flex; flex-direction: column; \}/);
  assert.match(css, /\.aula-miolo\[data-folga\] \.aula-explicacao \{ margin-block: auto; \}/);
  assert.match(css, /\.aula-miolo\[data-folga\] \.aula-folga-stu \{ align-self: center; margin-top: auto;/);
  assert.match(css, /\.aula-miolo\[data-folga\] > \.aula-quadro\[data-etapa='exemplo'\] \{ margin-bottom: auto; \}/);
  assert.match(css, /\.aula-miolo\[data-folga\] \.aula-folga-stu \.stu \{ width: 72px; \}/);
  // As regras de sempre do miolo seguem: uma grade que começa em cima.
  const miolo = regra(css, '.aula-miolo');
  assert.match(miolo, /display: grid;/);
  assert.match(miolo, /align-content: start;/);
});

test('item 5: a dica "use as teclas de A a C" só aparece com teclado e ponteiro fino (hover: hover e pointer: fine) e nunca no app', () => {
  assert.match(css, /\.opcoes-atalho \{ display: none;/, 'escondida por padrão (toque)');
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.opcoes-atalho \{ display: block; \}/);
  assert.match(aula, /<p className="opcoes-atalho">\{t\.atalho\(exercicio\.opcoes\.length\)\}<\/p>/);
  for (const arquivo of ['apps/mobile/src/licao.tsx', 'apps/mobile/src/estudo.tsx']) assert.doesNotMatch(ler(arquivo), /licao\.atalho|\bt\.atalho\(/, `${arquivo}: o app não tem a dica`);
});

test('item 6: o quadrinho da letra cresce com o texto (1,75 × a letra, mínimo 30, quadrado, raio 9) e o texto da opção quebra ao lado', () => {
  const tecla = regra(css, '.opcao-tecla');
  assert.match(tecla, /width: max\(30px, 1\.75em\);/, 'lado de 1,75 × o tamanho da letra (em), no mínimo 30 px');
  assert.match(tecla, /aspect-ratio: 1;/, 'sempre quadrado');
  assert.match(tecla, /border-radius: 9px;/);
  assert.match(tecla, /place-items: center;/, 'a letra no centro');
  assert.match(tecla, /flex: none;/, 'o quadrinho não encolhe nem estica');
  assert.match(tecla, /font-size: 0\.875rem;/, 'a letra é rem: com o texto ampliado ela e o quadrinho crescem juntos');
  assert.doesNotMatch(tecla, /height: 30px/, 'sem altura fixa');
  assert.match(css, /:is\(\.aula-quadro, \.estudio-desafio, \.resolva\) \.opcoes label > :not\(input, \.opcao-tecla\) \{ flex: 1 1 0; min-width: 0; overflow-wrap: anywhere; \}/, 'o texto ocupa o resto da largura e quebra sem passar por baixo do quadrinho');
});

test('item 8: o contador é cinza #5E6A85 (sem laranja), guarda o espaço quando escondido e o leitor só o ouve enquanto aparece', () => {
  assert.match(aula, /const contando = mostrarContagemDaAberta\(usados, exercicio\.minimo\);/);
  assert.match(aula, /aria-describedby=\{contando \? 'aberta-dica aberta-contador' : 'aberta-dica'\}/);
  assert.match(aula, /<p id="aberta-contador" className="campo__contador" data-oculto=\{contando \? undefined : ''\}>/);
  assert.doesNotMatch(aula, /data-pronto=\{tamanhoDaResposta/, 'o verde de "N letras" saiu');
  assert.match(css, /\.campo--aberta \.campo__contador \{ color: var\(--texto2\); \}/);
  assert.match(ler('src/app/globals.css'), /--texto2: #5e6a85;/, 'a cor do contador é a #5E6A85 da spec');
  assert.match(css, /\.campo--aberta \.campo__contador\[data-oculto\] \{ visibility: hidden; \}/, 'escondido, o espaço fica (o campo não pula)');
  assert.doesNotMatch(css, /\.campo__contador\[data-pronto\]/);
});

test('item 11: a frase sobre pular fica embaixo da fileira de botões, em 13/18 regular #5E6A85, alinhada à direita com "Pular por agora"', () => {
  // Fora do corpo do retorno, depois da fileira de botões.
  const acoes = aula.indexOf('<div className="aula-rodape__acoes">');
  const frase = aula.indexOf('<p className="aula-rodape__pular">');
  const fimDoRodape = aula.indexOf('</footer>', frase);
  assert.ok(acoes > 0 && frase > acoes && fimDoRodape > frase, 'a frase vem depois dos botões, ainda dentro do rodapé');
  assert.match(aula, /\{avaliacao && !avaliacao\.correta && !revisao && pedidoPonte === 0 && \(\s*<p className="aula-rodape__pular">\{soEsteFalta \? t\.pularAvisoUltimo : t\.pularAviso\}<\/p>/);
  assert.doesNotMatch(aula, /<p className="aula-rodape__nota">\{soEsteFalta/, 'a frase não fica mais antes dos botões, em negrito');
  const pular = regra(css, '.aula-rodape__pular');
  assert.match(pular, /font-size: 0\.8125rem;/, '13 px');
  assert.match(pular, /line-height: 1\.3846;/, '18 px na letra de 13 px, e a proporção segue com a letra ampliada (sem apertar as linhas)');
  assert.match(pular, /font-weight: 400;/, 'regular');
  assert.match(pular, /color: var\(--texto2\);/, '#5E6A85');
  assert.match(pular, /text-align: end;/, 'à direita, com "Pular por agora"');
  assert.match(css, /\.aula-rodape\[data-compacto\] \.aula-rodape__pular \{ display: none; \}/, 'com o Explique ou o reforço abertos, sai como a nota de sempre');
});

test('spec 19 (M4): o esqueleto da lição ganha "Abrindo a lição…" à vista depois de 2 s, sem mover nada e sem repetir para o leitor de tela', () => {
  const estudo = ler('src/app/estudo.tsx');
  const esqueleto = estudo.slice(estudo.indexOf('function SkeletonLicao('), estudo.indexOf('function SkeletonLicao(') + 1400);
  assert.match(esqueleto, /<div className="aula-miolo" aria-hidden="true">[\s\S]+<p className="skeleton-licao__espera">\{texto\}…<\/p>\s*<\/div>/, 'a linha fica no miolo, que o leitor de tela não lê');
  assert.equal((esqueleto.match(/<p className="somente-leitor">\{texto\}<\/p>/g) ?? []).length, 1, 'o leitor de tela continua ouvindo uma vez só');
  assert.match(css, /\.skeleton-licao__espera \{[^}]*opacity: 0;[^}]*animation: skeleton-licao-espera 200ms 2s forwards; \}/, 'o lugar fica reservado e a linha só aparece depois de 2 s');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.skeleton-licao__espera \{ animation-delay: 2s !important; \} \}/, 'com movimento reduzido, os 2 s continuam valendo');
});
