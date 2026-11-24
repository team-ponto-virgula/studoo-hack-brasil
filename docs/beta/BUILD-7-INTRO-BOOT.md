# TestFlight 0.1.0 (7) — hotfix de abertura iOS

**Disponível no Studoo Beta Interno.** Ativação confirmada em **24/11/2026, 20:32:40 UTC**; leitura independente às **20:33:03 UTC** confirmou `VALID` + `IN_BETA_TESTING`, dois testadores e preservação dos builds 6, 4 e 3. Esta é a correção **v3 do boot**, após o relato de que a assinatura não aparecia no build 6.

A versão mantém a arte e o ritmo suave de **880 ms + 160 ms**. Corrige três dispensas prematuras: estado inicial transitório do iOS confundido com movimento reduzido, prontidão encerrando a preferência ainda pendente e orçamento visual consumido antes da cena estar elegível. [Causas, contrato e reprodução](../ux/HOTFIX-INTRO-BOOT.md).

## Identidade da entrega

| Item | Identificação |
| --- | --- |
| Versão / build | **0.1.0 (7)**; número remoto retornado pelo EAS |
| Fonte imutável | `0a96649e44c56feefa92a59daec950d4484756f0` |
| EAS | [5fd98b86-9c98-48f4-b1d4-2ec43b7d877f](https://expo.dev/accounts/studoo/projects/studoo-mobile/builds/5fd98b86-9c98-48f4-b1d4-2ec43b7d877f), `FINISHED` em 20:23:25 UTC |
| Bundle / app Apple | `com.studoo.mobile.dev` / `6837508955` |
| Upload e build Apple | `d0a32bdc-6b25-48ff-88ef-345b16d18bf7` |
| Arquivo Apple | `ced486a0-339c-4ab1-9f53-419a39ffd8b8` |
| Grupo interno existente | `Studoo Beta Interno`, `b54c8449-a903-4bc3-885a-5b3dcd6dd21a` |
| Tamanho do IPA | 30.179.153 bytes |
| SHA-256 do IPA | `d0c22916a75baf4ea7944c5e7e58608bc62dc3c4f89ed2363eea8c1c8793259c` |
| MD5 do IPA | `1ba5bc302cd603436521bf0884cbb2ab` |

O IPA foi enviado diretamente pela [API oficial Apple BuildUploads](https://developer.apple.com/documentation/appstoreconnectapi/build-uploads), a partir desta máquina Linux, após auditoria e revisão do uploader/manifesto com hashes fixados. **Nenhum EAS Submit concorrente foi criado.** O [journal sanitizado](build-7/upload-apple.json) registra seis partes com HTTP200 e commit confirmado por GET em **20:28:48 UTC**. O checksum, tamanho e nome do arquivo recebido pela Apple coincidem com o IPA local auditado. A identidade do build foi obtida pela relação desse upload, não apenas pelo número 7.

Em **20:31:30 UTC**, a Apple já retornava `COMPLETE` para o upload e `VALID` para o build. A associação ao grupo interno usou uma única tentativa, sob lock e marcador anteriores à operação; notas pt-BR/en-US, builds anteriores e testadores foram conferidos por leitura. [Evidência de ativação](build-7/ativacao-interna.json).

## Verificações realizadas

- **Regressão do boot:** os 15 testes executam TSX, store e contrato reais com APIs nativas simuladas. Na baseline `e5bb84c`, reproduzem 5 falhas; no hotfix passam 15/15. Não são execução de UIKit.
- **Fonte:** tipos web/mobile; interface 622/622; movimento 6/6; paridade 5/5; visitante 6/6; formatos 271/271; domínio 18/18 passaram. Os 15 casos de componente e 21 de contrato já integram a interface, sem somar subconjuntos. [Comandos e hashes](../ux/evidencias/hotfix-intro-boot-2026-11-24/checks.json).
- **Export iOS de produção:** passou na fonte exata, com HEAD/hashes estáveis e 168 artefatos. Hermes `entry-ea7fee53a4103140b249e4ea038fb0a7.hbc`, 5.988.384 bytes. [Relatório](build-7/export-ios.json).
- **IPA:** auditor oficial sem erros ou avisos. Bundle/número, entitlement Apple do perfil, ATS, permissões e manifesto de privacidade conferidos. A auditoria Linux não substitui `codesign` no Mac.
- **Conteúdo do binário:** asset HD dos óculos encontrado pelo hash, API publicada presente, endereços de QA ausentes e propriedades novas `limitePreparacaoMs`/`limiteNativoMs` encontradas no Hermes. Fonte e contrato v3 identificados; isso não é medição do movimento instalado.
- **Uploader:** sintaxe e 15 mocks passaram, incluindo partes e MD5, aprovação por hash, identidade, cobertura dos bytes, expiração, POST ambíguo sem retry, PUT incerto sem commit e PATCH reconciliado por GET. Na entrega real, todos os PUTs e o commit foram confirmados.
- **Distribuição:** leitura independente confirmou o app/versão, `VALID`, `IN_BETA_TESTING`, relação com o grupo, builds 7/6/4/3, dois testadores e as duas localizações das notas.

[Pacote](build-7/pacote.json) · [auditoria](build-7/auditoria-ipa.json) · [conteúdo v3](build-7/conteudo-v3.json) · [upload](build-7/upload-apple.json) · [ativação](build-7/ativacao-interna.json).

## Abrir a assinatura

No **TestFlight → Studoo → Atualizar**, conferir **0.1.0 (7)**. Fechar totalmente o Studoo e abrir novamente; a assinatura aparece uma vez por processo. Retornar do segundo plano ou navegar não a repete. Movimento reduzido ou leitor de tela confirmados preservam a dispensa prevista.

A v3 separa a preparação React de até 2.000 ms, a proteção da launch screen de 5.000 ms e a janela visual de 1.400 ms, iniciada no primeiro estado elegível. O site continua sem intro. A navegação e a sessão montam em paralelo, sem esperar API para exibir a assinatura.

## Limites e histórico

**Esta máquina não executou o app em iPhone/Android.** As verificações demonstram reprodução/correção dos estados de boot em bancada, compilação, conteúdo e disponibilidade interna. Fluidez, UIKit, leitor, gestos e passagem da launch screen ainda exigem observação instalada identificada; notas nativas permanecem `null`.

O [build 6](BUILD-6-INTRO-CLAREZA.md) teve sua distribuição confirmada, mas o dono relatou ausência da animação; as medições e mídias v2 continuam históricas. Esta entrega não herda sua validação visual. As três novas direções de UI/UX em estudo não foram incorporadas ao IPA 7.

O estado externo do build 7 era `READY_FOR_BETA_SUBMISSION` na leitura de 20:33 UTC. Não foi associado a grupo externo nem submetido à revisão externa. Arquivos de credenciais, operações com URLs assinadas e respostas privadas não foram publicados neste registro.
