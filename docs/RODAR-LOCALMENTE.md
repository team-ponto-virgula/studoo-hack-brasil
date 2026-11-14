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

Com `IA=openai`, a [Responses API](https://platform.openai.com/docs/api-reference/responses) da OpenAI escreve a trilha e as lições. A estrutura chega por streaming, então a trilha nasce na tela enquanto o modelo escreve. O conteúdo de cada lição é escrito no **Começar**, com Structured Outputs (JSON Schema estrito), e passa pela mesma validação da IA falsa. O pedido leva só o objetivo e os títulos da trilha, nunca dados da conta. A chave fica só no servidor; o app usa a IA pelo servidor, sem configuração própria.

O `npm run db:local` exige `IA=falsa` no `.env`. Para ligar a OpenAI, crie um `.env.local` na raiz. Ele fica fora do Git e vale por cima do `.env`.

```sh
IA=openai
OPENAI_API_KEY=sua-chave
```

Para conferir a chave antes de abrir o Studoo, rode `npm run ia:conferir` (ou `npm run ia:conferir -- "seu objetivo"`). O comando usa o mesmo adaptador do servidor: mostra a trilha chegando por streaming, escreve a primeira lição e diz se tudo veio no formato do Studoo, sem gravar nada no banco. Se falhar, a linha `ia-openai` mostra o status da OpenAI (por exemplo, 401 para chave inválida e 404 para modelo inexistente).

Depois, reinicie o `npm run dev`. Na trilha gerada, a origem passa a mostrar "IA da OpenAI" e o modelo.

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `OPENAI_API_KEY` | (nenhum) | Chave da API. Sem ela, vale a reserva. |
| `OPENAI_MODELO` | `gpt-5.6-luna` | Modelo da Responses API. O padrão é o de menor custo e latência. |
| `OPENAI_ESFORCO` | `low` nos modelos de raciocínio | Esforço de raciocínio (`reasoning.effort`). Vazio tira o campo do pedido. Se o modelo recusar o valor, o Studoo pede de novo sem ele. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Outro endereço compatível. Só HTTPS, ou HTTP no próprio computador. |
| `STUDOO_IA_RESERVA` | `falsa` | Sem chave, ou se a OpenAI falhar antes da primeira linha da trilha, `falsa` usa a IA falsa, para a demonstração não parar. `nenhuma` mostra o erro de IA indisponível. |

Uma falha no meio da geração mostra o erro de IA indisponível, e o pedido continua no campo. Se a escrita das lições falhar no **Começar**, a trilha continua na tela com o erro, e **Começar** tenta de novo. Os logs registram só o código e o status, sem objetivo, conteúdo ou chave.

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

`test:dominio` não precisa de servidor: verifica o gerador falso, o teto de gerações e o token da proposta. `test:paridade` também não: confere que os desenhos do mundo da trilha, as ideias do pedido, os passos da apresentação e os textos da tela que escreve as lições são os mesmos na web e no app. `test:ia` confere o adaptador da OpenAI com um servidor local que imita a Responses API, sem chave e sem rede: a trilha por streaming, o conteúdo da lição, a reserva e as falhas. Os testes web usam o banco local e o servidor em `http://localhost:3000`. Eles criam contas sintéticas temporárias. `test:marco` verifica acesso, aceite da proposta, feedback, conclusão e retomada do plano. `test:trilha` verifica a rota ao vivo: NDJSON válido, ordem dos eventos, cancelamento, aceite e as lições de uma trilha genérica. Inicie o servidor com `STUDOO_IA_FALSA_PAUSA_MS=0` para os testes rodarem sem esperar as pausas.

O GitHub Actions roda a mesma verificação em cada PR e em cada push para `development` e `main` (`.github/workflows/verificacao.yml`): os dois typechecks, `test:dominio`, `test:paridade`, `test:movimento`, `test:ia`, o build e, com um PostgreSQL de serviço, `test:marco` e `test:trilha`. O CI usa só os adaptadores falsos e credenciais geradas na hora.

## App Android em modo de desenvolvimento

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
