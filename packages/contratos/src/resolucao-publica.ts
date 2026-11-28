import { textoSemFormulas } from "./formula-no-texto";
import { visualParaEnunciado } from "./visuais-validacao";
import { comDescricaoDaResposta } from "./visuais-descricao";
import type { EscolhaNoSuaVez, OpcaoDoSuaVez, PassoDaResolucao, PassoGuardado, Resolucao, ResolucaoGuardada, RespostaDoSuaVez, VisualFigura } from "./visuais";

/*
 * O "Sua vez" sem vazamento (spec 15, seção 4; parecer do Designer): o que o servidor guarda tem a resposta de tudo, mas o JSON
 * que vai ao cliente antes da escolha não pode trazê-la. O desenho mais simples que impede isso:
 * - a lição leva `resolucaoParaCliente`: os passos até o do "Sua vez", e esse passo sem `formula` nem `visual` (são a revelação),
 *   com as opções sem `correta` nem `porque`; nenhum passo depois dele; e nenhum visual com a posição do ponto procurado;
 * - a escolha vai a `POST /api/aprendizado/licoes/[id]/resolucao`, que responde com `responderSuaVez`: a correção e, no acerto ou
 *   na segunda escolha errada, a revelação e os passos que faltam. Errou a primeira vez, só volta o porquê da opção escolhida.
 * O cliente pode mentir sobre qual tentativa é: só adianta a ele mesmo, e o "Sua vez" não vale nota.
 *
 * A ordem das três opções: a IA escreve a certa primeiro (A em 70 de 71 passos dos dumps reais). O servidor guarda a ordem dela e embaralha
 * NA SAÍDA, com uma permutação por (conta, lição) que ele escolhe (`ordem[mostrada] = guardada`; os clientes não mudam e não sabem dela):
 * `resolucaoParaCliente` leva as opções já na ordem mostrada, e `responderSuaVez` recebe o índice MOSTRADO, desfaz a permutação para achar
 * a certa e devolve os índices (`certa`) na ordem mostrada. Sem `ordem`, vale a ordem guardada (testes, quem não embaralha).
 */

/** As seis ordens possíveis das três opções (`ordem[mostrada] = guardada`): o servidor sorteia uma por (conta, lição). */
export const ORDENS_DO_SUA_VEZ: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

/** A ordem serve a este passo: uma permutação das posições das opções dele? Qualquer outra coisa vale como "sem ordem". */
function ordemQueServe(ordem: readonly number[] | undefined, total: number): readonly number[] | undefined {
  if (!Array.isArray(ordem) || ordem.length !== total) return undefined;
  const vistos = new Set(ordem);
  return vistos.size === total && ordem.every((posicao) => Number.isInteger(posicao) && posicao >= 0 && posicao < total) ? ordem : undefined;
}

function publicoDoPasso(passo: PassoGuardado, ordem?: readonly number[]): PassoDaResolucao {
  const { tentativa, visual, ...resto } = passo;
  const certa = tentativa ? ordemQueServe(ordem, tentativa.opcoes.length) : undefined;
  return {
    ...resto,
    ...(visual ? { visual: visualParaEnunciado(visual) } : {}),
    ...(tentativa
      ? { tentativa: { pergunta: tentativa.pergunta, opcoes: (certa ? certa.map((guardada) => tentativa.opcoes[guardada]) : tentativa.opcoes).map(opcaoPublica) } }
      : {}),
  };
}

function opcaoPublica(opcao: OpcaoDoSuaVez): OpcaoDoSuaVez {
  return { ...(opcao.texto !== undefined ? { texto: opcao.texto } : {}), ...(opcao.formula !== undefined ? { formula: opcao.formula } : {}) };
}

/**
 * O passo completo, como vai depois do acerto: a posição do procurado e o `\resposta{}` incluídos. A figura que já mostra a resposta
 * leva a descrição montada dos dados (`comDescricaoDaResposta`), que é o que o leitor de tela anuncia.
 */
function completoDoPasso(passo: PassoGuardado): PassoDaResolucao {
  const { tentativa, visual, ...resto } = passo;
  return {
    ...resto,
    ...(visual ? { visual: comDescricaoDaResposta(visual) } : {}),
    ...(tentativa ? { tentativa: { pergunta: tentativa.pergunta, opcoes: tentativa.opcoes.map(opcaoPublica) } } : {}),
  };
}

function indiceDoSuaVez(resolucao: ResolucaoGuardada): number {
  return resolucao.passos.findIndex((passo) => passo.tentativa);
}

/**
 * A resolução como a lição a entrega: até o "Sua vez", sem a resposta dele nem do que vem depois. As opções do "Sua vez" vão na `ordem`
 * dada (`ordem[mostrada] = guardada`), a que o servidor escolheu para esta conta e esta lição.
 */
export function resolucaoParaCliente(resolucao: ResolucaoGuardada, ordem?: readonly number[]): Resolucao {
  const corte = indiceDoSuaVez(resolucao);
  const ate = corte < 0 ? resolucao.passos.length : corte + 1;
  const passos = resolucao.passos.slice(0, ate).map((passo, posicao) => {
    if (posicao !== corte) return publicoDoPasso(passo);
    const { formula: _formula, visual: _visual, ...semRevelacao } = publicoDoPasso(passo, ordem);
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
 * Corrige uma escolha do "Sua vez". `escolha.opcao` é o índice MOSTRADO (na `ordem` que a lição levou ao cliente): a permutação é desfeita
 * aqui para achar a opção guardada, e `certa` volta na ordem mostrada. `null` quando a escolha não existe (opção fora das três). No acerto
 * e na segunda errada responde também com o que o passo revela e com os passos que faltam.
 */
export function responderSuaVez(resolucao: ResolucaoGuardada, escolha: EscolhaNoSuaVez, ordem?: readonly number[]): RespostaDoSuaVez | null {
  const corte = indiceDoSuaVez(resolucao);
  const passo = resolucao.passos[corte];
  const opcoes = passo?.tentativa?.opcoes;
  if (!passo || !opcoes || !Number.isInteger(escolha.opcao)) return null;
  const permutacao = ordemQueServe(ordem, opcoes.length);
  const guardada = permutacao ? permutacao[escolha.opcao] : escolha.opcao;
  const escolhida = guardada === undefined ? undefined : opcoes[guardada];
  if (!escolhida) return null;
  const acertou = escolhida.correta;
  const revela = acertou || escolha.tentativa === 2;
  const certaGuardada = opcoes.findIndex((opcao) => opcao.correta);
  const certa = permutacao ? permutacao.indexOf(certaGuardada) : certaGuardada;
  return {
    correta: acertou,
    porque: escolhida.porque,
    ...(!acertou && revela ? { certa, porqueDaCerta: opcoes[certaGuardada].porque } : {}),
    ...(revela
      ? {
        depois: {
          ...(passo.formula ? { formula: passo.formula } : {}),
          ...(passo.visual ? { visual: comDescricaoDaResposta(passo.visual) } : {}),
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
    const linha = `${posicao + 1}. ${passo.nome}: ${textoSemFormulas(passo.texto)}${resultado ? ` ${resultado}` : ""}`;
    return linha.length <= 300 ? linha : `${linha.slice(0, 299)}…`;
  });
}
