# Proposta de implementação da nova UI/UX

A recomendação é **Jornada Azul** como sistema principal. As três direções foram aprovadas no escopo do desenho; a implementação do produto terá suas próprias provas. Os componentes devem conservar uma organização coerente entre todas as páginas, incluindo os estados de erro, espera e retomada.

## Sistema de componentes

| Camada | Construção proposta | Referência |
| --- | --- | --- |
| Fundamentos | Azul de ação, navy, superfícies, bordas, raios, espaçamento, Quicksand/Nunito e escala de leitura. | [Tokens comuns](prototipo/base.css), [A](prototipo/directions/jornada.css), [B](prototipo/directions/caderno.css), [C](prototipo/directions/foco.css). |
| Estrutura | Cabeçalho/contexto de estudo, área rolável, ação principal e navegação; Etapa anterior contextual. | Início, mapa, lição e conclusão; pares 390/360. |
| Ações e campos | Botão de 52 px, alvos ≥44 px, escolhas/seletores, erro por campo, estado pendente e foco do sucessor. | Exercícios, perfil, capa/tema e diálogos. |
| Aprendizagem | Cartão de retomada, nó/balão/ponte, origem/apoio, seis formatos, feedback parcial e conclusão orientada ao próximo passo. | Famílias P06–P14 da matriz final. |
| Confiança | Confirmação, visibilidade/moderação, material privado, cópia recebida, retorno assíncrono vinculado à operação. | P15–P18 e três fechos R7. |

A implementação reaproveita os componentes e contratos existentes, com versões equivalentes na web móvel e em React Native. Os tokens de proposta orientam os estilos; fontes, semântica, foco, área segura e componentes nativos devem ser verificados na plataforma correspondente. O novo Stu caderno entra com seus arquivos originais, seguido de revisão de proporção/legibilidade na geração e conclusão.

## Ordem dos lotes

1. **Fundamentos e estrutura:** tipografia, paleta, botões, superfícies e navegação; início/retomada nas duas plataformas.
2. **Pedido e caminho:** material, consentimento, geração por eventos reais, proposta, aceite e mapa/balões.
3. **Lição completa:** conceito, origem/apoio, seis formatos, erro/parcial/reforço, explicação opcional, salvamento confirmado e retomada.
4. **Perfil e comunidade:** edição/foto, capa/tema, Explorar, conteúdo recebido, compartilhamento/moderação e preferências/segurança.

Cada ação usa Conventional Commits e conserva as regras do repositório. O próximo PR de tela deve indicar as duas implementações, pares de captura em 390×844/360×800 e qualquer diferença técnica registrada na spec07. Progresso, aceite, publicação e permissões passam a depender das respostas reais do produto.

## Validação antes de distribuir

Executar typecheck web/mobile e as suítes pertinentes exigidas nas regras (`test:paridade`, `test:movimento`, `test:visitante-mobile`, `test:estudio:interface`, `test:formatos`, `test:dominio`). Conferir teclado, leitor de tela, área segura, permissões, volta do aparelho, fontes e desempenho nos aparelhos disponíveis, mantendo os alvos sem execução como pendentes. Reavaliar as facetas alteradas com a mesma régua e publicar evidências antes do próximo build.

A nota 9 do protótipo permite escolher uma direção com base revisável. A nota do produto instalado será preenchida somente pelas suas próprias execuções e observações.
