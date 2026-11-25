// Refinamento da UI (spec 16), a criação da trilha na web. Item 1: quando a proposta fica pronta, a tela vai para a lição 1, não para o troféu.
// A conta da rolagem é pura (src/app/previa-trilha-regras.ts) e o teste a confere; o fonte da tela confere o resto (o nó 1, o Stu ao lado, o troféu a uma rolagem).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DURACAO_ACOMPANHAR_MS, DURACAO_ATE_O_NO_1_MS, entradaMaisNova, rolagemNoInstante, rolagemParaCentrarNo, rolarAte, saidaSuave } from '../src/app/previa-trilha-regras.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');

test('item 1: a rolagem até o nó 1 dura 600 ms, com saída suave (começa depressa e pousa devagar)', () => {
  assert.equal(DURACAO_ATE_O_NO_1_MS, 600);
  assert.equal(saidaSuave(0), 0);
  assert.equal(saidaSuave(1), 1);
  assert.ok(saidaSuave(0.5) > 0.85, 'na metade do tempo já andou mais de 85% (saída suave)');
  let anterior = -1;
  for (let passo = 0; passo <= 20; passo += 1) {
    const valor = saidaSuave(passo / 20);
    assert.ok(valor >= anterior, 'nunca volta');
    anterior = valor;
  }
  assert.equal(saidaSuave(-1), 0, 'antes do começo');
  assert.equal(saidaSuave(7), 1, 'depois do fim');
});

test('item 1: a rolagem no instante: de onde estava até o nó 1; com duração 0 (movimento reduzido), já no destino', () => {
  assert.equal(rolagemNoInstante(611, 0, 0, 600), 611, 'no começo, onde estava (no troféu)');
  assert.equal(rolagemNoInstante(611, 0, 600, 600), 0, 'no fim, no nó 1');
  assert.equal(rolagemNoInstante(611, 0, 9999, 600), 0, 'além do fim, segue no nó 1');
  assert.ok(rolagemNoInstante(611, 0, 300, 600) < 611 * 0.2, 'na metade já está perto do destino');
  assert.equal(rolagemNoInstante(611, 0, 0, 0), 0, 'movimento reduzido: direto ao nó 1');
  assert.equal(rolagemNoInstante(0, 240, 100, 0), 240);
});

test('item 1: o nó 1 vai para o centro da área livre; no começo ou no fim do mapa, o que a rolagem permitir', () => {
  // O nó está 800 px abaixo do topo do conteúdo; a área tem 600 px: rolar 500 põe o centro dele no meio da área.
  assert.equal(rolagemParaCentrarNo({ centroDoNoNaTela: 100 + 800 - 0, topoDaArea: 100, alturaDaArea: 600, rolagem: 0, alturaDoConteudo: 2000 }), 500);
  // Já rolado 300: o centro do nó está em 400 na janela, a área começa em 100: no conteúdo ele está em 400 − 100 + 300 = 600; área de 500 → 350.
  assert.equal(rolagemParaCentrarNo({ centroDoNoNaTela: 400, topoDaArea: 100, alturaDaArea: 500, rolagem: 300, alturaDoConteudo: 1500 }), 350);
  // Nó perto do topo do conteúdo (o caso da lição 1): não há como centrar, fica no começo.
  assert.equal(rolagemParaCentrarNo({ centroDoNoNaTela: 100 + 63 - 365, topoDaArea: 100, alturaDaArea: 605, rolagem: 365, alturaDoConteudo: 1216 }), 0);
  // Nó perto do fim: nunca passa do fim da rolagem.
  assert.equal(rolagemParaCentrarNo({ centroDoNoNaTela: 100 + 1500, topoDaArea: 100, alturaDaArea: 600, rolagem: 0, alturaDoConteudo: 1600 }), 1000);
  // Conteúdo menor que a área: nada rola.
  assert.equal(rolagemParaCentrarNo({ centroDoNoNaTela: 300, topoDaArea: 100, alturaDaArea: 600, rolagem: 0, alturaDoConteudo: 500 }), 0);
});

test('item 1: a tela da proposta vai ao nó 1 (e não mais ao troféu), com o Stu ao lado, e o troféu fica a um toque de "Ver o fim da trilha"', () => {
  const tela = ler('src/app/previa-trilha.tsx');
  // Ao ficar pronta (e a pessoa acompanhando): acha o nó 1, calcula o centro da área livre e rola; movimento reduzido vai direto.
  assert.match(tela, /area\.querySelector<HTMLElement>\('\[data-primeiro\] \.previa-no__face'\)/);
  assert.match(tela, /rolagemParaCentrarNo\(\{/);
  assert.match(tela, /rolarAte\(area, alvo, movimentoReduzido\(\) \? 0 : DURACAO_ATE_O_NO_1_MS, \(\) => setIndoAoPrimeiro\(false\)\)/);
  // O trecho de "proposta pronta" não rola mais até o troféu.
  const trechoPronta = tela.slice(tela.indexOf('propostaApresentada.current = proposta.token;'), tela.indexOf('painel.current?.querySelector<HTMLButtonElement>(\'.previa-comecar\')'));
  assert.ok(trechoPronta.length > 200 && !/trofeu\.current/.test(trechoPronta), 'o troféu não é mais o destino da proposta pronta');
  // O Stu (stu-feliz) fica no nó 1 enquanto a tela vai para lá, e só vai para o troféu quando a pessoa chega nele.
  assert.match(tela, /const ocupado = iniciando \|\| salvando;/);
  assert.match(tela, /const stuNoTrofeu = !!proposta && trofeuAVista && !indoAoPrimeiro && !ocupado && !falhou;/);
  assert.match(tela, /const comStu = proposta \? i === 0 && !stuNoTrofeu : i === nos\.length - 1;/);
  assert.match(tela, /proposta \? 'stu-feliz'/);
  // O troféu continua a uma rolagem de distância: "Ver o fim da trilha" rola até ele.
  const voltar = tela.slice(tela.indexOf('function voltarAAcompanhar()'), tela.indexOf('useLayoutEffect(() => {', tela.indexOf('function voltarAAcompanhar()')));
  assert.match(voltar, /const alvo = proposta \? trofeu\.current/);
  assert.match(voltar, /rolarAte\(area, Math\.max\(0, destino\)/);
  // Ao sair da tela, a rolagem é cancelada.
  assert.match(tela, /useEffect\(\(\) => \(\) => cancelarRolagem\.current\?\.\(\), \[\]\);/);
});

// ---- A corrida da produção (8a6ba14): com a IA real, a proposta chega com a rolagem suave do último nó ainda andando. ----

/** Um navegador de brinquedo: relógio e quadros do teste, e uma rolagem suave NATIVA que continua mudando o scrollTop sozinha até alguém mandar parar. */
function ensaio({ nativoAndando = false, topoInicial = 1391, passoNativo = 9 } = {}) {
  let agora = 0;
  let fila = [];
  let proximoId = 1;
  const ouvintes = new Map();
  const teclas = new Set();
  const area = {
    scrollTop: topoInicial,
    nativo: nativoAndando,
    chamadasDeScrollTo: [],
    scrollTo(opcoes) { this.chamadasDeScrollTo.push(opcoes); if (opcoes.behavior === 'auto') { this.nativo = false; this.scrollTop = opcoes.top; } },
    addEventListener(tipo, ouvinte) { ouvintes.set(tipo, [...(ouvintes.get(tipo) ?? []), ouvinte]); },
    removeEventListener(tipo, ouvinte) { ouvintes.set(tipo, (ouvintes.get(tipo) ?? []).filter((item) => item !== ouvinte)); },
  };
  const ambiente = {
    agora: () => agora,
    pedirQuadro(chamar) { const id = proximoId++; fila.push([id, chamar]); return id; },
    cancelarQuadro(id) { fila = fila.filter(([existente]) => existente !== id); },
    aoTeclar(ouvinte) { teclas.add(ouvinte); return () => teclas.delete(ouvinte); },
  };
  const quadro = (ms = 16) => {
    agora += ms;
    if (area.nativo) area.scrollTop = Math.max(0, area.scrollTop - passoNativo); // o navegador, rolando suave por conta própria
    const atuais = fila; fila = [];
    for (const [, chamar] of atuais) chamar(agora);
  };
  const andar = (total, ms = 16) => { for (let t = 0; t < total; t += ms) quadro(ms); };
  return {
    area, ambiente, quadro, andar,
    pessoa: (tipo) => (ouvintes.get(tipo) ?? []).forEach((ouvinte) => ouvinte()),
    tecla: (tecla) => [...teclas].forEach((ouvinte) => ouvinte(tecla)),
    ouvintesVivos: () => [...ouvintes.values()].flat().length + teclas.size,
    quadrosPendentes: () => fila.length,
  };
}

test('corrida da produção: com uma rolagem suave nativa ainda andando, a animação até o nó 1 para a nativa e CHEGA ao nó 1 (antes largava no meio do mapa)', () => {
  const m = ensaio({ nativoAndando: true });
  let terminou = 0;
  rolarAte(m.area, 0, DURACAO_ATE_O_NO_1_MS, () => { terminou += 1; }, m.ambiente);
  assert.deepEqual(m.area.chamadasDeScrollTo, [{ top: 1391, behavior: 'auto' }], 'a primeira coisa é parar a rolagem suave nativa, no ponto em que ela estava');
  assert.equal(m.area.nativo, false, 'a nativa parou');
  const vistas = [];
  for (let t = 0; t < 700; t += 16) { m.quadro(); vistas.push(m.area.scrollTop); }
  assert.equal(m.area.scrollTop, 0, 'chegou ao nó 1');
  assert.equal(terminou, 1, 'avisou uma vez só');
  assert.ok(vistas.every((valor, i) => i === 0 || valor <= vistas[i - 1]), 'só desce até o nó 1, sem voltar');
  assert.ok(vistas[Math.round(300 / 16)] < 1391 * 0.2, 'na metade do tempo já está perto (saída suave)');
  assert.equal(m.quadrosPendentes(), 0);
  assert.equal(m.ouvintesVivos(), 0, 'sem ouvintes sobrando');
});

test('corrida da produção: o acompanhamento dos nós usa a mesma rolagem, então a proposta que chega no meio dele a substitui e vai ao nó 1', () => {
  const m = ensaio({ topoInicial: 900 });
  // O último nó chegou: o acompanhamento rola para ele (para baixo) em 420 ms...
  const cancelarAcompanhamento = rolarAte(m.area, 1500, DURACAO_ACOMPANHAR_MS, () => undefined, m.ambiente);
  m.andar(150);
  assert.ok(m.area.scrollTop > 900 && m.area.scrollTop < 1500, `a meio caminho: ${m.area.scrollTop}`);
  // ...e a proposta chega 150 ms depois: a tela pronta cancela o acompanhamento e começa a ida ao nó 1.
  cancelarAcompanhamento();
  let chegou = false;
  rolarAte(m.area, 0, DURACAO_ATE_O_NO_1_MS, () => { chegou = true; }, m.ambiente);
  m.andar(700);
  assert.equal(m.area.scrollTop, 0);
  assert.equal(chegou, true);
});

test('a pessoa assume: roda, toque, clique na barra ou tecla de rolagem param a animação no ponto em que está, e só uma vez', () => {
  for (const [rotulo, gesto] of [['roda', (m) => m.pessoa('wheel')], ['toque', (m) => m.pessoa('touchstart')], ['arrasto', (m) => m.pessoa('touchmove')], ['clique', (m) => m.pessoa('pointerdown')], ['tecla', (m) => m.tecla('PageUp')], ['seta', (m) => m.tecla('ArrowUp')]]) {
    const m = ensaio({ topoInicial: 1200 });
    let terminou = 0;
    rolarAte(m.area, 0, DURACAO_ATE_O_NO_1_MS, () => { terminou += 1; }, m.ambiente);
    m.andar(200);
    const onde = m.area.scrollTop;
    assert.ok(onde > 0 && onde < 1200, `${rotulo}: no meio do caminho (${onde})`);
    gesto(m);
    gesto(m);
    m.andar(600);
    assert.equal(m.area.scrollTop, onde, `${rotulo}: a animação largou o controle, a pessoa manda`);
    assert.equal(terminou, 1, `${rotulo}: avisou uma vez`);
    assert.equal(m.ouvintesVivos(), 0, `${rotulo}: sem ouvintes sobrando`);
  }
  // Uma tecla que não rola (uma letra, o Tab) não interrompe.
  const m = ensaio({ topoInicial: 1200 });
  rolarAte(m.area, 0, DURACAO_ATE_O_NO_1_MS, () => undefined, m.ambiente);
  m.andar(100);
  m.tecla('a'); m.tecla('Tab'); m.tecla('Enter');
  m.andar(700);
  assert.equal(m.area.scrollTop, 0, 'letras, Tab e Enter não mexem na rolagem');
});

test('cancelar para sem avisar; duração 0 (movimento reduzido) vai direto; o mesmo lugar não anima', () => {
  const m = ensaio({ topoInicial: 800 });
  let terminou = 0;
  const cancelar = rolarAte(m.area, 0, 600, () => { terminou += 1; }, m.ambiente);
  m.andar(100);
  const onde = m.area.scrollTop;
  cancelar();
  m.andar(700);
  assert.equal(m.area.scrollTop, onde, 'cancelada, a posição fica');
  assert.equal(terminou, 0, 'cancelar não chama aoTerminar');
  assert.equal(m.ouvintesVivos(), 0);
  const direto = ensaio({ nativoAndando: true });
  let acabou = false;
  rolarAte(direto.area, 0, 0, () => { acabou = true; }, direto.ambiente);
  assert.equal(direto.area.scrollTop, 0, 'movimento reduzido: já no nó 1, sem esperar quadro');
  assert.equal(direto.area.nativo, false, 'e parando a rolagem suave nativa que estivesse andando');
  assert.equal(acabou, true);
  assert.equal(direto.quadrosPendentes(), 0);
  const igual = ensaio({ topoInicial: 0 });
  let avisou = false;
  rolarAte(igual.area, 0, 600, () => { avisou = true; }, igual.ambiente);
  assert.equal(avisou, true, 'já estava lá');
  assert.equal(igual.quadrosPendentes(), 0);
});

test('a tela não usa mais rolagem suave nativa na prévia: tudo passa pela rolagem própria (acompanhar, ir ao nó 1, "Ver o fim da trilha")', () => {
  assert.equal(DURACAO_ACOMPANHAR_MS, 420);
  const tela = ler('src/app/previa-trilha.tsx');
  assert.doesNotMatch(tela, /behavior: ['"]smooth['"]/, 'nenhum scrollTo suave nativo sobrou');
  assert.equal((tela.match(/rolarAte\(/g) ?? []).length, 3, 'acompanhar, nó 1 e fim da trilha');
  assert.match(tela, /rolarAte\(area, Math\.max\(0, centro - area\.clientHeight \* 0\.6\), movimentoReduzido\(\) \? 0 : DURACAO_ACOMPANHAR_MS, \(\) => undefined\)/);
  assert.match(tela, /rolarAte\(area, Math\.max\(0, destino\), movimentoReduzido\(\) \? 0 : DURACAO_ACOMPANHAR_MS, \(\) => undefined\)/);
  // "Começar a lição 1" no meio da ida ao nó 1: a passagem assume, a rolagem própria é cancelada e o Stu volta ao lugar de antes.
  assert.match(tela, /cancelarRolagem\.current\?\.\(\);\s*setIndoAoPrimeiro\(false\);/);
  // A regra de "a pessoa subiu, então não acompanha" continua: depois da ida ao nó 1, o "Ver o fim da trilha" aparece.
  assert.match(tela, /else if \(scrollTop < maiorRolagem\.current - 40\) \{\s*setAcompanhando\(false\);/);
});

test('ensaio da corrida: a IA falsa tem um botão para a proposta chegar tempos depois do último nó (padrão 0: como a IA de verdade, logo depois)', async () => {
  // Os erros HTTP carregam o cliente do banco ao importar; este teste não toca no banco, então um endereço fictício basta.
  process.env.DATABASE_URL ??= 'postgresql://teste:teste@127.0.0.1:5432/teste';
  process.env.STUDOO_CHAVE_ASSINATURA ??= '0123456789abcdef'.repeat(4);
  const { criarGeradorFalso } = await import('../src/servidor/ia/falsa.ts');
  const anterior = { nos: process.env.STUDOO_IA_FALSA_PAUSA_MS, proposta: process.env.STUDOO_IA_FALSA_PAUSA_PROPOSTA_MS };
  const esperaDepoisDoUltimoNo = async () => {
    const quadros = criarGeradorFalso().gerarEstrutura('Frações', new AbortController().signal, { aoVivo: true });
    let ultimo = Date.now();
    let nos = 0;
    for (;;) {
      const passo = await quadros.next();
      if (passo.done) return { espera: Date.now() - ultimo, nos };
      nos += 1;
      ultimo = Date.now();
    }
  };
  try {
    process.env.STUDOO_IA_FALSA_PAUSA_MS = '0';
    delete process.env.STUDOO_IA_FALSA_PAUSA_PROPOSTA_MS;
    const padrao = await esperaDepoisDoUltimoNo();
    assert.ok(padrao.nos > 3, 'a trilha tem vários nós');
    assert.ok(padrao.espera < 60, `sem o botão, a proposta vem logo depois do último nó (${padrao.espera} ms)`);
    process.env.STUDOO_IA_FALSA_PAUSA_PROPOSTA_MS = '150';
    const comPausa = await esperaDepoisDoUltimoNo();
    assert.ok(comPausa.espera >= 140 && comPausa.espera < 400, `com 150 ms, a proposta espera ${comPausa.espera} ms depois do último nó`);
    process.env.STUDOO_IA_FALSA_PAUSA_PROPOSTA_MS = 'abc';
    assert.ok((await esperaDepoisDoUltimoNo()).espera < 60, 'valor inválido volta ao padrão');
  } finally {
    for (const [chave, valor] of [['STUDOO_IA_FALSA_PAUSA_MS', anterior.nos], ['STUDOO_IA_FALSA_PAUSA_PROPOSTA_MS', anterior.proposta]]) {
      if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor;
    }
  }
});

test('o troféu à vista segue a notificação MAIS NOVA do observador (com a página ocupada, várias chegam juntas): senão o Stu pula para o troféu e o "Ver o fim da trilha" some', () => {
  // O que a depuração mostrou com três navegadores ao mesmo tempo: [à vista, fora da tela] chegam juntas, e a primeira (velha) vencia.
  const juntas = [{ isIntersecting: true }, { isIntersecting: false }];
  assert.equal(entradaMaisNova(juntas).isIntersecting, false);
  assert.equal(entradaMaisNova([{ isIntersecting: true }]).isIntersecting, true);
  assert.equal(entradaMaisNova([]), undefined);
  const tela = ler('src/app/previa-trilha.tsx');
  assert.match(tela, /new IntersectionObserver\(\(entradas\) => \{\s*const entrada = entradaMaisNova\(entradas\);\s*if \(!entrada\) return;/);
  assert.doesNotMatch(tela, /new IntersectionObserver\(\(\[entrada\]\)/, 'nada de pegar só a primeira notificação');
});
