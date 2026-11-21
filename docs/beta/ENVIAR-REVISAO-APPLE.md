# Conferir e enviar a Beta App Review

O build iOS **0.1.0 (3)** já está na Apple. Esta ferramenta confere os dados existentes; não gera outro IPA, altera contatos, cria credenciais, convida testadores ou publica na App Store.

## Acesso e conferência

Use Node 24 e disponibilize estas variáveis pelo ambiente seguro do operador:

- `EXPO_ASC_API_KEY_PATH`: arquivo privado `.p8` da **API App Store Connect**, fora do repositório;
- `EXPO_ASC_KEY_ID` e `EXPO_ASC_ISSUER_ID`: identificação dessa mesma chave.

A chave de login **Sign in with Apple** pertence ao servidor e é outra chave. Nenhum segredo deve ir para Git, argumentos de comando ou notas de revisão.

Por padrão, este comando faz **somente leituras** na Apple e nos endpoints públicos do servidor:

```sh
npm run beta:revisao -- \
  --app-id 6837508955 \
  --build-id 4eea9ee9-145e-4076-8ad1-e130af015d6c
```

O UUID acima é o recurso **build na Apple**, não o ID EAS. O comando confere vínculo build/app, bundle igual ao `app.json` local, processamento, disponibilidade para revisão, ausência de revisão anterior, contato, descrições/feedback/privacidade, “O que testar” e conta demo. A conta demo é obrigatória neste Studoo: o visitante não alcança todos os recursos sociais.

Também roda o mesmo preflight de `npm run beta:conferir`, incluindo saúde, páginas públicas, configuração Apple e IA real. O relatório mostra apenas presença de campos e estados; não imprime contato, senha, chave, JWT ou corpos de erros da Apple. Campo preenchido não comprova que a conta entra. Antes de enviar, validar a credencial exata e o percurso no IPA conforme [QA de acesso](../QA-TESTFLIGHT-ACESSO.md).

## Envio explícito

Depois de resolver os bloqueios e conferir a conta demo e o IPA, acrescente `--enviar` ao mesmo comando:

```sh
npm run beta:revisao -- \
  --app-id 6837508955 \
  --build-id 4eea9ee9-145e-4076-8ad1-e130af015d6c \
  --enviar
```

O script só faz o POST se todas as verificações passarem. Confere novamente a ausência de revisão imediatamente antes do envio e lê a revisão pelo build depois. Uma revisão existente impede outro POST e seu estado é informado. Não apaga nem substitui revisões.

Em timeout, conflito ou falha no POST, o script consulta o estado uma vez e **não repete o POST**. `envioAceito: true` significa HTTP 201; `revisao.estado` é o estado confirmado pela leitura. Se `confirmacaoPendente: true`, confira novamente em modo de leitura e no [TestFlight](https://appstoreconnect.apple.com/apps/6837508955/testflight/ios) antes de qualquer nova tentativa. `enviado` não significa aprovado.

O código de saída é zero quando a conferência está apta ou o envio foi confirmado; bloqueios ou confirmação pendente retornam 1. Não há agendamento, repetição automática, distribuição ou habilitação de link público.

Validação local, sem rede nem chave real: `npm run test:beta`.

Endpoints e campos conferidos na [especificação oficial Apple OpenAPI](https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip), versão 4.6.1.
