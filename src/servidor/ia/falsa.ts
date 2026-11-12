import type { PlanoInterno } from "@/dominio/aprendizado/plano";

export const VERSAO_PLANO_SQL = "sql-v1";

const origem = "Conhecimento geral de SQL";

const planoSql: PlanoInterno = {
  titulo: "SQL para a prova",
  objetivo: "Praticar filtros e junções em consultas.",
  origem,
  fluxos: [
    {
      titulo: "Consultas",
      licoes: [
        {
          titulo: "Filtrar com WHERE incluindo o valor no limite",
          objetivo: "Filtrar linhas com WHERE incluindo o valor no limite.",
          conceito: "WHERE seleciona as linhas que satisfazem a condição. Use <= para incluir valores até o limite e >= para incluir valores a partir dele. Nos dois casos, o próprio limite entra no resultado.",
          exemplo: "Com produtos que custam 15, 20 e 25, o filtro WHERE preco <= 20 seleciona os de 15 e 20. O produto de 20 entra porque o operador inclui a igualdade.",
          origem,
          exercicio: {
            tipo: "lacuna",
            enunciado: "Complete a consulta com um operador de comparação para listar alunos com nota de pelo menos 7.",
            contexto: "Na tabela alunos, Ana tem nota 6, Bia tem nota 7 e Caio tem nota 9.",
            trecho: "SELECT nome FROM alunos WHERE nota ___ 7;",
            gabarito: [">="],
            feedbackCorreto: ">= inclui notas iguais ou maiores que 7. Bia e Caio aparecem no resultado.",
            feedbackIncorreto: "Use >= para incluir a nota 7 de Bia e a nota 9 de Caio. Com >, apenas Caio aparece porque a condição exige uma nota acima de 7.",
          },
        },
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
      ],
    },
    {
      titulo: "Junções",
      licoes: [
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

export function carregarPlanoFalso(versao: string): unknown {
  return versao === VERSAO_PLANO_SQL ? planoSql : null;
}
