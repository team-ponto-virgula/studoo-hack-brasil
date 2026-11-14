# Demonstração e avaliação do Studoo

## Demonstração em dois minutos

Prepare uma conta de demonstração, conexão estável e três páginas sobre frações. Se a OpenAI real não estiver configurada, use **Experimentar com frações** e diga claramente que o conteúdo é simulado. Não apresente a simulação como geração real.

1. **0:00–0:25 — Seu próprio material.** Abra Novo plano. Envie PDF, DOCX, CSV ou fotografe uma página. Em DOCX, mostre a referência por parágrafo; em CSV, a prévia da tabela e a referência por linha. Confira o texto e crie a trilha. Mostre a página e a citação na primeira lição.
2. **0:25–0:55 — O erro muda o caminho.** Na lição de numerador e denominador da demonstração, responda “3” à pergunta sobre o total de partes em 3/8. Toque em Ver reforço e Construir minha ponte. Mostre a explicação com chocolate e o novo desafio. Escolha “6”.
3. **0:55–1:30 — Aprender explicando.** Abra Ensine ao Stu. Escreva uma explicação com exemplo, ou grave com a IA real configurada. Confira a transcrição, envie e mostre a pergunta para outra situação. No modo simulado, explique a limitação do feedback.
4. **1:30–2:00 — Evidência visível.** Volte ao exercício, escolha “8”, conclua e mostre a ponte no mapa. Abra a mesma conta no outro dispositivo para demonstrar o progresso salvo no servidor.

Uma frase para o pitch: **“O Studoo transforma seu material em prática, usa o erro para oferecer outro caminho e pede que você explique o que entendeu.”**

## Conferência antes de apresentar

- Migrações aplicadas, conta funcionando, domínio HTTPS, Google/Resend configurados se usados na demo.
- `.env.local` com chave válida; `IA=openai`. Não mostrar o arquivo em transmissão ou screenshots.
- `npm run ia:conferir`: valida a integração de geração existente. Depois percorrer material, reforço, ensino e voz com a configuração real; o comando antigo não cobre os recursos novos.
- Citação existe e sustenta a ideia; números/fórmulas extraídos foram conferidos por uma pessoa.
- Android: gerar novo development build, permitir câmera/microfone somente quando solicitado, testar negar permissão, gravar/parar, segundo plano, voltar à tela, upload pelo seletor e texto com teclado aberto.
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
