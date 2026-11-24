# Ensaio local de consentimento, geração e voz

Execute na raiz da worktree compilada do Studoo, com Node 24 e PostgreSQL embarcado instalado pelo projeto em Linux x64. A bancada usa a interface local 127.0.0.1. Cada porta recebe um banco novo, migrations e uma conta sintética exclusiva. Os dois roteiros usam a mesma conta e devem rodar um de cada vez.

## Iniciar e encerrar

```sh
node scripts/qa/ensaio-ia.mjs subir 3892
```

O padrão é IA falsa e e-mail falso. Para o ensaio com provedores, o responsável fornece ao processo de início as variáveis de IA e voz já autorizadas no cofre. A migração e a criação da conta usam adaptadores falsos. O processo Next recebe as variáveis dos provedores. O arquivo privado `.studoo-local/ensaio-ia-3892/piloto.env` contém apenas a porta, a origem e o login sintético. O e-mail segue simulado em todos os modos.

## Cinco temas

```sh
node --env-file=.studoo-local/ensaio-ia-3892/piloto.env scripts/qa/cinco-temas.mjs
```

O modo padrão verifica a recusa HTTP 428, aceita a versão vigente, propõe e cria cinco trilhas, erra um exercício e constrói a ponte. A saída traz duração e status por operação. Ao terminar ele apaga as trilhas criadas, confere a lista, recompõe a escolha de privacidade e encerra a sessão. Com IA falsa, acrescente `--simulada`. Nesse modo a proposta pode seguir sem consentimento. Para testar apenas a barreira HTTP em uma bancada com `IA=deepseek` e sem chaves, use `--barreira`.

## Conversa de voz

```sh
node --env-file=.studoo-local/ensaio-ia-3892/piloto.env scripts/qa/conversa-voz.mjs
```

O roteiro usa Chromium com sandbox e um áudio de fala gerado localmente em português. Ele entra pela tela de login, cria uma trilha sintética de frações pela API, provoca um erro e cria a ponte. Na interface, abre o mapa, a lição, o último exercício e “Explique com suas palavras”. O modo real clica em “Conversar com o Stu” e aguarda o encerramento automático da chamada. Confere eventos do canal, legendas dos dois participantes e as respostas de ensino e de ponte. O relatório grava o JSON das duas respostas e os tempos. A saída padrão fica em `.studoo-local/voz-qa-<instante>/voz.json`. Use `--saida=<diretorio>` para escolher outro local privado. O cadastro e a trilha são exclusivamente de ensaio. Os dados de voz usados são sintéticos.

Na bancada com IA falsa, `--simulada` verifica o mesmo percurso até “Explique”, a alternativa de texto e os dois JSONs. A conversa de áudio exige o modo real.

Esta worktree já dispõe de Chromium e de `playwright-core` para o ensaio. Em outra cópia com o mesmo cache do Chromium, a dependência de teste pode ser instalada sem modificar os manifestos do aplicativo.

```sh
npm install --prefix .studoo-local/navegador-qa --no-fund --no-audit --ignore-scripts --no-package-lock playwright-core@1.59.1
```

Para encerrar o servidor, parar o PostgreSQL e descartar os dados criados por esta bancada, rode na mesma worktree:

```sh
node scripts/qa/ensaio-ia.mjs parar 3892
```

## Troca de tela do herói da página de apresentação

```sh
node scripts/qa/heroi-troca.mjs --base=http://localhost:3000 [--motor=chromium|webkit]
```

Amostra a cada 50 ms, por dois ciclos, as opacidades das três telas do celular do herói (`/conheca`) e exige que a soma nunca fique abaixo de 0,95: a troca não pode deixar quadro vazio (a tela que sai fica inteira por baixo até a nova terminar de entrar por cima). Sai com 1 se falhar. Roda com o site no ar, sem banco e sem IA.

## A raiz "/" atrás de um proxy HTTPS

```sh
# o site de PRODUÇÃO, numa cópia da worktree (o `next build` apaga o `.next` do `next dev`), ligado em 127.0.0.1
npm run build && npx next start -p 3000 --hostname 127.0.0.1
node scripts/qa/raiz-atras-de-proxy.mjs --base=http://127.0.0.1:3000 [--origem-publica=https://127.0.0.1:3452]
```

Pede `/` sem sessão, `/` com uma sessão no formato certo e `/conheca` em 8 variações de cabeçalho (sem proxy, `X-Forwarded-Proto` http e https, com o `Host` em `localhost`, em `127.0.0.1` e de fora, com `X-Forwarded-Host` e o conjunto que o Traefik manda). Exige 200 em todos, a página de apresentação sem sessão, o app com sessão, e nenhuma reescrita do proxy do Next (`x-middleware-rewrite`) nem redirecionamento. Sai com 1 se alguma variação falhar. Roda com o site no ar, sem banco e sem IA. `--origem-publica` é o `STUDOO_ORIGEM` do servidor: com `https` o cookie de sessão é o `__Host-studoo-sessao`.

Guarda o defeito da banca da QA em 8cf17cf: a raiz sem sessão era reescrita para `/conheca` no proxy do Next e, com o Next ligado em 127.0.0.1 e `X-Forwarded-Proto: https`, o Next repassava o pedido a `https://localhost:<porta>/conheca` (o servidor fala http) e dava 500 (`Failed to proxy … EPROTO … wrong version number`). Nesse código, 6 das 8 variações dão 500 e todas passam por reescrita; no atual, a página decide pelo cookie e não há reescrita.
