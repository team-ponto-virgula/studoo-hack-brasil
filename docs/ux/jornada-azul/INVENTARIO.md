# Inventário de componentes · Jornada Azul

25/11/2026 · inspeção da base `8c057241f6fc4820f36c284218a4f04affa59543` · escopo web de estudo e app do estudante. A direção **A** passa a orientar todo o sistema. O [plano](PLANO.md) define a ordem e o [sistema](SISTEMA.md) define anatomia, identidade e estados.

**Status inicial deste inventário: implementação em andamento, fechamento a consolidar.** As linhas são alvos concretos da migração, não declarações de que foram verificadas. Um estilo central pode atingir várias linhas; isso não permite marcar todas como concluídas sem conferir seus estados. O responsável registra a conclusão no relatório de implementação com commit/evidência e qualquer pendência.

## Fundamentos e estrutura

| ID | Família/componente | Consumidores web | Consumidores React Native | Conferência obrigatória |
| --- | --- | --- | --- | --- |
| C01 | Tokens, tipo, espaços e superfícies | `src/app/globals.css`, estilos de `src/ui` e páginas | `tema.ts`, `interface.tsx` e estilos locais | Mesmos papéis/medidas, contraste, escala de texto; retirar azul/raio concorrente. |
| C02 | Logo e Stu | `src/ui/componentes.tsx`, `mascote.tsx` | `interface.tsx`, `mascote.tsx`, catálogo | Preservar assets/expressões/proporções/animações aprovados; revisar só o encaixe. |
| C03 | Estrutura/cabeçalho/área rolável | `estudo.tsx`, `trilha.css`, `globals.css` | `interface.tsx` (`Tela`), `estudo.tsx` | Contexto, ordem, safe area, fim da rolagem, navegação assistiva. |
| C04 | Navegação/cápsula/aba | `estudo.tsx`, `.navegacao-mobile` e lateral | `estudo.tsx`, `interface.tsx` (`CAPSULA`) | Raio externo 24/aba 16, altura-base 62, posição/safe area preservadas; seleção além de cor, nomes, alvos, voltar/gesto/histórico; conteúdo não coberto. |
| C05 | Rodapé/ação principal | `AcaoPrincipal`, `rodape-movel.ts`, rodapés de tela | `Tela.rodape`, `estilos.rodapeConteudo` | CTA na dobra, largura, alternativa depois, teclado e texto ampliado. |
| C06 | Título/cabeçalho de seção/etiqueta | `componentes.tsx` e títulos das páginas | `Titulo`, títulos locais | Ordem de leitura e hierarquia consistentes; palavras longas sem corte. |

## Controles e retorno

| ID | Família/componente | Consumidores web | Consumidores React Native | Conferência obrigatória |
| --- | --- | --- | --- | --- |
| C07 | Botão principal/secundário/texto | `src/ui/componentes.tsx` (`Botao`), `.botao` | `interface.tsx` (`Botao`) | Normal/foco/pressionado/desativado/pendente; 52/44; sem envio duplo. |
| C08 | Botão de ícone/olho/fechar | `Icone`, botões de aula/conta/folha | `BotaoIcone`, `icone.tsx` | Nome/estado, foco e alvo; o desenho não substitui o rótulo. |
| C09 | Campo/área de texto/código/senha | Entrada/cadastro/recuperar, pedido, perfil, aula | `Campo`, `CaixaDoCampo` e campos de telas | Rótulo/ajuda/erro/contador, senha visível, texto longo, foco, teclado, valores preservados. |
| C10 | Escolha/ficha/chave/tema/cor | `.opcao`, formulários, `ChaveStudoo`, temas | `Opcao`, `Ficha`, `Chave`, `ChaveStudoo`, cores | Sem salto entre estados; selecionado anunciado; desativado e erro. |
| C11 | Progresso/anel/andamento | `BarraProgresso`, `AnelProgresso`, barra da aula | `estudo.tsx`, `licao.tsx`, `caminho.tsx` | Total/fração reais; rótulo legível e `progressbar`; sem animação fingindo avanço. |
| C12 | Selo/visibilidade/moderação/sincronia | `SeloSincronia`, `MarcaCompartilhar`, `EstadoModeracao` | `SeloSincronia`, `SeloVisibilidade`, `EstadoDaPublicacao` | Texto e ícone além de cor; estados atuais/rede/revisão/recebida. |
| C13 | Carregando/esqueleto | `Skeleton`, `SkeletonTrilha`, vazios de carregamento | `Skeleton`, `Esqueleto`, `SkeletonTrilha` | Rótulo de status, animação reduzida, caixa estável e falha recuperável. |
| C14 | Vazio/erro/offline | `EstadoErro`, `EstadoVazio`, vazios de telas | `EstadoMensagem`, `EstadoErro`, vazios de telas | Causa e próximo passo claros; Stu preservado; repetir não apaga trabalho válido. |
| C15 | Aviso/status | `aviso.css`, avisos/`FaixaComunidade` | `FaixaDoAviso`, `AvisoSobreAFolha`, `Status` | Sem roubar foco/cobrir CTA; ação, tempo, dispensa e anúncio. |
| C16 | Menu de ações | `MenuCartao`, menu da comunidade/publicação | `MenuDeAcoes`, `MenuCartao` | Abrir/fechar, orientação do balão, teclado e foco; perigo por último. |
| C17 | Confirmação | `DialogoConfirmar`, `ConfirmacaoModal` | `CartaoConfirmacao` | Cancelar seguro, texto de consequência, pendente/erro, retorno ao acionador. |
| C18 | Folha/diálogo | Compartilhar/som/denúncia/recorte e folhas de estudo | `FolhaDeAcoes`, folhas próprias e recorte | Título/fechar, foco contido, altura útil, safe area, rolar e cancelar. |

## Componentes da jornada de estudo

| ID | Família/componente | Consumidores web | Consumidores React Native | Conferência obrigatória |
| --- | --- | --- | --- | --- |
| C19 | Entrada/apresentação/interesses | `login/entrada.tsx`, `apresentacao.tsx`, cadastro/recuperação | `sessao.tsx`, `apresentacao.tsx`, `cadastro.tsx`, `recuperar.tsx` | Cinco cenas, conta/visitante/provedores por flags, avançar/pular/voltar; sem mudar boot. |
| C20 | Objetivo/ideias/tema/material | `pedido.tsx`, `pedido.css`, `estudio.tsx` | `estudo.tsx` (`Pedido`), `MaterialParaTrilha` | Vazio/longo/validar/rascunho/editar, limite de arquivo, cancelar/erro/remover e consentimento. |
| C21 | Prévia/citação/fonte de material | `estudio.tsx`, `aula.tsx`, `estudio.css` | `PaginaDoMaterial`, `CartaoFonte`, `ApoioDaLicao` | Origem exata quando houver; loading/erro, texto/tabela/foto sem overflow. |
| C22 | Geração/espera/cancelamento | `previa-trilha.tsx`, `previa-trilha.css` | `estudo.tsx` (`GeracaoAoVivo`), `geracao-ritmo.ts` | Eventos reais, falha/repetir/limite, não perder pedido nem anunciar conclusão antes do aceite. |
| C23 | Proposta/aceite/mapa | `previa-trilha.tsx`, `Plano`, `src/ui/caminho.tsx` | `estudo.tsx`, `caminho.tsx` | Parte, nó atual/concluído/bloqueado/prévia; texto longo, balão, ponte, vale rever e trilha concluída. |
| C24 | Cartão de retomada/outras trilhas | `CartaoDestaque`, `CartaoPlano`, `MenuCartao` | `CartaoDestaque`, `CartaoPlano`, vazio de trilhas | Uma hierarquia de ação, objetivo/capa/progresso reais; recebido, excluir/cancelar, lista não recarrega indevidamente. |
| C25 | Conceito/exemplo/recurso | `aula.tsx`, `desenho.tsx`, `texto-com-formulas.tsx` | `licao.tsx`, `aula-formatos.tsx`, `desenho.tsx`, `texto-com-formulas.tsx` | Texto/fórmula/figura/áudio, origem, expandir, etapa anterior e rascunho. |
| C26 | Lacuna | `EtapaExercicio`, `Trecho`, campo de lacuna | `licao.tsx`, `Trecho`, `CaixaDoCampo` | Incompleto, digitar/enviar/erro/acerto; foco e teclado preservados. |
| C27 | Múltipla escolha | `EtapaExercicio`, `.opcao` | `Opcao`, `licao.tsx` | Mesma ordem da tentativa, marcado, corrigindo, erro/acerto e repetir. |
| C28 | Ordenar | `ordenar.tsx`, `ordenar.css` | `ordenar.tsx` | Arrasto e alternativa de toque/teclado, foco e rolagem; erro e correção. |
| C29 | Associar | `Associar` | `aula-formatos.tsx` (`Associar`) | Ambos os lados, pares fixos/parciais, feedback e preservar acertos. |
| C30 | Verdadeiro/falso + justificativa | `VerdadeiroFalso` | `aula-formatos.tsx` (`VerdadeiroFalso`) | Duas decisões legíveis, incompleto/parcial, justificativa e recuperar. |
| C31 | Aberta + critérios | Campo/`CorrecaoAberta` | `CampoAberta`, `CorrecaoAberta` | Mínimo, revisão por critérios, parcial, modelo quando permitido, repetir. |
| C32 | Feedback/reforço/ponte | `PonteReforco`, retorno da aula | `licao.tsx`, `ApoioDaLicao`, `FaixaDaPonte` | Erro→outro caminho→novo exemplo→desafio→retorno; estado além da cor. |
| C33 | Resolva comigo/Sua vez | `resolva-comigo.tsx`, aula | `resolva-comigo.tsx`, lição | Quando o contrato oferecer resolução; figuras/fórmulas e ida/volta preservadas. |
| C34 | Explique/grave/revise/envie | `ApoioDaLicao`, gravação/voz do `estudio.tsx` | `estudio-adaptativo.tsx`, `estudio-cenas.tsx`, `voz-ao-vivo-painel.tsx` | Gesto antes de gravar; negar/indisponível/60s/fundo; revisar antes de enviar; opcional e erro/repetir. |
| C35 | Conclusão/continuidade | `LicaoConcluida` | `TelaConcluida` | Salvando/falha/salvo real, progresso, próxima, vale rever; reload/retomar e recomeçar com confirmação. |

## Componentes pessoais e de comunidade

| ID | Família/componente | Consumidores web | Consumidores React Native | Conferência obrigatória |
| --- | --- | --- | --- | --- |
| C36 | Explorar/busca/tema/cartão de trilha | `comunidade.tsx`, `comunidade.css` | `comunidade.tsx` | Todos/Seguindo, Em alta/Novas, tema/busca/limpar, vazio, paginação, contexto/scroll preservados. |
| C37 | Perfil público/prévia recebida | `perfil.tsx`, `publico.tsx`, `PreviaTrilha` | `TelaPerfilPublico`, `TelaPreviaTrilha`, `social.tsx` | Voltar, seguir/adicionar/continuar, já adicionada e link inativo; não expor email. |
| C38 | Meu perfil/edição/avatar/recorte | `TelaPerfil`, `EditorPerfil`, `Avatar`, `RecorteImagem` | `perfil.tsx`, `social.tsx`, `recorte.tsx` | Dados reais, foto/permissão/recortar/remover, erro/salvar e sair sem salvar. |
| C39 | Nome/capa/tema da trilha | `TelaConfiguracoes`, `CapaDaTrilha` | `configuracoes.tsx` | Edição por campo, selecionado estável, galeria/foto, erro/salvo e consequência de excluir. |
| C40 | Compartilhar/Código Studoo/visibilidade | `FolhaCompartilhar`, `VisibilidadeDaTrilha`, `codigo.tsx` | `FolhaCompartilhar`, `SeloVisibilidade`, `codigo-studoo` no contrato | Link/perfil/Explorar por elegibilidade; material restrito, recebida sem republicar, copiar/retirar e cancelar. |
| C41 | Postar/perfil/seguir/novidades | `postar-no-perfil.tsx`, `seguir.tsx`, comunidade/perfil | `postar-perfil.tsx`, `BotaoSeguir`, `NovidadesDoPerfil` | Pendente/aprovado/recusado, contagem real, erro/repetir; mudança de tela não altera outro registro. |
| C42 | Preferências de som/movimento | `som.tsx`, `som.css`, ambiente de movimento | `som.tsx`, `preferencias.ts`, `movimento.ts` | Chaves, carregando/tocando/erro, persistência e anúncio; plataforma identificada. |
| C43 | Privacidade/IA/excluir/sair | `aceite-ia.tsx`, `privacidade-perfil.tsx`, página de privacidade | `consentimento-ia.tsx`, `privacidade.tsx`, sessão/perfil | Consentir/revogar, provedores, confirmar digitação de excluir; cancelar/pendente/erro. |
| C44 | Denúncia/bloqueadas/regras/ajuda | `seguranca-comunidade.tsx`, suporte, `atendimento.css` | `seguranca.tsx`, `DialogoDenuncia`, comunidade | Motivo/protocolo, bloquear/desfazer/desbloquear, lista vazia, falha e ajuda acessível. |

## Limites e como fechar o inventário

Cada família exige pelo menos o estado base e os caminhos de risco listados. Uma variante é não aplicável somente por contrato/flag identificado, não por conveniência da captura. Em SQL, `Resolva comigo` depende de `resolucao` presente; a ausência legítima não remove o teste quando outro conteúdo oferece esse recurso.

A assinatura nativa de abertura fica preservada e recebe regressão adjacente, sem redesenho. A landing `/conheca`, páginas institucionais/OG e o painel restrito de moderação têm funções próprias; não viram telas novas no app. Podem herdar tokens, mas sua reformulação não é pressuposta pela migração do app do estudante.

Para registrar fechamento, usar as colunas: **ID → web → app → estados exercitados → pares 390/360 → fonte/commit → achados → status**. Status válidos: `planejado`, `integrado_sem_evidencia`, `verificado_no_escopo`, `pendente` e `nao_aplicavel_com_motivo`. A revisão nativa continua explicitamente separada da prévia RN Web. O [plano](PLANO.md) define os gates e a ficha de nota; este inventário não prova execução por si só.
