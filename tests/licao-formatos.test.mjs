import assert from "node:assert/strict";
import { test } from "node:test";
import {
  codificarResposta,
  etapasDaLicao,
  faltaParaVerificar,
  frequenciasDoAcorde,
  inferirTipoTrecho,
  linhasDePassos,
  paraBase64,
  partesDaLacuna,
  respostaCompleta,
  semAspas,
  sintetizarAcorde,
  sintetizarBatida,
  ultimoExercicio,
} from "@studoo/contratos";
import {
  apresentarExercicio,
  avaliarResposta,
  conteudoValido,
  distancia,
  respostaCerta,
  respostaErrada,
} from "../src/dominio/aprendizado/plano.ts";
import { exercicioDaResposta, reforcoDoExercicio } from "../src/dominio/aprendizado/reforco.ts";
import { iniciarGeracao } from "../src/servidor/aprendizado/geracao.ts";
import { DEMOS } from "../src/servidor/ia/demos.ts";
import { criarGeradorFalso } from "../src/servidor/ia/falsa.ts";

/*
 * Formatos de lição para aprender qualquer assunto: lacuna tolerante, ordenar, associar, verdadeiro ou falso com
 * justificativa, resposta aberta, etapas flexíveis, tipos de trecho, acorde sintetizado e as trilhas prontas da demo.
 */

process.env.IA = "falsa";
process.env.STUDOO_IA_FALSA_PAUSA_MS = "0";

const retornos = { feedbackCorreto: "Certo.", feedbackIncorreto: "Ainda não." };
const lacuna = (gabarito, extra = {}) => ({ tipo: "lacuna", enunciado: "Complete.", gabarito, ...retornos, ...extra });

test("a lacuna tolera maiúscula, acento, pontuação, artigo e um deslize em palavra longa", () => {
  const tarraxa = lacuna(["tarraxa"]);
  assert.deepEqual(avaliarResposta(tarraxa, "Tarraxa"), { correta: true, feedback: "Certo." });
  assert.equal(avaliarResposta(tarraxa, "  tarraxa. ")?.correta, true);
  assert.equal(avaliarResposta(tarraxa, "a tarraxa")?.correta, true);
  const deslize = avaliarResposta(tarraxa, "taraxa");
  assert.equal(deslize.correta, true);
  assert.match(deslize.observacao, /Quase igual: a forma certa é “tarraxa”/);
  assert.equal(avaliarResposta(tarraxa, "tarracha")?.correta, false, "dois erros numa palavra de 7 letras não passam");
  assert.equal(avaliarResposta(lacuna(["saudade"]), "saudades")?.correta, true);
  assert.equal(avaliarResposta(lacuna(["indicador"]), "indcadr")?.correta, true, "até dois deslizes a partir de 9 letras");

  const acento = avaliarResposta(lacuna(["coração"]), "coracao");
  assert.equal(acento.correta, true);
  assert.match(acento.observacao, /Atenção ao acento: escreve-se “coração”/);

  // Símbolos, números e palavras curtas continuam exatos.
  assert.equal(avaliarResposta(lacuna([">="]), ">")?.correta, false);
  assert.equal(avaliarResposta(lacuna([">="]), ">=")?.correta, true);
  assert.equal(avaliarResposta(lacuna(["1888"]), "1889")?.correta, false);
  assert.equal(avaliarResposta(lacuna(["mapa"]), "mapo")?.correta, false);

  // Quando a grafia é a lição (outro idioma), não há tolerância a deslize: "were" não vale por "where".
  const where = lacuna(["where"], { exata: true });
  assert.equal(avaliarResposta(where, "were")?.correta, false);
  assert.equal(avaliarResposta(where, "Where")?.correta, true);
  assert.ok(distancia("taraxa", "tarraxa") === 1 && distancia("abc", "xyz123", 2) === 3);
});

test("ordenar e associar conferem a resposta e dizem o que já está certo", () => {
  const ordenar = {
    tipo: "ordenar",
    enunciado: "Ordene.",
    itens: [{ id: "a", texto: "A" }, { id: "b", texto: "B" }, { id: "c", texto: "C" }, { id: "d", texto: "D" }],
    gabarito: ["a", "b", "c", "d"],
    ...retornos,
  };
  assert.ok(conteudoValido({ objetivo: "o", conceito: "c", exemplo: "e", origem: "x", exercicio: ordenar }));
  assert.deepEqual(avaliarResposta(ordenar, codificarResposta.ordem(["a", "b", "c", "d"])), { correta: true, feedback: "Certo.", certos: ["a", "b", "c", "d"] });
  assert.deepEqual(avaliarResposta(ordenar, "a,c,b,d")?.certos, ["a", "d"]);
  assert.equal(avaliarResposta(ordenar, "a,c,b,d")?.correta, false);
  for (const invalida of ["a,b,c", "a,a,b,c", "a,b,c,x", ""]) assert.equal(avaliarResposta(ordenar, invalida), null, invalida);

  const associar = {
    tipo: "associar",
    enunciado: "Ligue.",
    esquerda: [{ id: "e1", texto: "Hello" }, { id: "e2", texto: "Thanks" }, { id: "e3", texto: "Bye" }],
    direita: [{ id: "d1", texto: "Olá" }, { id: "d2", texto: "Obrigado" }, { id: "d3", texto: "Tchau" }],
    gabarito: ["e1=d1", "e2=d2", "e3=d3"],
    ...retornos,
  };
  assert.ok(conteudoValido({ objetivo: "o", conceito: "c", exemplo: "e", origem: "x", exercicio: associar }));
  assert.equal(avaliarResposta(associar, codificarResposta.pares([["e3", "d3"], ["e1", "d1"], ["e2", "d2"]]))?.correta, true);
  const parcial = avaliarResposta(associar, "e1=d1,e2=d3,e3=d2");
  assert.equal(parcial.correta, false);
  assert.deepEqual(parcial.certos, ["e1"]);
  for (const invalida of ["e1=d1,e2=d2", "e1=d1,e2=d1,e3=d3", "e1=d1,e1=d2,e3=d3", "e1=d9,e2=d2,e3=d3"]) {
    assert.equal(avaliarResposta(associar, invalida), null, invalida);
  }
  // Gabarito que não fecha (direita repetida) não vale.
  assert.equal(conteudoValido({ objetivo: "o", conceito: "c", exemplo: "e", origem: "x", exercicio: { ...associar, gabarito: ["e1=d1", "e2=d1", "e3=d3"] } }), false);
});

test("verdadeiro ou falso exige o valor e a justificativa certos", () => {
  const vf = {
    tipo: "verdadeiro_falso",
    enunciado: "Julgue.",
    afirmacao: "Ervas frescas entram no começo.",
    justificativas: [{ id: "aroma", texto: "Perdem o aroma" }, { id: "cor", texto: "Ficam verdes" }],
    gabarito: ["falso", "aroma"],
    ...retornos,
  };
  assert.equal(avaliarResposta(vf, codificarResposta.verdadeiroFalso(false, "aroma"))?.correta, true);
  const semJustificativa = avaliarResposta(vf, "falso:cor");
  assert.equal(semJustificativa.correta, false);
  assert.match(semJustificativa.observacao, /justificativa/);
  assert.deepEqual(semJustificativa.certos, ["valor"], "o valor certo não fica com a cor do erro");
  assert.deepEqual(avaliarResposta(vf, "verdadeiro:aroma"), { correta: false, feedback: "Ainda não.", certos: ["justificativa"] });
  assert.deepEqual(avaliarResposta(vf, "falso:aroma")?.certos, ["valor", "justificativa"]);
  for (const invalida of ["talvez:aroma", "falso:xyz", "falso", "falso:aroma:x"]) assert.equal(avaliarResposta(vf, invalida), null, invalida);
});

test("a resposta aberta confere as ideias-chave no modo demonstração e mostra os critérios e o modelo", () => {
  const aberta = {
    tipo: "aberta",
    enunciado: "Explique.",
    minimo: 30,
    gabarito: ["abolicao|lei aurea|escraviz", "fazendeir", "republica|imperio"],
    criterios: ["Cita a abolição", "Fala dos fazendeiros", "Liga à República"],
    modelo: "A Lei Áurea desagradou os fazendeiros, que deixaram de apoiar o Império.",
    ...retornos,
  };
  assert.ok(conteudoValido({ objetivo: "o", conceito: "c", exemplo: "e", origem: "x", exercicio: aberta }));
  const boa = avaliarResposta(aberta, "Com a abolição, os fazendeiros ficaram contra o império.");
  assert.equal(boa.correta, true);
  assert.equal(boa.simulado, true);
  assert.deepEqual(boa.criterios.map(({ atendido }) => atendido), [true, true, true]);
  assert.equal(boa.modelo, aberta.modelo);
  const parcial = avaliarResposta(aberta, "Com a Lei Áurea, os fazendeiros perderam a mão de obra escravizada.");
  assert.equal(parcial.correta, true, "duas de três ideias passam");
  assert.match(parcial.feedback, /^Boa resposta! Para ficar completa, faltou: liga à República\.$/);
  assert.notEqual(parcial.feedback, aberta.feedbackCorreto, "sem o elogio de resposta completa");
  const fraca = avaliarResposta(aberta, "Foi um período de muitas mudanças importantes no país.");
  assert.equal(fraca.correta, false);
  assert.deepEqual(fraca.criterios.map(({ atendido }) => atendido), [false, false, false]);
  assert.equal(avaliarResposta(aberta, "Curta demais."), null, "abaixo do mínimo de caracteres");
  assert.equal(avaliarResposta(aberta, "Com a abolição\nos fazendeiros ficaram contra o império.")?.correta, true, "a aberta aceita quebra de linha");
  assert.equal(avaliarResposta(aberta, "x".repeat(1001)), null);
});

test("apresentar embaralha sem entregar a ordem, esconde o gabarito e define o tipo do trecho", () => {
  const ordenar = {
    tipo: "ordenar",
    enunciado: "Coloque em ordem cronológica.",
    itens: ["a", "b", "c", "d"].map((id) => ({ id, texto: id.toUpperCase() })),
    gabarito: ["a", "b", "c", "d"],
    trecho: "SELECT nome FROM alunos WHERE nota ___ 7;",
    ...retornos,
  };
  const publico = apresentarExercicio(ordenar);
  assert.notDeepEqual(publico.itens.map(({ id }) => id), ordenar.gabarito);
  assert.deepEqual(apresentarExercicio(ordenar), publico, "sempre a mesma ordem para o mesmo exercício");
  assert.equal(publico.trechoTipo, "codigo");
  assert.ok(!Object.keys(publico).some((chave) => /gabarito|feedback|criterios|modelo|exata/.test(chave)));

  assert.equal(inferirTipoTrecho("Antes de estudar, desenhe o ___ do assunto."), "frase");
  assert.equal(inferirTipoTrecho("“Independência ou ___!”"), "citacao");
  assert.equal(inferirTipoTrecho("1 xícara de arroz = ___ xícaras de água"), "frase");
  assert.equal(inferirTipoTrecho("2x + 3 = 11"), "formula");
  assert.equal(inferirTipoTrecho("1. Lave\n2. Corte\n3. Refogue"), "passos");
  assert.deepEqual(linhasDePassos("1. Lave\n2) Corte\n- Refogue"), ["Lave", "Corte", "Refogue"]);
  assert.deepEqual(partesDaLacuna("Eu giro a ___ na cabeça."), ["Eu giro a ", " na cabeça."]);
  assert.equal(semAspas("“Independência ou ___!”"), "Independência ou ___!");
  assert.equal(respostaCompleta(publico, "a,b"), false, "ordem incompleta não verifica");
  assert.equal(respostaCompleta(publico, "d,c,b,a"), true);
  assert.equal(respostaCompleta({ tipo: "verdadeiro_falso", enunciado: "x", afirmacao: "y", justificativas: [] }, "falso:"), false);
  assert.equal(respostaCompleta({ tipo: "aberta", enunciado: "x", minimo: 10 }, "curta"), false);
});

test("a barra de fração vale de 1 a 12 partes e nunca pinta mais que o total", () => {
  const base = { objetivo: "o", conceito: "c", exemplo: "e", origem: "x", exercicio: lacuna(["2"]) };
  assert.ok(conteudoValido({ ...base, recurso: { tipo: "fracao", numerador: 3, denominador: 8, rotulo: "3/8" } }));
  assert.ok(conteudoValido({ ...base, recurso: { tipo: "fracao", numerador: 0, denominador: 1 } }));
  for (const recurso of [{ tipo: "fracao", numerador: 9, denominador: 8 }, { tipo: "fracao", numerador: 1, denominador: 13 }, { tipo: "fracao", numerador: 1.5, denominador: 4 }]) {
    assert.equal(conteudoValido({ ...base, recurso }), false, JSON.stringify(recurso));
  }
});

test("as etapas da lição mudam com o número de exercícios e a prática", () => {
  const exercicio = { tipo: "lacuna", enunciado: "x" };
  assert.deepEqual(etapasDaLicao({ exercicio }).map(({ tipo }) => tipo), ["conceito", "exemplo", "exercicio"]);
  const completa = etapasDaLicao({ exercicio, exercicios: [exercicio, exercicio], pratica: { tarefa: "t", minutos: 3 } });
  assert.deepEqual(completa, [
    { tipo: "conceito" }, { tipo: "exemplo" }, { tipo: "exercicio", indice: 0 }, { tipo: "exercicio", indice: 1 }, { tipo: "pratica" },
  ]);
  assert.equal(ultimoExercicio(completa), 3, "com prática, a aula volta ao último exercício, não à prática");
});

test("o acorde vira um WAV válido, determinístico e com som", () => {
  const am = [-1, 0, 2, 2, 1, 0];
  assert.equal(frequenciasDoAcorde(am).length, 5);
  assert.ok(Math.abs(frequenciasDoAcorde(am)[0] - 110) < 0.01, "a 5ª corda solta é o Lá de 110 Hz");
  const wav = sintetizarAcorde(am, { segundos: 1 });
  const texto = (inicio, fim) => String.fromCharCode(...wav.slice(inicio, fim));
  assert.equal(texto(0, 4), "RIFF");
  assert.equal(texto(8, 12), "WAVE");
  assert.equal(wav.length, 44 + 22050 * 2);
  assert.deepEqual(sintetizarAcorde(am, { segundos: 1 }), wav);
  const amostras = new Int16Array(wav.buffer.slice(44));
  assert.ok(Math.max(...amostras.slice(0, 4000).map(Math.abs)) > 10_000, "o ataque soa forte");
  assert.equal(paraBase64(wav.slice(0, 300)), Buffer.from(wav.slice(0, 300)).toString("base64"));
});

test("a batida toca o acorde em cada tempo, para baixo e para cima", () => {
  const am = [-1, 0, 2, 2, 1, 0];
  const wav = sintetizarBatida(am, { bpm: 60, compassos: 1 });
  const amostras = new Int16Array(wav.buffer.slice(44));
  assert.equal(amostras.length, Math.round(22050 * (4 + 1.6)));
  // Cada tempo (1 s a 60 bpm) começa com uma descida forte.
  for (let tempo = 0; tempo < 4; tempo += 1) {
    const inicio = tempo * 22050;
    assert.ok(Math.max(...amostras.slice(inicio, inicio + 2000).map(Math.abs)) > 6000, `tempo ${tempo + 1}`);
  }
  assert.deepEqual(sintetizarBatida(am, { bpm: 60, compassos: 1 }), wav);
});

test("o reforço sem IA faz uma pergunta mais simples sobre o exercício errado, em cada formato", () => {
  const exemplo = "Um exemplo da lição.";
  const retornos = { feedbackCorreto: "Certo.", feedbackIncorreto: "Explicação do erro." };
  const exercicios = [
    { tipo: "multipla_escolha", enunciado: "Qual?", opcoes: [{ id: "a", texto: "Certa" }, { id: "b", texto: "Errada 1" }, { id: "c", texto: "Errada 2" }], gabarito: ["a"], ...retornos },
    { tipo: "lacuna", enunciado: "Complete.", trecho: "Eu giro a ___.", gabarito: ["tarraxa"], ...retornos },
    { tipo: "verdadeiro_falso", enunciado: "Julgue.", afirmacao: "O braço para.", justificativas: [{ id: "p", texto: "Pêndulo" }, { id: "f", texto: "Força" }], gabarito: ["falso", "p"], ...retornos },
    { tipo: "ordenar", enunciado: "Ordene.", itens: ["a", "b", "c", "d"].map((id) => ({ id, texto: id.toUpperCase() })), gabarito: ["a", "b", "c", "d"], ...retornos },
    { tipo: "associar", enunciado: "Ligue.", esquerda: [{ id: "e1", texto: "Hello" }, { id: "e2", texto: "Bye" }], direita: [{ id: "d1", texto: "Olá" }, { id: "d2", texto: "Tchau" }], gabarito: ["e1=d1", "e2=d2"], ...retornos },
    { tipo: "aberta", enunciado: "Explique.", minimo: 20, gabarito: ["anelar", "batida"], criterios: ["Fala do anelar", "Fala da batida"], ...retornos },
  ];
  const erradas = ["c", "taracha", "verdadeiro:p", "b,a,c,d", "e1=d2,e2=d1", "não sei explicar isso ainda"];
  const esperado = { multipla_escolha: ["Certa", "Errada 2"], lacuna: ["tarraxa", "taracha"], verdadeiro_falso: ["Falsa", "Verdadeira"], ordenar: ["A", "D", "C"], associar: ["Olá", "Tchau"] };
  for (const [posicao, exercicio] of exercicios.entries()) {
    const reforco = reforcoDoExercicio(exercicio, erradas[posicao], exemplo);
    assert.ok(conteudoValido({ objetivo: "o", origem: "x", ...reforco }), exercicio.tipo);
    assert.equal(reforco.conceito, "Explicação do erro.", "a explicação é a do erro");
    assert.equal(reforco.exercicio.tipo, "multipla_escolha");
    const textos = reforco.exercicio.opcoes.map(({ texto }) => texto);
    if (esperado[exercicio.tipo]) assert.deepEqual([...textos].sort(), [...esperado[exercicio.tipo]].sort(), exercicio.tipo);
    const certa = reforco.exercicio.opcoes.find(({ id }) => id === reforco.exercicio.gabarito[0]).texto;
    assert.equal(certa, { multipla_escolha: "Certa", lacuna: "tarraxa", verdadeiro_falso: "Falsa", ordenar: "A", associar: "Olá", aberta: "Fala do anelar" }[exercicio.tipo]);
  }
  // A resposta errada aponta o exercício da lição a que ela pertence.
  assert.equal(exercicioDaResposta(exercicios, "e1=d2,e2=d1").tipo, "associar");
  assert.equal(exercicioDaResposta(exercicios, null).tipo, "multipla_escolha");
});

const objetivosDasDemos = {
  violao: "Violão do zero: primeiros acordes",
  ingles: "Inglês para conversar em viagens",
  culinaria: "Culinária: receitas básicas",
  historia: "História do Brasil para a prova",
  fracoes: "Frações para a prova do 6º ano",
  fotografia: "Fotografia com o celular",
};

test("cada demo com assunto monta a própria trilha e todas as lições passam pela aula", async () => {
  const gerador = criarGeradorFalso();
  const sinal = new AbortController().signal;
  const tipos = new Set();
  const recursos = new Set();
  assert.equal(DEMOS.length, Object.keys(objetivosDasDemos).length);
  let falas = 0;
  let praticas = 0;
  let extras = 0;
  for (const demo of DEMOS) {
    const objetivo = objetivosDasDemos[demo.chave];
    const eventos = [];
    for await (const evento of iniciarGeracao(`teste-${crypto.randomUUID()}`, objetivo).eventos(sinal)) eventos.push(evento);
    const { proposta } = eventos.at(-1);
    assert.equal(proposta.titulo, demo.plano.titulo, objetivo);
    assert.match(proposta.origem, /Modo demonstração/);
    assert.ok(proposta.fluxos.every(({ titulo }) => ["Primeiros passos", "Praticando", "Desafio"].includes(titulo)));
    const esqueleto = { gerador: `falsa-${demo.chave}-v1`, origem: proposta.origem, ...proposta };
    for (const [fluxo, trecho] of proposta.fluxos.entries()) {
      for (const [licao] of trecho.licoes.entries()) {
        const conteudo = await gerador.gerarConteudo(esqueleto, fluxo, licao, sinal);
        const rotulo = `${demo.chave} ${fluxo}.${licao}`;
        assert.ok(conteudoValido(conteudo), rotulo);
        for (const exercicio of [conteudo.exercicio, ...(conteudo.extras ?? [])]) {
          tipos.add(exercicio.tipo);
          assert.equal(avaliarResposta(exercicio, respostaCerta(exercicio))?.correta, true, `${rotulo} certa`);
          assert.equal(avaliarResposta(exercicio, respostaErrada(exercicio))?.correta, false, `${rotulo} errada`);
          const publico = apresentarExercicio(exercicio);
          assert.ok(!JSON.stringify(publico).includes("gabarito"), rotulo);
          if (exercicio.trecho) assert.ok(publico.trechoTipo, `${rotulo} tipo do trecho`);
        }
        if (conteudo.recurso) recursos.add(conteudo.recurso.tipo);
        falas += conteudo.falas?.length ?? 0;
        praticas += conteudo.pratica ? 1 : 0;
        extras += conteudo.extras?.length ?? 0;
      }
    }
  }
  assert.deepEqual([...tipos].sort(), ["aberta", "associar", "lacuna", "multipla_escolha", "ordenar", "verdadeiro_falso"]);
  assert.deepEqual([...recursos].sort(), ["acorde", "fracao", "linha_do_tempo"]);
  assert.ok(falas >= 8 && praticas >= 5 && extras >= 4, `${falas} falas, ${praticas} práticas, ${extras} extras`);
});

test("todas as ideias populares da tela inicial têm trilha pronta no modo demonstração", async () => {
  const { mensagens } = await import("@studoo/contratos/experiencia");
  const populares = mensagens.pedido.temas.find(({ id }) => id === "populares").exemplos;
  for (const ideia of populares) {
    const eventos = [];
    for await (const evento of iniciarGeracao(`teste-${crypto.randomUUID()}`, ideia).eventos(new AbortController().signal)) eventos.push(evento);
    assert.match(eventos.at(-1).proposta.origem, /trilha pronta sobre/, ideia);
  }
});

test("cada objetivo cai na trilha certa: SQL, demo com assunto ou genérica", async () => {
  const titulo = async (objetivo) => {
    const eventos = [];
    for await (const evento of iniciarGeracao(`teste-${crypto.randomUUID()}`, objetivo).eventos(new AbortController().signal)) eventos.push(evento);
    return eventos.at(-1).proposta.titulo;
  };
  assert.equal(await titulo("Quero aprender violão"), "Violão do zero: primeiros acordes");
  assert.equal(await titulo("inglês para a viagem de férias"), "Inglês para viagem");
  assert.equal(await titulo("Inglês para entrevista"), "Inglês para entrevista", "entrevista fica com a genérica");
  assert.equal(await titulo("aprender a cozinhar o básico"), "Culinária: receitas básicas");
  assert.equal(await titulo("História do Brasil: Império"), "História do Brasil: da Colônia à República");
  assert.equal(await titulo("SQL para a prova"), "SQL para a prova");
  assert.equal(await titulo("Frações"), "Frações: do inteiro à soma");
  assert.equal(await titulo("quero tirar fotos melhores"), "Fotografia com o celular");
  assert.equal(await titulo("Fotossíntese para a prova"), "Fotossíntese para a prova", "fotossíntese não é fotografia");
  assert.equal(await titulo("Jardinagem em apartamento"), "Jardinagem em apartamento");
});

test("o rodapé diz o que falta para verificar, em cada formato, e some com a resposta completa", async () => {
  const { textoDaFalta } = await import("@studoo/contratos/experiencia");
  const dica = (exercicio, resposta) => {
    const falta = faltaParaVerificar(exercicio, resposta);
    return falta && textoDaFalta(falta);
  };
  const itens = [{ id: "a", texto: "A" }, { id: "b", texto: "B" }, { id: "c", texto: "C" }];
  const ordenar = { tipo: "ordenar", enunciado: "Ordene", itens };
  assert.equal(dica(ordenar, ""), "Faltam 3 itens para colocar em ordem.");
  assert.equal(dica(ordenar, "b,a"), "Falta 1 item para colocar em ordem.");
  assert.equal(dica(ordenar, "b,a,c"), null);
  const associar = { tipo: "associar", enunciado: "Ligue", esquerda: itens.slice(0, 2), direita: [{ id: "1", texto: "1" }, { id: "2", texto: "2" }] };
  assert.equal(dica(associar, "a=2"), "Falta 1 par para ligar.");
  assert.equal(dica(associar, "a=2,b=1"), null);
  const vf = { tipo: "verdadeiro_falso", enunciado: "VF", afirmacao: "X", justificativas: itens };
  assert.equal(dica(vf, ""), "Diga se a frase é verdadeira ou falsa.");
  assert.equal(dica(vf, codificarResposta.verdadeiroFalso(true, "")), "Agora escolha o porquê.");
  assert.equal(dica(vf, codificarResposta.verdadeiroFalso(false, "b")), null);
  const aberta = { tipo: "aberta", enunciado: "Explique", minimo: 20 };
  assert.equal(dica(aberta, "curta"), "Escreva mais 15 caracteres.");
  assert.equal(dica(aberta, "uma resposta com mais de vinte"), null);
  assert.equal(dica({ tipo: "multipla_escolha", enunciado: "Escolha", opcoes: itens }, ""), "Escolha uma opção para verificar.");
  assert.equal(dica({ tipo: "lacuna", enunciado: "Complete" }, "  "), "Escreva sua resposta para verificar.");
  assert.equal(dica({ tipo: "lacuna", enunciado: "Complete" }, "ok"), null);
});
