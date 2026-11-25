# Direção de UI · Jornada Azul

25/11/2026 · direção vigente para a web de estudo e o app: **A · Jornada Azul**, escolhida pelo dono após a comparação das três propostas. O pedido seguinte amplia o cuidado a todos os componentes, sua personalização e organização. O Stu, a logo e a intro atuais estão aprovados e permanecem.

A especificação detalhada está no [sistema de interface](../ux/jornada-azul/SISTEMA.md), com [inventário de componentes e estados](../ux/jornada-azul/INVENTARIO.md) e [plano de implementação e revisão](../ux/jornada-azul/PLANO.md). O [resultado R7](../ux/direcoes-2026-11-24/RESULTADOS.md) avalia os protótipos; a implementação tem provas e notas próprias.

## O que dá a cara do Studoo

- Azul `#2457DD`, navy `#15275B`, superfícies `#EDF3FF` e branco; cores semânticas conservam sua função.
- Quicksand 700 nos títulos e Nunito no corpo/controles; texto de leitura confortável e auxiliares legíveis, sem reduzir contraste com opacidade.
- Ação de 52, raio 16 e degrau 4; cartão de raio 24; margem mobile 20; escala de espaço 4/8/12/16/20/24/32/44.
- Caminho com partes e próximo nó reconhecíveis; conteúdo e estados vindos dos dados reais.
- Stu contextual em acolhimento, apoio e conclusão; seus arquivos, expressões, proporções e controles de animação não são refeitos.

O Duolingo serve de referência para progressão, foco em um desafio, erro recuperável e companhia do personagem. O Studoo usa sua própria marca, paleta, ícones e linguagem. Continuam as restrições D16: sem XP, sequência de dias, ranking, moedas ou medalhas.

## Organização

A tela organiza **contexto → tarefa → feedback → próximo passo**. Cabeçalho orienta; conteúdo resolve uma tarefa; ação principal continua visível sem rolar até 600 px e vem antes das saídas secundárias. Não há outra barra duplicando o mesmo conjunto de ações. A cápsula, o teclado e a área segura não podem cobrir conteúdo ou controle.

A personalização vem de objetivo, título/progresso da trilha, tema/capa e perfil reais. Não adicionar perguntas obrigatórias, meta diária ou informação inventada para parecer pessoal. O conjunto deve continuar reconhecível com capa/foto diferentes e com visitante/conta conforme disponibilidade real.

## Componentes e estados

A fundação organiza botões, campos, escolhas, superfícies, títulos, progresso, selos, vazios/erros/carregando, menus, confirmações, avisos e folhas. Aprendizagem e comunidade compõem esses elementos sem criar uma família de controles para cada tela. Os seis formatos de exercício mantêm operação, semântica e regras próprias sobre a mesma base visual.

Estados normais não bastam: foco, pressão, selecionado, incompleto, pendente, indisponível, acerto, erro, parcial, offline, cancelar e repetir precisam de evidência. Conteúdo longo, texto ampliado e preferências de movimento entram na mesma revisão. O inventário rastreia os consumidores; uma cor global nova não significa UX inteira aprovada.

## Quatro momentos que permanecem

1. **Seu material vira trilha com origem acessível.** Marcadores e citação apontam para o trecho real disponível; não se inventa apoio por frase. Prévia tem estados de leitura/carregamento/erro. Material continua privado conforme o contrato.
2. **O erro abre outro caminho.** Feedback explica, reforço preserva a tentativa e a ponte devolve ao exercício. Estados não dependem só de cor; animação não bloqueia a leitura.
3. **Explique ao Stu.** Gravar começa somente depois do gesto explícito; transcrição é revisada antes de enviar. Texto e seguir sem explicar continuam possíveis; limite de 60 s e indisponibilidade preservam seus caminhos.
4. **Conclusão orienta continuidade.** Progresso e sincronia refletem a resposta real, seguidos pela próxima lição e eventuais avisos de revisão. Não fingir salvamento/avanço com animação nem transformar a conclusão em placar.

## Implementação e validação

A Jornada Azul substitui o piloto Clareza e os tokens visuais anteriores quando divergirem. Isso não altera a intro, os contratos de API ou as regras de aprendizagem. A [spec 04](../specs/04-experiencia-ilustrada.md) registra a decisão; a [spec 11](../specs/11-componentes-do-studoo.md) fixa a anatomia dos componentes; a [spec 07](../specs/07-paridade-web-mobile.md) mantém paridade e exceções técnicas.

O plano exige implementar nas duas superfícies, preservar acessibilidade e casos de falha, produzir pares comparáveis em 390×844/360×800 e rodar os checks do repositório. Prévia RN Web não comprova comportamento nativo. As notas da proposta não passam automaticamente para o app instalado; o fechamento registra o que foi executado e as pendências de fato.

O [documento anterior de direção](https://github.com/team-ponto-virgula/studoo-hack-brasil/blob/8c057241f6fc4820f36c284218a4f04affa59543/docs/ui/DIRECAO-UI.md) e seus diagnósticos continuam como histórico identificado. A pesquisa e as referências permanecem em [REFERENCIAS-UI](REFERENCIAS-UI.md) e [referências de 24/11](../ux/referencias/README.md).
