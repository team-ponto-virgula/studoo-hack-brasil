import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Spec 16 (refinamento de UI), P0 do app: (1) a proposta pronta rola até o nó 1, com o Stu feliz ao lado dele, e não até o
// troféu; (3) o cabeçalho preso do mapa tem fundo branco a 94% sem vidro e a linha de 1 px só quando o mapa passa por baixo.
const ler = (caminho) => readFile(new URL(`../apps/mobile/src/${caminho}`, import.meta.url), 'utf8');
const ritmo = await ler('geracao-ritmo.ts');
const { outputText } = ts.transpileModule(ritmo, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const m = {};
runInNewContext(outputText, { exports: m });
const { RITMO_DA_GERACAO: R, rolagemDaTrilhaPronta } = m;
const estudo = await ler('estudo.tsx');
const caminho = await ler('caminho.tsx');
const interfaceApp = await ler('interface.tsx');
const stickyDoRN = await readFile(new URL('../node_modules/react-native/Libraries/Components/ScrollView/ScrollViewStickyHeader.js', import.meta.url), 'utf8');

test('item 1: a rolagem da proposta pronta dura 600 ms e põe o centro do nó 1 no meio da área livre', () => {
  assert.equal(R.prontaAteNo1Ms, 600);
  // Área livre de 120 (base da placa) a 700 (topo do rodapé): o meio é 410. Nó 1 com centro em 1500 na página: rola 1090.
  assert.equal(rolagemDaTrilhaPronta(1500, 700, 120), 1090);
  // Sem placa (cartão do título de volta no alto): o meio da altura visível.
  assert.equal(rolagemDaTrilhaPronta(1000, 600, 0), 700);
  // O nó 1 já acima do meio: não rola antes do começo.
  assert.equal(rolagemDaTrilhaPronta(200, 700, 120), 0);
});

test('item 1: na virada para pronta, a tela para de seguir o troféu e vai ao nó 1 (direto com movimento reduzido)', () => {
  const pronta = estudo.slice(estudo.indexOf('if (!pronta) return;\n    for (const relogio of somDasLicoes.current)'), estudo.indexOf('}, [pronta]);'));
  assert.match(pronta, /mudarAcompanhar\(false\)/);
  assert.match(pronta, /centrarNo1\(noAlto, RITMO_DA_GERACAO\.prontaAteNo1Ms\)/);
  assert.match(estudo, /rolarAteNo1\(rolagemDaTrilhaPronta\(centro, visivel\.current \|\| height, topoLivre\), duracao\)/);
  // Se a rolagem passa pelo alto e o cartão do título volta, o nó 1 é recentrado (sem a placa), só logo depois da pronta.
  assert.match(estudo, /if \(!cartaoDeVolta \|\| !pronta \|\| !centrarNo1NaPronta\.current\) return;\n    const relogio = setTimeout\(\(\) => centrarNo1\(true, 0\), 50\);/);
  assert.match(pronta, /centrarNo1NaPronta\.current = false; \}, 50 \+ RITMO_DA_GERACAO\.prontaAteNo1Ms \+ 600\)/);
  // rolarAteNo1 pula a animação com movimento reduzido (ou sem saber ainda).
  assert.match(estudo, /const duracao = reduzir === false && Math\.abs\(alvo - de\) >= 2 \? duracaoPedida : 0;/);
  // O troféu continua a uma rolagem: a pílula "Ver o fim da trilha" leva até ele.
  assert.match(estudo, /pronta \? mensagens\.geracao\.verFimDaTrilha/);
});

test('item 1: o Stu feliz fica ao lado do nó 1 na proposta pronta, não ao lado do troféu', () => {
  assert.doesNotMatch(estudo + caminho, /stuNoFim/);
  assert.match(estudo, /stuNoNo1=\{pronta\}/);
  assert.match(caminho, /const stuNaChegada = !montando && tudoFeito && criacao === null;/);
  assert.match(caminho, /indice === 0 && \(criacao !== null \|\| stuNoNo1\) && <StuDoNo1 [^>]*criacao=\{criacao \?\? 'pronta'\}/);
  assert.match(caminho, /criacao === 'pronta' \? \{ nome: 'stu-feliz' \}/);
});

test('item 3: o fundo da faixa presa fica no filho direto do ScrollView (o invólucro que gruda herda o style dele)', () => {
  // O ScrollViewStickyHeader do React Native copia `child.props.style` para o invólucro e troca o do filho por flex: 1.
  assert.match(stickyDoRN, /style: styles\.fill, \/\/ We transfer the child style to the wrapper\./);
  const faixa = interfaceApp.slice(interfaceApp.indexOf('if (faixaFixa) {\n    filhosDeCima.push('), interfaceApp.indexOf('return (\n    <SafeAreaView'));
  assert.match(faixa, /<View key="faixa" style=\{VIDRO \? estilos\.faixaFixaVidro : \[estilos\.faixaFixa, faixaPresa && estilos\.faixaFixaPresa\]\}/);
  assert.doesNotMatch(faixa, /<FundoDeBarra key="faixa"/);
  assert.match(interfaceApp, /faixaFixa: \{ zIndex: 6, backgroundColor: 'rgba\(255, 255, 255, 0\.94\)' \}/);
  assert.match(interfaceApp, /faixaFixaPresa: \{ boxShadow: `0 1px 0 \$\{cores\.gelo\}` \}/);
  // A linha só entra depois que a faixa grudou (o mapa passa por baixo).
  assert.match(interfaceApp, /const presa = Boolean\(faixaFixa\) && !faixaColada && y > inicioDaFaixa \+ 0\.5;/);
});

test('item 1 (revisão 25c75c2): a proposta com aviso ou diagnóstico abre no topo; sem os dois, rola até o nó 1', () => {
  const pronta = estudo.slice(estudo.indexOf('if (!pronta) return;\n    for (const relogio of somDasLicoes.current)'), estudo.indexOf('}, [pronta]);'));
  assert.match(pronta, /const comAviso = deveAbrirNoTopo\(Boolean\(existente\)\) \|\| proposta\?\.diagnostico != null;/);
  // Com o aviso: o cartão do título volta (é nele que o aviso fica), a tela vai ao topo e não rola até o nó 1 nem recentra.
  assert.match(pronta, /const noAlto = comAviso \|\| rolado\.current <= 4;\n\s*if \(noAlto\) setCartaoDeVolta\(true\);/);
  assert.match(pronta, /centrarNo1NaPronta\.current = !comAviso;/);
  assert.match(pronta, /if \(comAviso\) rolagem\.current\?\.scrollTo\(\{ y: 0, animated: false \}\);\n\s*else centrarNo1\(noAlto, RITMO_DA_GERACAO\.prontaAteNo1Ms\);/);
  // O aviso mora no cartão do título do alto, que só aparece com cartaoDeVolta.
  const cartao = estudo.slice(estudo.indexOf('{pronta && proposta && cartaoDeVolta && ('), estudo.indexOf('testID="abrir-existente"'));
  assert.match(cartao, /\{existente && !salvando && \(\n\s*<View testID="trilha-repetida"/);
  // A recentragem pela volta do cartão só vale logo depois da pronta SEM aviso.
  assert.match(estudo, /if \(!cartaoDeVolta \|\| !pronta \|\| !centrarNo1NaPronta\.current\) return;/);
  const inicio = estudo.indexOf('export function deveAbrirNoTopo(');
  const js = ts.transpileModule(estudo.slice(inicio, estudo.indexOf('\n}\n', inicio) + 2).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const deveAbrirNoTopo = new Function(`${js}; return deveAbrirNoTopo;`)();
  assert.equal(deveAbrirNoTopo(true), true);
  assert.equal(deveAbrirNoTopo(false), false);
});
