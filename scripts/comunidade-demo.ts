// Conteúdo de demonstração da comunidade (spec 10, etapa C1). Só com STUDOO_COMUNIDADE_DEMO=1.
// Uso: npm run comunidade:demo (cria ou renova as datas) · npm run comunidade:demo:remover (apaga tudo)
// Roda no contêiner de produção como o db:seed: só banco, nada de IA nem serviço externo.
import { banco } from "../src/servidor/banco/cliente";
import { criarDemonstracao, removerDemonstracao } from "../src/servidor/compartilhar/demonstracao";

const acao = process.argv[2] ?? "criar";
try {
  if (acao === "remover") {
    const { perfis } = await removerDemonstracao();
    console.log(`Conteúdo de demonstração removido (${perfis} perfis).`);
  } else if (acao === "criar") {
    const { perfis, trilhas, temas } = await criarDemonstracao();
    console.log(`Conteúdo de demonstração pronto: ${perfis} perfis, ${trilhas} trilhas em ${temas} temas, datas renovadas.`);
  } else {
    throw new Error("Use: criar ou remover.");
  }
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : "Falha no conteúdo de demonstração.");
  process.exitCode = 1;
} finally {
  await banco.$disconnect();
}
