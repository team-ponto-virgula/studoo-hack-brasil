# TestFlight 0.1.0 (6) — intro suave e piloto Clareza

Entrega de 24/11/2026. Esta candidata reúne a abertura mobile Óculos em foco, com ritmo mais suave, e o primeiro lote da repaginação: Pedido, geração/proposta, lição, conclusão e retomada. É um piloto para revisão instalada; perfil, comunidade e demais fluxos não são apresentados como redesenhados.

## Binário e distribuição

| Item | Identificação |
| --- | --- |
| Versão / build | **0.1.0 (6)** |
| Fonte imutável do IPA | `0888c4c44b1023b7fa2a331bda92e1ebe98d43a1` |
| Bundle | `com.studoo.mobile.dev` |
| EAS | [Build 08d54669-e551-400e-92db-bfbf378b9b88](https://expo.dev/accounts/studoo/projects/studoo-mobile/builds/08d54669-e551-400e-92db-bfbf378b9b88) — compilação concluída |
| Envio | [Submissão 233c34a2-d7cb-4809-8833-a21b47c1a128](https://expo.dev/accounts/studoo/projects/studoo-mobile/submissions/233c34a2-d7cb-4809-8833-a21b47c1a128) — `FINISHED` em 24/11, 19:18:28 UTC |
| Build Apple | `1b5173df-f0a7-42c0-ae98-d7b2ed5ede84` — `VALID` |
| Grupo interno | **Studoo Beta Interno**, `b54c8449-a903-4bc3-885a-5b3dcd6dd21a` — `IN_BETA_TESTING` |
| SHA-256 do IPA | `1969bed8ab7f331fb35cd281c09800f8a9a766fdefe00e5dca5d4875bebb0881` |
| MD5 do IPA | `2ce21de16b03c8dd999da75dcafcd561` — coincide com o checksum do arquivo recebido pela Apple |
| Tamanho do IPA | 30.177.899 bytes |

**Disponibilidade interna confirmada:** em 24/11, **19:25:17 UTC**, o monitor concluiu a ativação com `processingState=VALID` e `internalBuildState=IN_BETA_TESTING`. Uma leitura independente às **19:26:12 UTC** confirmou o build 6 no grupo interno, dois testadores, notas pt-BR/en-US e preservação dos builds 3 e 4. [Evidência sanitizada da ativação e proveniência](build-6/ativacao-interna.json).

**Identidade do binário:** o arquivo Apple é `application-08d54669-e551-400e-92db-bfbf378b9b88.ipa`. Seu tamanho e MD5 coincidem com o IPA local auditado; o envio EAS concluído aponta para o mesmo build e a fonte imutável acima. A confirmação não depende apenas do número 6, que poderia ser usado por outro operador antes de um upload.

**Monitor concluído:** houve uma única tentativa automática de notas e associação ao grupo interno, sob lock exclusivo e marcador anterior à operação. O prazo máximo original era 20:51:22 UTC; a confirmação ocorreu antes dele. Não houve reenvio do IPA, tentativa concorrente, grupo novo ou publicação externa. A associação foi confirmada por leitura, e não inferida de compilação ou upload.

O [snapshot de início](build-6/monitor-iniciado.json), que registra a antiga fila `IN_QUEUE`, foi preservado como histórico. O estado final e os logs privados permanecem em `/workspace/work/testflight-oculos-suave/`, fora do Git; a evidência pública acima contém apenas os dados necessários à conferência.

## Abrir a intro no TestFlight

No **TestFlight → Studoo → Atualizar**, conferir a versão **0.1.0 (6)**. Depois fechar totalmente o Studoo e abri-lo novamente. A assinatura **Óculos em foco** já envolve a navegação na raiz do app e não depende de flag remota. O ritmo normal é 880 ms de movimento + 160 ms de saída, com orçamento adaptativo e limite absoluto de 1.400 ms.

A intro aparece uma vez por processo; voltar do segundo plano ou navegar não a repete. Movimento reduzido, leitor de tela, interação, links de retorno e falta de orçamento preservam as dispensas previstas no contrato. Esta é uma confirmação de distribuição, conteúdo e configuração; a máquina Cloud não executou o app em um iPhone.

O build 5, de ritmo anterior, teve a submissão cancelada ainda na fila e não foi associado a grupo. Este envio usa o ID exato do build 6. O PR do piloto é o [#93](https://github.com/team-ponto-virgula/studoo-hack-brasil/pull/93), mantido como draft para revisão; o código compilado continua identificado pelo SHA acima, mesmo quando novos relatórios são adicionados.

## Conferências realizadas

- **IPA:** auditor oficial sem erros ou avisos. Bundle, versão, entitlement Sign in with Apple do perfil, ATS, permissões e manifesto de privacidade conferidos. A auditoria em Linux não executa `codesign` num Mac nem o app instalado.
- **Conteúdo:** PNG da intro encontrado pelo hash dentro do pacote; Hermes presente; URL da API publicada presente e endereços do harness de QA ausentes. A conferência não testa disponibilidade de todos os serviços publicados.
- **Fonte integrada:** 604/604 verificações de interface, incluindo 18 de abertura; paridade 5/5, movimento 4/4, tipos web/mobile, build web e export Hermes iOS passaram. O ajuste final de espaçamento passou em 38 testes focados, um subconjunto que não se soma ao total.
- **CI:** [fonte exata do IPA](https://github.com/team-ponto-virgula/studoo-hack-brasil/actions/runs/45459665209) e [relatórios do piloto](https://github.com/team-ponto-virgula/studoo-hack-brasil/actions/runs/45460566788) passaram.
- **Percurso web:** conta sintética, IA e email falsos; gerar e aceitar SQL, errar, corrigir, concluir após resposta de salvamento, recarregar com 1/5 e retomar a lição 2. Nove verificações positivas, zero erros de JavaScript.
- **Percurso complementar RNWeb:** nove etapas equivalentes concluídas com outra conta e API local separada. Ponte de transporte, armazenamento e fallbacks exclusivos de QA; uma leitura de privacidade após reload falhou na ponte e não foi validada. Não é execução nativa.
- **Capturas:** 390×844 e 360×800. Recaptura específica confirmou CTA de 52 px e margens de 20 px na Proposta. A comparação global dessa tela segue parcial por estado, resumo e rolagem; não se certifica paridade pixel a pixel.

[Ativação interna](build-6/ativacao-interna.json) · [evidência do pacote](build-6/pacote.json) · [auditoria](build-6/auditoria-ipa.json) · [conteúdo da intro/API](build-6/conteudo.json) · [resultado do piloto](../ux/RESULTADO-PILOTO-CLAREZA.md) · [intro suave](../ux/RESULTADO-INTRO.md).

## Beta externo

Às 18:42 UTC de 24/11, o grupo externo continuava com o **build 4**, em `IN_BETA_TESTING`. A API publicada anunciava `google: true` e `apple: false`. O build 6 não foi associado a esse grupo nem enviado à revisão externa contornando o gate Apple. O acesso interno e a revisão externa são estados diferentes.

Na leitura de 19:26 UTC, o estado externo do build 6 era `READY_FOR_BETA_SUBMISSION`. Esta ativação interna não solicitou revisão externa.

## O que conferir no aparelho

Primeira abertura e retomada, passagem da launch screen para React, Reduzir Movimento, VoiceOver/TalkBack, teclado, áreas seguras e geração por streaming com a rede real. Esta máquina não executou iPhone nem emulador Android. Notas nativas e aprovação global continuam `null`; referência visual, export e upload não atribuem 9,5.

No app publicado, o perfil TestFlight usa a API publicada. As provas com IA/email falsos ocorreram no banco e no servidor sintéticos locais, sem alterar o banco de produção. O novo Stu caderno continua registrado nas [referências de branding](../ux/REFERENCIAS-DO-STU.md); o asset atual do piloto não é apresentado como integração final desses PNGs.

## Reabrir no Cloud

O piloto está em `/workspace/work/studoo-ui-ux`, branch `feat/mobile-ui-ux-refino`. A web de produção local foi iniciada na porta **3010**, com o ambiente sintético. Para reiniciar após encerrar o processo, nessa pasta: `npm exec next start -- --hostname 0.0.0.0 --port 3010` (exige o build local existente).

`http://localhost:3010` pertence à máquina Cloud. A configuração desta tarefa não oferece uma prévia HTTP publicada. Para abrir pelo cliente, configurar **HTTP Previews → porta 3010 → Apply to this chat** em Edit Environment. Não há URL pública inventada nem dependência do PC pessoal. A [curadoria de referências](../ux/referencias/README.md) e as capturas no GitHub podem ser abertas diretamente pelo celular.
