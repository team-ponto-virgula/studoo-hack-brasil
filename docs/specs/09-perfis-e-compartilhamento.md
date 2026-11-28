# 09 — Perfis e compartilhar trilha

## Ideia
Compartilhar é dar uma cópia. A pessoa cria um link da trilha; quem abre vê uma prévia e adiciona às próprias trilhas, pronta na hora (sem geração, sem custo de IA), com progresso do zero. Nada do estudo de quem compartilhou vai junto.

Tudo fica atrás de `STUDOO_COMPARTILHAR=1`, desligado por padrão. Sem a flag, nenhuma tela, rota ou item novo aparece: as rotas novas respondem `404 nao_encontrado`, `GET /api/auth/config` traz `compartilhar: false` e as listas não trazem as marcas `link`/`recebida`.

## Decisões de produto
1. **Perfil:** nome (2 a 40 caracteres) e cor do avatar (a inicial do nome num círculo; 6 cores: `azul`, `verde`, `laranja`, `roxo`, `rosa`, `turquesa`, com o fundo em `FUNDO_DA_COR`). O e-mail nunca aparece para outra pessoa.
   - *Revisto em 18/11 (spec 10):* a parte "sem foto, bio, seguidores, contagem pública ou ranking" caiu por ordem do dono. Foto, resumo, interesses e alcance estão na [spec 10](10-comunidade.md). A D16 continua para pessoas: nada de XP, sequência, medalha, moeda nem ranking de pessoas.
2. **Privado por padrão.** O link é não listado: só abre quem tem. Mostrar a trilha no perfil público é escolha à parte, por trilha, desligada por padrão. O perfil público só existe quando há ao menos uma trilha marcada.
3. **Vão junto:** título, partes, lições com conteúdo, exercícios e recursos, e o rótulo de origem. **Não vão:** o objetivo digitado (a cópia guarda o título no lugar), progresso, respostas, erros, tempos, pontes, textos do Explique, nada de voz.
4. **Trilha feita de material** (decidido com o Lead em 18/11):
   - O nome do arquivo não vai: `referencias[].nome` vira "Material de Ana" (o nome de quem compartilhou, gravado na hora da cópia).
   - `referencias[].materialId` vira `MATERIAL_COMPARTILHADO` (`"compartilhado"`), que não aponta para nada. Nenhum pedido da cópia bate no registro de material de outra pessoa.
   - Fotos de página (recurso `imagem` em data URL) não vão; a lição fica sem esse recurso e continua válida.
   - Vão o trecho citado e o número ou rótulo da página.
   - Origem da trilha e das lições na cópia: "Material de Ana". Na aula da cópia, `LicaoDetalhe.materialDe` traz o nome; o cabeçalho da citação vira "Baseado no material de Ana" e nenhum texto diz "seu material" ou "Material enviado".
   - O título vai como a dona vê na folha. Quando ele traz o nome do arquivo (caso "Estudar <arquivo>" da IA simulada), a folha acrescenta "O título desta trilha traz o nome do seu arquivo." e o aviso não afirma que o nome não vai (`avisoMaterialComTitulo`).
   - Aviso da folha: "Esta trilha veio de um material seu. Vão junto os trechos citados nas lições e as páginas de onde vieram. O arquivo, o nome dele e as fotos das páginas não vão."
5. **Trilha recebida não é recompartilhada** (`409 trilha_recebida`). No lugar de "Compartilhar": "Esta trilha é de <nome>" e o link original, se ainda estiver ativo.
6. **Apagar a trilha encerra o link** (cascata no banco; a confirmação de apagar avisa). Parar de compartilhar não apaga as cópias de quem já adicionou.
7. **Conta de visitante** não compartilha nem tem perfil (`403 compartilhar_visitante`); pode adicionar.

## Banco (migração `20261118210000_perfis_compartilhar`, só acrescenta)
- `Usuario`: `perfilNome`, `perfilCor`, `perfilId` (único; 96 bits aleatórios em base64url, criado no primeiro salvamento do perfil).
- `LinkTrilha`: `codigo` (chave; 96 bits aleatórios, 16 caracteres base64url, sem relação com ids internos), `usuarioId`, `planoId`, `noPerfil`, `adicoes`, `criadoEm`. Um link por trilha (`@@unique([usuarioId, planoId])`). Encerrar apaga a linha, então link encerrado e inexistente são o mesmo caso. Chave estrangeira para a trilha com `ON DELETE CASCADE`.
- `PlanoAprendizado` (na cópia): `origemNome` e `origemPerfilId` (de quem veio, no momento da cópia) e `origemCodigo` (o código do link), com `@@unique([usuarioId, origemCodigo])`: o mesmo link adicionado duas vezes não duplica, nem com pedidos simultâneos.
- A cópia lê as lições da trilha original na hora de adicionar e grava trilha, partes e lições novas (ids novos, no mesmo formato das trilhas aceitas). Nada aponta para registros de quem compartilhou.

## API
| Rota | Acesso | O que faz |
|---|---|---|
| `GET /api/perfil` | privada | Nome, cor, `perfilId`, `publico`, e-mail, `visitante` e os links da pessoa (com `adicoes`, só para a dona). |
| `PUT /api/perfil` `{ nome, cor }` | privada | Salva (nome normalizado e validado por `motivoNomeInvalido`); cria o `perfilId` na primeira vez. |
| `GET /api/aprendizado/planos/:id/compartilhar` | privada, dona | O que a folha mostra: título, contagens, `deMaterial`, `tituloTemNomeDoArquivo`, perfil e link. |
| `POST /api/aprendizado/planos/:id/compartilhar` | privada, dona | Cria o link (ou devolve o existente). Exige nome (`409 perfil_incompleto`). |
| `PATCH /api/compartilhar/:codigo` `{ noPerfil }` | privada, dona | Mostrar ou não no perfil público. |
| `DELETE /api/compartilhar/:codigo` | privada, dona | Parar de compartilhar. |
| `GET /api/compartilhar/:codigo` | pública (sessão opcional) | Prévia: código, título, origem, total de lições, partes com os títulos das lições, dono (nome, cor, `perfilId` só com perfil público). Com sessão: `situacao` (`nova`, `adicionada`, `sua`) e `planoId` da própria trilha. |
| `POST /api/compartilhar/:codigo/adicionar` | privada | Adiciona a cópia; devolve `{ planoId, jaTinha, dono }`. Da própria dona: `409 trilha_propria`. |
| `GET /api/perfis/:perfilId` | pública | Nome, cor e as trilhas marcadas. Sem nenhuma marcada: `404`. |

Nas listas e no mapa (`PlanoResumo`/`PlanoDetalhe`, com a flag): `link` (da dona) e `recebida` (`nome`, `perfilId` só se o perfil é público agora, `codigoAtivo` só se o link original ainda existe).

Link de outra pessoa nas rotas da dona, código fora do formato, link encerrado e inexistente respondem todos `404 link_inativo`, com o mesmo corpo.

## Segurança
- Código do link e id do perfil: `randomBytes(12)` em base64url (96 bits).
- Limites (`consumirLimite`, persistentes): rotas públicas 120 por 15 min por endereço quando o endereço é confiável (`STUDOO_PROXY_HTTPS=1`, `enderecoRede`); sem endereço confiável ("loopback" ou "desconhecido"), um disjuntor global de 3.000 por 15 min, para uma plateia abrindo o mesmo link não travar todos os links. A página `/t/<código>` conta uma vez por abertura (ela lê o serviço direto, sem chamar a API). Criar link 20 por hora por conta; adicionar 30 por hora por conta; salvar perfil 30 por hora; até 20 links ativos por conta. Estouro: `429 limite_compartilhar`.
- Só a dona cria, altera ou encerra o link. Nenhuma resposta pública traz e-mail, id de usuário, objetivo digitado ou progresso (testado pelas chaves exatas da resposta e por busca dos valores).
- Nome: NFC, espaços normalizados, 2 a 40 caracteres, sem `<`/`>`, sem caracteres de controle ou invisíveis, sem endereço de site nem e-mail.
- As rotas que mudam estado passam por `rotaPrivada` (mesma checagem de origem e canal das outras). A prévia pública usa `rotaPublicaComSessao`: aceita cookie da web ou Bearer do app, sem exigir.

## Telas (web; o app copia)
Todos os textos estão em `mensagens.compartilhar` e `mensagens.perfil` (`packages/contratos/src/experiencia.ts`). Componentes da web em `src/app/compartilhar.tsx` e `src/app/compartilhar.css`; páginas públicas em `src/app/t/[codigo]/page.tsx` e `src/app/p/[id]/page.tsx`.

1. **Entradas para compartilhar** (só em trilha da própria pessoa, nunca em trilha recebida): "Compartilhar" no menu "•••" do cartão, acima de "Apagar"; botão secundário no cabeçalho do mapa (vira "Compartilhada" com link ativo); com a trilha concluída, "Compartilhar esta trilha" no quadro do troféu do mapa e na tela de fim da trilha.
2. **Folha "Compartilhar trilha"** (sobe de baixo no celular; cartão central a partir de 768 px; `role="dialog"`, `aria-modal`, foco no título de cada passo, Tab preso, Esc fecha e devolve o foco a quem abriu):
   - (a) sem nome: "Como você quer aparecer?", campo do nome com a dica do e-mail, 6 cores em rádio, prévia "Compartilhada por Ana" com o avatar, "Continuar"; erro do nome em texto (`nomeErros`), com `aria-invalid`.
   - (b) resumo: título, "N lições em M partes", "Compartilhada por Ana", a frase de começar do zero; em trilha de material, o aviso (e, quando o título traz o arquivo, a variante e a linha "O título desta trilha traz o nome do seu arquivo."); "Criar link".
   - (c) link pronto: o endereço num campo só de leitura; "Compartilhar" (Web Share, só quando o navegador tem) e "Copiar link" (vira a ação principal sem Web Share); "Link copiado" em região viva; chave "Mostrar no meu perfil" (`role="switch"`) com a dica; "Parar de compartilhar".
   - (d) parar: confirmação dentro da folha (título, texto, "Continuar compartilhando" e "Parar de compartilhar"); Esc volta ao passo (c).
   - visitante: "Para compartilhar, entre com uma conta." e "Fechar".
3. **Selos nos cartões**: "Compartilhada" (dona, link ativo); "Compartilhada por Ana" (recebida; o nome leva a `/p/<id>` quando o perfil é público).
4. **Mapa da trilha recebida**: no cabeçalho, "Esta trilha é de Ana" (nome com link ao perfil público, se houver) e "Ver o link original" (se o link ainda está ativo); sem "Compartilhar". Depois de adicionar: "Trilha adicionada. Compartilhada por Ana." no próprio cabeçalho (fica à vista mesmo com o mapa rolando até a lição).
5. **Apagar trilha com link**: a confirmação acrescenta "O link de compartilhamento desta trilha também deixa de funcionar."
6. **Perfil** (terceiro item da barra de baixo no celular; cartão no rodapé da lateral no computador; entre 768 e 1023 px, "Perfil" no cabeçalho; "Sair" sai do cabeçalho e fica no Perfil): cartão com avatar, nome e "Editar" (ou o formulário, sem nome); "Trilhas que você compartilha" (título que abre a trilha, "Compartilhada desde <data> · N pessoas adicionaram", chave do perfil, "Copiar link", "Parar de compartilhar" com `alertdialog` e foco em "Continuar compartilhando"); "Seu perfil público" (privado ou público, "Ver como os outros veem"); "Conta" (e-mail e "Sair"). Conta de visitante: só o aviso e "Sair".
7. **Página `/t/<código>`** (sem login, renderizada no servidor, `noindex` no meta e no cabeçalho `X-Robots-Tag`, Open Graph com título, "Trilha com N lições, compartilhada por Ana" e a imagem estática `icone-512.png`): avatar e "Ana compartilhou uma trilha com você", título, "N lições · origem", a ação logo abaixo (visível sem rolar até 600 px), "Você começa do zero, no seu ritmo." e as lições por parte. Ações por situação: sem sessão "Entrar para adicionar" (volta do login e adiciona sozinha); "Adicionar às minhas trilhas"; já adicionada "Você já adicionou esta trilha." e "Abrir nas minhas trilhas"; da própria dona "Compartilhada por Ana", "Esta trilha é sua" e "Abrir trilha", sem "começa do zero". Link encerrado ou inexistente (o mesmo estado): Stu, "Este link não está mais ativo", o texto e "Criar minha trilha", com HTTP 404 desde a spec 10 (antes respondia 200). A spec 10 também acrescenta o Stu de boas-vindas e o cartão "Quem compartilhou".
8. **Página `/p/<id>`** (`noindex`): o cabeçalho do perfil da spec 10 (antes: avatar e nome), "Trilhas de Ana" e um cartão por trilha marcada (título, "N lições · origem"), que abre `/t/<código>`. Sem trilha marcada: "Este perfil não está disponível".
9. **"Adicionar por link"** (na nova trilha, antes de "Ver como funciona"): abre o campo ("Link ou código da trilha", dica), "Ver trilha" (ou Enter); código inválido: "Confira o link: ele termina com um código de 16 letras e números."; link inativo: o mesmo estado da página; válido: a mesma prévia da página, com as mesmas ações.
10. **Aula de uma cópia de material**: "Baseado no material de Ana [1]", cartão "[1] Fonte do material de Ana" com "Material de Ana · Página 2" e o trecho; origem "Material de Ana"; sem a foto de página.

## Testes
Navegador (roteiro com Playwright fora da verificação automática, que não tem navegador): foco e teclado na folha e nas confirmações, região viva do "Link copiado", página `/t` sem e-mail e com `noindex`, ação visível sem rolar, volta do login adicionando sozinha, aula da cópia sem "seu material" nem foto, e, num servidor sem a flag, nenhuma tela ou item novo.

`tests/compartilhar.test.mjs` (em `test:estudio`): regras do nome; sem a flag nada aparece; visitante e perfil incompleto; dona exclusiva; cópia sem nada da lista "não vão" e sem duplicar; respostas públicas sem e-mail, ids, objetivo ou progresso; encerrado igual a inexistente; parar não apaga cópias; apagar a trilha encerra o link; perfil público só com trilha marcada; trilha de material sem nome do arquivo, sem `materialId` válido e sem data URL; teto de links ativos.
