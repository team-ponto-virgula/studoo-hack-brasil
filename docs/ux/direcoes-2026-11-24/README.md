# Três direções para o Studoo mobile

Propostas comparáveis para as páginas principais do aplicativo: as mesmas tarefas de estudo, com organização e linguagem visual distintas. A pesquisa usa Duolingo como base de progressão, clareza de ação e recuperação do erro, preservando a marca do Studoo.

**Revisão em andamento.** A R4 fechou achados de leitura, foco e acabamento. A auditoria das 18 famílias identificou estados adicionais a completar; a nota global continua pendente. Os resultados e as fontes de cada rodada ficam em [RESULTADOS.md](RESULTADOS.md) e [revisoes/](revisoes/). A existência de 35 páginas-base não aprova automaticamente seus subestados.

| Direção | Ideia | Exemplos e proposta |
| --- | --- | --- |
| **A · Jornada Azul** | Próximo passo evidente, percurso espacial, botões táteis e Stu como companhia contextual. Recomendação atual da revisão de arte. | [Descrição](DIRECAO-A.md) · [HTML interativo](entrega/direcao-a.html) |
| **B · Caderno Claro** | Papel claro, capítulos, margem e marcadores. Alternativa com maior afinidade com o novo Stu caderno. | [Descrição](DIRECAO-B.md) · [HTML interativo](entrega/direcao-b.html) |
| **C · Foco Vivo** | Hero navy, lista linear e leitura concentrada, com menor presença de ilustração. | [Descrição](DIRECAO-C.md) · [HTML interativo](entrega/direcao-c.html) |

Os HTMLs são código de protótipo: o GitHub mostra a fonte. Para interagir, use a prévia HTTP abaixo ou baixe o [pacote HTML](entrega/studoo-tres-direcoes.zip). O navegador pode restringir arquivos locais; a validação desta tarefa usa HTTP. As ações usam dados sintéticos e armazenamento local, sem API, email, IA, microfone ou sessão real. Os desenhos não foram instalados no app nativo.

## Reabrir a bancada

Na raiz desta cópia do repositório, execute:

```sh
python3 -m http.server 3012 --bind 0.0.0.0
```

Abra `/docs/ux/direcoes-2026-11-24/prototipo/index.html` na prévia HTTP da porta **3012**. Nesta tarefa, a raiz é `/workspace/work/studoo-ui-directions`. Se não houver uma prévia configurada, adicione a porta em **Edit Environment → HTTP Previews → 3012 → Apply to this chat**. Nenhum endereço público de hospedagem é presumido.

A bancada escolhe direção, página, estado, formato de exercício e largura 390×844/360×800. “Recomeçar o exemplo local” limpa somente o cenário de desenho. As três direções mantêm dados locais separados.

## Critérios e limites

- [Pesquisa e referências verificadas](PESQUISA.md).
- [Brief comum](BRIEF.md) e [protocolo D1–D10](COBERTURA-E-REVISAO.md): pesos fixos, meta 9 por critério, gates e menor nota sustentada pela revisão competente.
- [Pareceres independentes e histórico de defeitos](revisoes/). As notas antigas permanecem identificadas; uma correção exige nova prova.
- Os assets vistos são do kit atual provisório. O novo Stu caderno continua sendo a referência de branding; seus PNGs de origem ainda não estão nesta cópia. A troca exige nova conferência de composição.
- Produto integrado, persistência real, paridade web/React Native, iPhone/Android e uso por pessoas não recebem nota por transferência destes protótipos.

A correção separada da intro foi distribuída no **TestFlight interno 0.1.0 (7)**. O [registro do build 7](https://github.com/team-ponto-virgula/studoo-hack-brasil/blob/8ae72bb5e45516660a25ae79d1a3518a42bbf18b/docs/beta/BUILD-7-INTRO-BOOT.md) contém origem, verificações e disponibilidade. As três direções desta pasta não fazem parte desse IPA.
