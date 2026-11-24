# Material de estudo — subfluxos locais P05

Módulo `material-pages.js/css` da R5. Arquivos, câmera, galeria e leitura usam fixtures locais; não abrem seletor nativo, câmera, OCR, rede ou API. A confirmação só usa o material depois de conferir a prévia. Um material rejeitado ou uma leitura cancelada não substituem o confirmado anteriormente.

Os limites reproduzem `packages/contratos/src/estudio.ts`: **5 MiB**, **6 páginas**, **24 mil caracteres** e CSV em UTF-8 com **200 linhas/20 colunas**. São aceitos JPG/PNG/WebP, PDF, DOCX e CSV. Essas verificações sobre metadados/trechos sintéticos não equivalem a ler um arquivo real.

## Representações e ações

Na bancada, `p=material` oferece `camera`, `galeria`, `carregando`, `lendo`, `previa`, `formato-invalido`, `tamanho-excedido`, `paginas-excedidas`, `texto-excedido`, `csv-invalido`, `leitura-erro`, `expirada`, `permissao` e `camera-bloqueada`. Escolher arquivo abre uma lista de exemplos PDF/DOCX/CSV e exemplos rejeitados; a pessoa confirma a prévia antes de voltar ao objetivo. A citação abre o trecho e a página correspondentes.

Leitura usa dois eventos locais, nominais de 600/1200 ms. Cancelar, trocar, remover ou navegar invalidam o token; um retorno antigo não confirma material. Atualizações assíncronas preservam foco/rolagem dos controles que continuam presentes. Quando o controle desaparece na prévia, só recuperam foco se ele realmente se perdeu; não puxam foco de outro controle ou após sair.

Remover ou deixar expirar o material do pedido não apaga as citações das lições já guardadas no modelo local. A criação da trilha copia a referência para o registro correspondente; fontes de uma lição não usam o arquivo de um pedido posterior.

## Provas de autoria

Em `/workspace/work/revisao-material-r5/`, Chromium/Playwright por HTTP:

- `resultado-http.json`: **210/210 verificações**, três direções × 390×844/360×800; tipos, limites, prévia/citação, leitura, erro, cancelamento, troca/remoção, navegação, recarga e foco em Cancelar/Meu perfil nos dois callbacks. Zero exceções/requisições de API.
- `geometria.json`: **138 vistas**, com estados e texto ampliado; sem overflow, alvo abaixo de 44 px, rodapé fora da viewport ou erro JS nos casos examinados. Vistas não se somam às asserções como testes funcionais.

Hashes finais estáveis do módulo: JS `5fbfd822ad40d4c9f3a58425e139662f5e386b90ac387739c8b50f86b63ccbe9`; CSS `0d7ff01e360c956700f84faa3051f7412a7d2f3042ef8f369fb02283c4ba456f`. A jornada comum ainda era integrada durante a autoria. A candidata completa exige revisão independente congelada; nenhuma nota D ou aprovação nativa é atribuída aqui.
