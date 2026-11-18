# Demonstração e avaliação do Studoo

## Demonstração em dois minutos

Prepare uma conta de demonstração, conexão estável e três páginas sobre frações. Se nenhuma chave de IA real estiver configurada (`IA=openai` ou `IA=deepseek`), use **Experimentar com frações** e diga claramente que o conteúdo é simulado e rotulado como **Modo demonstração** (nunca apresente a simulação como geração real).

1. **0:00–0:25 — Seu próprio material.** Abra **Nova trilha** e envie PDF, DOCX, CSV, foto ou clique em **Experimentar com frações**. Mostre a prévia extraída página a página (ou tabela em CSV) e crie a trilha. Na primeira lição, toque no marcador `[1]` para abrir o cartão **Fonte do seu material** com a citação literal.
2. **0:25–0:55 — O erro muda o caminho.** Na lição, erre de propósito e toque em **Ver outro jeito de entender**. Mostre a ponte com a margem **Onde travou**, a legenda numerada com a tentativa completa, as quatro tábuas sobre o rio e o aviso **Modo demonstração** (quando simulado). Avance passo a passo (**Ver exemplo** → **Ir para o desafio**) e acerte o desafio para ver as tábuas ficarem verdes, o **Stu** atravessar para **De volta ao desafio** e o botão **Voltar ao exercício** aparecer logo abaixo da cena.
3. **0:55–1:30 — Aprender explicando.** Abra **Explique com suas palavras (opcional)**, mostre o Stu como aluno com as três etapas, escreva uma explicação com exemplo (ou grave com `IA=openai` configurada; com DeepSeek, a voz não funciona — escreva a explicação) e envie para mostrar o retorno em quatro cartões (**O que fez sentido**, **O que revisar**, **Leve a ideia adiante** e **Próximo passo**).
4. **1:30–2:00 — Evidência visível e sincronia.** Volte ao exercício (**Voltar ao exercício**), acerte e conclua a lição para mostrar os cartões de história na tela de conclusão (**Ponte construída**), o selo **Ponte construída** no mapa da trilha e o selo de sincronia ao vivo no cabeçalho (inclusive no outro dispositivo).

Uma frase para o pitch: **“O Studoo transforma seu material em prática, usa o erro para oferecer outro caminho e pede que você explique o que entendeu.”**

## Qualquer assunto, em um minuto

Sem chave de IA, as trilhas prontas do modo demonstração mostram assuntos além de programação. Diga que o conteúdo é de demonstração.

1. Peça “Quero aprender violão do zero”. No exemplo do Lá menor, mostre o diagrama, toque em **Ouvir o acorde** e faça a prática com o cronômetro.
2. Na troca de Lá menor para Dó, ordene os movimentos; erre de propósito para mostrar as posições certas e erradas.
3. Peça “Inglês para conversar em viagens”: ouça as frases e faça o exercício de escuta.
4. Em “História do Brasil para a prova”, mostre a linha do tempo e a resposta aberta, com os critérios e a resposta modelo.

Todas as ideias populares da tela inicial (violão, inglês, culinária, história do Brasil, frações e fotografia) abrem trilhas prontas. Outros assuntos, sem chave de IA, recebem a trilha genérica de demonstração.

## Conferência antes de apresentar

- Migrações aplicadas, conta funcionando, domínio HTTPS, Google/Resend configurados se usados na demo.
- `.env.local` com chave válida (`IA=openai` ou `IA=deepseek`). Não mostrar o arquivo em transmissão ou screenshots.
- `npm run ia:conferir`: valida a integração de geração existente. Depois percorrer material, reforço, ensino e voz com a configuração real; o comando antigo não cobre os recursos novos.
- Citação existe e sustenta a ideia; números/fórmulas extraídos foram conferidos por uma pessoa.
- Android: gerar novo development build (o app passou a usar `expo-speech` para a voz), permitir câmera/microfone somente quando solicitado, testar negar permissão, gravar/parar, segundo plano, voltar à tela, upload pelo seletor e texto com teclado aberto.
- Web: testar em 360 px e computador, navegação por teclado, movimento reduzido e falha de rede.
- Agendar `npm run estudio:limpar` de hora em hora.
- Usar um vídeo curto previamente gravado como reserva, identificado como gravação; nunca fingir que é uma execução ao vivo.

## Piloto com 5–10 estudantes reais

Este é um protocolo para executar, não um relato de resultados. Convide participantes com consentimento, material sem dados pessoais e possibilidade de desistir. Para menores, siga o processo de consentimento aplicável à instituição antes do teste.

Dê a cada pessoa o mesmo objetivo pequeno. Peça três questões antes, uma sessão de dez minutos no Studoo e três questões equivalentes depois, diferentes das anteriores. Uma pessoa com domínio do assunto deve conferir os itens e o feedback gerado. Evite fornecer a resposta durante a sessão.

Registre por identificador anônimo:

| ID | Configuração (real/simulada) | Pré (0–3) | Pós (0–3) | Terminou sem ajuda? | Tempo | Erros de conteúdo | Dificuldade observada | Comentário autorizado |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

Observe também: conseguir enviar o material, localizar a referência, entender para que serve o reforço e revisar a transcrição. Peça ao participante que explique o conceito em um exemplo novo, sem consultar a tela.

Ao relatar, mostre o número real de participantes, quantos terminaram, quais dificuldades ocorreram e as mudanças feitas a partir delas. Uma amostra pequena sem grupo de comparação não demonstra eficácia geral. Não invente percentuais, depoimentos ou melhorias; mantenha a tabela vazia até a coleta.
