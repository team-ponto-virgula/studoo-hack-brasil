import { AUTOAVALIACOES, type AutoAvaliacao, type ResumoConclusao } from "@studoo/contratos";
import { FalhaApi, responder, rotaPrivada } from "@/servidor/acesso/http";
import { lerObjeto } from "@/servidor/aprendizado/http";
import { concluirLicao } from "@/servidor/aprendizado/servico";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    const { comprovante, pratica, resumo } = await lerObjeto(request);
    // `pratica`: como foi a prática no mundo real, quando a lição tem uma. `resumo`: tempo e exercícios de primeira.
    if (typeof comprovante !== "string" || (pratica !== undefined && !AUTOAVALIACOES.includes(pratica as AutoAvaliacao)) ||
        (resumo !== undefined && !resumoValido(resumo))) {
      throw new FalhaApi("invalido");
    }
    return responder(await concluirLicao(usuarioId, id, comprovante, pratica as AutoAvaliacao | undefined, resumo as ResumoConclusao | undefined));
  });
}

const inteiroEntre = (valor: unknown, minimo: number, maximo: number): valor is number =>
  Number.isInteger(valor) && (valor as number) >= minimo && (valor as number) <= maximo;

/** Até um dia de lição e de um a três exercícios, com os de primeira dentro desse número. */
function resumoValido(valor: unknown): valor is ResumoConclusao {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return false;
  const { segundos, acertosDePrimeira, exercicios, ...resto } = valor as Record<string, unknown>;
  return Object.keys(resto).length === 0 && inteiroEntre(segundos, 1, 86_400) && inteiroEntre(exercicios, 1, 3) &&
    inteiroEntre(acertosDePrimeira, 0, exercicios as number);
}
