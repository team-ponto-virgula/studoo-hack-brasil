# TestFlight 0.1.0 (6) — intro suave e piloto Clareza

Entrega de 24/11/2026. Esta candidata reúne a abertura mobile Óculos em foco, com ritmo mais suave, e o primeiro lote da repaginação: Pedido, geração/proposta, lição, conclusão e retomada. É um piloto para revisão instalada; perfil, comunidade e demais fluxos não são apresentados como redesenhados.

## Binário e distribuição

| Item | Identificação |
| --- | --- |
| Versão / build | **0.1.0 (6)** |
| Fonte imutável do IPA | `0888c4c44b1023b7fa2a331bda92e1ebe98d43a1` |
| Bundle | `com.studoo.mobile.dev` |
| EAS | [Build 08d54669-e551-400e-92db-bfbf378b9b88](https://expo.dev/accounts/studoo/projects/studoo-mobile/builds/08d54669-e551-400e-92db-bfbf378b9b88) — compilação concluída |
| Envio | [Submissão 233c34a2-d7cb-4809-8833-a21b47c1a128](https://expo.dev/accounts/studoo/projects/studoo-mobile/submissions/233c34a2-d7cb-4809-8833-a21b47c1a128) |
| SHA-256 do IPA | `1969bed8ab7f331fb35cd281c09800f8a9a766fdefe00e5dca5d4875bebb0881` |
| Tamanho do IPA | 30.177.899 bytes |

**Estado observado em 24/11, 18:54 UTC:** envio agendado e observado em `IN_QUEUE`; o build 6 ainda não foi confirmado no App Store Connect. Processamento `VALID`, notas de teste e vínculo ao grupo interno só podem ser afirmados após leitura de confirmação. A compilação concluída não significa disponibilidade no TestFlight.

**Acompanhamento no Cloud:** monitor persistente ativo, com exclusão por lock, até **20:51:22 UTC de 24/11**, enquanto a máquina Cloud estiver ativa. Aguarda o envio EAS concluído e o build Apple `VALID`; então executa uma única tentativa de notas e associação ao grupo interno existente. Só confirma disponibilidade com `VALID` + `IN_BETA_TESTING`; após a associação, eventual espera usa apenas leituras. Falha ambígua não repete a operação. Não publica no grupo externo. Sintaxe, primeiro ciclo e processo vivo foram conferidos; isso não é uma simulação de upload concluído.

O [snapshot de início](build-6/monitor-iniciado.json) é histórico, não um painel ao vivo. O estado corrente e o resultado ficam em `/workspace/work/testflight-oculos-suave/monitor-persistente-6-status.json` e, após a tentativa, `ativacao-6-resultado-monitor.json`, fora do Git. A [página da submissão](https://expo.dev/accounts/studoo/projects/studoo-mobile/submissions/233c34a2-d7cb-4809-8833-a21b47c1a128) acompanha o envio EAS.

O build 5, de ritmo anterior, teve a submissão cancelada ainda na fila e não foi associado a grupo. Este envio usa o ID exato do build 6. O PR do piloto é o [#93](https://github.com/team-ponto-virgula/studoo-hack-brasil/pull/93), mantido como draft para revisão; o código compilado continua identificado pelo SHA acima, mesmo quando novos relatórios são adicionados.

## Conferências realizadas

- **IPA:** auditor oficial sem erros ou avisos. Bundle, versão, entitlement Sign in with Apple do perfil, ATS, permissões e manifesto de privacidade conferidos. A auditoria em Linux não executa `codesign` num Mac nem o app instalado.
- **Conteúdo:** PNG da intro encontrado pelo hash dentro do pacote; Hermes presente; URL da API publicada presente e endereços do harness de QA ausentes. A conferência não testa disponibilidade de todos os serviços publicados.
- **Fonte integrada:** 604/604 verificações de interface, incluindo 18 de abertura; paridade 5/5, movimento 4/4, tipos web/mobile, build web e export Hermes iOS passaram. O ajuste final de espaçamento passou em 38 testes focados, um subconjunto que não se soma ao total.
- **CI:** [fonte exata do IPA](https://github.com/team-ponto-virgula/studoo-hack-brasil/actions/runs/45459665209) e [relatórios do piloto](https://github.com/team-ponto-virgula/studoo-hack-brasil/actions/runs/45460566788) passaram.
- **Percurso web:** conta sintética, IA e email falsos; gerar e aceitar SQL, errar, corrigir, concluir após resposta de salvamento, recarregar com 1/5 e retomar a lição 2. Nove verificações positivas, zero erros de JavaScript.
- **Percurso complementar RNWeb:** nove etapas equivalentes concluídas com outra conta e API local separada. Ponte de transporte, armazenamento e fallbacks exclusivos de QA; uma leitura de privacidade após reload falhou na ponte e não foi validada. Não é execução nativa.
- **Capturas:** 390×844 e 360×800. Recaptura específica confirmou CTA de 52 px e margens de 20 px na Proposta. A comparação global dessa tela segue parcial por estado, resumo e rolagem; não se certifica paridade pixel a pixel.

[Evidência do pacote](build-6/pacote.json) · [auditoria](build-6/auditoria-ipa.json) · [conteúdo da intro/API](build-6/conteudo.json) · [resultado do piloto](../ux/RESULTADO-PILOTO-CLAREZA.md) · [intro suave](../ux/RESULTADO-INTRO.md).

## Beta externo

Às 18:42 UTC de 24/11, o grupo externo continuava com o **build 4**, em `IN_BETA_TESTING`. A API publicada anunciava `google: true` e `apple: false`. O build 6 não foi associado a esse grupo nem enviado à revisão externa contornando o gate Apple. O acesso interno e a revisão externa são estados diferentes.

## O que conferir no aparelho

Primeira abertura e retomada, passagem da launch screen para React, Reduzir Movimento, VoiceOver/TalkBack, teclado, áreas seguras e geração por streaming com a rede real. Esta máquina não executou iPhone nem emulador Android. Notas nativas e aprovação global continuam `null`; referência visual, export e upload não atribuem 9,5.

No app publicado, o perfil TestFlight usa a API publicada. As provas com IA/email falsos ocorreram no banco e no servidor sintéticos locais, sem alterar o banco de produção. O novo Stu caderno continua registrado nas [referências de branding](../ux/REFERENCIAS-DO-STU.md); o asset atual do piloto não é apresentado como integração final desses PNGs.

## Reabrir no Cloud

O piloto está em `/workspace/work/studoo-ui-ux`, branch `feat/mobile-ui-ux-refino`. A web de produção local foi iniciada na porta **3010**, com o ambiente sintético. Para reiniciar após encerrar o processo, nessa pasta: `npm exec next start -- --hostname 0.0.0.0 --port 3010` (exige o build local existente).

`http://localhost:3010` pertence à máquina Cloud. A configuração desta tarefa não oferece uma prévia HTTP publicada. Para abrir pelo cliente, configurar **HTTP Previews → porta 3010 → Apply to this chat** em Edit Environment. Não há URL pública inventada nem dependência do PC pessoal. A [curadoria de referências](../ux/referencias/README.md) e as capturas no GitHub podem ser abertas diretamente pelo celular.
