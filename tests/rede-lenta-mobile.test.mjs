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

test('3: durante a correção de uma resposta, dá para sair da lição; a resposta atrasada não mexe mais na tela; a conclusão trava', async () => {
  const licao = await readFile(new URL('../apps/mobile/src/licao.tsx', import.meta.url), 'utf8');
  assert.match(licao, /testID="voltar-plano" desativado=\{ocupado && pendente !== 'avaliar'\} acao=\{sair\}/);
  // Só a correção (avaliar) pode ser abandonada; a conclusão continua travando o voltar.
  const abandonar = estudo.slice(estudo.indexOf('function abandonarCorrecao()'), estudo.indexOf('function atualizarObjetivo('));
  assert.match(abandonar, /if \(pendenteAgora\.current !== 'avaliar'\) return false;\n\s*acaoAtual\.current \+= 1;/);
  // Cada pedido tem a sua vez: o abandonado não limpa o "ocupado" do pedido novo nem mostra erro em outra tela.
  const executar = estudo.slice(estudo.indexOf('async function executar<T>('), estudo.indexOf('function abandonarCorrecao()'));
  assert.match(executar, /const vez = \+\+acaoAtual\.current;/);
  assert.match(executar, /if \(vez !== acaoAtual\.current\) return \{ ok: false, codigo: codigoDaFalha\(falha\) \};/);
  assert.match(executar, /finally \{\n\s*if \(vez === acaoAtual\.current\) \{/);
  // O X da lição e o voltar do sistema (Android) usam o mesmo caminho.
  assert.match(estudo, /voltar=\{\(\) => \{ abandonarCorrecao\(\); void abrirPlano\(etapa\.plano\.id, etapa\.licao\.id\); \}\}/);
  assert.match(estudo, /if \(emCurso\.current && !\(etapa\.tipo === 'licao' && abandonarCorrecao\(\)\)\) return true;/);
  // Ao abrir o mapa, a lição sai da tela (o esqueleto entra), e a resposta digitada fica no andamento guardado.
  assert.match(estudo, /if \(pendente === 'plano'\) return <Tela pagina="carregando-trilha"/);
  assert.match(licao, /andamentos\.set\(licao\.id, \{\n\s*versao: VERSAO_ETAPAS_AULA, rascunhoEnsino, passo, respostas,/);
});
