// Fase 2 do site (spec 15, seção 4): o "Resolva comigo" na web, a mesma tela, a mesma ordem e as mesmas regras do app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizarResolucao, resolucaoParaCliente, responderSuaVez } from '@studoo/contratos';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const { CartaoMetodo, CorpoDoResolva, RodapeDoResolva, textoDaOpcao, useResolvaComigo } = await import('../src/app/resolva-comigo.tsx');
const { desenhoDoVisual } = await import('../src/app/desenho-svg.ts');
const {
  acaoDoRodape, aplicarResposta, avancar, comecarResolva, formulaDoMetodo, indiceDoSuaVez, resolucaoUtil, tentarDeNovo, voltar,
} = await import('../src/app/resolva-comigo-regras.ts');

const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const fixture = (nome) => JSON.parse(ler(`tests/fixtures/matematica/${nome}.json`)).licao;
const guardada = (nome) => normalizarResolucao(fixture(nome).resolucao);
const ate = (estado, alvo) => { let atual = estado; while (atual.atual < alvo) atual = avancar(atual); return atual; };
const escolher = (estado, opcao) => ({ ...estado, escolha: opcao });
const etiquetaDe = (html, testid) => new RegExp(`<[a-z0-9]+ [^>]*data-testid="${testid}"[^>]*>`).exec(html)?.[0];
const contar = (html, padrao) => (html.match(padrao) ?? []).length;

const baricentro = fixture('baricentro');
const resolucao = guardada('baricentro');
const cliente = resolucaoParaCliente(resolucao);
const suaVez = indiceDoSuaVez(cliente.passos);
const certa = resolucao.passos[suaVez].tentativa.opcoes.findIndex((opcao) => opcao.correta);
const errada = certa === 0 ? 1 : 0;
const outraErrada = [0, 1, 2].find((opcao) => opcao !== certa && opcao !== errada);

const desenhar = (estado, extra = {}) => renderToStaticMarkup(createElement(CorpoDoResolva, {
  resolucao: cliente, estado, formulaGeral: formulaDoMetodo(baricentro.visuais), ocupado: false, escolher() {}, voltarUmPasso() {}, ...extra,
}));
const rodapeDe = (estado, extra = {}) => renderToStaticMarkup(createElement(RodapeDoResolva, {
  estado, ocupado: false, verificar() {}, proximo() {}, tentar() {}, terminar() {}, ...extra,
}));
/** O servidor simulado: a resolução guardada responde, e as regras do app aplicam. */
const responder = (estado, opcao, tentativa) => aplicarResposta(escolher(estado, opcao), responderSuaVez(resolucao, { opcao, tentativa }));

test('as três lições de matemática: os passos de um a um, o "Sua vez" e o fim, nas regras da web (iguais às do app), com o servidor embaralhando', () => {
  const ordens = [[0, 1, 2], [2, 0, 1], [1, 2, 0]];
  for (const [numero, nome] of ['baricentro', 'abscissas', 'colinearidade'].entries()) {
    const ordem = ordens[numero];
    const guardadaDaLicao = guardada(nome);
    const doCliente = resolucaoParaCliente(guardadaDaLicao, ordem);
    assert.ok(resolucaoUtil(doCliente), nome);
    const corte = indiceDoSuaVez(doCliente.passos);
    assert.equal(corte, doCliente.passos.length - 1, `${nome}: o cliente para no "Sua vez"`);
    let estado = ate(comecarResolva(doCliente), corte);
    assert.equal(acaoDoRodape(estado), 'verificar', nome);
    const guardadaCerta = guardadaDaLicao.passos[corte].tentativa.opcoes.findIndex((opcao) => opcao.correta);
    const mostradaCerta = ordem.indexOf(guardadaCerta);
    const resposta = responderSuaVez(guardadaDaLicao, { opcao: mostradaCerta, tentativa: 1 }, ordem);
    assert.equal(resposta.correta, true, `${nome}: o índice mostrado acerta a certa`);
    estado = aplicarResposta(escolher(estado, mostradaCerta), resposta);
    assert.equal(estado.revelado, true); assert.equal(estado.passos.length, estado.total, `${nome}: os passos que faltavam chegaram`);
    assert.equal(acaoDoRodape(estado), 'proximo');
    estado = ate(estado, estado.total - 1);
    assert.equal(acaoDoRodape(estado), 'agora', nome);
  }
});

test('o começo: o problema como título da etapa, o desenho, "Passo 1 de N", o cartão do primeiro passo (Stu concentrado, frase e fórmula) e nada de "Voltar"', () => {
  const html = desenhar(comecarResolva(cliente));
  const secao = etiquetaDe(html, 'resolva-comigo');
  assert.match(secao, /^<section class="resolva" /);
  assert.match(secao, /aria-labelledby="etapa-aula"/, 'o título da etapa é o problema');
  const problema = etiquetaDe(html, 'resolva-problema');
  assert.match(problema, /^<h1 /); assert.match(problema, /id="etapa-aula"/); assert.match(problema, /tabindex="-1"/, 'recebe o foco ao abrir a etapa');
  assert.match(html, /Os vértices A\(2, 1\) e B\(−1, 5\)/, 'o texto do problema');
  assert.match(html, /data-testid="resolva-visual"/, 'o desenho de cima');
  assert.match(html, /<span class="resolva-indicador__texto" data-testid="resolva-indicador">Passo 1 de 5<\/span>/);
  assert.equal(contar(html, /class="resolva-traco"/g), 5, 'N traços');
  assert.equal(contar(html, /data-feito="true"/g), 1, 'só o atual está feito');
  assert.match(html, /class="resolva-traco" data-feito="true" data-atual="true"/, 'o atual é o mais largo');
  assert.doesNotMatch(html, /resolva-feito-/, 'nenhum passo feito ainda');
  assert.doesNotMatch(html, /data-testid="resolva-voltar"/, 'no primeiro passo não volta');
  assert.match(html, /data-testid="resolva-passo"/);
  assert.match(html, /stu-concentrado/); assert.doesNotMatch(html, /stu-animado/);
  const frase = etiquetaDe(html, 'resolva-frase');
  assert.match(frase, /tabindex="-1"/, 'a frase recebe o foco a cada passo');
  assert.match(html, /data-testid="resolva-formula"/, 'a fórmula em bloco do passo');
  // A ordem: problema, desenho, indicador, cartão; e a região educada por último.
  const marcas = ['resolva-problema', 'resolva-visual', 'resolva-indicador', 'resolva-passo', 'resolva-anuncio'].map((marca) => html.indexOf(`data-testid="${marca}"`));
  assert.deepEqual([...marcas].sort((a, b) => a - b), marcas, 'a ordem da tela');
  assert.match(rodapeDe(comecarResolva(cliente)), /data-testid="resolva-proximo"[^>]*>Próximo passo</);
});

test('do passo 2 em diante: o passo feito vira uma linha (visto, nome e fórmula), "Voltar um passo" aparece e o indicador avança', () => {
  const estado = avancar(comecarResolva(cliente));
  const html = desenhar(estado);
  const linha = etiquetaDe(html, 'resolva-feito-1');
  assert.match(linha, /^<button type="button" class="resolva-feito__linha"/);
  assert.match(linha, /aria-expanded="false"/);
  assert.match(linha, new RegExp(`aria-label="${cliente.passos[0].nome}: `), 'o nome e a fórmula falada, para o leitor de tela');
  assert.match(html, /Passo 2 de 5/);
  assert.equal(contar(html, /data-feito="true"/g), 2); assert.match(html, /class="resolva-traco" data-feito="true" data-atual="true"/);
  assert.match(html, /class="resolva-feito__nome">A fórmula</, 'o nome curto do passo');
  assert.match(html, /<button type="button" class="botao botao--texto resolva-voltar"[^>]*data-testid="resolva-voltar"[^>]*>Voltar um passo</, 'botão de texto');
  // O passo feito vem antes do cartão do atual, e "Voltar" depois dele.
  assert.ok(html.indexOf('resolva-feito-1') < html.indexOf('data-testid="resolva-passo"') && html.indexOf('data-testid="resolva-passo"') < html.indexOf('resolva-voltar'));
});

test('o "Sua vez" antes da escolha: selo âmbar, a pergunta, três opções num grupo de escolha com a pergunta de nome, "Verificar" desligado e nenhum bloco de fórmula no cartão', () => {
  const estado = ate(comecarResolva(cliente), suaVez);
  const html = desenhar(estado);
  assert.match(html, /<span class="resolva-selo resolva-selo--sua-vez">Sua vez<\/span>/);
  const grupo = /<fieldset class="opcoes" role="radiogroup" aria-labelledby="([^"]+)"/.exec(html);
  assert.ok(grupo, 'o grupo de escolha');
  assert.match(html, new RegExp(`<p id="${grupo[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" class="resolva-pergunta"`), 'a pergunta nomeia o grupo');
  assert.equal(contar(html, /type="radio" name="sua-vez"/g), 3);
  assert.deepEqual([...html.matchAll(/<span class="opcao-tecla" aria-hidden="true">([A-C])<\/span>/g)].map((trecho) => trecho[1]), ['A', 'B', 'C']);
  assert.doesNotMatch(html, /checked=""/, 'nenhuma opção marcada');
  assert.doesNotMatch(html, /data-retorno|resolva-porque|resolva-isso/, 'nada de retorno ainda');
  // Spec 15, seção 13: o contexto é a linha do passo feito logo acima; o cartão não traz a fórmula do passo nem do próximo.
  const cartao = html.slice(html.indexOf('data-testid="resolva-passo"'));
  assert.doesNotMatch(cartao, /data-testid="resolva-formula/, 'sem bloco de fórmula no cartão');
  assert.ok(html.includes(`resolva-feito-${suaVez}`), 'o passo anterior, em linha');
  assert.match(rodapeDe(estado), /data-testid="resolva-verificar" disabled=""[^>]*>Verificar</, '"Verificar" desligado até a escolha');
  assert.match(rodapeDe(escolher(estado, 1)), /data-testid="resolva-verificar"(?![^>]*disabled)[^>]*>Verificar</, 'ligado depois da escolha');
  assert.match(html, /opcoes-atalho">Dica: use as teclas de A a C para escolher e Enter para verificar\./, 'a dica das teclas, como nos exercícios');
  // A resposta não está na tela: nem a certa, nem o porquê dela.
  const todas = cliente.passos[suaVez].tentativa.opcoes.map((opcao) => textoDaOpcao(opcao));
  assert.equal(todas.length, 3);
  assert.ok(!JSON.stringify(cliente).includes('porque'), 'o cliente nem recebe o porquê');
});

test('a escolha marca a opção; a primeira errada mostra o porquê dela, trava as opções e pede "Tentar de novo"; a segunda tentativa acerta e revela', () => {
  let estado = escolher(ate(comecarResolva(cliente), suaVez), errada);
  const marcada = desenhar(estado);
  assert.equal(contar(marcada, /checked=""/g), 1, 'a opção marcada');
  estado = responder(estado, errada, 1);
  const html = desenhar(estado);
  assert.match(html, new RegExp(`<label data-retorno="errada"><input type="radio" name="sua-vez"(?: checked="")? value="${errada}"`), 'a opção marcada fica âmbar');
  assert.match(html, /<div class="resolva-retorno" tabindex="-1" role="group" aria-label="[^"]+" data-testid="resolva-retorno"><div class="resolva-porque" data-testid="resolva-porque">/, 'o porquê daquela opção, no cartão do retorno (que recebe o foco)');
  assert.doesNotMatch(html, /role="status" data-testid="resolva-(?:porque|isso)"/, 'sem região educada nas caixas: o foco no cartão já faz o leitor de tela ler, e ele não fala duas vezes');
  assert.match(html, /<fieldset [^>]*disabled=""/, 'as opções travam');
  assert.doesNotMatch(html, /data-revelado/, 'a primeira errada não revela, e as outras não apagam');
  assert.doesNotMatch(html, /resolva-isso|resolva-formula-revelada/, 'nenhuma revelação na primeira errada');
  assert.equal(acaoDoRodape(estado), 'tentar');
  assert.match(rodapeDe(estado), /data-testid="resolva-tentar"[^>]*>Tentar de novo</);
  // Tentar de novo: a marca sai, as opções destravam e a próxima escolha é a segunda.
  estado = tentarDeNovo(estado);
  const novo = desenhar(estado);
  assert.doesNotMatch(novo, /checked=""|data-retorno|resolva-porque|<fieldset [^>]*disabled=""/);
  assert.equal(estado.tentativa, 2);
  // O acerto: a opção fica verde, "Isso!" e a fórmula do passo (a revelação), e o rodapé volta a "Próximo passo".
  estado = responder(estado, certa, 2);
  const certaHtml = desenhar(estado);
  assert.match(certaHtml, new RegExp(`<label data-retorno="certa"><input type="radio" name="sua-vez"(?: checked="")? value="${certa}"`));
  assert.match(certaHtml, /<div class="resolva-isso" data-testid="resolva-isso"><p class="resolva-isso__titulo">Isso!<\/p>/);
  assert.match(certaHtml, /data-testid="resolva-formula-revelada"/, 'a fórmula seguinte');
  assert.match(certaHtml, /<fieldset [^>]*data-revelado="true"/, 'depois da revelação, as outras opções apagam');
  assert.match(certaHtml, /<fieldset [^>]*disabled=""/);
  assert.doesNotMatch(certaHtml, /resolva-porque/);
  assert.match(rodapeDe(estado), /data-testid="resolva-proximo"[^>]*>Próximo passo</);
});

test('a segunda errada mostra a certa, com o porquê dela e sem o "Isso!", e segue: nunca trava', () => {
  let estado = responder(escolher(ate(comecarResolva(cliente), suaVez), errada), errada, 1);
  estado = tentarDeNovo(estado);
  estado = responder(estado, outraErrada, 2);
  assert.equal(estado.revelado, true);
  const html = desenhar(estado);
  assert.match(html, new RegExp(`<label data-retorno="certa"><input type="radio" name="sua-vez"(?: checked="")? value="${certa}"`), 'a certa aparece verde');
  assert.match(html, new RegExp(`<label data-retorno="errada"><input type="radio" name="sua-vez"(?: checked="")? value="${outraErrada}"`), 'e a marcada segue âmbar');
  assert.match(html, /<div class="resolva-isso" data-testid="resolva-isso"><p class="resolva-isso__texto"/, 'o porquê da certa, sem o título "Isso!"');
  assert.doesNotMatch(html, /resolva-isso__titulo/);
  assert.match(html, /data-testid="resolva-formula-revelada"/);
  assert.notEqual(acaoDoRodape(estado), 'tentar');
});

test('o último passo: Stu animado, o procurado vira resposta no desenho (a figura troca no lugar), "O método" e "Agora é com você"; e o anúncio do passo', () => {
  let estado = responder(escolher(ate(comecarResolva(cliente), suaVez), certa), certa, 1);
  const meio = desenhar(estado);
  assert.doesNotMatch(meio, /resolva-metodo/, 'o método só no fim');
  assert.match(meio, /stu-concentrado/);
  estado = ate(estado, estado.total - 1);
  const html = desenhar(estado, { anuncio: 'Passo 5 de 5. A figura mostra C.', caixa: desenhoDoVisual(cliente.visual, { tipo: 'passo', ultimo: false }).altura });
  assert.match(html, /stu-animado/); assert.doesNotMatch(html, /stu-concentrado/, 'no último passo o Stu comemora');
  assert.match(html, /data-testid="resolva-visual"[^>]*data-entrada="true"/, 'a figura revelada entra uma vez, no lugar');
  assert.match(html, /class="desenho__ponto"/, 'o ponto resposta em camada própria');
  const metodo = html.slice(html.indexOf('data-testid="resolva-metodo"'));
  assert.match(metodo, /<h2 id="[^"]+" class="resolva-metodo__titulo">O método<\/h2>/);
  assert.deepEqual([...metodo.matchAll(/class="resolva-metodo__linha">(\d+)\. ([^<]+)</g)].map((trecho) => `${trecho[1]}. ${trecho[2]}`),
    resolucao.passos.map((passo, numero) => `${numero + 1}. ${passo.nome}`), 'uma linha por passo');
  assert.match(html, /data-testid="resolva-metodo-formula"/, 'a fórmula geral em bloco');
  assert.match(html, /<p class="somente-leitor" role="status" data-testid="resolva-anuncio">Passo 5 de 5\. A figura mostra C\.<\/p>/, 'a região educada leva o anúncio');
  assert.match(rodapeDe(estado), /data-testid="resolva-agora"[^>]*>Agora é com você</);
  // "Voltar um passo" do último volta ao anterior, e a figura é a do passo (sem o procurado).
  assert.doesNotMatch(desenhar(voltar(estado)), /resolva-metodo|data-entrada="true"/);
});

test('"Rever a explicação" abre também "O método" (o cartão é o mesmo, com o título e a fórmula geral)', () => {
  const html = renderToStaticMarkup(createElement(CartaoMetodo, { passos: resolucao.passos, formula: formulaDoMetodo(baricentro.visuais) }));
  assert.match(html, /O método/); assert.match(html, /5\. O vértice C/); assert.match(html, /data-testid="resolva-metodo-formula"/);
  const aula = ler('src/app/aula.tsx');
  assert.match(aula, /metodo\?: ReactNode;/);
  assert.match(aula, /<TextoComFormulas texto=\{exemplo\} \/><\/p>\}\s*\{metodo\}\s*<\/details>/, 'depois do exemplo, dentro do "Rever a explicação"');
  assert.match(aula, /exemplo=\{licao\.exemplo\} metodo=\{resolva\.metodo\}/);
});

test('o hook: só é "Resolva comigo" com resolução que serve E como responder; sem isso, o exemplo em texto de sempre', () => {
  const Montagem = ({ licao, responder: enviar }) => {
    const resolva = useResolvaComigo({ licao, responder: enviar, aoTerminar() {}, visivel: true });
    return createElement('div', { 'data-ativo': String(resolva.ativo) }, resolva.corpo, resolva.rodape, resolva.metodo);
  };
  const montar = (licao, enviar) => renderToStaticMarkup(createElement(Montagem, { licao, responder: enviar }));
  const envio = async () => ({});
  const licao = { ...baricentro, resolucao: cliente };
  const ativo = montar(licao, envio);
  assert.match(ativo, /data-ativo="true"/); assert.match(ativo, /resolva-comigo/); assert.match(ativo, /Próximo passo/); assert.doesNotMatch(ativo, /resolva-metodo/);
  assert.match(montar(licao, undefined), /data-ativo="false"><\/div>/, 'sem como responder, o exemplo em texto');
  assert.match(montar({ ...baricentro, resolucao: undefined }, envio), /data-ativo="false"><\/div>/, 'sem resolução');
  assert.match(montar({ ...baricentro, resolucao: { ...cliente, passos: [] } }, envio), /data-ativo="false"><\/div>/, 'resolução sem passos não serve');
  assert.match(montar({ ...baricentro, resolucao: { ...cliente, problema: '' } }, envio), /data-ativo="false"><\/div>/, 'sem problema não serve');
  // Sem "Sua vez", a resolução inteira já está na mão, e "O método" fica à disposição do "Rever a explicação".
  const semSuaVez = { ...cliente, passos: resolucao.passos.map(({ tentativa, ...passo }) => passo), total: resolucao.passos.length };
  assert.match(montar({ ...baricentro, resolucao: semSuaVez }, envio), /resolva-metodo/);
});

test('a opção do "Sua vez": o texto, ou a fórmula marcada para o motor desenhar; a que não se lê não deixa lugar de texto cru', () => {
  assert.equal(textoDaOpcao({ texto: '15' }), '15');
  assert.equal(textoDaOpcao({ formula: 'k = \\frac{4}{2}' }), '$k = \\frac{4}{2}$');
  assert.equal(textoDaOpcao({ formula: '\\naoexiste{' }), '');
  assert.equal(textoDaOpcao({ texto: 'Divida por 2', formula: 'k = 2' }), 'Divida por 2');
});

test('a tela: o selo no lugar de "Exemplo" (sem etapa nova), o lápis, o rodapé preso, o corpo no lugar do exemplo em texto e o POST do "Sua vez"', () => {
  const aula = ler('src/app/aula.tsx');
  assert.match(aula, /nomeEtapa = resolva\.ativo \? mensagens\.resolvaComigo\.selo/, 'o selo no lugar de "Exemplo"');
  assert.match(aula, /<Icone nome=\{etapa\.tipo === 'exemplo' && resolva\.ativo \? 'lapis' : iconesDaEtapa\[etapa\.tipo\]\} \/>/);
  assert.match(aula, /etapa\.tipo === 'exemplo' && \(resolva\.ativo \? resolva\.corpo : <EtapaExemplo licao=\{licao\} titulo=\{tituloEtapa\} \/>\)/, 'sem resolução (ou sem rede), o exemplo em texto de sempre');
  assert.match(aula, /etapa\.tipo === 'exemplo' && resolva\.ativo\) \{[\s\S]{0,200}acao = resolva\.rodape;/, 'o rodapé preso do "Resolva comigo"');
  assert.match(aula, /visivel: etapa\.tipo === 'exemplo'/);
  const tela = ler('src/app/resolva-comigo.tsx');
  assert.match(tela, /setEstado\(\(atual\) => \(atual \? \{ \.\.\.atual, emTexto: true \} : atual\)\);/, 'sem rede no "Sua vez": exemplo em texto');
  assert.match(tela, /setAnuncio\(descricao \? `\$\{t\.passo\(estado\.atual \+ 1, estado\.total\)\}\. \$\{descricao\}` : t\.passo\(estado\.atual \+ 1, estado\.total\)\)/, 'o anúncio, com a descrição do desenho no último passo');
  assert.match(tela, /role="radiogroup" aria-labelledby=\{idDaPergunta\}/);
  assert.match(tela, /tocarEfeito\(corpo\.correta \? 'acerto' : 'erro', somDoEnvio\)/);
  assert.match(tela, /tocarEfeito\('toque_opcao'\)/);
  assert.match(tela, /frase\.current\?\.focus\(\{ preventScroll: true \}\)/, 'o foco vai para a frase do passo');
  const cliente = ler('src/contratos/cliente-web.ts');
  assert.match(cliente, /\/api\/aprendizado\/licoes\/\$\{encodeURIComponent\(id\)\}\/resolucao/);
  assert.match(cliente, /JSON\.stringify\(\{ opcao: escolha\.opcao, tentativa: escolha\.tentativa \}\)/);
  const estudo = ler('src/app/estudo.tsx');
  assert.match(estudo, /responderSuaVez=\{\(escolha\) => responderSuaVez\(tela\.licao\.id, escolha\)\}/);
});

test('o CSS: opções dos exercícios também aqui, traços de 6 (o atual com 34), cartão com borda de 2 e raio 20, pesos 400 e 700, entrada de 200 ms só sem movimento reduzido', () => {
  const css = ler('src/app/aula.css');
  assert.match(css, /:is\(\.aula-quadro, \.estudio-desafio, \.resolva\) \.opcoes label \{/, 'as opções do "Sua vez" são as dos exercícios');
  assert.match(css, /\.resolva-traco \{ width: 18px; height: 6px; border-radius: 3px;/);
  assert.match(css, /\.resolva-traco\[data-atual\] \{ width: 34px; \}/);
  assert.match(css, /\.resolva-cartao \{[^}]*padding: 16px; border: 2px solid var\(--gelo\); border-radius: 20px;/);
  assert.match(css, /\.aula-miolo \.resolva-problema \{ margin: 0; font-size: 1\.0625rem; font-weight: 700; line-height: 1\.4375rem;/, 'o problema em 17/23 700 (em rem)');
  assert.match(css, /\.resolva-frase \{[^}]*font-size: 1rem; font-weight: 400; line-height: 1\.375rem;/, 'a frase do passo em 400');
  assert.match(css, /\.resolva-pergunta \{ margin: 0; font-size: 1rem; font-weight: 700; line-height: 1\.375rem; \}/, 'a pergunta em 700');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.resolva-cartao \{ animation: resolva-entrar 200ms ease-out both; \}/);
  assert.match(css, /@keyframes resolva-entrar \{ from \{ opacity: 0; transform: translateY\(8px\); \}/, 'sobe 8 px');
});

/* ----- W3b: texto grande, rodapé à direita e "O método" no fim do exemplo (revisão do Designer, spec 15, seção 16) ----- */

const blocoDoResolva = () => {
  const css = ler('src/app/aula.css');
  return css.slice(css.indexOf('/* ----- Resolva comigo (spec 15'));
};

test('texto grande (WCAG 1.4.4): todo texto e toda fórmula do Resolva comigo é em rem, e cresce com a letra do sistema como as opções', () => {
  const bloco = blocoDoResolva();
  assert.ok(bloco.length > 1000, 'o bloco do Resolva comigo existe');
  assert.deepEqual(bloco.match(/(?:font-size|line-height): [\d.]+px/g) ?? [], [], 'nenhum tamanho de letra nem de linha em px');
  // Os mesmos tamanhos do app, em rem (16 px = 1 rem): problema 17/23, frase e pergunta 16/22, feito 14/20, porquê 15/21, selo 13/18.
  for (const regra of [
    /\.aula-miolo \.resolva-problema \{[^}]*font-size: 1\.0625rem; font-weight: 700; line-height: 1\.4375rem;/,
    /\.resolva-frase \{[^}]*font-size: 1rem; font-weight: 400; line-height: 1\.375rem;/,
    /\.resolva-pergunta \{[^}]*font-size: 1rem; font-weight: 700; line-height: 1\.375rem;/,
    /\.resolva-feito__nome \{[^}]*font-size: 0\.875rem; font-weight: 800; line-height: 1\.25rem;/,
    /\.resolva-feito__formula \{[^}]*font-size: 0\.875rem; font-weight: 400; line-height: 1\.25rem;/,
    /\.resolva-porque p \{[^}]*font-size: 0\.9375rem; font-weight: 400; line-height: 1\.3125rem;/,
    /\.resolva-isso__texto \{[^}]*font-size: 0\.9375rem; font-weight: 400; line-height: 1\.3125rem;/,
    /\.resolva-selo \{[^}]*font-size: 0\.8125rem; font-weight: 900;[^}]*line-height: 1\.125rem;/,
    /\.resolva-indicador__texto \{[^}]*font-size: 0\.875rem; font-weight: 800; line-height: 1\.25rem;/,
    /\.resolva-metodo__linha \{[^}]*font-size: 0\.9375rem; font-weight: 700; line-height: 1\.3125rem;/,
  ]) assert.match(bloco, regra);
  // A linha do passo feito e o botão de voltar crescem junto (altura mínima em rem); o visto acompanha a letra.
  assert.match(bloco, /\.resolva-feito__linha \{[^}]*min-height: 2\.25rem;/);
  assert.match(bloco, /\.resolva-voltar \{[^}]*min-height: 2\.75rem;/);
  assert.match(bloco, /\.resolva-feito__linha \.icone \{[^}]*width: 1rem; height: 1rem;/);
  // A fórmula em linha dentro dessas peças mede a letra do elemento em volta (getComputedStyle), então segue o tamanho: o desenho não tem px fixo.
  const texto = ler('src/app/texto-com-formulas.tsx');
  assert.match(texto, /Number\.parseFloat\(estilo\.fontSize\)/);
});

test('o rodapé do Resolva comigo põe as ações à direita, na largura do alto da aula, e só nele (a coluna não muda)', () => {
  const aula = ler('src/app/aula.tsx');
  assert.match(aula, /<footer className="aula-rodape" [^>]*data-resolva=\{etapa\.tipo === 'exemplo' && resolva\.ativo \? '' : undefined\}>/);
  const bloco = blocoDoResolva();
  assert.match(bloco, /\.aula-rodape\[data-resolva\] \.aula-rodape__acoes \{ margin-left: auto; \}/);
  const css = ler('src/app/aula.css');
  assert.equal((css.match(/\.aula-rodape\[data-resolva\]/g) ?? []).length, 1, 'uma regra só: as outras etapas não mudam');
});

test('"O método" vem DEPOIS do último passo e ANTES do rodapé "Agora é com você", e a página sobe para mostrá-lo junto do cartão', () => {
  let estado = responder(escolher(ate(comecarResolva(cliente), suaVez), certa), certa, 1);
  estado = ate(estado, estado.total - 1);
  const html = desenhar(estado);
  const marcas = ['resolva-passo', 'resolva-voltar', 'resolva-metodo', 'resolva-anuncio'].map((marca) => html.indexOf(`data-testid="${marca}"`));
  assert.ok(marcas.every((posicao) => posicao >= 0), 'todos aparecem no último passo');
  assert.deepEqual([...marcas].sort((a, b) => a - b), marcas, 'cartão do último passo, "Voltar um passo", "O método", e a região educada no fim');
  assert.match(rodapeDe(estado), /data-testid="resolva-agora"[^>]*>Agora é com você</, 'o rodapé preso vem depois de tudo');
  // Antes do último passo, nada de método (ele é o fim do exemplo); no último, o rolar do passo leva o fim do método à vista.
  assert.doesNotMatch(desenhar(voltar(estado)), /resolva-metodo/);
  const tela = ler('src/app/resolva-comigo.tsx');
  assert.match(tela, /const fim = \(document\.querySelector<HTMLElement>\('\.resolva-metodo'\) \?\? cartao\)\.getBoundingClientRect\(\)\.bottom;/);
  assert.match(tela, /\{ultimo && <CartaoMetodo passos=\{estado\.passos\} formula=\{formulaGeral\} \/>\}/);
});

/* ----- W3b: "Verificando…" e o foco no cartão do retorno (revisão do Designer, spec 15, seção 16) ----- */

test('"Verificar" ocupado: afundado e desligado (aria-disabled, sem perder o foco), com o giro de 16 px na linha, aria-busy e "Verificando…" do contrato', () => {
  const estado = escolher(ate(comecarResolva(cliente), suaVez), 1);
  const parado = rodapeDe(estado);
  assert.doesNotMatch(parado, /aria-busy|data-ocupado|botao__giro|aria-disabled/, 'sem conferir, o botão é o de sempre');
  const ocupado = rodapeDe(estado, { ocupado: true });
  assert.match(ocupado, /aria-disabled="true"/); assert.match(ocupado, /aria-busy="true"/); assert.match(ocupado, /data-ocupado="true"/);
  assert.doesNotMatch(ocupado.match(/<button[^>]*>/)[0], /\sdisabled(?:=|\s|>)/, 'não usa disabled: o foco que está no botão não se perde');
  assert.match(ocupado, /<span class="botao__giro" aria-hidden="true"><\/span>Verificando…<\/button>/, 'o giro e o texto na mesma linha');
  assert.match(ocupado, /aria-label="Verificar"/, 'o nome acessível não muda: quem fala "Verificando…" é a região educada, uma vez');
  const contrato = ler('packages/contratos/src/experiencia.ts');
  assert.match(contrato, /avaliando: 'Verificando…'/, 'a chave `avaliando` do contrato já é "Verificando…", e a web usa essa');
  const tela = ler('src/app/resolva-comigo.tsx');
  assert.match(tela, /\{ocupado \? mensagens\.licao\.avaliando : t\.verificar\}/);
  assert.match(tela, /setAnuncio\(mensagens\.licao\.avaliando\);/, 'a região educada fala "Verificando…" quando começa a conferir');
  const css = ler('src/app/aula.css');
  assert.match(css, /\.botao\[data-ocupado\] \{ box-shadow: 0 1px 0 var\(--labio\); transform: translateY\(3px\); cursor: progress; white-space: nowrap; \}/, 'afundado');
  assert.match(css, /\.botao__giro \{ flex: none; width: 16px; height: 16px;/, 'o giro de 16 px');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.botao__giro \{ animation: botao-giro 800ms linear infinite; \}/, 'sem movimento, o anel fica parado');
});

test('depois de "Verificar" o foco vai para o cartão do retorno, lido inteiro; depois de "Tentar de novo", para a primeira opção', () => {
  // O cartão do retorno leva o texto falado inteiro no nome: o leitor de tela lê o porquê, o "Isso!" e a fórmula revelada de uma vez.
  let estado = responder(escolher(ate(comecarResolva(cliente), suaVez), errada), errada, 1);
  const errouHtml = desenhar(estado);
  const nomeDoErro = /<div class="resolva-retorno" tabindex="-1" role="group" aria-label="([^"]+)"/.exec(errouHtml)[1];
  assert.match(nomeDoErro, /^Os outros vértices se subtraem/, 'o porquê da opção');
  assert.doesNotMatch(nomeDoErro, /Isso/, 'o erro não diz "Isso!"');
  estado = tentarDeNovo(estado);
  assert.doesNotMatch(desenhar(estado), /resolva-retorno/, 'sem correção, sem cartão');
  estado = responder(estado, certa, 2);
  const nomeDoAcerto = /<div class="resolva-retorno" tabindex="-1" role="group" aria-label="([^"]+)"/.exec(desenhar(estado))[1];
  assert.match(nomeDoAcerto, /Isso\. /, '"Isso!" antes do porquê');
  assert.match(nomeDoAcerto, /y índice C é igual a 3 vezes 2, menos 1, menos 5/, 'a fórmula revelada, falada pela árvore');
  assert.ok(nomeDoAcerto.endsWith('.'));
  const tela = ler('src/app/resolva-comigo.tsx');
  assert.match(tela, /window\.requestAnimationFrame\(\(\) => retorno\.current\?\.focus\(\{ preventScroll: true \}\)\);/, 'o foco vai para o cartão do retorno, e não para o botão do rodapé');
  assert.doesNotMatch(tela, /aula-rodape__acoes \[data-testid\^="resolva-"\]/, 'o botão do rodapé não recebe o foco à força');
  assert.match(tela, /grupo\.current\?\.querySelector<HTMLElement>\('input'\)\?\.focus\(\{ preventScroll: true \}\)/, 'depois de "Tentar de novo", a primeira opção (como já era)');
  const css = ler('src/app/aula.css');
  assert.match(css, /\.resolva-retorno \{ display: grid; gap: 12px; \}\n\.resolva-retorno:focus \{ outline: none; \}/);
});
