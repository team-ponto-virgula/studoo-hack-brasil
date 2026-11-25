# Login mobile — proposta para revisão

**25/11/2026 · R1 aprovada como base de organização; R2 e boas-vindas em revisão.**

O dono gostou da simplicidade desta tela e pediu evolução dinâmica. A [R2](evolucao/README.md) preserva essa organização, retira o Stu pequeno, anima a logo e põe **Google antes de Apple**, conforme a correção explícita. [Ver o movimento](evolucao/capturas/login-em-movimento.gif).

A nova [entrada de boas-vindas](boas-vindas/index.html) fica separada do formulário. O [plano completo de onboarding](ONBOARDING.md) distingue conta nova de login, sem depender da instalação do app. Os exemplos continuam sendo propostas visuais; nenhuma dessas mudanças foi ligada ao runtime.

O objetivo desta rodada é corrigir a organização do login. O pedido mais recente substitui a aprovação visual das direções anteriores: trabalhar uma tela de cada vez e extrair o padrão depois da revisão. Esta pasta contém somente uma proposta; não altera as telas em produção, o mascote ou a intro de abertura.

## Ver e experimentar

- [Imagem principal, 390×844](prototipo/capturas/login-390.png).
- [Imagem em 360×800](prototipo/capturas/login-360.png).
- [Senha, 390×844](prototipo/capturas/senha-390.png).
- [Senha, 360×800](prototipo/capturas/senha-360.png).
- [Protótipo editável](prototipo/index.html), com HTML, CSS e JavaScript locais.

Para reabrir no ambiente Cloud:

```sh
cd /workspace/work/studoo-login-design/docs/ux/login-2026-11-25/prototipo
python -m http.server 3030 --bind 0.0.0.0
```

Abrir `http://localhost:3030` no navegador da mesma máquina. Na conferência desta rodada, o ambiente não tinha portal público de prévia configurado; `localhost` no celular do dono não aponta para esta máquina. As imagens permanecem acessíveis no repositório e na tarefa. Em um computador maior, a proposta continua sendo uma coluna mobile de até 430px.

**É um estudo visual, não uma execução nativa.** A barra de status e o indicador inferior são elementos de apresentação. Os diálogos dos botões explicam os limites do protótipo; não são a proposta de conteúdo desses fluxos no produto. Não usar credenciais reais: não há backend, chamada OAuth, autenticação ou armazenamento dos campos. Cadastro, recuperação, ajuda e política ainda não foram redesenhados nesta rodada.

## Organização proposta

1. Marca e uma saudação curta, com o Stu original pequeno, como companhia.
2. E-mail → **Continuar**. A senha aparece no segundo estado, com título próprio, e-mail editável, recuperação próxima ao campo, mostrar/ocultar e **Entrar**. As demais escolhas ficam na etapa inicial; “Outras formas de entrar” volta a ela sem apagar o e-mail.
3. Métodos sociais elegíveis juntos, abaixo da alternativa por e-mail. Nesta R1 a ordem era Apple antes de Google; a R2 corrige para Google antes de Apple, a pedido do dono.
4. Criar conta e experimentar como visitante em um grupo secundário.
5. Ajuda e política públicas no fim.

Saem da composição principal a paisagem, os argumentos promocionais, o cartão destacado do visitante, o controle de som, a apresentação expandida e os botões com degrau. A apresentação continua acessível pela ajuda na futura implementação, sem ser misturada ao formulário. O acesso ao produto como visitante não foi removido.

A progressão e-mail→senha é apenas estado local de interface: **não deve consultar se uma conta existe**. Nesta proposta, custa um toque adicional no acesso por senha em troca de uma primeira tela mais simples; esse custo precisa ser aceito na revisão. Ao alterar o e-mail, seu valor é preservado. Não há promessa de migração do progresso visitante: a explicação conserva o prazo de 24h no aparelho e informa que não é transferido para uma conta.

## Padrão em estudo, ainda sem aprovação global

| Elemento | Proposta |
| --- | --- |
| Superfície | Branca, sem cartão envolvendo toda a tela |
| Texto | Navy `#17213d`; secundário `#626b7e` |
| Ação principal | Azul `#2854f4`, plana, largura inteira |
| Tipografia | Inter no protótipo, sem substituir a marca ou as fontes do app |
| Título | 32/38px; 30/36px na largura menor |
| Campos e ação | Altura mínima 56px, raio 12px |
| Alternativas | Borda neutra, sem sombra; mínimo 54px |
| Agrupamento | 24–32px entre blocos; 10–14px dentro do grupo |
| Toque/teclado | Alvos de pelo menos 44px, foco visível, fluxo com rolagem natural |
| Movimento | Nenhuma animação decorativa em laço; respeita movimento reduzido |

O botão Apple desenhado é uma representação do estado iOS. Ao implementar, usar o componente oficial `AppleAuthenticationButton` na variante branca com contorno. Não substituir por um botão caseiro no app. Google usa o asset que já existe em `packages/contratos/assets`.

## Referências conferidas

Conferência em 25/11/2026, no navegador web em largura mobile, sem autenticar ou enviar formulários:

- [Spotify, login oficial em português](https://accounts.spotify.com/pt-BR/login): e-mail primeiro, uma ação forte e alternativas agrupadas. A progressão foi usada como referência de organização; a paleta e a marca continuam Studoo. Não foi uma execução do app nativo Spotify.
- [Linear, login oficial](https://linear.app/login): uma coluna e hierarquia curta entre métodos. O Studoo mantém suas próprias capacidades e seu mascote.
- [21st.dev — Login Minimal, scrollxui](https://21st.dev/@scrollxui/components/login-minimal): conferidos página, descrição, composição na prévia da página e requisitos React/Tailwind/motion. Referência de contenção e agrupamento, sem copiar ou instalar o componente.
- [21st.dev — Clean & Minimal Sign In, Preet Suthar](https://21st.dev/@preetsuthar17/components/clean-minimal-sign-in): conferidos descrição e requisitos. Não foi executado como componente nem usado como código do protótipo.

As referências de 21st.dev são componentes web; não são componentes React Native prontos. Nenhuma dependência externa foi adicionada ao app. A fonte Inter está acompanhada da [licença OFL](prototipo/assets/OFL-Inter.txt), obtida do diretório oficial `google/fonts/ofl/inter`; os assets de marca e Stu foram copiados do próprio repositório sem alteração.

## Limites e próxima decisão

A imagem deve responder: ficou mais fácil identificar como entrar? O espaço, o tamanho e o peso de cada grupo estão adequados? O Stu acompanha sem disputar com o formulário? Esta rodada precisa desse retorno visual antes de redesenhar outra tela.

Não há nota autodeclarada, teste com pessoas usuárias, build de iPhone, Expo nativo, publicação ou envio ao TestFlight nesta entrega. Testes do protótipo não comprovam funcionamento da autenticação real. Se esta organização for aprovada, a implementação precisa preservar as flags e os contratos de autenticação, além da paridade entre web móvel e React Native exigida em `docs/REGRAS-DO-PROJETO.md`. O restante do aplicativo continua fora do escopo desta rodada.

As medidas e conferências desta proposta ficam em [VERIFICACAO.md](VERIFICACAO.md).
