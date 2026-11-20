# Segurança da comunidade: bloquear, denunciar, revisão e suporte

**Estado:** regra de design de 20/11, a pedido do dono (corrigir todas as lacunas da revisão do TestFlight com a comunidade funcionando). Candidata `24a4979`. O contrato de dados é o de `d900109` (`docs/MODERACAO-E-SUPORTE.md`, Web & API). Esta spec diz o que a pessoa vê, os textos e o roteiro de aceite, iguais na web, no Android e no iPhone. Ainda não implementado nem conferido.

**Por quê.** A regra 1.2 da Apple pede, em apps com conteúdo de outras pessoas: filtro do que é publicado, denúncia com resposta, bloqueio de quem abusa e contato publicado. A revisão de `0e8cc7e` achou: sem bloqueio, filtro que aprova tudo (`src/servidor/compartilhar/revisao.ts`), denúncia só registrada em log e sem contato de suporte no app.

## 1. Bloquear e desbloquear

- **Onde:** no "•••" do cartão de trilha (Explorar, Em alta, Seguindo, Novidades), no "•••" do perfil de outra pessoa e no da prévia de uma trilha recebida, a ação "Bloquear <nome>", logo abaixo de "Denunciar". Nunca aparece no próprio conteúdo. Vale para conta e para visitante com sessão.
- **Confirmação** (componente da spec 11):
  - título "Bloquear <nome>?";
  - texto "Você deixa de ver as trilhas e o perfil dessa pessoa, e ela deixa de ver os seus no Studoo. Ela não é avisada.";
  - ações "Bloquear" (destrutiva, vermelha) e "Cancelar" (com o foco).
- **Efeito** (`POST /api/bloqueios`):
  - vale nos dois sentidos enquanto existir;
  - o conteúdo da pessoa sai de tudo para quem bloqueou, e a tela volta ao Explorar recarregado;
  - seguir, curtir e adicionar entre os dois param de funcionar.
  - O link público `/t` continua público para quem não entrou na conta.
- **Aviso:** "Pessoa bloqueada.", com a ação "Desfazer", que chama o desbloqueio.
- **Lista no Perfil:** seção "Pessoas bloqueadas" (`GET /api/bloqueios`).
  - Cada linha mostra o nome e o botão "Desbloquear" (`DELETE /api/bloqueios/:id`, aviso "Pessoa desbloqueada.").
  - Lista vazia: "Ninguém bloqueado."
  - O desbloqueio não pede confirmação.
- **Perfil de quem você bloqueou**, aberto por um link: no lugar do conteúdo, "Você bloqueou esta pessoa." e o botão "Desbloquear".
- **Leitor de tela:** o item do menu se chama "Bloquear <nome>"; o aviso entra na região educada da spec 11.

## 2. Denunciar

- **Onde:** como hoje, "Denunciar" no "•••" do cartão e do perfil, com o diálogo e os quatro motivos de hoje: "Spam ou propaganda", "Conteúdo ofensivo", "Cópia ou direitos autorais" e "Outro motivo".
- **Visitante também denuncia** (sessão temporária, `POST /api/denuncias`). Pela regra do contrato, a denúncia dele entra para a equipe mas não tira a trilha do ar sozinha.
- **Sem sessão** (página pública `/t` ou `/p`): o link "Denunciar" abre `/suporte?alvoTipo=trilha&alvo=<código>` ou `/suporte?alvoTipo=perfil&alvo=<id>`, o formulário do Studoo, sem pedir login.
- **Texto do diálogo de trilha:** "Conte o motivo. A equipe do Studoo revisa as denúncias; com denúncias de pessoas diferentes, a trilha sai do Explorar até a revisão." O de perfil continua "Conte o motivo. A equipe do Studoo revisa cada denúncia."
- **Depois de enviar:**
  - o conteúdo denunciado some para quem denunciou;
  - aviso "Denúncia enviada (protocolo <protocolo>). Obrigado por avisar.", com a ação "Bloquear" se a pessoa ainda não estiver bloqueada;
  - o protocolo serve para acompanhar a resposta em `/suporte`.
- Nenhum texto promete prazo de resposta.

## 3. Revisão do que fica público

- **O filtro.** O servidor marca como `pendente` (contrato `d900109`):
  - toda foto de perfil e toda capa nova;
  - a publicação cujo texto (nome, resumo, legenda, título ou descrição) a lista local de termos do `revisarConteudo` sinaliza;
  - a trilha que atinge o limite de denúncias.
  Enquanto está `pendente` ou `recusado`, nada disso aparece para outras pessoas. A equipe aprova ou recusa na caixa `/equipe/moderacao` (seção 6). Não entra serviço externo novo.
- **Recusa na hora**, quando o termo é inequívoco: "Não deu para publicar: o texto não segue as regras da comunidade. Revise e tente de novo.", com o link "Regras da comunidade".
- **O que o dono vê:**

| Estado | Selo | Texto |
|---|---|---|
| Trilha pendente | "Em revisão" | "Em revisão pela equipe do Studoo. Por enquanto, só você vê." |
| Trilha recusada | "Não publicada" | "A equipe do Studoo não aprovou esta publicação. Ela continua só com você." e o link "Falar com o suporte" |
| Foto do perfil pendente | — | "Sua foto está em revisão. Até lá, os outros veem a sua inicial." |
| Capa pendente | — | "A capa está em revisão. Até lá, os outros veem a capa padrão." |

- **Logo depois de publicar ou trocar a foto**, quando ela fica `pendente`, o aviso diz "Enviada para revisão. Aparece para outras pessoas depois da aprovação." Nunca diz que já foi publicada.
- **O que os outros veem:** nada do que está pendente. O link de uma trilha fora do ar mostra "Esta trilha não está disponível agora."
- O selo "Em revisão" usa o selo neutro da spec 10 (fundo `#F1F4FD`, texto `#5E6A85`, 13 px 800). "Não publicada" usa o tom de alerta (`#9A5B00` sobre `#FFF6EA`).

## 4. Suporte

- **Perfil, seção "Ajuda":** "Falar com o suporte" (abre `/suporte`), "Regras da comunidade" (abre `/privacidade#regras-da-comunidade`) e "Política de privacidade" (abre `/privacidade`). No app, as três abrem no navegador do sistema (P20 da spec 07).
- **Entrada e recuperação de senha:** embaixo de "Esqueci minha senha", o botão de texto de 44 px "Precisa de ajuda? Fale com o suporte", que abre `/suporte`.
- **`/suporte`** é o formulário do Studoo (Web & API): quem escreve recebe um protocolo e consulta a resposta pelo protocolo. A equipe lê numa caixa restrita.

## 5. Política e consentimento

- **`/privacidade` ganha duas seções:**
  - "Comunidade": o que fica público, como denunciar e bloquear, que o publicado passa por revisão e o caminho do suporte;
  - "Regras da comunidade" (âncora `#regras-da-comunidade`): sem spam ou propaganda; sem ofensa, ódio, assédio ou ameaça; sem conteúdo sexual; sem dados pessoais de outras pessoas; respeito a direitos autorais; trilhas e textos gerados por IA seguem as mesmas regras; o que viola as regras pode ser removido.
- **Folha de compartilhar:** acima da ação que publica no perfil ou no Explorar, em 14/20 `#5E6A85`: "Ao publicar, você concorda com as Regras da comunidade.", com o link. A opção "Só com o link" não mostra a linha.
- **IA:** a revisão desta spec não usa provedor de IA. Se um dia usar, esse uso entra na lista de provedores do consentimento, e a `VERSAO_CONSENTIMENTO_IA` sobe.

## 6. Acesso da equipe

- **Caixa `/equipe/moderacao`**, só na web e no mesmo servidor, para as contas da lista de equipe do servidor. Ela não aparece em nenhum menu do produto.
- **Filas:**
  - denúncias agrupadas por alvo: tipo, link para o alvo, motivos e quantidade de cada um, primeira e última data e estado;
  - conteúdo `pendente`: foto, capa ou publicação, com quem publicou.
- **Ações:** "Aprovar" (o conteúdo aparece), "Manter no ar" (encerra as denúncias e restaura o que saiu do ar), "Remover" (o conteúdo continua só com o dono, como "Não publicada"). Cada decisão guarda quem decidiu e quando.
- Os textos da caixa não prometem prazo a ninguém.

## 7. Paridade e textos

- Os textos ficam no contrato (`packages/contratos/src/experiencia.ts`), iguais na web e no app. Menus, confirmação, aviso e folha são os componentes da spec 11.
- A única diferença é a da P20: as páginas web (`/suporte` e `/privacidade`) abrem no navegador do sistema, no app.

## 8. Roteiro de aceite

Contas: A e B (comuns), V (visitante), E (equipe). Servidor com compartilhar e comunidade ligados. Faça na web (390 e 1440) e no app (iPhone do TestFlight); o resultado tem de ser o mesmo.

| # | Passos | Esperado |
|---|---|---|
| S1 | A publica uma trilha no Explorar, com legenda comum | Aviso "Enviada para revisão…" só se ficar pendente; senão, ela aparece para B |
| S2 | A publica com um termo da lista local | Recusa na hora, com o texto e o link das regras; nada é publicado |
| S3 | A troca a foto do perfil | A vê a foto com o aviso de revisão; B vê a inicial até E aprovar |
| S4 | B denuncia a trilha de A | Aviso com protocolo e "Bloquear"; a trilha some para B e continua para os outros |
| S5 | V denuncia a mesma trilha | Aceita, com protocolo; não conta para tirar do ar |
| S6 | Três contas comuns denunciam a trilha | A trilha sai do Explorar; A vê "Em revisão"; o link mostra "Esta trilha não está disponível agora." |
| S7 | E abre `/equipe/moderacao` | Vê as denúncias agrupadas e a fila pendente; "Manter no ar" devolve a trilha; "Remover" a deixa "Não publicada" para A |
| S8 | Conta comum sem estar na lista abre `/equipe/moderacao` | Sem acesso |
| S9 | B bloqueia A pelo "•••" do perfil | Confirmação; aviso "Pessoa bloqueada."; nada de A para B e nada de B para A; seguir e curtir param |
| S10 | B toca "Desfazer" ou "Desbloquear" no Perfil | Tudo volta; aviso "Pessoa desbloqueada." |
| S11 | V bloqueia alguém | Funciona como S9 durante a sessão do visitante |
| S12 | Sem sessão, "Denunciar" em `/t` | Abre `/suporte` com o alvo preenchido, sem login |
| S13 | "Falar com o suporte" no Perfil e "Precisa de ajuda?" na entrada | Abrem `/suporte`; enviar devolve protocolo; a consulta pelo protocolo funciona |
| S14 | Folha de compartilhar, no perfil ou no Explorar | Linha das regras com o link; na opção "Só com o link", não aparece |
| S15 | `/privacidade#regras-da-comunidade` | As duas seções novas, também pelo link do app |
| S16 | Leitor de tela nos menus, na confirmação e nos avisos | Nomes e anúncios da seção 1 e da spec 11 |

Fica fora deste roteiro, e é do operador: as variáveis do servidor, a lista da equipe, a caixa do suporte e quem responde às denúncias e aos pedidos.
