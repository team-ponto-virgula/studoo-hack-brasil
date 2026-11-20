# Pausa do Studoo · 20 de novembro de 2026

A equipe deve aguardar nova ordem após guardar o trabalho. A base da prévia é `feat/hackathon-integracao` em `d9be93c60be80f610c496470a657805f8af01056`. Este guia fica em uma branch do Lead com a mesma base e reúne as referências das entregas. A decisão de integrar ou publicar fica para a retomada.

## Pontos de retomada

| Frente | Referência conferida durante o fechamento | Estado |
| --- | --- | --- |
| Lead, criação de trilha | [ux-criacao-trilha](https://github.com/team-ponto-virgula/studoo-hack-brasil/tree/1c53219650064e70e90a99ccd17a91a3935c68f6) em `1c53219650064e70e90a99ccd17a91a3935c68f6` | Correções de chegada tardia da resposta e anúncio da ação de começar. Segue pendente a confirmação em aparelhos. |
| Web & API, privacidade | [apple-privacidade-web](https://github.com/team-ponto-virgula/studoo-hack-brasil/tree/27af19e357e242d867964e954023631f31e1705a) em `27af19e357e242d867964e954023631f31e1705a` | Base de consentimento de terceiros e exclusão de conta. |
| Web & API, acesso | [apple-acesso-web](https://github.com/team-ponto-virgula/studoo-hack-brasil/blob/fb1a6163469bc5235e15022906c74407972f9805/docs/ACESSO-APPLE-CADASTRO.md) em `fb1a6163469bc5235e15022906c74407972f9805` | Cadastro por código no e-mail, entrada Apple, testes e contrato. No momento da conferência, as duas pontas Web & API estavam publicadas sob o namespace do Lead. |
| Mobile & QA | [ios-testflight](https://github.com/team-ponto-virgula/studoo-hack-brasil/blob/4535181d7c4dd05fb0b09077b3f475159bd5b92a/docs/BUILD-IOS-TESTFLIGHT.md) em `4535181d7c4dd05fb0b09077b3f475159bd5b92a` | Perfil de loja, manifesto de privacidade e roteiro de distribuição. É anterior ao contrato novo de cadastro e entrada Apple. |
| Mobile 2 | `agentes/studoomobile2/apple-privacidade-mobile` em `927f0352ff6a85528f685b1d55acccaf7a9fecb6` | Ponta local identificada no inventário inicial com privacidade, consentimento e exclusão. A equipe deve registrar a referência remota final e o estado do cadastro e da entrada Apple. |

Na retomada, use a ponta confirmada de cada frente. Para abrir uma cópia de conferência deste guia em uma worktree separada:

```sh
git fetch origin
git worktree add --detach ../studoo-worktrees/continuar-testflight origin/agentes/studoolead/pausa-testflight
```

## Validação e primeira ação pendente

O Lead rodou no Node.js 24, sobre `1c53219650064e70e90a99ccd17a91a3935c68f6`:

```sh
npm run typecheck
npm run typecheck --workspace apps/mobile
npm run test:paridade
npm run test:estudio:interface
```

Os dois typechecks passaram, assim como paridade (5/5) e interface (202/202). Os resultados cobrem o SHA de criação de trilha. O teste integrado do beta e a execução nativa em iPhone e Android seguem pendentes.

Quando houver nova ordem, comece comparando as pontas finais da equipe e conferindo se o perfil TestFlight e o app usam o contrato de cadastro, acesso Apple, consentimento e exclusão da API. Execute os dois typechecks e os testes de acesso, privacidade e paridade da revisão reunida. Depois, confira os fluxos no aparelho com a configuração correspondente. A emissão da build assinada depende do vínculo do projeto EAS e da configuração Apple. A entrega externa depende da conta de demonstração, da configuração de acesso do servidor e da revisão Beta descrita no roteiro de QA.

O percurso anterior de criação e som está no [guia de 19 de novembro](https://github.com/team-ponto-virgula/studoo-hack-brasil/blob/1c53219650064e70e90a99ccd17a91a3935c68f6/docs/RETOMADA-2026-11-19.md).
