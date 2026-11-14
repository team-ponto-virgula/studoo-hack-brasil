# Estudo com material, reforço e explicação ao Stu

A web e o app Android compartilham contrato, limites e textos. O servidor decide acesso, geração e progresso. A interface nativa usa Expo DocumentPicker, ImagePicker e Audio; exige um novo build de desenvolvimento após instalar as dependências.

## Material → trilha

No pedido, selecione imagem JPG/PNG/WebP, PDF (até seis páginas), DOCX ou CSV, até 5 MB. O texto extraído é limitado a 24 mil caracteres; CSV a 200 registros e 20 colunas, em UTF-8. A câmera é opcional. Antes do envio, a interface informa o uso da OpenAI e pede material sem dados pessoais.

O servidor confere tamanho, assinatura e formato. PDF com texto passa pelo PDF.js, sem executar scripts do documento; imagem é normalizada pelo Sharp, removendo metadados e limitando pixels. Imagens e páginas digitalizadas usam leitura pela OpenAI. A interface permite conferir o texto página a página e remover o material antes de gerar. Uma leitura incorreta deve ser substituída por uma imagem mais legível.

DOCX é lido como texto com Mammoth, sem converter conteúdo em HTML nem habilitar acesso a arquivos externos. O ZIP tem limite de entradas e de tamanho descompactado. As referências usam parágrafos em ordem de leitura, sem inventar páginas que dependem da diagramação do Word. Imagens incorporadas em DOCX não passam por OCR: envie a imagem separadamente.

CSV usa Papa Parse para reconhecer vírgula, ponto e vírgula, tabulação ou barra vertical, incluindo campos entre aspas. A prévia mostra uma tabela rolável. Valores continuam texto, preservando zeros à esquerda e vírgulas decimais; fórmulas não são executadas. As referências usam linhas lógicas (registros), incluindo eventual cabeçalho; uma quebra dentro de um campo entre aspas não cria outra linha da tabela. Não há inferência automática de tipos nem alteração do arquivo original.

Cada lição gerada leva localização (página, parágrafos ou linhas) e trecho literal. O servidor rejeita citações ausentes do texto lido. Isso verifica a existência do trecho; não comprova que a interpretação da IA está correta. Referências de OCR são identificadas. Arquivos e falas são dados, nunca instruções do sistema; o modelo não recebe ferramentas de navegação ou execução.

O upload bruto não é gravado pelo Studoo. O texto extraído fica acessível por 24 horas; uma proposta guarda cópia imutável por 30 minutos. As citações ficam nas lições aceitas. Execute `npm run estudio:limpar` a cada hora no ambiente do servidor para remover registros expirados. A expiração bloqueia o acesso mesmo antes da limpeza. O comando não remove planos ou citações salvas. O provedor externo segue sua própria política de tratamento de dados; `store:false` é usado nas chamadas Responses, sem prometer retenção zero pelo provedor.

Em `IA=falsa`, o botão **Experimentar com frações** usa três páginas autorais e três lições preparadas. PDF textual, DOCX e CSV também funcionam, com atividades de reconhecimento explicitamente simuladas. Fotos e voz exigem IA real; nunca há uma transcrição inventada.

## Ponte de reforço

Após uma resposta incorreta, **Ver reforço** leva à seção de apoio. **Construir minha ponte** cria uma explicação por outro caminho, exemplo e exercício novos. O mapa marca a ponte na lição de origem e indica quando foi atravessada.

Acertar o reforço não conclui a lição nem infla o progresso. A pessoa retorna ao exercício original. A ponte é persistida e reaproveitada; falhas do provedor permitem nova tentativa. O motivo descreve uma possível dificuldade, sem afirmar um diagnóstico do aluno. O comportamento existente de continuar a lição após ler o feedback permanece disponível.

## Ensine ao Stu

A pessoa escreve de 20 a 3.000 caracteres ou grava até 60 segundos. O limite de duração é aplicado pelo cliente; o servidor limita a 5 MB e confere o formato. O áudio vai à transcrição, volta como texto editável e só é avaliado quando a pessoa toca em **Enviar minha explicação**. A gravação para ao sair da tela ou colocar o app em segundo plano. Negar acesso ao microfone não impede digitar.

O feedback traz pontos corretos, uma lacuna, pergunta de transferência e próximo passo. Sem nota ou alegação automática de domínio. O servidor guarda o feedback, não o áudio nem a explicação enviada. No modo simulado, o retorno diz explicitamente que não avalia a correção do texto.

## Configuração e limites

- `IA=openai`, `OPENAI_API_KEY`: somente no servidor.
- `OPENAI_MODELO_ESTUDIO=gpt-4.1`: material, reforço e explicação, via Responses com JSON Schema estrito.
- `OPENAI_MODELO_TRANSCRICAO=gpt-transcribe`: transcrição multipart.
- `OPENAI_BASE_URL`: mantém a regra HTTPS, ou localhost para testes.
- Cotas persistentes por conta e hora: dez uploads, dez propostas, dez transcrições; vinte reforços e vinte avaliações de explicação.
- Todos os endpoints `/api/estudio` exigem sessão, verificam propriedade e preservam a proteção de origem web ou autenticação bearer nativa. O gabarito nunca faz parte do retorno público.

A migração `20261114020000_estudio_adaptativo` acrescenta `MaterialEstudo` e `ApoioLicao`. Nenhuma credencial vai ao bundle do app. O mobile acompanha os novos métodos de cliente, referências da lição e indicação de ponte no mapa na mesma alteração.

## Revisão e limites da evidência

`npm run test:estudio` cobre isolamento, expiração, citações, progresso, duplicação concorrente de reforço, formato de arquivo, recusas e respostas inválidas da IA, além de transcrição com provedor simulado. Rodar também typecheck web/nativo, testes existentes e build.

O roteiro da demonstração e o protocolo de avaliação estão em `../DEMO-HACKATHON.md`. Chamadas com chave real, microfone/câmera em Android físico e avaliação com estudantes exigem validação externa; não são substituídos por mocks ou por uma prévia React Native Web.

Referências técnicas: [Mammoth](https://github.com/mwilliamson/mammoth.js#readme) e [Papa Parse](https://www.papaparse.com/docs).
