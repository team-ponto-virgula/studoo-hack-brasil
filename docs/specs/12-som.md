# Som: efeitos e música de fundo

**Estado:** regra de design de 19/11, pedido 6 do Lead, a pedido do dono ("SFX vivos" e som de fundo com cinco opções ou mudo). Vale para web, Android e iPhone. O catálogo e o toca-sons já estão na integração (`packages/contratos/src/catalogo-sons.ts`, `src/app/sons.ts`, `apps/mobile/src/sons.ts`); esta spec diz onde a pessoa controla o som, o que a tela mostra em cada estado e como o som se comporta. Esboço: `som-390.png`, na pasta de trabalho do Designer (`ux/06-controle-de-som`).

**Revisão do dono (19/11): uma música só.** O fundo passa a ser só o Lo-fi de Estudo (`lofi_estudo`: `public/sons/fundos/lofi-estudo.mp3` e `apps/mobile/assets/sons/fundos/lofi-estudo.mp3`, na versão de d5bf5aa, com o laço que começa no compasso 1), em laço no app inteiro: já na entrada, na recuperação de senha e no modo visitante, sem recomeçar ao entrar ou sair da conta. Os efeitos tocam por cima, no volume constante deles, sem parar e sem baixar a música. Saem os outros quatro climas, a lista de escolha, a prévia e o ponto de novidade: a pessoa controla música e efeitos com duas chaves independentes, na folha "Som" e no Perfil, sem tela nova. A regra final, com o arquivo aprovado e o que ainda sobra no repositório, está em [Regra final: uma faixa só](#regra-final-uma-faixa-só-ordem-do-dono-2011). Esta spec já está escrita assim; onde algo de antes mudou, está dito.

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
3. **Entrada e recuperação de senha:** o mesmo botão de som (44 × 44) no alto, à direita da barra da marca, abre a mesma folha. É o controle de quem ainda não entrou: a música também toca ali, e precisa de um jeito de parar.

Nas outras telas, o controle fica no Perfil.

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

Os textos da folha e do Perfil ficam no contrato (`packages/contratos/src/experiencia.ts`, em `som`, desde 59cfe8d: `musicaFaixa`, `musicaEmLaco`, `musicaComeca`, `musicaPausada`, `musicaErro`, `musicaAviso`, `desligarMusica`, `rodapeMusica` e `botaoMusicaRotulo`), iguais nos dois lados: "Música de fundo", "Lo-fi de Estudo, em laço", "Efeitos sonoros", "Toques, acertos, erros e conquistas", "Tocando", "Carregando…", "Começa no primeiro toque", "Pausada enquanto você grava" e o erro acima.
- O nome da faixa é **"Lo-fi de Estudo"**, como no arquivo escolhido pelo dono. O "Lo-fi de estúdio" de 31bcaa5 foi corrigido em 59cfe8d.
- A lista `OPCOES_FUNDO_UI` e as descrições dos outros quatro climas saem da tela e do contrato (ver [O que sai](#o-que-sai-e-quem-remove)).

## Regra final: uma faixa só (ordem do dono, 20/11)

"O som de fundo, eu quero só aquele lá que eu aprovei, que é o 06. Não quero que tenha para escolher som de fundo, que aqui só tenha como mutar ou ficar tocando aquele." Vale para web, Android e iPhone. Não há escolha de música em lugar nenhum: nem na folha "Som", nem no Perfil, nem por endereço, nem por preferência antiga.

- **O arquivo:** o `06-Lo-fi-de-Estudo-final.mp3` do dono, 893.954 bytes, SHA-256 `9b1e28811362b3e1f8873162ce90abaf7a12ecc5f68f4791896bb1cb67bcb17f`, 89,3283 s decodificados (89328 ms no catálogo, `lofi_estudo`, volume `0.24`). As duas cópias servidas — `public/sons/fundos/lofi-estudo.mp3` (web) e `apps/mobile/assets/sons/fundos/lofi-estudo.mp3` (app) — são byte a byte o arquivo do dono: mesmo SHA-256, conferido em 20/11 na candidata 9d28103 (medida em [Conferência da faixa](#conferência-da-faixa-2011)).
- **Ligar ou desligar:** a chave "Música de fundo" liga e desliga essa faixa. Ligada, toca o 06 em laço; desligada, nada toca. Não existe estado intermediário nem segunda faixa.
- **Preferência antiga:** só o valor `mudo` sobrevive; qualquer outro (`foco_calmo`, `chuva_suave`, `biblioteca`, `brisa_natural` ou lixo) vira `lofi_estudo` na leitura, por `fundoUnicoDaPreferencia`. Quem tinha escolhido "chuva" passa a ouvir o Lo-fi; quem tinha Mudo continua em silêncio. A web regrava o valor guardado; o app normaliza a cada leitura.
- **Nenhum caminho para outra faixa:** os players só conhecem o `lofi_estudo` (`FONTES_FUNDOS` com uma entrada no app; na web, `CATALOGO_FUNDOS.find(faixa => faixa.id === 'lofi_estudo')`), e as folhas só têm as duas chaves. Enquanto as sobras abaixo existirem, porém, o site publicado continua servindo os quatro MP3 antigos por endereço direto (por exemplo `/sons/fundos/chuva-suave.mp3`) e o catálogo continua aceitando os cinco IDs: por isso elas saem.

## O que sai (e quem remove)

| Sobra hoje na candidata 9d28103 | Onde está | Quem remove |
|---|---|---|
| `foco-calmo.mp3`, `chuva-suave.mp3`, `biblioteca.mp3`, `brisa-natural.mp3` — 893.954 bytes cada, **3,4 MiB** no total | `public/sons/fundos/` | **Web & API** |
| Os mesmos quatro na pasta de assets do app — outros **3,4 MiB** no repositório (o Metro só empacota o que tem `require`, então hoje eles não entram no binário; ficam de peso e de armadilha para quem voltar a listar os climas) | `apps/mobile/assets/sons/fundos/` | **Mobile 2** |
| `IdSomFundo` com os cinco climas (fica `'mudo' \| 'lofi_estudo'`); `CATALOGO_FUNDOS` com cinco entradas (fica só o `lofi_estudo`, com laço e volume); `DESCRICOES_CURTAS_FUNDO` com cinco; `OPCOES_FUNDO_UI` sai inteira | `packages/contratos/src/catalogo-sons.ts` | **Web & API** |
| Textos da escolha, sem uso desde a folha nova: `fundoTitulo`, `fundoDica`, `linhaRotulo`, `linhaTocando`, `linhaErro`, `anuncioEscolhido`, `anuncioMudo`, `botaoRotulo` (o que recebe `clima`) e `perfilFundoRotulo`; dois textos que ninguém usa mais, `rodape` e `erro`; e o comentário que cita `OPCOES_FUNDO_UI` | `packages/contratos/src/experiencia.ts`, em `som` e na linha 453 | **Web & API** |
| Testes que fixam os cinco: a contagem de arquivos nas duas pastas e `OPCOES_FUNDO_UI.length === 6` (e o import de `OPCOES_FUNDO_UI`) | `tests/sons.test.mjs` | **Web & API** (teste do contrato; o app só lê) |

O que fica: `lofi-estudo.mp3` nas duas pastas; o `lofi_estudo` no catálogo, com `duracaoMs` 89328, `aparoInicioSeg` 0,026 e volume `0.24`; `fundoUnicoDaPreferencia`; os textos da música (`titulo`, `musicaTitulo`, `musicaFaixa`, `musicaEmLaco`, `musicaComeca`, `musicaPausada`, `musicaErro`, `musicaAviso`, `desligarMusica`, `rodapeMusica`, `rodapeIphone`, `botaoMusicaRotulo`, `tocando`, `carregando`, `efeitosTitulo`, `efeitosDica`, `efeitosDicaPerfil`, `fechar`); e os dois players, que já só usam a faixa. Os quatro arranjos continuam como fonte de produção, fora do repositório (`scripts/som/gerar-trilha.py --todos`), desde 0e99406 — o gerador sem `--todos` já grava só o Lo-fi; e o `apps/mobile` não tem `assetBundlePatterns`, então nada entra no app sem um `require`.

Ordem: o contrato primeiro (Web & API), depois os arquivos e os testes de cada lado, numa passada só; nenhuma tela muda, porque as duas folhas já têm só as duas chaves.

### Conferência da faixa (20/11)

- **Comparação:** SHA-256 igual nos cinco arquivos comparados — o do dono (`06-Lo-fi-de-Estudo-final.mp3`, em duas cópias recebidas) e as cópias da web, do app e do ramo `feat/som-musica` (`d5bf5aa`). Sem escuta: a máquina não tem saída de áudio. A duração decodificada é 89,3283 s; o compasso 1 começa em 0,030 s, depois dos 26 ms de pré-rolo copiados do fim.
- **Emenda na web** (`loopStart` 0,026 s, `loopEnd` = duração, MP3 decodificado no Chromium): trecho de 89,3023 s; 42 amostras de música puladas (0,95 ms); degrau de 0,68× o passo típico do próprio arquivo; nível de −35,5 a −15,3 dBFS na virada. Sem estalo, e o compasso 1 cai no `loopStart`, sem perder o ataque.
- **Emenda no app** (dois reprodutores com cruzamento de 150 ms em 5 passos de 30 ms antes do fim; o que entra começa em 0,026 s e o que sai volta a 0,026 s): com o mesmo arquivo, o cruzamento de ganho linear mede degrau de 0,53× o passo típico, RMS de −24,4 dBFS no meio (cauda −34,3, cabeça −17,5) e pico de 0,217 (a cabeça sozinha chega a 0,485): sem buraco, sem estalo e sem estouro.
- **Limites:** medida digital, não é teste de alto-falante nem de aparelho físico; Firefox e Safari não foram medidos (o pré-rolo cobre o atraso de codificador que eles mantêm).

## Como a música se comporta

- **Onde toca:** no app inteiro: entrada, recuperação de senha, modo visitante, abas, mapa, geração e aula, e também as páginas públicas da web (`/t` e `/p`) quando a pessoa chega nelas navegando no Studoo (o player da web vive no layout comum a essas páginas, desde bd0757f). Ao entrar e ao sair da conta, ela continua. Um link aberto numa aba nova começa como um carregamento novo: a música espera o primeiro gesto (P26 da spec 07). As imagens de compartilhamento (prévia do link) não têm som.
- **Laço contínuo:** a música não recomeça ao trocar de tela, ao abrir uma lição nem ao entrar ou sair da conta; segue de onde estava.
- **Ligar:** sobe de 0 ao volume da música em 600 ms. **Desligar:** desce em 400 ms e para. A música nunca entra no volume cheio de uma vez.
- **Efeitos por cima (decisão do dono):** nenhum efeito para ou baixa a música. Eles tocam por cima, no volume constante deles: a música não muda o volume dos efeitos, e os efeitos não mudam o da música.
- **Studoo falando** (ler em voz alta, frases de inglês, acorde, som de referência da prática): a música desce a 20% em cerca de 0,4 s e volta em 0,6 s quando a fala acaba. É o comportamento de hoje e continua: fala e gravação são casos separados da decisão sobre os efeitos.
- **Para** durante a gravação do Explique e a voz ao vivo, com o app em segundo plano ou com a aba escondida. Ao voltar, recomeça subindo em 600 ms. Durante a gravação, os efeitos também se calam, menos o de fim de gravação, como o toca-sons já faz.
- **Começo:** a música começa no primeiro gesto que a plataforma permite (toque, clique ou tecla), já na tela de entrada, subindo em 600 ms; no app também, desde o login. Abrir o Studoo nunca começa a tocar antes de um gesto. Na web, depois de recarregar a página inteira, o navegador exige um novo gesto antes de voltar a tocar (P26 da spec 07); trocar de tela sem recarregar não exige.

## Como a pessoa descobre a música

- A música, ligada por padrão, começa no primeiro gesto, já na tela de entrada.
- **Aviso da primeira vez:** quando a música toca pela primeira vez no aparelho, aparece o aviso do app (spec 11) "Música de fundo ligada.", com a ação "Desligar", que desliga na hora (`musicaAviso` e `desligarMusica`; guardado em `studoo.sons.avisoMusica`). Ele é discreto e aparece uma vez por aparelho: uma linha de 48 px, que não leva o foco, não bloqueia toques fora dele e some sozinha em 7 s. Na entrada e na recuperação, ele fica no alto, 8 px abaixo da barra da marca, para não cobrir o formulário; nas outras telas, fica no lugar de sempre, 16 px acima da cápsula ou da borda. O leitor de tela o anuncia. Não há tela, folha nem convite antes.
- Depois, o controle está no botão de som da aula, no botão de som da entrada e da recuperação e na seção "Som" do Perfil.

## Primeira vez

1. No primeiro acesso no aparelho, música e efeitos estão ligados. No primeiro gesto, já na tela de entrada, a música entra subindo em 600 ms, e o aviso "Música de fundo ligada." aparece com "Desligar". Na web, esse toque é o próprio gesto que libera o áudio.
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
| **Geração que se acompanha** (spec 04) | Trilha pronta ("Sua trilha está pronta: N lições curtas em M partes.", o troféu entra) | nenhum | — | A trilha ainda não existe; o som de conclusão fica para o aceite |
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

**Do dono, 19/11:** só o Lo-fi de Estudo, em laço, no app inteiro (também na entrada, na recuperação de senha e no visitante, sem recomeçar ao entrar ou sair da conta), com os efeitos por cima, no volume constante deles, sem parar nem baixar a música. A escolha substitui os cinco climas.

**Do dono, fechadas em 19/11 (seguiu a recomendação do Designer):**
1. **Onde o fundo toca: no app inteiro, depois da entrada.** Não é configurável, e não toca na entrada nem antes dela. Cortar o som a cada troca de tela cansa.
2. **Modo silencioso do iPhone: os sons do Studoo respeitam** (`playsInSilentMode: false`, como o toca-sons já faz). Quem silencia o celular não espera o app tocando, e a P24 da spec 07 continua. Para a demonstração, o aparelho sai do silencioso antes.

**De design (revistas com a música única):** duas chaves independentes, na folha e no Perfil, sem lista, carrossel nem prévia; o aviso discreto da primeira vez, com "Desligar"; o botão de som também na entrada e na recuperação; a música começa no primeiro gesto também no app. De antes, continuam: a folha no lugar de um botão que alterna; sem controle de volume; os textos curtos das opções; o ponto de novidade no lugar de um convite.

## Conferência antes de apresentar

- iPhone fora do modo silencioso e com o volume de mídia alto.
- No navegador, um toque na tela antes de mostrar o som, porque nada toca antes do primeiro gesto.
