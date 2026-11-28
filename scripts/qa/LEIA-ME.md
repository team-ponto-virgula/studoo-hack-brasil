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

O modo padrão verifica a recusa HTTP 428, aceita a versão vigente, propõe e cria cinco trilhas, erra um exercício e constrói a ponte. A saída traz duração e status por operação. Ao terminar ele apaga as trilhas criadas, confere a lista, recompõe a escolha de privacidade e encerra a sessão. Com IA falsa, acrescente `--simulada`. Nesse modo a proposta pode seguir sem consentimento. Para testar apenas a barreira HTTP em uma bancada com `IA=openai` e sem chaves, use `--barreira`.

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

## A raiz "/" atrás de um proxy HTTPS, com a entrada pela apresentação ligada e desligada

```sh
# o site de PRODUÇÃO, numa cópia da worktree (o `next build` apaga o `.next` do `next dev`), ligado em 127.0.0.1
npm run build && STUDOO_ENTRADA_APRESENTACAO=1 npx next start -p 3000 --hostname 127.0.0.1
node scripts/qa/raiz-atras-de-proxy.mjs --base=http://127.0.0.1:3000 --entrada=1 [--origem-publica=https://127.0.0.1:3452]
# e com a entrada desligada (sem a variável, o padrão):
npx next start -p 3001 --hostname 127.0.0.1
node scripts/qa/raiz-atras-de-proxy.mjs --base=http://127.0.0.1:3001 --entrada=0
```

`STUDOO_ENTRADA_APRESENTACAO` (lida a cada pedido, sem rebuild) decide o que é de quem NÃO tem sessão na raiz: `1`, a página de apresentação; sem a variável (o padrão) ou com outro valor, o redirecionamento ao `/login` (307, `Location: /login`), como era antes da página. Com sessão a raiz abre o app nos dois estados; `/conheca` e `/baixar` ficam sempre no ar.

O roteiro pede `/` sem sessão, `/` com uma sessão no formato certo, `/conheca`, `/baixar` e `/login` em 8 variações de cabeçalho (sem proxy, `X-Forwarded-Proto` http e https, com o `Host` em `localhost`, em `127.0.0.1` e de fora, com `X-Forwarded-Host` e o conjunto que o Traefik manda) e confere o estado dado em `--entrada` (o padrão é o `STUDOO_ENTRADA_APRESENTACAO` do próprio processo): ligada, 200 com a página sem sessão; desligada, 307 para `/login`, sem a página; nos dois, o app com sessão, 200 em `/conheca` e `/login`, 302 em `/baixar` e nenhuma reescrita do proxy do Next (`x-middleware-rewrite`). Sai com 1 se alguma variação falhar. Roda com o site no ar, sem banco e sem IA. `--origem-publica` é o `STUDOO_ORIGEM` do servidor: com `https` o cookie de sessão é o `__Host-studoo-sessao`.

Guarda dois defeitos. (1) A banca da QA em 8cf17cf: a raiz sem sessão era reescrita para `/conheca` no proxy do Next e, com o Next ligado em 127.0.0.1 e `X-Forwarded-Proto: https`, o Next repassava o pedido a `https://localhost:<porta>/conheca` (o servidor fala http) e dava 500 (`Failed to proxy … EPROTO … wrong version number`); nesse código, 6 das 8 variações dão 500 e todas passam por reescrita. (2) O redirecionamento ao `/login` não pode sair do proxy: um `Location` relativo vindo do proxy dá 500 no Next (`ERR_INVALID_URL`) e um absoluto precisaria montar a URL; quem redireciona é a página (`redirect('/login')`, relativo).

## A carga da página de apresentação no celular (o que ela busca de imagem e quando)

```sh
node scripts/qa/carga-da-pagina.mjs --base=http://localhost:3000 [--aparelho=android|iphone]
```

Chromium emulando um celular de 390 px com tela de 2x, contra o site de produção no ar. A primeira captura do herói é o LCP e não pode disputar a banda com mais nada de imagem. Confere o INÍCIO de cada pedido: até o `load` (mais 250 ms) só a primeira tela do herói, em AVIF e abaixo de 30 kB; as telas 2 e 3 do herói só ≥ 900 ms depois do `load`; as capturas dos momentos do S2 e a da janela do navegador só depois do `load`, e ao rolar chegam em AVIF e aparecem (`naturalWidth > 0`, uma vez cada); e, sem JavaScript, o `<noscript>` traz as capturas. Sai com 1 se falhar. Guarda dois defeitos: o `loading="lazy"` do navegador buscava as capturas do S2 junto com a do herói (folga de uns 1250 px), e o `display: block` da captura passava por cima do atributo `hidden`, então as telas 2 e 3 do herói "escondidas" eram buscadas na carga. Roda com o site no ar, sem banco e sem IA.
