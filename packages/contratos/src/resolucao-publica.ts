import { visualParaEnunciado } from "./visuais-validacao";
import type { EscolhaNoSuaVez, OpcaoDoSuaVez, PassoDaResolucao, PassoGuardado, Resolucao, ResolucaoGuardada, RespostaDoSuaVez, VisualFigura } from "./visuais";

/*
 * O "Sua vez" sem vazamento (spec 15, seção 4; parecer do Designer): o que o servidor guarda tem a resposta de tudo, mas o JSON
 * que vai ao cliente antes da escolha não pode trazê-la. O desenho mais simples que impede isso:
 * - a lição leva `resolucaoParaCliente`: os passos até o do "Sua vez", e esse passo sem `formula` nem `visual` (são a revelação),
 *   com as opções sem `correta` nem `porque`; nenhum passo depois dele; e nenhum visual com a posição do ponto procurado;
 * - a escolha vai a `POST /api/aprendizado/licoes/[id]/resolucao`, que responde com `responderSuaVez`: a correção e, no acerto ou
 *   na segunda escolha errada, a revelação e os passos que faltam. Errou a primeira vez, só volta o porquê da opção escolhida.
 * O cliente pode mentir sobre qual tentativa é: só adianta a ele mesmo, e o "Sua vez" não vale nota.
 */

function publicoDoPasso(passo: PassoGuardado): PassoDaResolucao {
  const { tentativa, visual, ...resto } = passo;
  return {
    ...resto,
    ...(visual ? { visual: visualParaEnunciado(visual) } : {}),
    ...(tentativa ? { tentativa: { pergunta: tentativa.pergunta, opcoes: tentativa.opcoes.map(opcaoPublica) } } : {}),
  };
}

function opcaoPublica(opcao: OpcaoDoSuaVez): OpcaoDoSuaVez {
  return { ...(opcao.texto !== undefined ? { texto: opcao.texto } : {}), ...(opcao.formula !== undefined ? { formula: opcao.formula } : {}) };
}

/** O passo completo, como vai depois do acerto: a posição do procurado e o `\resposta{}` incluídos. */
function completoDoPasso(passo: PassoGuardado): PassoDaResolucao {
  const { tentativa, ...resto } = passo;
  return { ...resto, ...(tentativa ? { tentativa: { pergunta: tentativa.pergunta, opcoes: tentativa.opcoes.map(opcaoPublica) } } : {}) };
}

function indiceDoSuaVez(resolucao: ResolucaoGuardada): number {
  return resolucao.passos.findIndex((passo) => passo.tentativa);
}

/** A resolução como a lição a entrega: até o "Sua vez", sem a resposta dele nem do que vem depois. */
export function resolucaoParaCliente(resolucao: ResolucaoGuardada): Resolucao {
  const corte = indiceDoSuaVez(resolucao);
  const ate = corte < 0 ? resolucao.passos.length : corte + 1;
  const passos = resolucao.passos.slice(0, ate).map((passo, posicao) => {
    if (posicao !== corte) return publicoDoPasso(passo);
    const { formula: _formula, visual: _visual, ...semRevelacao } = publicoDoPasso(passo);
    return semRevelacao;
  });
  return {
    problema: resolucao.problema,
    ...(resolucao.visual ? { visual: visualParaEnunciado(resolucao.visual) as VisualFigura } : {}),
    total: resolucao.passos.length,
    passos,
  };
}

/**
 * Corrige uma escolha do "Sua vez". `null` quando a escolha não existe (opção fora das três). No acerto e na segunda errada
 * responde também com o que o passo revela e com os passos que faltam.
 */
export function responderSuaVez(resolucao: ResolucaoGuardada, escolha: EscolhaNoSuaVez): RespostaDoSuaVez | null {
  const corte = indiceDoSuaVez(resolucao);
  const passo = resolucao.passos[corte];
  const opcoes = passo?.tentativa?.opcoes;
  if (!passo || !opcoes || !Number.isInteger(escolha.opcao)) return null;
  const escolhida = opcoes[escolha.opcao];
  if (!escolhida) return null;
  const acertou = escolhida.correta;
  const revela = acertou || escolha.tentativa === 2;
  const certa = opcoes.findIndex((opcao) => opcao.correta);
  return {
    correta: acertou,
    porque: escolhida.porque,
    ...(!acertou && revela ? { certa, porqueDaCerta: opcoes[certa].porque } : {}),
    ...(revela
      ? {
        depois: {
          ...(passo.formula ? { formula: passo.formula } : {}),
          ...(passo.visual ? { visual: passo.visual } : {}),
          passos: resolucao.passos.slice(corte + 1).map(completoDoPasso),
        },
      }
      : {}),
  };
}

/**
 * O exemplo em texto para quem não desenha (cliente sem `resolucao@1`: build 3, site antigo): os passos, com a fórmula em texto
 * linear, sem "Sua vez" e com a resposta, que ali é a demonstração do método. Cada linha cabe em `passos` (até 300 caracteres).
 */
export function passosEmTexto(resolucao: ResolucaoGuardada, linear: (formula: string) => string | null): string[] {
  return resolucao.passos.map((passo, posicao) => {
    const formula = passo.formula ? linear(passo.formula) : null;
    const tentativa = passo.tentativa?.opcoes.find((opcao) => opcao.correta);
    const resultado = formula ?? (tentativa?.formula ? linear(tentativa.formula) : tentativa?.texto ?? null);
    const linha = `${posicao + 1}. ${passo.nome}: ${passo.texto}${resultado ? ` ${resultado}` : ""}`;
    return linha.length <= 300 ? linha : `${linha.slice(0, 299)}…`;
  });
}
