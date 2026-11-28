// Fila C (pedido do Lead, 23/11): abrir a trilha com o servidor lento. Se o detalhe da trilha falhava ao abrir o Studoo, a web parava em "Minhas trilhas" sem erro nem botão (o catch engolia a falha).
// Agora a falha cai no mesmo cartão de erro da carga da lista, com "Tentar novamente" (o mesmo texto do app, `tentar-planos`), e a sessão vencida leva ao login.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mensagens } from '@studoo/contratos/experiencia';

const raiz = resolve(import.meta.dirname, '..');
const estudo = readFileSync(join(raiz, 'src/app/estudo.tsx'), 'utf8');
const inicio = estudo.indexOf('const carregar = useCallback(');
const carregar = estudo.slice(inicio, estudo.indexOf('const sincronizarAgora = useCallback(', inicio));

test('abrir a trilha: a falha do detalhe da trilha inicial não é engolida (antes, um catch vazio deixava a pessoa em "Minhas trilhas" sem aviso)', () => {
  const ramo = carregar.slice(carregar.indexOf('const inicial = planoInicial(ativos);'), carregar.indexOf("setInicio('pronto');\n    } catch (falha) {"));
  assert.ok(ramo.length > 0, 'o ramo que abre a trilha em andamento');
  assert.match(ramo, /const plano = await cliente\.obterPlano\(inicial\.id\);\s*if \(cancelado\(\)\) return;\s*setTela\(\{ tipo: 'plano', plano \}\);/);
  assert.doesNotMatch(ramo.replace(/\/\/.*$/gm, ''), /\bcatch\b/, 'sem catch ali (fora dos comentários): a falha segue para o catch da função, que a mostra');
});

test('abrir a trilha: o catch da função leva ao login se a sessão venceu e, nos outros casos, mostra o cartão de erro (a abertura fica em "falha")', () => {
  const captura = carregar.slice(carregar.indexOf('} catch (falha) {', carregar.indexOf('const inicial = planoInicial(ativos);')));
  assert.match(captura, /const codigo = falha instanceof ErroStudoo \? falha\.codigo : 'rede';/, 'uma queda de conexão (que não é um ErroStudoo) vale como "rede"');
  assert.match(captura, /if \(codigo === 'nao_autenticado'\) \{\s*irParaLogin\(true\);\s*return;\s*\}/, 'sessão vencida: login');
  assert.match(captura, /setErro\(codigo\);\s*setSincronia\(\(anterior\) => \(\{ estado: 'offline', em: anterior\.em \}\)\);\s*setInicio\('falha'\);/);
});

test('abrir a trilha: o cartão de erro tem "Tentar novamente", que busca a lista e abre a trilha de novo, e a lista não aparece junto', () => {
  assert.equal(mensagens.tentarNovamente, 'Tentar novamente');
  const acao = estudo.slice(estudo.indexOf('const acaoDoErro = '), estudo.indexOf('return (\n    <PostarNoPerfil'));
  assert.match(acao, /if \(inicio === 'falha'\) setInicio\('carregando'\);\s*setErro\(null\);\s*void carregar\(\(\) => false\);/, 'recarrega tudo (sessão, lista e a trilha em andamento)');
  assert.match(acao, /\{mensagens\.tentarNovamente\}/);
  assert.match(estudo, /\{erro && <EstadoErro codigo=\{erro\}>\{acaoDoErro\(erro\)\}<\/EstadoErro>\}/, 'o cartão de erro é o de sempre');
  // A lista já foi carregada quando o detalhe falha: com a abertura em "falha" ela não pode aparecer abaixo do cartão.
  assert.match(estudo, /\{visivel && inicio !== 'falha' && tela\.tipo === 'planos' && planos\.length > 0 && \(\(\) => \{/);
});
