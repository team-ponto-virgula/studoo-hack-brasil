# Demonstração e avaliação do Studoo

## Demonstração em dois minutos

Prepare uma conta de demonstração, conexão estável e três páginas sobre frações. Se a OpenAI real não estiver configurada, use **Experimentar com frações** e diga claramente que o conteúdo é simulado. Não apresente a simulação como geração real.

1. **0:00–0:25 — Seu próprio material.** Abra Nova trilha. Envie PDF, DOCX, CSV ou fotografe uma página. Em DOCX, mostre a referência por parágrafo; em CSV, a prévia da tabela e a referência por linha. Confira o texto e crie a trilha. Mostre a página e a citação na primeira lição.
2. **0:25–0:55 — O erro muda o caminho.** Na lição de numerador e denominador da demonstração, responda “3” à pergunta sobre o total de partes em 3/8. Toque em **Ver outro jeito de entender**. Mostre a ponte com a explicação do chocolate e o novo desafio. Escolha “6”.
3. **0:55–1:30 — Aprender explicando.** Abra **Explique com suas palavras (opcional)**. Escreva uma explicação com exemplo, ou grave com a IA real configurada. Confira a transcrição, envie e mostre o caderno do Stu com a pergunta para outra situação. No modo simulado, explique a limitação do feedback.
4. **1:30–2:00 — Evidência visível.** Volte ao exercício, escolha “8”, conclua e mostre a ponte no mapa. Abra a mesma conta no outro dispositivo para demonstrar o progresso salvo no servidor.

Uma frase para o pitch: **“O Studoo transforma seu material em prática, usa o erro para oferecer outro caminho e pede que você explique o que entendeu.”**

## Qualquer assunto, em um minuto

Sem a OpenAI, as trilhas prontas do modo demonstração mostram assuntos além de programação. Diga que o conteúdo é de demonstração.

1. Peça “Quero aprender violão do zero”. No exemplo do Lá menor, mostre o diagrama, toque em **Ouvir o acorde** e faça a prática com o cronômetro.
2. Na troca de Lá menor para Dó, ordene os movimentos; erre de propósito para mostrar as posições certas e erradas.
3. Peça “Inglês para conversar em viagens”: ouça as frases e faça o exercício de escuta.
4. Em “História do Brasil para a prova”, mostre a linha do tempo e a resposta aberta, com os critérios e a resposta modelo.

Todas as ideias populares da tela inicial (violão, inglês, culinária, história do Brasil, frações e fotografia) abrem trilhas prontas. Outros assuntos, sem a OpenAI, recebem a trilha genérica de demonstração.

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
