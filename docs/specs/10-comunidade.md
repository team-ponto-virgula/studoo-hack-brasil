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
