# Conferência nativa do app

O workflow `.github/workflows/capturas-nativas.yml` roda o Studoo num **simulador de iPhone**, numa máquina macOS do GitHub Actions, e num **emulador de Android**, numa máquina Ubuntu (os dois jobs em paralelo), e guarda as capturas das telas como artefato por 3 dias. É a única execução nativa do app que a equipe tem: a prévia web do app (o export web do Expo no navegador) não reproduz o layout nativo.

O que sai daqui vem de simulador e de emulador: no iPhone, o app servido pelo Metro dentro do Expo Go; no Android, o build de debug do projeto com o JavaScript do Metro (seção "Android", abaixo). **Não é aparelho de verdade**: toque, desempenho, modo silencioso, câmera e leitor de tela continuam sem conferência.

## Quando roda

- A cada envio para `feat/hackathon-integracao` que mexa em `apps/mobile/**`, em `packages/contratos/**` ou no próprio workflow.
- Na mão, pelo botão "Run workflow" (ele só aparece quando o arquivo do workflow existe no ramo padrão) ou por `gh workflow run capturas-nativas.yml --ref <ramo>`.

Ele é separado da verificação do PR: não é obrigatório e não entra na fila dela.

## De onde vêm os dados

Da API do próprio repositório, rodando na mesma máquina, com `IA=falsa`. Nenhum segredo e nada do site publicado.

1. `npm run db:local` sobe o PostgreSQL embutido, aplica as migrações e cria a conta sintética (`piloto@example.test`, com senha sorteada a cada execução).
2. `npm run build` e `npm start` servem a API. O app só aceita API em HTTPS, então `servidor/proxy-https.mjs` termina o TLS na porta 3443, com um certificado gerado na hora, e o simulador recebe a CA (`xcrun simctl keychain add-root-cert`). O servidor roda com `STUDOO_PROXY_HTTPS=1`, como o site atrás do proxy.
3. `npm run comunidade:demo` cria o conteúdo do Explorar.
4. `servidor/preparar-dados.mjs` entra pelo canal do app, com o cliente do contrato (`criarClienteStudoo`), preenche o perfil e cria **uma trilha por formato de exercício** a partir das demonstrações da IA simulada. Ele conclui lições pela API até a lição atual de cada trilha começar pelo formato pedido; as respostas certas vêm de `respostaCerta`, do domínio. Por isso o percurso na tela não responde exercício nenhum.

As opções da entrada ficam iguais às do site: sem Google, sem recuperação de senha e sem visitante; com compartilhar e comunidade.

## O percurso

Os fluxos são do [Maestro](https://docs.maestro.dev) e ficam em `fluxos/`. Eles acham os elementos pelo `testID` e pelo nome acessível.

| Fase | Arquivo | Capturas |
|---|---|---|
| Entrada, com o simulador como vem de fábrica | `01-entrada.yaml` | `01` em repouso, `02` e-mail em foco, `03` senha em foco com o teclado |
| Entrar na conta | `02-entrar.yaml` | `04` entrada preenchida, `05` o que abre depois de entrar |
| Criação de trilha, antes das telas | `criacao/90-criacao-da-trilha.yaml` | `90` o pedido com a primeira ideia, `91` em criação, `92` pronta, `93` a etapa 1 da primeira lição, aberta pelo "Começar" num toque só, e `94` o mapa da trilha ao voltar; o vídeo `criacao-transicao.mp4`, do toque em "Montar minha trilha" à etapa 1 |
| Telas | `telas/*.yaml` | `10` a `12` mapa (como abre e rolado sob a barra de baixo); `20` a `23` Minhas trilhas, menu "…" e confirmação de apagar (cancelada); `30` a `35` um exercício de cada formato, no estado inicial e rolado; `40` e `41` Explorar; `50` e `51` Perfil; `60` Configurações da trilha, com o toque na borda do "Voltar" (spec 04, §9); `80` a `83` (o primeiro fluxo das telas) a barra de baixo nas abas fixas: Nova trilha selecionada (`80`) e o fim dela (`81`), o fim de Minhas trilhas com a seleção de volta (`82`) e o mapa aberto por um toque perto da borda de baixo do último botão (`83`) |

A criação de trilha roda numa fase própria, logo antes das telas (`fluxo_criacao`, em `comum.sh`), para as provas dela saírem cedo: as capturas `90` a `94` e o vídeo vão para o artefato assim que a fase acaba, antes das telas, e sobrevivem a uma queda mais adiante. A IA é a simulada, e a conta é a sintética. No fim da fase, `servidor/apagar-trilhas-novas.mjs` apaga pela API a trilha criada, para as telas encontrarem as seis do preparo; entrar de novo pela API não derruba a sessão do app. Enquanto o fluxo roda, cada sistema grava o que o áudio registra (no iPhone, o log do simulador ao vivo, só do Expo Go e do áudio; no Android, o logcat com as etiquetas do áudio e do JavaScript), e `servidor/linha-do-tempo-som.mjs` junta isso aos carimbos dos comandos do Maestro em `linha-do-tempo-criacao.txt`, nos registros. A linha do tempo separa o comando (o gesto do Maestro), a reprodução (o que o sistema de áudio registrou) e a saída gravada, que não existe no CI: o simulador e o emulador não têm saída de áudio que se possa gravar (o emulador roda com `-noaudio`), e a latência física não é medida. O nome de cada som só aparece se o app registrar os sons que toca: o Metro roda com `EXPO_PUBLIC_STUDOO_REGISTRO_SOM=1`, e a linha do tempo lê `[som] comando <id> <ms>` e `[som] reproducao <id> <ms>` quando o app escrever isso no console.

Entre a primeira e a segunda fase, o preenchimento automático de senhas do simulador é desligado e o simulador reinicia: com ele ligado, o Maestro não consegue digitar num campo de senha (problema conhecido, com a receita na documentação dele). A captura do teclado vem antes disso, com o simulador intocado.

Cada fluxo de `telas/` fecha o Expo Go e abre o app de novo (`partes/reabrir.yaml`), então a falha de um não derruba o seguinte.

Entre o Expo Go e o Metro fica uma cache (`servidor/cache-do-metro.mjs`, na porta 8081; o Metro fica na 8082). A cada abertura, o Expo Go pede o pacote do app de novo, e o Metro o refazia a cada pedido (7 a 73 s com o bytecode do Hermes, disputando a CPU com o simulador); na execução 44511779137, um pedido passou do tempo do Expo Go e o fluxo 35 caiu na tela vermelha "Could not connect to development server". O código não muda durante a conferência: o primeiro pacote de cada endereço fica guardado e volta pronto. `EXPO_PACKAGER_PROXY_URL` faz o manifesto apontar para a cache. O sumário diz quantas aberturas usaram a cache (`cache-do-metro.log`). Os toques e os arrastos dos fluxos esperam a tela parar no máximo 1,5 s e 1 s (`waitToSettleTimeoutMs`): o mapa e a lição têm animações que não param, e a espera padrão do Maestro chegava a 18 s por toque.

O menu de desenvolvedor do Expo Go abre sozinho na primeira vez que um projeto carrega, com uma apresentação por cima, e depois deixa um botão flutuante (engrenagem azul) sobre o app. Com o menu aberto, a árvore de elementos só tem o Expo Go e nenhum id do app aparece (foi o que parou a primeira execução). O passo do simulador desliga a apresentação, a abertura automática e o botão nas preferências do Expo Go antes de ele abrir (o que ficou gravado está em `expo-go-preferencias.txt`). Se não pegar, toda abertura passa por `partes/sair-do-menu-do-expo-go.yaml`, que espera o app ou o menu, toca "Continue" e fecha o menu pelo "X" antes de esperar a tela do Studoo. Se o botão flutuante ficar sobre o app, a coleta avisa no sumário.

## Android

O job `android` segue a rota A1 de `docs/BUILD-ANDROID.md`, em `android.sh` (o que vale para os dois sistemas fica em `comum.sh`):

1. A mesma API, com a mesma CA gerada na hora.
2. `expo prebuild --platform android` com `STUDOO_ANDROID_PILOTO_CA` apontando para a CA: o plugin `plugins/with-android-piloto-ca.cjs` a põe só no build de debug, para 127.0.0.1 e localhost. `servidor/manifesto-android.mjs` põe no manifesto de debug os padrões do menu de desenvolvedor (apresentação vista, sem abrir sozinho, sem o botão flutuante), que o expo-dev-menu lê dos `meta-data`. Depois, o Gradle gera o APK de debug só para x86_64, com cache entre as execuções.
3. O Metro em modo de cliente de desenvolvimento (`--dev-client`), com a mesma cache na porta 8081.
4. O emulador (`ReactiveCircus/android-emulator-runner`, Android 15, API 35, google_apis x86_64, com KVM) só existe no passo dele, e ali roda `android.sh no-emulador`: tela de 1080 × 2340 a 480 dpi (360 × 780 dp, a largura dos pares de 360 da web), barra de status fixa no modo de demonstração, teclado da tela, sem preenchimento automático, o APK instalado e `adb reverse` da API (3443) e da cache do Metro (8081), para o app ver as duas em 127.0.0.1, como no iPhone. Depois, os três fluxos.
5. Os fluxos são os mesmos, numa cópia com `appId: com.studoo.mobile.dev` e o link `studoo-dev://expo-development-client/?url=…` no lugar dos do Expo Go. As capturas têm os mesmos nomes (`capturas-android`, `registros-android`). No fim do passo do emulador, ficam o fim do `logcat` e a tela do emulador nos registros.

Animações ligadas, como no iPhone. Não conferido: aparelho de verdade, o volume e o modo silencioso, câmera, leitor de tela.

## Como ler o resultado

- **Sumário da execução**: a máquina e o simulador usados, as trilhas da conta sintética, a tabela das capturas (a que faltou aparece como "faltou") e, numa linha, o que falhou.
- **Artefato `capturas-iphone`**: os PNGs, com o número na frente do nome, e `ORIGEM.txt` (aparelho, iOS, Expo Go, Maestro, commit e execução): é simulador, não aparelho. O `ORIGEM.txt` (e a seção "Barra de baixo" do sumário) separa dois estados do material da barra de baixo. O **calculado** é uma estimativa feita pelas preferências do aparelho: no iPhone, se o vidro existe (a conta de `isLiquidGlassAvailable`: Xcode e SDK com que o Expo Go foi feito, iOS e `UIDesignRequiresCompatibility`), "Reduzir transparência" e o tamanho do texto; no Android, a superfície opaca e o `font_scale`. Cada dado lido tem três estados: lido, ausente de fato (vale o padrão) ou desconhecido (a leitura falhou), e o desconhecido nunca vira "desligada" nem "indisponível". O **observado** é o que o app desenhou: o fluxo 80 procura o `testID` da View por fora da barra (`barra-material-vidro` ou `barra-material-opaca`, conforme o ramo que desenhou) e guarda uma imagem com o nome do que achou (`material-observado-vidro.png` ou `-opaca.png`, no artefato das capturas). Uma captura sozinha não separa o vidro de uma cor: junto do observado, compare a barra sobre fundos diferentes (o mapa nas capturas 10 a 12).
- **Artefato `registros-iphone`**: o registro de cada programa (`banco.log`, `build.log`, `servidor.log`, `proxy.log`, `metro.log`, `maestro-<fase>.log`), a tela do simulador no fim de cada fase (`tela-no-fim-de-<fase>.png`), a saída do Maestro (com a tela e a árvore de elementos do passo que falhou), o registro do Expo Go no simulador (`simulador-expo-go.log`) e os dados da conta sintética. Sem o `.env` e sem chaves; a senha sorteada sai dos arquivos antes do envio, e o sumário diz se a conferência final achou alguma. Do registro inteiro do simulador que o Maestro grava em cada fluxo (perto de 200 MB) fica só o fim (`device-simulator-fim.log`).
- **Uma conferência por vez**: um envio novo espera a que está rodando terminar (cancelada no meio, ela não deixaria capturas).

## Como mexer

- **Tela nova**: um arquivo em `fluxos/telas/`, começando por `- runFlow: ../partes/reabrir.yaml`, com o nome na ordem de `fluxos/telas/config.yaml` e as capturas na lista `CAPTURAS_ESPERADAS` de `comum.sh` (a mesma para o iPhone e o Android).
- **Uma espera logo depois de outra**: o Maestro desconta de cada espera pelo que está na tela, mesmo com `timeout`, o tempo passado desde o último toque, e outra espera não conta como toque. Depois de uma espera longa, ponha `- evalScript: ${output.<nome> = true}` antes da seguinte, como em `partes/reabrir.yaml`: o `evalScript` conta como interação e não toca no aparelho. Sem isso, o fluxo 70 da execução 44565509060 ficou com 6 s dos 45 da espera do mapa.
- **Mudou um `testID` ou um nome acessível**: o fluxo que usa o seletor precisa mudar junto. `node apps/mobile/conferencia-nativa/conferir-fluxos.mjs` confere, sem simulador, se todo `id` dos fluxos ainda existe como `testID` no app, se as capturas batem com a lista de `comum.sh` e se a ordem de `telas/config.yaml` está completa; é o primeiro passo do workflow. Um nome acessível que mudou só aparece na execução: o passo do Maestro diz qual comando não achou o elemento.
- **Versões fixadas** (no topo do workflow): o Expo Go de simulador e o Maestro, com sha256; as ações do GitHub, pelo commit. Ao subir o SDK do Expo no app, troque o endereço e o sha256 do Expo Go juntos.
- **Outro aparelho ou outro iOS**: as entradas `aparelho` e `ios` do disparo manual. Se o iOS pedido não existir na máquina, a conferência segue no mais novo que houver e avisa.

`ios.sh` e `android.sh` têm um subcomando por passo do workflow; o que os dois fazem igual está em `comum.sh`, que roda no bash 3.2 do macOS e no do Ubuntu. `preparar-dados.mjs` só aceita a API do próprio computador e conta em domínio `.test`.
