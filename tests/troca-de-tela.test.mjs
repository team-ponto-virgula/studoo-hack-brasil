// Troca de tela com direção (contrato `transicao-de-tela.ts`): a mesma regra na web (View Transitions) e no app (entrada da Tela).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ABAS_DA_TROCA, TEMPOS_DA_TROCA, direcaoDaTroca } from '../packages/contratos/src/transicao-de-tela.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');

test('a direção segue a profundidade da tela e, entre as abas, a ordem da barra', () => {
  assert.deepEqual([...ABAS_DA_TROCA], ['planos', 'objetivo', 'explorar', 'perfil']);
  assert.equal(direcaoDaTroca('planos', 'plano'), 'avancar');
  assert.equal(direcaoDaTroca('plano', 'licao'), 'avancar');
  assert.equal(direcaoDaTroca('licao', 'concluida'), 'avancar');
  assert.equal(direcaoDaTroca('concluida', 'licao'), 'avancar', 'a próxima lição, aberta da conclusão, avança');
  assert.equal(direcaoDaTroca('concluida', 'plano'), 'voltar');
  assert.equal(direcaoDaTroca('licao', 'plano'), 'voltar');
  assert.equal(direcaoDaTroca('plano', 'configuracoes'), 'avancar');
  assert.equal(direcaoDaTroca('configuracoes', 'planos'), 'voltar');
  assert.equal(direcaoDaTroca('planos', 'objetivo'), 'avancar');
  assert.equal(direcaoDaTroca('perfil', 'planos'), 'voltar');
  assert.equal(direcaoDaTroca('explorar', 'objetivo'), 'voltar');
  assert.equal(direcaoDaTroca('objetivo', 'apresentacao'), 'avancar');
  assert.equal(direcaoDaTroca('perfilPublico', 'previaTrilha'), 'trocar');
});

test('sem troca animada: a mesma tela, tela desconhecida, primeira tela e as telas com animação própria', () => {
  assert.equal(direcaoDaTroca('plano', 'plano'), null);
  assert.equal(direcaoDaTroca(null, 'planos'), null);
  assert.equal(direcaoDaTroca(undefined, 'planos'), null);
  assert.equal(direcaoDaTroca('planos', 'tela-que-nao-existe'), null);
  for (const propria of ['geracao', 'abrindo-criada']) {
    assert.equal(direcaoDaTroca('objetivo', propria), null);
    assert.equal(direcaoDaTroca(propria, 'licao'), null);
    assert.equal(direcaoDaTroca(propria, 'planos'), null);
  }
  assert.ok(TEMPOS_DA_TROCA.saidaMs < TEMPOS_DA_TROCA.entradaMs);
});

test('web: sem View Transitions, com movimento reduzido ou sem direção, a troca acontece na hora', async () => {
  const anterior = { document: globalThis.document, window: globalThis.window };
  try {
    const dataset = {};
    globalThis.window = { matchMedia: () => ({ matches: false }), setTimeout, clearTimeout };
    globalThis.document = { visibilityState: 'visible', documentElement: { dataset } };
    const { trocarTelaComTransicao, podeAnimarTroca } = await import('../src/app/troca-de-tela.ts');

    // Navegador sem a API.
    let vezes = 0;
    trocarTelaComTransicao('avancar', () => { vezes++; });
    assert.equal(vezes, 1);
    assert.equal(podeAnimarTroca(), false);
    assert.equal(dataset.trocaDeTela, undefined);

    // Com a API: a troca roda dentro da transição, uma vez, e a marca da direção sai no fim.
    let fim;
    const terminou = new Promise((ok) => { fim = ok; });
    globalThis.document.startViewTransition = (atualizar) => {
      assert.equal(dataset.trocaDeTela, 'voltar');
      atualizar();
      atualizar();
      return { finished: terminou };
    };
    vezes = 0;
    trocarTelaComTransicao('voltar', () => { vezes++; });
    assert.equal(vezes, 1);
    fim();
    await terminou;
    await new Promise((ok) => setTimeout(ok, 0));
    assert.equal(dataset.trocaDeTela, undefined);

    // Sem direção: na hora, sem chamar a API.
    let chamou = false;
    globalThis.document.startViewTransition = () => { chamou = true; return { finished: Promise.resolve() }; };
    vezes = 0;
    trocarTelaComTransicao(null, () => { vezes++; });
    assert.equal(vezes, 1);
    assert.equal(chamou, false);

    // Movimento reduzido: na hora, sem chamar a API.
    globalThis.window.matchMedia = () => ({ matches: true });
    vezes = 0;
    trocarTelaComTransicao('avancar', () => { vezes++; });
    assert.equal(vezes, 1);
    assert.equal(chamou, false);
  } finally {
    globalThis.document = anterior.document;
    globalThis.window = anterior.window;
  }
});

test('web: as trocas por toque usam a animação; a geração e a passagem da trilha criada, não', () => {
  const estudo = ler('src/app/estudo.tsx');
  assert.match(estudo, /function navegar\(destino: Tela, opcoes: \{ animar\?: boolean; depois\?: \(\) => void \} = \{\}\)/);
  assert.match(estudo, /if \(opcoes\.animar\) trocarTelaComTransicao\(direcaoDaTroca\(tela\.tipo, destino\.tipo\), aplicar\);/);
  assert.match(estudo, /navegar\(\{ tipo: 'licao', plano, licao: resultado\.dados \}, \{ animar: true \}\)/);
  assert.match(estudo, /resumo \}, \{ animar: true \}\);/);
  assert.match(estudo, /depois: aviso \? \(\) => anunciar\(aviso\) : undefined/);
  // As abas da barra de baixo e do menu lateral.
  for (const aba of ['planos', 'objetivo', 'explorar', 'perfil']) {
    assert.match(estudo, new RegExp(`onClick=\\{\\(\\) => irPara\\(\\{ tipo: '${aba}'`));
  }
  const css = ler('src/app/globals.css');
  assert.match(css, /html\[data-troca-de-tela\] \.estudo-principal \{ view-transition-name: estudo-tela; \}/);
  assert.match(css, /html\[data-troca-de-tela\] \.navegacao-mobile \{ view-transition-name: estudo-barra; \}/);
  assert.match(css, /html\[data-troca-de-tela='avancar'\]::view-transition-new\(estudo-tela\) \{ animation: tela-entrar-direita 300ms/);
  assert.match(css, /html\[data-troca-de-tela='voltar'\]::view-transition-new\(estudo-tela\) \{ animation: tela-entrar-esquerda 300ms/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*::view-transition-group\(\*\), ::view-transition-old\(\*\), ::view-transition-new\(\*\) \{ animation: none !important; \}/);
});

test('app: a Tela nova entra pelo lado da troca, e o movimento reduzido continua parando tudo', () => {
  const interfaceApp = ler('apps/mobile/src/interface.tsx');
  const entrada = interfaceApp.slice(interfaceApp.indexOf('function Entrada('), interfaceApp.indexOf('function Entrada(') + 2000);
  assert.match(entrada, /useContext\(DirecaoDaTrocaContexto\)/);
  assert.match(entrada, /direcao === 'avancar' \? 1 : direcao === 'voltar' \? -1 : 0/);
  assert.match(entrada, /if \(reduzir\) \{\s*valor\.setValue\(1\);\s*return;\s*\}/);
  assert.match(entrada, /translateX: valor\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[lado \* TEMPOS_DA_TROCA\.deslocamento, 0\] \}\)/);
  const estudo = ler('apps/mobile/src/estudo.tsx');
  assert.match(estudo, /if \(troca\.tipo !== etapa\.tipo\) setTroca\(\{ tipo: etapa\.tipo, direcao: direcaoDaTroca\(troca\.tipo, etapa\.tipo\) \}\);/);
  assert.match(estudo, /<DirecaoDaTrocaContexto\.Provider value=\{troca\.direcao\}>\s*\{renderizarTela\(\)\}/);
});
