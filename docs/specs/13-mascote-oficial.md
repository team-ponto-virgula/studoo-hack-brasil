# Mascote oficial no produto

**Estado:** regra de design de 19/11, a partir do kit do dono ("troque todas as partes que têm o mascote e adicione os PNG, utilize o mascote no máximo de lugar que conseguir e deixe a UI e UX perfeita"). Vale igual para web, Android e iPhone. Parte A: arquivos, mapa de troca e nome. Parte B: lugares novos, paleta, logo, movimento, leitor de tela e ícones.

**Revisão de 19/11 (spec 04, "Criar a trilha"):** as telas Escrevendo suas lições e Lições prontas! saíram. O `stu-estudando` fica ao lado do nó 1 da prévia enquanto a trilha é criada, no tamanho do Stu guia do mapa (o modo laço da §E1), e o `stu-comemorando` faz um ciclo na passagem do nó 1 para a aula (o modo no acontecimento). As linhas abaixo que citam essas telas valem para esses dois momentos.

O kit tem 31 PNG: a folha de personagem (3200×2180), a acolhida, 5 vistas, 8 expressões, 3 poses, 6 acessórios, o logo e 6 amostras de cor. As imagens do personagem e dos acessórios têm 1024×1024, fundo transparente e 260–420 KB cada. O mascote novo é o mesmo Stu de hoje (bolinha azul, topete, óculos), agora em volume e com expressões. Os originais entram no projeto como fonte, fora de qualquer pasta servida: PNG em `assets/mascote/originais` e GIF em `assets/mascote/originais-gif` (pedido do dono; decisão do Lead em 19/11). O script dos devs gera deles as versões leves desta tabela, e só elas vão para `public/` e para o pacote do app.

## A1. Arquivos

### Recorte
- **Quadro comum.** Todas as imagens do personagem (acolhida, expressões, poses e vistas) cabem na caixa x 58, y 58, 908×908 do original e têm o centro em (512, 512). Use esse recorte em todo lugar de tamanho fixo em que a expressão troca (reação da aula, Explique ao Stu, guia e início do mapa, pedido): a troca não desloca o mascote.
- **Recorte justo.** Para ilustração solta, em que a margem sobra (entrada, Escrevendo suas lições, conclusão, prévia do link): a caixa útil da tabela, com 24 px de folga de cada lado (sem passar de 0 e 1024).
- O corpo não tem exatamente a mesma escala em todas as imagens: a largura dos óculos vai de 491 a 550 px nas expressões de frente. Abaixo de 100 px isso não aparece; a troca de expressão usa a transição da parte B (§B7), que disfarça o resto.

### Faixas de tamanho
O lado é o do quadro na tela, em px de CSS (dp no app). Cada imagem é gerada só nas faixas em que aparece.

| Faixa | Lado na tela | Web (WebP 1x, 2x) | App (PNG @1x, @2x, @3x) | Teto por arquivo |
|---|---|---|---|---|
| P | até 56 | 48, 96 | 48, 96, 144 | 10 KB |
| M | 57–110 | 96, 192 | 96, 192, 288 | 24 KB |
| G | 111–180 | 160, 320 | 160, 320, 480 | 50 KB |
| XG | 181–260 | 240, 480 | 240, 480, 720 | 100 KB |

Medido com o sharp do projeto (WebP qualidade 82, alfa 90; PNG com paleta, qualidade 80, compressão 9), no pior caso (acolhida): 144 px = 7,5 KB WebP / 8,9 KB PNG; 288 px = 16,5 / 22,3 KB; 480 px = 29,9 / 48,9 KB; 720 px = 49,3 / 99,1 KB. A web não precisa de 3x.

Nomes e lugares: na web, `public/marca/stu/<nome>-<lado>.webp` (por exemplo `stu-feliz-96.webp` e `stu-feliz-192.webp`); no app, `apps/mobile/assets/marca/stu/<nome>-<faixa>.png` com `@2x` e `@3x` ao lado (`stu-feliz-m.png`), que o React Native escolhe sozinho. A lista de nomes fica num lugar só, em `packages/contratos`, para web e app pedirem a mesma imagem (sugestão para os devs; muda contrato). O `Stu` da web e o do app passam a receber `expressao` e `tamanho`, e a imagem tem `width` e `height` fixos, para nada pular ao carregar.

### Tabela
Caixa útil = caixa do alfa (> 8) no original de 1024, em x, y, largura × altura.

| Nome final | Origem no kit | Caixa útil | Recorte | Faixas | Onde entra |
|---|---|---|---|---|---|
| `stu-acolhida` | `mascote/acolhida` | 58, 70, 907×883 | justo | M, G, XG | entrada, apresentação, prévia do link |
| `stu-feliz` | `expressoes/feliz` | 96, 58, 831×908 | quadro | P, M, G | o padrão: conceito da aula, cartão em destaque, mapa pronto, prévia de trilha, acerto |
| `stu-animado` | `expressoes/animado` | 82, 58, 858×908 | quadro | P, M | ideia aplicada, ponte vencida, Stu falando |
| `stu-comemorando` | `expressoes/comemorando` | 70, 58, 883×908 | quadro | P, M, G | certo de primeira, lição concluída, chegada do mapa, Lições prontas |
| `stu-concentrado` | `expressoes/concentrado` | 143, 58, 737×908 | quadro | P, M | pensando, ouvindo, caderno do Stu |
| `stu-curioso` | `expressoes/curioso` | 118, 58, 788×908 | quadro | P, M | pedido de trilha, mapa montando, atento, Stu aluno, Explorar vazio |
| `stu-encorajador` | `expressoes/encorajador` | 58, 76, 908×872 | quadro | P, M | erro, prática, anotou, limite de acesso |
| `stu-surpreso` | `expressoes/surpreso` | 58, 68, 908×887 | quadro | M, G | 404, erro do app, perfil ou trilha indisponível |
| `stu-meio-de-boa` | `expressoes/meio-de-boa` | 116, 58, 791×908 | quadro | M | parte B |
| `stu-tres-quartos` | `vistas/tres-quartos` | 142, 66, 739×884 | quadro | M | guia do mapa |
| `stu-perfil` | `vistas/perfil` | 195, 66, 632×884 | quadro | P | ponte (atravessando) |
| `stu-estudando` | `poses/estudando` | 58, 150, 908×724 | justo | M, G | Escrevendo suas lições |
| `stu-organizando` | `poses/organizando` | 61, 58, 901×908 | justo | M, G | parte B |
| `stu-celebrando` | `poses/celebrando` | 58, 113, 908×797 | justo | G, XG | parte B |
| `acessorio-trofeu` | `acessorios/trofeu` | 58, 68, 908×887 | justo | P, M | parte B |
| `acessorio-fone` | `acessorios/fone` | 58, 77, 908×870 | justo | P | parte B |
| `acessorio-livro` | `acessorios/livro` | 89, 58, 847×908 | justo | M | parte B |

Ficam no kit, sem uso por enquanto: `vistas/frente` (o `stu-feliz` faz o papel), `vistas/perfil-esquerdo` (é o perfil espelhado), `vistas/costas`, `acessorios/mochila`, `acessorios/notebook` e `acessorios/chapeu-de-formatura`. Desde 19/11 (revisão da §B4 com o Mobile & QA), também `poses/organizando` e `expressoes/meio-de-boa`: os arquivos gerados delas saem do pacote do app e de `public/` até terem uso (cerca de 0,7 MB de animado no app).

## A2. Mapa de troca
Hoje a web usa `/marca/stu-oi.svg` pelo `Stu` de `src/ui/componentes.tsx:14` (e direto em `src/app/compartilhar.tsx:632` e `src/servidor/og/cartao.tsx:55`); o app usa `assets/marca/stu-oi.png` direto, em 21 lugares. Tamanho novo = lado do quadro.

| Lugar | Web hoje | App hoje | Imagem nova | Tamanho novo |
|---|---|---|---|---|
| Entrada, tela larga | `login/entrada.tsx:262` (`.entrada-paisagem`, 22cqw) | — | `stu-acolhida` | 26cqw, base no alto da colina |
| Entrada, faixa no celular | `login/entrada.tsx:177` (`.entrada-banner`, 72–76) | `sessao.tsx:149` `StuAcenando` (28–72) | `stu-acolhida` | 76 (app: a conta de hoje, teto 76) |
| Pedido de trilha | `pedido.tsx:138` (`.pedido-heroi__stu`, 96/72) | `estudo.tsx:784` (96) e `:856` `StuQueReage` (62) | convida `stu-curioso`; escrevendo `stu-encorajador`; ideia aplicada `stu-animado` | 96 (72 no celular; app 62 no que reage) |
| Cartão em destaque | `estudo.tsx:889` (`.plano-destaque__cena`, 62) | `estudo.tsx:1730` (60) | `stu-feliz` | 64 |
| Escrevendo suas lições | `estudo.tsx:1106` (`.preparo-cena`, 98) | `estudo.tsx:1287` (98) | `stu-estudando`; em "Lições prontas!" `stu-comemorando` | 132×106 (pose larga, 1,25:1) |
| Lição concluída | `estudo.tsx:1368` (`.conclusao-cena`) | `estudo.tsx:2025` (130) | `stu-comemorando`; com exercício sem acerto, `stu-encorajador` | 140 |
| Início do mapa | `ui/caminho.tsx:398` (`.caminho-inicio`, 82/92) | `caminho.tsx:497` (82/92) | montando `stu-curioso`; pronto `stu-feliz` | 92 |
| Guia do mapa | `ui/caminho.tsx:478` (`.caminho-guia`) | `caminho.tsx:678` `GuiaStu` | `stu-tres-quartos`, olhando para o próximo nó (espelhado quando o caminho vira à esquerda) | o de hoje |
| Chegada, fim do mapa | `ui/caminho.tsx:576` (`.caminho-chegada__stu`) | `caminho.tsx:1192` (62) | `stu-comemorando` | 64 |
| Conceito da aula | `aula.tsx:693` (`.aula-explicacao`, 76/56) | `licao.tsx:952` (58) | `stu-feliz` | 76 (56 até 390 px; app 58) |
| Reação no exercício | `aula.tsx:764` (`.aula-stu-estado__avatar`, 46) | `licao.tsx:1009` `StuDoExercicio` (42) | **muda para o painel de retorno (emenda de 19/11, reação no painel)**: acerto `stu-feliz`; de primeira `stu-comemorando`; erro `stu-encorajador`; ponte `stu-animado`. A faixa do corpo sai, com atento e pensando | 42 no celular; 48 na tela larga |
| Prática, resposta modelo | `aula.tsx:2054` (76/56) | `aula-formatos.tsx:1283` (48) | `stu-encorajador` | 76 (56; app 56) |
| Cabeça do estúdio | `estudio.tsx:145` (`.estudio-cabeca`) | — | `stu-feliz` | 56 |
| Ponte do reforço | `estudio.tsx:812` e `apresentacao.tsx:193` (`.ponte-stu`, 42) | `estudio-cenas.tsx:125` `CenaPonte` (32) | `stu-perfil` atravessando; ao chegar, `stu-animado` | 44 (app 36) |
| Explique ao Stu | `estudio.tsx:969` (`.ensino-stu`, 52) | `estudio-cenas.tsx:195` `StuAluno` (52) | aluno `stu-curioso`; ouvindo `stu-concentrado`; falando `stu-animado`; anotou `stu-encorajador` | 56 |
| Caderno do Stu | `estudio.tsx:1211` e `apresentacao.tsx:226` (`.ensino-caderno__stu`, 44) | `estudio-cenas.tsx:275` (44; compacto 30) | `stu-concentrado` | 48 (compacto 32) |
| Estado de erro | `ui/componentes.tsx:33` (`.estado-erro`, 48) | `interface.tsx:627` (48) | `stu-encorajador` | 48 |
| Erro do app | — | `app/_layout.tsx:35` `ErrorBoundary` (96) | `stu-surpreso` | 96 |
| Explorar vazio | `comunidade.tsx:466` e `:476` (`.explorar__vazio`, 96) | `comunidade.tsx:416` (96) | `stu-curioso` | 96 |
| Explorar indisponível | — | `comunidade.tsx:720` (96) | `stu-surpreso` | 96 |
| Páginas públicas | `t/[codigo]/page.tsx:65`, `p/[id]/page.tsx:62`, `explorar/page.tsx:39` (96) | — | limite `stu-encorajador`; inativo `stu-surpreso` | 96 |
| 404 | `not-found.tsx:16`, `t/[codigo]/not-found.tsx:23` (96) | — | `stu-surpreso` | 120 |
| Prévia de trilha | `compartilhar.tsx:632` (`.previa-trilha__stu`, 64) | `social.tsx:853` (64) | `stu-feliz` | 64 |
| Cartão "Completar perfil" | — | `perfil.tsx:157` (80) | sai com o perfil direto nos dados (spec 10, 19/11); enquanto existir, `stu-feliz` | 80 |
| Imagem de prévia do link | `servidor/og/cartao.tsx:55` (`stu-oi.svg` em data URL) | — | `stu-acolhida`, PNG de 480 | 240 no cartão |

O que sai junto: os adereços desenhados da reação (`.aula-stu-estado__adereco` e o equivalente no app), o lápis e as folhas desenhados de Escrevendo suas lições (o notebook da pose conta a história) e o `stu-oi` antigo, quando o último uso trocar.

### Fundo: mascote em volume sobre cenário chapado
- O cenário continua chapado (spec 04). O que prende o mascote ao chão é uma **sombra de contato**: elipse marinho a 14%, com 70% da largura do mascote e 10% da altura, borrada 6 px na web. No app, sem desfoque nativo, são duas elipses sobrepostas (14% e 7%, a segunda 20% maior). Entra na entrada, nos cartões, no mapa (guia, início e chegada) e na conclusão.
- Onde ele fica solto sobre branco (aula, vazio, erro, 404, páginas públicas): um **halo** radial lavanda #E9E7FF atrás, de 1,3× o mascote, indo a transparente. Substitui o halo atual do pedido.
- Nunca sobre foto ou capa de trilha, nem sobre o azul de ação: o corpo é desse azul e some.
- Sem contorno branco de figurinha: o desenho já tem borda e brilho próprios.

## A3. Nome
- **Recomendação (decisão do dono): o mascote continua "Stu"** nos textos ("Ensine ao Stu", "o Stu reage"), e "Studoo" continua sendo o nome do app. "Ensine ao Studoo" mistura o app com o personagem, e os textos da web e do app já dizem Stu em todo lugar. Na folha, "Studoo" fica como nome completo e "Stu" como apelido: "Stu, o mascote do Studoo".
- O texto alternativo, quando houver (§B8), também diz Stu.

## B4. Lugares novos: onde o Stu ajuda e onde fica fora
Regra geral: no máximo um Stu por tela, nunca mais alto que 40% da altura útil no celular, sempre ao lado do texto que dá a mensagem (ele reforça, não informa).

| Momento | Imagem | Tamanho | Comportamento |
|---|---|---|---|
| Boas-vindas (apresentação, os 5 passos de hoje) | passos 2 (o erro abre outro caminho) e 3 (explique com suas palavras): os Stu das cenas, ponte e caderno, como estão; passo 4 (progresso salvo no mapa): `stu-comemorando` ao lado do troféu da miniatura, à direita dele e com a base na base do nó, como no fim do mapa; passos 1 (material) e 5 (interesses): sem Stu | passo 4: 40 | entra com o passo e dá o "pop" (§B7), sem mudar a altura da arte; Pular continua em todos. Revisto em 19/11 |
| Explorar e busca sem resultado | `stu-curioso` | 96 | como na §A2 |
| Espera: mapa montando | `stu-curioso` | 92 | balão com pontinhos (spec 04) |
| Espera: Escrevendo suas lições | `stu-estudando` | 132×106 | §A2; em "Lições prontas!" troca para `stu-comemorando` com pulo |
| Espera: lendo o material enviado | o Stu do alto do pedido vira `stu-concentrado` | o do pedido (72) | quando a espera passa de 1 s; o texto continua "O Stu está preparando…", sem chave nova. Carregamento de menos de 1 s fica só no esqueleto |
| Acerto | `stu-feliz`; de primeira, `stu-comemorando` | 42 (48 na tela larga) | no painel de retorno, na ponta direita da linha do título, com pulo; o painel verde, com o visto e o título, continua sendo o sinal principal |
| Erro | `stu-encorajador` | 42 (48 na tela larga) | no painel de retorno, na ponta direita da linha do título; sem tremer (quem treme é o exercício, spec 04); o X e o título no painel âmbar |
| Ponte do reforço | `stu-perfil` atravessando, `stu-animado` ao chegar; balão do reforço com `stu-encorajador` | 44; balão 76 | atravessa a tábua como hoje |
| Lição concluída | `stu-comemorando`; com exercício sem acerto, `stu-encorajador` | 140 | raios e confete só no primeiro caso (spec 04) |
| Trilha concluída | `stu-celebrando` (com troféu) | 240 | confete, "Trilha concluída!" e "Compartilhar trilha" |
| Fim do mapa | `acessorio-trofeu` no lugar do ícone desenhado da lente | 72% do lado da lente da chegada, que é a lente base + 20 (`.caminho-chegada__lente`): 66 na de 92 (celular), 71 na de 98 (tablet) e 73 na de 102 (computador), arquivo da faixa M. Corrigido em 19/11: os números de antes eram da lente base | a lente tem face branca #FFFFFF com borda de 3 px #E0A92E e o lábio de baixo #C7922A, nos dois estados (na face dourada, o troféu sumia). Antes: troféu em silhueta cinza a 40% (web: `filter: grayscale(1)` e opacidade 0,4; app: `tintColor` #8A93B0 e opacidade 0,4). Ao concluir a trilha: cor cheia, com o pop de hoje e um ciclo da animação (§E1) |
| 404 | `stu-surpreso` | 120 | com halo; "Essa página não existe" e "Voltar ao início" |
| Erro de rede | na linha, `stu-encorajador`; tela inteira sem conexão, `stu-surpreso` | 48; 96 | "Sem conexão. Confira a internet e tente de novo." e "Tentar de novo" |
| Prática com cronômetro | `stu-concentrado`; ao terminar, `stu-comemorando` | 48 | ao lado do cronômetro, nunca sobre o diagrama |
| Voz: Ensine ao Stu e voz ao vivo | ouvindo `stu-concentrado`; falando `stu-animado`; pensando `stu-curioso`; anotou `stu-encorajador` | 96 | no centro da tela de voz, com as ondas de hoje em volta |
| Compartilhar | prévia `stu-feliz`; imagem do link `stu-acolhida` | 64; 240 | depois de compartilhar, só o aviso em texto (spec 11) |
| Controle de som (spec 12) | `acessorio-fone` | 40 | no título da folha "Som" |

**Revisão de 19/11 (com o Mobile & QA, nas telas de hoje):** Minhas trilhas sem trilha não existe: com zero trilhas, Minhas trilhas abre o pedido, que já tem o Stu (curioso, 72). Novidades é uma seção do Perfil, com uma linha de texto: fica sem Stu, porque no máximo um aparece por tela e ele ficaria maior que o bloco, e a linha de hoje continua, sem título novo.

**Fica fora:** a área de resposta antes de "Verificar"; o texto da explicação (o Stu fica ao lado do balão, nunca por cima); formulários (perfil, configurações da trilha); listas e cartões do Explorar, salvo o vazio; avisos, menus e confirmações (spec 11); a barra do alto da aula; foto ou capa de trilha.

## B5. Paleta
**Recomendação (decisão do dono): adotar as seis cores do kit como cores da marca.** O Stu #2563FF ao lado do botão #3858D6 parece erro: são dois azuis quase iguais. Contas de contraste WCAG:

| Papel | Hoje | Novo | Contraste |
|---|---|---|---|
| Ação (botão, link, nó atual) | #3858D6 | #2563FF | branco sobre ele 4,88:1 (AA) |
| Ação escura (lábio, pressionado, link sobre lavanda) | #2A44A8 | #1D4ED8 | 6,70:1 no branco; 5,53:1 na lavanda |
| Texto | #1B2A5E | #0B1B5C | 15,84:1 no branco; 13,08:1 na lavanda |
| Destaque (marco vencido, troféu, estrela) | #FFD166 | #FBBF24, só como fundo | texto #0B1B5C sobre ele 9,49:1; nunca texto amarelo no branco (1,67:1) |
| Violeta (enfeite, selo "Novo", voz) | — | #8B5CF6; texto em #6D28D9 | #8B5CF6 no branco 4,23:1 (só ícone ou texto ≥ 24 px); #6D28D9 7,10:1 |
| Azul claro (foco, barra de progresso, ilustração) | — | #3B82F6, nunca texto | 3,68:1 no branco (vale para componente, não para texto) |
| Fundo suave (halo, selecionado, momentos do Stu) | #EEF3FF | #E9E7FF | texto #0B1B5C 13,08:1; link #2563FF 4,03:1 não passa, use #1D4ED8 |

Não mudam: texto secundário #5E6A85 (5,42:1), névoa, gelo, sucesso #1F7A5A, alerta #9A5B00 e erro #C23B4E. O kit não tem verde nem vermelho, e o painel de retorno da spec 04 continua como está.

## B6. Logo
O PNG do kit não é o vetor de hoje redesenhado na mesma forma: é a mesma ideia ("stud" + os óculos com sorriso) com letras bem mais grossas, outra proporção (3,0:1 contra 3,21:1; a sobreposição das formas é de 50%) e cores mais fortes (#04145B e #0731FA, fora da própria paleta do kit). Além disso, é raster: 941×314 úteis num quadro de 1024.

**Recomendação (decisão do dono):** manter o desenho do vetor de hoje (`logo-com-sorriso.svg` e `logo-animado.svg`), que o dono pediu para manter em 19/11, trocando só as cores para #0B1B5C e #2563FF. Se o dono preferir o traço grosso do kit, ele entra redesenhado em SVG, nunca o PNG.

## B7. Movimento com imagem parada
- **Troca de expressão:** a imagem nova entra por cima da antiga em 120 ms (opacidade) e dá um pop de 0,92 → 1,06 → 1 em 240 ms, na curva de mola de hoje (`cubic-bezier(0.2, 0.9, 0.3, 1.3)`). Antes da aula, as cinco expressões da reação (feliz, comemorando, encorajador, curioso, concentrado) já ficam carregadas na faixa P, cinco arquivos de até 10 KB, para nada piscar.
- **Pulo (acerto, de primeira, Lições prontas):** sobe 10 px em 160 ms, desce em 140 ms e achata ao tocar o chão (escala 1,04 × 0,94 por 80 ms). A sombra de contato encolhe enquanto ele sobe.
- **Flutuar (mapa, vazio, espera):** sobe e desce 4 px a cada 3,2 s. O aceno da acolhida gira ±5° pela base a cada 5,2 s, como o `stu-acenar` de hoje.
- **Chegar (boas-vindas, conclusão, 404):** escala 0,6 → 1 com subida de 12 px em 360 ms.
- Só um Stu se mexe por vez, e nada se repete durante o exercício.
- **Movimento reduzido:** nada se repete, não há pulo nem pop, a troca de expressão é imediata, a sombra fica parada e o confete não aparece (spec 04). A informação é a mesma.

## B8. Leitor de tela
- O Stu é sempre enfeite: `alt=""` dentro de um contêiner `aria-hidden="true"` na web, e `accessible={false}` com `importantForAccessibility="no"` no app. A mensagem está no texto ao lado (balão, título, painel de retorno), e é esse texto que o leitor anuncia (`role="status"` onde já existe).
- A troca de expressão não gera anúncio.
- Única exceção: a imagem de prévia do link, que tem texto alternativo nos metadados: "Stu, o mascote do Studoo, acenando".

## B9. Ícone do app, tela de abertura e ícone do site
- **Ícone do app (Android e iPhone) e ícone do site:** recomendo manter a marca de hoje (os óculos com sorriso, a mesma forma do logo), trocando o azul de #3858D6 para #2563FF. Ela é vetorial e se lê em 16 px. Um ícone com o rosto do Stu em volume, como o do Duolingo, precisa de um render novo do rosto em 1024 px ou mais: o rosto recortado do kit tem uns 550 px e ficaria borrado. **Decisão do dono**, com essa ressalva.
- **Tela de abertura do app:** hoje o `app.json` não configura nenhuma (nem `splash` nem o plugin `expo-splash-screen`). Recomendo a marca branca sobre #2563FF, com imagem de 200 dp, porque o Android 12 ou mais novo só mostra um ícone no centro. O Stu em volume aparece logo depois, na entrada.
- **Imagem de prévia do link:** muda, com o Stu (§A2).

## Emenda (19/11): o Stu animado
O dono mandou um GIF para cada PNG do kit ("Troque os PNGs por GIFs, assim o Studoo fica mais animado"). Os GIFs têm 352×352, 33 quadros em 2,36 s (a acolhida tem 40 quadros e 2,86 s), laço infinito e transparência de um bit. A regra junta o pedido do dono com a §B7: **o Stu se mexe em todo momento em que ele é o assunto (boas-vindas, vazio, espera, acerto, erro, conclusão, voz) e fica parado enquanto a pessoa lê ou responde ao lado dele.** Continua valendo um Stu se mexendo por vez: se dois puderem se mexer, se mexe o do acontecimento mais recente.

### E1. Onde ele se mexe
Modos: **laço** (repete enquanto está visível, com as pausas da §E4); **uma vez** (um ciclo quando aparece, depois o PNG parado); **no acontecimento** (parado até o fato, um ciclo nele, ou dois nas conclusões, depois parado); **de tempos em tempos** (um ciclo a cada 8 s); **parado** (só o PNG).

| Lugar (§A2, §B4) | Imagem | Modo |
|---|---|---|
| Entrada, faixa no celular | `stu-acolhida` | laço; para quando um campo recebe foco |
| Entrada, tela larga (XG) | `stu-acolhida` | parado, com o aceno da §B7 (§E2) |
| Apresentação, passo 4 | `stu-comemorando` ao lado do troféu da miniatura | uma vez ao entrar no passo (os Stu das cenas dos passos 2 e 3 seguem a ponte e o caderno) |
| Pedido: convida | `stu-curioso` | uma vez ao abrir |
| Pedido: pessoa escrevendo | `stu-encorajador` | parado |
| Pedido: ideia aplicada | `stu-animado` | no acontecimento |
| Cartão em destaque, prévia de trilha, cabeça do estúdio | `stu-feliz` | uma vez ao abrir |
| Escrevendo suas lições, mapa montando, lendo o material | `stu-estudando`, `stu-curioso`, `stu-concentrado` | laço (é espera) |
| Lições prontas!, início do mapa pronto | `stu-comemorando`, `stu-feliz` | no acontecimento / uma vez |
| Guia do mapa | `stu-tres-quartos` | de tempos em tempos; e uma vez na volta de lição concluída, depois do pulo do nó |
| Conceito da aula | `stu-feliz` | uma vez quando a etapa entra, depois parado |
| Reação no painel de retorno: acerto, de primeira, erro, ponte | `stu-feliz`, `stu-comemorando`, `stu-encorajador`, `stu-animado` | no acontecimento |
| Prática: cronômetro correndo, resposta modelo | `stu-concentrado`, `stu-encorajador` | parado |
| Prática: terminou | `stu-comemorando` | no acontecimento |
| Ponte do reforço | `stu-perfil`, depois `stu-animado` | laço só durante a travessia; uma vez ao chegar |
| Ensine ao Stu e voz ao vivo | ouvindo, falando, pensando | laço enquanto o estado dura (mostra que ele ouve ou fala) |
| Ensine ao Stu: pessoa digitando, caderno do Stu | `stu-curioso`, `stu-concentrado` | parado |
| Ensine ao Stu: anotou | `stu-encorajador` | no acontecimento |
| Lição concluída | `stu-comemorando` (ou `stu-encorajador`) | no acontecimento, dois ciclos |
| Trilha concluída | `stu-celebrando` | no acontecimento, dois ciclos (§E2) |
| Fim do mapa | `acessorio-trofeu` | no acontecimento (trilha concluída) |
| Explorar sem resultado | `stu-curioso` | uma vez ao abrir |
| 404, erro do app, sem conexão, páginas públicas, erro na linha | `stu-surpreso`, `stu-encorajador` | uma vez ao abrir (no 404, junto com o "chegar" da §B7) |
| Controle de som | `acessorio-fone` | parado |
| Imagem de prévia do link | `stu-acolhida` | parado (PNG; o cartão de link não anima) |

### E2. Tamanho em que ainda anima
- A animação só entra quando **lado na tela × densidade ≤ 330 px**, ou seja, até 165 px na web (tela 2x), 110 pt no app em tela 3x e 165 pt em tela 2x. Acima disso o GIF teria de ser ampliado e borra.
- No celular, web e app usam o mesmo teto de 110 para os lugares animados: apresentação (160 → 110), Escrevendo suas lições (132×106 → 110×88), lição concluída (140 → 110) e 404 (120 → 110). Na tela larga da web valem os tamanhos da §A2 e §B4 até 165.
- **XG (240) e entrada larga: PNG parado com o movimento da §B7.** Trilha concluída vira uma composição: `stu-celebrando` animado em 165 (110 no celular) no centro, com os raios girando e o confete desenhados em código atrás, como na spec 04. O PNG de 240 fica para movimento reduzido.
- **No app, o animado existe só nas faixas P e M** (até 110 pt). Os lugares que pediriam G (lição concluída, Escrevendo suas lições, trilha concluída, apresentação) usam a M em 110, como manda o item acima.
- **Pedido ao dono (recomendação):** `acolhida`, `celebrando` e `comemorando` em 720×720 px ou mais, em WebP animado ou APNG com transparência suave (alfa de 8 bits), no mesmo ritmo (cerca de 2,4 s em laço) e com o primeiro quadro igual à pose do PNG parado. Com eles, a XG e a entrada larga voltam a animar com nitidez.

### E3. Borda de um bit
- O GIF não tem pixel meio transparente: no tamanho original ou ampliado, a borda fica serrilhada em qualquer fundo claro do mapa de troca (branco, halo lavanda, céu da entrada, regiões do mapa, painéis verde e âmbar).
- **Ao reduzir com o filtro lanczos (o padrão do sharp), a borda fica suave**: medido de 96 a 330 px, todos os tamanhos ganham alfa parcial na borda (o `feliz` em 330 px tem 3.533 pixels de borda suave). Por isso o produto nunca serve o GIF original nem um arquivo ampliado: só o WebP animado gerado no tamanho da faixa, dentro do teto da §E2.
- Continua valendo a §A2: nunca sobre o azul de ação #2563FF nem sobre foto ou capa.

### E4. Movimento reduzido e economia
- **Imagem parada:** o PNG de mesmo nome da §A1, na mesma faixa (nítido, feito do original de 1024). Nunca o primeiro quadro do GIF.
- **Ordem de carga:** o PNG aparece primeiro, com `width` e `height` fixos. O WebP animado é pedido só quando a tela fica interativa (`requestIdleCallback` na web, `InteractionManager.runAfterInteractions` no app) e entra por cima com 120 ms de opacidade. Se não chegar em 3 s, a tela fica no PNG.
- **Movimento reduzido:** o arquivo animado nem é pedido; tudo fica no PNG e as trocas de expressão são imediatas (§B7).
- **Economia de dados** (`navigator.connection.saveData` ou `prefers-reduced-data` na web): como movimento reduzido.
- **Pausa (troca para o PNG):** fora da tela (menos de 10% visível: `IntersectionObserver` na web; tela sem foco na navegação do app); aba ou app em segundo plano (`visibilitychange`, `AppState`); qualquer campo de texto da tela com foco; e laço depois de 20 s sem toque, rolagem ou tecla. Volta ao ciclo no próximo toque, rolagem ou ao voltar à tela.
- **Leitor de tela:** nada muda; o Stu segue enfeite (§B8) e a animação não gera anúncio.
- **App:** a imagem animada pede o `expo-image` (que já existe no Expo Go), com `autoplay` desligado nos modos "uma vez" e "no acontecimento", que o componente controla pelo tempo do ciclo.

### E5. O que não vira GIF
- Logo: fica o vetor (§B6). O GIF do logo é o desenho grosso do kit, em raster.
- Paleta: as amostras são referência, não entram no produto.
- Também ficam de fora `vistas/costas`, `vistas/perfil-esquerdo` (o `stu-perfil` espelhado faz o papel), `mochila`, `notebook` e `chapeu-de-formatura`, como na §A1.

### E6. Teto de peso
Medido com o sharp (WebP animado, lanczos, qualidade 60 a 72, esforço 6): o `feliz` pesa 59 KB em 96 px, 116 KB em 192 e 168 KB em 288. A acolhida pesa 101, 216 e 322 KB. Baixar a qualidade quase não muda o peso (de 216 para 202 KB): ele vem dos 33 a 40 quadros. A economia vem da §E1 e da §E4, não da compressão.

| Arquivo animado, lado de saída | Teto | Acolhida |
|---|---|---|
| 96 px | 70 KB | 110 KB |
| 144 px | 110 KB | 170 KB |
| 192 px | 130 KB | 230 KB |
| 288 px | 190 KB | 330 KB |
| 330 px | 240 KB | 400 KB |

- **Por tela, na web:** a primeira imagem é sempre o PNG (tetos da §A1). Depois que a tela fica interativa, entram no máximo 250 KB de animação. A aula carrega só as três animações de acontecimento da reação (`feliz`, `comemorando` e `encorajador` em 96 px, até 210 KB); o resto vem quando for usado.
- **No app:** teto de 5,5 MB para todas as animações no pacote (decisão do Lead em 19/11). Com P, M e G em @2x e @3x são 40 arquivos e 5,1 MB, medidos no 7f7ff01.
- **Recomendação do Designer para cortar sem perder nitidez no iPhone 3x do dono:**
  1. Tirar as 6 animações G (1,1 MB, só em @2x). Pela §E2 o animado do app vai até 110 pt, e num aparelho 3x elas seriam ampliadas 1,5 vez e borrariam.
  2. No animado, só @3x. Aparelhos 2x usam o @3x reduzido, que fica nítido, ao custo de um pouco mais de memória ao decodificar.

  Ficam P e M em @3x: 17 arquivos e 2,35 MB, e o teto de 3,5 MB volta a valer. Os PNG parados continuam com @2x e @3x.

### E7. Folga em volta do Stu animado
O GIF não é o PNG reduzido: o boneco ocupa uns 5% menos do quadro e, em quatro animações, sai dele. A camada animada fica por cima da parada e no mesmo lugar reservado, que não muda, mas precisa de folga. Medi a caixa do alfa somada de todos os quadros contra a do primeiro quadro:

| Animação | Sai para cima | Sai para o lado |
|---|---|---|
| `comemorando` | 18% da altura | 4% da largura |
| `celebrando` | 17% | 5% |
| `animado` | 12% | 4% |
| `surpreso` | 8% | 1% |
| `acolhida` | 5% | 11% (o braço do aceno, à direita) |
| as outras | até 2% | até 2% |

- Nenhum pai do Stu animado corta: `overflow: visible` no quadro e nos contêineres que a folga atravessa; no app, sem `overflow: 'hidden'` nesses pais. Uma arte de cartão de borda arredondada que precisa cortar recebe só expressão que não pula (`feliz`).
- Na folga não fica texto nem nada tocável. Ela pode passar por cima de fundo, cenário ou margem.
- Folga por lugar:
  - reação no painel de retorno (42, `comemorando` e `animado`): o quadro já sobe 8 px no respiro do rodapé; no alto do pulo passa até 8 px da borda, por menos de 1 s, sobre o exercício já respondido, e deixa o toque passar;
  - chegada do mapa (64, `comemorando`): 12 px acima;
  - pedido, ideia aplicada (96, 72 ou 62, `animado`): 12 px acima, com o título fora dessa faixa;
  - entrada no celular (76, `acolhida`): 10 px entre o quadro e a borda direita da faixa, que não corta;
  - lição concluída, Lições prontas e trilha concluída (110 a 165): a folga cai sobre os raios e o confete, e não muda nada.
- Onde a folga não couber, o lugar mostra a imagem parada no acontecimento, com o pulo da §B7.

## Emenda (19/11): a reação mora no painel de retorno
**Problema.** No celular, a faixa de reação (`.aula-stu-estado` na web, `StuDoExercicio` no app) é o último elemento do corpo do exercício. Em 390 × 844, com um enunciado de quatro ou cinco linhas, ela já fica abaixo da dobra; quando o retorno aparece, o painel do rodapé cresce e a cobre. A reação ao acerto e ao erro, o momento de mais emoção da aula, não é vista.

**Decisão (do Designer).**
- **Celular (web até 767 px e app):** o Stu da reação mora no painel de retorno, na ponta direita da linha do título. O quadro tem 42 px, alinhado pela base com a linha do título (34) e encostado à direita do conteúdo do painel (16 px da borda da tela). Ele sobe 8 px para o respiro de cima do rodapé, que é de 12 px na web e 8 no app. **O painel não cresce:** a altura é a de hoje para o mesmo texto. O título ganha 52 px de respiro à direita (o quadro mais 10), para nunca passar por baixo do Stu.
- **Tela larga (web a partir de 768 px):** o Stu fica em 48, entre o texto do retorno e as ações, centrado na altura do painel.
- **A faixa de reação do corpo sai**, em todos os estados (neutro, pensando, atento, acerto, de primeira, ponte), na web e no app. Antes da resposta ela fica ao lado de quem responde (§B4: o Stu fica fora da área de resposta), e depois dela quem reage é o painel. Os textos `licao.stuEstado` deixam de ser usados.
- **Painel compacto** (com o Explique aberto): sem Stu, porque a cena do Explique já tem o dela (no máximo um Stu por tela).

**Estados.** As imagens vêm da faixa P (§A1).

| Estado | Ícone à esquerda (como hoje) | Stu à direita | Movimento |
|---|---|---|---|
| Acerto | visto branco no círculo verde #2F9E6F, degrau #1F7A5A | `stu-feliz` | um ciclo |
| Acerto de primeira | o mesmo visto | `stu-comemorando` | um ciclo, com o pulo |
| Erro (e erro depois do reforço, com a lâmpada) | X ou lâmpada brancos no círculo laranja #E58A1F, degrau #B4650D | `stu-encorajador` | um ciclo, sem tremer |
| Acerto depois da ponte | o visto | `stu-animado` | um ciclo |

- O ícone continua: o resultado é dito pelo ícone, pela palavra do título e pela cor, nunca só pela cor. Ele mantém 34 px, com o ícone branco de 20 e traço de 3,2.
- **Contorno do painel:** o de hoje. Fundo #E3F6EA no acerto e #FFF1E0 no erro, na largura toda, sem borda em cima. O Stu entra sem contorno e sem halo.

**Movimento.**
- O painel sobe em 320 ms, como hoje, e o ícone gira aos 80 ms, como hoje.
- O Stu entra com o pop da §B7 aos 160 ms e roda um ciclo da animação (o modo "no acontecimento" da §E1). O confete do acerto continua saindo do ícone. No erro, quem treme é o exercício; o Stu, não.
- Com movimento reduzido, o painel aparece sem subir, sem giro, sem pop e sem confete. O Stu é o PNG parado da expressão, e a informação é a mesma.

**Toque e leitor de tela.**
- O Stu é enfeite e deixa o toque passar (`pointer-events: none` na web, `pointerEvents="none"` no app). Assim, o pulo, que passa até 8 px da borda do rodapé (§E7), nunca rouba um toque.
- O anúncio continua o do painel (`role="alert"`: título, certo ou errado, e o retorno). A expressão não é anunciada.

**Altura do rodapé de retorno.**
- O Stu não aumenta o painel.
- **A altura máxima do painel é 50% da altura visível** (`50svh` na web; metade da janela no app): 333 px em 390 × 667 e 422 px em 390 × 844. Hoje, o retorno de erro com duas linhas e o aviso de pular tem cerca de 320 px e cabe.
- Se passar do máximo, só o bloco de texto rola dentro do painel: o retorno, as linhas extras e o aviso. Ele termina num degradê de 24 px na cor do painel. A linha do título com o Stu e as ações ficam fixas, então "Continuar", "Tentar de novo" e "Pular por agora" nunca saem da tela e o painel nunca cobre mais da resposta do que a metade da tela.

**Paridade:** é o mesmo desenho na web até 767 px e no app. A tela larga existe só na web. O esboço está na pasta do Designer, em `ux/10-reacao-no-painel/reacao-390.png`.

