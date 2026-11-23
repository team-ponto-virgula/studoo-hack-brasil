// Spec 16, item 14 (web): o aviso "Música de fundo ligada." fica sempre no alto, 8 px abaixo do cabeçalho; fecha na hora quando o balão de um nó abre; nunca bloqueia o toque fora dele,
// e só o "Desligar" responde dentro. A conta do lugar é pura (src/app/aviso-musica-regras.ts); o componente mede os cabeçalhos e a usa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BALAO_DO_NO, CABECALHOS_DO_ALTO, RESPIRO_DO_AVISO, cabecalhoDoAlto, lugarDoAviso } from '../src/app/aviso-musica-regras.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const retangulo = (top, altura, left = 0, largura = 390) => ({ top, bottom: top + altura, left, width: largura, height: altura });

test('o aviso fica 8 px abaixo do cabeçalho mais baixo que está à vista no alto da janela', () => {
  const marca = retangulo(0, 52);
  assert.deepEqual(lugarDoAviso(cabecalhoDoAlto([marca], 844), 390), { top: '60px', left: '195px', maxWidth: '358px' });
  // O cabeçalho do app e, mais embaixo, o do mapa: vale o mais baixo.
  const app = retangulo(0, 56);
  const mapa = retangulo(56, 64);
  assert.equal(lugarDoAviso(cabecalhoDoAlto([app, mapa], 844), 390).top, '128px');
  // Um cabeçalho que já rolou para fora, escondido ou lá embaixo na janela não conta.
  assert.equal(cabecalhoDoAlto([retangulo(-200, 100)], 844), null, 'rolou para fora');
  assert.equal(cabecalhoDoAlto([retangulo(10, 0)], 844), null, 'sem altura (display: none)');
  assert.equal(cabecalhoDoAlto([{ top: 10, bottom: 50, left: 0, width: 0, height: 40 }], 844), null, 'sem largura');
  assert.equal(cabecalhoDoAlto([retangulo(700, 60)], 844), null, 'no pé da janela');
  assert.deepEqual(cabecalhoDoAlto([retangulo(-200, 100), app], 844), app, 'o que rolou para fora sai da conta');
  // Sem cabeçalho (o computador, sem faixa), vale o CSS: no alto, a 8 px da borda.
  assert.deepEqual(lugarDoAviso(null, 1280), { top: '', left: '', maxWidth: '' });
  // Colado no topo, o respiro mínimo é de 8 px; num cabeçalho largo, o aviso não passa da largura da janela menos 16 de cada lado.
  assert.equal(lugarDoAviso(retangulo(-40, 44), 390).top, '12px');
  assert.equal(RESPIRO_DO_AVISO, 8);
  assert.equal(lugarDoAviso(retangulo(0, 52, 0, 1280), 1280).maxWidth, '1248px');
  assert.equal(lugarDoAviso(retangulo(0, 52, 100, 700), 1280).left, '450px', 'centrado no cabeçalho');
});

test('os cabeçalhos que o aviso respeita são os das telas do app (entrada, app, mapa, aula, tour e geração)', () => {
  for (const classe of ['.som-marca', '.recuperar-topo', '.estudo-cabecalho', '.trilha-topo', '.aula-topo', '.apresentacao-topo', '.previa-cabecalho', '.previa-placa']) {
    assert.ok(CABECALHOS_DO_ALTO.split(', ').includes(classe), classe);
  }
  assert.equal(BALAO_DO_NO, '.caminho-balao');
  // Cada classe existe de verdade na tela que ela nomeia.
  for (const [arquivo, classe] of [['src/app/login/entrada.tsx', 'som-marca'], ['src/app/cadastro/cadastro.tsx', 'recuperar-topo'], ['src/app/estudo.tsx', 'estudo-cabecalho'], ['src/app/estudo.tsx', 'trilha-topo'],
    ['src/app/aula.tsx', 'aula-topo'], ['src/app/apresentacao.tsx', 'apresentacao-topo'], ['src/app/previa-trilha.tsx', 'previa-cabecalho'], ['src/app/previa-trilha.tsx', 'previa-placa']]) {
    assert.match(ler(arquivo), new RegExp(`className="${classe}[" ]`), `${classe} em ${arquivo}`);
  }
  assert.match(ler('src/ui/caminho.tsx'), /caminho-balao/, 'o balão do nó existe');
});

test('o componente: mede os cabeçalhos, fecha na hora com o balão aberto e não deixa sobrar posição no pé da tela', () => {
  const fonte = ler('src/app/ambiente-som.tsx');
  assert.match(fonte, /if \(document\.querySelector\(BALAO_DO_NO\)\) \{ mostrar\(false\); return; \}/, 'o balão aberto fecha o aviso, sem animação (o parágrafo some do DOM)');
  assert.match(fonte, /lugarDoAviso\(cabecalhoDoAlto\(cabecalhos, innerHeight\), innerWidth\)/);
  assert.doesNotMatch(fonte, /style\.bottom|navegacao-mobile|previa-seguir|previa-rodape/, 'nada de ancorar embaixo, em cima da barra de abas ou dos botões da geração');
  assert.match(fonte, /\{visivel && <p>/, 'fechar é tirar o parágrafo: sem saída animada');
  assert.match(fonte, /window\.setTimeout\(\(\) => mostrar\(false\), 7000\)/, 'some sozinho');
  // Um cabeçalho que ainda se mexe (a placa da geração entra animada) muda de lugar sem mudar o DOM: o aviso confere de novo quando a animação acaba (medido no navegador: 18 px, e não 8, sem isto).
  assert.match(fonte, /document\.addEventListener\('animationend', posicionar, true\);\s*document\.addEventListener\('transitionend', posicionar, true\);/);
  assert.match(fonte, /document\.removeEventListener\('animationend', posicionar, true\);\s*document\.removeEventListener\('transitionend', posicionar, true\);/, 'e solta os ouvintes ao fechar');
});

test('o CSS: o aviso é do alto; o contêiner não recebe toque e só o botão "Desligar" responde', () => {
  const css = ler('src/ui/aviso.css');
  assert.match(css, /\.aviso-musica \{ top: calc\(env\(safe-area-inset-top, 0px\) \+ 8px\); bottom: auto; \}/);
  assert.match(css, /\.aviso-app \{[^}]*pointer-events: none;/, 'o contêiner herda a falta de toque: nunca bloqueia o que está fora do botão');
  assert.match(css, /\.aviso-musica button \{ pointer-events: auto;/, 'só o "Desligar" responde');
  const regraDoTexto = /^\.aviso-musica p \{([^}]*)\}/m.exec(css)?.[1] ?? '';
  assert.ok(regraDoTexto.length > 0 && !/pointer-events/.test(regraDoTexto), 'o texto do aviso não captura toque (herda none)');
  assert.match(css, /@keyframes aviso-desce \{ from \{ opacity: 0; transform: translateY\(-10px\); \} \}/, 'entra descendo do alto');
  assert.doesNotMatch(css, /\.aviso-musica \{ bottom: max\(/, 'a posição no pé da tela saiu');
});
