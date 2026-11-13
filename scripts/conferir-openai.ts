/*
 * Confere a IA da OpenAI de verdade, com a chave do .env.local: monta a estrutura de uma trilha por streaming e escreve
 * a primeira lição, pelo mesmo adaptador do servidor e com as mesmas validações. Não grava nada no banco.
 * Uso: npm run ia:conferir -- "objetivo de estudo" (sem objetivo, usa um exemplo).
 */
import { conteudoValido, esqueletoValido, type EsqueletoPlano } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { configuracaoOpenAi, criarGeradorOpenAi } from "@/servidor/ia/openai";

const objetivo = process.argv[2]?.trim() || "Frações para a prova do 6º ano";
const config = configuracaoOpenAi();
if (!config) {
  console.error("Defina OPENAI_API_KEY no .env.local (veja docs/RODAR-LOCALMENTE.md#ia-da-openai).");
  process.exit(1);
}

const inicio = Date.now();
const tempo = () => `${((Date.now() - inicio) / 1000).toFixed(1).padStart(5)} s`;

async function conferir() {
  console.log(`Modelo: ${config!.modelo} · ${new URL(config!.base).host}`);
  console.log(`Objetivo: ${objetivo}\n`);
  const gerador = criarGeradorOpenAi(config!);
  const sinal = new AbortController().signal;

  const esqueleto: EsqueletoPlano = { gerador: "", titulo: "", objetivo, origem: "", fluxos: [] };
  const estrutura = gerador.gerarEstrutura(objetivo, sinal, { aoVivo: true });
  while (true) {
    const passo = await estrutura.next();
    if (passo.done) {
      if (!passo.value) throw new Error("a estrutura terminou sem o fim esperado");
      esqueleto.gerador = passo.value.gerador;
      esqueleto.origem = passo.value.origem;
      break;
    }
    const evento = passo.value;
    if (evento.tipo === "plano") {
      esqueleto.titulo = evento.titulo;
      esqueleto.objetivo = evento.objetivo;
      console.log(`${tempo()}  Trilha: ${evento.titulo}`);
    } else if (evento.tipo === "fluxo") {
      esqueleto.fluxos.push({ titulo: evento.titulo, licoes: [] });
      console.log(`${tempo()}    Trecho ${evento.fluxo + 1}: ${evento.titulo}`);
    } else {
      esqueleto.fluxos[evento.fluxo].licoes.push({ titulo: evento.titulo });
      console.log(`${tempo()}      Lição: ${evento.titulo}`);
    }
  }
  if (!esqueletoValido(esqueleto)) throw new Error("a trilha veio fora do formato do Studoo");
  const total = esqueleto.fluxos.reduce((soma, fluxo) => soma + fluxo.licoes.length, 0);
  console.log(`\n${tempo()}  Trilha pronta: ${esqueleto.fluxos.length} trechos, ${total} lições.\n`);

  const conteudo = await gerador.gerarConteudo(esqueleto, 0, 0, sinal);
  if (!conteudoValido(conteudo)) throw new Error("a lição veio fora do formato do Studoo");
  const { exercicio } = conteudo;
  console.log(`${tempo()}  Primeira lição escrita: ${esqueleto.fluxos[0].licoes[0].titulo}`);
  console.log(`         Objetivo: ${conteudo.objetivo}`);
  console.log(`         Exercício (${exercicio.tipo === "multipla_escolha" ? `múltipla escolha, ${exercicio.opcoes.length} opções` : "lacuna"}): ${exercicio.enunciado}`);
  console.log("\nTudo certo: a OpenAI respondeu no formato do Studoo.");
}

conferir().catch((erro: unknown) => {
  const motivo = erro instanceof FalhaApi ? `${erro.codigo} (o status da OpenAI aparece na linha "ia-openai" acima)` : String(erro);
  console.error(`\nFalhou: ${motivo}`);
  process.exit(1);
});
