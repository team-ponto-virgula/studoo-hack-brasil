# QA independente da revisão da Apple (TestFlight, 20/11)

Cobertura de QA (Mobile & QA) para conferir, numa revisão reunida, a entrega que deixa o Studoo pronto para a Apple:
- acesso: Apple ao lado do Google, cadastro por e-mail e recuperação;
- privacidade: consentimento de IA e exclusão de conta;
- comunidade (spec 14): moderação, bloqueio, denúncia e suporte.

Quem implementa: Web & API (servidor e web), Mobile 2 e Mobile & QA (app). O Designer cuida dos critérios e das notas (`docs/beta/NOTAS-TESTFLIGHT.md`). Este documento diz **o que** se confere, **com que mecanismo** e **até onde vale a prova**.

Regra de prova: cada resultado diz a origem.
- **Teste**: `node --test`, sem aparelho.
- **API local**: o servidor do repositório, com `IA=falsa` e `EMAIL=falso`.
- **Prévia**: o export web do app no Chromium, a 390 × 844. Não é o aparelho.
- **Simulador/emulador**: o workflow `capturas-nativas.yml`.
- **Aparelho**: o build do TestFlight num iPhone.

Nada aqui substitui o aparelho para:
- o login com a Apple de verdade (só com bundle assinado);
- o VoiceOver;
- câmera, notificações e o som no alto-falante.

## 1. Regras da Apple × conferência

| Regra | O que se confere | Teste | API local | Prévia | Simulador/emulador | Aparelho (TestFlight) |
|---|---|---|---|---|---|---|
| 4.8 Login com a Apple | Botão Apple ao lado do Google no iPhone; entitlement; servidor troca o token | `test:google-mobile`, `acesso-apple-cadastro-mobile`, `test:cadastro-apple` | `test:cadastro-apple` (token simulado) | — (sem Apple na web) | botão visível se `apple: true` no servidor | **só aqui** o login real (bundle assinado + capability no App ID) |
| 5.1.1(v) Excluir conta | "Excluir conta" no Perfil com ou sem compartilhar, conta e visitante; "digite EXCLUIR"; a sessão acaba e a senha deixa de entrar | `consentimento-ia-mobile` (inclui o Perfil sem compartilhar), `test:privacidade` | `test:privacidade` | `tf-acesso-privacidade` (passos D–F) | fluxo `55-privacidade` (abre e cancela) | conferir uma vez com conta descartável |
| 5.1.2(i) IA de terceiros | Cartão "Permitir o uso de IA?" antes do primeiro envio; revogar no Perfil | `consentimento-ia-mobile` | `test:privacidade` | só com IA real (com `IA=falsa` a seção mostra o modo demonstração) | idem | com o servidor do beta |
| 5.1.1 Cadastro e recuperação | Criar conta por e-mail com código; "Esqueci minha senha" troca a senha e derruba a antiga | `acesso-apple-cadastro-mobile`, `test:acesso` | `test:acesso`, `test:cadastro-apple` | `tf-acesso-privacidade` (passos B–C) | — | e-mail real (Resend) é do operador |
| 1.2 Conteúdo de outras pessoas | Os 16 cenários da spec 14 (seção 3 abaixo) | `seguranca-comunidade-mobile` + os testes de Mobile 2 | `scripts/qa-moderacao-local.mjs` (Web & API) e a contraprova da seção 3 | roteiro da seção 3 | fluxos novos da seção 4 | conferir S4, S9 e S13 |
| 5.1.1 Permissões | Textos de câmera, fotos e microfone em PT; nenhum texto padrão em inglês; ATS sem cargas arbitrárias | — | — | — | — | `conferir-artefato-ios.mjs` no .ipa |
| Manifesto de privacidade | `PrivacyInfo.xcprivacy` com as razões declaradas; sem rastreamento | — | — | — | — | `conferir-artefato-ios.mjs` |

## 2. Não regressão (antes de cada revisão reunida)

Na raiz da candidata, com Node 24.22.3:

```bash
npx prisma generate && npm run typecheck
npx tsc --noEmit -p apps/mobile
npm run test:google-mobile && npm run test:visitante-mobile && npm run test:paridade && npm run test:estudio:interface
npm run test:voz-mobile && npm run test:movimento
node --import tsx --test tests/acesso-apple-cadastro-mobile.test.mjs tests/consentimento-ia-mobile.test.mjs tests/seguranca-comunidade-mobile.test.mjs
node apps/mobile/conferencia-nativa/conferir-fluxos.mjs
# Com um banco descartável no .env (Web & API é dono destes):
npm run test:acesso && npm run test:cadastro-apple && npm run test:privacidade
```

`test:mobile` (`tests/marco-mobile-local.test.mjs`) é manual e fica fora do CI. Ele espera o Next servido em HTTPS direto, sem proxy. No servidor local atrás de proxy, ele cai em `/api/login`, porque a origem não é a do site.

## 3. Comunidade (spec 14): roteiro de aceite e contraprova

Os 16 cenários estão na seção 8 de `docs/specs/14-seguranca-comunidade.md`. A conferência independente se divide assim:
- **API local**: o servidor da candidata integrada roda com `STUDOO_COMPARTILHAR=1`, `STUDOO_COMUNIDADE=1`, `STUDOO_VISITANTE=1` e `STUDOO_EQUIPE_EMAILS=<conta sintética>`. As contas são A, B, E e um visitante, todas `@example.test`. O roteiro de Web & API (`scripts/qa-moderacao-local.mjs`) roda de novo, sem mudanças, e a contraprova abaixo confere o que o app usa.
- **Prévia do app** (390 × 844), com a mesma API: S1–S6 e S9–S14 pela tela. S7 e S8 são só da web (`/equipe/moderacao`). Em S16, a prévia confere os nomes acessíveis e os anúncios pela árvore de acessibilidade, não pelo VoiceOver.

| # | Contraprova no app (prévia) | O que conta como falha |
|---|---|---|
| S1–S3 | Publicar e trocar a foto como A; ver como B | Aviso dizendo "publicada" quando está pendente; B vê a foto ou a trilha pendente |
| S2 | Legenda com termo da lista | Aparece algo publicado; falta o link das regras; o erro não é `conteudo_recusado` |
| S4–S5 | B e o visitante denunciam pelo "•••" | Sem protocolo no aviso; a trilha continua para quem denunciou; o visitante tira do ar sozinho |
| S6 | Três contas denunciam | Ainda aparece no Explorar; A não vê "Em revisão"; o link abre a trilha |
| S9–S11 | Bloquear pelo cartão, pelo perfil e pela prévia; "Desfazer"; "Desbloquear" no Perfil; visitante bloqueia | Sem confirmação; conteúdo de A ainda aparece para B (ou o de B para A); seguir ou curtir ainda funcionam; o perfil bloqueado aberto por link não mostra "Você bloqueou esta pessoa." |
| S12 | `/t` sem sessão, "Denunciar" | Pede login; o alvo não vem preenchido em `/suporte` |
| S13 | "Falar com o suporte" no Perfil e "Precisa de ajuda?" na entrada | Não abre no navegador do sistema; envio sem protocolo; a consulta pelo protocolo falha |
| S14 | Folha de compartilhar | A linha das regras aparece em "Só com o link" ou falta nas outras duas |
| S15 | `/privacidade#regras-da-comunidade` pelo link do app | A âncora não existe; faltam as duas seções |
| S16 | Árvore de acessibilidade do menu, da confirmação e do aviso | Item sem "Bloquear <nome>"; aviso fora da região educada |

## 4. Execução nativa (mecanismo existente)

O único caminho nativo da equipe é `.github/workflows/capturas-nativas.yml`, com o simulador de iPhone no macOS e o emulador de Android no Ubuntu. Ele roda num ramo enviado: o disparo e o ramo são do Lead (`gh workflow run capturas-nativas.yml --ref <ramo>`). Os fluxos atuais já cobrem a entrada, o Perfil e a Privacidade (`55-privacidade`).

Com a entrega da spec 14 integrada (servidor e app), entram três fluxos novos em `fluxos/telas/`, cada um com a ordem em `telas/config.yaml` e as capturas em `CAPTURAS_ESPERADAS` de `comum.sh`. Eles só entram junto com o servidor, porque sem as rotas `/api/bloqueios` e `/api/suporte` falhariam.
- `56-bloquear`, no Explorar com a demonstração da comunidade:
  1. "•••" de um cartão de outra pessoa (`cartao-<código>-mais`);
  2. `…-bloquear`, depois a confirmação (`confirmacao-confirmar`), com captura;
  3. o aviso "Pessoa bloqueada." com "Desfazer", com captura;
  4. tocar "Desfazer".

  A conta sintética continua igual para os outros fluxos.
- `57-denunciar`:
  1. "•••" e `…-denunciar`;
  2. o motivo `denuncia-spam`, com captura;
  3. `denuncia-enviar` e o aviso com protocolo, com captura.

  O cartão denunciado é da demonstração e sai só para a conta sintética.
- `58-ajuda`: no Perfil, a seção Ajuda (testIDs de Mobile 2), com captura. A abertura do navegador do sistema não é seguida.

Limites: no simulador do Expo Go, o botão da Apple só existe se o servidor da conferência anunciar `apple: true`, e o login real não acontece. O emulador roda sem áudio, e o leitor de tela não é conferido.

## 5. Pacote do iPhone (permissões, manifesto, entitlements)

```bash
# O projeto que o EAS compila, a partir do perfil (sem Mac, sem conta):
node apps/mobile/scripts/conferir-artefato-ios.mjs --prebuild testflight --json <arquivo>
# O .ipa do EAS, quando o Lead baixar o build (entitlements do perfil de provisão):
node apps/mobile/scripts/conferir-artefato-ios.mjs --app <Studoo.ipa> --temp <pasta> --json <arquivo>
```

Resultado em `5d7a267` (prebuild do perfil `testflight`): 0 erros e 4 avisos.
- **Erros: nenhum.** O entitlement `com.apple.developer.applesignin` = Default, o manifesto (tracking false; UserDefaults, FileTimestamp, SystemBootTime e DiskSpace), os textos de câmera, fotos e microfone em PT, o ATS sem cargas arbitrárias, `ITSAppUsesNonExemptEncryption` false, o esquema `studoo-dev` do Google e a API em HTTPS estão em ordem.
- **Avisos, para o Lead decidir:**
  - o bundle `com.studoo.mobile.dev` no perfil de loja;
  - `NSFaceIDUsageDescription` com o texto padrão em inglês, que vem do expo-secure-store (o app não usa biometria; o plugin aceita `faceIDPermission` em PT);
  - `NSLocalNetworkUsageDescription` e `NSBonjourServices` (`_expo._tcp`), que vêm do expo-dev-client e ficam também no build de loja.

A assinatura real (os entitlements dentro do binário) só se confere num Mac, com `codesign -d --entitlements :- Studoo.app`.

## 6. Checklist no aparelho (TestFlight, quando o Lead disparar o build)

1. **Entrada:**
   1. "Continuar com a Apple" ao lado de "Continuar com o Google";
   2. entrar com a Apple (ID de teste) e com o Google;
   3. sair.
2. **Cadastro por e-mail:** criar a conta e receber o código. O e-mail real é do operador.
3. **Perfil:**
   1. a seção Privacidade e dados;
   2. revogar a IA e ver o cartão voltar antes do próximo envio;
   3. "Excluir conta" com uma conta descartável, depois tentar entrar de novo.
4. **Comunidade:** S4 (denunciar), S9 (bloquear e "Desfazer") e S13 (suporte), conforme a seção 3.
5. **VoiceOver:** o menu "•••", a confirmação do bloqueio e o aviso (S16).
6. Dizer o aparelho, o iOS e o número do build em cada resultado.
