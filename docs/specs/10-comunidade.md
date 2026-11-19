# 10 — Comunidade: perfil rico, Explorar e laços

## Ideia
O dono quer o perfil de ponta a ponta (foto, resumo) e o compartilhar com cara de rede social: "top trilhas da semana", publicar, agradecer. O ciclo é:

criar trilha → publicar → outra pessoa encontra no Explorar → "Quero estudar" (cópia pronta, sem IA) → manda um "Valeu" → quem fez vê o alcance no perfil.

São três etapas, cada uma com **uma** migração que só acrescenta. O Lead libera cada etapa depois de revisar, integrar, publicar e mostrar ao dono. As etapas A e B estão feitas; a C está descrita aqui para o banco e o contrato serem desenhados de uma vez.

## O que muda na spec 09
- A decisão 1 da 09 ("sem foto, bio, seguidores, contagem pública ou ranking") **cai** por ordem do dono (18/11).
- A **D16 continua para pessoas**: nada de XP, sequência, medalha, moeda nem ranking de pessoas. O "Em alta" ordena **trilhas**, nunca pessoas. Contagens aparecem como alcance de uma trilha ou de um perfil, sem posição entre pessoas.
- O e-mail continua sem aparecer para ninguém.
- `/t/<código>` de link encerrado ou inexistente passa a responder **HTTP 404**, com a mesma tela.

## Temas
Lista fixa de 12 temas, a mesma para os interesses do perfil (A) e para o tema da trilha publicada (B): `TEMAS` em `packages/contratos/src/compartilhar.ts`, rótulos em `mensagens.temas`.

| id | rótulo |
|---|---|
| `idiomas` | Idiomas |
| `matematica` | Matemática |
| `ciencias` | Ciências |
| `programacao` | Programação e tecnologia |
| `negocios` | Negócios e finanças |
| `vestibular` | Vestibular e concursos |
| `historia` | História e sociedade |
| `artes` | Artes e música |
| `saude` | Saúde e bem-estar |
| `culinaria` | Culinária e casa |
| `carreira` | Carreira e produtividade |
| `outros` | Outros |

O banco guarda o id. `interessesValidos` aceita só ids conhecidos, sem repetição, até 5, e devolve na ordem da lista.

---

## Etapa A — perfil rico (feita)

### Produto
1. **Foto.** Galeria ou câmera ("Tirar foto" só em tela de toque). O recorte quadrado aceita arrastar (mouse, toque, caneta), pinça, roda do mouse e controle deslizante; pelo teclado, as setas movem (Shift: passo maior) e `+`/`−` aproximam. O círculo mostra como o avatar fica. É possível trocar e remover (com confirmação). Sem foto, fica a inicial na cor.
2. **Aviso ao pôr a foto** (no recorte e na prévia da edição): "Quem abrir suas trilhas compartilhadas vê seu nome, sua foto e seu resumo. Seu e-mail nunca aparece."
3. **Resumo.** Até 160 caracteres, uma linha, com as mesmas regras do nome (sem site, e-mail, HTML ou caracteres invisíveis) e contador. Vazio apaga.
4. **Interesses.** Até 5 temas, em fichas que marcam e desmarcam. Na sexta tentativa, nada muda e aparece "Você já escolheu 5. Desmarque um para trocar."
5. **Tela "Editar perfil"** (tela própria, sem a barra de baixo): foto, nome, cor, resumo, interesses e a prévia ao vivo do cabeçalho público ("Como os outros veem"; ao lado e presa ao rolar a partir de 1024 px, depois do formulário no celular). Barra fixa embaixo com o estado sempre à vista ("Alterações não salvas", "Salvando…", "Tudo salvo") e "Salvar" (desligado sem mudança). Erro no próprio campo (`aria-invalid` e texto ligado por `aria-describedby`), com o foco no primeiro campo errado. Voltar com mudança pede confirmação ("Sair sem salvar?"); fechar a aba também (`beforeunload`). A foto salva na hora, à parte do botão.
6. **Cabeçalho do perfil**, o mesmo na tela Perfil, na prévia e em `/p/<id>`: faixa na cor do perfil com um desenho de trilha, foto grande sobreposta (96 px no celular, 112 no computador), nome, resumo, interesses e a linha de alcance ("2 trilhas compartilhadas · 4 pessoas adicionaram"). Ações: "Editar perfil" (dona) e "Compartilhar perfil" (Web Share ou copiar `/p/<id>`; só com perfil público). No celular as ações vão para o fim do cartão. Dona sem resumo: o convite "Conte em uma frase o que você gosta de estudar." abre a edição. Sem nome: Stu, "Como você quer aparecer?" e "Completar perfil".
7. **A foto aparece onde havia a inicial:** folha de compartilhar, prévia do formulário, navegação (lateral e barra), `/t/<código>`, "Compartilhada por" nos cartões e "Esta trilha é de" no mapa da trilha recebida. Na trilha recebida vale a foto de agora: se a pessoa trocar ou remover, muda ali também.
8. **Acertos da v1:**
   - (a) `/t/<código>` encerrado ou inexistente responde 404 (`notFound()` e `src/app/t/[codigo]/not-found.tsx`, com a mesma tela, `noindex`).
   - (b) `/t/<código>` ganha calor: o Stu com o balão "Bora estudar junto? Eu te acompanho em cada lição." e o cartão "Quem compartilhou" (foto, nome, resumo e "Ver o perfil de Ana", se público). Na própria trilha da dona, nada disso.
   - (c) iPhone: `appleWebApp` (`capable`, título "Studoo", barra de status `default`, que não cobre o conteúdo) e `formatDetection` desligado nos metadados; no modo instalado até 1023 px, as laterais respeitam `env(safe-area-inset-*)` (cabeçalhos, conteúdo, folhas); a barra de salvar respeita a de baixo.

### Alcance
- Na tela Perfil (só a dona vê): todas as trilhas que compartilha e a soma das adições.
- Em `/p/<id>`: só as trilhas marcadas para aparecer no perfil e as adições delas. O perfil público não revela quantos links privados a pessoa tem.

### Banco (migração `20261119120000_perfil_rico`)
```sql
ALTER TABLE "Usuario" ADD COLUMN "perfilResumo" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "perfilInteresses" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE TABLE "FotoPerfil" (
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "grande" BYTEA NOT NULL,
    "pequena" BYTEA NOT NULL,
    "criadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotoPerfil_pkey" PRIMARY KEY ("usuarioId")
);
CREATE UNIQUE INDEX "FotoPerfil_token_key" ON "FotoPerfil"("token");
ALTER TABLE "FotoPerfil" ADD CONSTRAINT "FotoPerfil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```
A foto fica numa tabela à parte, assim as leituras do usuário não carregam bytes. Uma foto por conta: trocar sobrescreve com um token novo; remover apaga a linha.

### Foto: processamento
- O cliente recorta e manda um JPEG quadrado de até 1024 px (`LADO_ENVIO_FOTO`), em base64 (`PUT /api/perfil/foto { base64 }`), o mesmo formato JSON que o app consegue mandar.
- No servidor (`src/servidor/compartilhar/foto.ts`):
  1. base64 estrito (o texto decodificado e recodificado tem de voltar igual);
  2. até 2 MB;
  3. tipo pelos primeiros bytes: JPEG, PNG ou WebP; o resto é recusado (GIF, SVG, HEIC, texto);
  4. conta no limite de 10 trocas por hora;
  5. `sharp` com `limitInputPixels` de 36 milhões, `pages: 1` (só o primeiro quadro) e `failOn: 'error'`;
  6. `rotate()` (orientação do EXIF), corte central em 512×512 e redução a 128×128;
  7. regravado em WebP: o sharp não copia metadados, então saem EXIF (inclusive GPS), XMP e ICC.
  Falha de leitura vira `422 foto_invalida`.
- **Endereço:** `GET /api/fotos/<token>/<512|128>`.
- *Revisto na B:* a leitura usa um cache em memória por token (400 itens, 24 MB, 10 min; trocar e remover tiram o token antigo) e o limite de leitura passou para a memória do processo. Medido localmente: uma página com 20 avatares caiu de 42 ms para 1,9 ms, e uma foto já lida não toca o banco. Cabeçalho `Cross-Origin-Resource-Policy: cross-origin`: o token é imprevisível e a foto é pública, então a prévia web do app em outra origem também carrega. O token é aleatório (96 bits, `randomBytes(12)` em base64url) e troca a cada foto nova: sem enumeração, cache `public, max-age=31536000, immutable`, e o endereço antigo deixa de existir (404). Nunca o `perfilId`: quem compartilha só por link não tem perfil público, e a foto dela aparece em `/t`.
- Cabeçalhos da foto: `Content-Type: image/webp`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: same-site`, `X-Robots-Tag: noindex, nofollow`.
- **Limite de leitura:** a foto é pedida por toda lista com avatar, então tem um balde próprio, mais largo que o das páginas: 1.200 por 15 min por endereço confiável e um disjuntor global de 30.000 por 15 min sem endereço confiável. Com o cache imutável, cada navegador busca cada foto uma vez.
- Conta de visitante não tem foto (`403 compartilhar_visitante`).

### API
| Rota | Acesso | O que muda |
|---|---|---|
| `GET /api/perfil` | privada | Mais `resumo`, `interesses`, `foto` (token ou null) e `alcance { trilhas, pessoas }`. |
| `PUT /api/perfil` `{ nome, cor, resumo?, interesses? }` | privada | `resumo` e `interesses` são opcionais: sem eles, o que existe fica (o app atual só manda nome e cor). Inválido: `400 invalido`. |
| `PUT /api/perfil/foto` `{ base64 }` | privada | Troca a foto; devolve o `Perfil`. `422 foto_invalida`, `429 limite_foto`. |
| `DELETE /api/perfil/foto` | privada | Remove; devolve o `Perfil`. Não conta no limite. |
| `GET /api/fotos/:token/:tamanho` | pública | A foto (512 ou 128). Token fora do formato, trocado ou removido: 404. |
| `GET /api/compartilhar/:codigo` | pública | `dono` ganha `foto` e `resumo`. |
| `GET /api/perfis/:perfilId` | pública | Mais `resumo`, `interesses`, `foto` e `alcance` (só das trilhas marcadas). |
| `GET /api/aprendizado/planos/:id/compartilhar` | privada | `perfil.foto`. |
| listas e mapa | privada | `recebida.foto` (a foto de agora de quem compartilhou). |

Sem `STUDOO_COMPARTILHAR=1`, as rotas novas também respondem 404. Cliente (`criarClienteStudoo`): `salvarPerfil(nome, cor, { resumo, interesses })`, `enviarFoto(base64)`, `removerFoto()`; helper `enderecoFoto(token, tamanho)` (o app soma a base do servidor).

### Testes
`tests/perfil-rico.test.mjs` (em `test:estudio`), 6 testes:
- regras do resumo e dos interesses;
- salvar, manter quando não vêm, recusar inválidos, aparecer em `/t` e `/p`, alcance da dona e alcance público;
- foto recusada por bytes (GIF, SVG, JPEG quebrado, texto), base64 torto, mais de 2 MB e bomba de 49 MP;
- orientação corrigida (pixel por pixel), 512 e 128 em WebP, sem EXIF nem GPS (busca dos valores no arquivo), cabeçalhos; PNG e WebP entram;
- token novo a cada troca, o antigo some, remover volta à inicial, a foto em `/t` e em "Compartilhada por";
- 10 trocas por hora, visitante e flag.

Navegador: roteiro de capturas (390, 1440 e 360) com foco, teclado no recorte, alvos de 44 px, erro no campo, "Tudo salvo", 404 do link encerrado e páginas públicas sem e-mail.

---

## Etapa B — Explorar, publicar, Em alta e Valeu (feita)
Atrás de `STUDOO_COMUNIDADE=1`, que só vale com `STUDOO_COMPARTILHAR=1`. Sem ela, nada aparece: as rotas novas respondem 404, `comunidade` vem `false` no config, o link não traz `visibilidade` e a folha mantém o interruptor "Mostrar no meu perfil".

### Produto
- **Visibilidade em três níveis** na folha de compartilhar: "Só com o link", "No meu perfil" (já existem) e "No Explorar" (novo). Publicar pede perfil com nome, legenda opcional de até 140 caracteres (mesmas regras do resumo) e um tema, sugerido pelas palavras do título e confirmado pela pessoa. Trilha feita de material não vai para o Explorar. Trilha simulada vai com o rótulo de demonstração.
- **Tela "Explorar"**, item novo na navegação ("Descobrir" já é nome de etapa da aula), pública em `/explorar`: ver não pede conta, agir pede. Blocos:
  - "Em alta esta semana": Top 10 com numeral grande em carrossel com encaixe;
  - fichas de tema;
  - "Novas", em lista paginada por cursor (20 por página);
  - vazios com o Stu.
- **Em alta:**
  - janela dos últimos 7 dias corridos;
  - pontos = contas distintas que adicionaram × 3 + valeus × 1; não contam a dona nem visitantes;
  - só entra com 1 ponto ou mais; empate vai para a mais recente;
  - resultado em cache de 60 s.
- **Cartão de trilha**, um componente só para Explorar, perfil e prévia:
  - capa gerada, sem imagem enviada e sem IA: cor do tema + padrão geométrico determinístico pelo código do link;
  - tema, título, quem fez (foto e nome, que levam ao perfil), legenda;
  - "6 lições · 3 partes" e "12 estudando · 8 valeus";
  - ação "Quero estudar", que vira "Continuar" para quem já tem e "Sua trilha" para a dona;
  - Valeu (liga e desliga), compartilhar e "•••" com Denunciar.
- **Denunciar** trilha ou perfil, com motivo (spam, ofensivo, direitos autorais, outro). Com 3 contas distintas, a trilha sai do Explorar até revisão. Limite de 10 por hora. Sem painel: registro no banco e uma linha no log.

### Decisões de implementação
- **Explorar inclui o perfil.** Publicar marca `noPerfil` e `noExplorar`. Desligar o perfil (pelo interruptor antigo ou pelo nível "Só com o link") também tira do Explorar. Editar tema e legenda não muda `publicadaEm`, então não reordena "Novas".
- **Eventos:**
  - "Quero estudar" é o "adicionar" que já existe; ele grava o evento `adicao` junto com o contador.
  - Contas de visitante não geram evento.
  - A dona não adiciona a própria trilha (409) nem manda valeu nela (409).
  - O valeu vale em qualquer link ativo, então quem recebeu só pelo link também agradece.
- **Agir pede conta comum.** Visitante não publica, não manda valeu e não denuncia (403), porque contas temporárias são fáceis de criar e três delas poderiam tirar uma trilha do ar.
- **Trilha oculta por denúncias** sai do Explorar e do Em alta, mas o link e o perfil continuam funcionando. A revisão é feita no banco (`oculta = false`).
- **Em alta com tema:** o mesmo cálculo, filtrado pelo tema da ficha.
- **Limites** (por conta e por hora, `429 limite_comunidade`): publicar 30, valeu 60 e denunciar 10. `/api/explorar` passa pelo limitador das páginas públicas.
- **Erros novos:** `explorar_material` (409) e `limite_comunidade` (429).
- `/api/perfis/:id` passa a aceitar sessão (`rotaPublicaComSessao`), para cada cartão dizer se a trilha já é da pessoa.

### Telas (web)
- **Explorar** (`src/app/comunidade.tsx` e `comunidade.css`):
  - entra na lateral (abaixo de "Nova trilha") e é o terceiro item da barra de baixo (4 itens, cabe em 360 px);
  - na tela de nova trilha, há "Ver trilhas da comunidade";
  - a página pública é `/explorar` (`noindex`, renderizada no servidor), com o convite "Entre para estudar, mandar valeu ou denunciar."; agir sem conta leva ao login e volta (`/explorar` ou `/t/<código>?adicionar=1`);
  - blocos: título, fichas de tema (`aria-pressed`; rolam no celular, quebram linha no computador), "Em alta esta semana" (lista com encaixe, setas só com ponteiro fino, numeral grande no canto da capa) e "Novas" em grade, com "Ver mais trilhas";
  - vazios com o Stu (sem nada publicado, ou um tema vazio).
- **Cartão de trilha:**
  - capa gerada, com selos de tema e de "Demonstração";
  - título que leva à prévia `/t`; foto e nome que levam ao perfil; legenda; contagens;
  - ação principal ("Quero estudar", "Continuar" ou "Sua trilha");
  - Valeu com `aria-pressed`, otimista e com anúncio em região viva; Compartilhar (Web Share ou copiar); menu "•••" com Denunciar.
- **Denunciar:** diálogo com os 4 motivos em rádio e o erro "Escolha um motivo."; "Denunciar perfil" fica no fim de `/p`.
- **Folha de compartilhar:** "Quem pode ver" com os três níveis em rádio.
  - "No Explorar" abre a publicação: tema marcado pela sugestão do título ("sugerido pelo título"), legenda com contador e aviso de demonstração.
  - Trilha feita de material mostra o nível desligado, com o motivo.
- **Perfil da dona:** cada trilha mostra o selo do nível (e o tema), os valeus e o botão "Visibilidade", que abre a folha. "Como aparece na sua página" mostra os cartões.
- **`/p/<id>`:** coluna larga (até 76 rem) com a grade de cartões (3 colunas a 1440 px).

### Banco (migração `20261120090000_comunidade`, só acrescenta)
- `LinkTrilha`: `noExplorar BOOLEAN DEFAULT false`, `tema TEXT`, `legenda TEXT`, `publicadaEm TIMESTAMPTZ`, `oculta BOOLEAN DEFAULT false` (3 denúncias). Índice `(noExplorar, oculta, publicadaEm DESC, codigo)` para "Novas" por cursor e `(tema, …)` para as fichas.
- `EventoTrilha`: `codigo` (FK `LinkTrilha` em cascata), `usuarioId`, `tipo` (`adicao` | `valeu`), `criadoEm`; único `(codigo, usuarioId, tipo)`, um por conta por trilha; índice `(tipo, criadoEm)` para a janela de 7 dias. O valeu desligado apaga a linha. A adição grava o evento junto com o `adicoes += 1` que já existe, para o Em alta ter data e conta distinta, não só contador.
- `Denuncia`: `id`, `alvoTipo` (`trilha` | `perfil`), `alvo` (código ou `perfilId`), `usuarioId`, `motivo`, `criadoEm`; único `(alvoTipo, alvo, usuarioId)`.

### API
- `PATCH /api/compartilhar/:codigo` `{ visibilidade: 'link' | 'perfil' | 'explorar', tema?, legenda? }`, compatível com `{ noPerfil }`.
- `GET /api/explorar?tema=&cursor=` (pública) devolve `{ emAlta: CartaoTrilha[], novas: CartaoTrilha[], cursor }`.
- `POST|DELETE /api/compartilhar/:codigo/valeu` (privada).
- `POST /api/denuncias` `{ alvoTipo, alvo, motivo }` (privada).
- `GET /api/perfis/:perfilId` traz `cartoes: CartaoTrilha[]` com a comunidade.
- Cliente: `definirVisibilidade`, `explorar`, `valeu` e `denunciar`. Contrato em `packages/contratos/src/comunidade.ts`: `VISIBILIDADES`, `LIMITES_COMUNIDADE`, `MOTIVOS_DENUNCIA`, `sugerirTema`, `COR_DO_TEMA`, `svgCapaTrilha`, `motivoLegendaInvalida`, `CartaoTrilha`, `PaginaExplorar` e `ResultadoValeu`.
- Tipo `CartaoTrilha`: `codigo`, `titulo`, `tema`, `legenda`, `totalLicoes`, `totalPartes`, `estudando`, `valeus`, `dono` (`DonoPublico`), `demonstracao`, `situacao?`, `valeuMeu?`.

### Testes
`tests/comunidade.test.mjs` (em `test:estudio`), 8 testes:
- contrato: tema sugerido, legenda e capa determinística sem script;
- sem a flag nada existe;
- publicar: três níveis, tema, legenda, material e data fixa;
- Explorar: 22 trilhas em várias páginas, sem repetir nem pular, filtro de tema, chaves exatas do cartão, sem e-mail nem ids;
- situação nova, adicionada e sua; regras do valeu;
- Em alta: pesos, 7 dias, visitante fora, empate para a mais recente, cache e despublicar;
- Denunciar: 3 contas ocultam, uma por conta, perfil e limite de 10;
- `/p` com cartões.

Navegador: 18 checagens a 390, 1440 e 360 px (foco, teclado, alvos de 44 px, sem rolagem lateral, anúncios, `noindex`, login ao agir sem conta), mais o vazio.

---

## Etapa C1 — demonstração, Código Studoo e prévia do link (feita)

### Conteúdo de demonstração (migração `20261121090000_comunidade_demo`)
```sql
ALTER TABLE "Usuario" ADD COLUMN "perfilDemo" BOOLEAN NOT NULL DEFAULT false;
```
- **Comandos** (só com `STUDOO_COMUNIDADE_DEMO=1`; sem ela, recusam com erro):
  - `npm run comunidade:demo` cria ou renova;
  - `npm run comunidade:demo:remover` apaga tudo.
  - Rodam no contêiner de produção como o `db:seed`: só banco, nada de IA nem serviço externo. O código está em `src/servidor/compartilhar/demonstracao.ts` e `scripts/comunidade-demo.ts`.
- **O que cria:**
  - 6 perfis fictícios com o selo "Perfil de demonstração" e retratos ilustrados gerados no próprio comando;
  - 10 trilhas em 9 temas: as 6 prontas do modo demonstração (violão, inglês, culinária, história, frações e fotografia) e 4 trilhas curtas novas, só da demonstração e fora do reconhecimento da IA falsa (Python, primeiros socorros, física do dia a dia e falar em público);
  - publicação no Explorar com tema e legenda.
- **Datas e eventos:** adições e valeus entre os perfis de demonstração ficam espalhados entre a publicação e agora, nos últimos 7 dias. Os pesos dão um top de 10 no Em alta.
- **Idempotente:** perfis, trilhas e links ficam. Rodar de novo refaz as datas de publicação e os eventos dos perfis de demonstração, e mantém os de pessoas de verdade. O "estudando" soma as cópias reais.
- **Sem login:** o e-mail fica em `demonstracao.studoo.invalid`, sem senha, sem Google e sem sessão, e recuperar a senha não gera código. Os perfis de demonstração só agem nas trilhas de demonstração.
- **No servidor, a flag também esconde:** sem `STUDOO_COMUNIDADE_DEMO=1`, o conteúdo de demonstração sai do Explorar e do Em alta, e o `/p` e o `/t` dele respondem 404, sem apagar nada.
- **Contrato:** `DonoPublico.demo` e `PerfilPublico.demo` (só `true`) mostram o selo no cartão, no cabeçalho do perfil, no "Quem compartilhou" do `/t` e nas imagens de prévia.
- **Remover:** apaga perfis, trilhas, links, eventos e fotos. As cópias que pessoas de verdade adicionaram ficam com elas.

### Código Studoo nas telas (`src/app/codigo.tsx`)
- Gerador puro `svgCodigoDoLink` no contrato, igual na web e no app. Estilo "rosto" por padrão (os três estilos continuam no gerador), com o miolo dos olhos na cor do perfil e a foto no centro em `centroComFoto`.
- **Folha de compartilhar, passo "link pronto":** o código (o centro é o sorriso), "Baixar imagem", "Compartilhar imagem" (quando o aparelho deixa, com Web Share de arquivo) e "Apresentar". Copiar e compartilhar o link já estavam na folha.
- **"Compartilhar perfil":** abre uma folha com o código, a foto no centro, e Copiar link, Compartilhar, Baixar imagem e Apresentar. Vale na tela Perfil e no `/p`.
- **Imagem baixada:** cartão de 1080×1350 desenhado no navegador (canvas), com o título, o código numa moldura da cor do perfil, a dica e a marca.
- **Modo apresentação:** camada branca em tela cheia (Fullscreen API quando existe), com o título, o código o maior possível e "Aponte a câmera do celular". O foco vai para "Fechar", e Esc fecha.
- Só o diálogo de cima responde ao teclado (pilha de diálogos), então o Esc da apresentação não fecha a folha.
- **Prova de leitura:** `tests/codigo-e-demonstracao.test.mjs` lê, com jsQR e ZXing a 240 e 600 px, os links reais de trilha e de perfil (este com foto no centro) nas 6 cores.
- **Correção (19/11): o centro sempre aparece.**
  - O que acontecia: o link do site de prévia tem 75 caracteres; em H, isso dava a versão 8, que tem um alinhamento no centro, e a clareira era descartada (código denso, sem sorriso nem foto).
  - Agora `escolherNivel` pega a correção mais forte que cabe até a versão 6 (H, depois Q, depois M), que não tem alinhamento no centro e tem módulos maiores.
  - Link de mais de 106 bytes vai para M na menor versão, e a clareira cobre exatamente o alinhamento do centro (5×5, sem apagar dados).
  - Em M, a clareira fica com no máximo 7 módulos.
  - Resultado da varredura de 20 a 120 caracteres: até 55 em H v3 a v6; 60 a 70 em Q v5/v6; 75 a 105 em M v5/v6 (75 → M v5, 37 módulos, clareira 7); 106 a 120 em M v7 com clareira 5.
  - Prova em `scripts/codigo-studoo-links.mjs`: links de 40, 75, 90 e 120 × trilha e perfil × sorriso, foto e inicial × 6 cores × 7 degradações × 2 leitores, 2016 de 2016. Teste automático com links de 75, 90, 106, 107 e 120 em `tests/codigo-e-demonstracao.test.mjs`.
- **Correção (19/11, banca): folga garantida por link.**
  - O que acontecia: em M v5, a ponte cheia (que pinta a linha 3 entre as lentes) e a clareira de 7 já gastavam de 10 a 11 das 12 correções do pior bloco em parte dos links; a folga dependia do link.
  - Agora o gerador faz a conta para o link em mãos, sem leitor nem imagem: mapa módulo → palavra-código → bloco (posicionamento em zigue-zague e tabela de blocos do padrão QR, conferidos com o Reed-Solomon nos testes) e, para cada candidata, quantas palavras de cada bloco o desenho estraga (todo módulo de dados na clareira; na ponte cheia, os módulos claros da linha 3).
  - Candidatas: níveis H, Q e M (cada um na menor versão em que o link cabe e nas duas seguintes, até a 13), as 8 máscaras (a matriz troca de máscara e regrava os bits de formato), ponte cheia, ponte fina ou nenhuma, e clareira de 9, 7 ou 5 módulos (a que couber) ou nenhuma.
  - **Folga:** nenhum bloco gasta mais de 60% da correção e, com 8 módulos de dados sujos ao acaso, a chance de ler fica em 99% ou mais (conta exata e conservadora: cada módulo sujo estraga uma palavra nova, distribuída pelo tamanho dos blocos). Só os 60% não bastavam: em códigos de 2 blocos, 7 de 12 gastos deixam 5 por bloco, e 8 sujos estouram um bloco em cerca de 1 vez em 4.
  - **Escolha:** entre as que passam, o centro (sorriso, foto ou inicial) só sai em último caso; depois o módulo maior (a menor versão); depois o rosto mais completo (com ponte, clareira maior, ponte cheia antes da fina); depois mais correção e menos uso.
  - **Ponte fina:** passa entre as linhas 2 e 3 sem cobrir o centro de nenhum módulo (não gasta correção): canal claro de 2,7 a 3,3 e arco de 0,46 módulo, a 0,6 da borda de cada lente (encostada na lente, emendava no anel e confundia o localizador do jsQR em tela cheia). Assim a ponte só some se nem ela couber, o que não acontece.
  - **Clareira redonda,** como o que vai nela: fica livre o módulo cujo centro está a até meio lado do centro do código (com lado 7, 37 módulos em vez de 49). Isso devolveu a clareira de 7 ao link de 75 caracteres.
  - **Centro quase até os pontos vizinhos** (`diametroDoCentro`: 0,12 da borda do ponto mais perto, sem cobrir centro de módulo). Com um anel claro largo, uma foto escura virava um falso olho do QR (1:1:3:1:1) e o ZXing não lia; com o anel estreito, lê.
  - **Centro em disco só com clareira de 7 ou mais** (`CentroCodigo`: foto ou inicial; o sorriso da trilha não tem essa regra). Uma foto escura lisa numa clareira de 5 passava por um olho do QR para o ZXing (6 em 5.000 links de 40 caracteres).
  - **Inicial clara:** disco num tom claro da cor do perfil (`corClara`) e a letra na cor. A letra branca num disco escuro formava um falso olho e o ZXing errava cerca de 1 em 100 (5 em 500 leituras com a letra "A"; a inicial clara, 0 em 500). A imagem baixada desenha a letra na cor.
  - Resultado: trilha (sorriso) — 40 caracteres → M v3, clareira 5; 75 → M v5, clareira 7; 90 → M v6, clareira 7; 120 → M v7, clareira 9 (sobre o alinhamento do centro). Perfil (disco) — 40 → Q v4, clareira 7; os outros como a trilha. Todos com ponte fina; a ponte cheia ainda sai quando a máscara deixa (raro).
  - Teste automático determinístico em `tests/codigo-folga.test.mjs` (semente fixa): mapa conferido pelo Reed-Solomon, a regra em 200 links por formato (40, 75, 90 e 120; trilha e perfil) com uma conta independente, e leitura por jsQR e ZXing em 60 links por formato (perfil com foto escura lisa ou inicial clara), 100% limpos e no máximo 1 falha com 8 sujos. A prova grande (5.000 links por formato, também em tela cheia) fica fora do CI.
- **Perfil sem foto:** o centro é a inicial do nome num círculo na cor do perfil (`centroComInicial`), o mesmo avatar de todo lugar, igual na folha, na imagem baixada e na apresentação. A trilha leva o sorriso do Stu.

### Imagem de prévia do link (Open Graph)
- `src/app/t/[codigo]/opengraph-image.tsx` e `src/app/p/[id]/opengraph-image.tsx` usam o `next/og`, que já vem no Next (nenhuma dependência nova). O desenho fica em `src/servidor/og/cartao.tsx`.
- **Trilha:** capa do tema e foto à esquerda; tema, título, "por Ana" e o selo de demonstração à direita; "N lições" e a marca embaixo.
- **Perfil:** faixa na cor, a foto, o nome, o resumo e o alcance.
- **Genérica:** link encerrado, perfil indisponível, flag desligada ou limite estourado.
- **Fontes:** Quicksand 700 e Nunito 700/800 em WOFF estático em `public/marca/og` (licença OFL, `LICENCA-fontes.txt`, do Fontsource 5.3.0). O desenho não usa nenhuma fonte do sistema. Isso foi provado no build de produção local rodando com um fontconfig vazio.
- Sem e-mail. Conta no limitador das páginas públicas. `noindex` pelo proxy. Os metadados passam a usar `summary_large_image`.

### Acertos da B
- (a) Na publicação, aparece só o tema sugerido (ou o salvo) e o botão "Trocar tema", que abre os 12. Em 390, a legenda e "Publicar" ficam à vista.
- (b) Cartão sem ninguém mostra "Nova" no lugar de "0 estudando · 0 valeus". Os números com zero não aparecem.
- (c) Com zero trilhas, o Em alta some e "Novas" sobe. Com 1 ou 2, aparecem sem buraco, e as setas só existem quando a lista rola.
- (d) O Em alta usa consulta de contêiner: 3 cartões inteiros a partir de 44 rem de lista e 4 a partir de 60 rem (a 1440 px de janela). A 1280 px cabem 3: com 4, o cartão ficaria abaixo de 220 px e a linha de ações quebraria.
- O numeral do top foi para o canto direito da capa, para não bater nos selos quando eles quebram linha.

---

## Etapa C2 — seguir, Novidades e revisão de conteúdo (feita)

### Banco (migração `20261122090000_comunidade_seguir`)
```sql
CREATE TABLE "Seguir" ("seguidorId" TEXT NOT NULL, "seguidoId" TEXT NOT NULL, "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Seguir_pkey" PRIMARY KEY ("seguidorId","seguidoId"));
CREATE INDEX "Seguir_seguidoId_criadoEm_idx" ON "Seguir"("seguidoId", "criadoEm");
-- FKs em cascata para Usuario(id) nos dois lados.
```

### Seguir
- `POST /api/perfis/:perfilId/seguir { ativo }` devolve `{ seguindo, seguidores }`.
- **Regras:**
  - só se segue perfil público (ao menos uma trilha no perfil; senão 404);
  - ninguém segue a si mesmo (`409 seguir_invalido`);
  - conta de visitante não segue (403);
  - perfil de demonstração pode ser seguido (com a flag de demonstração), mas não segue ninguém (`seguir_invalido`); os perfis de demonstração só seguem uns aos outros, criados pelo comando;
  - limite de 60 por hora (`429 limite_comunidade`), como o do Valeu.
- **Público:** só a contagem (`alcance.seguidores` no `/p` e no perfil da dona), nunca a lista. Sem notificação.
- **Com sessão:**
  - `PerfilPublico.seguir` e `TrilhaCompartilhada.seguirDono` (`{ seguindo, podeSeguir }`) mostram o botão no cabeçalho do `/p` e no cartão "Quem compartilhou" do `/t`;
  - a própria pessoa e o visitante recebem `podeSeguir: false`, e o botão não aparece;
  - sem sessão, o botão leva ao login e volta ao `/p`.
- **Explorar, aba "Seguindo"** (ao lado de "Todos", só com sessão): `GET /api/explorar?seguindo=1` traz as trilhas publicadas por quem a pessoa segue, das mais novas para as mais antigas, sem Em alta, com o mesmo filtro de tema e a mesma paginação.
  - `seguindoAlguem` escolhe o vazio do Stu: "Você ainda não segue ninguém", com o convite, ou "Quem você segue ainda não publicou trilhas no Explorar".

### Novidades (`GET /api/perfil/novidades`, privada)
- O que aconteceu com as trilhas da dona nos últimos 7 dias, agrupado e mais recente primeiro:
  - adições por trilha, só a contagem ("3 pessoas começaram sua trilha X");
  - valeus por trilha ("Bia e mais 1 pessoa mandaram valeu em Y");
  - novos seguidores ("Bia e mais 2 pessoas começaram a seguir você"; sem ninguém com perfil público, "2 pessoas novas seguem você").
- Nome e foto só de quem tem perfil público; o resto entra como "alguém" ou "mais N pessoas".
- Sem novidade, uma linha discreta. Cada novidade de trilha abre o mapa dela.

### Revisão de conteúdo
`src/servidor/compartilhar/revisao.ts`: `revisarConteudo` é chamado antes de gravar o nome, o resumo, a legenda (ao publicar) e a foto (já sem metadados). Hoje aprova tudo e não chama nenhum serviço externo. Recusado, responde `422 conteudo_recusado` e não grava nada. `definirRevisor` troca o revisor, usado nos testes e na moderação futura.

### Acertos da C1
- (a) A moldura do código não deixa sobra nos cantos internos: o SVG tem canto arredondado e a imagem baixada recorta o código em cantos concêntricos com a moldura.
- (b) No cartão fica só o selo "Demonstração" da capa; "Perfil de demonstração" continua no `/p`, no `/t` e na imagem de prévia.
- (c) O cache da prévia ficou como está: `no-store` pelo proxy, conferido no site pelo Lead.
- (d) A área dos selos tem altura fixa, numa linha só (o tema encurta com reticências e tem `title`), e o título do cartão alinha em cima.

### Testes
`tests/seguir.test.mjs` (em `test:estudio`), 6 testes:
- regras do seguir, contagem sem lista, estado do botão;
- botão no `/t`;
- aba "Seguindo" (só de quem segue, ordem, pede conta, vazio);
- Novidades (7 dias, agrupamento, nomes só de quem tem perfil público, sem e-mail nem ids);
- demonstração não segue, e limite de 60;
- `revisarConteudo` chamado antes de gravar, e nada gravado quando recusa.

Todos os testes da comunidade conferem só o que criam: passam com e sem o conteúdo de demonstração no banco.

## Rodada de banca (19/11): perfil, Explorar e compartilhar

Três pareceres de jurado (perfil 7,5; Explorar 7; compartilhar 7). Textos novos em `experiencia.ts` (o app herda).

### Perfil
- **Página de outra pessoa:** com a conta aberta, `/p` e `/t` ganham "← Voltar" no topo (volta para de onde a pessoa veio no Studoo; sem histórico, vai ao Explorar).
- **O cartão mostra o que a página pública mostra:** o alcance da dona (`GET /api/perfil`) conta só as trilhas no perfil, como o `/p`; o total, com as trilhas só com o link, vai no título "Trilhas que você compartilha (N)". Com erro no campo, a prévia fica com o último valor salvo.
- **Linha de alcance:** cada item inteiro (sem quebra no meio), sem a bolinha; na página pública, item zerado não aparece (`alcanceItens(..., { semZeros })`). A imagem de prévia do perfil usa a mesma conta.
- **Um verbo só:** "N estudando" (cartão), "N pessoas estudando suas trilhas" (alcance), "N pessoa(s) estudando" (lista), "N pessoas começaram a estudar “X”" (Novidades). Na lista da dona, sem ninguém: "Ainda ninguém estudando nem mandou valeu".
- **Privacidade:** a mesma frase sob o nome, sob a prévia e no recorte ("Quem abrir seu perfil ou suas trilhas compartilhadas vê seu nome, foto, resumo e interesses. Seu e-mail nunca aparece."); "e-mail" nunca quebra (marcadores de junção em volta do hífen); "Só você vê" ao lado do e-mail em Conta.
- **Campo com erro:** borda de 2 px em #c23b4e (o foco vira anel externo), a mensagem logo abaixo com ícone de alerta e o texto de ajuda escondido enquanto o erro durar.
- **Novidades** logo abaixo do cartão; no computador largo (1240 px ou mais), na coluna da direita. Mesmo respiro em todos os tipos; só nomes e título em negrito.
- Controle "Aproximar" do recorte com trilho de 8 px, trecho preenchido em azul e bolinha de 28 px (toque de 44 px); barra de salvar numa linha em 360; título "Perfil" no tamanho de título de página; o "•••" do "Seu próximo passo" dentro da ilustração.

### Explorar
- **Dados de exemplo sem repetição:** o teste da demonstração exige títulos e retratos únicos; a Ana das capturas tem retrato e títulos só dela.
- **Capa:** o tema sempre inteiro no alto; "Demonstração" embaixo à esquerda; o numeral do Em alta embaixo à direita.
- **Fileiras:** fichas de tema numa linha só, rolável, com as setas do Em alta no computador; no celular, fichas e Em alta vão até a borda da tela; esmaecimento de 24 px na borda que ainda tem conteúdo; setas desligadas no começo e no fim.
- Aba "Comunidade | Seguindo" e ficha "Todos os temas"; com tema escolhido, "Em alta em Idiomas esta semana".
- **Faixa do topo** (computador): hoje só leva o selo "Progresso salvo" (Minhas trilhas e dentro da trilha); nas outras telas some. Sem o perfil ligado, leva o "Sair" e fica.
- Na própria trilha, "Abrir minha trilha" e "Compartilhar" com ícone e palavra; denúncia sem motivo marcado ("Enviar" só liga com motivo), com o alvo nomeado («"Título", de Nome») e "a equipe do Studoo revisa"; uma linha explica "Demonstração" enquanto houver conteúdo simulado na tela; sem conta, "Entre para estudar e mandar valeu." com o botão ao lado.
- Cartão: título com duas linhas reservadas em fileira e grade (uma no celular), contagem e números ancorados acima dos botões; "por" em cinza com só o nome sublinhado e o retrato dentro do link; contornos dos controles com 3:1; "Continuar" em azul claro; capas mais baixas no celular.

### Compartilhar e Código Studoo
- Antes de publicar: "Ainda não está no Explorar. Agora: <nível que vale>." e "Publicar"/"Cancelar" presos no rodapé da folha; "Agora" dentro do cartão do nível que vale; cabeçalho da folha preso no topo com "Compartilhar trilha", o nome da trilha e o fechar.
- Nota da folha: "Quem abrir vê seu nome, sua foto e seu resumo. Suas respostas e seu progresso não vão junto."; a folha do perfil diz sob o código o que o perfil público mostra.
- **Moldura do código sempre no azul da marca** (folha e imagem baixada); a cor da pessoa só no miolo dos olhos e no centro. No modo apresentação, sem moldura, com a marca embaixo e título, código e dica num bloco só. Trilha de demonstração leva o selo "Demonstração" sob o título na imagem baixada e na apresentação.
- Ações do código numa grade de duas colunas iguais (vão de 10 px); abaixo de 400 px, uma por linha. "Compartilhar" é o botão principal na folha do perfil; "Apresentar" com ícone de tela cheia.
- `/t`: já adicionada diz "Ela já está nas suas trilhas. Continue de onde parou." e o Stu, "Que bom te ver de novo!"; "Quem compartilhou" vem depois das lições; link encerrado centrado, botão na largura toda no celular e "Ver trilhas no Explorar".

## Lote 4 (19/11): anotações do dono

Regras duradouras: nenhuma janela nativa do sistema ou do navegador (tudo do app, igual em Android, iOS e web; fica do sistema só escolher arquivo, compartilhar para outros apps, permissões e teclado) e nenhuma tela de convite antes dos dados.

### Etapa 1
- **Perfil direto nos dados:** a aba Perfil abre nos campos (foto com selo de câmera, nome, resumo, interesses e cor; "Salvar" liga com mudança) ou, com dados, no perfil como os outros veem com "Editar" abrindo os campos ali mesmo. A tela separada "Editar perfil" saiu.
- **Valeu claro:** coração, "Valeu" e contagem no botão; pulo de 280 ms; aviso do app a cada envio e retirada; textos do gesto num lugar só (`GESTO`).
- **Sem janela nativa:** `noValidate` no formulário da lição; sem `title` como explicação; o aviso do navegador ao fechar a aba saiu.
- **404 própria** em português, com o Stu.

### Etapa 2, parte 1: configurações da trilha (migração `20261123090000_trilha_configuracoes`, só acrescenta)
- `PlanoAprendizado` ganha `descricao`, `tema` e `capa` (anuláveis; nenhuma trilha muda).
- `GET` e `PATCH /api/aprendizado/planos/:id/configuracoes`: só a dona (`nao_encontrado` para as outras); `PATCH` grava um ou mais campos (nome de 3 a 80; descrição até 140 com as regras da legenda; tema dos temas do Explorar; capa da galeria ou `null`), com o gancho `revisarConteudo` para nome e descrição e um teto de 240 mudanças por hora.
- Descrição e tema são a legenda e o tema do link (gravados juntos nos dois sentidos; trilha no Explorar não fica sem tema).
- **Galeria:** 12 capas desenhadas em código (`CAPAS_GALERIA`, `svgCapaGaleria`, `svgCapa`); a padrão continua a de hoje. A capa aparece no cartão de Minhas trilhas (no lugar da ilustração), no alto do mapa, nos cartões do Explorar e do perfil, na página do link e na imagem de prévia. A cópia leva a capa da galeria.
- **Tela:** entradas pelo menu "•••" (Compartilhar, Configurações, Apagar) e pela engrenagem no alto do mapa; seções Capa e nome, Quem pode ver (estado e "Mudar compartilhamento", que abre a folha de sempre) e Apagar trilha (confirmação do app). Cada campo salva ao sair dele, com "Salvo"; erro embaixo do campo; sem diálogo de sair sem salvar.
- Testes em `tests/configuracoes-trilha.test.mjs`.

### Etapa 2, parte 2: capa com foto (migração `20261124090000_trilha_capa_foto`, tabela nova)
- `CapaFoto` (dona e trilha, token único, WebP grande 1024×512 e pequeno 480×240). A trilha guarda `capa = "foto:<token>"`.
- `PUT` e `DELETE /api/aprendizado/planos/:id/capa` (mesma flag da foto do perfil, `STUDOO_COMPARTILHAR`): o retângulo 2:1 recortado no app, conferido pelos bytes, aberto pelo sharp com teto de pixels, sem EXIF, até 10 trocas por hora, com `revisarConteudo` antes de gravar; o token muda a cada troca. `GET /api/capas/:token/:largura` com cache imutável e os mesmos cabeçalhos e limite da foto do perfil. Escolher uma capa da galeria ou a padrão apaga a foto.
- A cópia volta à capa padrão (a foto fica com quem enviou). A imagem de prévia do link usa a capa padrão do tema quando a capa é foto.
- Na tela: "Usar uma foto" na galeria e o mesmo recorte do perfil na proporção 2:1 (`RecorteImagem`). Por cima da foto, um véu escuro suave no alto e embaixo mantém legíveis o tema, "Demonstração" e o numeral do Em alta (`marcacaoCapa`).

## Revisão do dono (19/11): Curtir e perfil direto nos dados

Revisão de design do que foi ao ar em `6122cc2` (lote 4: `59f95bb` perfil, `8502293` Valeu), a partir das capturas do iPhone do dono e das do site em 390 e 1440. Vale igual para web, Android e iPhone: o app espelha na mesma rodada. Tudo aqui é decisão de design, menos o que está marcado **(dono)**. Esboços: `ux/01-valeu-perfil` na pasta do Designer.

### O que muda, do mais grave ao menos grave
1. **(dono) O nome do gesto.** "Valeu" não passou no teste dos 3 segundos: o dono tocou e não soube o que fazia. Recomendação: **Curtir**. O coração já quer dizer "curtir" para quem usa qualquer rede no Brasil; "Valeu" é interjeição, soa como resposta ("ok, obrigado") e não como ação; os vizinhos do cartão são verbos (Quero estudar, Compartilhar, Denunciar, Seguir). O sentido de agradecer continua no aviso e nas Novidades. A troca é na constante `GESTO` e nos textos da tabela de textos (a palavra muda de gênero: "uma curtida").
2. **Avatar com "?" no perfil vazio.** Sem nome e sem foto, o círculo mostra o desenho `pessoa` (44 px, branco, traço 2,5) na cor do perfil. A inicial aparece assim que o nome ganha uma letra.
3. **"Tudo salvo" sem nada salvo.** Com nada mudado, a barra não mostra estado e "Salvar" fica desligado. "Tudo salvo" sai do editor: salvar fecha os campos e mostra o aviso do app "Perfil salvo.".
4. **Alcance com zeros e ponto pendurado no fim da linha.** A linha vira uma fileira de números com até três colunas, só com os itens acima de zero, na dona e na página pública. Tudo zero: a fileira não aparece.
5. **Confirmação de apagar sem título.** Título, texto e aviso do link em blocos separados (ver "Confirmação de apagar trilha").
6. **Aviso a cada toque, em três linhas.** O aviso que explica o gesto aparece só na primeira curtida da pessoa naquele aparelho, com texto de duas linhas. Nas outras, o retorno é o coração e o número; o leitor de tela ouve a frase curta.
7. **Curtido mais forte que a ação principal.** Marcado, o botão continua branco, com o contorno de 3:1; só o coração enche. Sai o fundo rosa com borda rosa (era o achado 25 da banca: "Continuar" perdia para o Valeu).
8. **Nome acessível que muda e botão que desliga.** O nome fica fixo e o estado vem do `aria-pressed`. O botão não desliga durante o envio: acabam a piscada de opacidade e a perda de foco.
9. **Bloco da foto pesado.** Saem a caixa tingida, a dica técnica ("JPG, PNG ou WebP, até 2 MB…", que nem vale antes do recorte) e o "Remover foto" solto no formulário. O "Remover foto" vai para o menu da foto.
10. **Dois textos explicando a mesma coisa.** A frase de privacidade sobe para o alto dos campos, com um cadeado, no lugar de "É assim que as pessoas te veem…"; sob o nome fica uma dica curta.
11. **Barra de salvar que quebra.** Em 390 e 360, o estado subia para cima do botão e a barra mudava de altura. Agora ela ocupa a largura da tela, numa linha só.
12. **"Cancelar" perde o que foi digitado sem perguntar.** Com alteração, ele abre a mesma confirmação "Sair sem salvar?".
13. **"Nova" some na primeira curtida e o cartão encolhe.** A linha de números tem altura fixa e mostra "N estudando" ou "Nova" (ninguém estudando). A curtida mora no botão e não mexe na linha.
14. **Ações do perfil empilhadas.** "Editar" e "Compartilhar" ficam numa fileira só.

### Curtir
**Onde aparece.** No cartão de trilha: Explorar (Em alta, Novas, Seguindo), perfil de outra pessoa e prévia `/t`. Na trilha da própria pessoa não há botão: a contagem vai na linha de números ("5 estudando · 6 curtidas").

**Anatomia** (igual nos três):
- Botão de contorno com altura mínima de 44 (48 dp de toque no Android, como a P8), raio 14, contorno de 2 px #8792BD, fundo branco e 14 de folga dos lados. Ocupa o que sobra da fileira, ao lado de Compartilhar e "•••" (44×44), com 8 entre eles.
- Por dentro: coração de 20 px (traço 2,5), 6 px de vão, "Curtir" (Nunito 800, 16/24, #1B2A5E). Com 1 curtida ou mais, 8 px de vão e o número (Nunito 800, 16/24, algarismos tabulares, #5E6A85). Sem curtidas, sem número.

| Estado | Coração | Palavra e número | Fundo e contorno |
|---|---|---|---|
| Normal | contorno #1B2A5E | #1B2A5E e #5E6A85 | branco, #8792BD |
| Curtido | cheio #D6336C (4,6:1) | #A3204A (7,3:1) | branco, #8792BD |
| Pressionado | igual | igual | fundo #F1F4FD |
| Foco pelo teclado | igual | igual | anel de 3 px #3858D6, afastado 2 px |
| Enviando | o estado novo já aparece | igual | continua tocável |

- **Erro de rede:** volta ao estado anterior e o aviso "Não deu para curtir agora. Confira a conexão e tente de novo.".
- **Limite (429):** volta e o aviso "Muitas curtidas seguidas. Tente de novo daqui a pouco.".
- **Sem sessão:** o toque leva à entrada e volta ao mesmo cartão já curtido (`?curtir=<código>`, aplicado uma vez).
- **Conta temporária (visitante):** o coração volta ao estado anterior e o aviso do app, visível (não só anunciado), diz "Curtidas precisam de uma conta. Como visitante, você continua estudando normalmente.". **Sem botão**, na web e no app: entrar com uma conta encerra a visita, e as trilhas dela ficam para trás. **Sem sessão** (página pública), continua o "entrar e voltar" de hoje. (Corrigido em 19/11.)
- **Toques rápidos:** vale o último estado. Com um envio em andamento, o app guarda o estado desejado e, quando a resposta chega, manda de novo só se ainda for diferente.

**Movimento.**
- Ao curtir, o coração enche e cresce para 1,3× e volta em 280 ms (curva 0.2, 0.9, 0.3, 1.4). O número sobe: o antigo sai para cima e o novo entra por baixo, em 180 ms.
- Ao descurtir, o coração esvazia em 120 ms, sem pulo, e o número desce.
- Com movimento reduzido, a troca é na hora, sem pulo nem rolagem do número.

**Aviso da primeira vez.**
- É o aviso do app (nunca o do sistema) e aparece só na primeira curtida da pessoa no aparelho (`studoo.gestoExplicado` no localStorage; SecureStore no app).
- Faixa no pé da tela, 16 acima da barra de abas, largura de até 480 com 16 de margem, raio 16, fundo #1B2A5E, coração cheio de 20 px à esquerda e texto branco (Nunito 800, 15/22).
- Entra subindo 10 px em 220 ms (com movimento reduzido, só aparece) e some em 5 s. Um aviso por vez. Não recebe foco; tem papel de status.
- Texto: "Caio vai ver sua curtida. Curtidas levam trilhas ao Em alta." (o primeiro nome de quem fez).

**Desfazer.** Tocar de novo descurte. O aviso não tem "Desfazer": o próprio botão já faz isso, e um aviso com ação teria de receber foco.

**Acessibilidade.**
- Nome fixo: "Curtir “<título>”". Estado por `aria-pressed` (web) e `accessibilityState.selected` (app).
- A contagem vai na descrição ("6 curtidas"; sem curtidas, nada): `aria-describedby` na web e `accessibilityValue` no app.
- Ao curtir, a região viva diz "Você curtiu “<título>”."; ao descurtir, "Curtida retirada de “<título>”.". O aviso da primeira vez também é lido.

**Textos finais.** A coluna "Valeu" vale só se o dono mantiver a palavra.

| Onde | Curtir (recomendado) | Valeu (se o dono mantiver) |
|---|---|---|
| Botão | Curtir | Valeu |
| Contagem | 1 curtida · 6 curtidas | 1 valeu · 6 valeus |
| Nome acessível | Curtir “X” | Mandar valeu para “X” |
| Ao marcar (leitor de tela) | Você curtiu “X”. | Valeu enviado para “X”. |
| Ao desmarcar (leitor de tela) | Curtida retirada de “X”. | Valeu retirado de “X”. |
| Aviso da primeira vez | Caio vai ver sua curtida. Curtidas levam trilhas ao Em alta. | Caio vai ver seu valeu. Valeus levam trilhas ao Em alta. |
| Erro de rede | Não deu para curtir agora. Confira a conexão e tente de novo. | Não deu para mandar o valeu agora. Confira a conexão e tente de novo. |
| Limite | Muitas curtidas seguidas. Tente de novo daqui a pouco. | Muitos valeus seguidos. Tente de novo daqui a pouco. |
| Conta temporária | Curtidas precisam de uma conta. Como visitante, você continua estudando normalmente. | O valeu precisa de uma conta. Como visitante, você continua estudando normalmente. |
| Faixa sem conta (Explorar) | Entre para estudar e curtir. | Entre para estudar e mandar valeu. |
| Legenda do Em alta | As trilhas que mais gente começou e curtiu nos últimos 7 dias. | As trilhas que mais gente começou e mandou valeu nos últimos 7 dias. |
| Lista da dona, sem ninguém | Ainda sem ninguém estudando e sem curtidas | Ainda sem ninguém estudando e sem valeus |
| Novidades | Bia curtiu “Y” · Bia e mais 2 pessoas curtiram “Y” | Bia mandou um valeu em “Y” · Bia e mais 2 pessoas mandaram valeu em “Y” |
| Novidades, vazio | Sem novidades nesta semana. Quando alguém começar ou curtir uma trilha sua, ou seguir você, aparece aqui. | Sem novidades nesta semana. Quando alguém começar uma trilha sua, mandar um valeu ou seguir você, aparece aqui. |

### Perfil direto nos dados
Confirma o que está no ar: a aba Perfil nunca mostra o cartão "Como você quer aparecer?". Sem nome, os campos já vêm abertos; com nome, o cabeçalho mostra o perfil como os outros veem, e "Editar" abre os mesmos campos ali mesmo, sem outra tela nem diálogo.

**Ordem**, igual à do cabeçalho público: privacidade, foto, nome, resumo, interesses e cor.

| Campo | Rótulo | Dica | Limite | Erro |
|---|---|---|---|---|
| Privacidade | — | Cadeado de 16 px e "Quem abrir seu perfil ou suas trilhas compartilhadas vê seu nome, foto, resumo e interesses. Seu e-mail nunca aparece." (Nunito 700, 14/20, #5E6A85) | — | — |
| Foto | "Adicionar foto" (sem foto) ou "Trocar foto" | "Opcional. Sem foto, aparece a inicial do seu nome." | o recorte regrava em JPEG quadrado de até 1024 px | "Não deu para abrir esta imagem. Tente outra foto." · 422: "Use uma foto JPG, PNG ou WebP de até 2 MB." · 429: "Você trocou de foto muitas vezes. Tente de novo daqui a pouco." |
| Nome | "Seu nome" | "Nome ou apelido, de 2 a 40 caracteres." | 2 a 40 | vazio: "Escreva como você quer aparecer." · curto: "Use pelo menos 2 caracteres." · longo: "Use até 40 caracteres." · caracteres e endereço: os de hoje |
| Resumo | "Resumo (opcional)" | "Uma frase sobre você e o que gosta de estudar." e o contador "0 de 160" | 160, uma linha | os de hoje |
| Interesses | "Interesses (opcional)" | "Escolha até 5 · 2 escolhidos" | 5 | na sexta: "Você já escolheu 5. Desmarque um para trocar." |
| Cor | "Cor do perfil" | "Pinta a faixa do perfil e a inicial, quando não há foto." | 6 cores | — |

**Foto.**
- Avatar de 96 com borda branca de 4 e o selo de câmera (40×40, #3858D6, borda branca de 3) no canto de baixo à direita. Ao lado, o link "Adicionar foto" ou "Trocar foto" (Nunito 800, 16, #3858D6) e a dica.
- Tocar no avatar ou no link abre o menu de ações do Studoo (pedido 4), com o título "Foto do perfil" (chave nova `perfil.fotoFolhaTitulo`: no celular é o título da folha da spec 11, e na web, o nome acessível do menu; `fotoRotulo`, "Foto", fica só no título oculto da seção): "Escolher da galeria", "Tirar foto" (só em tela de toque), "Remover foto" (só com foto, em vermelho, com a confirmação de hoje) e "Cancelar". Quando o menu teria uma opção só (computador, sem foto), o seletor de arquivo abre direto.
- No app, galeria, câmera e recorte continuam os do sistema (P18). A foto salva na hora, pelo "Usar esta foto" do recorte, à parte do botão "Salvar".

**Salvar com botão** (não salva sozinho). O nome é público e só vale completo: salvar campo a campo mostraria nomes pela metade nas trilhas compartilhadas.

**Barra de salvar**, enquanto os campos estão abertos:
- Presa no pé da tela, acima da barra de abas. No celular, ocupa a largura da tela; no computador, a largura do cartão.
- Altura de 72 (12 + botão de 48 + 12) mais a área segura; fundo branco e linha de 1 px #E1E7FA em cima.
- Uma linha só: o estado à esquerda (Nunito 800, 14/18, até duas linhas) e os botões à direita, com 8 entre eles. Perfil vazio: só "Salvar" (primário, 120 de largura mínima). Editando: "Cancelar" (secundário) e "Salvar" (primário), com 104 de largura mínima cada abaixo de 400 px e 120 acima.

| Estado | Texto na barra | "Salvar" | O resto |
|---|---|---|---|
| Nada mudou | nenhum | desligado | perfil vazio: desenho de pessoa no avatar |
| Mudou algo | "Alterações não salvas" (#9A5B00, bolinha de 8 px antes); quando a barra tem "Cancelar" e "Salvar" numa tela de até 400 px, "Não salvo" (chave nova `perfil.naoSalvoCurto`), para caber numa linha | ligado | — |
| Salvando | "Salvando…" (#5E6A85) | "Salvando…", com `aria-busy` | campos travados |
| Erro de campo | "Confira os campos marcados." (#C23B4E, ícone de alerta) | ligado | borda de 2 px #C23B4E, mensagem sob o campo e foco no primeiro campo com erro |
| Erro de rede | "Não deu para salvar. Confira a conexão e tente de novo." (#C23B4E) | ligado | os campos guardam o que foi digitado |
| Salvo | — | — | os campos fecham, o cabeçalho mostra o perfil, o aviso do app diz "Perfil salvo." e o foco vai para "Editar" |
| Sair ou cancelar com alteração | — | — | a confirmação "Sair sem salvar?", com o texto "As mudanças no nome, no resumo, nos interesses e na cor se perdem." e as ações "Sair sem salvar" (vermelha, em cima) e "Continuar editando" (embaixo, com o foco), uma por linha (o rótulo não cabe na metade) |

**Perfil preenchido.**
- O cabeçalho continua como está: faixa, foto de 96 (112 no computador), nome, resumo e interesses.
- Sem resumo, o convite "Conte em uma frase o que você gosta de estudar." abre os campos com o foco no resumo.
- **Números:** fileira de até três colunas, com 24 entre elas. Cada coluna tem o número (Quicksand 700, 22/26, #1B2A5E) e, embaixo, o rótulo (Nunito 700, 13/18, #5E6A85): "trilha" ou "trilhas", "estudando", "seguidor" ou "seguidores". Só entram os itens acima de zero; com tudo zero, a fileira não aparece. O leitor de tela ouve uma frase só: "2 trilhas compartilhadas, 4 pessoas estudando suas trilhas, 3 seguidores".
- **Ações** numa fileira, metade cada, com 44 de altura: "Editar" (lápis) e "Compartilhar" (só com perfil público; sem ele, "Editar" ocupa a fileira).

**Paridade.** Mesma ordem, textos e medidas na web, no Android e no iPhone. Menu e confirmações são os componentes do Studoo (pedido 4); do sistema ficam só a galeria, a câmera com o pedido de permissão e o recorte (P18). Com a barra presa no pé da tela nos dois lados, a P21 da spec 07 deixa de ser diferença.

### Confirmação de apagar trilha
Título, texto e ações separados, no componente de confirmação do Studoo (medidas e movimento no pedido 4):
- **Título** (Quicksand 700, 20/26, #1B2A5E): "Apagar “<título>”?".
- **Texto** (Nunito 400, 16/24, #5E6A85). Sem progresso: "A trilha e as 7 lições saem da sua conta. Não dá para desfazer." Com progresso: "A trilha, as 7 lições e o seu progresso (3 concluídas) saem da sua conta. Não dá para desfazer."
- **Com link**, um parágrafo à parte: "O link de compartilhamento desta trilha também deixa de funcionar."
- **Ações**, metade cada, com 48 de altura: "Cancelar" (secundário, recebe o foco) e "Apagar" (fundo #C23B4E, texto branco, lábio #8F2A39).
- Em toda confirmação, quando um rótulo não cabe na metade, as ações ficam uma por linha, na largura toda, com a ação em cima e a segura embaixo, como na spec 11; o foco começa na segura. (Corrigido em 19/11: antes dizia "a segura em cima".)

### O que fica para o dono
- Curtir ou Valeu.
- Proposta: o botão de curtir também no mapa da trilha recebida, no bloco "Esta trilha é de <nome>". Quem chega ao fim de uma trilha é quem mais tem motivo para agradecer, e hoje ali não há o botão.

## Revisão de design (19/11): configurações da trilha, capas e selos sobre foto

Revisa as configurações (`094d841`) e a capa com foto (`0a77fe0`), as duas já na integração (`567e507`). Vale para web, Android e iPhone; o app ainda não tem a tela e entra com estas medidas. Esboço: `configuracoes-390.png`, na pasta de trabalho do Designer (`ux/03-configuracoes-capa`).

**Fica como está:** as entradas (menu "•••" e engrenagem no mapa), as três seções na ordem Capa e nome, Quem pode ver e Apagar trilha, o salvamento campo a campo sem diálogo de sair, o erro embaixo do campo, a galeria com o Padrão e as 12 capas e os nomes delas, o recorte 2:1 da foto e o aviso de que a cópia fica com a capa padrão.

**Mudanças, da mais grave para a menos:**

1. **Confirmação de apagar (grave).** Hoje é um parágrafo só, todo em negrito e sem título. Passa a ser a confirmação do Studoo, igual à do perfil: título “Apagar “<nome>”?” (Quicksand 700, 20/26); texto em peso normal, “Você já concluiu 3 de 7 lições. As lições e esse progresso também serão apagados.” (sem progresso: “As 7 lições também serão apagadas.”); o aviso do link num parágrafo à parte, só quando há link: “O link de compartilhamento desta trilha também deixa de funcionar.”; “Cancelar” (secundário, com o foco) e “Apagar” (vermelho cheio `#C23B4E`, degrau `#8F2A39`).
2. **“Salvo” longe do campo (grave).** Hoje ele aparece embaixo do título da página, e quem edita a descrição ou o tema, mais abaixo, não vê. Passa para o rótulo do campo, à direita: “Salvando…”, com um giro de 14 px em `#5E6A85`, e depois “Salvo”, com visto, em 13 px 800 `#1F7A5A`, que some em 2,5 s (saída de 200 ms; com movimento reduzido, some sem transição). O leitor de tela ouve “Nome da trilha salvo.” (`aria-live` educado). O “Salvo” do título sai.
3. **Ajuda da foto quebrando ao lado do botão (média).** “JPG, PNG ou WebP, até 2 MB” fica ao lado de “Usar uma foto” e joga o “MB” para a linha de baixo. O botão passa a ocupar a largura da folha (altura de 48), e a ajuda vai embaixo, numa linha só: “JPG, PNG ou WebP, até 2 MB.”
4. **Capa escolhida marcada só pela cor da borda (média).** A escolhida ganha, além da borda de 3 px `#3858D6`, um visto num círculo de 24 px `#3858D6`, com contorno branco de 2 px, no canto de cima à direita. A galeria é um grupo de escolha única (`radiogroup`, com `aria-checked` em cada capa; no app, `accessibilityState.selected`), e o nome da capa é o nome acessível. Escolher salva, mostra o visto, fecha a folha em 300 ms e avisa “Capa salva.”.
5. **Prévia da capa pequena (média).** Hoje é uma capa de 240 × 120 à esquerda, com “Capa: Pôr do sol” e o botão embaixo. A prévia passa a ocupar a largura da seção, em 2:1 e raio de 16, com “Trocar capa” por cima, no canto de baixo à direita: pílula branca de 40 px, ícone de imagem de 18 px, texto de 15 px 800 `#2A44A8` e sombra `0 2px 8px rgba(15, 23, 42, .25)`. Tocar em qualquer ponto da capa também abre a galeria. “Capa: Pôr do sol” sai da tela e fica no nome acessível (“Trocar capa. Capa atual: Pôr do sol”).
6. **Véu também embaixo da foto (baixa).** O véu de baixo escurece a foto onde não há texto. Ele fica só nos 45% de cima, de `rgba(15, 23, 42, .38)` a zero; embaixo, só quando houver texto por cima da capa.
7. **Rótulo do Padrão (baixa).** “Padrão · A cor e o desenho do tema” quebra em duas linhas miúdas. Passa a ser “Padrão” e, embaixo, “Do tema” (13 px 700 `#5E6A85`).

**Leitura dos selos por cima de foto e de capa desenhada.**

- O selo é sempre sólido, nunca translúcido: fundo branco (o de Demonstração, `#FFF4DB` com texto `#7A4A00`), texto `#1B2A5E` em 13 px 800, altura de 28, 12 px dos lados, raio 99, borda de 1 px `rgba(27, 42, 94, .10)` e sombra `0 2px 6px rgba(15, 23, 42, .22)`. O texto passa de 7:1 contra o próprio fundo, qualquer que seja a foto; a borda e a sombra separam o selo das capas claras (Areia, Céu).
- Posição: canto de cima à esquerda, a 12 px das bordas, um embaixo do outro com 6 px. No máximo dois selos na capa; um terceiro vai para a linha de dados do cartão.
- Numeral do Em alta: Quicksand 700 de 64 px, branco, com contorno de 4 px `#1B2A5E` por trás do preenchimento, no canto de cima à direita, a 10 px.
- Véu: só em foto, como no item 6. Nenhum outro texto vai solto direto na foto.
- No recorte da foto, a área dos selos aparece por cima, tracejada (dois retângulos de 28 px de altura, brancos a 55%), para a pessoa não deixar o principal da foto embaixo deles. Texto do recorte: “Arraste para posicionar e afaste os dedos para aproximar. A área marcada fica embaixo dos selos.” Na web, a roda do mouse e o controle aproximam, e as setas movem 8 px (com Shift, 32 px).

**Quem decide.** Tudo nesta seção é decisão de design. Nada precisa do dono.
