// Confere os fluxos do Maestro contra o código do app, sem simulador: é o primeiro passo do workflow, para um seletor
// que deixou de existir aparecer em segundos, e não depois de meia hora de máquina.
//
// O que confere:
//   1. todo `id:` usado num fluxo existe como `testID` em apps/mobile/src (um `testID` montado com `${...}` vale como molde),
//      fora os poucos ids do próprio Expo Go, listados abaixo;
//   2. as capturas do percurso (nomes que começam por dois dígitos) são exatamente as da lista CAPTURAS_ESPERADAS de
//      comum.sh (a mesma para o iPhone e o Android);
//   3. todo arquivo de `runFlow` existe;
//   4. a ordem em telas/config.yaml cita exatamente os fluxos de telas/, e o `name` de cada fluxo é o nome do arquivo.
//
// Uso, na raiz do repositório: node apps/mobile/conferencia-nativa/conferir-fluxos.mjs
// Sem dependências: lê os YAML linha a linha (os fluxos daqui só usam chaves simples).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../../..');
const pastaFluxos = join(aqui, 'fluxos');
const pastaApp = join(raiz, 'apps/mobile/src');
const problemas = [];

const arquivosDe = (pasta, filtro) => readdirSync(pasta, { withFileTypes: true })
  .flatMap((item) => (item.isDirectory() ? arquivosDe(join(pasta, item.name), filtro) : filtro(item.name) ? [join(pasta, item.name)] : []));
const semAspas = (valor) => valor.trim().replace(/^(["'])(.*)\1$/, '$2');
const curto = (arquivo) => relative(raiz, arquivo);

// --- 1. Os testID do app: os literais e os moldes (`nav-${item.id}` vira /^nav-.+$/).
const literais = new Set();
const moldes = [];
for (const arquivo of arquivosDe(pastaApp, (nome) => /\.tsx?$/.test(nome))) {
  const codigo = readFileSync(arquivo, 'utf8');
  for (const [, valor] of codigo.matchAll(/testID(?:=|:\s*)\{?\s*["']([^"']+)["']/g)) literais.add(valor);
  for (const [, valor] of codigo.matchAll(/testID(?:=|:\s*)\{?\s*`([^`]+)`/g)) {
    const fixos = valor.split(/\$\{[^}]*\}/);
    // Um molde sem texto fixo (`${id}`, `${prefixo}-${codigo}`) não diz nada: quem o usa passa o identificador por outro `testID`.
    if (!/[A-Za-z0-9]/.test(fixos.join(''))) continue;
    // Cada trecho variável é uma palavra só (`nav-${item.id}`), para um id inventado como "nav-perfil-antigo" não
    // passar. O trecho variável do começo (`${testID}-menu`) é outro `testID` inteiro: fica num grupo, conferido à parte.
    const comPrefixo = fixos[0] === '';
    const padrao = fixos.map((fixo) => fixo.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&'))
      .reduce((junto, fixo, indice) => junto + (indice === 1 && comPrefixo ? '(.+)' : '[A-Za-z0-9_]+') + fixo);
    moldes.push({ expressao: new RegExp(`^${padrao}$`), comPrefixo });
  }
  // Um `testID` que chega por propriedade e é escolhido entre dois literais: testID={a ? 'x' : 'y'}.
  for (const [, a, b] of codigo.matchAll(/testID=\{[^}]*\?\s*'([^']+)'\s*:\s*'([^']+)'\s*\}/g)) { literais.add(a); literais.add(b); }
}
// Ids do próprio Expo Go, que os fluxos usam para sair do menu de desenvolvedor: não são testID do app. São os nomes dos
// símbolos que o menu desenha (pacote expo-dev-menu): o "X" do menu e a engrenagem do botão flutuante.
const idsDoExpoGo = new Set(['xmark', 'gearshape.fill']);

/** O id existe se é um literal ou cabe num molde; no molde com prefixo (`${testID}-menu`), o prefixo também precisa existir. */
function existeNoApp(id) {
  if (literais.has(id) || idsDoExpoGo.has(id)) return true;
  return moldes.some(({ expressao, comPrefixo }) => {
    const achado = expressao.exec(id);
    return achado !== null && (!comPrefixo || existeNoApp(achado[1]));
  });
}

const fluxos = arquivosDe(pastaFluxos, (nome) => nome.endsWith('.yaml') && nome !== 'config.yaml');
const capturas = new Map();

for (const arquivo of fluxos) {
  const linhas = readFileSync(arquivo, 'utf8').split('\n');
  const texto = linhas.filter((linha) => !linha.trim().startsWith('#')).join('\n');

  for (const [, valor] of texto.matchAll(/^\s*id:\s*(.+)$/gm)) {
    // O `id` de um fluxo é uma expressão regular: aqui só se usa a alternância (a|b).
    for (const id of semAspas(valor).split('|')) {
      if (!existeNoApp(id)) problemas.push(`${curto(arquivo)}: o id "${id}" não existe como testID em apps/mobile/src.`);
    }
  }

  // --- 3. Arquivos de runFlow (forma curta e forma com `file:`).
  for (const [, valor] of texto.matchAll(/^[ \t]*-?[ \t]*(?:runFlow|file):[ \t]*(\S.*)$/gm)) {
    const alvo = semAspas(valor);
    if (!alvo.endsWith('.yaml')) continue;
    if (!existsSync(resolve(dirname(arquivo), alvo))) problemas.push(`${curto(arquivo)}: o fluxo "${alvo}" não existe.`);
  }

  // --- 2. Capturas: o nome direto, ou o molde do fluxo de exercício (${CAPTURA}) preenchido por quem o chama. As do
  // percurso começam por dois dígitos; uma imagem de diagnóstico (aviso-…) não entra na conta.
  for (const [, valor] of texto.matchAll(/^\s*-\s*takeScreenshot:\s*(.+)$/gm)) {
    const nome = semAspas(valor);
    if (!nome.includes('${') && /^\d\d-/.test(nome)) capturas.set(nome, curto(arquivo));
  }
  for (const [, valor] of texto.matchAll(/^\s*CAPTURA:\s*(.+)$/gm)) {
    const base = semAspas(valor);
    const parte = readFileSync(join(pastaFluxos, 'partes/exercicio.yaml'), 'utf8');
    for (const [, molde] of parte.matchAll(/^\s*-\s*takeScreenshot:\s*(.+)$/gm)) capturas.set(semAspas(molde).replace('${CAPTURA}', base), curto(arquivo));
  }
}

const script = readFileSync(join(aqui, 'comum.sh'), 'utf8');
const esperadas = new Set((script.match(/CAPTURAS_ESPERADAS="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean));
if (esperadas.size === 0) problemas.push('comum.sh: não achei a lista CAPTURAS_ESPERADAS.');
for (const nome of esperadas) if (!capturas.has(nome)) problemas.push(`comum.sh espera a captura "${nome}", mas nenhum fluxo a tira.`);
for (const [nome, arquivo] of capturas) if (!esperadas.has(nome)) problemas.push(`${arquivo}: a captura "${nome}" não está em CAPTURAS_ESPERADAS (comum.sh).`);

// --- 4. O conjunto das telas: a ordem cita todos os fluxos, e só eles; o `name` é o nome do arquivo.
const config = readFileSync(join(pastaFluxos, 'telas/config.yaml'), 'utf8');
const ordem = [...(config.split(/flowsOrder:\s*\n/)[1] ?? '').matchAll(/^\s*-\s*(\S+)\s*$/gm)].map(([, nome]) => nome);
const telas = readdirSync(join(pastaFluxos, 'telas')).filter((nome) => nome.endsWith('.yaml') && nome !== 'config.yaml').map((nome) => basename(nome, '.yaml'));
for (const nome of telas) if (!ordem.includes(nome)) problemas.push(`telas/config.yaml: falta "${nome}" em flowsOrder.`);
for (const nome of ordem) if (!telas.includes(nome)) problemas.push(`telas/config.yaml: "${nome}" está em flowsOrder, mas não há telas/${nome}.yaml.`);
for (const arquivo of fluxos.filter((item) => !item.includes(`${join('fluxos', 'partes')}`))) {
  const nome = readFileSync(arquivo, 'utf8').match(/^name:\s*(.+)$/m)?.[1];
  if (semAspas(nome ?? '') !== basename(arquivo, '.yaml')) problemas.push(`${curto(arquivo)}: o \`name\` do fluxo ("${nome ?? 'ausente'}") precisa ser o nome do arquivo.`);
}

if (problemas.length > 0) {
  console.error(`Os fluxos da conferência nativa não batem com o app (${problemas.length}):`);
  for (const problema of problemas) console.error(`- ${problema}`);
  process.exit(1);
}
console.log(`Fluxos conferidos: ${fluxos.length} arquivos, ${capturas.size} capturas, ${literais.size} testID literais e ${moldes.length} moldes no app.`);
