# Rodar o Studoo localmente

## Web

Use Node.js 24 ou mais recente. Execute os comandos na raiz do repositório.

```sh
npm ci
npm run db:local
```

Na primeira execução, o bootstrap cria `.env`, inicia o PostgreSQL em `127.0.0.1:55432`, aplica as migrações e provisiona uma conta de demonstração. O banco e as credenciais ficam no seu ambiente local. Use `STUDOO_EMAIL` e `STUDOO_SENHA` do `.env` para entrar e mantenha `IA=falsa` e `EMAIL=falso`.

Deixe o banco rodando. Em outro terminal, na raiz, execute `npm run dev` e abra [o Studoo local](http://localhost:3000). Para checar o build web com o ambiente do bootstrap, execute `npm run build`. Para iniciar o build, execute `npm start`.

## IA falsa e teto de gerações

Com `IA=falsa`, a geração não chama nenhum serviço externo. Objetivos de SQL devolvem o plano de demonstração, de 5 lições numa sequência única. Qualquer outro objetivo gera uma trilha simulada e determinística de 3 trechos com 3 lições, na ordem de aprendizado e com uma revisão. Três variáveis opcionais ajustam o comportamento. Sem elas, valem os padrões abaixo.

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `STUDOO_IA_FALSA_PAUSA_MS` | `450` | Pausa entre os eventos da rota ao vivo, para a tela mostrar a trilha se formando. Use `0` para desligar. |
| `STUDOO_LIMITE_GERACOES` | `20` | Gerações permitidas por pessoa em cada janela. Teto provisório, em memória do processo; o teto definitivo é a D7. |
| `STUDOO_JANELA_GERACOES_MIN` | `60` | Tamanho da janela do teto, em minutos. |

## IA da OpenAI

Com `IA=openai`, a [Responses API](https://developers.openai.com/api/docs/models/gpt-6-luna) usa `gpt-6-luna` e `reasoning.effort=max` em todos os pedidos de texto e imagem. A seleção antiga ou ausente de provedor resolve para OpenAI. Só `IA=falsa` ativa a demonstração. Falhas da OpenAI avisam que a geração está indisponível. A configuração antiga de modelo, esforço e reserva não altera esses pedidos.

O `npm run db:local` prepara um ambiente determinístico. Para testar a OpenAI, defina `IA=openai` e `OPENAI_API_KEY` em seu ambiente local (ou `.env.local`, fora do Git). A chave fica no servidor. Use `OPENAI_BASE_URL` com um servidor HTTP em loopback para testes simulados. Com a API oficial, o endereço padrão é `https://api.openai.com/v1`.

- `IA=openai npm run ia:conferir -- --triagem` confere duas recusas e uma permissão com objetivos sintéticos e sem banco.
- `IA=openai npm run ia:conferir` monta e confere uma estrutura e sua primeira lição. Os comandos fazem chamadas à API na configuração real e imprimem apenas o resultado.
- `OPENAI_MODELO_TRANSCRICAO` (`gpt-transcribe`) e `OPENAI_REALTIME_MODELO` (`gpt-realtime-2.1`) continuam exclusivos de áudio.

### Segurança e consentimento

A versão de consentimento para OpenAI inclui triagem de segurança dos objetivos e materiais. O servidor confere o pedido antes de gerar e o conteúdo produzido antes de expor ou salvar. A recusa `conteudo_nocivo` permite revisar o tema. A ausência de um veredito válido devolve `ia_indisponivel`. Estudos de história, direito e prevenção podem seguir quando não ensinam a prática de dano ou crime. O modo de demonstração tem filtro local de pedidos explícitos e usa conteúdo determinístico.

O servidor mantém a cota antes das chamadas, envia `store: false` na Responses API e não registra o conteúdo das verificações. A estrutura real é liberada via NDJSON depois da revisão. Cada lição tem até 80 s (95 s em matemática). O aceite reserva até 165 s por onda de lições, com teto de 240 s para gerar e revisar e até 25 s em cada uma das duas verificações de segurança. Limites de taxa 429 da geração podem ser repetidos até duas vezes sob o mesmo prazo. Em contas com limite baixo por minuto, configure `STUDOO_GERACAO_PARALELA` entre 1 e 2 (intervalo aceito: 1 a 10).

## Testes

```sh
npm run typecheck
npm run typecheck --workspace apps/mobile
npm run test:dominio
npm run test:paridade
npm run test:movimento
npm run test:ia
npm run test:marco
npm run test:trilha
```

`test:dominio` não precisa de servidor: verifica o gerador falso, o teto de gerações e o token da proposta. `test:paridade` também não: confere que os desenhos do mundo da trilha, as ideias do pedido, os passos da apresentação e os textos da tela que escreve as lições são os mesmos na web e no app. `test:ia` confere a Responses API da OpenAI com servidores locais simulados: estrutura, conteúdo, triagem e falhas, sem chave real. Os testes web usam o banco local e o servidor em `http://localhost:3000`. Eles criam contas sintéticas temporárias. `test:marco` verifica acesso, aceite da proposta, feedback, conclusão e retomada do plano. `test:trilha` verifica a rota ao vivo: NDJSON válido, ordem dos eventos, cancelamento, aceite e as lições de uma trilha genérica. Ele também roda o percurso do site publicado (`scripts/verificar-publicado.mjs`, usado pelo agendamento `studoo-verificar` com `node scripts/verificar-publicado.mjs`) contra o servidor local, com cada tipo de exercício forçado como o primeiro da lição. Inicie o servidor com `STUDOO_IA_FALSA_PAUSA_MS=0` para os testes rodarem sem esperar as pausas.

O GitHub Actions roda a mesma verificação em cada PR e em cada push para `development` e `main` (`.github/workflows/verificacao.yml`): os dois typechecks, `test:dominio`, `test:paridade`, `test:movimento`, `test:ia`, o build e, com um PostgreSQL de serviço, `test:marco` e `test:trilha`. O CI usa só os adaptadores falsos e credenciais geradas na hora.

## App Android em modo de desenvolvimento

Para levar o app ao celular da demo (build de desenvolvimento do EAS ou APK falando com o site publicado), veja [Build Android para a demo](BUILD-ANDROID.md).

Use um emulador iniciado, um JDK e o SDK Android configurados para o Expo. Tenha `adb` no PATH e OpenSSL 3 disponível. Mantenha o banco local ativo. Para rodar web e API móvel ao mesmo tempo, use o build web em `http://localhost:3000` com `npm run build` e `npm start`. A API móvel roda em outro processo, em `https://127.0.0.1:3443`.

### Certificado local

Crie a pasta `.studoo-local/tls` a partir da raiz. Em um shell POSIX, use `mkdir -p .studoo-local/tls`. No PowerShell, use `New-Item -ItemType Directory -Force .studoo-local/tls`.

Gere uma autoridade certificadora (CA) local e use-a para assinar o certificado de loopback.

```sh
openssl req -x509 -newkey rsa:2048 -sha256 -days 7 -noenc -subj "/CN=Studoo Local CA" -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" -keyout .studoo-local/tls/ca.key -out .studoo-local/tls/ca.crt
openssl req -new -newkey rsa:2048 -noenc -subj "/CN=127.0.0.1" -addext "subjectAltName=IP:127.0.0.1,DNS:localhost" -addext "basicConstraints=critical,CA:FALSE" -addext "keyUsage=critical,digitalSignature,keyEncipherment" -addext "extendedKeyUsage=serverAuth" -keyout .studoo-local/tls/local.key -out .studoo-local/tls/local.csr
openssl x509 -req -sha256 -days 7 -copy_extensions copy -in .studoo-local/tls/local.csr -CA .studoo-local/tls/ca.crt -CAkey .studoo-local/tls/ca.key -CAcreateserial -out .studoo-local/tls/local.crt
```

### API móvel

Em um terminal reservado à API HTTPS, defina `STUDOO_SESSAO_MOBILE_PILOTO=1` e `STUDOO_ORIGEM=https://127.0.0.1:3443`.

```sh
export STUDOO_SESSAO_MOBILE_PILOTO=1
export STUDOO_ORIGEM=https://127.0.0.1:3443
```

Para o PowerShell, use esta sintaxe.

```powershell
$env:STUDOO_SESSAO_MOBILE_PILOTO = '1'
$env:STUDOO_ORIGEM = 'https://127.0.0.1:3443'
```

Inicie o servidor nesse terminal.

```sh
npm exec -- next dev --hostname 127.0.0.1 --port 3443 --experimental-https --experimental-https-key .studoo-local/tls/local.key --experimental-https-cert .studoo-local/tls/local.crt --experimental-https-ca .studoo-local/tls/ca.crt
```

### Build de desenvolvimento

Em outro terminal, copie `apps/mobile/.env.example` para `apps/mobile/.env.local`. A variável `EXPO_PUBLIC_STUDOO_API_URL` indica apenas o endereço HTTPS da API. Aponte `STUDOO_ANDROID_PILOTO_CA` para o **certificado público** da CA.

```sh
cp apps/mobile/.env.example apps/mobile/.env.local
export STUDOO_ANDROID_PILOTO_CA="$PWD/.studoo-local/tls/ca.crt"
```

No PowerShell, copie o arquivo e defina o caminho da CA.

```powershell
Copy-Item apps/mobile/.env.example apps/mobile/.env.local
$env:STUDOO_ANDROID_PILOTO_CA = (Resolve-Path .studoo-local/tls/ca.crt).Path
```

Com o emulador aberto, prepare e instale o app.

```sh
adb reverse tcp:3443 tcp:3443
adb reverse tcp:8083 tcp:8083
npm exec --workspace apps/mobile -- expo prebuild --platform android --no-install
npm run android --workspace apps/mobile -- --port 8083
```

O plugin Expo inclui a CA somente no build Android de debug para as conexões de loopback. Entre com a conta sintética criada pelo bootstrap. O app obtém o token pelo login HTTPS e o guarda no SecureStore. Se a compilação nativa encontrar o limite de caminho do Windows, tente um checkout com caminho mais curto.

### Teste de integração da sessão móvel

Com web, banco e API HTTPS ativos, defina `NODE_EXTRA_CA_CERTS` para o certificado público da CA local e rode `npm run test:mobile`. O teste verifica a entrada, a validade de oito horas e a saída da sessão móvel. Também confirma que a web lê o progresso registrado pelo cliente nativo.

```sh
NODE_EXTRA_CA_CERTS="$PWD/.studoo-local/tls/ca.crt" npm run test:mobile
```

No PowerShell, defina a variável antes de executar o teste.

```powershell
$env:NODE_EXTRA_CA_CERTS = (Resolve-Path .studoo-local/tls/ca.crt).Path
npm run test:mobile
```

`test:movimento` verifica o controle compartilhado de animações do app com eventos nativos simulados: segundo plano, preferência de acessibilidade, limpeza das assinaturas e falha da consulta. Não precisa de servidor ou emulador.

## Google e recuperação de senha

O login Google e o fluxo **Esqueci minha senha** estão disponíveis na web e no Android. Consulte a [configuração completa de acesso](specs/06-acesso-google-recuperacao.md) para cadastrar o callback Google, configurar Resend e reconstruir o app. Os campos estão nos `.env.example` da raiz e do app.

Localmente, `EMAIL=falso` grava o código de recuperação em `.studoo-local/emails/`, somente para origem loopback. `npm run test:acesso` testa os fluxos com o banco migrado, sem Google ou Resend externos; `npm run test:google-mobile` testa o retorno ao app com módulos nativos simulados.

## Experimentar sem conta (`STUDOO_VISITANTE=1`)

Atrás de proxy reverso (ex.: Traefik/Dokploy), `STUDOO_VISITANTE=1` exige `STUDOO_PROXY_HTTPS=1` para identificar o endereço real (`x-forwarded-for` / `x-real-ip`); sem isso, todas as requisições compartilham o mesmo balde `loopback`. Os limites por endereço (`STUDOO_LIMITE_VISITANTES_IP`), janela (`STUDOO_JANELA_VISITANTES_MIN`), teto global (`STUDOO_LIMITE_VISITANTES_GLOBAL`), cota de gerações por visitante (`STUDOO_LIMITE_GERACOES_VISITANTE`) e teto diário de gerações de visitantes (`STUDOO_LIMITE_GERACOES_VISITANTES_DIA`) estão documentados em `.env.example`.


## Página de apresentação na raiz (`STUDOO_ENTRADA_APRESENTACAO=1`)

A página de apresentação (`/conheca`, spec 18) e o redirecionamento de aparelhos (`/baixar`) ficam sempre no ar. Em produção, `hellostudoo.com.br` e `www.hellostudoo.com.br` abrem a apresentação. `app.hellostudoo.com.br` abre o app com sessão ou o login. Cada endereço do app mantém suas próprias sessões. O endereço anterior do Dokploy continua sendo a `STUDOO_ORIGEM` usada pelos aplicativos já instalados e pelo retorno do Google.

No endereço anterior e no ambiente local, a variável `STUDOO_ENTRADA_APRESENTACAO` controla a raiz para quem chega sem sessão. O servidor lê a variável a cada pedido.

| Variável | `/` sem sessão | `/` com sessão (visitante incluído) |
|---|---|---|
| `STUDOO_ENTRADA_APRESENTACAO=1` | a página de apresentação, no próprio `/` | o app |
| ausente (o padrão) ou qualquer outro valor | vai ao `/login` (307), como era antes da página | o app |

Quem decide é o cookie de sessão (o mesmo formato da API), sem ir ao banco. Atrás de proxy HTTPS (Traefik/Dokploy) nada depende de `X-Forwarded-Proto` nem do `Host`: a raiz nunca é reescrita pelo proxy do Next. O QR do cartão usa `STUDOO_ORIGEM` (HTTPS público) e o botão do Android, `STUDOO_APK_URL` (padrão: o APK do build 4); com `STUDOO_TESTFLIGHT_URL` o iPhone instala pelo TestFlight, e sem ela a página diz que o app para iPhone chega em breve.

Para conferir os dois estados num site de produção (numa cópia, para não apagar o `.next` do `next dev`): `node scripts/qa/raiz-atras-de-proxy.mjs --base=http://127.0.0.1:3000 --entrada=1` (e `--entrada=0` com a variável desligada). Veja `scripts/qa/LEIA-ME.md`.
