// Defeito do Lead (23/11, site publicado): o aviso "Música de fundo ligada. [Desligar]" cobria o título "O que você quer aprender?" na primeira tela do visitante em 768 px (e encostava no mascote em 390).
// O aviso continua no alto, 8 px abaixo do cabeçalho (spec 16, item 14), mas reserva a altura dele no fluxo da página enquanto está à vista: o que vem logo depois do cabeçalho desce a altura do aviso mais
// o respiro, e o aviso fica na faixa aberta. Num cabeçalho preso (o do mapa no celular, o da aula), que o conteúdo atravessa ao rolar, o cabeçalho ganha uma faixa do mesmo fundo atrás do aviso.
// Regra da saída (Designer, spec 16 item 14, commit 4d455af): quando o aviso sai (7 s, "Desligar" ou o balão do nó), o espaço continua até a pessoa trocar de tela; o conteúdo não sobe de volta na mesma tela
// (um salto de 56 px para cima, 7 s depois, mudaria de lugar o botão que ela ia tocar); na tela seguinte o espaço não existe mais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MARCA_DA_TELA, RESPIRO_DO_AVISO, TOPO_DA_PAGINA, chaveDaTela, criarEspacoDoAviso, quemDesce, reservaDoAviso } from '../src/app/aviso-musica-regras.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');

test('a reserva é a altura do aviso mais o respiro de 8 px (o aviso de 48 px reserva 56 px)', () => {
  assert.equal(RESPIRO_DO_AVISO, 8);
  assert.equal(reservaDoAviso(48), 56);
  assert.equal(reservaDoAviso(47.2), 56, 'arredonda a altura para cima');
  assert.equal(reservaDoAviso(72), 80, 'com o texto em duas linhas o aviso é mais alto, e a reserva acompanha');
});

test('quem desce: o que vem logo depois do cabeçalho; sem cabeçalho à vista, o conteúdo principal, mas só com a página no alto', () => {
  const [a, b, principal] = ['depois do app', 'depois do mapa', 'principal'];
  assert.equal(quemDesce(1, [a, b], principal, 0), b, 'o cabeçalho escolhido é o segundo');
  assert.equal(quemDesce(0, [a, b], principal, 500), a, 'com cabeçalho à vista, a rolagem não importa');
  assert.equal(quemDesce(-1, [a, b], principal, 0), principal, 'o computador não tem a faixa: desce o conteúdo principal');
  assert.equal(quemDesce(-1, [a, b], principal, TOPO_DA_PAGINA - 1), principal);
  assert.equal(quemDesce(-1, [a, b], principal, TOPO_DA_PAGINA), null, 'página rolada: nada se mexe sob a pessoa');
  assert.equal(quemDesce(-1, [a, b], principal, 900), null);
  assert.equal(quemDesce(0, [null, b], principal, 0), null, 'cabeçalho sem irmão seguinte: nada desce');
  assert.equal(quemDesce(-1, [a, b], null, 0), null, 'sem conteúdo principal na tela: nada desce');
});

test('o componente marca quem desce e escreve a altura numa variável; rolar a página não troca quem desce', () => {
  const fonte = ler('src/app/ambiente-som.tsx');
  assert.match(fonte, /function marcarEspaco\(elemento: HTMLElement, px: number\) \{/);
  assert.match(fonte, /elemento\.setAttribute\('data-aviso-musica-abaixo', ''\);/, 'o elemento que desce leva a marca');
  assert.match(fonte, /elemento\.style\.setProperty\('--aviso-musica-reserva', `\$\{px\}px`\);/, 'e a altura do aviso mais o respiro');
  // O navegador anota o zero antes do valor: a descida é animada.
  assert.match(fonte, /elemento\.style\.setProperty\('--aviso-musica-reserva', '0px'\);\s*elemento\.setAttribute\('data-aviso-musica-abaixo', ''\);\s*void elemento\.offsetHeight;/);
  assert.match(fonte, /if \(evento\?\.type === 'scroll'\) return;/, 'rolar a página reposiciona o aviso, mas não troca quem desce (o conteúdo não pula sob o dedo)');
  assert.match(fonte, /espaco\.reservar\(quemDesce\(indice, proximos, document\.getElementById\('conteudo-principal'\), scrollY\), reservaDoAviso\(altura\), tela\);/);
  assert.match(fonte, /const proximos = elementos\.map\(\(cabecalho\) => cabecalho\.nextElementSibling as HTMLElement \| null\);/, 'quem vem logo depois do cabeçalho');
  assert.match(fonte, /new MutationObserver\(\(\) => posicionar\(\)\)/, 'a tela mudou: confere de novo quem desce');
});

test('a saída: o aviso some (7 s, "Desligar" ou balão do nó) e o espaço fica; só a troca de tela o solta, na hora', () => {
  const fonte = ler('src/app/ambiente-som.tsx');
  // Tirar a marca devolve o elemento ao lugar na hora: a transição vive na regra da marca, que sai com ela.
  assert.match(fonte, /function soltarEspaco\(elemento: HTMLElement\) \{\s*elemento\.removeAttribute\('data-aviso-musica-abaixo'\);\s*elemento\.style\.removeProperty\('--aviso-musica-reserva'\);\s*\}/);
  // A saída do aviso (a limpeza do efeito que o mostra) tira só a faixa do cabeçalho preso; o espaço não é solto ali.
  const limpeza = /return \(\) => \{\s*\/\/ O aviso sai[^\n]*\n\s*marcarFaixa\(null, 0\);([\s\S]*?)\};\s*\}, \[visivel, caminho, espaco\]\);/.exec(fonte)?.[1] ?? '';
  assert.ok(limpeza.length > 0, 'achei a limpeza do efeito do aviso');
  assert.doesNotMatch(limpeza, /soltarEspaco|espaco\.|devolver|setTimeout/, 'a saída do aviso não solta o espaço, nem devagar');
  assert.doesNotMatch(fonte, /function devolver|--aviso-musica-reserva', '0px'\);\s*window\.setTimeout/, 'o retorno devagar (320 ms) saiu');
  // Fora de cena, uma conferência liga e desliga sozinha: a marca da tela do app ou o endereço mudaram, o espaço sai.
  const conferencia = /useEffect\(\(\) => \{\s*if \(visivel \|\| !espaco\.elemento\(\)\) return;([\s\S]*?)\}, \[visivel, caminho, espaco\]\);/.exec(fonte)?.[1] ?? '';
  assert.match(conferencia, /espaco\.conferir\(telaDeAgora\(\)\);/);
  assert.match(conferencia, /mudanca\.observe\(document\.body, \{ childList: true, subtree: true, attributes: true, attributeFilter: \['data-tela'\] \}\);/);
  assert.match(conferencia, /window\.addEventListener\('popstate', conferir\);/);
  assert.match(conferencia, /if \(!espaco\.elemento\(\)\) mudanca\.disconnect\(\);/, 'solto o espaço, a conferência desliga');
  // Com o aviso ainda à vista, a tela de antes sai na hora e a desta tela é pedida de novo.
  assert.match(fonte, /const tela = telaDeAgora\(\);\s*espaco\.conferir\(tela\);\s*espaco\.reservar\(/);
  // A tela de agora: o endereço e a marca do cabeçalho do app, que existe em toda tela do app (mesmo com a faixa escondida).
  assert.match(fonte, /chaveDaTela\(window\.location\.pathname, document\.querySelector\(MARCA_DA_TELA\)\?\.getAttribute\('data-tela'\) \?\? null\)/);
  assert.equal(MARCA_DA_TELA, '.estudo-cabecalho[data-tela]');
  assert.match(ler('src/app/estudo.tsx'), /<header className="estudo-cabecalho" data-tela=\{tela\.tipo\}/, 'cada tela do app (mapa, lição, perfil, nova trilha…) marca o cabeçalho');
});

test('a tela é o endereço mais a marca do app: trocar de tela muda a chave; mudar de etapa dentro da lição não', () => {
  assert.equal(chaveDaTela('/', 'licao'), '/|licao');
  assert.notEqual(chaveDaTela('/', 'licao'), chaveDaTela('/', 'plano'));
  assert.notEqual(chaveDaTela('/', 'perfil'), chaveDaTela('/t/abc', 'perfil'));
  assert.equal(chaveDaTela('/entrar', null), '/entrar|');
});

/** Um elemento de mentira, com o que o componente liga e desliga nele (a marca e a altura): o que o navegador veria. */
const elemento = (nome, vivo = true) => ({ nome, marca: false, px: null, vivo });
function novoEspaco() {
  const eventos = [];
  const espaco = criarEspacoDoAviso({
    marcar(el, px) { el.marca = true; el.px = px; eventos.push(`marcar ${el.nome} ${px}`); },
    soltar(el) { el.marca = false; el.px = null; eventos.push(`soltar ${el.nome}`); },
    vivo: (el) => el.vivo,
  });
  return { espaco, eventos };
}

test('o aviso some por tempo e o conteúdo não mexe na mesma tela; na tela seguinte o espaço não existe', () => {
  const { espaco, eventos } = novoEspaco();
  const principal = elemento('principal');
  // O aviso entra na primeira tela: o conteúdo desce 56 px.
  espaco.reservar(principal, 56, '/|objetivo');
  assert.deepEqual([principal.marca, principal.px], [true, 56]);
  // Passam os 7 s: o aviso sai (o componente não chama nada) e a página muda por dentro (digitar, animar, outra etapa): a conferência é da mesma tela.
  for (let i = 0; i < 5; i += 1) espaco.conferir('/|objetivo');
  assert.deepEqual([principal.marca, principal.px], [true, 56], 'o espaço continua: nada sobe de volta na mesma tela');
  assert.equal(espaco.elemento(), principal);
  assert.deepEqual(eventos, ['marcar principal 56'], 'nenhum "soltar" na mesma tela');
  // A pessoa troca de tela: o espaço sai na hora.
  espaco.conferir('/|planos');
  assert.deepEqual([principal.marca, principal.px], [false, null]);
  assert.equal(espaco.elemento(), null);
  // Na tela seguinte o aviso já saiu: ninguém pede espaço de novo, e ele não existe.
  espaco.conferir('/|planos');
  assert.deepEqual(eventos, ['marcar principal 56', 'soltar principal']);
});

test('o aviso some pelo "Desligar" (ou pelo balão do nó) do mesmo jeito: o espaço fica e só sai com a troca de tela', () => {
  const { espaco, eventos } = novoEspaco();
  const caminho = elemento('caminho');
  espaco.reservar(caminho, 56, '/|plano');
  // O balão de um nó abre e fecha o aviso na hora: o mapa não pode pular sob o dedo que tocou o nó.
  espaco.conferir('/|plano');
  assert.equal(caminho.marca, true);
  // O mesmo vale para "Desligar" e para a página que rolou (sem cabeçalho à vista, o componente pede espaço a ninguém: o que já estava fica).
  espaco.reservar(null, 56, '/|plano');
  assert.equal(caminho.marca, true);
  assert.equal(espaco.elemento(), caminho);
  espaco.conferir('/|licao');
  assert.equal(caminho.marca, false);
  assert.deepEqual(eventos, ['marcar caminho 56', 'soltar caminho']);
});

test('com o aviso ainda à vista, a troca de tela passa o espaço para a tela nova; e o elemento que saiu da página também solta', () => {
  const { espaco, eventos } = novoEspaco();
  const mapa = elemento('mapa');
  const aula = elemento('aula');
  espaco.reservar(mapa, 56, '/|plano');
  // Ainda à vista, o aviso muda de tela: a de antes sai e a nova ganha o espaço (o aviso a acompanha).
  espaco.conferir('/|licao');
  espaco.reservar(aula, 56, '/|licao');
  assert.deepEqual([mapa.marca, aula.marca], [false, true]);
  // Sair com o espaço no elemento que já nem está na página (a tela foi trocada por dentro): solta, sem deixar rastro.
  aula.vivo = false;
  espaco.conferir('/|licao');
  assert.equal(espaco.elemento(), null);
  assert.deepEqual(eventos, ['marcar mapa 56', 'soltar mapa', 'marcar aula 56', 'soltar aula']);
  // E reservar no mesmo elemento de novo só atualiza a altura (o texto do aviso quebrou em duas linhas): não solta no meio.
  const { espaco: outro, eventos: eventos2 } = novoEspaco();
  const principal = elemento('principal');
  outro.reservar(principal, 56, '/|objetivo');
  outro.reservar(principal, 80, '/|objetivo');
  assert.deepEqual(eventos2, ['marcar principal 56', 'marcar principal 80']);
});

test('só o cabeçalho preso (sticky) ganha a faixa atrás do aviso', () => {
  const fonte = ler('src/app/ambiente-som.tsx');
  assert.match(fonte, /marcarFaixa\(indice >= 0 && getComputedStyle\(elementos\[indice\]\)\.position === 'sticky' \? elementos\[indice\] : null, altura\);/);
  assert.match(fonte, /novo\.setAttribute\('data-aviso-musica-faixa', ''\);/);
  assert.match(fonte, /faixa\.removeAttribute\('data-aviso-musica-faixa'\);/);
});

test('o CSS: a margem de quem desce acompanha a variável, com transição; a faixa do cabeçalho preso tem o mesmo fundo e é parte dele', () => {
  const css = ler('src/ui/aviso.css');
  assert.match(css, /html \[data-aviso-musica-abaixo\] \{ margin-top: var\(--aviso-musica-reserva, 0px\); transition: margin-top 220ms ease-out; \}/);
  const faixa = /\[data-aviso-musica-faixa\]::after \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(faixa, /position: absolute; inset: 100% 0 auto 0;/, 'logo embaixo do cabeçalho, na largura dele');
  assert.match(faixa, /height: calc\(var\(--aviso-musica-reserva, 0px\) \+ 8px\);/, 'a altura do aviso, o respiro e mais 8 px de folga embaixo');
  assert.match(faixa, /background: inherit;/, 'o mesmo fundo do cabeçalho');
  assert.doesNotMatch(faixa, /pointer-events: none/, 'o toque na faixa é do cabeçalho: não chega ao que está escondido por trás');
  // O aviso em si não mudou: no alto, sem pegar o toque do que está fora do "Desligar".
  assert.match(css, /\.aviso-musica \{ top: calc\(env\(safe-area-inset-top, 0px\) \+ 8px\); bottom: auto; \}/);
  assert.match(css, /\.aviso-app \{[^}]*pointer-events: none;/);
});

test('os cabeçalhos presos que o aviso respeita (o do mapa no celular e o da aula) existem como sticky no CSS', () => {
  assert.match(ler('src/app/trilha.css'), /\.trilha-topo \{\s*position: sticky; top: 0;/);
  assert.match(ler('src/app/aula.css'), /\.aula-topo \{ position: sticky;/);
});
