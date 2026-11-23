import type { ConteudoLicao, EsqueletoPlano, PlanoInterno } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import type { EventoEstrutura, GeradorTrilha, MetaPlano } from "./gerador";
import { conteudoGenerico, planoGenerico } from "./falsa-generica";
import { demoDoObjetivo, demoPelaChave } from "./demos";

/** As lições das trilhas prontas têm objetivo: ele vira o resumo da prévia (o que a lição ensina). */
type EstruturaDoPlano = { titulo: string; objetivo: string; fluxos: { titulo: string; licoes: { titulo: string; objetivo?: string }[] }[] };

const GERADOR_SQL = "falsa-sql-v1";
const GERADOR_GENERICO = "falsa-generica-v1";
/** As demos com assunto (violão, inglês, culinária, história) usam `falsa-<chave>-v1`. */
const geradorDaDemo = (chave: string) => `falsa-${chave}-v1`;
const chaveDoGerador = (gerador: string) => /^falsa-([a-z]+)-v1$/.exec(gerador)?.[1];
const PAUSA_PADRAO_MS = 450;

const origem = "Conhecimento geral de SQL";

const planoSql: PlanoInterno = {
  titulo: "SQL para a prova",
  objetivo: "Praticar filtros e junções em consultas.",
  origem,
  // Sequência única de aprendizado (spec 03, "Ordem da trilha"): os trechos só posicionam os marcos e não são assuntos.
  fluxos: [
    {
      titulo: "Primeiros passos",
      licoes: [
        {
          titulo: "Filtrar com WHERE incluindo o valor no limite",
          objetivo: "Filtrar linhas com WHERE incluindo o valor no limite.",
          conceito: "WHERE seleciona as linhas que satisfazem a condição. Use <= para incluir valores até o limite e >= para valores a partir dele: nos dois casos, o próprio limite entra no resultado.",
          exemplo: "Com produtos que custam 15, 20 e 25, o filtro WHERE preco <= 20 seleciona os de 15 e 20. O produto de 20 entra porque o operador inclui a igualdade.",
          origem,
          exercicio: {
            tipo: "lacuna",
            enunciado: "Complete a consulta com um operador de comparação para listar alunos com nota de pelo menos 7.",
            contexto: "Na tabela alunos, Ana tem nota 6, Bia tem nota 7 e Caio tem nota 9.",
            trecho: "SELECT nome FROM alunos WHERE nota ___ 7;",
            trechoTipo: "codigo",
            gabarito: [">="],
            feedbackCorreto: ">= inclui notas iguais ou maiores que 7. Bia e Caio aparecem no resultado.",
            feedbackIncorreto: "Bia tem nota 7 e precisa aparecer no resultado, junto com Caio. O operador tem de aceitar a nota igual a 7, e não só as notas acima dela.",
          },
        },
        {
          titulo: "Relacionar tabelas com INNER JOIN",
          objetivo: "Encontrar correspondências entre duas tabelas por uma chave.",
          conceito: "INNER JOIN combina linhas de duas tabelas quando a condição em ON é satisfeita. Cada par correspondente gera uma linha no resultado.",
          exemplo: "Se o pedido 50 tem cliente_id 3 e a cliente Joana tem id 3, ON clientes.id = pedidos.cliente_id liga Joana ao pedido 50.",
          origem,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "Qual nome aparece no resultado?",
            contexto: "A tabela alunos tem Ana com id 1 e Bia com id 2. A tabela matriculas tem uma matrícula com aluno_id 2.",
            trecho: "SELECT alunos.nome FROM alunos INNER JOIN matriculas ON alunos.id = matriculas.aluno_id;",
            trechoTipo: "codigo",
            opcoes: [
              { id: "ana", texto: "Apenas Ana" },
              { id: "bia", texto: "Apenas Bia" },
              { id: "ambas", texto: "Ana e Bia" },
            ],
            gabarito: ["bia"],
            feedbackCorreto: "O id 2 de Bia corresponde ao aluno_id 2 da matrícula. O INNER JOIN produz essa correspondência.",
            feedbackIncorreto: "Compare alunos.id com matriculas.aluno_id. O único par é o de id 2, então apenas Bia aparece.",
          },
        },
      ],
    },
    {
      titulo: "Praticando",
      licoes: [
        {
          titulo: "Combinar condições com AND",
          objetivo: "Selecionar as linhas que satisfazem duas condições ao mesmo tempo.",
          conceito: "AND combina dois testes no WHERE. Uma linha entra no resultado quando os dois testes são verdadeiros.",
          exemplo: "Com WHERE preco <= 20 AND estoque > 0, um caderno de preço 18 e estoque 2 entra. Uma caneta de preço 10 e estoque 0 fica de fora.",
          origem,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "Qual produto passa pelos dois filtros da consulta?",
            trecho: "SELECT produto FROM itens WHERE preco < 30 AND estoque >= 2;",
            trechoTipo: "codigo",
            opcoes: [
              { id: "caderno", texto: "Caderno, preço 24 e estoque 2" },
              { id: "lapis", texto: "Lápis, preço 5 e estoque 1" },
              { id: "estojo", texto: "Estojo, preço 30 e estoque 5" },
            ],
            gabarito: ["caderno"],
            feedbackCorreto: "O caderno custa menos que 30 e tem pelo menos 2 unidades em estoque. As duas condições são verdadeiras.",
            feedbackIncorreto: "AND exige as duas condições. O lápis tem estoque abaixo de 2, e o estojo custa exatamente 30. Apenas o caderno passa pelos dois filtros.",
          },
        },
        {
          titulo: "Revisão: filtro e junção na mesma consulta",
          objetivo: "Combinar uma junção com um filtro para responder a uma pergunta só.",
          conceito: "Uma consulta pode juntar duas tabelas e filtrar o resultado. O INNER JOIN liga as linhas que têm par, e o WHERE descarta as que não atendem à condição. O limite continua entrando quando você usa >= ou <=.",
          exemplo: "Em clientes INNER JOIN pedidos com WHERE pedidos.total >= 50, primeiro cada pedido é ligado ao seu cliente. Depois ficam só os pedidos de total 50 ou mais.",
          origem,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "Quais clientes aparecem no resultado?",
            contexto: "A tabela clientes tem Joana com id 3 e Marcos com id 4. A tabela pedidos tem o pedido 50 de cliente_id 3 com total 80, o pedido 51 de cliente_id 3 com total 20 e o pedido 52 de cliente_id 4 com total 50.",
            trecho: "SELECT clientes.nome FROM clientes INNER JOIN pedidos ON clientes.id = pedidos.cliente_id WHERE pedidos.total >= 50;",
            trechoTipo: "codigo",
            opcoes: [
              { id: "joana", texto: "Apenas Joana" },
              { id: "marcos", texto: "Apenas Marcos" },
              { id: "ambos", texto: "Joana e Marcos" },
            ],
            gabarito: ["ambos"],
            feedbackCorreto: "O pedido 50 de Joana tem total 80 e o pedido 52 de Marcos tem total 50. O >= deixa o 50 entrar, então os dois aparecem.",
            feedbackIncorreto: "Ligue cada pedido ao cliente e depois filtre total >= 50. O pedido 50 (Joana, total 80) e o pedido 52 (Marcos, total exatamente 50) passam. O pedido 51 sai por ter total 20.",
          },
        },
      ],
    },
    {
      titulo: "Desafio",
      licoes: [
        {
          titulo: "Incluir linhas sem par com LEFT JOIN",
          objetivo: "Preservar todas as linhas da tabela à esquerda da junção.",
          conceito: "LEFT JOIN retorna as correspondências e preserva as linhas da tabela à esquerda. Nas linhas sem par, os campos da tabela à direita vêm como NULL.",
          exemplo: "Em clientes LEFT JOIN pedidos, um cliente sem pedidos aparece com NULL nos campos de pedidos.",
          origem,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "Qual é o resultado da consulta para os dois livros?",
            contexto: "A tabela livros tem Guia, com id 1, e Atlas, com id 2. A tabela emprestimos tem o registro de id 8 para livro_id 1.",
            trecho: "SELECT livros.titulo, emprestimos.id FROM livros LEFT JOIN emprestimos ON livros.id = emprestimos.livro_id;",
            trechoTipo: "codigo",
            opcoes: [
              { id: "guia", texto: "Apenas Guia, com empréstimo 8" },
              { id: "atlas", texto: "Apenas Atlas, com empréstimo NULL" },
              { id: "ambos", texto: "Guia com empréstimo 8 e Atlas com empréstimo NULL" },
            ],
            gabarito: ["ambos"],
            feedbackCorreto: "Os dois livros estão na tabela à esquerda. Guia tem um empréstimo correspondente e Atlas aparece com NULL no campo do empréstimo.",
            feedbackIncorreto: "Comece pelos dois livros à esquerda. O empréstimo 8 combina com Guia. Atlas também aparece, com NULL no campo de empréstimo.",
          },
        },
      ],
    },
  ],
};

export function reconhecerObjetivoSql(objetivo: string): boolean {
  return /\b(?:sql|postgres(?:ql)?|mysql|sqlite|select|where|join)\b/i.test(objetivo);
}

/** Pausa entre eventos, em ms. STUDOO_IA_FALSA_PAUSA_MS=0 desliga (testes). */
function pausaConfigurada(): number {
  const bruto = process.env.STUDOO_IA_FALSA_PAUSA_MS;
  const valor = bruto === undefined || bruto.trim() === "" ? PAUSA_PADRAO_MS : Number(bruto);
  return Number.isFinite(valor) ? Math.min(Math.max(Math.trunc(valor), 0), 5000) : PAUSA_PADRAO_MS;
}

/**
 * Pausa entre o último nó e a proposta, em ms (padrão 0: a proposta vem logo depois do último nó, como com a IA de verdade). Só serve ao ensaio da rolagem da trilha
 * pronta: com STUDOO_IA_FALSA_PAUSA_PROPOSTA_MS entre 100 e 250, a proposta chega com a rolagem suave do último nó ainda andando (a corrida da produção).
 */
function pausaDaPropostaConfigurada(): number {
  const valor = Number(process.env.STUDOO_IA_FALSA_PAUSA_PROPOSTA_MS);
  return Number.isFinite(valor) ? Math.min(Math.max(Math.trunc(valor), 0), 5000) : 0;
}

/**
 * Pausa antes de cada lição ficar pronta no aceite, em ms (padrão 0). Só serve ao ensaio da espera longa depois de "Começar a lição 1": com a IA real, escrever as lições leva de 15 a 18 s;
 * com STUDOO_IA_FALSA_PAUSA_CONTEUDO_MS=16000 a IA falsa leva o mesmo tempo (as lições saem juntas, então o aceite todo leva uma pausa só).
 */
function pausaDoConteudoConfigurada(): number {
  const valor = Number(process.env.STUDOO_IA_FALSA_PAUSA_CONTEUDO_MS);
  return Number.isFinite(valor) ? Math.min(Math.max(Math.trunc(valor), 0), 60_000) : 0;
}

/** Espera `ms`. Devolve false se o sinal abortou antes do fim. */
function dormir(ms: number, sinal: AbortSignal): Promise<boolean> {
  if (sinal.aborted) return Promise.resolve(false);
  if (ms <= 0) return Promise.resolve(true);
  return new Promise((resolver) => {
    const fim = () => {
      clearTimeout(temporizador);
      resolver(false);
    };
    const temporizador = setTimeout(() => {
      sinal.removeEventListener("abort", fim);
      resolver(true);
    }, ms);
    sinal.addEventListener("abort", fim, { once: true });
  });
}

function eventosDoPlano(plano: EstruturaDoPlano): EventoEstrutura[] {
  return [
    { tipo: "plano", titulo: plano.titulo, objetivo: plano.objetivo },
    ...plano.fluxos.flatMap((fluxo, indiceFluxo): EventoEstrutura[] => [
      { tipo: "fluxo", fluxo: indiceFluxo, titulo: fluxo.titulo },
      ...fluxo.licoes.map((licao, indiceLicao): EventoEstrutura => (
        { tipo: "licao", fluxo: indiceFluxo, licao: indiceLicao, titulo: licao.titulo, ...(licao.objetivo ? { resumo: licao.objetivo } : {}) }
      )),
    ]),
  ];
}

function conteudoDoPlano(plano: PlanoInterno, fluxo: number, licao: number): ConteudoLicao {
  const alvo = plano.fluxos[fluxo]?.licoes[licao];
  if (!alvo) throw new FalhaApi("proposta_invalida");
  const { titulo: _titulo, ...conteudo } = alvo;
  return conteudo;
}

/** Trilha e gerador para o objetivo: SQL, uma das demos com assunto ou a trilha genérica. */
function planoDoObjetivo(objetivo: string): { plano: EstruturaDoPlano & { origem: string }; gerador: string } {
  if (reconhecerObjetivoSql(objetivo)) return { plano: planoSql, gerador: GERADOR_SQL };
  const demo = demoDoObjetivo(objetivo);
  if (demo) return { plano: demo.plano, gerador: geradorDaDemo(demo.chave) };
  return { plano: planoGenerico(objetivo), gerador: GERADOR_GENERICO };
}

/**
 * IA falsa: nenhuma chamada externa. SQL e os assuntos das demos (violão, inglês para viagem, culinária, história do
 * Brasil) devolvem trilhas prontas, com conteúdo de verdade; qualquer outro objetivo ganha uma trilha genérica e
 * determinística de 3 trechos com 3 lições, já na ordem de aprendizado.
 */
export function criarGeradorFalso(): GeradorTrilha {
  return {
    async *gerarEstrutura(objetivo, sinal, { aoVivo }) {
      const { plano, gerador } = planoDoObjetivo(objetivo);
      const pausa = aoVivo ? pausaConfigurada() : 0;
      for (const evento of eventosDoPlano(plano)) {
        if (!await dormir(pausa, sinal)) return undefined;
        yield evento;
      }
      if (aoVivo && !await dormir(pausaDaPropostaConfigurada(), sinal)) return undefined;
      const meta: MetaPlano = { gerador, origem: plano.origem };
      return meta;
    },

    async gerarConteudo(esqueleto: EsqueletoPlano, fluxo: number, licao: number, sinal: AbortSignal) {
      sinal.throwIfAborted();
      if (!await dormir(pausaDoConteudoConfigurada(), sinal)) sinal.throwIfAborted();
      if (esqueleto.gerador === GERADOR_SQL) return conteudoDoPlano(planoSql, fluxo, licao);
      if (esqueleto.gerador === GERADOR_GENERICO) {
        const conteudo = conteudoGenerico(esqueleto.objetivo, fluxo, licao);
        if (!conteudo) throw new FalhaApi("proposta_invalida");
        return conteudo;
      }
      const demo = demoPelaChave(chaveDoGerador(esqueleto.gerador) ?? "");
      if (demo) return conteudoDoPlano(demo.plano, fluxo, licao);
      throw new FalhaApi("proposta_invalida");
    },
  };
}
