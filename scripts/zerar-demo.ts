import { banco } from "../src/servidor/banco/cliente";
import { zerarContaDemo } from "../src/servidor/estudio/demo-zerar";

async function executar() {
  const resultado = await zerarContaDemo();
  if (!resultado.encontrada) {
    console.log("Conta de demonstração não encontrada; nada removido.");
    return;
  }
  console.log(
    `Conta de demonstração zerada (${resultado.planosRemovidos} trilhas, ${resultado.materiaisRemovidos} materiais, ${resultado.apoiosRemovidos} apoios, ${resultado.sessoesRemovidas} sessões removidas).`,
  );
}

executar()
  .catch(() => {
    console.error("Não foi possível zerar a conta de demonstração.");
    process.exitCode = 1;
  })
  .finally(() => banco.$disconnect());
