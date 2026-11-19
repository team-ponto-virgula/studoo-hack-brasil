import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acertouParte,
  codificarResposta,
  conferirFala,
  embaralharComSemente,
  embaralharExercicio,
  respostaParaTentarDeNovo,
  etapasDaLicao,
  faltaParaVerificar,
  ordemInicial,
  frequenciasDoAcorde,
  inferirTipoTrecho,
  linhasDePassos,
  motivoParaRever,
  origemLegivel,
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
  normalizarResposta,
  respostaCerta,
  respostaErrada,
  armadilhaNoTexto,
  termosDaLicao,
  termosPresentes,
} from "../src/dominio/aprendizado/plano.ts";
import { exercicioDaResposta, reforcoDoExercicio } from "../src/dominio/aprendizado/reforco.ts";
import { textoParaRever } from "../packages/contratos/src/experiencia.ts";
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
  assert.equal(avaliarResposta(tarraxa, "tirraxo")?.correta, false, "dois erros numa palavra de 7 letras não passam");
  assert.match(avaliarResposta(tarraxa, "tarracha")?.observacao ?? "", /Atenção à grafia/, "ch e x soam igual: passa com aviso de grafia");
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
  assert.deepEqual([...recursos].sort(), ["acorde", "fracao", "imagem", "linha_do_tempo"]);
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
  const dica = (exercicio, resposta, inicial) => {
    const falta = faltaParaVerificar(exercicio, resposta, inicial);
    return falta && textoDaFalta(falta);
  };
  const itens = [{ id: "a", texto: "A" }, { id: "b", texto: "B" }, { id: "c", texto: "C" }];
  const ordenar = { tipo: "ordenar", enunciado: "Ordene", itens };
  assert.equal(dica(ordenar, ""), "Faltam 3 itens para colocar em ordem.");
  assert.equal(dica(ordenar, "b,a"), "Falta 1 item para colocar em ordem.");
  assert.equal(dica(ordenar, "b,a,c"), null);
  // Lista única (spec 08, revisão de 19/11): a ordem do servidor já está completa, mas só verifica depois de mudar.
  assert.equal(dica(ordenar, "a,b,c"), "Mude a ordem para verificar.");
  assert.equal(respostaCompleta(ordenar, "a,b,c"), false, "a ordem do servidor nunca vai para a verificação");
  assert.equal(ordemInicial(ordenar), "a,b,c");
  // Nova tentativa: compara com a ordem com que ela começou (o que já mudou antes não conta).
  assert.equal(respostaCompleta(ordenar, "b,a,c", "b,a,c"), false);
  assert.equal(dica(ordenar, "b,a,c", "b,a,c"), "Mude a ordem para verificar.");
  assert.equal(respostaCompleta(ordenar, "a,b,c", "b,a,c"), true, "voltar à ordem do servidor também é mudar");
  assert.equal(dica(ordenar, "c,a,b", "b,a,c"), null);
  const associar = { tipo: "associar", enunciado: "Ligue", esquerda: itens.slice(0, 2), direita: [{ id: "1", texto: "1" }, { id: "2", texto: "2" }] };
  assert.equal(dica(associar, "a=2"), "Falta 1 par para ligar.");
  assert.equal(dica(associar, "a=2,b=1"), null);
  const vf = { tipo: "verdadeiro_falso", enunciado: "VF", afirmacao: "X", justificativas: itens };
  assert.equal(dica(vf, ""), "Diga se a frase é verdadeira ou falsa.");
  assert.equal(dica(vf, codificarResposta.verdadeiroFalso(true, "")), "Agora escolha o porquê.");
  assert.equal(dica(vf, codificarResposta.verdadeiroFalso(false, "b")), null);
  const aberta = { tipo: "aberta", enunciado: "Explique", minimo: 20 };
  assert.equal(dica(aberta, "curta"), "Escreva mais um pouco: faltam 15 letras.");
  assert.equal(dica(aberta, "uma resposta com mais de vinte"), null);
  assert.equal(dica({ tipo: "multipla_escolha", enunciado: "Escolha", opcoes: itens }, ""), "Escolha uma opção para verificar.");
  assert.equal(dica({ tipo: "lacuna", enunciado: "Complete" }, "  "), "Escreva sua resposta para verificar.");
  assert.equal(dica({ tipo: "lacuna", enunciado: "Complete" }, "ok"), null);
});

test("a correção tolera grafia e digitação, mas não negação nem a grafia que é a lição", () => {
  const lacuna = (gabarito, resposta, exata = false) =>
    avaliarResposta({ tipo: "lacuna", enunciado: "Complete", gabarito, exata, feedbackCorreto: "ok", feedbackIncorreto: "não" }, resposta);
  assert.deepEqual(lacuna(["tarraxa"], "tarracha"), { correta: true, feedback: "ok", observacao: "Atenção à grafia: escreve-se “tarraxa”." });
  assert.equal(lacuna(["exceção"], "excessão").correta, true);
  assert.equal(lacuna(["tarraxa"], "trastes").correta, false);
  assert.equal(lacuna(["where"], "were", true).correta, false, "com exata, a grafia é a lição");

  const aberta = (gabarito, resposta) => avaliarResposta(
    { tipo: "aberta", enunciado: "Explique", minimo: 10, gabarito, feedbackCorreto: "ok", feedbackIncorreto: "não" }, resposta,
  ).criterios.map(({ atendido }) => atendido);
  assert.deepEqual(aberta(["coffee", "please"], "I like a coffe and pao de queijo please"), [true, true], "um deslize de digitação");
  const batida = ["continu|nao para|nao paro|sem parar", "anelar"];
  assert.deepEqual(aberta(batida, "Eu não continuo a batida e levo o anelar"), [false, true], "“não continuo” não é continuar");
  assert.deepEqual(aberta(batida, "Eu não paro a batida e levo o anelar"), [true, true], "o termo que já começa com “não”");
  assert.deepEqual(aberta(batida, "O braço continua e o anelar viaja"), [true, true]);
});

test("violão: a explicação que para a batida não ganha o critério da batida", () => {
  const licao = DEMOS.find(({ chave }) => chave === "violao").plano.fluxos.flatMap(({ licoes }) => licoes).at(-1);
  const resultado = avaliarResposta(licao.exercicio, "Eu deixo o indicador e o médio, levo o anelar para a 5ª corda e paro a batida.");
  assert.deepEqual(resultado.criterios.map(({ atendido }) => atendido), [true, true, false]);
});

test("“Quase lá!” só para quem acertou uma parte", () => {
  assert.equal(acertouParte({ correta: false, feedback: "", comprovante: "" }), false);
  assert.equal(acertouParte({ correta: false, feedback: "", comprovante: "", certos: [] }), false);
  assert.equal(acertouParte({ correta: false, feedback: "", comprovante: "", certos: ["a"] }), true);
  assert.equal(acertouParte({ correta: false, feedback: "", comprovante: "", criterios: [{ texto: "x", atendido: true }] }), true);
  assert.equal(acertouParte({ correta: true, feedback: "", comprovante: "", certos: ["a"] }), false);
});

test("a origem do modo demonstração aparece sem jargão", () => {
  assert.equal(origemLegivel("Modo demonstração: trilha pronta sobre violão"), "Trilha pronta do Studoo sobre violão");
  assert.equal(origemLegivel("Modo demonstração: conteúdo de exemplo"), "Conteúdo de exemplo do Studoo");
  assert.equal(origemLegivel("Página 2 do seu material"), "Página 2 do seu material");
});

test("nas trilhas prontas, o retorno de erro da lacuna dá uma pista sem entregar a resposta", () => {
  const exercicios = DEMOS.flatMap(({ plano }) => plano.fluxos.flatMap(({ licoes }) => licoes))
    .flatMap((licao) => [licao.exercicio, ...(licao.extras ?? [])])
    .filter(({ tipo }) => tipo === "lacuna");
  assert.ok(exercicios.length >= 10, `${exercicios.length} lacunas`);
  for (const exercicio of exercicios) {
    const retorno = ` ${normalizarResposta(exercicio.feedbackIncorreto).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
    for (const resposta of exercicio.gabarito) {
      assert.ok(!retorno.includes(` ${normalizarResposta(resposta)} `), `“${exercicio.feedbackIncorreto}” entrega “${resposta}”`);
    }
  }
});

test("inglês para viagem: imigração no começo e a revisão com mais prática", () => {
  const licoes = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos.flatMap(({ licoes }) => licoes);
  assert.ok(licoes[0].falas.some(({ texto }) => /vacation/i.test(texto)));
  const revisao = licoes.find(({ titulo }) => titulo.startsWith("Revisão"));
  assert.equal(1 + (revisao.extras?.length ?? 0), 3);
  assert.ok(licoes.slice(0, -1).some((licao) => licao.falas?.some(({ texto }) => /coffee/i.test(texto))), "o café aparece antes do restaurante");
});

test("lacuna: a frase em volta junto vale, e a grafia por um triz (quando é a lição) ganha a dica", () => {
  const lacuna = (gabarito, resposta, extra = {}) =>
    avaliarResposta({ tipo: "lacuna", enunciado: "Complete", gabarito, feedbackCorreto: "ok", feedbackIncorreto: "não", ...extra }, resposta);
  const preco = { exata: true, trecho: "How ___ is the coffee?" };
  assert.deepEqual(lacuna(["much"], "how much", preco), { correta: true, feedback: "ok", observacao: "Certo! Na lacuna, basta escrever o que falta." });
  assert.equal(lacuna(["much"], "How much is the coffee?", preco).correta, true);
  assert.equal(lacuna(["much"], "how", preco).correta, false, "só o contexto não é a resposta");
  const quase = lacuna(["repeat"], "repet", { exata: true });
  assert.equal(quase.correta, false, "com exata, a grafia continua sendo a lição");
  assert.match(quase.observacao, /Confira a grafia/);
  assert.equal(acertouParte(quase), true, "o título vira “Quase lá!”");
  assert.equal(lacuna(["where"], "what", { exata: true }).observacao, undefined, "longe demais: sem dica de grafia");
});

test("recursos: a troca de acorde desenha os dois, e a imagem diz de onde veio", () => {
  const am = { nome: "Am", casas: [-1, 0, 2, 2, 1, 0], dedos: [0, 0, 2, 3, 1, 0] };
  const base = { tipo: "lacuna", enunciado: "x", gabarito: ["a"], feedbackCorreto: "a", feedbackIncorreto: "b" };
  const licao = (recurso) => conteudoValido({ objetivo: "o", conceito: "c", exemplo: "e", origem: "teste", exercicio: base, recurso });
  assert.equal(licao({ tipo: "acorde", nome: "C", casas: [-1, 3, 2, 0, 1, 0], anterior: am }), true);
  assert.equal(licao({ tipo: "acorde", nome: "C", casas: [-1, 3, 2, 0, 1, 0], anterior: { nome: "Am", casas: [0, 0] } }), false);
  const violao = DEMOS.find(({ chave }) => chave === "violao").plano.fluxos.flatMap(({ licoes }) => licoes);
  assert.equal(violao[0].recurso.tipo, "imagem");
  assert.equal(violao[0].recurso.fonte, "Ilustração");
  assert.equal(violao[2].recurso.anterior.nome, "Am", "a troca mostra o Lá menor ao lado do Dó");
});

test("conferência da fala: números por extenso, contrações e o que faltou, na ordem da frase", () => {
  assert.deepEqual(conferirFala("It's fifteen dollars.", "it is 15 dollars", "en-US"), { acertos: 4, total: 4, faltaram: [], nota: "otima" });
  assert.deepEqual(conferirFala("It's fifteen dollars.", "its fifty dollars", "en-US"), { acertos: 3, total: 4, faltaram: ["fifteen"], nota: "quase" });
  assert.equal(conferirFala("Nice to meet you!", "nice to meat you", "en-US").nota, "quase");
  assert.deepEqual(conferirFala("Excuse me, where is the train station?", "excuse me where train", "en-US").faltaram, ["is", "the", "station"]);
  assert.equal(conferirFala("Fica ao lado do hotel.", "fica ao lado do hotel", "pt-BR").nota, "otima");
  assert.equal(conferirFala("Hello! I'm Ana.", "", "en-US").nota, "tente");
});

test("“Ensine ao Stu” sem IA: as ideias-chave vêm dos exercícios e o retorno diz o que veio e o que faltou", () => {
  const licoes = (chave) => DEMOS.find((demo) => demo.chave === chave).plano.fluxos.flatMap(({ licoes }) => licoes);
  const ingles = termosDaLicao(licoes("ingles")[0]);
  assert.ok(ingles.includes("Hello") && ingles.includes("I'm from Brazil"));
  const fala = "pra cumprimentar fala Hello, pra dizer de onde vc é fala I am from Brazil e quando conhece alguem fala Nice to meet you";
  assert.deepEqual(termosPresentes(fala, ingles), ["Hello", "I'm from Brazil", "Nice to meet you"], "“I am” vale como “I'm”");
  const violao = termosDaLicao(licoes("violao")[0]);
  assert.deepEqual(termosPresentes("a tarraxa afina e a boca solta o som", violao), ["Tarraxa", "Boca"]);
});

test("reforço sem IA: o motivo cita o que a pessoa fez", () => {
  const licao = DEMOS.find((demo) => demo.chave === "violao").plano.fluxos[0].licoes[0];
  const direita = licao.exercicio.direita.map(({ id }) => id);
  const errada = licao.exercicio.esquerda.map(({ id }, posicao) => `${id}=${direita[(posicao + 1) % direita.length]}`).join(",");
  assert.match(reforcoDoExercicio(licao.exercicio, errada, licao.exemplo).motivo, /^Você ligou “Tarraxa” a “/);
  assert.match(reforcoDoExercicio(licao.exercicio, "tarraxa=inexistente", licao.exemplo).motivo, /caminho mais curto/, "id que não existe não quebra");
});

test("resposta aberta: sem o critério essencial não passa, mesmo com os outros (“I like” não é “I'd like”)", () => {
  const exercicio = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos.flatMap(({ licoes }) => licoes)
    .find(({ titulo }) => titulo === "Pedir comida no restaurante").exercicio;
  const semEducacao = avaliarResposta(exercicio, "I like one coffee and cheese bread please");
  assert.equal(semEducacao.correta, false);
  assert.deepEqual(semEducacao.criterios.map(({ atendido }) => atendido), [false, true, true, true], "o pão de queijo também é conferido");
  assert.match(semEducacao.observacao, /“I like” quer dizer “eu gosto”/, "a armadilha da resposta vira o aviso");
  assert.equal(avaliarResposta(exercicio, "I would like a coffee and a cheese bread, please").correta, true);
});

test("tentar de novo mantém o que estava certo", () => {
  const itens = [{ id: "a", texto: "A" }, { id: "b", texto: "B" }, { id: "c", texto: "C" }];
  const associar = { tipo: "associar", enunciado: "Ligue", esquerda: itens, direita: itens };
  const avaliacao = (certos) => ({ correta: false, feedback: "", comprovante: "", certos });
  assert.equal(respostaParaTentarDeNovo(associar, "a=a,b=c,c=b", avaliacao(["a"])), "a=a");
  const ordenar = { tipo: "ordenar", enunciado: "Ordene", itens };
  assert.equal(respostaParaTentarDeNovo(ordenar, "a,c,b", avaliacao(["a"])), "a,,", "o certo fica; as outras posições viram vaga");
  assert.equal(respostaParaTentarDeNovo(ordenar, "c,b,a", avaliacao(["b"])), ",b,", "o do meio também fica no lugar");
  assert.equal(respostaParaTentarDeNovo(ordenar, "c,a,b", avaliacao([])), "", "sem nada certo, recomeça");
  assert.equal(respostaCompleta(ordenar, "a,,"), false, "com vaga, ainda não dá para verificar");
  const vf = { tipo: "verdadeiro_falso", enunciado: "VF", afirmacao: "X", justificativas: itens };
  assert.equal(respostaParaTentarDeNovo(vf, "falso:b", avaliacao(["valor"])), "falso:");
  assert.equal(respostaParaTentarDeNovo({ tipo: "aberta", enunciado: "E", minimo: 10 }, "meu texto", avaliacao([])), "meu texto");
  // Na lacuna, o que foi escrito fica para corrigir a grafia; a escolha recomeça.
  assert.equal(respostaParaTentarDeNovo({ tipo: "lacuna", enunciado: "L" }, "repit", avaliacao([])), "repit");
  assert.equal(respostaParaTentarDeNovo({ tipo: "multipla_escolha", enunciado: "M", opcoes: itens }, "b", avaliacao([])), "");
});

test("lacuna: uma palavra de cortesia junto não tira o acerto", () => {
  const lacuna = { tipo: "lacuna", enunciado: "Complete", trecho: "Sorry, can you ___?", gabarito: ["repeat"], exata: true, feedbackCorreto: "ok", feedbackIncorreto: "não" };
  for (const resposta of ["repeat please", "Please repeat", "Sorry, can you repeat, please?", "repeat, por favor"]) {
    const avaliacao = avaliarResposta(lacuna, resposta);
    assert.equal(avaliacao.correta, true, resposta);
    assert.match(avaliacao.observacao, /basta escrever o que falta/, resposta);
  }
  assert.equal(avaliarResposta(lacuna, "please").correta, false, "só a cortesia não é a resposta");
  assert.equal(avaliarResposta(lacuna, "speak please").correta, false, "a palavra errada continua errada");
});

test("demonstração: escutas com tradução e a lição de direções cobra o caminho", () => {
  const licoes = DEMOS.flatMap(({ plano }) => plano.fluxos.flatMap(({ licoes }) => licoes));
  for (const licao of licoes) {
    for (const exercicio of [licao.exercicio, ...(licao.extras ?? [])]) {
      if (exercicio.fala && !exercicio.trecho) assert.ok(exercicio.fala.traducao, `${licao.titulo}: a escuta "${exercicio.fala.texto}" tem tradução`);
    }
  }
  const direcoes = licoes.find(({ titulo }) => titulo === "Pedir informações na rua");
  const exercicios = [direcoes.exercicio, ...direcoes.extras];
  assert.equal(exercicios.length, 3);
  assert.ok(exercicios.some(({ fala }) => /turn left/i.test(fala?.texto ?? "")), "um exercício cobra virar à esquerda");
  const violao = licoes.find(({ titulo }) => /partes do violão/i.test(titulo)) ?? licoes.find(({ recurso }) => recurso?.tipo === "imagem");
  assert.match(violao.recurso.descricao, /① tarraxa, na cabeça/);
});

test("dica de grafia com até duas letras de diferença em palavras de 6 ou mais (continua errada quando é a lição)", () => {
  const lacuna = { tipo: "lacuna", enunciado: "Complete", gabarito: ["repeat"], exata: true, feedbackCorreto: "ok", feedbackIncorreto: "não" };
  const repit = avaliarResposta(lacuna, "repit");
  assert.equal(repit.correta, false);
  assert.match(repit.observacao, /Confira a grafia/);
});

test("ideias do Stu: as opções de um exercício de escuta (traduções) não contam", () => {
  const restaurante = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos.flatMap(({ licoes }) => licoes)
    .find(({ titulo }) => titulo === "Pedir comida no restaurante");
  assert.ok(!termosDaLicao(restaurante).includes("A conta"));
});

test("trilhas prontas: o retorno do erro dá uma pista sem entregar a resposta", () => {
  const comparavel = (texto) => texto.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[“”"‘’.,!?:;()]/g, " ").replace(/\s+/g, " ").trim();
  for (const { chave, plano } of DEMOS) {
    for (const licao of plano.fluxos.flatMap(({ licoes }) => licoes)) {
      for (const exercicio of [licao.exercicio, ...(licao.extras ?? [])]) {
        const dica = comparavel(exercicio.feedbackIncorreto);
        const onde = `${chave} · ${licao.titulo} · ${exercicio.tipo}`;
        if (exercicio.tipo === "multipla_escolha") {
          const certa = comparavel(exercicio.opcoes.find(({ id }) => id === exercicio.gabarito[0]).texto).replace(/^(a|o|as|os|um|uma) /, "");
          if (certa.split(" ").length >= 2) assert.ok(!dica.includes(certa), `${onde}: a dica repete a opção certa`);
        }
        if (exercicio.tipo === "verdadeiro_falso") assert.doesNotMatch(dica, /^e (falsa|verdadeira)/, `${onde}: a dica começa pela resposta`);
        if (exercicio.tipo === "associar") {
          const citados = exercicio.esquerda.filter(({ texto }) => dica.includes(comparavel(texto))).length;
          assert.ok(citados < exercicio.esquerda.length, `${onde}: a dica cita todos os pares`);
        }
      }
    }
  }
});

test("trilhas prontas: cada lição tem o seu “outro jeito de entender”, diferente da explicação e do exemplo", () => {
  for (const { chave, plano } of DEMOS) {
    for (const licao of plano.fluxos.flatMap(({ licoes }) => licoes)) {
      assert.ok(licao.outroJeito && licao.outroJeito.length <= 600, `${chave} · ${licao.titulo}`);
      assert.notEqual(licao.outroJeito, licao.conceito);
      assert.notEqual(licao.outroJeito, licao.exemplo);
      assert.ok(conteudoValido(licao), `${chave} · ${licao.titulo} continua válida`);
    }
  }
  // A trilha de inglês fecha com a revisão, depois do restaurante.
  const ingles = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos.flatMap(({ licoes }) => licoes);
  assert.equal(ingles.at(-1).titulo, "Revisão: um dia de viagem");
  assert.match(ingles.find(({ titulo }) => titulo === "Pedir comida no restaurante").exercicio.enunciado, /cheese bread/);
  // O violão ensina as mãos e a afinação logo na primeira lição.
  const violao = DEMOS.find(({ chave }) => chave === "violao").plano.fluxos[0].licoes[0];
  assert.match(violao.conceito, /mão esquerda/);
  assert.match(violao.pratica.passos.join(" "), /app afinador/, "a afinação começa pelo app afinador");
  assert.match(violao.pratica.passos.join(" "), /Ouvir o Mi/, "sem app, o Mi que o próprio Studoo toca");
  // No primeiro dia, a vitória fácil vem antes (postura e tocar as cordas soltas); afinar é um bônus, sem pressão.
  assert.match(violao.pratica.tarefa, /toque cada corda solta/);
  assert.match(violao.pratica.passos.at(-1), /^Bônus, se quiser/);
});

test("vale rever: a maior parte errada antes do acerto ou a prática em “ainda não”; um erro só não marca", () => {
  assert.equal(motivoParaRever({ acertosDePrimeira: 1, exercicios: 2 }), null, "um erro em dois faz parte de aprender");
  assert.equal(motivoParaRever({ acertosDePrimeira: 2, exercicios: 3 }), null);
  assert.equal(motivoParaRever({ acertosDePrimeira: 0, exercicios: 2 }), "erros");
  assert.equal(motivoParaRever({ acertosDePrimeira: 1, exercicios: 3 }), "erros");
  assert.equal(motivoParaRever({ acertosDePrimeira: 2, exercicios: 2, pratica: "ainda_nao" }), "pratica");
  assert.equal(motivoParaRever({ acertosDePrimeira: 0, exercicios: 2, pratica: "ainda_nao" }), "erros_e_pratica");
  assert.equal(motivoParaRever({ acertosDePrimeira: null, exercicios: null }), null, "conclusão antiga, sem resumo");
  // O lembrete da conclusão usa o mesmo critério do mapa.
  assert.match(textoParaRever({ acertos: 2, acertosDePrimeira: 0, exercicios: 2 }), /errou 2 exercícios antes de acertar\./);
  assert.match(textoParaRever({ acertos: 2, acertosDePrimeira: 0, exercicios: 2, pratica: "ainda_nao" }), /e a prática ainda não saiu/);
  assert.match(textoParaRever({ acertos: 2, acertosDePrimeira: 2, exercicios: 2, pratica: "ainda_nao" }), /A prática ainda não saiu\?/);
  assert.match(textoParaRever({ acertos: 1, acertosDePrimeira: 1, exercicios: 2 }), /seguiu sem acertar 1 exercício/);
});

test("cada visita embaralha as opções do mesmo jeito para a mesma semente, sem perder nenhuma", () => {
  const lista = ["a", "b", "c", "d", "e"];
  assert.deepEqual(embaralharComSemente(lista, 42), embaralharComSemente(lista, 42));
  assert.deepEqual([...embaralharComSemente(lista, 7)].sort(), lista);
  const sementes = Array.from({ length: 20 }, (_, semente) => embaralharComSemente(lista, semente)[0]);
  assert.ok(new Set(sementes).size > 1, "a primeira posição muda entre as visitas");
  const escolha = { tipo: "multipla_escolha", enunciado: "E", opcoes: lista.map((id) => ({ id, texto: id.toUpperCase() })) };
  const embaralhado = embaralharExercicio(escolha, 3);
  assert.deepEqual(embaralhado.opcoes.map(({ id }) => id).sort(), lista);
  assert.equal(escolha.opcoes[0].id, "a", "o exercício original não muda");
});

test("ordenar: o retorno aponta a primeira posição errada da resposta da pessoa", () => {
  const checkin = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos.flatMap(({ licoes }) => licoes)
    .find(({ titulo }) => titulo === "No hotel: fazer o check-in").exercicio;
  assert.match(avaliarResposta(checkin, "oi,passaporte,reserva,chave").observacao, /2ª posição: o que vem logo depois de “Good evening!”/);
  assert.match(avaliarResposta(checkin, "chave,oi,reserva,passaporte").observacao, /Confira o começo/);
  assert.equal(avaliarResposta(checkin, "oi,reserva,passaporte,chave").observacao, undefined);
});

test("resposta aberta: a armadilha da resposta (“I want”) vira um aviso específico", () => {
  const pedido = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos.flatMap(({ licoes }) => licoes)
    .find(({ titulo }) => titulo === "Pedir comida no restaurante").exercicio;
  assert.match(avaliarResposta(pedido, "I want a coffee and a cheese bread please").observacao, /“I want” \(eu quero\) soa brusco/);
  assert.match(avaliarResposta(pedido, "Give me a coffee please, thank you").observacao, /“Give me”/);
  assert.equal(avaliarResposta(pedido, "I'd like a coffee and a cheese bread, please").observacao, undefined, "“I'd like” não cai no “I like”");
});

test("inglês tem pronúncia escrita nas frases e o violão toca o Mi para afinar", () => {
  const ingles = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos.flatMap(({ licoes }) => licoes);
  for (const licao of ingles) for (const fala of licao.falas ?? []) assert.ok(fala.pronuncia, `“${fala.texto}” tem pronúncia`);
  const violao = DEMOS.find(({ chave }) => chave === "violao").plano.fluxos[0].licoes[0];
  assert.deepEqual(violao.pratica.som.casas, [0, -1, -1, -1, -1, -1], "só a 6ª corda, solta");
  assert.ok(conteudoValido({ ...violao, pratica: { ...violao.pratica, som: { rotulo: "x", casas: [-1, -1, -1, -1, -1, -1] } } }) === false,
    "um som sem nenhuma corda não vale");
});

test("lacuna: o nome popular (“chave”) ganha a sua dica, sem virar acerto", () => {
  const lacuna = DEMOS.find(({ chave }) => chave === "violao").plano.fluxos[0].licoes[0].extras[0];
  const chave = avaliarResposta(lacuna, "Chave");
  assert.equal(chave.correta, false);
  assert.match(chave.observacao, /Muita gente chama essa peça assim/);
  assert.equal(avaliarResposta(lacuna, "tarraxa").observacao, undefined);
  assert.equal(avaliarResposta(lacuna, "corda").observacao, undefined, "outra resposta errada não ganha a dica do apelido");
});

test("“Explique com suas palavras”: o inglês sem o verbo (“I here”) vira o “O que revisar”", () => {
  const licao = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos[0].licoes[0];
  assert.match(armadilhaNoTexto(licao, "Na imigração eu digo I here on vacation e I from Brazil"), /o verbo não some/);
  assert.equal(armadilhaNoTexto(licao, "Na imigração eu digo I'm here on vacation"), null, "com “I'm”, está certo");
  assert.equal(armadilhaNoTexto(licao, "Eu digo I am from Brazil"), null);
  // A palavra que a escuta usa (“purpose”) agora está nas frases da lição.
  assert.ok(licao.falas.some(({ texto }) => /purpose/.test(texto)));
});

test("inglês para viagem tem a lição do aeroporto, e o compasso do violão é o desta batida", () => {
  const ingles = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos.flatMap(({ licoes }) => licoes);
  const aeroporto = ingles.find(({ titulo }) => /aeroporto/i.test(titulo));
  assert.ok(aeroporto, "uma lição de aeroporto (check-in e embarque)");
  assert.ok(aeroporto.falas.some(({ texto }) => /boarding pass/i.test(texto)));
  const ritmo = DEMOS.find(({ chave }) => chave === "violao").plano.fluxos.flatMap(({ licoes }) => licoes)
    .find(({ titulo }) => /Ritmo/.test(titulo));
  assert.match(ritmo.extras[0].trecho, /Nesta batida/, "nem todo compasso tem 4 tempos");
});

test("rodada 11: pronúncia em toda frase de inglês, pares e ordem como o servidor manda, grafia na aberta", () => {
  const ingles = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos.flatMap(({ licoes }) => licoes);
  for (const licao of ingles) {
    for (const fala of [...(licao.falas ?? []), ...[licao.exercicio, ...(licao.extras ?? [])].flatMap(({ fala }) => (fala ? [fala] : []))]) {
      assert.ok(fala.pronuncia, `“${fala.texto}” tem pronúncia escrita`);
    }
  }
  const itens = [{ id: "a", texto: "A" }, { id: "b", texto: "B" }, { id: "c", texto: "C" }];
  const associar = { tipo: "associar", enunciado: "L", esquerda: itens, direita: [...itens].reverse() };
  assert.deepEqual(embaralharExercicio(associar, 5).direita, associar.direita, "a ordem do servidor nunca é a resposta: o cliente não mexe");
  const ordenar = { tipo: "ordenar", enunciado: "O", itens };
  assert.deepEqual(embaralharExercicio(ordenar, 5).itens, itens);
  const pedido = ingles.find(({ titulo }) => titulo === "Pedir comida no restaurante").exercicio;
  const comDeslize = avaliarResposta(pedido, "I would like a coffe and a cheese bread, please");
  assert.equal(comDeslize.correta, true);
  assert.match(comDeslize.observacao, /confira a grafia de “coffee”/);
});

test("rodada 12: lições de inglês com três exercícios, menos “ouça e escolha” e números mais leves", () => {
  const ingles = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos.flatMap(({ licoes }) => licoes);
  for (const licao of ingles) assert.equal(1 + (licao.extras?.length ?? 0), 3, `${licao.titulo} tem três exercícios`);
  const exercicios = ingles.flatMap((licao) => [licao.exercicio, ...(licao.extras ?? [])]);
  const escutas = exercicios.filter(({ tipo, fala }) => tipo === "multipla_escolha" && fala).length;
  assert.ok(escutas / exercicios.length < 0.4, `${escutas} de ${exercicios.length} exercícios são “ouça e escolha”`);
  const producao = exercicios.filter(({ tipo }) => ["lacuna", "ordenar", "aberta"].includes(tipo)).length;
  assert.ok(producao / exercicios.length >= 0.45, `${producao} de ${exercicios.length} pedem para produzir a resposta`);
  const numeros = ingles.find(({ titulo }) => titulo === "Números e preços");
  assert.ok((numeros.conceito.match(/“/g) ?? []).length <= 4, "a explicação dos números não vira uma fila de ícones de som");
  assert.equal(numeros.falas[0].traducao, "1, 2, 3, 4, 5, 6, 7, 8, 9, 10.", "os algarismos ao lado das palavras");
  // A ideia contida em outra não conta duas vezes no “Explique”.
  assert.ok(!termosDaLicao(ingles[0]).includes("from"));
});

test("rodada 13: “Explique” sem falso alarme, armadilhas de iniciante, “repeat it” e mais prática no inglês", () => {
  const ingles = DEMOS.find(({ chave }) => chave === "ingles").plano.fluxos.flatMap(({ licoes }) => licoes);
  const [apresentacao, aeroporto] = ingles;
  // A armadilha da lacuna (“de”, “do”) vale para a resposta inteira: num texto em português, não dispara.
  assert.equal(armadilhaNoTexto(apresentacao, "Eu digo I'm from Brazil, que quer dizer que sou do Brasil."), null);
  assert.match(armadilhaNoTexto(apresentacao, "Na imigração eu digo I am here for vacation."), /on vacation/);
  assert.match(armadilhaNoTexto(aeroporto, "No balcão eu falo I flying to Miami."), /o verbo não some/);
  assert.equal(armadilhaNoTexto(aeroporto, "No balcão eu falo I'm flying to Miami."), null);
  // Lacuna no fim da frase: “repeat it” é inglês certo; com outras palavras, o retorno diz que a certa está lá.
  const repetir = ingles.at(-1).extras.find(({ tipo }) => tipo === "lacuna");
  assert.deepEqual(avaliarResposta(repetir, "repeat it"), { correta: true, feedback: repetir.feedbackCorreto, observacao: "Certo! Na lacuna, basta escrever o que falta." });
  assert.equal(avaliarResposta(repetir, "repeat")?.correta, true);
  const misturada = avaliarResposta(repetir, "you repeat to me");
  assert.equal(misturada.correta, false);
  assert.match(misturada.observacao, /a palavra certa está na sua resposta/);
  // No meio da frase, o complemento não vale (“Excuse me, ___ is the museum?”: “where it” não é a resposta).
  const onde = ingles[2].exercicio;
  assert.equal(avaliarResposta(onde, "where it")?.correta, false);
  // Mais prática de verdade e a revisão retoma imigração e hotel numa resposta aberta.
  assert.ok(ingles.filter(({ pratica }) => pratica).length >= 5, "prática com cronômetro na maioria das lições");
  const revisao = ingles.at(-1);
  assert.equal(revisao.exercicio.tipo, "aberta");
  assert.ok(avaliarResposta(revisao.exercicio, "I'm from Brazil. I'm here on vacation. I have a reservation.").correta);
  for (const licao of ingles) assert.ok(licao.armadilhas?.length, `${licao.titulo} tem armadilhas para o “Explique”`);
});
