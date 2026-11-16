'use strict';
/* Ajudantes para percorrer uma lição na web (celular), em ritmo de gente quando grava e rápido fora da câmera. */

/** Ritmos: `calmo` para a câmera, `rapido` para os trechos que não entram no filme. */
const RITMO = {
  calmo: { antes: 170, pressao: 90, entre: 380 },
  rapido: { antes: 16, pressao: 16, entre: 60 },
};

const etapa = (g) => g.page.locator('.aula-etapa').first().innerText();

/** Abre a lição atual pelo nó do mapa. */
async function abrirAtual(g, r = RITMO.rapido) {
  await g.tocar(g.page.getByRole('button', { name: /^(Começar|Continuar): / }).first(), { ...r, rotulo: 'abrir lição' });
  await g.esperar('.aula-etapa');
  await g.segurar(r.entre + 300);
}

/** Lê a etapa até o fim ("Continuar lendo") e avança. */
async function seguir(g, r = RITMO.rapido, lendo = 700) {
  for (let i = 0; i < 10; i += 1) {
    await g.segurar(50);
    const ler = g.page.getByRole('button', { name: /Continuar lendo/ });
    if (await ler.isVisible().catch(() => false)) {
      try { await g.tocar(ler, { ...r, rotulo: 'continuar lendo' }); } catch { break; }
      await g.segurar(r === RITMO.rapido ? 420 : lendo);
      continue;
    }
    break;
  }
  await g.tocar(g.page.getByRole('button', { name: /^Avançar/ }), { ...r, rotulo: 'avançar' });
  await g.segurar(r.entre + 350);
}

/** Avança até a etapa cujo selo casa com `padrao` (por exemplo /EXERCÍCIO 1/ ou /PRÁTICA/). Só para conceito e exemplo. */
async function irAte(g, padrao) {
  for (let i = 0; i < 6; i += 1) {
    if (padrao.test(await etapa(g))) return;
    await seguir(g, RITMO.rapido);
  }
  throw new Error(`etapa ${padrao} não chegou; está em ${await etapa(g)}`);
}

const form = (g) => g.page.locator('form#resposta-licao');

/** Preenche a resposta do exercício atual (dados de respostas.json). `certo: false` responde errado de um jeito plausível. */
async function responder(g, ex, certo = true, r = RITMO.calmo) {
  const { page } = g;
  switch (ex.tipo) {
    case 'multipla_escolha': {
      const alvo = certo ? ex.certa : ex.erradas[0];
      await g.tocar(form(g).locator('label').filter({ hasText: alvo }).first(), { ...r, rotulo: `opção ${alvo.slice(0, 24)}` });
      break;
    }
    case 'lacuna': {
      await g.tocar(form(g).locator('input').first(), { ...r, rotulo: 'campo da lacuna' });
      await g.segurar(r.entre / 2);
      await g.digitar(certo ? ex.certa : ex.errada ?? 'zzzz', { ritmo: r === RITMO.rapido ? 20 : 85 });
      break;
    }
    case 'ordenar': {
      const ordem = certo ? ex.ordem : [ex.ordem[1], ex.ordem[0], ...ex.ordem.slice(2)];
      for (const texto of ordem) {
        await g.tocar(page.locator('.ordenar button').filter({ hasText: texto }).first(), { ...r, rotulo: `ordenar ${texto.slice(0, 20)}` });
        await g.segurar(r.entre);
      }
      break;
    }
    case 'associar': {
      // Errado: troca os pares dos dois primeiros itens (os outros ficam certos).
      const pares = certo ? ex.pares : ex.pares.map(([e, d], i, todos) => (i === 0 ? [e, todos[1][1]] : i === 1 ? [e, todos[0][1]] : [e, d]));
      const esquerda = page.locator('.associar__colunas > div').first();
      const direita = page.locator('.associar__colunas > div').last();
      for (const [e, d] of pares) {
        const be = esquerda.locator('button').filter({ hasText: e }).first();
        if (await be.isDisabled()) continue;
        // Par já feito e certo (na nova tentativa só os errados mudam): pula.
        await g.tocar(be, { ...r, rotulo: `par ${e.slice(0, 14)}` });
        await g.segurar(r.entre * 0.7);
        await g.tocar(direita.locator('button').filter({ hasText: d }).first(), { ...r, rotulo: `par → ${d.slice(0, 14)}` });
        await g.segurar(r.entre);
      }
      break;
    }
    case 'verdadeiro_falso': {
      const valor = certo ? ex.valor : ex.valor === 'falso' ? 'verdadeiro' : 'falso';
      await g.tocar(form(g).getByText(valor === 'falso' ? 'Falsa' : 'Verdadeira', { exact: true }).first(), { ...r, rotulo: valor });
      await g.segurar(r.entre);
      await g.tocar(form(g).locator('label').filter({ hasText: ex.justificativa }).first(), { ...r, rotulo: 'justificativa' });
      break;
    }
    case 'aberta': {
      await g.tocar(form(g).locator('textarea').first(), { ...r, rotulo: 'resposta aberta' });
      await g.segurar(r.entre / 2);
      await g.digitar(typeof certo === 'string' ? certo : ex.modelo, { ritmo: r === RITMO.rapido ? 8 : 48 });
      break;
    }
    default:
      throw new Error(`tipo sem roteiro: ${ex.tipo}`);
  }
}

/** Toca em Verificar e espera o painel de retorno. */
async function verificar(g, r = RITMO.calmo) {
  await g.segurar(r.entre);
  await g.tocar(g.page.getByRole('button', { name: /^Verificar/ }), { ...r, rotulo: 'verificar' });
  await g.esperar('.aula-retorno');
  g.marcar('retorno', { certa: (await g.page.locator('.aula-rodape').getAttribute('data-retorno')) === 'certa' });
}

async function continuar(g, r = RITMO.calmo) {
  await g.tocar(g.page.getByRole('button', { name: /^Continuar$/ }), { ...r, rotulo: 'continuar' });
  await g.segurar(r.entre + 350);
}

/** Faz o exercício atual do começo ao fim, certo, sem câmera. */
async function resolver(g, ex) {
  await responder(g, ex, true, RITMO.rapido);
  await verificar(g, RITMO.rapido);
  await g.segurar(200);
  await continuar(g, RITMO.rapido);
}

/** Prática sem câmera: "Já pratiquei", "Consegui" e concluir. */
async function praticarRapido(g) {
  const { page } = g;
  await g.tocar(page.locator('.como-foi__sem-cronometro'), { ...RITMO.rapido, rotulo: 'já pratiquei' });
  await g.tocar(page.locator('.como-foi label').filter({ hasText: 'Consegui' }), { ...RITMO.rapido, rotulo: 'consegui' });
  await g.segurar(300);
  await g.tocar(page.getByRole('button', { name: /^Concluir lição/ }), { ...RITMO.rapido, rotulo: 'concluir' });
}

module.exports = { RITMO, etapa, abrirAtual, seguir, irAte, responder, verificar, continuar, resolver, praticarRapido, form };
