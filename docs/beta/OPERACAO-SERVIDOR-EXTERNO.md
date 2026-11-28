# Uma intervenção no servidor para concluir o beta externo

Execute no serviço web do Studoo no Dokploy, na raiz que contém `package.json`, `prisma/seed.ts` e `scripts/verificar-publicado.mjs`. O repositório não fixa Dockerfile, nome de contêiner nem diretório `/app`: use o terminal do serviço que já atende a origem abaixo. Se operar pelo host, `docker exec -it "$STUDOO_CONTAINER" sh` abre o contêiner identificado no painel; não adivinhe o nome.

Não publique variáveis, `.p8`, senhas, cookies ou tokens em logs, chat ou commits. Use somente os campos secretos do Dokploy e o canal seguro combinado com o responsável pelo envio à Apple. Preserve `DATABASE_URL`, `STUDOO_CHAVE_ASSINATURA` e as configurações reais de IA/Google.

## 1. Chave de login Apple e ambiente

No Apple Developer → Certificates, Identifiers & Profiles:

1. App ID explícito **`com.studoo.mobile.dev`**, time **`PYZ6U56AMV`**: habilitar **Sign in with Apple**, como App ID primário.
2. Keys → criar uma chave **Sign in with Apple** associada a esse App ID e baixar o `.p8` **uma única vez**. É necessária conta Account Holder/Admin. **Não é a chave de API do App Store Connect usada para enviar o build.**
3. Na configuração da capability, registrar o Server-to-Server Notification Endpoint:
   `https://studoo-web-suqmqb-3a8f9c-187-53-116-195.sslip.io/api/auth/apple/notificacoes`.

Preparar no ambiente seguro do serviço (juntar com a escolha da conta da etapa 2 antes de aplicar/reiniciar uma vez):

```dotenv
STUDOO_APPLE=1
APPLE_TEAM_ID=PYZ6U56AMV
APPLE_BUNDLE_IDS=com.studoo.mobile.dev
STUDOO_SESSAO_MOBILE_PILOTO=1
STUDOO_PROXY_HTTPS=1
STUDOO_ORIGEM=https://app.hellostudoo.com.br
```

Acrescentar **`APPLE_KEY_ID`** e **`APPLE_PRIVATE_KEY`** pelo campo secreto, sem colar valores neste documento. `APPLE_PRIVATE_KEY` recebe o PEM completo; o servidor aceita quebras reais ou escritas como `\n`. Manter a restrição de domínio/email vazia conforme a decisão já registrada, para permitir o revisor e “Ocultar meu email”. Não mudar `IA` para falsa nem desligar Google para contornar a revisão.

## 2. Uma conta sintética por senha, sem cadastro público

**Preferir a conta do monitor**, se `STUDOO_EMAIL`/`STUDOO_SENHA` do serviço forem de uma conta sintética dedicada. O monitor `scripts/verificar-publicado.mjs` já usa esses valores. Enviá-los ao responsável pela Apple somente pelo canal seguro, para os campos privados de demonstração do App Store Connect. Não usar conta pessoal nem os perfis de `comunidade:demo` — esses perfis não têm login. Se reutilizar o monitor, aplicar/reiniciar somente os campos da etapa 1 antes de validar.

Se não existir uma conta dedicada, criar nos campos secretos temporários `STUDOO_REVISAO_EMAIL` (um endereço novo terminado em `.test`) e `STUDOO_REVISAO_SENHA` (aleatória, 8–256 caracteres, gerada no gerenciador de senhas). Usar o mesmo par no canal seguro. Aplicar os campos das etapas 1 e 2 e reiniciar o serviço pelo Dokploy. Então executar **somente este subprocesso**:

```sh
node --input-type=module <<'NODE'
import { spawnSync } from 'node:child_process';
const email = process.env.STUDOO_REVISAO_EMAIL?.trim().toLowerCase();
const senha = process.env.STUDOO_REVISAO_SENHA;
if (!/^[^\s@]+@[^\s@]+\.test$/.test(email ?? '') || !senha || senha.length < 8 || senha.length > 256) {
  console.error('Configure a conta sintética nos campos secretos.'); process.exit(1);
}
const r = spawnSync('npm', ['run', 'db:seed'], { stdio: 'inherit', env: {
  ...process.env, IA: 'falsa', EMAIL: 'falso', STUDOO_EMAIL: email,
  STUDOO_SENHA: senha, STUDOO_DOMINIO_EMAIL: email.split('@')[1],
} });
process.exit(r.status ?? 1);
NODE
```

As flags falsas acima valem **apenas para o processo do seed**, que grava hash da senha e não chama IA/email. Não persistir essas flags no Dokploy. O seed só cria conta ausente, não redefine senha existente; também remove contadores de login vencidos. Se o endereço já existir e a senha não conferir, parar e escolher uma conta sintética nova, sem tentar senhas.

## 3. Conferir configuração e os dois logins, sem imprimir credenciais

No mesmo contêiner, o comando abaixo usa `STUDOO_REVISAO_*` se definidos; caso contrário, usa o par do monitor. Ele faz uma tentativa por canal, confere a sessão e revoga as sessões criadas. Não imprime corpo, cookie ou token.

```sh
node --use-env-proxy --input-type=module <<'NODE'
try {
  const origem = process.env.STUDOO_ORIGEM;
  if (!origem?.startsWith('https://') || new URL(origem).origin !== origem) throw new Error();
  const revisao = Boolean(process.env.STUDOO_REVISAO_EMAIL || process.env.STUDOO_REVISAO_SENHA);
  const email = revisao ? process.env.STUDOO_REVISAO_EMAIL : process.env.STUDOO_EMAIL;
  const senha = revisao ? process.env.STUDOO_REVISAO_SENHA : process.env.STUDOO_SENHA;
  if (!email || !senha) throw new Error();
  const pedir = (p, opcoes = {}) => fetch(new URL(p, origem), {
    ...opcoes, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  const cfg = await (await pedir('/api/auth/config')).json();
  console.log(JSON.stringify({ apple: cfg.apple === true, google: cfg.google === true }));
  if (cfg.apple !== true) process.exitCode = 1;
  for (const mobile of [false, true]) {
    const canal = mobile ? 'mobile' : 'web';
    const r = await pedir(mobile ? '/api/mobile/sessao' : '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(mobile ? {} : { Origin: origem }) },
      body: JSON.stringify({ email, senha }),
    });
    const dados = await r.json();
    const cookie = r.headers.get('set-cookie')?.split(';')[0];
    const headers = mobile ? { Authorization: `Bearer ${dados.token}` } : { Origin: origem, Cookie: cookie };
    const loginOk = r.status === 200 && (mobile ? typeof dados.token === 'string' : dados.autenticado === true && Boolean(cookie));
    console.log(`${canal}: login HTTP ${r.status} ${loginOk ? 'ok' : 'falhou'}`);
    if (!loginOk) { process.exitCode = 1; continue; }
    try {
      const s = await pedir('/api/sessao', { headers });
      const sessaoOk = s.status === 200 && (await s.json()).autenticado === true;
      console.log(`${canal}: sessão ${sessaoOk ? 'ok' : 'falhou'}`);
      if (!sessaoOk) process.exitCode = 1;
    } finally {
      const fim = await pedir('/api/sessao', { method: 'DELETE', headers });
      console.log(`${canal}: saída HTTP ${fim.status}`);
      if (fim.status !== 204) process.exitCode = 1;
    }
  }
} catch {
  console.error('Conferência não concluída; verifique configuração, rede e logs sanitizados do serviço.');
  process.exitCode = 1;
}
NODE
```

Entregar de uma vez pelo canal seguro: confirmação de `apple: true`, resultado dos dois logins e o par da conta sintética. O responsável pelo envio grava a senha só em `demoAccountPassword`, nunca nas notas. Confirmar também `/privacidade` e `/suporte` com 200 e executar `npm run beta:conferir` no checkout da release.

Isso confirma configuração e acesso por senha; **o login Apple real e a revogação ainda precisam ser exercitados no iPhone**. Não solicitar Beta App Review afirmando esses testes antes de fazê-los. Remover os campos temporários `STUDOO_REVISAO_*` do serviço depois da entrega segura; isso não apaga a conta nem muda sua senha.
