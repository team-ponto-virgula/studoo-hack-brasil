import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Rede lenta (observações do Mobile & QA na rodada nativa do iPhone com o servidor de teste travando): o app não pode ficar
// parado sem dizer nada, sem navegação ou sem saída.
const estudo = await readFile(new URL('../apps/mobile/src/estudo.tsx', import.meta.url), 'utf8');

test('1: na abertura, se o detalhe da trilha falha, Minhas trilhas mostra o erro com "Tentar novamente"', () => {
  const abertura = estudo.slice(estudo.indexOf('const inicial = planoInicial(lista);'), estudo.indexOf('void carregarPlanos();'));
  assert.match(abertura, /const plano = await cliente\.obterPlano\(inicial\.id\);/);
  assert.match(abertura, /\} catch \(falha\) \{[\s\S]*?if \(sessaoInvalida\(falha\)\) await expirarGuardando\(\);\n\s*else mostrarErro\(falha\);/);
  // O cartão de erro de Minhas trilhas tem a ação "Tentar novamente", que busca a lista e abre a trilha de novo.
  assert.match(estudo, /\{erro && <EstadoErro mensagem=\{erro\} foco acao=\{acaoDoErro\(codigoErro\)\} estilo=\{estudoEstilos\.erroNaLista\} \/>\}/);
  assert.match(estudo, /rotulo: mensagens\.tentar, testID: 'tentar-planos',[\s\S]*?setTentativa\(\(anterior\) => anterior \+ 1\);/);
});

test('2: com um pedido em andamento, a barra de baixo continua à vista e só desliga (spec 05, como a web)', async () => {
  assert.match(estudo, /const comNavegacaoAgora = planos !== null && \(ABAS\.includes\(aba\) \|\| \(comunidade && aba === 'explorar'\)\);/);
  assert.doesNotMatch(estudo, /comNavegacaoAgora = [^\n]*!pendente/);
  // As abas recebem o "ocupado" e ficam desligadas enquanto o pedido corre.
  assert.match(estudo, /NavegacaoContexto\.Provider value=\{comNavegacao \? \{\n\s*atual: aba as Aba, ocupado,/);
  const interfaceApp = await readFile(new URL('../apps/mobile/src/interface.tsx', import.meta.url), 'utf8');
  assert.match(interfaceApp, /accessibilityState=\{\{ selected: selecionado, disabled: nav\.ocupado \}\}/);
  assert.match(interfaceApp, /disabled=\{nav\.ocupado\} onPress=\{item\.acao\}/);
  const spec = await readFile(new URL('../docs/specs/05-navegacao-mobile-movimento.md', import.meta.url), 'utf8');
  assert.match(spec, /Com uma ação em andamento \(`ocupado`\), as abas ficam desligadas\./);
});
