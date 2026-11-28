// Esperas vivas (contrato `espera-viva.ts`): o Stu concentrado e a frase do que ele está fazendo, iguais na web e no app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ESPERA_VIVA, estadoDaEsperaViva, faltaParaMudarAEspera } from '../packages/contratos/src/espera-viva.ts';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const MOTIVOS = ['material', 'proposta', 'ponte', 'ensino', 'transcricao', 'correcao', 'diagnostico'];

test('nada aparece antes de 400 ms; a frase avança a cada 3,5 s, para na última e, aos 15 s, vira o aviso de demora', () => {
  const { aparecerMs, trocaACadaMs, demoradaMs } = ESPERA_VIVA;
  assert.equal(estadoDaEsperaViva(0, 3), null);
  assert.equal(estadoDaEsperaViva(aparecerMs - 1, 3), null);
  assert.equal(estadoDaEsperaViva(aparecerMs, 3), 0);
  assert.equal(estadoDaEsperaViva(aparecerMs + trocaACadaMs - 1, 3), 0);
  assert.equal(estadoDaEsperaViva(aparecerMs + trocaACadaMs, 3), 1);
  assert.equal(estadoDaEsperaViva(aparecerMs + 2 * trocaACadaMs, 3), 2);
  assert.equal(estadoDaEsperaViva(aparecerMs + 3 * trocaACadaMs, 3), 2, 'para na última, não volta para a primeira');
  assert.equal(estadoDaEsperaViva(demoradaMs - 1, 3), 2);
  assert.equal(estadoDaEsperaViva(demoradaMs, 3), 'demorada');
  assert.equal(estadoDaEsperaViva(60_000, 3), 'demorada');
  // Tempo inválido conta como o começo; sem frases, fica na primeira posição.
  assert.equal(estadoDaEsperaViva(Number.NaN, 3), null);
  assert.equal(estadoDaEsperaViva(-5, 3), null);
  assert.equal(estadoDaEsperaViva(aparecerMs, 0), 0);
});

test('o relógio dorme exatamente até a próxima mudança e para depois do aviso de demora', () => {
  const { aparecerMs, trocaACadaMs, demoradaMs } = ESPERA_VIVA;
  assert.equal(faltaParaMudarAEspera(0, 3), aparecerMs);
  assert.equal(faltaParaMudarAEspera(100, 3), aparecerMs - 100);
  assert.equal(faltaParaMudarAEspera(aparecerMs, 3), trocaACadaMs);
  assert.equal(faltaParaMudarAEspera(aparecerMs + trocaACadaMs + 500, 3), trocaACadaMs - 500);
  // Na última frase, a próxima mudança é o aviso de demora.
  assert.equal(faltaParaMudarAEspera(aparecerMs + 2 * trocaACadaMs, 3), demoradaMs - (aparecerMs + 2 * trocaACadaMs));
  assert.equal(faltaParaMudarAEspera(demoradaMs, 3), null);
  // Cada mudança anunciada pelo relógio é mesmo uma mudança de estado.
  for (const total of [2, 3, 4]) {
    let agora = 0;
    let anterior = estadoDaEsperaViva(agora, total);
    for (let passos = 0; passos < 10; passos++) {
      const falta = faltaParaMudarAEspera(agora, total);
      if (falta === null) break;
      agora += falta;
      const atual = estadoDaEsperaViva(agora, total);
      assert.notEqual(atual, anterior, `total ${total}, ${agora} ms`);
      anterior = atual;
    }
    assert.equal(anterior, 'demorada');
  }
});

test('as frases: de 2 a 4 por espera, curtas, terminadas em reticências, sem número nem promessa de tempo', () => {
  for (const motivo of MOTIVOS) {
    const frases = mensagens.esperaViva[motivo];
    assert.ok(Array.isArray(frases) && frases.length >= 2 && frases.length <= 4, motivo);
    for (const frase of frases) {
      assert.ok(frase.length <= 42, `${motivo}: "${frase}" cabe numa linha em 320 px`);
      assert.ok(frase.endsWith('…'), frase);
      assert.doesNotMatch(frase, /\d|segundo|minuto|quase pronto|já já/i, frase);
    }
  }
  assert.match(mensagens.esperaViva.demorada, /mais que o normal/);
});

test('web: antes de aparecer, só a região viva vazia; nada pisca numa resposta rápida', async () => {
  const anterior = globalThis.window;
  try {
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    const { EsperaViva } = await import('../src/ui/espera-viva.tsx');
    const html = renderToStaticMarkup(createElement(EsperaViva, { motivo: 'ponte' }));
    assert.equal(html, '<p class="somente-leitor" role="status"></p>');
  } finally {
    globalThis.window = anterior;
  }
  const fonte = ler('src/ui/espera-viva.tsx');
  assert.match(fonte, /<p className="somente-leitor" role="status">\{estado === null \? '' : frases\[0\]\}<\/p>/, 'o leitor de tela ouve a primeira frase, uma vez');
  assert.match(fonte, /className="espera-viva"[^>]*aria-hidden="true"/, 'as trocas seguintes ficam só na tela');
  assert.match(fonte, /<Stu expressao="stu-concentrado" tamanho=\{48\} animado="laco" \/>/);
  const css = ler('src/app/globals.css');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.espera-viva__barra > span \{ width: 100%; opacity: 0\.35; \} \}/);
});

test('web: a ponte, o material, a proposta, o Explique, a transcrição, a conferência e o diagnóstico mostram a espera viva', () => {
  assert.match(ler('src/app/ponte-reforco.tsx'), /\{!ponte \? \(erro \? <p role="status">\{erro\}<\/p> : <EsperaViva motivo="ponte" \/>\) : <>/);
  const estudio = ler('src/app/estudio.tsx');
  assert.match(estudio, /motivoDaEspera: MotivoDaEspera \| null = lendo \? 'material' : null/);
  assert.match(estudio, /\}, false, 'proposta'\)/);
  assert.match(estudio, /\}, 'transcricao'\);/);
  assert.match(estudio, /criarPonte\(licao\.id\)\), 'ponte'\);/);
  assert.match(estudio, /\}, 'correcao'\);/);
  assert.equal((estudio.match(/\}, 'ensino'\)/g) ?? []).length, 2, 'as duas formas de enviar a explicação (texto e voz)');
  assert.match(estudio, /\{ocupado && \(motivo === 'ensino' \|\| motivo === 'transcricao'\) && <EsperaViva key=\{motivo\} motivo=\{motivo\} compacta \/>\}/);
  assert.match(ler('src/app/diagnostico.tsx'), /\{ocupado && <EsperaViva motivo="diagnostico" compacta \/>\}/);
  // Os botões que esperam a resposta do servidor afundam e giram.
  const aula = ler('src/app/aula.tsx');
  assert.match(aula, /\{pendente === 'avaliar' && <span className="botao__giro" aria-hidden="true" \/>\}/);
  assert.ok((aula.match(/\{pendente === 'concluir' && <span className="botao__giro" aria-hidden="true" \/>\}/g) ?? []).length >= 3);
});

test('app: as mesmas esperas, com o mesmo contrato, e o movimento reduzido para o Stu e a barra', () => {
  const componente = ler('apps/mobile/src/espera-viva.tsx');
  assert.match(componente, /estadoDaEsperaViva, faltaParaMudarAEspera/);
  assert.match(componente, /accessibilityLiveRegion="polite" role="status"[^>]*>\{visivel \? lista\[0\] : ''\}/);
  assert.match(componente, /importantForAccessibility="no-hide-descendants" accessibilityElementsHidden/);
  assert.match(componente, /if \(!visivel \|\| reduzir !== false\) return;/, 'a barra só corre sem movimento reduzido');
  assert.match(componente, /reduzir !== false \? s\.barraParada/);
  const estudio = ler('apps/mobile/src/estudio-adaptativo.tsx');
  assert.match(estudio, /<EsperaViva key=\{motivo\} motivo=\{motivo\} compacta testID="espera-material" \/>/);
  assert.match(estudio, /<EsperaViva motivo="ponte" compacta testID="espera-ponte" \/>/);
  for (const motivo of ['transcricao', 'ponte']) assert.match(estudio, new RegExp(`\\}, setErro, '${motivo}'\\);`));
  assert.equal((estudio.match(/\}, setErro, 'ensino'\);/g) ?? []).length, 2);
  assert.match(estudio, /\}, setErroPonte, 'correcao'\);/);
  assert.match(ler('apps/mobile/src/diagnostico.tsx'), /<EsperaViva motivo="diagnostico" compacta testID="espera-diagnostico" \/>/);
});
