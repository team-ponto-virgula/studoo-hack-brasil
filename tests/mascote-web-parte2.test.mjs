// Mascote na web, parte 2 (spec 13, §B4 revista, §A2 e §E6): o Stu novo em todo lugar, o troféu do kit no fim do mapa,
// o Stu comemorando no passo 4 da apresentação, as três animações da reação carregadas antes, o teto de 250 KB de
// animação por tela e a acolhida grande fora do celular.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CATALOGO_STU } from '@studoo/contratos';
import { elementos, renderizarBoasVindas, renderizarEntrada } from './auxiliares/render-acesso.mjs';

const raiz = resolve(import.meta.dirname, '..');
const ler = (arquivo) => readFileSync(join(raiz, arquivo), 'utf8');
const fontes = (pasta) => readdirSync(join(raiz, pasta)).flatMap((nome) => {
  const caminho = join(pasta, nome);
  if (statSync(join(raiz, caminho)).isDirectory()) return fontes(caminho);
  return /\.tsx$/.test(nome) ? [caminho] : [];
});

test('o Stu da web é o mascote novo, e todo uso diz a expressão e o tamanho', () => {
  assert.match(ler('src/ui/componentes.tsx'), /return <Mascote expressao=\{expressao\} tamanho=\{tamanho\}/);
  for (const arquivo of fontes('src')) {
    const usos = ler(arquivo).match(/<Stu\b[^>]*\/>/g) ?? [];
    for (const uso of usos) assert.match(uso, /expressao=.*tamanho=\{\d+\}/, `${arquivo}: ${uso}`);
  }
});

test('fim do mapa: o troféu do kit a 72% da lente branca de borda #E0A92E, em silhueta antes e em cor cheia depois', () => {
  const caminho = ler('src/ui/caminho.tsx');
  const chegada = caminho.slice(caminho.indexOf('className="caminho-chegada__lente"'), caminho.indexOf('</button>', caminho.indexOf('className="caminho-chegada__lente"')));
  assert.match(chegada, /<Mascote expressao="acessorio-trofeu" tamanho=\{73\} className="caminho-chegada__trofeu" \/>/);
  assert.doesNotMatch(chegada, /<Icone nome="trofeu"/);
  const css = ler('src/ui/caminho.css');
  const fim = css.slice(css.lastIndexOf('/* Fim do mapa'));
  assert.match(fim, /background: #fff;\s*box-shadow: inset 0 0 0 3px #e0a92e, 0 8px 0 #c7922a/);
  assert.match(fim, /\.caminho-chegada__trofeu \{ width: 72%;/);
  assert.match(fim, /\.caminho-chegada:not\(\[data-feita\]\) \.caminho-chegada__trofeu \{ filter: grayscale\(1\); opacity: 0\.4; \}/);
  assert.doesNotMatch(fim, /\[data-feita\] \.caminho-chegada__trofeu \{[^}]*filter/, 'em cor cheia depois da conquista');
});

test('passo 4 da apresentação: o Stu comemorando em 40 px ao lado do troféu da miniatura', () => {
  const arte = ler('src/app/apresentacao.tsx');
  const progresso = arte.slice(arte.indexOf('function ArteProgresso'), arte.indexOf('function MiniEstrada'));
  assert.match(progresso, /mini-trilha__no--trofeu[^\n]*--x': '38%', '--y': '20%'/);
  assert.match(progresso, /<span className="mini-trilha__stu" style=\{\{ '--x': '55%', '--y': '20%' \}[^>]*>\s*<Stu expressao="stu-comemorando" tamanho=\{40\}/);
  assert.match(ler('src/app/apresentacao.css'), /\.mini-trilha__stu \{ position: absolute;[^}]*width: 40px;[^}]*pointer-events: none;/);
});

test('a aula carrega antes só as três animações da reação (até 210 KB) e o resto da aula fica parado', () => {
  const aula = ler('src/app/aula.tsx');
  assert.match(aula, /precarregarAnimacoesStu\(telaDaAula\.current, \['stu-feliz', 'stu-comemorando', 'stu-encorajador'\], 48\)/);
  assert.match(aula, /<article ref=\{telaDaAula\} className="painel painel--aula"/);
  const animados = [...aula.matchAll(/<(?:Stu|Mascote)\b[^>]*animado=[^>]*>/g)].map(([uso]) => uso);
  assert.equal(animados.length, 1, 'só a reação do painel se mexe na aula');
  assert.match(animados[0], /expressao=\{expressaoDaReacao\} tamanho=\{48\} animado="acontecimento"/);
  // Os arquivos de 96 px (o painel em 48 px numa tela 2x) somam até 210 KB.
  const de96 = ['stu-feliz', 'stu-comemorando', 'stu-encorajador']
    .map((nome) => CATALOGO_STU[nome].animacao.web.find((arquivo) => arquivo.px === 96).bytes);
  assert.ok(de96.reduce((a, b) => a + b, 0) <= 210_000, String(de96));
});

test('teto de 250 KB de animação por tela: cada arquivo conta uma vez, o que passa fica parado e um painel novo zera', async () => {
  globalThis.window = { location: { pathname: '/' } };
  const { reservarAnimacao, TETO_ANIMACAO_POR_TELA } = await import('../src/ui/mascote.tsx');
  assert.equal(TETO_ANIMACAO_POR_TELA, 250_000);
  const painel = {};
  const dentro = { closest: (seletor) => (seletor === '.painel' ? painel : null) };
  assert.equal(reservarAnimacao(dentro, 'a.webp', 120_000), true);
  assert.equal(reservarAnimacao(dentro, 'a.webp', 120_000), true, 'o mesmo arquivo não conta de novo');
  assert.equal(reservarAnimacao(dentro, 'b.webp', 120_000), true);
  assert.equal(reservarAnimacao(dentro, 'c.webp', 20_000), false, 'passaria de 250 KB');
  assert.equal(reservarAnimacao(dentro, 'd.webp', 10_000), true, 'o que ainda cabe entra');
  const outroPainel = {};
  assert.equal(reservarAnimacao({ closest: () => outroPainel }, 'c.webp', 200_000), true, 'tela nova começa do zero');
  assert.equal(reservarAnimacao({ closest: () => null }, 'e.webp', 260_000), false, 'fora de painel vale a rota');
  const componente = ler('src/ui/mascote.tsx');
  assert.match(componente, /if \(arquivo && reservarAnimacao\(caixa\.current, arquivo\.arquivo, arquivo\.bytes\)\) setAnimado1/);
  assert.match(componente, /const mostrar = mover && comVez && animado1 !== null;/);
  delete globalThis.window;
});

test('o login mantém só a marca e as boas-vindas apresentam o Stu estático em destaque', () => {
  assert.equal(elementos(renderizarEntrada(), 'img').some(e => /stu-/.test(e.getAttribute('src') || '')), false);
  const mascotes = elementos(renderizarBoasVindas(), 'img').filter(e => /stu-/.test(e.getAttribute('src') || ''));
  assert.equal(mascotes.length, 1);
  assert.match(mascotes[0].getAttribute('src'), /stu-acolhida-320\.webp$/);
  assert.equal(mascotes[0].getAttribute('alt'), '', 'o personagem acompanha uma promessa textual equivalente');
  assert.doesNotMatch(mascotes[0].getAttribute('src'), /animado/);
});

test('o Stu antigo (stu-oi) saiu da web: nenhum uso em src/ e os dois arquivos apagados (spec 13, A2)', () => {
  const usos = [];
  const varrer = (pasta) => readdirSync(join(raiz, pasta)).forEach((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(join(raiz, caminho)).isDirectory()) varrer(caminho);
    else if (/\.(ts|tsx|css|mjs|js)$/.test(nome) && ler(caminho).includes('stu-oi')) usos.push(caminho);
  });
  varrer('src');
  assert.deepEqual(usos, []);
  assert.equal(existsSync(join(raiz, 'public/marca/stu-oi.svg')), false);
  assert.equal(existsSync(join(raiz, 'docs/marca/stu-oi.svg')), false);
});
