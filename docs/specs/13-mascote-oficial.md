# Mascote oficial no produto

**Estado:** regra de design de 19/11, a partir do kit do dono ("troque todas as partes que têm o mascote e adicione os PNG, utilize o mascote no máximo de lugar que conseguir e deixe a UI e UX perfeita"). Vale igual para web, Android e iPhone. Parte A: arquivos, mapa de troca e nome. Parte B: lugares novos, paleta, logo, movimento, leitor de tela e ícones.

O kit tem 31 PNG: a folha de personagem (3200×2180), a acolhida, 5 vistas, 8 expressões, 3 poses, 6 acessórios, o logo e 6 amostras de cor. As imagens do personagem e dos acessórios têm 1024×1024, fundo transparente e 260–420 KB cada. O mascote novo é o mesmo Stu de hoje (bolinha azul, topete, óculos), agora em volume e com expressões. Os originais não entram no repositório: os devs geram as versões leves desta tabela.

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

Ficam no kit, sem uso por enquanto: `vistas/frente` (o `stu-feliz` faz o papel), `vistas/perfil-esquerdo` (é o perfil espelhado), `vistas/costas`, `acessorios/mochila`, `acessorios/notebook` e `acessorios/chapeu-de-formatura`.

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
| Reação no exercício | `aula.tsx:764` (`.aula-stu-estado__avatar`, 46) | `licao.tsx:1009` `StuDoExercicio` (42) | atento `stu-curioso`; pensando `stu-concentrado`; acerto `stu-feliz`; de primeira `stu-comemorando`; ponte `stu-animado` | 48 |
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
