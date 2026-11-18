# 08 — Voz ao vivo com o Stu (OpenAI Realtime API)

## Objetivo
Permitir conversa de voz ao vivo com o **Stu** dentro da atividade **"Explique com suas palavras"** do Estúdio, mantendo o recurso **desligado por padrão** (`STUDOO_VOZ_AO_VIVO` diferente de `1`, sem `OPENAI_API_KEY` ou sem provedor de texto real configurado).

**Modo misto (decisão do dono, 18/11/2026):** no site, texto pela DeepSeek e voz pela OpenAI. A voz ao vivo fica ligada com `STUDOO_VOZ_AO_VIVO=1`, `OPENAI_API_KEY` válida e provedor de texto real: `IA=openai`, ou `IA=deepseek` com `DEEPSEEK_API_KEY`. Com `IA=falsa`, fica desligada (voz real com retorno simulado não faz sentido). Com `IA=deepseek`, a conversa e a transcrição da gravação vão para a OpenAI; trilhas, material, ponte e o avaliador do Explique (inclusive o texto que sai da conversa) vão para a DeepSeek, e nenhum pedido de texto chega à OpenAI. Os avisos (`notaPrivacidadePorProvedor` e `privacidadeTextoPorProvedor` em `packages/contratos/src/experiencia.ts`) dizem que a voz vai para a OpenAI e, no modo misto, que o texto da explicação é avaliado pela DeepSeek.

Ao encerrar a conversa, apenas a **transcrição da fala da pessoa** é enviada para o avaliador existente (`POST /api/estudio/licoes/[id]/ensinar`), preservando os quatro eixos de retorno, o registro de conclusão e a experiência atual de texto/gravação como alternativa de um toque.

---

## Caminho escolhido: interface unificada (`POST /v1/realtime/calls` + `hangup` no servidor)
A documentação oficial da **OpenAI Realtime API** (referência REST `/v1/realtime/calls` e guia WebRTC unificado) confirma que:
1. O servidor pode abrir a chamada WebRTC enviando `multipart/form-data` com `sdp` (oferta do navegador) e `session` (JSON de configuração) para `POST /v1/realtime/calls` autenticado com `OPENAI_API_KEY` e cabeçalho `OpenAI-Safety-Identifier`.
2. A resposta `201 Created` devolve o SDP `answer` no corpo e o identificador da chamada no cabeçalho `Location` (ex.: `/v1/realtime/calls/<call_id>`).
3. Existe encerramento ativo pelo servidor para chamadas WebRTC: `POST /v1/realtime/calls/{call_id}/hangup`.

**Por que escolhemos a interface unificada (em vez de segredo efêmero no navegador):**
- **Teto de custo garantido no servidor:** o navegador nunca pode segurar a chamada até os 60 minutos máximos da API; o servidor agenda o encerramento forçado aos **3m15s (`195` s)** e também encerra imediatamente quando a pessoa clica em **"Encerrar e ver retorno"** (`POST /api/estudio/licoes/[id]/voz-ao-vivo/encerrar`).
- **Nenhuma credencial no navegador:** nem `OPENAI_API_KEY` nem segredo efêmero saem do servidor.
- **CSP inalterada:** como o navegador envia a oferta SDP para o próprio Studoo (`/api/estudio/licoes/[id]/voz-ao-vivo`) e o WebRTC usa ICE/DTLS direto sem `fetch` para `api.openai.com`, `connect-src` em `src/proxy.ts` não precisa liberar `https://api.openai.com`.

---

## O que a documentação oficial confirma
- **`POST /v1/realtime/calls`** (`multipart/form-data` com `sdp` e `session`):
  - `session.type = "realtime"`
  - `session.model`: `OPENAI_REALTIME_MODELO` (padrão `gpt-realtime-2.1`)
  - `session.instructions`: instruções pedagógicas geradas no servidor
  - `session.output_modalities = ["audio"]`
  - `session.audio.input.transcription = { model: "gpt-4o-transcribe", language: "pt" }`
  - `session.audio.input.turn_detection = { type: "semantic_vad", eagerness: "low", interrupt_response: true }` — espera pausas de quem está pensando e permite interrupção natural pela pessoa
  - `session.audio.output.voice`: `OPENAI_REALTIME_VOZ` (padrão `marin`)
- **`POST /v1/realtime/calls/{call_id}/hangup`**: encerra a chamada WebRTC ativa no servidor.
- **Eventos no canal de dados `oai-events`:**
  - `conversation.item.input_audio_transcription.delta` e `conversation.item.input_audio_transcription.completed` (`transcript`, `item_id`) para a fala da pessoa.
  - `response.output_audio_transcript.delta` / `.done` para a legenda do Stu.
  - O Stu fala primeiro: o cliente dispara `response.create` ao abrir o canal `oai-events` para o Stu cumprimentar e pedir a explicação.
  - Separação de uso: `response.done` traz `response.usage` da resposta, enquanto o uso da transcrição de entrada vem em `conversation.item.input_audio_transcription.completed`.
- **Distinção frente a `/v1/live/sessions`:** `/v1/live/sessions` (`gpt-live-1`) é um paradigma mais novo; esta implementação usa explicitamente a **Realtime API** (`/v1/realtime/calls`).

---

## Confirmado com chave real em 18/11/2026
**Chamada (`criarChamadaVozAoVivo` + `hangup`, oferta SDP real do Chromium):**
- Criação `201 Created` com cabeçalho `Location` no formato `/v1/realtime/calls/rtc_…`, modelo `gpt-realtime-2.1`, voz `marin` e configuração de sessão aceitos.
- Resposta `text/plain` com o SDP `answer` completo (áudio, canal de dados e 6 candidatos TCP e UDP).
- `POST /v1/realtime/calls/{call_id}/hangup` devolve `200`.
- **Quebra de linha final no SDP:** a OpenAI recusa com `400` (`invalid_offer`, `"Failed to parse offer: failed to unmarshal SDP: EOF"`) oferta que não termine em `\r\n`; `validarSdpOferta` preserva as linhas e acrescenta o `\r\n` final se faltar.

**Conversa completa no navegador** (servidor local com `IA=openai`, Chromium com microfone falso lendo um áudio de 86 s; execução: Studoo Lead; análise: Studoo Web & API; evidências em `studoo-ui-capturas/voz-ao-vivo/real/`):
- Conexão em 0,3 s, canal `oai-events` aberto em 0,6 s, o Stu fala primeiro. Três falas transcritas completas e na ordem; a transcrição enviada ao avaliador é só a da pessoa. Item de sistema dos 150 s aceito sem `error`; fim aos 180 s; nenhum evento `error` na conversa.
- Mídia: bytes de áudio enviados e recebidos maiores que zero, 0 pacotes perdidos; par de candidatos UDP `host`/`host`.
- `session.created` chega com `server_vad` e `session.updated` aplica a configuração (`semantic_vad`, `eagerness: "low"`, `gpt-4o-transcribe`, `pt`).
- Confirmados: `output_audio_buffer.started` / `.stopped`, `input_audio_buffer.speech_started` / `.speech_stopped` / `.committed`, `conversation.item.input_audio_transcription.delta` / `.completed`, `response.created` / `response.done` (status `completed` ou `cancelled`).

**Divergências do que esta spec supunha (já tratadas ou documentadas):**
1. **Nome do evento de item criado:** a API manda `conversation.item.added` seguido de `conversation.item.done`; `conversation.item.created` não veio. O redutor aceita os dois nomes.
2. **`semantic_vad` com `eagerness: "low"` em português** corta a fala nas pausas entre frases: uma fala de 19 s virou 3 itens. Cada corte abre uma resposta que a API cancela logo em seguida (`response.done` com `status: "cancelled"`, `reason: "turn_detected"`, uso zero). Sem falha e sem custo; a transcrição final fica completa e na ordem.
3. **Interrupção do Stu:** quando a pessoa fala por cima, vem `output_audio_buffer.cleared` (com `conversation.item.truncated`) no lugar de `output_audio_buffer.stopped`. O redutor compartilhado trata `cleared` como fim de "Stu falando".
4. **Legenda da pessoa em rajada (comportamento da API):** a API só transcreve depois de confirmar o áudio (`input_audio_buffer.committed`), então os `delta` da transcrição de entrada chegam em rajada logo antes do `completed`, e não enquanto a pessoa fala. O redutor já trata o `delta`; não há o que mudar no cliente.
5. **Uso da transcrição de entrada:** o formato do campo `usage` de `conversation.item.input_audio_transcription.completed` não foi registrado na conversa real.
6. **Log no caminho de sucesso:** o servidor não escrevia nada quando a conversa dava certo. Agora escreve uma linha por conversa criada e uma por encerrada (ver "Privacidade em log").

**Retorno do "Explique com suas palavras":** o avaliador recebia a lição inteira, com os exercícios, e cobrou a pergunta de um exercício. Agora recebe só o recorte de ensino (título, objetivo, conceito, exemplo, passos e falas) e avalia a ideia da lição; vale para texto, gravação e voz. `STUDOO_IA_RESERVA` **não vale para o Explique**: se a IA falhar, o retorno local entra mesmo com `STUDOO_IA_RESERVA=nenhuma`, rotulado como "Retorno automático…".

**Ainda não verificado:**
- Geração de trilha por objetivo escrito pela tela, com a IA real.
- Voz humana com microfone real (a conversa usou áudio gravado).
- Safari (incluindo o áudio do Stu tocar sem segundo toque) e celular.
- Formato do `usage` da transcrição de entrada (item 5).
- **Fala em andamento no instante do encerramento:** com `semantic_vad` ativo, a referência da OpenAI orienta a não enviar `input_audio_buffer.commit` manual; por isso, ao clicar em `"Encerrar e ver retorno"`, o cliente aguarda até 3 s apenas pelos itens já confirmados/pendentes.
- **Aplicativo móvel**: os contratos em `packages/contratos` ficam prontos, mas WebRTC nativo em React Native fica fora desta entrega web.

---

## Limitação operacional do temporizador de corte (195 s)
- O temporizador que agenda `POST /v1/realtime/calls/{call_id}/hangup` aos `195 s` vive na **memória do processo Node** (`chamadasAtivas`). Isso pressupõe servidor de longa duração: se o contêiner reiniciar no meio de uma conversa ativa, o temporizador em memória se perde.
- **O que limita o dano nesse cenário:** (1) os tetos persistentes no PostgreSQL por usuário e para visitantes; e (2) o teto rígido de **60 minutos** imposto pela própria API Realtime da OpenAI (a referência REST `/v1/realtime/calls` não expõe parâmetro configurável de duração máxima de sessão — `expires_after` aplica-se apenas a `client_secrets`).

---

## Desenho técnico

### Etapa 1 — Servidor, contratos, instruções e CLI
1. **Flags e configuração (`src/servidor/ia/realtime.ts` e `GET /api/auth/config`)**:
   - `vozAoVivoAtiva()`: verdadeira apenas quando `STUDOO_VOZ_AO_VIVO === "1"`, `configuracaoOpenAi()` está presente e o provedor de texto é real e configurado (`openai`, ou `deepseek` com `configuracaoDeepSeek()`: modo misto).
   - `vozAoVivoVisitanteAtiva()`: verdadeira apenas quando `vozAoVivoAtiva()` e `STUDOO_VOZ_AO_VIVO_VISITANTE === "1"`.
   - `GET /api/auth/config` passa a retornar `{ google, recuperacao, ia, visitante, vozAoVivo }`.
2. **Rotas privadas**:
   - `POST /api/estudio/licoes/[id]/voz-ao-vivo`:
     - Autenticada via `rotaPrivada`.
     - Retorna `404` se `vozAoVivoAtiva()` for falsa.
     - Se conta for visitante (`ehEmailVisitante`), retorna `403` quando `vozAoVivoVisitanteAtiva()` for falsa; quando ativa, aplica teto de `1` conversa por conta de visitante e teto diário compartilhado entre todos os visitantes (`ia:voz:visitantes:dia`, padrão `20`/dia, no molde de `ia:geracao:visitantes:dia`).
     - Para conta normal, aplica limite persistente via `consumirLimite` (`3` por hora e `10` por dia por usuário), retornando `429` quando excedido.
     - Recebe `{ sdp }` (oferta SDP WebRTC válida), carrega lição + apoio, monta instruções com `montarInstrucoesVozAoVivo`, chama `POST <base>/realtime/calls` com `OpenAI-Safety-Identifier: assinatura(usuarioId)`, registra a chamada ativa para o usuário com timer de encerramento forçado no servidor aos `195` s (`3m15s`), e devolve `{ chamadaId, sdpResposta, modelo, voz, limiteSegundos: 180, avisoSegundos: 150 }`.
   - `POST /api/estudio/licoes/[id]/voz-ao-vivo/encerrar`:
     - Recebe `{ chamadaId }`, verifica posse do usuário e chama `POST <base>/realtime/calls/{callId}/hangup` (idempotente).
3. **Construtor puro de instruções (`montarInstrucoesVozAoVivo`)**:
   - As 8 regras pedagógicas do Stu (estudante curioso que começa cumprimentando e pedindo a explicação, <=3 perguntas curtas uma por vez mirando lacunas e erros comuns do apoio, <=2 frases/turno, dica/exemplo antes de explicar em 1 frase após 2 tentativas, pedido de exemplo do dia a dia, fechamento em 2 frases sem XP/nota/ranking, PT-BR no tema sem PII, aviso perto de 2m30s e encerramento em 3m00s).
4. **Privacidade em log**:
   - **Nem áudio nem transcrição** são gravados em log do servidor; apenas contadores de uso/limite e motivo curto de erro.
   - **Log de uso (caminho de sucesso):** uma linha por conversa criada (`[voz-ao-vivo] conversa criada ref=…abcd modelo=… ativas=N`) e uma por encerrada (`[voz-ao-vivo] conversa encerrada ref=…abcd motivo=cliente|teto|substituida duracao=Ns ativas=N`). `ref` são só os 4 últimos caracteres do id da chamada, para casar as duas linhas; sem identificador de usuário, id completo, áudio, SDP nem texto. `substituida` é quando a mesma pessoa abre outra conversa com uma ainda ativa.
   - A transcrição da fala da pessoa segue o mesmo caminho e a mesma guarda do texto do `"Explique com suas palavras"` (`ensinarStu`).
5. **Script de conferência (`npm run voz:conferir` / `scripts/conferir-voz-ao-vivo.ts`)**:
   - Valida criação e encerramento de chamada Realtime contra `OPENAI_BASE_URL` sem precisar de áudio.

### Etapa 2 — Cliente web, privacidade e paridade (390×844 / 360)
1. **Máquina de estados pura (`src/app/voz-ao-vivo.ts`)**:
   - Estados: `pedindo_mic`, `conectando`, `ouvindo`, `stu_falando`, `encerrando`, `erro`.
   - Envia oferta SDP local para `/api/estudio/licoes/[id]/voz-ao-vivo` (interface unificada), abre `oai-events`, envia `response.create` para o Stu começar, exibe legendas ao vivo, permite interrupção natural, controla timer (`150` s aviso / `180` s fim), mudo e `"Encerrar e ver retorno"` (chama `/encerrar` e envia **somente** a transcrição da pessoa para `ensinarStu`).
2. **Aviso de privacidade**:
   - Antes da primeira conversa ao vivo, informa que a voz vai para a OpenAI para a conversa ao vivo e que o Studoo não guarda áudio nem transcrição da conversa em log.
3. **Referência única de tela para web e app (390×844 e 360 de largura)**:
   - Todos os textos vêm de `mensagens.estudio.vozAoVivo` em `packages/contratos/src/experiencia.ts`; nenhum controle exclusivo de navegador.
   - **Ordem exata dos blocos dentro de "Explique com suas palavras":**
     1. Botão de entrada **`Conversar com o Stu`** (`min-height: 44px`, largura `100%` em 360/390, acima da área de texto/gravação quando `vozAoVivo` estiver ativo).
     2. **Cartão de aviso de privacidade** (na primeira vez, `padding: 16px`, `gap: 12px`): título `privacidadeTitulo` (16px/600), texto `privacidadeTexto` (14px/1.5), botões `Começar conversa` (primário, `min-height: 44px`) e `Agora não` (secundário, `min-height: 44px`).
     3. **Painel da conversa ao vivo** (`padding: 16px`, `gap: 12px`, borda `1px`, raio `14px`):
        - **Cabeçalho (`min-height: 44px`, linha única):** mascote `Stu` (`44×44px`), estado atual (`estados[estado]`, `aria-live="polite"`, 14px/600) e cronômetro `MM:SS / 03:00` (`font-variant-numeric: tabular-nums`, 13px).
        - **Aviso de tempo** (aos `150s`, faixa `padding: 8px 12px`, 13px): `avisoTempo`.
        - **Legendas ao vivo** (`min-height: 120px`, `max-height: 220px`, rolável, `gap: 8px`): falas do Stu (`stuDisse`) e da pessoa (`voceDisse`), 14px/1.45.
        - **Controles (`gap: 8px`, empilhados em 100% de largura em 360/390, `min-height: 44px` cada):**
          1. `Silenciar microfone` / `Ativar microfone` (secundário)
          2. `Encerrar e ver retorno` (primário)
          3. `Prefiro escrever ou gravar` (botão texto, `min-height: 40px`)
     4. **Estado de erro** (substitui legendas mantendo o cabeçalho e a alternativa em 1 toque): mensagem de `erros.*` (`role="alert"`, 14px) + botão `Prefiro escrever ou gravar` (`min-height: 44px`).
   - Animações respeitam `prefers-reduced-motion: reduce`.


---

## Roteiro de validação com chave real
Quando a `OPENAI_API_KEY` real estiver disponível em ambiente de ensaio/produção:
1. **Conferência técnica via CLI (`npm run voz:conferir`)**:
   - Definir `STUDOO_VOZ_AO_VIVO=1`, `OPENAI_API_KEY=<chave>` e `IA=openai` (ou, no modo misto, `IA=deepseek` com `DEEPSEEK_API_KEY`) e executar `npm run voz:conferir`. A saída traz `provedorTexto`.
   - Esperado: saída JSON com `"ok": true`, `sdpRecebido: true` e encerramento por `hangup` sem erro.
2. **Limites para ensaio**:
   - Subir temporariamente `STUDOO_LIMITE_VOZ_HORA` (padrão `3`) e `STUDOO_LIMITE_VOZ_DIA` (padrão `10`) para evitar bloqueio `429` durante testes seguidos da equipe.
3. **Primeira conversa no navegador e no Safari**:
   - Abrir uma lição até o último exercício, expandir `"Explique com suas palavras (opcional)"` e tocar em `"Conversar com o Stu"`.
   - Confirmar que o áudio do Stu toca automaticamente no Safari (sem precisar de segundo toque, graças à criação síncrona do `<audio>` no clique).
4. **Logs do servidor**:
   - Verificar que nenhum áudio ou transcrição aparece no log do servidor; em caso de falha na OpenAI, conferir apenas `status` HTTP e `codigo` higienizado (`[voz-ao-vivo] resposta OpenAI status=... codigo=...`).
5. **Eventos do canal `oai-events` (DevTools / console em desenvolvimento)**:
   - Confirmar recebimento de `output_audio_buffer.started` e `output_audio_buffer.stopped` alternando `Stu falando` / `Ouvindo você`.
   - Confirmar aceitação do item de sistema (`conversation.item.create`) enviado aos `150 s` sem erro fatal.
   - Confirmar `response.done` com `response.status === "completed"` (ou tratamento de `failed`/`incomplete` caso ocorra).
