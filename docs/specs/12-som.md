# Som: efeitos e música de fundo

**Estado:** regra de design de 19/11, pedido 6 do Lead, a pedido do dono ("SFX vivos" e som de fundo com cinco opções ou mudo). Vale para web, Android e iPhone. O catálogo e o toca-sons já estão na integração (`packages/contratos/src/catalogo-sons.ts`, `src/app/sons.ts`, `apps/mobile/src/sons.ts`); esta spec diz onde a pessoa controla o som, o que a tela mostra em cada estado e como o som se comporta. Esboço: `som-390.png`, na pasta de trabalho do Designer (`ux/06-controle-de-som`).

**Revisão do dono (19/11): uma música só.** O fundo passa a ser só o Lo-fi de Estudo (`lofi_estudo`: `public/sons/fundos/lofi-estudo.mp3` e `apps/mobile/assets/sons/fundos/lofi-estudo.mp3`, na versão de d5bf5aa, com o laço que começa no compasso 1), em laço no app inteiro. Os efeitos tocam por cima, sem parar e sem baixar a música. Saem os cinco climas, a lista de escolha, a prévia e o ponto de novidade: a pessoa controla música e efeitos com duas chaves independentes, na folha "Som" e no Perfil, sem tela nova. Esta spec já está escrita assim; onde algo de antes mudou, está dito.

## O que a pessoa controla

- **Música de fundo:** ligada ou desligada. É sempre o Lo-fi de Estudo. Padrão: ligada (`fundo: 'lofi_estudo'` no contrato). Quem tinha escolhido Mudo continua com a música desligada; quem tinha outro clima passa ao Lo-fi (`fundoUnicoDaPreferencia`).
- **Efeitos sonoros:** ligados ou desligados. Padrão: ligados.
- As duas chaves são independentes: uma nunca mexe na outra.
- Não há controle de volume: vale o volume do aparelho, e a música já vem mixada baixa no catálogo.
- A escolha fica no aparelho (`studoo.sons.efeitos` e `studoo.sons.fundo`: localStorage na web, SecureStore no app), não na conta. Cada toque vale na hora: não há "Salvar".

## Onde mora

1. **Perfil, seção "Som"**, logo antes de "Conta", para quem tem conta e para visitante. É um bloco (borda de 2 px `#E1E7FA`, raio de 24) com duas linhas de 64 px (respiro de 10 × 16 e linha de 1 px `#E1E7FA` entre elas), cada uma com a chave à direita:
   - **"Música de fundo"**, com "Lo-fi de Estudo, em laço" embaixo (Nunito 400 de 14/20, `#5E6A85`);
   - **"Efeitos sonoros"**, com "Toques, acertos e conquistas" embaixo.
   Não há seta nem folha a partir do Perfil: as chaves já estão ali.
2. **Aula: botão de som no alto**, à direita da barra de andamento, sempre à vista. O alto da aula tem três colunas: o X, o andamento e o som. O botão abre a folha "Som" por cima da lição, que fica onde estava; ao fechar, o foco volta ao botão. Calar a música leva dois toques (o botão e a chave), sem sair da lição.
   - O botão não cala direto porque são dois sons; a folha mostra os dois.

Fora da aula, o controle fica no Perfil.

## Botão de som da aula

- 44 × 44, raio de 12 e ícone de 24 px com traço de 2,5, como o X da aula. Com o dedo ou o mouse em cima, fundo `#F1F4FD`; com o foco pelo teclado, anel de 3 px `#3858D6`. No Android, a área de toque é de 48 (P8).
- O ícone segue o estado e nunca se move:

| Estado | Ícone | Nome acessível |
|---|---|---|
| Música ligada | Alto-falante com duas ondas, `#3858D6` | "Som: música ligada, efeitos ligados" (ou "desligados") |
| Música desligada e efeitos ligados | Alto-falante com uma onda, `#5E6A85` | "Som: música desligada, efeitos ligados" |
| Tudo desligado | Alto-falante cortado, `#5E6A85` | "Som: tudo desligado" |

- Com a música ligada mas parada, o nome diz o motivo: "Som: música começa no primeiro toque" (antes do primeiro gesto) ou "Som: música pausada enquanto você grava".
- Sem ponto de novidade: com a música tocando desde o primeiro toque, o som se mostra sozinho, e o aviso da primeira vez diz onde desligar (abaixo).

## Folha "Som"

Não há lista nem carrossel de climas e não há prévia. É a folha da spec 11: sobe de baixo até 767 px e vira um cartão no centro a partir de 768 px; ocupa até 92% da altura e rola por dentro se passar; no toque, tem a alça; o Esc, o véu e o X de 44 px fecham. O conteúdo vem nesta ordem, com 12 px entre os blocos:

1. Título "Som" (Quicksand 700 de 20/26), com o `acessorio-fone` de 40 (spec 13) e o X.
2. **"Música de fundo"** (Nunito 800 de 16/22), com "Lo-fi de Estudo, em laço" embaixo (Nunito 400 de 14/20, `#5E6A85`), e a chave à direita. Embaixo do texto, a linha de estado:
   - **Tocando:** as três barras (3 px de largura, vão de 2, de 4 a 12 px de altura, `#3858D6`) e "Tocando" (Nunito 800 de 14, `#3858D6`);
   - **Carregando:** "Carregando…" com um giro de 14 px, em `#5E6A85`, até o som chegar (a primeira vez baixa o arquivo); a chave já vale e já está guardada;
   - **Antes do primeiro gesto:** "Começa no primeiro toque";
   - **Gravando:** "Pausada enquanto você grava";
   - **Erro:** se o som não chega em 8 s ou falha, "Não deu para tocar a música. Desligue e ligue de novo para tentar." (Nunito 800 de 14/20, `#C23B4E`, em até duas linhas). A chave continua ligada; o próximo toque no app também tenta de novo.
3. Uma linha de 1 px `#E1E7FA`.
4. **"Efeitos sonoros"**, com "Toques, acertos, erros e conquistas" embaixo, e a chave à direita.
   - As duas chaves são do Studoo nas três plataformas, não o `Switch` do sistema: 52 × 32, raio de 16; desligada, trilho `#C9D1EA`; ligada, trilho `#3858D6`; o botão branco de 26 px, com sombra `0 2px 4px rgba(27, 42, 94, .25)`, anda 20 px em 160 ms.
   - Ligar os efeitos toca uma vez o efeito `salvo`, para a pessoa ouvir como soa. Desligar não toca nada. Ligar a música não toca efeito: a própria música entra.
5. Rodapé em Nunito 400 de 14/20, `#5E6A85`, com o ícone de informação de 16 px: "Os efeitos tocam por cima da música. Ela fica mais baixa quando o Studoo fala e para enquanto você grava." No iPhone, vem mais uma linha: "No modo silencioso do iPhone, nenhum som do Studoo toca." (P24 da spec 07).

### Textos

Os textos da folha e do Perfil ficam no contrato (`packages/contratos/src/experiencia.ts`), iguais nos dois lados: "Música de fundo", "Lo-fi de Estudo, em laço", "Efeitos sonoros", "Toques, acertos, erros e conquistas", "Tocando", "Carregando…", "Começa no primeiro toque", "Pausada enquanto você grava" e o erro acima.
- O nome da faixa é **"Lo-fi de Estudo"**, como no arquivo escolhido pelo dono. Em 31bcaa5, `musicaFaixa` diz "Lo-fi de estúdio" e precisa ser corrigido.
- `OPCOES_FUNDO_UI` e as descrições dos cinco climas saem da tela.

## Como a música se comporta

- **Onde toca:** dentro do app, depois da entrada: abas, mapa, geração e aula. Não toca na entrada, na recuperação de senha nem nas páginas públicas `/t` e `/p`. Ao sair da conta, para; a escolha continua no aparelho.
- **Laço contínuo:** a música não recomeça ao trocar de tela, nem ao abrir uma lição; segue de onde estava.
- **Ligar:** sobe de 0 ao volume da música em 600 ms. **Desligar:** desce em 400 ms e para. A música nunca entra no volume cheio de uma vez.
- **Efeitos por cima (decisão do dono):** nenhum efeito para ou baixa a música; eles tocam por cima, no volume deles.
- **Studoo falando** (ler em voz alta, frases de inglês, acorde, som de referência da prática): a música desce a 20% em cerca de 0,4 s e volta em 0,6 s quando a fala acaba. Fala não é efeito; se o dono quiser a música sem baixar também aqui, muda só esta linha.
- **Para** durante a gravação do Explique e a voz ao vivo, com o app em segundo plano ou com a aba escondida. Ao voltar, recomeça subindo em 600 ms. Durante a gravação, os efeitos também se calam, menos o de fim de gravação, como o toca-sons já faz.
- **Começo:** nas três plataformas, a música começa no primeiro toque, clique ou tecla da pessoa dentro do app, depois da entrada, subindo em 600 ms. É a regra do navegador, e o app segue a mesma: abrir o Studoo nunca começa a tocar sozinho antes de um gesto.

## Como a pessoa descobre a música

- A música, ligada por padrão, começa no primeiro toque depois da entrada.
- **Aviso da primeira vez:** quando a música toca pela primeira vez no aparelho, aparece o aviso do app (spec 11) "Música de fundo ligada." com a ação "Desligar", que desliga a música na hora (`studoo.sons.avisoMusica`, no aparelho). Ele é a forma rápida de parar o som que tocou sem a pessoa pedir, e o leitor de tela também o anuncia. Não há tela, folha nem convite antes.
- Depois, o controle está no botão de som da aula e na seção "Som" do Perfil.

## Primeira vez

1. No primeiro acesso no aparelho, música e efeitos estão ligados. No primeiro toque depois da entrada, a música entra subindo em 600 ms, e o aviso "Música de fundo ligada." aparece com "Desligar". Na web, esse toque é o próprio gesto que libera o áudio.
2. O primeiro toque numa opção da aula já soa (`toque_opcao`), por cima da música.
3. Na primeira abertura da folha, as duas chaves estão ligadas e a linha da música diz "Tocando" (ou "Carregando…" até o som chegar).

## Movimento

- As barras de "Tocando" sobem e descem em 900 ms (ida e volta, `ease-in-out`), com 150 ms entre elas, só enquanto o som toca. Nada se move no alto da aula.
- **Movimento reduzido:** a folha só muda a opacidade (spec 11); as chaves trocam sem deslizar; as barras ficam paradas, em 6, 12 e 8 px, com a mesma palavra; "Carregando…" fica sem o giro. O som não muda: movimento reduzido não cala efeitos nem música, e as subidas e descidas de volume continuam.

## Leitor de tela e teclado

- **Botão da aula:** o nome da tabela acima; na web, `aria-haspopup="dialog"`. Abre a folha com o foco no título "Som".
- **Chaves:** na web, `role="switch"` com `aria-checked` e os rótulos "Música de fundo" e "Efeitos sonoros"; no app, `accessibilityRole="switch"` com `accessibilityState={{ checked }}`. O leitor diz "Música de fundo, ligada" ou "desligada", e "Efeitos sonoros, ligado" ou "desligado". O estado da música ("Tocando", "Carregando…", o erro) entra numa região `aria-live` educada; no app, `announceForAccessibility`.
- **Teclado:** Tab passa pelas duas chaves; espaço ou Enter alterna.
- **A música e o leitor de tela:** a música começa no primeiro toque também com o leitor ligado, e o aviso da primeira vez, com "Desligar", é anunciado logo depois. Ela fica a 60% do volume dela enquanto a folha "Som" está aberta, para o leitor ser ouvido.
- **Perfil:** as duas linhas têm as mesmas chaves da folha, com os mesmos nomes.

## Efeitos dos momentos novos (19/11)

Tabela fechada com os IDs já existentes em `packages/contratos/src/catalogo-sons.ts` (sem criar arquivos novos). O toca-sons aplica o `cooldownMs` de cada efeito; para não empilhar em sequências rápidas, os momentos abaixo seguem a regra de disparo da última coluna.

| Área | Momento | Efeito (`IdEfeitoSonoro`) | Vol. relativo | Regra para não empilhar / quando NÃO tocar |
|---|---|---|---|---|
| **Geração que se acompanha** (spec 04) | Cada lição nova, quando o nó pousa no mapa (o evento visível, não a chegada do pacote) | `geracao_licao` | `0.58` | No máximo um a cada `400 ms`; nunca depois da proposta pronta; não toca se a geração foi cancelada |
| **Geração que se acompanha** (spec 04) | Proposta pronta ("Proposta pronta: N lições em M partes.", o troféu entra) | nenhum | — | A trilha ainda não existe; o som de conclusão fica para o aceite |
| **Criar a trilha** (spec 04) | O aceite voltou: a trilha passou a existir, o nó 1 pulsa e vira a aula | `geracao_pronta` | `0.95` | O único som de conclusão do fluxo: uma vez por trilha criada, aquecido ao abrir a geração; não toca no erro nem se a pessoa saiu antes de o aceite voltar |
| **Geração que se acompanha** (spec 04) | Foco automático no botão "Começar a lição 1" | nenhum | — | Foco programático nunca dispara som |
| **Ordenar em lista única** (spec 08) | Escolher um item da lista | `toque_opcao` | `0.76` | Cooldown `45 ms` |
| **Ordenar em lista única** (spec 08) | Trocar dois itens de lugar (por toque ou seta) | `ordenar_soltar` | `0.63` | Cooldown `50 ms`; no segundo toque que efetiva a troca, toca só `ordenar_soltar` (não soma `toque_opcao`) |
| **Ordenar em lista única** (spec 08) | Arrastar e soltar um item | `ordenar_soltar` | `0.63` | Toca apenas ao soltar em uma **nova** posição; não toca se voltar ao mesmo lugar ou cancelar |
| **Ordenar em lista única** (spec 08) | "Voltar à ordem inicial" | `toque_opcao` | `0.76` | Um único disparo para a ação inteira (nunca um por item movido) |
| **Painel de retorno** (spec 13) | Reação animada do Stu junto com o retorno | nenhum | — | O efeito `acerto` (`0.90`) ou `erro` (`0.86`) já sonoriza o resultado; não sobrepor outro efeito |
| **Configurações da trilha** | "Capa salva." | `salvo` | `0.64` | Cooldown `300 ms` |
| **Configurações da trilha** | Salvar um campo ao sair/confirmar | `salvo` | `0.64` | Cooldown `300 ms`; só toca quando houve alteração salva (nunca em auto-save contínuo enquanto digita) |
| **Folha "Som"** | Ligar a música | nenhum SFX | — | A própria música entra subindo em `600 ms` |
| **Folha "Som"** | Ligar a chave "Efeitos sonoros" | `salvo` | `0.64` | Toca uma vez ao ligar; ao desligar, nenhum |

## Arquivos de som (produção)

Os arquivos finais e as decisões de composição estão em [som/PRODUCAO.md](../som/PRODUCAO.md): tema em Ré maior, 86 BPM, 32 compassos (89,30 s), cinco arranjos do mesmo tema, laço com a cauda dobrada no começo e efeitos com ataque em até 3,3 ms.

## Paridade

- A folha, a ordem, os textos, as medidas e o comportamento são os mesmos nas três plataformas, com os componentes da spec 11 e a chave do Studoo (nenhum seletor ou chave do sistema).
- O segundo plano vem do `AppState` no app e da aba escondida (`visibilitychange`) na web; a regra é a mesma: para e volta subindo.
- A única diferença que a plataforma obriga é a P24 (modo silencioso do iPhone), na spec 07.

## Decisões

**Do dono, 19/11:** só o Lo-fi de Estudo, em laço, no app inteiro, com os efeitos por cima, sem parar nem baixar a música (a escolha substitui os cinco climas).

**Do dono, fechadas em 19/11 (seguiu a recomendação do Designer):**
1. **Onde o fundo toca: no app inteiro, depois da entrada.** Não é configurável, e não toca na entrada nem antes dela. Cortar o som a cada troca de tela cansa.
2. **Modo silencioso do iPhone: os sons do Studoo respeitam** (`playsInSilentMode: false`, como o toca-sons já faz). Quem silencia o celular não espera o app tocando, e a P24 da spec 07 continua. Para a demonstração, o aparelho sai do silencioso antes.

**De design (revistas com a música única):** duas chaves independentes, na folha e no Perfil, sem lista, carrossel nem prévia; o aviso da primeira vez com "Desligar"; a música começa no primeiro toque também no app. De antes, continuam: a folha no lugar de um botão que alterna; sem controle de volume; os textos curtos das opções; o ponto de novidade no lugar de um convite.

## Conferência antes de apresentar

- iPhone fora do modo silencioso e com o volume de mídia alto.
- No navegador, um toque na tela antes de mostrar o som, porque nada toca antes do primeiro gesto.
