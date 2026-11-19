# Som: efeitos e som de fundo

**Estado:** regra de design de 19/11, pedido 6 do Lead, a pedido do dono ("SFX vivos" e som de fundo com cinco opções ou mudo). Vale para web, Android e iPhone. O catálogo e o toca-sons já estão na integração (`packages/contratos/src/catalogo-sons.ts`, `src/app/sons.ts`, `apps/mobile/src/sons.ts`); esta spec diz onde a pessoa controla o som, o que a tela mostra em cada estado e como o som se comporta. Esboço: `som-390.png`, na pasta de trabalho do Designer (`ux/06-controle-de-som`).

## O que a pessoa controla

- **Efeitos sonoros:** ligados ou desligados. Padrão: ligados.
- **Som de fundo:** Mudo ou um de cinco climas (Foco Calmo, Chuva Suave, Lo-fi de Estudo, Biblioteca, Brisa Natural). Padrão: Mudo.
- Não há controle de volume: vale o volume do aparelho, e os climas já vêm mixados baixos no catálogo.
- A escolha fica no aparelho (`studoo.sons.efeitos` e `studoo.sons.fundo`: localStorage na web, SecureStore no app), não na conta. Cada toque vale na hora: não há "Salvar" nem aviso.

## Onde mora

1. **Perfil, seção "Som"**, logo antes de "Conta", para quem tem conta e para visitante. Um bloco (borda de 2 px `#E1E7FA`, raio de 24) com duas linhas de 64 px (respiro de 10 × 16 e linha de 1 px `#E1E7FA` entre elas):
   - **"Som de fundo"**, com o valor à direita ("Mudo" ou o nome do clima, Nunito 800 de 16, `#5E6A85`) e a seta de 20 px. Tocar abre a folha "Som".
   - **"Efeitos sonoros"**, com "Toques, acertos e conquistas" embaixo (Nunito 400 de 14/20, `#5E6A85`) e a chave à direita.
2. **Aula: botão de som no alto**, à direita da barra de andamento, sempre à vista. O alto da aula passa a ter três colunas: o X, o andamento e o som. O botão abre a mesma folha por cima da lição, que fica onde estava; ao fechar, o foco volta ao botão. Calar o fundo leva dois toques (o botão e "Mudo"), sem sair da lição.
   - Por que o botão não cala direto: são dois sons, e um botão que alterna calaria um deles sem dizer qual. A folha mostra os dois e o que está tocando.

Fora da aula, o controle fica no Perfil.

## Botão de som da aula

- 44 × 44, raio de 12 e ícone de 24 px com traço de 2,5, como o X da aula. Com o dedo ou o mouse em cima, fundo `#F1F4FD`; com o foco pelo teclado, anel de 3 px `#3858D6`. No Android, a área de toque é de 48 (P8).
- O ícone segue o estado e nunca se move:

| Estado | Ícone | Nome acessível |
|---|---|---|
| Fundo escolhido | Alto-falante com duas ondas, `#3858D6` | "Som: <clima>, efeitos ligados" (ou "desligados") |
| Fundo mudo e efeitos ligados | Alto-falante com uma onda, `#5E6A85` | "Som: fundo mudo, efeitos ligados" |
| Tudo desligado | Alto-falante cortado, `#5E6A85` | "Som: tudo desligado" |

- Com o fundo escolhido mas parado, o nome diz o motivo: "Som: Chuva Suave, começa no primeiro toque" (antes do primeiro gesto) ou "Som: Chuva Suave, pausado enquanto você grava".
- **Novidade:** um ponto de 10 px `#FFD166`, com borda branca de 2, no canto de cima à direita (a 6 px das bordas), até a pessoa abrir a folha uma vez ou concluir 3 lições, o que vier antes (`studoo.sons.visto`, no aparelho). O ponto não pulsa. Enquanto ele aparece, o nome acessível termina em ", novidade".

## Folha "Som"

É a folha da spec 11: sobe de baixo até 767 px e vira um cartão no centro a partir de 768 px; ocupa até 92% da altura e rola por dentro se passar; no toque, tem a alça; o Esc, o véu e o X de 44 px fecham. O conteúdo vem nesta ordem, com 12 px entre os blocos:

1. Título "Som" (Quicksand 700 de 20/26), com o X.
2. "Som de fundo" (Quicksand 700 de 18/24) e, embaixo, "Toca baixinho enquanto você estuda." (Nunito 400 de 15/22, `#5E6A85`).
3. A lista de escolha única, com 6 px entre as linhas, nesta ordem: Mudo, Foco Calmo, Chuva Suave, Lo-fi de Estudo, Biblioteca e Brisa Natural.
   - **Linha:** altura mínima de 60, respiro de 8 × 12, borda de 2 px `#E1E7FA` e raio de 16. À esquerda, um quadro de 40 × 40 (raio de 12, fundo `#F1F4FD`) com o ícone de 22 px em `#3858D6`: alto-falante cortado, ondas, nuvem com chuva, fones, livros e folha. No meio, o nome (Nunito 800 de 16/22, `#1B2A5E`) e a descrição numa linha só (Nunito 400 de 14/20, `#5E6A85`, com reticências). À direita, a marca redonda de 24 px, com borda de 2 px `#8792BD`.
   - **Marcada:** borda `#3858D6`, fundo `#EEF3FF` e marca com borda `#3858D6` e miolo de 12 px `#3858D6`.
   - **Tocando:** na linha marcada, a descrição dá lugar a três barras (3 px de largura, vão de 2, de 4 a 12 px de altura, `#3858D6`) e à palavra "Tocando" (Nunito 800 de 14, `#3858D6`).
   - **Carregando:** "Carregando…" com um giro de 14 px, em `#5E6A85`, até o som chegar (a primeira vez de cada clima baixa o arquivo). A escolha já vale e já está guardada.
   - **Erro:** se o som não chega em 8 s ou falha, a linha diz "Não deu para tocar agora. Toque de novo para tentar." (Nunito 800 de 14/20, `#C23B4E`, em até duas linhas). A escolha continua marcada. Tocar de novo na linha, reabrir a folha ou o próximo toque no app tenta outra vez.
4. Uma linha de 1 px `#E1E7FA`.
5. **"Efeitos sonoros"**, com "Toques, acertos, erros e conquistas" embaixo, e a chave à direita.
   - A chave é do Studoo nas três plataformas, não o `Switch` do sistema: 52 × 32, raio de 16; desligada, trilho `#C9D1EA`; ligada, trilho `#3858D6`; o botão branco de 26 px, com sombra `0 2px 4px rgba(27, 42, 94, .25)`, anda 20 px em 160 ms.
   - Ligar toca uma vez o efeito `salvo`, para a pessoa ouvir como soa. Desligar não toca nada.
6. Rodapé em Nunito 400 de 14/20, `#5E6A85`, com o ícone de informação de 16 px: "O fundo fica mais baixo quando o Studoo fala e para enquanto você grava." No iPhone, vem mais uma linha: "No modo silencioso do iPhone, nenhum som do Studoo toca." (P24 da spec 07).

### Textos das opções

| Opção | Descrição na tela |
|---|---|
| Mudo | Sem som de fundo |
| Foco Calmo | Acordes suaves e quentes |
| Chuva Suave | Chuva leve na janela |
| Lo-fi de Estudo | Batida lenta e abafada |
| Biblioteca | Ambiente quieto, bom para ler |
| Brisa Natural | Vento suave entre as folhas |

As descrições de hoje (`descricao` em `CATALOGO_FUNDOS`) são técnicas e não cabem numa linha em 360 px. Estas entram no lugar delas em `OPCOES_FUNDO_UI`, com os mesmos nomes; a descrição técnica pode ficar no catálogo como nota de quem fez o som.

## Como o som de fundo se comporta

- **Onde toca:** dentro do app, depois da entrada: abas, mapa, geração e aula. Não toca na entrada, na recuperação de senha nem nas páginas públicas `/t` e `/p`. Ao sair da conta, para; a escolha continua no aparelho.
- **Escolher:** toca na hora, subindo de 0 ao volume do clima em 600 ms. **Trocar:** o anterior desce em 300 ms e o novo sobe em 600. **Mudo:** desce em 400 ms e para. O fundo nunca entra no volume cheio de uma vez.
- **Studoo falando** (ler em voz alta, frases de inglês, acorde, som de referência da prática): o fundo desce a 20% em cerca de 0,4 s e volta em 0,6 s quando a fala acaba.
- **Para** durante a gravação do Explique e a voz ao vivo, com o app em segundo plano ou com a aba escondida. Ao voltar, recomeça subindo em 600 ms. Durante a gravação, os efeitos também se calam, menos o de fim de gravação, como o toca-sons já faz.
- **Começo:** nas três plataformas, o fundo guardado começa no primeiro toque, clique ou tecla da pessoa dentro do app, subindo em 600 ms. É a regra do navegador, e o app segue a mesma para não haver diferença: abrir o Studoo nunca começa a tocar sozinho.

## Como a pessoa descobre o som de fundo

- Nada toca sozinho: o padrão é Mudo, e não há tela, folha nem aviso de convite (regras do dono: sem tela de convite antes dos dados e nada de janela nativa).
- O botão de som fica sempre no alto da aula, com o ponto de novidade nas primeiras vezes.
- A seção "Som" fica sempre no Perfil.
- Os efeitos, ligados desde o começo, mostram no primeiro toque numa opção da aula que o Studoo tem som.

## Primeira vez

1. No primeiro acesso no aparelho, os efeitos estão ligados e o fundo está Mudo. O primeiro toque numa opção já soa (`toque_opcao`); na web, esse toque é o próprio gesto que libera o áudio.
2. Na primeira aula, o botão de som aparece com o ponto de novidade.
3. Na primeira abertura da folha, "Mudo" está marcado, e nada toca até a pessoa escolher. O ponto some.
4. No primeiro clima escolhido, a linha diz "Carregando…" até o som chegar e, depois, "Tocando".

## Movimento

- As barras de "Tocando" sobem e descem em 900 ms (ida e volta, `ease-in-out`), com 150 ms entre elas, só enquanto o som toca. Nada se move no alto da aula.
- **Movimento reduzido:** a folha só muda a opacidade (spec 11); a chave troca sem deslizar; as barras ficam paradas, em 6, 12 e 8 px, com a mesma palavra; "Carregando…" fica sem o giro. O som não muda: movimento reduzido não cala efeitos nem fundo, e as subidas e descidas de volume continuam.

## Leitor de tela e teclado

- **Botão da aula:** o nome da tabela acima; na web, `aria-haspopup="dialog"`. Abre a folha com o foco no título "Som".
- **Lista:** na web, `role="radiogroup"` com o rótulo "Som de fundo" e cada linha com `role="radio"` e `aria-checked`; no app, cada linha com `accessibilityRole="radio"` e `accessibilityState={{ checked }}`. O nome de cada linha é "<nome>, <descrição>"; tocando, "<nome>, tocando"; com erro, "<nome>, não deu para tocar agora".
- **Setas:** andam e marcam, como em todo grupo de escolha única, mas a prévia só começa quando a opção fica marcada por 600 ms. Assim, passar pelas opções não toca nada.
- **A prévia não atropela o leitor:** com o leitor de tela ligado (no app, `AccessibilityInfo.isScreenReaderEnabled`), o anúncio vem antes do som: "Chuva Suave escolhido. Tocando." (no Mudo, "Som de fundo desligado."). O som começa 1,5 s depois da escolha e, enquanto a folha está aberta, toca a 60% do volume do clima. Na web, o leitor já anuncia a marca do rádio, a prévia espera os mesmos 600 ms e o "Tocando" entra numa região `aria-live` educada.
- **Chave:** na web, `role="switch"` com `aria-checked` e o rótulo "Efeitos sonoros"; no app, `accessibilityRole="switch"`. O leitor diz "Efeitos sonoros, ligado" ou "desligado".
- **Perfil:** a linha "Som de fundo" é um botão com o nome "Som de fundo: <valor>"; a chave é a mesma da folha.

## Efeitos dos momentos novos (19/11)

Tabela fechada com os IDs já existentes em `packages/contratos/src/catalogo-sons.ts` (sem criar arquivos novos). O toca-sons aplica o `cooldownMs` de cada efeito; para não empilhar em sequências rápidas, os momentos abaixo seguem a regra de disparo da última coluna.

| Área | Momento | Efeito (`IdEfeitoSonoro`) | Vol. relativo | Regra para não empilhar / quando NÃO tocar |
|---|---|---|---|---|
| **Geração que se acompanha** (spec 04) | Cada lição nova que chega ao mapa | `geracao_licao` | `0.58` | Cooldown mínimo de `180 ms` (rajadas no mesmo lote descartam os extras); não toca se a geração foi cancelada |
| **Geração que se acompanha** (spec 04) | Aviso "Mais uma!" (no máximo a cada 3 lições) | nenhum | — | A lição que acabou de chegar já tocou `geracao_licao`; outro som no mesmo lote polui |
| **Geração que se acompanha** (spec 04) | "Trilha pronta! N lições em M partes." | `geracao_pronta` | `0.95` | Toca uma única vez ao concluir (cooldown `500 ms`); se a última lição chegou há menos de `200 ms`, suprimir `geracao_licao` e tocar só `geracao_pronta` |
| **Geração que se acompanha** (spec 04) | Troféu que entra no fim da geração | nenhum | — | `geracao_pronta` já marca a conclusão da trilha |
| **Geração que se acompanha** (spec 04) | Foco automático no botão "Começar" | nenhum | — | Foco programático nunca dispara som |
| **Ordenar em lista única** (spec 08) | Escolher um item da lista | `toque_opcao` | `0.76` | Cooldown `45 ms` |
| **Ordenar em lista única** (spec 08) | Trocar dois itens de lugar (por toque ou seta) | `ordenar_soltar` | `0.63` | Cooldown `50 ms`; no segundo toque que efetiva a troca, toca só `ordenar_soltar` (não soma `toque_opcao`) |
| **Ordenar em lista única** (spec 08) | Arrastar e soltar um item | `ordenar_soltar` | `0.63` | Toca apenas ao soltar em uma **nova** posição; não toca se voltar ao mesmo lugar ou cancelar |
| **Ordenar em lista única** (spec 08) | "Voltar à ordem inicial" | `toque_opcao` | `0.76` | Um único disparo para a ação inteira (nunca um por item movido) |
| **Painel de retorno** (spec 13) | Reação animada do Stu junto com o retorno | nenhum | — | O efeito `acerto` (`0.90`) ou `erro` (`0.86`) já sonoriza o resultado; não sobrepor outro efeito |
| **Configurações da trilha** | "Capa salva." | `salvo` | `0.64` | Cooldown `300 ms` |
| **Configurações da trilha** | Salvar um campo ao sair/confirmar | `salvo` | `0.64` | Cooldown `300 ms`; só toca quando houve alteração salva (nunca em auto-save contínuo enquanto digita) |
| **Folha "Som"** | Prévia de um clima ao escolher | nenhum SFX | — | O próprio clima entra subindo em `600 ms` (ou após `600 ms` / `1,5 s` no leitor de tela), sem efeito por cima |
| **Folha "Som"** | Ligar a chave "Efeitos sonoros" | `salvo` | `0.64` | Toca uma vez ao ligar; ao desligar, nenhum |

## Arquivos de som (produção)

Os arquivos finais e as decisões de composição estão em [som/PRODUCAO.md](../som/PRODUCAO.md): tema em Ré maior, 86 BPM, 32 compassos (89,30 s), cinco arranjos do mesmo tema, laço com a cauda dobrada no começo e efeitos com ataque em até 3,3 ms.

## Paridade

- A folha, a ordem, os textos, as medidas e o comportamento são os mesmos nas três plataformas, com os componentes da spec 11 e a chave do Studoo (nenhum seletor ou chave do sistema).
- O segundo plano vem do `AppState` no app e da aba escondida (`visibilitychange`) na web; a regra é a mesma: para e volta subindo.
- A única diferença que a plataforma obriga é a P24 (modo silencioso do iPhone), na spec 07.

## Decisões

**Do dono, fechadas em 19/11 (seguiu a recomendação do Designer):**
1. **Onde o fundo toca: no app inteiro, depois da entrada.** Não é configurável, e não toca na entrada nem antes dela. Cortar o som a cada troca de tela cansa.
2. **Modo silencioso do iPhone: os sons do Studoo respeitam** (`playsInSilentMode: false`, como o toca-sons já faz). Quem silencia o celular não espera o app tocando, e a P24 da spec 07 continua. Para a demonstração, o aparelho sai do silencioso antes.

**De design:** a folha no lugar de um botão que alterna; sem controle de volume; os textos curtos das opções; o ponto de novidade no lugar de um convite.

## Conferência antes de apresentar

- iPhone fora do modo silencioso e com o volume de mídia alto.
- No navegador, um toque na tela antes de mostrar o som, porque nada toca antes do primeiro gesto.
