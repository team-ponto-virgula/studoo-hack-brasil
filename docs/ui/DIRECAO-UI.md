# Direção de UI — Studoo (Web e Mobile)

Objetivo: elevar a interface do Studoo para o pitch do HackBrasil 2026 (roteiro de 2 minutos em `docs/DEMO-HACKATHON.md`), mantendo a identidade original (Stu, paleta índigo, Quicksand/Nunito, relevo tátil, mundo ilustrado) e respeitando a D16 (sem XP, sequência de dias, ranking, moeda ou medalhas) e a spec 04 (nada semelhante ao Duolingo).

Referências de mercado avaliadas em `docs/ui/REFERENCIAS-UI.md`.

---

## 1. Diagnóstico do estado atual

1. **Momento 1 (Material → Citação):** as referências (`licao.referencias`) ficam escondidas em um `<details>` genérico ("Origem desta lição") abaixo do exercício. Na leitura do conceito/exemplo, não há marcador visual ligando a explicação ao material enviado.
2. **Momento 2 (Erro → Ponte):** o erro mostra apenas um painel âmbar no rodapé; a classe `.ponte-desenho` existe no CSS mas não é renderizada no JSX; o Stu não diferencia acerto de primeira de acerto após construir a ponte.
3. **Momento 3 (Ensine ao Stu):** é um `<details>` simples com `<textarea>` genérico. Falta a inversão de papéis (Stu como aluno curioso), feedback visual reativo ao volume da voz na gravação e separação clara das etapas (gravar → revisar → enviar).
4. **Momento 4 (Evidência e outro dispositivo):** a tela de conclusão foca em contadores numéricos em vez da história do que foi aprendido; Meus planos não destaca a continuidade entre dispositivos.
5. **Moldura (1440 px e 360 px):**
   - *Meus planos (1440 px):* cartões pequenos com mais de metade da tela vazia; falta destaque único "Continue de onde parou"; barra lateral e topo ("Área de estudo / Sair") genéricos.
   - *Pedido (1440 px):* "Gerar trilha" cai abaixo da dobra e o envio de material próprio (1º passo da demo) fica discreto no rodapé.
   - *Aula (1440 px):* excesso de espaço branco, Stu some no exercício, rótulo "Exercício" repetido (etiqueta + título) e `letter-spacing: -0.035em` comprimindo `h2`/`h3`.
   - *Trilha (1440 px):* coluna estreita no desktop e todos os nós comuns com o mesmo ícone.

---

## 2. Princípios e Sistema de Tokens

### Princípios
- **Azul restrito à ação principal (Linear):** apenas o CTA primário da tela usa `--acao`; ações secundárias usam borda `--gelo` ou texto.
- **Um passo por vez, sem teletransporte (Family):** transições suaves em `transform` e `opacity`; elementos que persistem (ex.: erro → tábua da ponte) mostram continuidade; animações amplas apenas em momentos raros (ponte construída, conclusão).
- **Contraste AA por construção (Stripe) e acessibilidade:** `prefers-reduced-motion: reduce` desliga todas as animações/transições de movimento; foco visível de `3px`; alvos táteis `>= 44px` (`>= 48px` em ações principais); `360 px` sem transbordamento horizontal.
- **Sem dependências novas:** CSS/SVG puro na web (respeitando CSP/nonce de `src/proxy.ts`); Views/Animated nativos no app.

### Tokens
- **Cores (claras, contraste AA):**
  - Base: `--fundo: #ffffff`, `--nevoa: #f1f4fd`, `--gelo: #e1e7fa`, `--ceu: #eef3ff`, `--superficie-sutil: #f7f9ff`
  - Texto: `--texto: #1b2a5e`, `--texto2: #5e6a85`
  - Destaque: `--acao: #3858d6`, `--acao-escura: #2a44a8`
  - Semânticas: `--sucesso: #1f7a5a` (`--sucesso-claro: #2f9e6f`, fundo `#eefaf3`), `--alerta: #9a5b00` (fundo `#fff6ea`, borda `#e3a24a`), `--erro: #c23b4e` (fundo `#fff5f6`), `--ouro: #ffd166` (`--ouro-escuro: #e0a92e`)
- **Tipografia:**
  - Títulos: `Quicksand`, peso `700`. `h1`: `clamp(1.625rem, 3.6vw, 2.25rem)`, `line-height: 1.14`, `letter-spacing: -0.03em`. `h2`/`h3`: `1.125rem–1.25rem`, `line-height: 1.3`, `letter-spacing: -0.015em` (corrige compressão atual).
  - Corpo: `Nunito`, `1rem` (`16px`), `line-height: 1.55`, `letter-spacing: 0`, `font-variant-numeric: tabular-nums`.
- **Espaçamento, Raio e Relevo:**
  - Escala: `4, 8, 12, 16, 20, 24, 32, 44px`.
  - Raios: `--raio-campo: 14px`, `--raio-bloco: 22px`, `--raio-pilula: 999px`.
  - Relevo tátil: `box-shadow: 0 4px 0 var(--labio)`; ao pressionar (`:active`), `translateY(3px)` e `box-shadow: 0 1px 0 var(--labio)`.
- **Movimento (curvas e durações):**
  - Entrada / mola tátil: `cubic-bezier(0.2, 0.9, 0.3, 1.3)` em `320ms–420ms`.
  - Microinteração / hover / saída: `cubic-bezier(0.2, 0.8, 0.3, 1)` em `140ms–220ms`.
  - Momentos raros (construção da ponte, conclusão): `480ms–700ms` com escalonamento (`120ms` entre tábuas/cartões).

---

## 3. Componentes-base e Moldura

- **Barra lateral e topo (Linear):** barra lateral limpa com logo, "Minhas trilhas", lista de trilhas com indicador de progresso discreto e "+ Nova trilha"; topo com contexto real da tela (não "Área de estudo" genérico) + selo de sincronia.
- **Meus planos (Notion + Apple Handoff + Linear):**
  - Nunca vazio: quando há 0 trilhas, abre entrada guiada com ideias prontas e "Experimentar com frações".
  - Quando há >= 1 trilha: cartão hero **"Continue de onde parou"** no topo (com ilustração da região, título da trilha, próxima lição, progresso e um único botão azul primário + selo discreto de sincronia). Demais trilhas em grade secundária.
- **Pedido (Raycast + Arc):** campo de pedido dominante acima da dobra, botão "Gerar trilha" visível sem rolar em 1440 px, e cartão de destaque para **"Tenho um material (PDF, DOCX, CSV ou foto)"** logo ao lado/abaixo do campo, colocando o 1º passo da demo em evidência.
- **Aula (Raycast + Brilliant):**
  - Largura confortável (`46rem`), Stu presente também no cabeçalho/lateral do exercício com reação ao estado (neutro, pensando, comemorando, atento no erro).
  - Sem repetição do rótulo "Exercício": a etiqueta da etapa identifica o tipo e o `h1` traz direto o enunciado/pergunta.
  - Rodapé como barra de ação fixa com atalhos de teclado visíveis no desktop (`1–4` opções, `Enter` confirmar/continuar).
- **Trilha (mapa):** no desktop, aproveitar melhor a largura (`max-width: 52rem` com faixas de região integradas) e diferenciar ícones dos nós por natureza (conceito/livro, prática/alvo, revisão/revisão, concluída/check, bloqueada/cadeado).

---

## 4. Momentos-Assinatura (Padrões de `REFERENCIAS-UI.md`)

### Momento 1 — Seu próprio material → Trilha → Citação
- **Adotado:** **Perplexity** (marcador numerado `[1]` discreto na explicação da lição quando há `referencias`) + **NotebookLM** (ao tocar no marcador ou no cartão de fonte, abre/destaca a citação exata com `nome`, `página / parágrafo / linha`, trecho literal em destaque e miniatura quando for foto; lista "Fontes desta lição" recolhível no pé).
- **Descartado:** painel lateral fixo 50/50 do material inteiro (quebra em 360 px e no mobile; o cartão expansível em destaque preserva paridade web/app).
- **Estados:** carregando prévia, prévia por parágrafo (DOCX) / tabela rolável (CSV) / miniatura (foto), citação aberta com destaque, selo "Modo demonstração" quando `leitura === 'demonstracao'`.

### Momento 2 — O erro muda o caminho (Ponte de Reforço)
- **Adotado:** **Brilliant** (o Stu reage ao esforço: expressão atenta ao errar, celebração distinta quando a pessoa acerta *após* construir a ponte vs. de primeira) + **Family** (continuidade física: o erro não é punição, vira o 1º degrau/tábua da ponte; a animação grande de tábuas se encaixando acontece aqui ao construir a ponte).
- **Descartado:** Rive (sem dependências externas; implementado com CSS/SVG na web e Views/Animated no mobile).
- **Estados:** erro no exercício → CTA em destaque "Ver outro jeito de entender" → construção animada da ponte (`.ponte-desenho` com tábuas sequenciais) → desafio da ponte → ponte concluída ("Ponte atravessada!") → retorno ao exercício original → marca visual da ponte no mapa da trilha.

### Momento 3 — Ensine ao Stu
- **Adotado:** **Brilliant** (inversão de papéis: Stu aparece como aluno atento com balão de dúvida; durante a gravação, barras de onda/movimento reagem ao volume real do microfone via Web Audio `AnalyserNode` na web e metering no Expo) + **Family** (uma coisa por vez: 1. Gravar ou escrever → 2. Revisar transcrição editável → 3. Enviar para o Stu) + **Raycast** (atalhos na barra de ação).
- **Descartado:** envio automático logo após parar de gravar (spec 05 exige revisão explícita da transcrição antes de enviar).
- **Estados:** pronto para explicar, gravando com onda sonora + contador `0–60s`, revisão de transcrição, enviando, feedback estruturado em cartões (pontos corretos, lacuna, pergunta para outra situação, próximo passo) com selo de modo automático quando `simulado === true`.

### Momento 4 — Evidência visível e Outro dispositivo
- **Adotado:** **Spotify Wrapped** (tela de conclusão em 3 cartões de história qualitativa: o que aprendeu, a ponte/esforço da lição, o que explicou ao Stu — sem pontuação, D16) + **Apple Handoff** (cartão "Continue de onde parou" em Meus planos) + **Figma** (selo discreto **"Salvo na nuvem · atualizado agora"** ao carregar progresso do servidor).
- **Descartado:** cursores em tempo real ou placares numéricos (D16).
- **Estados:** conclusão com confete e cartões de história, mapa atualizado com ponte concluída, retorno em outro dispositivo mostrando progresso sincronizado.
