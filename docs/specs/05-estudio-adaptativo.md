# Estudo com material, reforço e explicação ao Stu

A web e o app Android compartilham contrato, limites e textos. O servidor decide acesso, geração e progresso. A interface nativa usa Expo DocumentPicker, ImagePicker e Audio; exige um novo build de desenvolvimento após instalar as dependências.

## Material → trilha

No pedido, selecione imagem JPG/PNG/WebP, PDF (até seis páginas), DOCX ou CSV, até 5 MB. O texto extraído é limitado a 24 mil caracteres; CSV a 200 registros e 20 colunas, em UTF-8. A câmera é opcional. Antes do envio, a interface informa o uso da OpenAI e pede material sem dados pessoais.

O servidor confere tamanho, assinatura e formato. PDF com texto passa pelo PDF.js, sem executar scripts do documento; imagem é normalizada pelo Sharp, removendo metadados e limitando pixels. Imagens e páginas digitalizadas usam leitura pela OpenAI. A interface permite conferir o texto página a página e remover o material antes de gerar. Uma leitura incorreta deve ser substituída por uma imagem mais legível.

DOCX é lido como texto com Mammoth, sem converter conteúdo em HTML nem habilitar acesso a arquivos externos. O ZIP tem limite de entradas e de tamanho descompactado. As referências usam parágrafos em ordem de leitura, sem inventar páginas que dependem da diagramação do Word. Imagens incorporadas em DOCX não passam por OCR: envie a imagem separadamente.

CSV usa Papa Parse para reconhecer vírgula, ponto e vírgula, tabulação ou barra vertical, incluindo campos entre aspas. A prévia mostra uma tabela rolável. Valores continuam texto, preservando zeros à esquerda e vírgulas decimais; fórmulas não são executadas. As referências usam linhas lógicas (registros), incluindo eventual cabeçalho; uma quebra dentro de um campo entre aspas não cria outra linha da tabela. Não há inferência automática de tipos nem alteração do arquivo original.

Cada lição gerada leva localização (página, parágrafos ou linhas) e trecho literal. O servidor rejeita citações ausentes do texto lido. Isso verifica a existência do trecho; não comprova que a interpretação da IA está correta. Referências de OCR são identificadas. Arquivos e falas são dados, nunca instruções do sistema; o modelo não recebe ferramentas de navegação ou execução.

O upload bruto não é gravado pelo Studoo. O texto extraído fica acessível por 24 horas; uma proposta guarda cópia imutável por 30 minutos. As citações ficam nas lições aceitas. Execute `npm run estudio:limpar` a cada hora no ambiente do servidor para remover registros expirados. A expiração bloqueia o acesso mesmo antes da limpeza. O comando não remove planos ou citações salvas. O provedor externo segue sua própria política de tratamento de dados; na OpenAI, `store:false` é usado nas chamadas Responses, sem prometer retenção zero pelo provedor (na DeepSeek `/chat/completions`, não há `store:false`).

Em `IA=falsa`, o botão **Experimentar com frações** usa três páginas autorais e três lições preparadas. PDF textual, DOCX e CSV também funcionam, com atividades de reconhecimento explicitamente simuladas. Fotos e voz exigem IA real; nunca há uma transcrição inventada.

## Ponte de reforço

Após uma resposta incorreta, **Ver outro jeito de entender** abre a seção de apoio e constrói a ponte passo a passo (**Ver exemplo** → **Ir para o desafio**) com uma explicação por outro caminho, exemplo e desafio novos. Ao vencer o desafio, **Voltar ao exercício** retorna à tentativa original. O mapa marca a ponte na lição de origem com o selo **Ponte construída**.

Acertar o reforço não conclui a lição nem infla o progresso. A pessoa retorna ao exercício original. A ponte é persistida e reaproveitada; falhas do provedor permitem nova tentativa. O motivo descreve uma possível dificuldade, sem afirmar um diagnóstico do aluno. O comportamento existente de continuar a lição após ler o feedback permanece disponível.

### Ponte clara (revisão de 20/11, pedido do dono)

Palavras do dono: "Nessa parte aqui de outro jeito de entender tá meio confuso, eu inicialmente cliquei e não entendi qual o sentido dessa parte. Melhore a UI e UX." Vale para web, Android e iPhone, entra na candidata do TestFlight e substitui a apresentação acima. A ideia e o servidor não mudam: a ponte leva de onde a pessoa travou de volta ao exercício, em três passos (outro caminho, exemplo, desafio). Ainda não implementado.

**O que confundia** (captura do dono): nada dizia por que a pessoa estava ali. A primeira ação era sair ("Voltar ao exercício"). O desenho da ponte e os quatro cartões mostravam a mesma coisa duas vezes, sem dizer o que era tocável nem o passo atual. Os rótulos eram de sistema ("Sua tentativa: normal", "Desafio vencido" antes de vencer). A explicação e a ação principal ficavam fora da primeira tela.

**Em uma olhada:** por que estou aqui (a frase do topo), em que passo estou (um só indicador) e o que faço agora (um botão principal no rodapé).

**Ordem em 390** (o alto da aula, com X, andamento e som, continua):
1. **Rótulo e título:** o selo "REFORÇO" (`ponteMapa`, no estilo do "CONCEITO" da lição, com o ícone `revisao` (o laço), o mesmo do selo "Reforço" no mapa, que existe na web e no app) e o título "Outro jeito de entender" (`ponte`), o mesmo nome do botão que abriu a tela.
2. **Por que estou aqui**, em 16/24 `#0B1B5C`:
   - com resposta escrita ou escolhida: "Você respondeu “<resposta>”. Em 3 passos curtos, você vê a ideia por outro caminho e volta ao exercício." (`ponteMotivoResposta`, com a resposta cortada em 60 caracteres e "…");
   - sem resposta de texto (ordenar, associar): "Em 3 passos curtos, você vê a ideia por outro caminho e volta ao exercício." (`ponteMotivo`).
3. **O indicador, um só:** a faixa da ponte, com 88 px de altura e a largura do conteúdo.
   - Margem da esquerda "Onde travou" (`ponteMargemErro`), três tábuas numeradas 1, 2 e 3, e a margem da direita "Exercício" (`ponteMargemVolta`, texto novo).
   - Tábua feita: cheia, com o tom de madeira de hoje. Tábua atual: cheia, com o anel de 3 px na cor de ação (`--acao` na web, `cores.acao` no app, `#2563FF`). Tábua futura: tracejada.
   - O Stu (`stu-perfil`, 44 na web e 36 no app, spec 13) fica sobre a tábua atual.
   - Embaixo da faixa, em 14/20 800 `#5E6A85`: "Passo 1 de 3 · Outro caminho" (`ponteIndicador(n)` e o nome do passo).
   - A faixa não é tocável: sem borda de botão, sem cursor de mão, sem foco.
   - Os quatro cartões numerados saem.
4. **O passo atual**, um por vez, num cartão branco com borda de 2 px `#E1E7FA` e raio 20:
   - **Passo 1, "Outro caminho"** (`pontePassoExplicacao`): o `motivo` da ponte e, embaixo, o `conceito`. Se o conceito repetir o retorno do exercício, fica só o motivo.
   - **Passo 2, "Um exemplo"** (`pontePassoExemplo`, texto novo): o `exemplo`, no bloco de exemplo de hoje.
   - **Passo 3, "Desafio"** (`pontePassoDesafio`, texto novo): o enunciado e as opções do exercício da ponte, como numa questão da aula. Em cima dele, o botão de texto "Rever explicação e exemplo" (`ponteRever`), que abre os dois passos anteriores ali mesmo, recolhíveis.
5. **A saída**, depois do cartão, no fluxo: o botão de texto de 44 px "Voltar ao exercício" (`ponteVoltarExercicio`). Ele volta ao exercício sem vencer a ponte e nunca vem antes do conteúdo.
6. **O rodapé preso da aula** troca o "Avançar" pela ação do passo, sempre à vista:

| Passo | Ação principal | Depois |
|---|---|---|
| 1 | "Ver exemplo" (`ponteVerExemplo`) | vai ao passo 2 |
| 2 | "Ir para o desafio" (`ponteIrDesafio`) | vai ao passo 3 |
| 3, sem escolha | "Verificar", desligado | — |
| 3, com escolha | "Verificar" | certo: "Ponte construída!"; errado: retorno no cartão |
| 3, errou | "Tentar de novo" (`ponteTentarDeNovo`, novo) | limpa a escolha; o retorno fica até a nova escolha |
| Vencida | "Voltar ao exercício" (verde, `sucesso`) | volta ao exercício original, como hoje |

**Conferência de 20/11** (web 21286c4 e app 86411f8; decisões de paridade, iguais nos dois):
- **A faixa** segue a da web: fundo de água azul-claro com raio 16, as margens "Onde travou" e "Exercício" como texto (13/16 800 `#5E6A85`), sem caixas verdes, e as três tábuas no meio, com o Stu sobre a atual. A apresentação inicial usa a mesma faixa.
- **Sem o selo "Modo demonstração"** no alto da ponte. O conteúdo simulado continua marcado onde a lição já marca.
- **Só a ponte em cena:** do passo 1 até a ponte vencida, o cartão "Explique com suas palavras (opcional)" não aparece. Ele volta com o exercício original.
- **O rodapé preso** da ponte é branco, como o da aula sem retorno. O tom pêssego é do retorno de erro e sai quando a ponte abre.
- **Ao vencer**, o Stu na margem "Exercício" é o `stu-animado`, e não o `stu-perfil`.

**Ponte vencida:**
- a terceira tábua se completa, e o Stu chega à margem "Exercício" e vira `stu-animado` (uma vez, spec 13);
- a linha do indicador diz "Ponte construída!";
- o cartão mostra "Agora tente o exercício de novo." (`ponteVencida`, que substitui `ponteVoltar`) como título, com o retorno do desafio embaixo. "Ponte construída!" aparece só uma vez, na linha do indicador;
- a saída do item 5 some, porque a ação principal já é voltar.

**Ponte reaberta** (já construída): as três tábuas cheias, o Stu na margem "Exercício" e o aviso de hoje (`ponteReabertaAviso`) no lugar da frase do topo. O cartão mostra a explicação e o exemplo, e o rodapé mostra "Voltar ao exercício".

**Carregando** (a ponte ainda vem do servidor): a faixa com as três tábuas tracejadas, o Stu na margem "Onde travou" e, no cartão, "O Stu está preparando…" (`pensando`). O rodapé fica com "Ver exemplo" desligado. Erro: a mensagem de hoje e "Tentar de novo".

**Computador (1024 px ou mais):** a mesma ordem e os mesmos blocos, na coluna da aula (até 680 px). A faixa vai até 560 px. O rodapé continua o da aula.

**Movimento:**
- ao avançar, a tábua do passo se enche em 240 ms, o Stu dá um pulo até a próxima (320 ms) e o cartão troca subindo 8 px e aparecendo em 200 ms;
- ao vencer, o Stu atravessa até a margem e faz um ciclo de `stu-animado`;
- com movimento reduzido, tudo troca na hora e o Stu aparece no lugar novo.

**Som** (spec 12, sem som novo): `ponte_abrir` ao abrir a ponte, como hoje; `acerto` e `erro` no "Verificar" do desafio. Avançar de passo não tem som.

**Leitor de tela:**
- ao abrir, o foco vai para o título;
- a faixa é uma lista com o rótulo "Passos da ponte", com `aria-current="step"` na tábua atual, e as margens e o Stu são decorativos;
- a cada passo, o foco vai para o título do cartão, e a região educada anuncia "Passo 2 de 3 · Um exemplo";
- ao vencer, anuncia "Ponte construída! Agora tente o exercício de novo." e leva o foco ao "Voltar ao exercício" do rodapé.

**Textos** (contrato, `estudio`):
- **Novos:**
  - `ponteMotivoResposta(resposta)` "Você respondeu “<resposta>”. Em 3 passos curtos, você vê a ideia por outro caminho e volta ao exercício.";
  - `ponteMotivo` "Em 3 passos curtos, você vê a ideia por outro caminho e volta ao exercício.";
  - `ponteIndicador(n)` "Passo <n> de 3";
  - `ponteConstruida` "Ponte construída!";
  - `ponteVencida` "Agora tente o exercício de novo.";
  - `ponteRever` "Rever explicação e exemplo";
  - `ponteTentarDeNovo` "Tentar de novo".
- **Mudam:** `ponteMargemVolta` passa a "Exercício"; `pontePassoExemplo` passa a "Um exemplo"; `pontePassoDesafio` passa a "Desafio".
- **Continuam:** `verPonte`, `ponte`, `ponteMapa`, `ponteMargemErro`, `pontePassoExplicacao` ("Outro caminho"), `ponteVerExemplo`, `ponteIrDesafio`, `verificar`, `ponteVoltarExercicio`, `ponteReabertaAviso`, `pensando` e `ponteMapaFeita`.
- **Saem:** `ponteDica`, `ponteVoltar`, `ponteTabuaErro`, `pontePassoErro` e `construir`.

**Spec 07:** nenhuma diferença de plataforma.

**Aceite** (390, web e app; mesma lição, errar de propósito; quadros de cada passo, com a tela limpa):

| # | Passos | Esperado |
|---|---|---|
| R1 | Erra e toca em "Ver outro jeito de entender" | Selo, título, "Você respondeu “…”…", faixa com o Stu na tábua 1, "Passo 1 de 3 · Outro caminho", explicação e "Ver exemplo" no rodapé, tudo na primeira tela, a não ser o fim da explicação |
| R2 | "Ver exemplo" | Tábua 1 feita, Stu na 2, "Passo 2 de 3 · Um exemplo", o exemplo, "Ir para o desafio" |
| R3 | "Ir para o desafio" | "Passo 3 de 3 · Desafio", enunciado e opções, "Verificar" desligado até escolher |
| R4 | Escolhe errado e verifica | Som de erro, retorno no cartão, "Tentar de novo" |
| R5 | Escolhe certo e verifica | Som de acerto, Stu na margem "Exercício", "Ponte construída!", "Voltar ao exercício" verde |
| R6 | "Voltar ao exercício" | O exercício original, como hoje; o mapa marca "Ponte construída" |
| R7 | Abre a ponte já construída | Três tábuas cheias, aviso de reaberta, explicação e exemplo, "Voltar ao exercício" |
| R8 | "Voltar ao exercício" do fluxo no passo 1 | Volta ao exercício sem vencer |
| R9 | Movimento reduzido | Sem pulo nem troca animada |
| R10 | Leitor de tela de R1 a R5 | Foco e anúncios desta seção |
| R11 | 1440 | Mesma ordem, na coluna da aula |

## Explique com suas palavras (opcional)

A pessoa escreve de 20 a 3.000 caracteres ou grava até 60 segundos. O limite de duração é aplicado pelo cliente; o servidor limita a 5 MB e confere o formato. O áudio vai à transcrição, volta como texto editável e só é avaliado quando a pessoa toca em **Enviar minha explicação**. A gravação para ao sair da tela ou colocar o app em segundo plano. Negar acesso ao microfone não impede digitar.

O feedback traz pontos corretos, uma lacuna, pergunta de transferência e próximo passo. Sem nota ou alegação automática de domínio. O servidor guarda o feedback, não o áudio nem a explicação enviada. No modo simulado, o retorno diz explicitamente que não avalia a correção do texto.

## Configuração e limites

- `IA=openai` e `OPENAI_API_KEY`, somente no servidor. Texto, triagem, leitura de material, reforço e explicação usam `gpt-6-luna` (`reasoning.effort=max`).
- `OPENAI_MODELO_TRANSCRICAO=gpt-transcribe` seleciona o modelo de transcrição multipart.
- `OPENAI_BASE_URL` aceita HTTPS ou HTTP no próprio computador, para testes.
- Cotas persistentes por conta e hora: dez uploads, dez propostas, dez transcrições; vinte reforços e vinte avaliações de explicação.
- Todos os endpoints `/api/estudio` exigem sessão, verificam propriedade e preservam a proteção de origem web ou autenticação bearer nativa. O gabarito nunca faz parte do retorno público.

A migração `20261114020000_estudio_adaptativo` acrescenta `MaterialEstudo` e `ApoioLicao`. Nenhuma credencial vai ao bundle do app. O mobile acompanha os novos métodos de cliente, referências da lição e indicação de ponte no mapa na mesma alteração.

## Revisão e limites da evidência

`npm run test:estudio` cobre isolamento, expiração, citações, progresso, duplicação concorrente de reforço, formato de arquivo, recusas e respostas inválidas da IA, além de transcrição com provedor simulado. Rodar também typecheck web/nativo, testes existentes e build.

O roteiro da demonstração e o protocolo de avaliação estão em `../DEMO-HACKATHON.md`. Chamadas com chave real, microfone/câmera em Android físico e avaliação com estudantes exigem validação externa; não são substituídos por mocks ou por uma prévia React Native Web.

Referências técnicas: [Mammoth](https://github.com/mwilliamson/mammoth.js#readme) e [Papa Parse](https://www.papaparse.com/docs).
