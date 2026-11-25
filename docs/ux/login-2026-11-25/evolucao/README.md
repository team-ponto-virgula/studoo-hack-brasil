# Login mobile — evolução da base aprovada

**25/11/2026 · R2, proposta visual navegável.**

O dono aprovou a simplicidade e a organização da [R1](../prototipo/index.html) e pediu uma evolução dinâmica, Google antes de Apple e uma presença mais expressiva da marca. Também autorizou retirar o Stu se sua participação fosse apenas uma miniatura. A R1 foi preservada para comparação.

## Ver

- [Demonstração animada](capturas/login-em-movimento.gif) e [vídeo MP4](capturas/login-em-movimento.mp4).
- [Login 390px](capturas/login-390.png), [login 360px](capturas/login-360.png).
- [Senha 390px](capturas/senha-390.png), [senha 360px](capturas/senha-360.png).
- [Texto ampliado a 200%](capturas/texto-200-360.png).
- [Protótipo](index.html), sem backend ou credenciais reais.

Para experimentar no navegador da máquina Cloud:

```sh
cd /workspace/work/studoo-login-design/docs/ux/login-2026-11-25
python -m http.server 3031 --bind 0.0.0.0
```

Abrir `http://localhost:3031/evolucao/`. A pasta mãe também contém a R1. O endereço localhost do próprio celular não aponta para esta máquina; as imagens e o vídeo no repositório permitem conferir sem depender desse servidor.

## Mudanças visíveis

- A logo cresce de 112 para 144px; o Stu pequeno sai do login. Continua havendo espaço para usar o mascote com destaque nas boas-vindas e nos momentos de aprendizado.
- Os óculos fazem um cumprimento breve na entrada, com inclinação, reflexo nas lentes e acomodação; a palavra continua legível. Ao mudar a etapa, há apenas um aceno menor.
- E-mail vira o contexto da senha com continuidade de posição; título, campo e ação mudam com deslocamentos curtos. O botão acompanha a nova posição, sem bloquear digitação ou foco.
- O CTA responde ao toque e sua seta acompanha o avanço. Campo ativo recebe um realce azul discreto.
- **Google aparece antes de Apple no DOM, no visual e no teclado**, conforme a correção explícita do dono. Isso substitui a ordem sugerida anteriormente nesta proposta.

Foram reutilizados os bitmaps originais da intro nativa (`logo-com-sorriso.png` e `abertura-oculos-hd.png`), com a mesma divisão de camadas 348/560. Não houve redesenho ou edição da arte. O efeito do login é independente da intro de abertura, que não foi alterada.

## Movimento

| Gesto | Duração e limites |
| --- | --- |
| Cumprimento da logo | 780ms, uma vez ao abrir; inclinação máxima 7°, deslocamento 4px |
| Reflexo das lentes | 520ms dentro do cumprimento |
| Conteúdo inicial | 320ms por grupo; intervalo de 35ms, deslocamento de 8px |
| E-mail → senha / retorno | 260–300ms, conteúdo com deslocamento curto; botão acompanha o layout |
| Aceno ao mudar etapa | 440ms, máximo 5°/2px |
| Estado do controle | 140–180ms |

Não há animação contínua em repouso, espera imposta antes de usar o formulário ou tela extra de splash. A GIF repete a gravação inteira para facilitar a revisão; o aplicativo representado não reinicia o cumprimento em laço. Movimento reduzido não executa os gestos e preserva as mudanças imediatas de estado. Ativar essa preferência durante uma animação cancela o movimento; ocultar a página também o cancela.

## Escopo

Continua sendo um estudo mobile em HTML, sem autenticação real, armazenamento dos campos, alteração de APIs ou execução nativa. Cadastro/ajuda/política/visitante abrem explicações de protótipo. Nenhum build foi enviado ao TestFlight. Antes de implementação, preservar a disponibilidade dos provedores e os contratos dos dois clientes; no iOS, a Apple continua usando o componente oficial.

Capturas em Chromium/Playwright, DPR2. A demonstração registra quadros PNG do próprio navegador e os tempos reais entre eles, com viewport de 390×844, movimento normal e dados sintéticos. GIF/MP4 são exportados em 390×844; não são gravação de aparelho nativo. Em 360×800, a entrada tem 8px de rolagem no fim; a ação principal está visível sem rolar. Texto a 200% usa rolagem natural, sem apertar a tipografia. [Medidas](capturas/medidas.json).

## Conferências feitas

**30/30 verificações independentes do protótipo passaram** em 390×844 e 360×800: validação, foco, editar e-mail, mostrar senha, diálogos e retorno, flags opcionais, ordem Google→Apple no DOM/teclado e texto a 200% sem rolagem horizontal. As fontes e os dois bitmaps tiveram hashes iguais antes/depois.

Movimento reduzido desde a entrada e nas trocas não inicia animações. Ativar a preferência no meio da entrada ou transição cancela marca/conteúdo; voltar à preferência normal não reinicia a entrada. Entrada sem interação e transição ficam sem animações ativas após 1,5s. Interagir durante a entrada funcionou sem esperar o efeito. Não houve erros JavaScript/console nem chamada de API/autenticação. O teste de sintaxe também passou. [Registro integral](capturas/resultado-interacoes.json).

Essas conferências comprovam somente o protótipo HTML; não equivalem a login real, teclado de aparelho, VoiceOver/TalkBack ou avaliação de desempenho nativo. A revisão visual do dono continua sendo a referência para a direção de design.
