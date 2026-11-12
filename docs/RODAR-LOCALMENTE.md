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

Com `IA=falsa`, a geração não chama nenhum serviço externo. Objetivos de SQL devolvem o plano de demonstração. Qualquer outro objetivo gera uma trilha simulada e determinística de 3 fluxos com 3 lições. Três variáveis opcionais ajustam o comportamento. Sem elas, valem os padrões abaixo.

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `STUDOO_IA_FALSA_PAUSA_MS` | `450` | Pausa entre os eventos da rota ao vivo, para a tela mostrar a trilha se formando. Use `0` para desligar. |
| `STUDOO_LIMITE_GERACOES` | `20` | Gerações permitidas por pessoa em cada janela. Teto provisório, em memória do processo; o teto definitivo é a D7. |
| `STUDOO_JANELA_GERACOES_MIN` | `60` | Tamanho da janela do teto, em minutos. |

## Testes

```sh
npm run typecheck
npm run typecheck --workspace apps/mobile
npm run test:dominio
npm run test:marco
npm run test:trilha
```

`test:dominio` não precisa de servidor: verifica o gerador falso, o teto de gerações e o token da proposta. Os testes web usam o banco local e o servidor em `http://localhost:3000`. Eles criam contas sintéticas temporárias. `test:marco` verifica acesso, aceite da proposta, feedback, conclusão e retomada do plano. `test:trilha` verifica a rota ao vivo: NDJSON válido, ordem dos eventos, cancelamento, aceite e as lições de uma trilha genérica. Inicie o servidor com `STUDOO_IA_FALSA_PAUSA_MS=0` para os testes rodarem sem esperar as pausas.

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
