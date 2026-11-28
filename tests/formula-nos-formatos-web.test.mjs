// Marco 13c (fase 2 do site): a fórmula marcada (`$…$`) nos quatro formatos que ainda mostravam o texto cru na web (verdadeiro ou falso, associar, ordenar e o
// trecho com lacuna), como o app já faz (3a17cd8). O servidor manda as marcas para quem anuncia `visuais@1` (o site anuncia `visuais@2`); aqui está o que a
// tela mostra e o que o leitor de tela ouve em cada formato: nenhum `$`, `\`, `^`, `{` ou `}` à vista, e rótulos e avisos com a FALA da fórmula ("seno de x").
// O desenho em si (o SVG da fórmula em linha, depois da medida) é conferido em navegador de verdade, nas capturas; aqui é o HTML de servidor, que já é o
// texto linear de cada fórmula (o mesmo que o leitor de tela e o cliente sem desenho recebem).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { falarTextoComFormulas, textoSemFormulas } from '@studoo/contratos';
import { mensagens } from '@studoo/contratos/experiencia';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const { EtapaExercicio, respostaLegivel } = await import('../src/app/aula.tsx');
const { Ordenar } = await import('../src/app/ordenar.tsx');

const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const t = mensagens.licao;
const etapa = (exercicio, props = {}) => renderToStaticMarkup(createElement(EtapaExercicio, {
  exercicio, indice: 0, total: 1, resposta: '', inicial: '', mudar() {}, ocupado: false, responder() {}, formulario: null, titulo: null, avaliacao: null, ...props,
}));
const ordenar = (itens, props = {}) => renderToStaticMarkup(createElement(Ordenar, { itens, valor: itens.map(({ id }) => id).join(','), inicial: itens.map(({ id }) => id).join(','), mudar() {}, desativado: false, ...props }));
const entidades = (html) => html.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
/** O que se vê (e se ouve): as marcas HTML fora, os nomes acessíveis (`aria-label`) para fora também; eles têm teste à parte. */
const visivel = (html) => entidades(html.replace(/aria-label="[^"]*"/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
const rotulos = (html) => [...html.matchAll(/aria-label="([^"]*)"/g)].map(([, rotulo]) => entidades(rotulo));
/** O que nunca pode estar na tela nem na fala: o cifrão da marca, a barra do LaTeX, o circunflexo e as chaves. (O índice `x_V` tem teste no navegador, onde ele é desenhado.) */
const CRU = /[$\\^{}]/;

const SENO = '$\\sin x$';
const FRACAO = '$\\frac{a}{b}$';

test('verdadeiro ou falso: a afirmação e as justificativas desenham a fórmula marcada, nunca o cifrão nem a barra', () => {
  const html = etapa({
    tipo: 'verdadeiro_falso', enunciado: 'Julgue a afirmação.',
    afirmacao: `A função $h(x) = \\sin x$ nunca passa de 1, e ${FRACAO} só existe se $b \\neq 0$.`,
    justificativas: [{ id: 'a', texto: `Porque ${SENO} varia entre $-1$ e $1$.` }, { id: 'b', texto: 'Porque $\\frac{\\sin x}{x}$ tende a 0.' }],
  });
  const tela = visivel(html);
  assert.doesNotMatch(tela, CRU);
  assert.match(tela, /A função h\(x\) = sen x nunca passa de 1, e a\/b só existe se b ≠ 0\./, 'a afirmação inteira, com a fórmula em texto linear');
  assert.match(tela, /Porque sen x varia entre −1 e 1\./);
  assert.match(tela, /Porque \(sen x\) ÷ x tende a 0\./);
  assert.match(html, /<blockquote class="vf__afirmacao"><p>/, 'a afirmação continua no mesmo bloco e no mesmo parágrafo');
  // As duas justificativas continuam rádios dentro do rótulo (foco, teclado e nome acessível do navegador).
  assert.equal((html.match(/<input type="radio" name="vf-justificativa"/g) ?? []).length, 2);
  assert.equal((html.match(/<input type="radio" name="vf-valor"/g) ?? []).length, 2);
  // Depois da correção: as cores e o texto não mudam.
  const corrigido = etapa({
    tipo: 'verdadeiro_falso', enunciado: 'Julgue a afirmação.', afirmacao: `A função $h(x) = \\sin x$ nunca passa de 1.`, justificativas: [{ id: 'a', texto: `Porque ${SENO} varia entre $-1$ e $1$.` }, { id: 'b', texto: 'Porque sim.' }],
  }, { resposta: 'verdadeiro:a', avaliacao: { correta: true, feedback: 'Isso!', comprovante: 'c', certos: ['valor', 'justificativa'] } });
  assert.doesNotMatch(visivel(corrigido), CRU);
  assert.match(corrigido, /data-retorno="certa"/);
});

test('associar: os cartões das duas colunas desenham a fórmula, e o nome de cada botão leva a fala ("seno de x", "a sobre b")', () => {
  const exercicio = {
    tipo: 'associar', enunciado: 'Ligue cada expressão ao que ela é.',
    esquerda: [{ id: 'a', texto: SENO }, { id: 'b', texto: '$\\cos x$' }, { id: 'c', texto: FRACAO }],
    direita: [{ id: 'x', texto: 'Vale 0 em $x = 0$' }, { id: 'y', texto: 'Vale 1 em $x = 0$' }, { id: 'z', texto: 'Razão entre $a$ e $b$' }],
  };
  const vazio = etapa(exercicio);
  assert.doesNotMatch(visivel(vazio), CRU);
  assert.match(visivel(vazio), /sen x.*cos x.*a\/b.*Vale 0 em x = 0.*Vale 1 em x = 0.*Razão entre a e b/);
  const nomes = rotulos(vazio).filter((rotulo) => !['Itens', 'Pares'].includes(rotulo));
  assert.deepEqual(nomes, ['seno de x', 'cosseno de x', 'a sobre b', 'Vale 0 em x é igual a 0', 'Vale 1 em x é igual a 0', 'Razão entre a e b'], 'o leitor de tela ouve a fala, nunca o cifrão');
  for (const nome of nomes) assert.doesNotMatch(nome, CRU);
  // Com pares feitos: o "Desfazer o par" fala os dois lados.
  const pareado = etapa(exercicio, { resposta: 'a=x,c=z' });
  assert.deepEqual(
    rotulos(pareado).filter((rotulo) => rotulo.startsWith('Desfazer')),
    [t.associar.desfazer('seno de x', 'Vale 0 em x é igual a 0'), t.associar.desfazer('a sobre b', 'Razão entre a e b'), t.associar.desfazer('seno de x', 'Vale 0 em x é igual a 0'), t.associar.desfazer('a sobre b', 'Razão entre a e b')],
  );
  assert.doesNotMatch(visivel(pareado), CRU);
  // Depois da correção, o par travado na nova tentativa fala os dois lados.
  const travado = etapa(exercicio, { resposta: 'a=x', dica: { correta: false, feedback: 'Quase.', comprovante: 'c', certos: ['a'] } });
  assert.ok(rotulos(travado).includes(t.associar.travado('seno de x', 'Vale 0 em x é igual a 0')));
  // O texto de uma lição que não é de matemática (sem marca) é o de sempre, palavra por palavra.
  const comum = etapa({ tipo: 'associar', enunciado: 'Ligue.', esquerda: [{ id: 'a', texto: 'Cão' }, { id: 'b', texto: 'Gato' }], direita: [{ id: 'x', texto: 'Late' }, { id: 'y', texto: 'Mia' }] });
  assert.deepEqual(rotulos(comum).filter((rotulo) => !['Itens', 'Pares'].includes(rotulo)), ['Cão', 'Gato', 'Late', 'Mia']);
});

test('ordenar: os itens desenham a fórmula, e o cartão leva a fala no nome ("1º de 4: seno de x") sem quebrar o botão nem a alça de arrastar', () => {
  const itens = [{ id: 'a', texto: 'Isole $x$ em $2x + 3 = 11$' }, { id: 'b', texto: '$\\sin x = \\frac{a}{b}$' }, { id: 'c', texto: '$x = \\frac{8}{2}$' }, { id: 'd', texto: '$x = 4$' }];
  const html = ordenar(itens);
  assert.doesNotMatch(visivel(html), CRU);
  assert.match(visivel(html), /Isole x em 2x \+ 3 = 11.*sen x = a\/b.*x = 8\/2.*x = 4/);
  assert.deepEqual(rotulos(html), [
    t.ordenar.cartaoRotulo(1, 4, 'Isole x em 2 x mais 3 é igual a 11'),
    t.ordenar.cartaoRotulo(2, 4, 'seno de x é igual a a sobre b'),
    t.ordenar.cartaoRotulo(3, 4, 'x é igual a 8 sobre 2'),
    t.ordenar.cartaoRotulo(4, 4, 'x é igual a 4'),
  ]);
  for (const rotulo of rotulos(html)) assert.doesNotMatch(rotulo, CRU);
  // O cartão continua sendo UM botão com a alça de arrastar dentro dele, e o texto vai num elemento com a classe de sempre (a largura, a quebra e o peso).
  assert.equal((html.match(/<button type="button" class="ordenar-cartao__corpo"/g) ?? []).length, 4);
  assert.equal((html.match(/class="ordenar-cartao__alca"/g) ?? []).length, 4);
  assert.equal((html.match(/<span class="ordenar-cartao__texto">/g) ?? []).length, 4);
  // Travado na nova tentativa e verificado: o nome também fala.
  assert.equal(rotulos(ordenar(itens, { fixos: ['b'] }))[1], t.ordenar.travadoRotulo('seno de x é igual a a sobre b', 2));
  assert.doesNotMatch(visivel(ordenar(itens, { certos: ['a', 'd'], desativado: true })), CRU);
  // Sem fórmula, o que existia: o texto do item é o nome do cartão.
  assert.deepEqual(rotulos(ordenar([{ id: 'a', texto: 'Acordar' }, { id: 'b', texto: 'Vestir' }, { id: 'c', texto: 'Sair' }])), [t.ordenar.cartaoRotulo(1, 3, 'Acordar'), t.ordenar.cartaoRotulo(2, 3, 'Vestir'), t.ordenar.cartaoRotulo(3, 3, 'Sair')]);
});

test('o aviso de quem ouve (escolhi, troquei, mudei de lugar) fala a fórmula: o código do ordenar passa a fala, não o texto marcado', () => {
  const fonte = ler('src/app/ordenar.tsx');
  assert.match(fonte, /const falaDe = \(id: string\) => falarTextoComFormulas\(textoDe\(id\)\);/);
  for (const aviso of ['avisoEscolhido', 'avisoTrocaram', 'avisoPosicao', 'travadoRotulo', 'cartaoRotulo']) {
    const usos = fonte.match(new RegExp(`${aviso}\\(([^;\\n]*)`, 'g')) ?? [];
    assert.ok(usos.length > 0, aviso);
    for (const uso of usos) assert.doesNotMatch(uso, /textoDe\(/, `${aviso}: só a fala, nunca o texto marcado (${uso})`);
  }
  // E o texto do cartão é o texto com fórmula em linha, no elemento que já existia.
  assert.match(fonte, /<TextoComFormulas className="ordenar-cartao__texto" texto=\{textoDe\(id\)\} \/>/);
  const aula = ler('src/app/aula.tsx');
  const associar = aula.slice(aula.indexOf('function Associar('), aula.indexOf('function VerdadeiroFalso('));
  assert.match(associar, /const fala = \(lista: Opcao\[\], id: string\) => falarTextoComFormulas\(texto\(lista, id\)\);/);
  assert.doesNotMatch(associar, /t\.associar\.(ligar|desfazer|travado)\([^)]*item\.texto/, 'os nomes dos botões não usam o texto marcado');
  assert.equal((associar.match(/<TextoComFormulas texto=\{item\.texto\} \/>/g) ?? []).length, 2, 'os cartões das duas colunas');
  assert.match(associar, /<TextoComFormulas como="p" className="associar__instrucao" aria-live="polite"/, 'a linha que anuncia o item escolhido também desenha a fórmula');
});

test('trecho com lacuna: o texto em volta da lacuna desenha a fórmula em todos os tipos de trecho; o código fica como está', () => {
  const casos = {
    frase: ['A derivada de $\\sin x$ é ___ e a razão $\\frac{a}{b}$ vale ___ quando $a = 6$ e $b = 3$.', /A derivada de sen x é\s+e a razão a\/b vale\s+quando a = 6 e b = 3\./],
    formula: ['$\\frac{-b}{2a} = \\frac{4}{2} =$ ___', /\(−b\) ÷ \(2a\) = 4\/2 =/],
    citacao: ['“O seno de $x$ é a razão entre $\\frac{\\text{cateto oposto}}{\\text{hipotenusa}}$ e ___.”', /O seno de x é a razão entre cateto oposto ÷ hipotenusa e/],
    passos: ['1. Escreva $2x + 3 = 11$\n2. Subtraia 3: $2x = 8$\n3. Divida por 2: $x = $ ___', /Escreva 2x \+ 3 = 11.*Subtraia 3: 2x = 8.*Divida por 2: x =/],
  };
  for (const [tipo, [trecho, esperado]] of Object.entries(casos)) {
    const html = etapa({ tipo: 'lacuna', enunciado: 'Complete.', trecho, trechoTipo: tipo });
    const bloco = html.slice(html.indexOf('</h1>'), html.indexOf('<form'));
    assert.doesNotMatch(visivel(bloco), CRU, tipo);
    assert.match(visivel(bloco), esperado, tipo);
    assert.match(bloco, /class="trecho-lacuna"/, `${tipo}: a lacuna continua destacada`);
    assert.match(bloco, /aria-label="lacuna"/, `${tipo}: e continua com o nome "lacuna"`);
  }
  // Enquanto a pessoa digita, a lacuna mostra o que ela escreveu (no lugar do espaço), com a fórmula em volta desenhada.
  const digitando = etapa({ tipo: 'lacuna', enunciado: 'Complete.', trecho: 'A derivada de $\\sin x$ é ___.', trechoTipo: 'frase' }, { resposta: 'cos x' });
  assert.match(digitando, /data-preenchida="true"[^>]*>cos x</);
  assert.doesNotMatch(visivel(digitando), CRU);
  // O código é de shell, de PHP ou de SQL: o `$` dele é dele, e nenhuma fórmula nasce ali.
  const codigo = etapa({ tipo: 'lacuna', enunciado: 'Complete.', trecho: 'echo "$HOME" ___ && echo $PATH', trechoTipo: 'codigo' });
  assert.match(entidades(codigo), /<code><span>echo "\$HOME" <span class="trecho-lacuna"[^>]*>\s*<\/span><\/span><span> && echo \$PATH<\/span><\/code>/, 'o texto do código, intacto');
  assert.doesNotMatch(codigo, /data-formulas|formula-em-linha/);
  // Lição que não é de matemática: o trecho é o de sempre.
  const comum = etapa({ tipo: 'lacuna', enunciado: 'Complete.', trecho: 'Eu ___ café de manhã.', trechoTipo: 'frase' });
  assert.match(visivel(comum), /Eu\s+café de manhã\./);
});

test('a resposta que vira "Você respondeu «…»" na ponte vai em texto linear (o corte em 60 letras não parte uma marca) nos cinco formatos', () => {
  const opcoes = [{ id: 'a', texto: 'Porque $\\sin x$ varia entre $-1$ e $1$ para todo número real $x$ que se escolha.' }, { id: 'b', texto: 'Porque $\\frac{a}{b}$.' }];
  const casos = [
    [{ tipo: 'multipla_escolha', enunciado: 'e', opcoes }, 'a', 'Porque sen x varia entre −1 e 1 para todo número real x que se escolha.'],
    [{ tipo: 'verdadeiro_falso', enunciado: 'e', afirmacao: 'a', justificativas: opcoes }, 'verdadeiro:b', `${t.verdadeiroFalso.verdadeiro} · Porque a/b.`],
    [{ tipo: 'ordenar', enunciado: 'e', itens: [{ id: 'a', texto: '$x = 4$' }, { id: 'b', texto: '$x = \\frac{8}{2}$' }, { id: 'c', texto: '$2x = 8$' }] }, 'b,c,a', 'x = 8/2 · 2x = 8 · x = 4'],
    [{ tipo: 'associar', enunciado: 'e', esquerda: [{ id: 'a', texto: SENO }, { id: 'b', texto: FRACAO }], direita: [{ id: 'x', texto: 'Vale 0 em $x = 0$' }, { id: 'y', texto: 'Razão de $a$ por $b$' }] }, 'a=x,b=y', 'sen x → Vale 0 em x = 0 · a/b → Razão de a por b'],
    [{ tipo: 'lacuna', enunciado: 'e' }, '$x = 4$', '$x = 4$'],
  ];
  for (const [exercicio, resposta, esperado] of casos) {
    const legivel = respostaLegivel(exercicio, resposta);
    assert.equal(legivel, esperado, exercicio.tipo);
    if (exercicio.tipo !== 'lacuna') assert.doesNotMatch(legivel, CRU, exercicio.tipo);
    // A frase da ponte corta em 60 letras e junta com reticências: nenhum `$` solto sobra do corte.
    if (exercicio.tipo !== 'lacuna') assert.doesNotMatch(t.ponteMotivoResposta?.(legivel) ?? mensagens.estudio.ponteMotivoResposta(legivel), CRU, `${exercicio.tipo}: a frase da ponte`);
  }
});

test('a correção da resposta aberta e os passos do exemplo desenham a fórmula também (a avaliação volta com as marcas)', () => {
  const html = etapa({ tipo: 'aberta', enunciado: 'Explique.', minimo: 20 }, {
    resposta: 'Porque a razão $\\frac{a}{b}$ não muda.',
    avaliacao: {
      correta: true, feedback: 'Boa!', comprovante: 'c', modelo: 'Multiplicar $a$ e $b$ pelo mesmo número deixa $\\frac{a}{b}$ igual.',
      criterios: [{ texto: `Cita ${FRACAO}`, atendido: true }, { texto: 'Diz que $b \\neq 0$', atendido: false }],
    },
  });
  const correcao = html.slice(html.indexOf('correcao-aberta'));
  assert.doesNotMatch(visivel(correcao), CRU);
  assert.match(visivel(correcao), /Cita a\/b/);
  assert.match(visivel(correcao), /Diz que b ≠ 0/);
  assert.match(visivel(correcao), /Multiplicar a e b pelo mesmo número deixa a\/b igual\./);
  // Os passos do exemplo e a prática (campos que o servidor também marca), no fonte: cada texto passa pelo texto com fórmula.
  const aula = ler('src/app/aula.tsx');
  assert.match(aula, /<li key=\{posicao\}><span className="aula-passos__numero" aria-hidden="true">\{posicao \+ 1\}<\/span><TextoComFormulas texto=\{passo\} \/><\/li>/);
  assert.match(aula, /<TextoComFormulas como="p" className="aula-pratica__tarefa" texto=\{pratica\.tarefa\} \/>/);
  assert.match(aula, /<TextoComFormulas texto=\{pratica\.dica\} \/>/);
  assert.match(ler('src/app/estudo.tsx'), /<TextoComFormulas como="p" texto=\{licao\.objetivo\} \/>/, 'o objetivo na conclusão');
  assert.match(ler('src/app/estudio.tsx'), /<TextoComFormulas como="p" className="estudio-legenda" texto=\{m\.ensinoIdeia\(licao\.objetivo\)\} \/>/, 'a ideia no Ensine o Stu');
});

test('a fala e o texto linear de cada fórmula dos fixtures são os do contrato (a mesma fonte do app)', () => {
  assert.equal(falarTextoComFormulas(`Porque ${SENO} varia`), 'Porque seno de x varia');
  assert.equal(falarTextoComFormulas(FRACAO), 'a sobre b');
  assert.equal(textoSemFormulas(`Porque ${SENO} varia`), 'Porque sen x varia');
  assert.equal(textoSemFormulas(FRACAO), 'a/b');
});
