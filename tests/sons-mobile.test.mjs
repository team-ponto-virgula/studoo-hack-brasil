// Sons no app (spec 12, como a web em 161ae9b e tests/sons-web.test.mjs): cada efeito disparado existe no catálogo e tem o
// arquivo do app, os momentos pedidos estão ligados, a convivência com a fala, a gravação e a voz ao vivo segue a máquina
// de estado do som, e o fundo só toca com a sessão ativa, depois do primeiro toque.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const app = join(raiz, 'apps/mobile');
const sons = join(app, 'src/sons.ts');

function arquivos(pasta) {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return nome === 'node_modules' ? [] : arquivos(caminho);
    return /\.(?:ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}
const todos = [...arquivos(join(app, 'src')), ...arquivos(join(app, 'app'))];
const texto = new Map(todos.map((arquivo) => [arquivo, readFileSync(arquivo, 'utf8')]));
const ler = (rel) => texto.get(join(app, rel)) ?? '';

const catalogo = readFileSync(join(raiz, 'packages/contratos/src/catalogo-sons.ts'), 'utf8');
const efeitos = new Map([...catalogo.matchAll(/^\s+(\w+): \{ id: '(\w+)', arquivo: '([\w.-]+)'/gm)].map(([, chave, id, arquivo]) => {
  assert.equal(chave, id, `chave e id do catálogo batem (${chave})`);
  return [id, arquivo];
}));

/**
 * Os disparos no código: os nomes entre aspas no resto da linha de `tocarEfeito(` (pega também a escolha
 * `correta ? 'acerto' : 'erro'`), o som dado a um aviso (`som: 'salvo'`) e o som padrão do aviso do app. Fora o toca-sons.
 */
const disparos = new Map();
const anotar = (id, arquivo) => disparos.set(id, [...(disparos.get(id) ?? []), relative(raiz, arquivo)]);
for (const [arquivo, conteudo] of texto) {
  if (arquivo === sons) continue;
  for (const [, resto] of conteudo.matchAll(/tocarEfeito\((.*)$/gm)) {
    for (const [, id] of resto.split(';')[0].matchAll(/['"](\w+)['"]/g)) anotar(id, arquivo);
  }
  // Só nas opções de um aviso (`{ icone: 'check', som: 'salvo' }`), não no tipo de um parâmetro (`som: 'acorde' | 'batida'`).
  for (const [, id] of conteudo.matchAll(/[{,]\s*som: '(\w+)'/g)) anotar(id, arquivo);
  for (const [, id] of conteudo.matchAll(/opcoes\.som === undefined \? '(\w+)'/g)) anotar(id, arquivo);
}

test('cada efeito disparado no app existe no catálogo e tem o arquivo em apps/mobile/assets/sons/sfx', () => {
  assert.ok(efeitos.size >= 20, 'o catálogo foi lido');
  assert.ok(disparos.size > 0, 'há disparos no código');
  for (const [id, onde] of disparos) {
    assert.ok(efeitos.has(id), `"${id}" (em ${onde.join(', ')}) existe no catálogo`);
    assert.ok(existsSync(join(app, 'assets/sons/sfx', efeitos.get(id))), `arquivo de "${id}" existe no app`);
  }
});

test('os momentos pedidos estão ligados no app', () => {
  // `conta_criada` fica de fora, como na web: o app também não tem formulário de criar conta (e-mail e senha, Google ou visitante).
  const pedidos = ['toque_opcao', 'ordenar_soltar', 'acerto', 'erro', 'ponte_abrir', 'concluir_licao', 'concluir_trilha', 'entrar', 'valeu',
    'seguir', 'link_copiado', 'salvo', 'aviso', 'erro_rede', 'apagar', 'cronometro_inicio', 'cronometro_fim', 'gravacao_inicio', 'gravacao_fim',
    'geracao_licao', 'geracao_pronta'];
  for (const id of pedidos) assert.ok(disparos.has(id), `"${id}" tem disparo`);
  // A reação do Stu no painel de retorno não tem som próprio: só o acerto ou o erro do resultado.
  assert.equal((ler('src/licao.tsx').match(/tocarEfeito\(resultado\.correta \? 'acerto' : 'erro'\)/g) ?? []).length, 1);
});

test('ordenar (tabela de 19/11): escolher toca o toque; trocar e soltar numa posição nova tocam só o soltar', () => {
  const ordenar = ler('src/ordenar.tsx');
  const troca = ordenar.slice(ordenar.indexOf('if (escolhido === id) {'), ordenar.indexOf('/** "Mover para cima"'));
  assert.match(troca, /tocarEfeito\('ordenar_soltar'\)/);
  assert.doesNotMatch(troca, /toque_opcao/, 'no toque que efetiva a troca, sem somar o toque');
  assert.match(ordenar, /if \(final\.join\(','\) !== atual\.inicio\.join\(','\)\) void tocaSons\.tocarEfeito\('ordenar_soltar'\);/,
    'no mesmo lugar, nada');
  assert.match(ordenar, /mudar\(inicial \|\| ids\.join\(','\)\);\n\s*\/\/[^\n]*\n\s*void tocaSons\.tocarEfeito\('toque_opcao'\);/,
    '"Voltar à ordem inicial": um toque só');
});

test('convivência: a fala e o acorde abaixam o fundo; a gravação e a voz ao vivo param, com os dois bipes', () => {
  const formatos = ler('src/aula-formatos.tsx');
  assert.equal((formatos.match(/tocaSons\.entrarEmFala\(\)/g) ?? []).length, 2, 'a voz de leitura e o acorde ou a batida entram');
  assert.equal((formatos.match(/saiu(?:DaFala)? = true; tocaSons\.sairDeFala\(\)/g) ?? []).length, 2, 'uma saída por entrada');
  const estudio = ler('src/estudio-adaptativo.tsx');
  assert.equal((estudio.match(/tocaSons\.entrarEmGravacaoOuVoz\(\)/g) ?? []).length, 2, 'gravação e voz ao vivo entram');
  assert.equal((estudio.match(/tocaSons\.sairDeGravacaoOuVoz\(\)/g) ?? []).length, 2, 'gravação e voz ao vivo saem');
  // A gravação entra antes de trocar o modo de áudio para o microfone (o toca-sons não mexe no modo durante a gravação).
  const gravar = estudio.slice(estudio.indexOf('async function gravar()'));
  assert.ok(gravar.indexOf('entrarNoSomDaGravacao();') < gravar.indexOf('allowsRecording: true'), 'entra antes do modo do microfone');
});

test('a música desde a entrada (login e visitante), as preferências ao abrir e o primeiro toque libera o som', () => {
  const sessao = ler('src/sessao.tsx');
  // Uma música só, em laço no app inteiro (pedido do dono, 19/11): nada a prende à sessão ativa nem a para ao sair da conta.
  assert.doesNotMatch(sessao, /definirAreaPermitida/);
  assert.match(sessao, /tocaSons\.carregarPreferencias\(\)/);
  assert.match(ler('app/index.tsx'), /tocaSons\.registrarGesto\(\);\n\s*return false;/);
  assert.match(ler('app/index.tsx'), /onStartShouldSetResponderCapture=\{liberarSom\}/);
});

test('aviso do app: `aviso` por padrão, `salvo` no perfil e calado quando o gesto já tocou o seu', () => {
  assert.match(ler('src/interface.tsx'), /const som = opcoes\.som === undefined \? 'aviso' : opcoes\.som;\n\s*if \(som\) void tocaSons\.tocarEfeito\(som\);/);
  assert.match(ler('src/perfil.tsx'), /avisar\(p\.salvo, \{ icone: 'check', som: 'salvo' \}\)/);
  assert.match(ler('src/comunidade.tsx'), /avisar\(c\.valeuAviso\(primeiroNome\), \{ icone: 'valeu', duracaoMs: 5000, som: null \}\)/);
  // Sem rede só numa ação da pessoa (pedido que não é GET).
  assert.match(ler('src/api-nativa.ts'), /if \(\(opcoes\.method \?\? 'GET'\)\.toUpperCase\(\) !== 'GET'\) void tocaSons\.tocarEfeito\('erro_rede'\);/);
});

test('criar a trilha (spec 12, revisão de 19/11): cada lição no pouso do nó, no máximo uma a cada 400 ms; o único som de conclusão no aceite', () => {
  const estudo = ler('src/estudo.tsx');
  // A lição: no passo 3 da spec 04 (o mesmo atraso do caminho), à vista, nunca depois da proposta pronta.
  assert.match(estudo, /if \(pronta \|\| mostrados <= de\) return;/);
  assert.match(estudo, /if \(prontaAgora\.current \|\| !aVista \|\| Date\.now\(\) - ultimoPouso\.current < RITMO_DA_GERACAO\.somDaLicaoMinimoMs\) return;/);
  assert.match(estudo, /tocaSons\.tocarEfeito\('geracao_licao'\);\n\s*\}, reduzir !== false \? 0 : atrasosDaLicao\(abreTrecho\)\.no\);/);
  // Sair da tela (cancelar) limpa os relógios.
  assert.match(estudo, /useEffect\(\(\) => \(\) => \{\n\s*for \(const relogio of somDasLicoes\.current\) clearTimeout\(relogio\);\n\s*\}, \[\]\);/);
  // `geracao_pronta`: uma vez, no aceite que voltou ok (depois do aceitarProposta, antes da passagem); a proposta pronta, sem som.
  assert.equal((estudo.match(/tocarEfeito\('geracao_pronta'\)/g) ?? []).length, 1);
  const comecar = estudo.slice(estudo.indexOf('async function comecar('), estudo.indexOf('function terminarCriacao()'));
  assert.ok(comecar.indexOf('await cliente.aceitarProposta') < comecar.indexOf("tocarEfeito('geracao_pronta')"));
  assert.ok(comecar.indexOf("tocarEfeito('geracao_pronta')") < comecar.indexOf("setCriacao('criada')"));
  const fim = estudo.slice(estudo.indexOf('// O fim da proposta:'), estudo.indexOf('function mudarAcompanhar'));
  assert.doesNotMatch(fim.slice(0, fim.indexOf('if (rolado.current <= 4)')), /tocarEfeito/, 'a proposta pronta não tem som');
  // Aquecidos ao abrir a geração.
  assert.match(estudo, /tocaSons\.aquecerEfeitos\(\['geracao_licao', 'geracao_pronta', 'toque_opcao'\]\);/);
  // O troféu, o Stu e o foco em "Começar a lição 1": sem som.
  assert.doesNotMatch(ler('src/caminho.tsx'), /tocarEfeito/);
});
