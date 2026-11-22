// Onboarding e primeira vez na web (spec 17, mudanças 1, 2 e 4): a placa das duas esperas (a geração da proposta e a criação da trilha depois de "Começar a lição 1"), a faixa da proposta com o texto
// novo e o tour sem selos de demonstração. Os textos e a conta do tempo são do contrato (tests/onboarding-contrato.test.mjs); aqui está o que a web faz com eles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { dicaDaEspera, dicaDaEsperaLonga } from '@studoo/contratos';
import { mensagens } from '@studoo/contratos/experiencia';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const { trocarDicasDaEspera } = await import('../src/app/previa-trilha-regras.ts');
const { PlacaDaGeracao, PreviaTrilha } = await import('../src/app/previa-trilha.tsx');
const { ArteMaterial, ArtePonte, ArteExplique } = await import('../src/app/apresentacao.tsx');

const g = mensagens.geracao;

/** Um relógio de brinquedo: o tempo só anda quando o teste manda, e os temporizadores disparam na ordem. */
function relogioDeBrinquedo() {
  let agora = 0;
  let proximoId = 1;
  let fila = [];
  return {
    agora: () => agora,
    esperar(ms, chamar) { const id = proximoId++; fila.push({ id, quando: agora + ms, chamar }); return id; },
    parar(id) { fila = fila.filter((item) => item.id !== id); },
    avancar(ms) {
      const fim = agora + ms;
      for (;;) {
        fila.sort((a, b) => a.quando - b.quando || a.id - b.id);
        const proximo = fila[0];
        if (!proximo || proximo.quando > fim) break;
        fila.shift();
        agora = proximo.quando;
        proximo.chamar();
      }
      agora = fim;
    },
    pendentes: () => fila.length,
  };
}

const qualDicaDaProposta = (ms) => dicaDaEspera(ms, g.dicas.length);
function ensaiar({ reduzido = false, qualDica = qualDicaDaProposta } = {}) {
  const relogio = relogioDeBrinquedo();
  const vistos = [];
  const desligar = trocarDicasDaEspera({ qualDica, reduzido: () => reduzido, aoMudar: (estado) => vistos.push({ ...estado, em: relogio.agora() }), relogio });
  return { relogio, vistos, desligar };
}
const entradas = (vistos) => vistos.filter((estado) => !estado.saindo).map((estado) => [estado.indice, estado.em]);

test('a espera da proposta: nos 3 primeiros segundos nada muda; aos 3 s a 1ª frase entra com o efeito de 300 ms (some em 150, aparece em 150)', () => {
  const { relogio, vistos } = ensaiar();
  relogio.avancar(2999);
  assert.deepEqual(vistos, [], '"Montando sua trilha" fica na placa');
  relogio.avancar(1);
  assert.deepEqual(vistos, [{ indice: null, saindo: true, em: 3000 }], 'aos 3 s, "Montando sua trilha" começa a sumir');
  relogio.avancar(150);
  assert.deepEqual(vistos.at(-1), { indice: 0, saindo: false, em: 3150 }, 'aos 3,15 s, a 1ª frase aparece');
  assert.equal(vistos.length, 2);
});

test('a espera da proposta: as quatro frases, uma nova a cada 5 s, em laço, sempre com o efeito (a frase some e a seguinte aparece 150 ms depois)', () => {
  const { relogio, vistos } = ensaiar();
  relogio.avancar(30000);
  assert.deepEqual(entradas(vistos), [[0, 3150], [1, 8150], [2, 13150], [3, 18150], [0, 23150], [1, 28150]]);
  const saidas = vistos.filter((estado) => estado.saindo);
  assert.deepEqual(saidas.map((estado) => [estado.indice, estado.em]), [[null, 3000], [0, 8000], [1, 13000], [2, 18000], [3, 23000], [0, 28000]], 'cada troca começa com a frase de agora sumindo');
  for (let i = 0; i < saidas.length; i += 1) assert.equal(entradas(vistos)[i][1] - saidas[i].em, 150, 'cada troca dura 300 ms: 150 sumindo e 150 aparecendo');
});

test('a espera da criação (depois de "Começar a lição 1"): "Criando sua trilha…" por 3 s e depois as frases 1, 2 e 4, a cada 5 s, em laço, sem a 3ª', () => {
  const { relogio, vistos } = ensaiar({ qualDica: dicaDaEsperaLonga });
  relogio.avancar(2999);
  assert.deepEqual(vistos, [], '"Criando sua trilha…" fica na placa');
  relogio.avancar(32001);
  assert.deepEqual(entradas(vistos), [[0, 3150], [1, 8150], [3, 13150], [0, 18150], [1, 23150], [3, 28150], [0, 33150]]);
  assert.equal(entradas(vistos).some(([indice]) => indice === 2), false, '"Você confere a trilha antes de começar." não entra: a pessoa já conferiu');
  assert.deepEqual(vistos[0], { indice: null, saindo: true, em: 3000 }, 'aos 3 s, "Criando sua trilha…" começa a sumir');
});

test('movimento reduzido: a troca é imediata, sem a etapa de sumir, nas duas esperas', () => {
  const proposta = ensaiar({ reduzido: true });
  proposta.relogio.avancar(18000);
  assert.deepEqual(proposta.vistos, [{ indice: 0, saindo: false, em: 3000 }, { indice: 1, saindo: false, em: 8000 }, { indice: 2, saindo: false, em: 13000 }, { indice: 3, saindo: false, em: 18000 }]);
  const criacao = ensaiar({ reduzido: true, qualDica: dicaDaEsperaLonga });
  criacao.relogio.avancar(18000);
  assert.deepEqual(criacao.vistos, [{ indice: 0, saindo: false, em: 3000 }, { indice: 1, saindo: false, em: 8000 }, { indice: 3, saindo: false, em: 13000 }, { indice: 0, saindo: false, em: 18000 }]);
});

test('desligar para tudo (inclusive uma troca no meio do efeito) e não deixa temporizador vivo', () => {
  const { relogio, vistos, desligar } = ensaiar();
  relogio.avancar(3100);
  assert.equal(vistos.length, 1, 'no meio do efeito da 1ª troca');
  desligar();
  assert.equal(relogio.pendentes(), 0);
  relogio.avancar(60000);
  assert.equal(vistos.length, 1, 'nada mais mudou depois de desligar');
  const outro = ensaiar({ qualDica: dicaDaEsperaLonga });
  outro.relogio.avancar(1000);
  outro.desligar();
  assert.equal(outro.relogio.pendentes(), 0);
  outro.relogio.avancar(60000);
  assert.deepEqual(outro.vistos, []);
});

test('com uma frase só, ela entra uma vez e o laço não troca de novo; sem frases, nunca há troca', () => {
  const uma = ensaiar({ qualDica: (ms) => dicaDaEspera(ms, 1) });
  uma.relogio.avancar(40000);
  assert.deepEqual(uma.vistos.filter((estado) => !estado.saindo).map((estado) => estado.indice), [0]);
  const nenhuma = ensaiar({ qualDica: (ms) => dicaDaEspera(ms, 0) });
  nenhuma.relogio.avancar(40000);
  assert.deepEqual(nenhuma.vistos, []);
});

test('a placa: a linha que se vê é escondida do leitor de tela, e a região viva só leva o texto anunciado (que não muda quando a frase troca)', () => {
  const html = renderToStaticMarkup(createElement(PlacaDaGeracao, { texto: g.dicas[1], anunciado: g.montandoTitulo, ehDica: true }));
  assert.equal(html, `<p class="previa-placa" role="status" data-dica=""><span class="somente-leitor">Montando sua trilha</span><span class="previa-placa__linha" aria-hidden="true">Errou? O Stu explica de outro jeito.</span></p>`);
  const outra = renderToStaticMarkup(createElement(PlacaDaGeracao, { texto: g.dicas[2], anunciado: g.montandoTitulo, ehDica: true }));
  assert.equal(html.match(/<span class="somente-leitor">[^<]*<\/span>/)[0], outra.match(/<span class="somente-leitor">[^<]*<\/span>/)[0], 'trocar a frase não muda o que é anunciado');
  assert.notEqual(html, outra);
  const montando = renderToStaticMarkup(createElement(PlacaDaGeracao, { texto: g.montandoTitulo, anunciado: g.montandoTitulo }));
  assert.equal(montando, `<p class="previa-placa" role="status"><span class="somente-leitor">Montando sua trilha</span><span class="previa-placa__linha" aria-hidden="true">Montando sua trilha</span></p>`);
  assert.match(renderToStaticMarkup(createElement(PlacaDaGeracao, { texto: g.dicas[0], anunciado: g.montandoTitulo, ehDica: true, saindo: true })), /data-saindo="true"/);
});

const parametros = (extra = {}) => ({
  aceite: 'livre', passagem: null, sair() {}, cancelar() {}, ajustar() {}, aceitar() {}, remontar() {}, abrirExistente() {}, ...extra,
});
const trilhaEmGeracao = (nos, proposta = null) => ({ objetivo: 'Culinária: receitas básicas', titulo: 'Culinária: receitas básicas', fluxos: nos, proposta });

test('a tela da geração: "Montando sua trilha" no começo; a proposta pronta com a faixa nova; "Criando sua trilha…" enquanto a trilha é criada', () => {
  const montando = renderToStaticMarkup(createElement(PreviaTrilha, {
    ...parametros(), geracao: trilhaEmGeracao([{ titulo: 'Parte 1', licoes: ['Organizar antes de cozinhar'] }]),
  }));
  assert.match(montando, /<p class="previa-placa" role="status"><span class="somente-leitor">Montando sua trilha<\/span><span class="previa-placa__linha" aria-hidden="true">Montando sua trilha<\/span><\/p>/);
  const fluxos = [
    { titulo: 'Parte 1', licoes: [{ titulo: 'Organizar antes de cozinhar' }, { titulo: 'Cortes básicos' }] },
    { titulo: 'Parte 2', licoes: [{ titulo: 'Arroz soltinho' }, { titulo: 'Temperar na medida' }] },
    { titulo: 'Parte 3', licoes: [{ titulo: 'O ponto do ovo' }, { titulo: 'Revisão' }] },
  ];
  const proposta = { token: 'x', titulo: 'Culinária', objetivo: 'Culinária', origem: 'Modo demonstração', fluxos };
  const nosDe = (lista) => lista.map((f) => ({ titulo: f.titulo, licoes: f.licoes.map((l) => l.titulo) }));
  const pronta = renderToStaticMarkup(createElement(PreviaTrilha, { ...parametros(), geracao: trilhaEmGeracao(nosDe(fluxos), proposta) }));
  assert.match(pronta, /<span class="somente-leitor">Sua trilha está pronta: 6 lições curtas em 3 partes\. Começar a lição 1\.<\/span><span class="previa-placa__linha" aria-hidden="true">Sua trilha está pronta: 6 lições curtas em 3 partes\.<\/span>/);
  assert.doesNotMatch(pronta, /Proposta pronta/);
  // Com uma parte só e com uma lição só.
  const umaParte = { ...proposta, fluxos: [fluxos[0]] };
  assert.match(renderToStaticMarkup(createElement(PreviaTrilha, { ...parametros(), geracao: trilhaEmGeracao(nosDe([fluxos[0]]), umaParte) })), /aria-hidden="true">Sua trilha está pronta: 2 lições curtas\.</);
  const umaLicao = { ...proposta, fluxos: [{ titulo: 'Parte 1', licoes: [{ titulo: 'A' }] }] };
  assert.match(renderToStaticMarkup(createElement(PreviaTrilha, { ...parametros(), geracao: trilhaEmGeracao(nosDe(umaLicao.fluxos), umaLicao) })), /aria-hidden="true">Sua trilha está pronta: 1 lição curta\.</);
  // Depois de "Começar a lição 1" (o aceite está salvando): a placa diz "Criando sua trilha…", e o leitor segue ouvindo só a proposta pronta (a criação já é anunciada pelo estudo).
  const criando = renderToStaticMarkup(createElement(PreviaTrilha, { ...parametros({ aceite: 'salvando' }), geracao: trilhaEmGeracao(nosDe(fluxos), proposta) }));
  assert.match(criando, /<p class="previa-placa" role="status"><span class="somente-leitor">Sua trilha está pronta: 6 lições curtas em 3 partes\. Começar a lição 1\.<\/span><span class="previa-placa__linha" aria-hidden="true">Criando sua trilha…<\/span><\/p>/);
  // Se a criação falha, a placa volta à faixa da proposta.
  const erro = renderToStaticMarkup(createElement(PreviaTrilha, { ...parametros({ aceite: 'erro' }), geracao: trilhaEmGeracao(nosDe(fluxos), proposta) }));
  assert.match(erro, /aria-hidden="true">Sua trilha está pronta: 6 lições curtas em 3 partes\.<\/span>/);
});

test('o fonte da tela: as duas esperas usam a conta e as listas do contrato, a espera longa de 12 s da geração continua valendo, e a criação não é anunciada de novo', () => {
  const tela = ler('src/app/previa-trilha.tsx');
  assert.match(tela, /const criando = !!proposta && aceite === 'salvando' && !passagem;/);
  assert.match(tela, /const espera = useDicaDaEspera\(!proposta \? 'proposta' : criando \? 'criacao' : null\);/);
  assert.match(tela, /const qualDica = espera === 'criacao' \? dicaDaEsperaLonga : \(decorridoMs: number\) => dicaDaEspera\(decorridoMs, t\.dicas\.length\);/);
  assert.match(tela, /const dicaDaVez = espera\.indice !== null && !\(semNovidade && !proposta\) \? t\.dicas\[espera\.indice\] : null;/);
  assert.match(tela, /\(criando \? dicaDaVez \?\? t\.criandoTrilha : t\.propostaPronta\(nos\.length, proposta\.fluxos\.length\)\)\s*: semNovidade \? t\.aguardandoLicao : dicaDaVez \?\? t\.montandoTitulo;/);
  assert.match(tela, /const placaAnunciada = proposta \? `\$\{t\.propostaPronta\(nos\.length, proposta\.fluxos\.length\)\} \$\{t\.comecarLicao1\}\.` : semNovidade \? t\.aguardandoLicao : t\.montandoTitulo;/);
  assert.match(tela, /trocarDicasDaEspera\(\{ qualDica, reduzido: movimentoReduzido, aoMudar: setEstado \}\)/);
  const regras = ler('src/app/previa-trilha-regras.ts');
  assert.match(regras, /import \{ ESPERA_DA_GERACAO, faltaParaTrocarADica \} from '@studoo\/contratos';/, 'o relógio é o do contrato, o mesmo do app');
  assert.doesNotMatch(tela, /setInterval/, 'um temporizador por troca, que dorme o tempo certo (não acorda a cada quadro)');
  // As frases não são escritas na tela: vêm de `geracao.dicas` (e a lista da espera longa, de `dicaDaEsperaLonga`).
  assert.doesNotMatch(tela, /Lições curtas, com exercício|Errou\? O Stu explica|cada lição concluída|Cada lição concluída/);
});

test('o CSS da placa: a linha da frase é 15/20, 600, #0B1B5C e centralizada; a placa guarda 2 linhas de altura; reduzido, sem transição', () => {
  const css = ler('src/app/previa-trilha.css');
  assert.match(css, /\.previa-placa\[data-dica\] \{ text-align: center; \}/);
  assert.match(css, /\.previa-placa\[data-dica\] \.previa-placa__linha \{ color: #0b1b5c; font-size: \.9375rem; font-weight: 600; line-height: 1\.3333; \}/);
  assert.match(css, /min-height: calc\(2\.5rem \+ 22px\)/, '2 linhas de 20 px mais o respiro: o mapa embaixo não pula quando a frase tem 1 ou 2 linhas');
  assert.match(css, /\.previa-placa__linha \{ display: block; transition: opacity 150ms ease-out; \}/, '150 ms para sumir e 150 ms para aparecer = 300 ms');
  assert.match(css, /\.previa-placa__linha\[data-saindo\] \{ opacity: 0; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.previa-placa__linha \{ transition: none; \} \}/);
});

test('o tour: nenhuma arte leva o selo "Modo demonstração" nem a linha "Retorno automático" (spec 17, mudança 4)', () => {
  const textoDe = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  for (const [nome, Arte] of [['passo 1 (material)', ArteMaterial], ['passo 2 (ponte)', ArtePonte], ['passo 3 (Explique)', ArteExplique]]) {
    const html = renderToStaticMarkup(createElement(Arte));
    assert.doesNotMatch(html, /estudio-selo|apresentacao-quadro__topo/, `${nome}: sem o selo`);
    assert.doesNotMatch(textoDe(html), /Modo demonstração|Retorno automático/, `${nome}: sem o texto do selo nem a linha do retorno automático`);
  }
  // O resto da arte continua: a citação do material, a faixa da ponte e os cartões do Explique.
  assert.match(textoDe(renderToStaticMarkup(createElement(ArteMaterial))), /Frações\.pdf/);
  assert.match(renderToStaticMarkup(createElement(ArtePonte)), /ponte/i);
  assert.match(textoDe(renderToStaticMarkup(createElement(ArteExplique))), /O que fez sentido/);
  const fonte = ler('src/app/apresentacao.tsx');
  assert.doesNotMatch(fonte, /estudio-selo|estudio\.simulado|ensinoAutomatico|\bm\.simulado/);
  const css = ler('src/app/apresentacao.css');
  assert.doesNotMatch(css, /apresentacao-quadro__topo|\.apresentacao-quadro \.estudio-legenda|\.apresentacao-caderno \.estudio-legenda/, 'o CSS dos selos que saíram também saiu');
  // O selo continua existindo onde ele é verdade: o material lido em demonstração na lição.
  assert.match(ler('src/app/aula.tsx'), /ref\.leitura === 'demonstracao' && <span className="estudio-selo">/);
});
