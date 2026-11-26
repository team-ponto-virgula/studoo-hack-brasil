// Onboarding e primeira vez na web (spec 17, mudanças 1, 2 e 4): a espera da criação da trilha depois de "Começar a lição 1" (a linha embaixo do botão, que diz "Escrevendo suas lições…" e depois troca de frase;
// a placa do alto da geração NÃO tem frases), a faixa da proposta com o texto novo e o tour sem selos de demonstração. Os textos e a conta do tempo são do contrato (tests/onboarding-contrato.test.mjs);
// aqui está o que a web faz com eles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { dicaDaEspera } from '@studoo/contratos';
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

const qualDica = (ms) => dicaDaEspera(ms, g.dicas.length);
/** `comecaEm`: o instante (do toque em "Começar a lição 1") em que a linha aparece e o relógio das frases liga; as horas dos `vistos` são sempre contadas desde o toque. */
function ensaiar({ reduzido = false, comecaEm = 0, qualDicaDaVez = qualDica } = {}) {
  const relogio = relogioDeBrinquedo();
  relogio.avancar(comecaEm);
  const vistos = [];
  const desligar = trocarDicasDaEspera({ qualDica: qualDicaDaVez, reduzido: () => reduzido, aoMudar: (estado) => vistos.push({ ...estado, em: relogio.agora() }), relogio });
  return { relogio, vistos, desligar };
}
const entradas = (vistos) => vistos.filter((estado) => !estado.saindo).map((estado) => [estado.indice, estado.em]);

test('a linha de espera: nos 3 primeiros segundos nada muda ("Escrevendo suas lições…" fica); aos 3 s a 1ª frase entra com o efeito de 300 ms (some em 150, aparece em 150)', () => {
  const { relogio, vistos } = ensaiar();
  relogio.avancar(2999);
  assert.deepEqual(vistos, [], '"Escrevendo suas lições…" fica na linha');
  relogio.avancar(1);
  assert.deepEqual(vistos, [{ indice: null, saindo: true, em: 3000 }], 'aos 3 s, "Escrevendo suas lições…" começa a sumir');
  relogio.avancar(150);
  assert.deepEqual(vistos.at(-1), { indice: 0, saindo: false, em: 3150 }, 'aos 3,15 s, a 1ª frase aparece');
  assert.equal(vistos.length, 2);
});

test('a linha de espera: as três frases, uma nova a cada 5 s, em laço, sempre com o efeito (a frase some e a seguinte aparece 150 ms depois)', () => {
  const { relogio, vistos } = ensaiar();
  relogio.avancar(30000);
  assert.deepEqual(entradas(vistos), [[0, 3150], [1, 8150], [2, 13150], [0, 18150], [1, 23150], [2, 28150]]);
  const saidas = vistos.filter((estado) => estado.saindo);
  assert.deepEqual(saidas.map((estado) => [estado.indice, estado.em]), [[null, 3000], [0, 8000], [1, 13000], [2, 18000], [0, 23000], [1, 28000]], 'cada troca começa com a frase de agora sumindo');
  for (let i = 0; i < saidas.length; i += 1) assert.equal(entradas(vistos)[i][1] - saidas[i].em, 150, 'cada troca dura 300 ms: 150 sumindo e 150 aparecendo');
});

test('depois de "Começar a lição 1": a linha entra 1,5 s depois do toque, a 1ª frase aos 4,5 s (3 s de linha) e as três giram a cada 5 s, em laço', () => {
  const { relogio, vistos } = ensaiar({ comecaEm: 1500 });
  relogio.avancar(23500);
  // Horas desde o toque: a linha entrou aos 1,5 s (1500); a troca começa aos 4,5 s (4500) e a 1ª frase aparece 150 ms depois.
  assert.deepEqual(vistos[0], { indice: null, saindo: true, em: 4500 }, 'aos 4,5 s do toque, "Escrevendo suas lições…" começa a sumir');
  assert.deepEqual(entradas(vistos), [[0, 4650], [1, 9650], [2, 14650], [0, 19650], [1, 24650]]);
  // Espera curta medida (12 s): "Escrevendo suas lições…", a frase 1 e o começo da 2. Espera longa (25 s): as três frases e a 1 de novo.
  const ate = (ms) => entradas(vistos).filter(([, em]) => em <= ms).map(([indice]) => indice);
  assert.deepEqual(ate(12000), [0, 1]);
  assert.deepEqual(ate(25000), [0, 1, 2, 0, 1]);
  assert.equal(vistos.filter((estado) => estado.em < 4500).length, 0, 'antes dos 4,5 s do toque a linha só diz "Escrevendo suas lições…"');
});

test('movimento reduzido: a troca é imediata, sem a etapa de sumir', () => {
  const linha = ensaiar({ reduzido: true });
  linha.relogio.avancar(18000);
  assert.deepEqual(linha.vistos, [{ indice: 0, saindo: false, em: 3000 }, { indice: 1, saindo: false, em: 8000 }, { indice: 2, saindo: false, em: 13000 }, { indice: 0, saindo: false, em: 18000 }]);
  const doToque = ensaiar({ reduzido: true, comecaEm: 1500 });
  doToque.relogio.avancar(13000);
  assert.deepEqual(doToque.vistos.map((estado) => [estado.indice, estado.em]), [[0, 4500], [1, 9500], [2, 14500]], 'aos 4,5 s do toque a frase 1 entra na hora');
});

test('desligar para tudo (inclusive uma troca no meio do efeito) e não deixa temporizador vivo', () => {
  const { relogio, vistos, desligar } = ensaiar();
  relogio.avancar(3100);
  assert.equal(vistos.length, 1, 'no meio do efeito da 1ª troca');
  desligar();
  assert.equal(relogio.pendentes(), 0);
  relogio.avancar(60000);
  assert.equal(vistos.length, 1, 'nada mais mudou depois de desligar');
  const antesDaTroca = ensaiar();
  antesDaTroca.relogio.avancar(1000);
  antesDaTroca.desligar();
  assert.equal(antesDaTroca.relogio.pendentes(), 0, 'a lição abriu ou a criação falhou antes da 1ª frase: a linha sai e as frases param');
  antesDaTroca.relogio.avancar(60000);
  assert.deepEqual(antesDaTroca.vistos, []);
});

test('com uma frase só, ela entra uma vez e o laço não troca de novo; sem frases, nunca há troca', () => {
  const uma = ensaiar({ qualDicaDaVez: (ms) => dicaDaEspera(ms, 1) });
  uma.relogio.avancar(40000);
  assert.deepEqual(uma.vistos.filter((estado) => !estado.saindo).map((estado) => estado.indice), [0]);
  const nenhuma = ensaiar({ qualDicaDaVez: (ms) => dicaDaEspera(ms, 0) });
  nenhuma.relogio.avancar(40000);
  assert.deepEqual(nenhuma.vistos, []);
});

test('a placa: não tem frases que se revezam; a linha que se vê é escondida do leitor de tela, e a região viva só leva o texto anunciado', () => {
  const montando = renderToStaticMarkup(createElement(PlacaDaGeracao, { texto: g.montandoTitulo, anunciado: g.montandoTitulo }));
  assert.equal(montando, `<p class="previa-placa" role="status"><span class="somente-leitor">Montando sua trilha</span><span class="previa-placa__linha" aria-hidden="true">Montando sua trilha</span></p>`);
  const pronta = renderToStaticMarkup(createElement(PlacaDaGeracao, { texto: g.propostaPronta(10, 3), anunciado: `${g.propostaPronta(10, 3)} ${g.comecarLicao1}.` }));
  assert.equal(pronta, `<p class="previa-placa" role="status"><span class="somente-leitor">Sua proposta tem 10 lições em 3 partes. Começar a lição 1.</span><span class="previa-placa__linha" aria-hidden="true">Sua proposta tem 10 lições em 3 partes.</span></p>`);
  // Sem o estado de "frase" nem o de "saindo": a placa só mostra o texto que lhe passam.
  assert.doesNotMatch(renderToStaticMarkup(createElement(PlacaDaGeracao, { texto: g.dicas[0], anunciado: g.montandoTitulo, ehDica: true, saindo: true })), /data-dica|data-saindo/);
});

const parametros = (extra = {}) => ({
  aceite: 'livre', passagem: null, sair() {}, cancelar() {}, ajustar() {}, aceitar() {}, remontar() {}, abrirExistente() {}, ...extra,
});
const trilhaEmGeracao = (nos, proposta = null) => ({ objetivo: 'Culinária: receitas básicas', titulo: 'Culinária: receitas básicas', fluxos: nos, proposta });

test('a tela da geração: "Montando sua trilha" no começo; a proposta pronta com a faixa nova; enquanto a trilha é criada a placa segue com a faixa e o botão diz "Criando sua trilha…"', () => {
  const montando = renderToStaticMarkup(createElement(PreviaTrilha, {
    ...parametros(), geracao: trilhaEmGeracao([{ titulo: 'Parte 1', licoes: ['Organizar antes de cozinhar'] }]),
  }));
  assert.match(montando, /<p class="previa-placa" role="status"><span class="somente-leitor">Montando sua trilha<\/span><span class="previa-placa__linha" aria-hidden="true">Montando sua trilha<\/span><\/p>/);
  assert.doesNotMatch(montando, /previa-espera/, 'na geração da proposta não há linha de espera nem frases');
  const fluxos = [
    { titulo: 'Parte 1', licoes: [{ titulo: 'Organizar antes de cozinhar' }, { titulo: 'Cortes básicos' }] },
    { titulo: 'Parte 2', licoes: [{ titulo: 'Arroz soltinho' }, { titulo: 'Temperar na medida' }] },
    { titulo: 'Parte 3', licoes: [{ titulo: 'O ponto do ovo' }, { titulo: 'Revisão' }] },
  ];
  const proposta = { token: 'x', titulo: 'Culinária', objetivo: 'Culinária', origem: 'Modo demonstração', fluxos };
  const nosDe = (lista) => lista.map((f) => ({ titulo: f.titulo, licoes: f.licoes.map((l) => l.titulo) }));
  const pronta = renderToStaticMarkup(createElement(PreviaTrilha, { ...parametros(), geracao: trilhaEmGeracao(nosDe(fluxos), proposta) }));
  assert.match(pronta, /<span class="somente-leitor">Sua proposta tem 6 lições em 3 partes\. Começar a lição 1\.<\/span><span class="previa-placa__linha" aria-hidden="true">Sua proposta tem 6 lições em 3 partes\.<\/span>/);
  assert.doesNotMatch(pronta, /Proposta pronta/);
  // Com uma parte só e com uma lição só.
  const umaParte = { ...proposta, fluxos: [fluxos[0]] };
  assert.match(renderToStaticMarkup(createElement(PreviaTrilha, { ...parametros(), geracao: trilhaEmGeracao(nosDe([fluxos[0]]), umaParte) })), /aria-hidden="true">Sua proposta tem 2 lições\.</);
  const umaLicao = { ...proposta, fluxos: [{ titulo: 'Parte 1', licoes: [{ titulo: 'A' }] }] };
  assert.match(renderToStaticMarkup(createElement(PreviaTrilha, { ...parametros(), geracao: trilhaEmGeracao(nosDe(umaLicao.fluxos), umaLicao) })), /aria-hidden="true">Sua proposta tem 1 lição\.</);
  // Pronta, antes do toque: a linha de espera existe no lugar dela, escondida, com o texto de sempre; o botão não está ocupado e a linha não é região viva.
  assert.match(pronta, /<p class="previa-espera"><span class="previa-espera__linha">Escrevendo suas lições…<\/span><\/p>/);
  assert.doesNotMatch(pronta, /aria-busy/);
  // Depois de "Começar a lição 1": a placa segue com a faixa da proposta, e o botão fica afundado, ocupado e com o giro.
  const criando = renderToStaticMarkup(createElement(PreviaTrilha, { ...parametros({ aceite: 'iniciando' }), geracao: trilhaEmGeracao(nosDe(fluxos), proposta) }));
  assert.match(criando, /<p class="previa-placa" role="status"><span class="somente-leitor">Sua proposta tem 6 lições em 3 partes\. Começar a lição 1\.<\/span><span class="previa-placa__linha" aria-hidden="true">Sua proposta tem 6 lições em 3 partes\.<\/span><\/p>/);
  assert.match(criando, /<button[^>]*class="[^"]*previa-comecar[^"]*"[^>]*aria-disabled="true"[^>]*aria-busy="true"[^>]*>|<button[^>]*aria-busy="true"[^>]*class="[^"]*previa-comecar/);
  assert.match(criando, /previa-giro[\s\S]*?Preparando sua trilha…/);
  // Se a criação falha, a placa continua com a faixa, o erro de sempre aparece e a linha de espera sai.
  const erro = renderToStaticMarkup(createElement(PreviaTrilha, { ...parametros({ aceite: 'erro' }), geracao: trilhaEmGeracao(nosDe(fluxos), proposta) }));
  assert.match(erro, /aria-hidden="true">Sua proposta tem 6 lições em 3 partes\.<\/span>/);
  assert.match(erro, /<p class="previa-erro" role="alert">Não deu para criar a trilha\. Confira a conexão e tente de novo\.<\/p>/);
  assert.doesNotMatch(erro, /previa-espera" data-visivel/);
});

test('Salvar para depois tem espera e erro próprios e mantém a ação para tentar de novo', () => {
  const fluxos = [{ titulo: 'Parte 1', licoes: [{ titulo: 'Probabilidade' }] }];
  const proposta = { token: 'x', titulo: 'Probabilidade', objetivo: 'Probabilidade', fluxos };
  const renderizar = aceite => renderToStaticMarkup(createElement(PreviaTrilha, {
    ...parametros({ aceite, salvar() {} }), geracao: trilhaEmGeracao([{ ...fluxos[0], licoes: ['Probabilidade'] }], proposta),
  }));
  const salvando = renderizar('salvando');
  assert.match(salvando, /<button[^>]*aria-disabled="true"[^>]*aria-busy="true"[^>]*>Salvando sua trilha…<\/button>/);
  assert.match(salvando, /<button[^>]*class="[^"]*previa-comecar[^"]*"[^>]*aria-disabled="true"[^>]*>Começar a lição 1<\/button>/);
  assert.doesNotMatch(salvando, /Criando sua trilha|Preparando sua trilha|previa-giro|previa-espera" data-visivel/);
  const erro = renderizar('erro-salvar');
  assert.match(erro, /aria-disabled="false"[^>]*>Salvar para depois<\/button>/);
  assert.match(erro, /role="alert">Não deu para salvar\. Tente de novo\.<\/p>/);
  assert.doesNotMatch(erro, /Não deu para criar/);
});

test('o fonte da tela: só a criação tem frases, o relógio liga quando a linha aparece e usa a conta do contrato, a placa não leva frase e a criação não é anunciada de novo', () => {
  const tela = ler('src/app/previa-trilha.tsx');
  assert.match(tela, /function useDicaDaEspera\(ativa: boolean\): EstadoDaEspera \{/);
  assert.match(tela, /trocarDicasDaEspera\(\{ qualDica: \(decorridoMs\) => dicaDaEspera\(decorridoMs, t\.dicas\.length\), reduzido: movimentoReduzido, aoMudar: setEstado \}\)/, 'a conta do contrato, a mesma do app');
  assert.match(tela, /const linhaDaEspera = !!proposta && demorou && aceite === 'iniciando' && !passagem;/, 'a linha entra 1,5 s depois do toque (demorou) e sai com a troca de tela ou com o erro');
  assert.match(tela, /const espera = useDicaDaEspera\(linhaDaEspera\);/, 'o relógio das frases liga quando a linha aparece, não no toque');
  assert.match(tela, /const textoDaLinha = espera\.indice === null \? t\.escrevendoLicoes : t\.dicas\[espera\.indice\];/);
  assert.match(tela, /const placa = proposta \? t\.propostaResumo\(nos\.length, proposta\.fluxos\.length\) : semNovidade \? t\.aguardandoLicao : t\.montandoTitulo;/, 'a placa: sem frases, e com a contagem da proposta também na criação');
  assert.match(tela, /<PlacaDaGeracao texto=\{placa\} anunciado=\{placaAnunciada\} \/>/);
  assert.match(tela, /const placaAnunciada = proposta \? `\$\{t\.propostaResumo\(nos\.length, proposta\.fluxos\.length\)\} \$\{t\.comecarLicao1\}\.` : semNovidade \? t\.aguardandoLicao : t\.montandoTitulo;/);
  assert.match(tela, /<p className="previa-espera" data-visivel=\{linhaDaEspera \|\| \(!!dica && aceite === 'iniciando'\) \|\| undefined\}>\s*\{dica && aceite === 'iniciando'\s*\? <span className="previa-espera__dica">\{dica\}<\/span>\s*: <span className="previa-espera__linha" data-saindo=\{espera\.saindo \|\| undefined\}>\{textoDaLinha\}<\/span>\}\s*<\/p>/, 'a linha não é região viva (sem role): a troca a cada 5 s não é anunciada; passado o tempo, a dica de que a pessoa pode sair ocupa o lugar das frases');
  assert.match(tela, /className="previa-comecar" aria-disabled=\{ocupado\} aria-busy=\{iniciando \|\| undefined\}/, 'o botão fica ocupado enquanto a trilha é criada');
  const regras = ler('src/app/previa-trilha-regras.ts');
  assert.match(regras, /import \{ ESPERA_DA_GERACAO, faltaParaTrocarADica \} from '@studoo\/contratos';/, 'o relógio é o do contrato, o mesmo do app');
  assert.doesNotMatch(tela, /setInterval/, 'um temporizador por troca, que dorme o tempo certo (não acorda a cada quadro)');
  assert.doesNotMatch(tela, /dicaDaEsperaLonga|DICAS_DA_ESPERA_LONGA|dicaDaVez|ehDica/, 'os nomes obsoletos e a frase na placa saíram');
  // As frases não são escritas na tela: vêm de `geracao.dicas`.
  assert.doesNotMatch(tela, /Lições curtas, com exercício|Errou\? O Stu explica|cada lição concluída|Cada lição concluída/);
});

test('o CSS: a placa volta a ser a de antes das frases; a linha de espera troca com efeito de 300 ms (150 para sumir e 150 para aparecer), e reduzido, sem transição', () => {
  const css = ler('src/app/previa-trilha.css');
  assert.doesNotMatch(css, /data-dica|\.previa-placa__linha/, 'a placa não tem frases: nada de estado de frase nem de efeito nela');
  assert.doesNotMatch(css, /min-height: calc\(2\.5rem \+ 22px\)/, 'a placa não precisa mais guardar duas linhas');
  assert.match(css, /\.previa-espera__linha \{ display: block; transition: opacity 150ms ease-out; \}/, '150 ms para sumir e 150 ms para aparecer = 300 ms');
  assert.match(css, /\.previa-espera__linha\[data-saindo\] \{ opacity: 0; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.previa-espera__linha \{ transition: none; \} \}/);
  // A linha segue no lugar e no estilo de hoje: centralizada, 14 px, #5E6A85, escondida enquanto não é a hora.
  assert.match(css, /\.previa-espera, \.previa-erro \{ width: min\(100%,36rem\); margin-inline: auto; color: #5e6a85; font-size: \.875rem; text-align: center; \}/);
  assert.match(css, /\.previa-espera:not\(\[data-visivel\]\) \{ display: none; \}/);
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
