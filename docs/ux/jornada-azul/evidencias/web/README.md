# Evidências WEB · FA4 · pacote publicável

Este pacote apenas seleciona documentos e capturas já existentes. **Nenhum teste de produto ou build foi executado; nenhum código de produto foi alterado para montá-lo.** A candidata final dos retestes é `fa4be429992037cdaa1be055f52be6a529d32f76`.

`PUBLICAVEL-FA4.json` foi reconstruído por whitelist: cenário, resultado, metadados, medidas, snapshots/hashes de fonte e requisições limitadas a method/path/status/error. Segmentos dinâmicos viraram `:id`. Não contém labels/IDs de contas ou planos, emails, autenticação, cookies, tokens, corpos, storageState, provisionamento, scripts, setup de foto ou cópia dos JSONs brutos.

## Resultados e fonte

- SQL390×844 e360×800: gerar/aceitar, leitura, erro`>` e acerto`>=`, concluirPOST200, GET1/5, reload e retomada de INNER JOIN por nó→balãoComeçar. Fonte estável na rodada. **O percurso completo é histórico anterior aos últimos ajustes isolados do freeze**, identificado por hashes próprios; não é apresentado como nova execução de FA4/R2/C2.
- FA4 final: Pedido100/200% preso acima da navegação4/4; geração200% por Tab/clique2/2; navbar200% nos quatro destinos; Config3/3 com6PATCHs reais; menu próprio4/4 ponteiro e2/2 teclado; MenuPublicacao2/2; confirmação com fonte mudando16→32px2/2. Hashes estáveis nos retestes.
- Progresso permanece real1/5; o componente de retomada usa `<progress>` nativo e ocupa as duas colunas. Confirmação ocupada reteve DELETE e devolveu503 controlado, sem apagar foto. Nenhuma denúncia/bloqueio ou publicação foi enviada pelos menus.
- Zero erros JavaScript nas rodadas selecionadas. As falhas deliberadas e abortos permanecem sanitizados; não se declara que toda requisição terminou200.

A nota9/10 vale **somente para as tarefas e ramos WEB observados**. As notas C1/C2/C3/C6/C7/C8/C9 ficam limitadas às provas declaradas. C4/C5/C10 completos, produto44famílias, média ponderada global, nativo e estudo com pessoas permanecem `null`. Não atribuir nota de satisfação, áudio audível, leitor real ou segurança/privacidade completa a estas capturas.

## Capturas e limites de comparação

`MANIFESTO.json` lista25PNGs sem edição, SHA256 e dimensões:12estados em pares390/360 e uma captura complementar de navbar200% só em360. Total de PNGs:1.580.768bytes; pacote inteiro abaixo de10MB.

Estados pareados: Pedido100, Pedido200, propostaSQL, exercício, feedback de erro, conclusão, retomada INNER JOIN, Minhas trilhas/progresso, Configurações, menu do cartão próprio, menu de publicação e confirmação200. O estado/conteúdo/posição foi declarado nos registros; não é promessa de identidade pixel a pixel.

Exceções explícitas: Configurações e menu próprio em360 usam altura844 (a rodada realmente executada), enquanto SQL360 e demais pares pertinentes usam800. Navbar200% foi executada especificamente em360×800; não se fabrica um par390. Nomes de trilhas/feedbacks variáveis nas imagens são dados sintéticos. As capturas de confirmaçãoFA4 não provam aviso de música ativo; isso foi exercitado depois na R2.

## Relação com R2

De FA4 para `b3e97e7cbe7d6b8b711216070453a13ebcad36e3`, o diff de runtime contém apenas:

- `apps/mobile/src/licao.tsx`: compacto em linha só acima de600.
- `src/app/aula.css`: Continuar compacto fullwidth/52 até600.
- `src/ui/aviso.css`: aviso de música invisível durante decisão/menu aberto.

Os demais arquivos rastreados em`src`,`apps/mobile`,`packages` são idênticos entre essas candidatas. Essa equivalência de fonte não é uma nova execução. Os dois ramos alterados foram testados separadamente e estão no pacote R2PUBLICAVEL; não foram convertidos em evidência FA4 ou suposta execução C2.

Publicar apenas este diretório e a seleção R2 segura indicada pelo responsável. Os brutos, scripts e arquivos privados permanecem fora deste pacote.
