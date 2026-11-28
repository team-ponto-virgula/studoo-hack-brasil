#!/usr/bin/env node
/*
 * Teste com a IA REAL das lições de matemática (spec 15, marco 5): roda exatamente o que o servidor roda, sem banco, e mostra, por
 * lição, o que a IA devolveu e o que o validador aceitou ou recusou (com o motivo), o tempo e os tokens de cada pedido e a conferência
 * das contas (contas conferidas e puladas na resolução).
 *
 * Uso:
 *   IA=openai   OPENAI_API_KEY=...   node --import tsx scripts/qa/matematica.mjs --trilha "Geometria analítica" [opções]
 *
 * Modos (um ou os dois):
 *   --material <arquivo.json>  Foto, PDF ou caderno: o arquivo tem `paginas: [{ numero, texto }]` (a leitura que o app guarda, como
 *                              `leitura-material.json`). Roda `gerarLicoesDoMaterial` (o pedido das lições e, em material de
 *                              matemática, um pedido de figuras por lição) e `conteudosDasLicoes`, a mesma proposta do servidor.
 *   --trilha "<assunto>"       Trilha de texto: gera o conteúdo de cada lição como no aceite (`gerarConteudo`), com o assunto como
 *                              objetivo e título da trilha. As lições são as de `--licoes` ("Título 1;Título 2") ou três padrão.
 * Opções:
 *   --objetivo "<texto>"       Objetivo da pessoa no modo material (padrão: "Estudar este material").
 *   --nome "<texto>"           Nome do material (padrão: o do arquivo).
 *   --png <pasta>              Desenha em PNG o que a IA mandou e o validador aceitou (enunciado e retorno de cada figura).
 *   --bruto <pasta>            Grava, por lição, o que a IA devolveu ANTES do validador (`...-bruto.txt`, como veio, e `...-bruto.json`,
 *                              quando lê como JSON) e o que o validador aceitou (`...-aceito.json`, com a citação e os motivos de
 *                              recusa), para ver por que uma figura ou uma resolução foi recusada. Só saída do modelo: sem chave e
 *                              sem dado de conta.
 *   --orcamento <segundos>     Orçamento da proposta do material (padrão: 85).
 *
 * A chave vem SÓ do ambiente do servidor (`OPENAI_API_KEY`) e nunca é impressa; nenhum pedido leva dado de conta.
 * O que sai na tela são títulos, contagens, tempos, tokens e os motivos de recusa do validador (que podem citar uma fórmula da IA).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

// Os erros HTTP do servidor carregam o cliente do banco ao importar; nada aqui toca no banco, então um endereço fictício basta.
process.env.DATABASE_URL ??= "postgresql://qa:qa@127.0.0.1:5432/qa";
process.env.STUDOO_CHAVE_ASSINATURA ??= "0123456789abcdef".repeat(4);

function lerArgumentos(argv) {
  const opcoes = {};
  for (let i = 0; i < argv.length; i += 1) {
    const argumento = argv[i];
    if (!argumento.startsWith("--")) continue;
    const proximo = argv[i + 1];
    opcoes[argumento.slice(2)] = proximo === undefined || proximo.startsWith("--") ? true : proximo;
    if (opcoes[argumento.slice(2)] !== true) i += 1;
  }
  return opcoes;
}

const opcoes = lerArgumentos(process.argv.slice(2));
const ia = (process.env.IA ?? "").trim();
const chave = process.env.OPENAI_API_KEY;
if (!opcoes.material && !opcoes.trilha) {
  console.error("Uso: IA=openai (e a chave no ambiente) node --import tsx scripts/qa/matematica.mjs --material <arquivo.json> | --trilha \"assunto\" [--png pasta]");
  process.exit(2);
}
if (ia !== "openai" || !chave?.trim()) {
  console.error(`Faltam IA=openai e OPENAI_API_KEY no ambiente. Nada foi chamado.`);
  process.exit(2);
}

/* ----- Tempo e tokens de cada pedido ao provedor: uma cópia da resposta, sem tocar no que o servidor lê ----- */

const chamadas = [];
const fetchOriginal = globalThis.fetch;
function rotuloDoPedido(corpo) {
  try {
    const dados = JSON.parse(corpo);
    const nome = dados.text?.format?.name;
    const sistema = String(dados.instructions ?? dados.input?.[0]?.content ?? dados.messages?.[0]?.content ?? "");
    const usuario = dados.input?.[0]?.content?.[0]?.text ?? dados.messages?.[1]?.content ?? "";
    let titulo = "";
    try { titulo = JSON.parse(typeof usuario === "string" ? usuario : "{}").licao?.titulo ?? ""; } catch { /* o pedido de lição de trilha não é json */ }
    const tipo = nome ?? (sistema.includes("UMA lição de matemática") ? "figuras_licao" : sistema.includes("Crie de 3 a 5 lições") ? "trilha_material" : "licao_studoo");
    return { tipo, titulo };
  } catch {
    return { tipo: "pedido", titulo: "" };
  }
}
globalThis.fetch = async (entrada, init) => {
  const url = new URL(String(entrada instanceof Request ? entrada.url : entrada));
  const inicio = performance.now();
  const resposta = await fetchOriginal(entrada, init);
  if (!/\/(?:responses|chat\/completions)$/.test(url.pathname)) return resposta;
  const registro = { ...rotuloDoPedido(typeof init?.body === "string" ? init.body : ""), status: resposta.status, ms: 0, entrada: 0, saida: 0, texto: "" };
  chamadas.push(registro);
  resposta.clone().json().then((corpo) => {
    registro.ms = performance.now() - inicio;
    registro.entrada = corpo?.usage?.input_tokens ?? corpo?.usage?.prompt_tokens ?? 0;
    registro.saida = corpo?.usage?.output_tokens ?? corpo?.usage?.completion_tokens ?? 0;
    registro.texto = corpo?.output_text ?? corpo?.output?.flatMap((item) => item.content ?? []).filter((parte) => parte.type === "output_text").map((parte) => parte.text).join("") ?? corpo?.choices?.[0]?.message?.content ?? "";
  }).catch(() => { registro.ms = performance.now() - inicio; });
  return resposta;
};
const esperarCopias = () => new Promise((resolver) => setTimeout(resolver, 300));

const segundos = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
const milhar = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const tokensDe = (lista) => ({ entrada: lista.reduce((s, c) => s + c.entrada, 0), saida: lista.reduce((s, c) => s + c.saida, 0) });
const linhaDeTokens = (lista) => {
  const { entrada, saida } = tokensDe(lista);
  return `${milhar(entrada + saida)} tokens (${milhar(entrada)} de entrada, ${milhar(saida)} de saída)`;
};

/* ----- O que a IA mandou e o validador aceitou ----- */

const contrato = await import("../../packages/contratos/src/aprendizado.ts");
const { desenharVisual, desenhoParaSvg, visualParaEnunciado, visualRevelado, descricaoDaFigura } = contrato;
const sharp = opcoes.png ? (await import("sharp")).default : null;
const pastaPng = opcoes.png === true ? resolve("qa-matematica-png") : opcoes.png ? resolve(String(opcoes.png)) : null;
if (pastaPng) mkdirSync(pastaPng, { recursive: true });
const pastaBruto = opcoes.bruto === true ? resolve("qa-matematica-bruto") : opcoes.bruto ? resolve(String(opcoes.bruto)) : null;
if (pastaBruto) mkdirSync(pastaBruto, { recursive: true });

/** O que a IA devolveu, como veio (`.txt`) e, quando lê como JSON (com as barras do LaTeX consertadas, como no servidor), bonito (`.json`). */
async function gravarBruto(nome, texto) {
  if (!pastaBruto || typeof texto !== "string" || !texto) return;
  writeFileSync(join(pastaBruto, `${nome}.txt`), texto);
  try {
    const { analisarJson } = await import("../../src/servidor/ia/comum.ts");
    writeFileSync(join(pastaBruto, `${nome}.json`), `${JSON.stringify(analisarJson(texto, true), null, 2)}\n`);
  } catch {
    // Não lê como JSON: fica só o texto como veio.
  }
}

/** O que o validador aceitou e os motivos do que recusou. */
function gravarAceito(nome, valor) {
  if (pastaBruto) writeFileSync(join(pastaBruto, `${nome}.json`), `${JSON.stringify(valor, null, 2)}\n`);
}

const aceitoDe = (conteudo, relato, citacao) => ({
  ...(citacao ? { citacao } : {}),
  visuais: conteudo.visuais ?? null,
  exercicios: [conteudo.exercicio, ...(conteudo.extras ?? [])].map((exercicio) => ({ tipo: exercicio.tipo, enunciado: exercicio.enunciado, visual: exercicio.visual ?? null })),
  resolucao: conteudo.resolucao ?? null,
  relato: relato ?? null,
});

async function desenhar(desenho, nome) {
  if (!sharp || !pastaPng) return;
  const svg = desenhoParaSvg(desenho, { fundo: "branco", larguraEmPixels: Math.round(desenho.largura * 3) });
  writeFileSync(join(pastaPng, `${nome}.png`), await sharp(Buffer.from(svg)).png().toBuffer());
}

async function desenharConteudo(conteudo, prefixo) {
  for (const [k, visual] of (conteudo.visuais ?? []).entries()) {
    if (visual.tipo !== "formula") await desenhar(desenharVisual(visual, { tipo: "enunciado" }), `${prefixo}-visual${k + 1}`);
  }
  for (const [k, exercicio] of [conteudo.exercicio, ...(conteudo.extras ?? [])].entries()) {
    if (!exercicio.visual) continue;
    await desenhar(desenharVisual(visualParaEnunciado(exercicio.visual), { tipo: "enunciado" }), `${prefixo}-exercicio${k + 1}-enunciado`);
    await desenhar(desenharVisual(visualRevelado(exercicio.visual), { tipo: "retorno" }), `${prefixo}-exercicio${k + 1}-retorno`);
  }
}

const resumo = { licoes: 0, visuais: [0, 0], figuras: [0, 0], resolucao: [0, 0], reparos: 0, novas: [0, 0], ms: 0, chamadas: [] };
const tiposDe = (visuais) => (visuais ?? []).map((visual) => visual.tipo).join(", ") || "nenhum";

function imprimirMatematica(conteudo, relato) {
  if (!relato) {
    console.log(`  matemática: a IA não mandou visuais, figura nem resolução (visuais: ${tiposDe(conteudo.visuais)})`);
    return { visuais: [0, 0], figuras: [0, 0], resolucao: [0, 0] };
  }
  const { visuais, figuras, resolucao } = relato;
  console.log(`  visuais: ${visuais.aceitos} de ${visuais.enviados} aceitos (${tiposDe(conteudo.visuais)})`);
  console.log(`  figura do exercício: ${figuras.enviadas === 0 ? "a IA não mandou" : `${figuras.aceitas} de ${figuras.enviadas} aceita${figuras.aceitas === 1 ? "" : "s"}`}`);
  if (!resolucao.enviada) console.log("  resolução (Resolva comigo): a IA não mandou");
  else if (resolucao.aceita) {
    console.log(`  resolução (Resolva comigo): ACEITA · ${conteudo.resolucao.passos.length} passos · contas conferidas ${resolucao.conferidas ?? 0}, puladas ${resolucao.puladas ?? 0}`);
  } else console.log("  resolução (Resolva comigo): RECUSADA (tudo ou nada: a lição fica com o exemplo em texto)");
  for (const reparo of relato.reparos ?? []) console.log(`  reparado: ${reparo}`);
  for (const motivo of relato.motivos) console.log(`  recusado → ${motivo}`);
  if (relato.novaTentativa) {
    const { motivo, aceita, motivoDaSegunda } = relato.novaTentativa;
    console.log(`  nova tentativa (uma só): disse à IA "${motivo}" → ${aceita ? "ACEITA" : `RECUSADA de novo${motivoDaSegunda ? `: ${motivoDaSegunda}` : " (sem resposta)"}`}`);
  }
  if (conteudo.exercicio.visual?.pontos?.some((ponto) => ponto.papel === "procurado")) {
    console.log(`  descrição depois do acerto: ${descricaoDaFigura(visualRevelado(conteudo.exercicio.visual))}`);
  }
  resumo.reparos += relato.reparos?.length ?? 0;
  if (relato.novaTentativa) {
    resumo.novas[1] += 1;
    if (relato.novaTentativa.aceita) resumo.novas[0] += 1;
  }
  return {
    visuais: [visuais.aceitos, visuais.enviados],
    figuras: [figuras.aceitas, figuras.enviadas],
    resolucao: [resolucao.aceita ? 1 : 0, resolucao.enviada ? 1 : 0],
  };
}

const somar = (alvo, parcial) => { alvo[0] += parcial[0]; alvo[1] += parcial[1]; };

/* ----- Modo material (foto, PDF, caderno) ----- */

async function rodarMaterial() {
  const caminho = resolve(String(opcoes.material));
  const arquivo = JSON.parse(readFileSync(caminho, "utf8"));
  const paginas = (arquivo.paginas ?? []).map((pagina) => ({ numero: pagina.numero, texto: String(pagina.texto ?? ""), ...(pagina.rotulo ? { rotulo: pagina.rotulo } : {}) }));
  const nome = String(opcoes.nome ?? basename(caminho));
  const objetivo = String(opcoes.objetivo ?? "Estudar este material");
  const { gerarLicoesDoMaterial, conteudosDasLicoes } = await import("../../src/servidor/estudio/licoes-do-material.ts");
  const { materialEhDeMatematica } = await import("../../src/servidor/ia/matematica.ts");
  console.log(`\n== Material: ${nome} (${arquivo.leitura ?? "leitura"}, ${paginas.length} página${paginas.length === 1 ? "" : "s"}, ${paginas.reduce((s, p) => s + p.texto.length, 0)} caracteres)`);
  console.log(`   É de matemática pela regra de palavras? ${materialEhDeMatematica(objetivo, nome, paginas) ? "sim" : "NÃO (as lições saem sem figuras)"}`);
  const antes = chamadas.length;
  const inicio = performance.now();
  let gerado;
  try {
    gerado = await gerarLicoesDoMaterial({ objetivo, nome, paginas }, { orcamentoMs: Number(opcoes.orcamento ?? 85) * 1000 });
  } catch (erro) {
    await esperarCopias();
    console.log(`   A proposta FALHOU: ${erro?.codigo ?? erro?.message ?? erro} (${segundos(performance.now() - inicio)})`);
    await gravarBruto("material-proposta-bruto", chamadas.slice(antes).find((chamada) => chamada.tipo === "trilha_material")?.texto);
    return;
  }
  await esperarCopias();
  const dele = chamadas.slice(antes);
  resumo.ms += performance.now() - inicio;
  resumo.chamadas.push(...dele);
  const base = dele.find((chamada) => chamada.tipo === "trilha_material");
  await gravarBruto("material-proposta-bruto", base?.texto);
  console.log(`   Pedido das lições: ${base ? `${segundos(base.ms)} · ${linhaDeTokens([base])}` : `${segundos(gerado.tempos.licoes)}`} · ${gerado.licoes.length} lições · "${gerado.titulo}"`);
  let conteudos;
  let relatos;
  let citacoes;
  try {
    ({ conteudos, relatos, citacoes } = conteudosDasLicoes({ licoes: gerado.licoes, figuras: gerado.figuras, paginas, materialId: "qa", nome, leitura: arquivo.leitura ?? "ocr", origem: "Material enviado · QA" }));
  } catch (erro) {
    console.log(`   O conteúdo FALHOU (${erro?.codigo ?? erro?.message}): uma lição citou uma página que não existe (ou sem texto para citar), e a proposta inteira seria recusada.`);
    for (const [i, licao] of gerado.licoes.entries()) {
      await gravarBruto(`material-licao${i + 1}-figuras-bruto`, dele.find((chamada) => chamada.tipo === "figuras_licao" && chamada.titulo === licao.titulo)?.texto);
    }
    return;
  }
  for (const [i, conteudo] of conteudos.entries()) {
    resumo.licoes += 1;
    const tempo = gerado.tempos.figuras[i];
    const figuras = dele.filter((chamada) => chamada.tipo === "figuras_licao" && chamada.titulo === gerado.licoes[i].titulo);
    const jeito = { literal: "citação literal", normalizada: "citação reescrita pela IA, trocada pelo literal da página", "sem-acento": "citação sem acento, trocada pelo literal", "melhor-janela": "citação parecida, trocada pela janela mais próxima da página", "pagina-inteira": "citação que não casou: a referência é o começo da página" }[citacoes[i]];
    console.log(`\nLição ${i + 1} · "${conteudo.titulo}" (página ${conteudo.referencias[0].pagina}, ${jeito})`);
    console.log(`  pergunta: ${conteudo.exercicio.enunciado}`);
    if (gerado.matematica) console.log(`  figuras e resolução: ${tempo === undefined ? "não pedidas (sem tempo)" : `${segundos(tempo)}${figuras.length ? ` · ${linhaDeTokens(figuras)}` : ""}${gerado.figuras[i] ? "" : " · SEM RESPOSTA (a lição fica como era)"}`}`);
    const contagens = imprimirMatematica(conteudo, relatos[i]);
    somar(resumo.visuais, contagens.visuais); somar(resumo.figuras, contagens.figuras); somar(resumo.resolucao, contagens.resolucao);
    await desenharConteudo(conteudo, `material-licao${i + 1}`);
    await gravarBruto(`material-licao${i + 1}-figuras-bruto`, figuras[0]?.texto);
    await gravarBruto(`material-licao${i + 1}-figuras-bruto-nova-tentativa`, figuras[1]?.texto);
    gravarAceito(`material-licao${i + 1}-aceito`, aceitoDe(conteudo, relatos[i], { como: citacoes[i], trecho: conteudo.referencias[0].trecho }));
  }
}

/* ----- Modo trilha (lições de texto, como no aceite) ----- */

async function rodarTrilha() {
  const assunto = String(opcoes.trilha);
  const titulos = String(opcoes.licoes ?? "Ponto médio de um segmento;Baricentro de um triângulo;Pontos colineares e o determinante").split(";").map((titulo) => titulo.trim()).filter(Boolean);
  const esqueleto = {
    gerador: "openai-v1",
    titulo: assunto,
    objetivo: assunto,
    origem: "IA da OpenAI (teste)",
    fluxos: [{ titulo: "Primeiros passos", licoes: titulos.map((titulo) => ({ titulo })) }],
  };
  const { configuracaoOpenAi, criarGeradorOpenAi, MODELO_PADRAO } = await import("../../src/servidor/ia/openai.ts");
  const { exigirTrilhaSegura } = await import("../../src/servidor/ia/seguranca-trilhas.ts");
  await exigirTrilhaSegura({ objetivo: assunto, estrutura: esqueleto.fluxos });
  const { analisarJson, normalizarLicao } = await import("../../src/servidor/ia/comum.ts");
  const { licaoEhDeMatematica } = await import("../../src/servidor/ia/matematica.ts");
  const config = configuracaoOpenAi();
  if (!config) { console.error("A configuração do provedor não fechou (base e chave)."); process.exit(2); }
  const gerador = criarGeradorOpenAi(config);
  console.log(`\n== Trilha: "${assunto}" · ${titulos.length} lições · IA ${ia} (${MODELO_PADRAO})`);
  for (const [i, titulo] of titulos.entries()) {
    console.log(`\nLição ${i + 1} · "${titulo}" · de matemática pela regra de palavras? ${licaoEhDeMatematica(esqueleto, 0, i) ? "sim" : "NÃO"}`);
    const antes = chamadas.length;
    const inicio = performance.now();
    let conteudo;
    try {
      conteudo = await gerador.gerarConteudo(esqueleto, 0, i, new AbortController().signal);
    } catch (erro) {
      await esperarCopias();
      console.log(`  FALHOU: ${erro?.codigo ?? erro?.message ?? erro} (${segundos(performance.now() - inicio)})`);
      for (const [k, chamada] of chamadas.slice(antes).entries()) await gravarBruto(`trilha-licao${i + 1}-${k === 0 ? "bruto" : `bruto-tentativa${k + 1}`}`, chamada.texto);
      continue;
    }
    await esperarCopias();
    const dele = chamadas.slice(antes);
    resumo.ms += performance.now() - inicio;
    resumo.chamadas.push(...dele);
    resumo.licoes += 1;
    console.log(`  ${dele.length} pedido${dele.length === 1 ? "" : "s"} ao provedor: ${segundos(dele.reduce((s, c) => s + c.ms, 0))} · ${linhaDeTokens(dele)}${dele.length > 1 ? " (houve segunda tentativa)" : ""}`);
    // O que cada resposta da IA tinha de matemática e o que o validador fez com ela (com os motivos): a segunda só existe quando a resolução
    // da primeira foi recusada (a única nova tentativa), e a lição entregue é a que o servidor escolheu.
    let relato;
    for (const [k, chamada] of dele.entries()) {
      if (!chamada.texto) continue;
      let lida;
      try { lida = normalizarLicao(analisarJson(chamada.texto, true), "QA"); } catch { continue; }
      const entregue = lida.conteudo && JSON.stringify({ ...lida.conteudo, origem: conteudo.origem }) === JSON.stringify(conteudo);
      if (dele.length > 1) console.log(`  --- tentativa ${k + 1}${entregue ? " (a lição entregue)" : ""}`);
      if (entregue || (!relato && k === 0)) relato = lida.matematica;
      if (dele.length > 1) imprimirMatematica(lida.conteudo ?? conteudo, lida.matematica);
    }
    const contagens = dele.length > 1 ? { visuais: [0, 0], figuras: [0, 0], resolucao: [0, 0] } : imprimirMatematica(conteudo, relato);
    if (dele.length > 1) {
      const entregue = relato;
      somar(resumo.visuais, [entregue?.visuais.aceitos ?? 0, entregue?.visuais.enviados ?? 0]);
      somar(resumo.figuras, [entregue?.figuras.aceitas ?? 0, entregue?.figuras.enviadas ?? 0]);
      somar(resumo.resolucao, [entregue?.resolucao.aceita ? 1 : 0, entregue?.resolucao.enviada ? 1 : 0]);
    }
    somar(resumo.visuais, contagens.visuais); somar(resumo.figuras, contagens.figuras); somar(resumo.resolucao, contagens.resolucao);
    await desenharConteudo(conteudo, `trilha-licao${i + 1}`);
    for (const [k, chamada] of dele.entries()) await gravarBruto(`trilha-licao${i + 1}-${k === 0 ? "bruto" : `bruto-tentativa${k + 1}`}`, chamada.texto);
    gravarAceito(`trilha-licao${i + 1}-aceito`, aceitoDe(conteudo, relato));
  }
}

if (opcoes.material) await rodarMaterial();
if (opcoes.trilha) await rodarTrilha();

const { entrada, saida } = tokensDe(resumo.chamadas);
console.log(`\n== Resumo: ${resumo.licoes} lições · visuais ${resumo.visuais[0]}/${resumo.visuais[1]} · figuras de exercício ${resumo.figuras[0]}/${resumo.figuras[1]} · resoluções ${resumo.resolucao[0]}/${resumo.resolucao[1]} · ${resumo.reparos} reparos de realce · novas tentativas aceitas ${resumo.novas[0]}/${resumo.novas[1]} · ${resumo.chamadas.length} pedidos · ${segundos(resumo.ms)} · ${milhar(entrada + saida)} tokens (${milhar(entrada)} de entrada, ${milhar(saida)} de saída)`);
if (pastaPng) console.log(`   PNG em ${pastaPng}`);
globalThis.fetch = fetchOriginal;
