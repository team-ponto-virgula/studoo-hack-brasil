import { banco } from "../src/servidor/banco/cliente";
import { zerarContaDemo } from "../src/servidor/estudio/demo-zerar";

async function executar() {
  const confirmar = process.argv.slice(2).includes("--confirmar");
  const resultado = await zerarContaDemo(process.env.STUDOO_EMAIL, { confirmar });
  if (!resultado.encontrada) {
    console.log(`Conta de demonstração (${resultado.email}) não encontrada; nada removido.`);
    return;
  }
  if (!resultado.confirmado) {
    console.log(
      `Simulação para ${resultado.email} (nada foi removido): ${resultado.planosRemovidos} trilhas, ${resultado.materiaisRemovidos} materiais, ${resultado.apoiosRemovidos} apoios, ${resultado.sessoesRemovidas} sessões, ${resultado.cotasRemovidas} cotas de geração.`,
    );
    console.log("Para apagar de verdade, rode: npm run demo:zerar -- --confirmar");
    return;
  }
  console.log(
    `Conta de demonstração (${resultado.email}) zerada (${resultado.planosRemovidos} trilhas, ${resultado.materiaisRemovidos} materiais, ${resultado.apoiosRemovidos} apoios, ${resultado.sessoesRemovidas} sessões, ${resultado.cotasRemovidas} cotas de geração removidas).`,
  );
}

executar()
  .catch(() => {
    console.error("Não foi possível zerar a conta de demonstração.");
    process.exitCode = 1;
  })
  .finally(() => banco.$disconnect());
