# Studoo · Hack Brasil 2026

O Studoo transforma um objetivo de estudo em um plano com lições curtas. Cada lição reúne uma explicação, um exemplo e um exercício com feedback. O plano só entra na área de estudo quando a pessoa aceita a proposta.

Com `IA=openai`, a IA da OpenAI (Responses API) monta a trilha ao vivo, lição por lição, para qualquer assunto, e escreve a explicação, o exemplo e o exercício de cada lição ([como ligar](docs/RODAR-LOCALMENTE.md#ia-da-openai)). Sem chave, a IA falsa entra no lugar, para a demonstração não parar.

A demonstração local usa `IA=falsa`. Para SQL, uma geração simulada propõe uma sequência única de cinco lições, na ordem de aprendizado (filtro com `WHERE`, `INNER JOIN`, `AND`, uma revisão que mistura filtro e junção e `LEFT JOIN`), em três trechos sem nome de assunto. Qualquer outro objetivo ganha uma trilha simulada de três trechos com três lições cada, com uma revisão. As duas IAs emitem a trilha aos poucos por `POST /api/aprendizado/propostas/ao-vivo` ([spec 03](docs/specs/03-trilha-ao-vivo.md)). O progresso fica salvo no PostgreSQL e aparece na web e no app Android quando os dois usam a mesma conta e o mesmo banco local.

## Começar pela web

Use Node.js 24 ou mais recente. Execute os comandos na raiz do repositório.

```sh
npm ci
npm run db:local
```

Mantenha o primeiro terminal aberto. Em outro terminal, rode `npm run dev` e abra [o Studoo local](http://localhost:3000). Use o e-mail e a senha da conta sintética que o bootstrap gravou no seu `.env`.

1. No primeiro acesso, sem planos, uma apresentação de cinco passos mostra como o Studoo funciona e termina com a escolha de uma área de interesse; **Pular** vai direto ao pedido. Toque na sugestão **SQL para a prova** (em Populares) ou escolha uma ideia de outra área, como Idiomas ou Música, ou escreva o que quer aprender. Depois, escolha **Gerar trilha**. A trilha se monta na tela, lição por lição, sobre um mapa ilustrado; **Cancelar** interrompe sem salvar nada.
2. Com a trilha pronta, escolha **Começar**: o plano é salvo, o Stu mostra as lições sendo escritas e a primeira lição abre. **Ajustar pedido** volta ao texto, também sem salvar.
3. Avance pelo conceito e pelo exemplo. No exercício, responda `>=`, envie a resposta e escolha **Continuar** após ler o feedback. A trilha marca a lição como concluída e oferece a próxima.

O ambiente local usa `IA=falsa` e `EMAIL=falso`; para a IA da OpenAI, basta um `.env.local` com a chave, e `npm run ia:conferir` confere se ela funciona ([passo a passo](docs/RODAR-LOCALMENTE.md#ia-da-openai)). Para ver a apresentação de novo, toque em **Como funciona?** no pedido. [Guia do banco, dos testes e do app Android](docs/RODAR-LOCALMENTE.md) · [Experiência ilustrada (spec 04)](docs/specs/04-experiencia-ilustrada.md)

## Acesso

Web e Android oferecem login com Google e recuperação de senha por código enviado por e-mail. Configure as credenciais Google e o Resend usando os `.env.example`; veja o [guia de configuração e testes](docs/specs/06-acesso-google-recuperacao.md). O app precisa de um novo build de desenvolvimento para o retorno do navegador.

## Código e origem

- `src/` reúne a interface web e a API Next.js. `prisma/` contém o esquema e as migrações do PostgreSQL.
- `apps/mobile/` contém o app Expo. `packages/contratos/` compartilha tipos e o cliente HTTP entre a web e o app.
- Tudo o que se faz na web deve ser replicado no app mobile, adaptado ao celular: veja as [regras do projeto](docs/REGRAS-DO-PROJETO.md).

Esta entrega retoma a ideia do Studoo com a implementação feita após a abertura de 4 de novembro de 2026, às 21h, no horário de Brasília. O histórico Git foi iniciado para esta entrega. O logo, o ícone e o Stu das boas-vindas são novas exportações raster do kit visual existente do Studoo. Na entrada, a marca aparece uma vez, acima do título, com movimento contínuo na web e no app. A preferência de movimento reduzido exibe a marca estática. Nunito e Quicksand são distribuídas com suas licenças SIL Open Font License. [Nunito](https://github.com/google/fonts/tree/main/ofl/nunito) · [Quicksand](https://github.com/google/fonts/tree/main/ofl/quicksand)

## Material, reforço e Ensine ao Stu

Web e app aceitam imagens JPG/PNG/WebP, PDF, DOCX e CSV, oferecem uma ponte de reforço após erros e permitem explicar a lição ao Stu por texto ou voz com revisão da transcrição. Consulte a [spec 05](docs/specs/05-estudio-adaptativo.md) e o [roteiro do hackathon](docs/DEMO-HACKATHON.md). Validação: `npm run test:estudio` (banco local e provedores simulados). Após atualizar, aplique `npm run db:migrate` e gere um novo build nativo para câmera e áudio.
