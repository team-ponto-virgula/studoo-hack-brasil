// Refinamento da UI (spec 16), item 33 (banca P1-3): o visitante tem a mesma navegação da conta. Até 1023 px é a cápsula de abas embaixo (Minhas trilhas, Nova trilha, Explorar quando a comunidade está
// ligada, Perfil); a partir de 1024 px, a lateral. Entre 768 e 1023 px a web usa a cápsula, como no celular, e não os links no alto. Sem trilha, a primeira tela (o pedido) não ganha o foco sozinha até
// 1023 px: com um campo de texto em foco o site esconde a cápsula (teclado aberto), e o visitante ficava sem Explorar nem Perfil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const globais = ler('src/app/globals.css');
const estudo = ler('src/app/estudo.tsx');

/** Blocos de media query do nível de cima (condição e corpo, com as chaves casadas) e o resto do CSS sem eles. */
function separarMedia(css) {
  const blocos = [];
  let resto = '';
  let pos = 0;
  const abre = /@media\s*([^{]+)\{/g;
  for (let m; (m = abre.exec(css)); ) {
    resto += css.slice(pos, m.index);
    let prof = 1;
    let i = abre.lastIndex;
    while (i < css.length && prof > 0) {
      const c = css[i++];
      if (c === '{') prof++;
      else if (c === '}') prof--;
    }
    blocos.push({ condicao: m[1].trim().replace(/\s+/g, ' '), corpo: css.slice(abre.lastIndex, i - 1) });
    pos = i;
    abre.lastIndex = i;
  }
  return { blocos, resto: resto + css.slice(pos) };
}
const g = separarMedia(globais);
const ate = (limite) => g.blocos.filter((b) => b.condicao === `(max-width: ${limite}px)`);
const em = (blocos, regex) => blocos.some((b) => regex.test(b.corpo));

test('item 33: a cápsula de abas vale até 1023 px (celular e tablet) e fica escondida a partir de 1024 px, onde a lateral assume', () => {
  assert.match(g.resto, /\.navegacao-mobile \{ display: none; \}/, 'escondida por padrão (computador)');
  assert.ok(em(ate(1023), /\.navegacao-mobile \{\s*position: fixed;[^}]*display: flex;/), 'a cápsula aparece até 1023 px');
  assert.ok(!em(ate(767), /\.navegacao-mobile \{\s*position: fixed;/), 'e não só até 767 px');
  assert.ok(em(ate(1023), /\.barra-lateral, \.estudo-identificacao__contexto, \.planos-cabeca \.botao \{ display: none; \}/), 'a lateral só some até 1023 px (a partir de 1024 px ela aparece)');
  assert.match(g.resto, /\.barra-lateral \{\s*position: sticky;/);
  // As quatro abas e a ordem: Minhas trilhas, Nova trilha, Explorar (com a comunidade ligada) e Perfil.
  const capsula = estudo.slice(estudo.indexOf('<nav className="navegacao-mobile"'), estudo.indexOf('</nav>', estudo.indexOf('<nav className="navegacao-mobile"')));
  const abas = [...capsula.matchAll(/<Icone nome="(\w+)" \/>\{([\w.]+)\}/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(abas, [['livro', 'mensagens.planos.titulo'], ['lampada', 'mensagens.planos.novo'], ['bussola', 'mensagens.comunidade.navegacao'], ['pessoa', 'mensagens.perfil.navegacao']]);
  assert.match(capsula, /\{comunidade && <button[^>]*>[\s\S]*?mensagens\.comunidade\.navegacao/, 'Explorar só com a comunidade ligada');
});

test('item 33: o visitante entra no mesmo conjunto de abas da conta: nenhuma condição da navegação olha se a pessoa é visitante', () => {
  const comNavegacao = /const comNavegacao = ([\s\S]*?);\n/.exec(estudo)?.[1] ?? '';
  assert.ok(comNavegacao.includes("['planos', 'objetivo', 'plano', 'perfil', 'explorar', 'configuracoes']"), 'as seis telas com a navegação');
  assert.doesNotMatch(comNavegacao, /visitante/);
  const capsula = estudo.slice(estudo.indexOf('<nav className="navegacao-mobile"'), estudo.indexOf('</nav>', estudo.indexOf('<nav className="navegacao-mobile"')));
  assert.doesNotMatch(capsula, /visitante/);
  const lateral = estudo.slice(estudo.indexOf('<aside className="barra-lateral"'), estudo.indexOf('</aside>'));
  assert.doesNotMatch(lateral, /visitante/);
  // O Perfil do visitante é a versão de conta temporária, que já existia: a aba abre a mesma tela.
  assert.match(capsula, /onClick=\{\(\) => navegar\(\{ tipo: 'perfil' \}\)\}><Icone nome="pessoa" \/>/);
  assert.match(ler('src/app/perfil.tsx'), /visitante/);
});

test('item 33: no tablet (768 a 1023 px) o alto não leva os links "Minhas trilhas" e "Perfil" quando a cápsula está na tela', () => {
  assert.ok(em(ate(1023), /\.estudo\[data-navegacao\] \.planos-movel \{ display: none; \}/), '"Minhas trilhas" do alto sai até 1023 px');
  assert.ok(!em(ate(767), /\.estudo\[data-navegacao\] \.planos-movel/), 'não só até 767 px');
  const compartilhar = ler('src/app/compartilhar.css');
  assert.match(compartilhar, /@media \(max-width: 1023px\) \{ \.estudo\[data-navegacao\] \.perfil-cabecalho \{ display: none; \} \}/, '"Perfil" do alto sai até 1023 px');
  assert.doesNotMatch(compartilhar, /@media \(max-width: 767px\) \{ \.estudo\[data-navegacao\] \.perfil-cabecalho/);
  // Sem a cápsula (a aula, a geração, a carga), os links continuam no alto: a regra só vale com o atributo.
  assert.match(compartilhar, /\.perfil-cabecalho \{ display: none; \}\s*@media \(max-width: 1023px\) \{ \.perfil-cabecalho \{ display: inline-flex; \} \}/);
});

test('item 33: com a cápsula no tablet a página reserva o espaço dela, e o que flutua só no celular continua só no celular', () => {
  const ate1023 = ate(1023);
  const variaveis = /html:has\(\.estudo\[data-navegacao\]\) \{([^}]*)\}/.exec(ate1023.map((b) => b.corpo).join('\n'))?.[1] ?? '';
  for (const nome of ['--margem-ilha-esq', '--margem-ilha-dir', '--base-ilha', '--altura-navegacao', '--sombra-ilha', '--espaco-rodape']) assert.match(variaveis, new RegExp(`${nome}:`), `${nome} vale até 1023 px`);
  assert.ok(em(ate1023, /\.estudo\[data-navegacao\] \.estudo-principal \{ padding-bottom: var\(--espaco-rodape\); \}/), 'o fim da página reserva a cápsula');
  assert.ok(em(ate1023, /\.estudo\[data-navegacao\] \.estudo-principal:has\(\.painel--pedido\) \{ padding-bottom: calc\(40px \+ var\(--altura-navegacao\)\); \}/), 'a Nova trilha também');
  assert.ok(em(ate1023, /\.estudo\[data-navegacao\] \.painel--planos > \.acao-principal \{ display: none; \}/), 'o "Nova trilha" do fim da lista sai: a cápsula já tem a aba');
  assert.ok(em(ate1023, /html\[data-teclado='true'\] \.navegacao-mobile \{ display: none; \}/), 'com o teclado aberto a cápsula sai da frente, no tablet também');
  assert.ok(em(g.blocos.filter((b) => b.condicao === '(max-width: 1023px) and (forced-colors: active)'), /\.navegacao-mobile button\[aria-current\] \{ border: 2px solid Highlight; \}/), 'cores forçadas: a aba atual segue marcada');
  // As ações que flutuam sobre a cápsula só existem no celular: no tablet a ação principal fica no fluxo.
  const celular = ate(767);
  assert.ok(em(celular, /\.estudo\[data-navegacao\] \.acao-principal \{\s*inset: auto var\(--margem-ilha-dir\) calc\(var\(--altura-navegacao\) \+ 12px\) var\(--margem-ilha-esq\);/));
  assert.ok(em(celular, /html:has\(\.estudo\[data-navegacao\] :is\(\.trilha-proximo, \.trilha-vazia\)\) \{\s*--espaco-acao-fixa:/));
  assert.ok(em(ate1023, /html:has\(\.estudo\[data-navegacao\] \.editor-perfil__barra\[data-presa\]\) \{\s*--espaco-acao-fixa: calc\(var\(--altura-acao-fixa, 48px\) \+ 12px\);/), 'a barra de salvar do Perfil flutua também no tablet');
});

test('item 33: no tablet o cartão do próximo passo da trilha e a barra de salvar do Perfil sobem para 12 px acima da cápsula, e o computador segue com a reserva de antes', () => {
  const trilha = separarMedia(ler('src/app/trilha.css'));
  const tabletTrilha = trilha.blocos.filter((b) => b.condicao === '(min-width: 768px) and (max-width: 1023px)');
  assert.ok(em(tabletTrilha, /\.estudo\[data-navegacao\] \.trilha-proximo \{ bottom: calc\(var\(--altura-navegacao\) \+ 12px\); \}/));
  const perfil = separarMedia(ler('src/app/perfil.css'));
  const tabletPerfil = perfil.blocos.filter((b) => b.condicao === '(min-width: 768px) and (max-width: 1023px)');
  assert.ok(em(tabletPerfil, /\.estudo\[data-navegacao\] \.editor-perfil__barra\[data-presa\] \{ bottom: calc\(var\(--altura-navegacao\) \+ 12px\); \}/));
  // 12 px: o mesmo respiro do celular entre a barra (ou o cartão) e a cápsula.
  assert.match(perfil.blocos.find((b) => b.condicao === '(max-width: 767px)').corpo, /bottom: calc\(var\(--altura-navegacao\) \+ 12px\);/);
  assert.match(trilha.blocos.find((b) => b.condicao === '(max-width: 767px)').corpo, /inset: auto var\(--margem-ilha-dir\) calc\(var\(--altura-navegacao\) \+ 12px\) var\(--margem-ilha-esq\);/);
});

test('item 33: sem trilha, a primeira tela (o pedido) não ganha o foco sozinha até 1023 px, e com ele a cápsula sumia; no computador e com rascunho o foco continua', () => {
  const primeira = /if \(ativos\.length === 0 \|\| abriuComRascunho\.current\) \{([\s\S]*?)\} else \{/.exec(estudo)?.[1] ?? '';
  assert.match(primeira, /setTela\(\{ tipo: 'objetivo' \}\);/, 'a tela abre sem pedir o foco do campo');
  assert.doesNotMatch(primeira.replace(/\/\/.*$/gm, ''), /focarCampo/);
  // O foco automático continua onde a pessoa pediu o campo (o botão do vazio) e no computador (1024 px ou mais) ou com um rascunho salvo.
  assert.match(estudo, /vazioTexto[\s\S]*?navegar\(\{ tipo: 'objetivo', focarCampo: true \}\)/);
  assert.match(estudo, /const vaiFocarCampo = tela\.tipo === 'objetivo' && \(tela\.focarCampo \|\| window\.innerWidth >= 1024 \|\| Boolean\(objetivoRef\.current\.trim\(\)\)\);/);
  assert.match(ler('src/app/pedido.tsx'), /if \(modo !== 'ideia' \|\| \(!focarCampo && window\.innerWidth < 1024 && !objetivo\.trim\(\)\)\) return;/);
  // Sem o foco no campo, o título recebe o foco (leitor de tela: "O que você quer aprender?").
  assert.match(estudo, /if \(inicio === 'pronto' && !vaiFocarCampo && document\.activeElement\?\.id !== 'objetivo'\) \{\s*\(principal\.current\?\.querySelector<HTMLHeadingElement>\('\.painel--aula h1'\) \?\? principal\.current\?\.querySelector\('h1'\)\)\?\.focus\(\);/);
  // E o teclado esconde a cápsula quando um campo de texto está em foco (a regra que escondia a cápsula na primeira tela).
  assert.match(ler('src/ui/movimento.tsx'), /campo instanceof HTMLTextAreaElement/);
});
