import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Entrada sem rolar (lote 1 do iPhone, spec 04): a decisão de tamanho da entrada do app, sem aparelho. A tela é um modelo:
// a altura natural do conteúdo em cada nível (sem ilustração e sem respiro) mais a ilustração com a margem e o respiro
// duas vezes, com as medidas da prévia em 390 de largura (configuração do site). A tela mede, decide, redesenha e mede de
// novo, até parar.
const fonte = await readFile(new URL('../apps/mobile/src/entrada-medidas.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const m = {};
runInNewContext(outputText, { exports: m });
const { proximoEstadoDaEntrada: proximo, ESTADO_INICIAL_DA_ENTRADA: inicial, ILUSTRACAO_MAXIMA, ILUSTRACAO_MINIMA, MARGEM_DA_ILUSTRACAO, NIVEL_MAXIMO } = m;

const BASE = [558, 530, 446, 380];
const conteudo = (estado) => BASE[estado.nivel] + (estado.ilustracao > 0 ? estado.ilustracao + MARGEM_DA_ILUSTRACAO : 0) + 2 * estado.respiro;

/** O estado vem de outro contexto (vm): a cópia tem o protótipo deste, para a comparação estrita. */
const plano = (estado) => ({ ...estado });

function assentar(visivel) {
  let estado = inicial;
  for (let passo = 0; passo < 12; passo++) {
    const seguinte = proximo(visivel, conteudo(estado), estado);
    if (seguinte === estado) return { estado: plano(estado), passos: passo, original: estado };
    estado = seguinte;
  }
  assert.fail(`a entrada não parou em ${visivel}`);
}

test('390 × 844 (altura útil 683): nível 0, ilustração com o que sobra, sem respiro, sem rolar', () => {
  const { estado } = assentar(683);
  assert.deepEqual(estado, { nivel: 0, ilustracao: 683 - BASE[0] - MARGEM_DA_ILUSTRACAO, respiro: 0 });
  assert.ok(conteudo(estado) <= 683);
});

test('a ilustração fica entre 44 e 140; abaixo de 44 sai e o que sobra vira respiro', () => {
  const alta = assentar(BASE[0] + MARGEM_DA_ILUSTRACAO + ILUSTRACAO_MAXIMA + 40).estado;
  assert.deepEqual(alta, { nivel: 0, ilustracao: ILUSTRACAO_MAXIMA, respiro: 20 });
  const limite = assentar(BASE[0] + MARGEM_DA_ILUSTRACAO + ILUSTRACAO_MINIMA).estado;
  assert.equal(limite.ilustracao, ILUSTRACAO_MINIMA);
  const curta = assentar(BASE[0] + MARGEM_DA_ILUSTRACAO + ILUSTRACAO_MINIMA - 1).estado;
  assert.deepEqual(curta, { nivel: 0, ilustracao: 0, respiro: Math.floor((MARGEM_DA_ILUSTRACAO + ILUSTRACAO_MINIMA - 1) / 2) });
});

test('cede na ordem: ilustração, espaços (1), título e descrição (2), descrição (3)', () => {
  assert.equal(assentar(BASE[0]).estado.nivel, 0);
  assert.equal(assentar(BASE[0] - 1).estado.nivel, 1);
  assert.equal(assentar(BASE[1] - 1).estado.nivel, 2);
  assert.equal(assentar(BASE[2] - 1).estado.nivel, 3);
  // Nem no nível 3 cabe: fica no 3 e a página rola (o nível não passa do máximo).
  assert.equal(assentar(BASE[3] - 50).estado.nivel, NIVEL_MAXIMO);
});

test('a ilustração só aparece no nível 0: a tela mais baixa nunca mostra a que a mais alta tirou', () => {
  let anterior = null;
  for (let visivel = 300; visivel <= 900; visivel += 5) {
    const { estado } = assentar(visivel);
    if (estado.nivel > 0) assert.equal(estado.ilustracao, 0, `${visivel}: ilustração no nível ${estado.nivel}`);
    if (anterior) {
      assert.ok(estado.nivel <= anterior.nivel, `${visivel}: o nível subiu com mais altura`);
      assert.ok(estado.ilustracao >= anterior.ilustracao, `${visivel}: a ilustração encolheu com mais altura`);
    }
    if (estado.nivel < NIVEL_MAXIMO || conteudo(estado) <= visivel) assert.ok(conteudo(estado) <= visivel, `${visivel}: não coube`);
    anterior = estado;
  }
});

test('subir de nível zera a ilustração e o respiro; diferença de 1 pt na medida não troca nada', () => {
  const estado = { nivel: 0, ilustracao: 80, respiro: 0 };
  assert.deepEqual(plano(proximo(BASE[0] - 10, conteudo(estado), estado)), { nivel: 1, ilustracao: 0, respiro: 0 });
  const parado = assentar(700).original;
  assert.equal(proximo(700, conteudo(parado) + 1, parado), parado);
  assert.equal(proximo(700, conteudo(parado) - 1, parado), parado);
});
