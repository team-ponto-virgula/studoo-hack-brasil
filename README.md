# Studoo · Hack Brasil 2026

O Studoo transforma um objetivo de estudo em um plano com lições curtas. Cada lição reúne uma explicação, um exemplo e um exercício com feedback. O plano só entra na área de estudo quando a pessoa aceita a proposta.

A demonstração usa SQL. Uma geração simulada propõe uma sequência única de cinco lições, na ordem de aprendizado (filtro com `WHERE`, `INNER JOIN`, `AND`, uma revisão que mistura filtro e junção e `LEFT JOIN`), em três trechos sem nome de assunto. Com `IA=falsa`, qualquer outro objetivo ganha uma trilha simulada de três trechos com três lições cada, com uma revisão, emitida aos poucos por `POST /api/aprendizado/propostas/ao-vivo` ([spec 03](docs/specs/03-trilha-ao-vivo.md)). O progresso fica salvo no PostgreSQL e aparece na web e no app Android quando os dois usam a mesma conta e o mesmo banco local.

## Começar pela web

Use Node.js 24 ou mais recente. Execute os comandos na raiz do repositório.

```sh
npm ci
npm run db:local
```

Mantenha o primeiro terminal aberto. Em outro terminal, rode `npm run dev` e abra [o Studoo local](http://localhost:3000). Use o e-mail e a senha da conta sintética que o bootstrap gravou no seu `.env`.

1. Abra um plano novo, toque na sugestão **SQL para a prova** (ou escreva o que quer aprender) e escolha **Gerar trilha**. A trilha se monta na tela, lição por lição; **Cancelar** interrompe sem salvar nada.
2. Com a trilha pronta, escolha **Começar**: o plano é salvo e a primeira lição abre. **Ajustar pedido** volta ao texto, também sem salvar.
3. Avance pelo conceito e pelo exemplo. No exercício, responda `>=`, envie a resposta e escolha **Continuar** após ler o feedback. A trilha marca a lição como concluída e oferece a próxima.

O ambiente local usa `IA=falsa` e `EMAIL=falso`. [Guia do banco, dos testes e do app Android](docs/RODAR-LOCALMENTE.md)

## Código e origem

- `src/` reúne a interface web e a API Next.js. `prisma/` contém o esquema e as migrações do PostgreSQL.
- `apps/mobile/` contém o app Expo. `packages/contratos/` compartilha tipos e o cliente HTTP entre a web e o app.
- Tudo o que se faz na web deve ser replicado no app mobile, adaptado ao celular: veja as [regras do projeto](docs/REGRAS-DO-PROJETO.md).

Esta entrega retoma a ideia do Studoo com a implementação feita após a abertura de 4 de novembro de 2026, às 21h, no horário de Brasília. O histórico Git foi iniciado para esta entrega. O logo, o ícone e o Stu das boas-vindas são novas exportações raster do kit visual existente do Studoo. A web anima o sorriso na conclusão da lição. Nunito e Quicksand são distribuídas com suas licenças SIL Open Font License. [Nunito](https://github.com/google/fonts/tree/main/ofl/nunito) · [Quicksand](https://github.com/google/fonts/tree/main/ofl/quicksand)
