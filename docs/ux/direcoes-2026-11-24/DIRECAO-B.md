# B · Caderno Claro

**Resultado final R7:9,0 no escopo do desenho**, conforme [resultados](RESULTADOS.md) e [matriz](MATRIZ-COBERTURA-R7.md). As anotações de autoria abaixo conservam o contexto anterior às revisões; o fechamento atual está nesses pareceres.

## Proposta

O Studoo como um caderno que ajuda a continuar: capítulos reconhecíveis, uma decisão por etapa e espaço para o conceito. A inspiração do Duolingo aparece na orientação da progressão, no feedback perto da tentativa e no próximo passo evidente. A organização de papel, lombada e anotação diferencia esta direção; os exercícios não recebem textura ou ornamentos que prejudiquem a leitura.

Esta direção é um protótipo mobile com dados sintéticos locais. Não é uma instalação de tema no app publicado. Layouts de início, mapa e conclusão têm composição própria no renderer compartilhado; as demais famílias recebem a mesma linguagem de componentes, em vez de uma segunda coleção desconectada.

## Decisões de composição

| Região | Direção B |
| --- | --- |
| Início e biblioteca | O estudo em andamento vem antes da coleção. Capas com lombada discreta identificam cadernos sem empilhar cartões decorativos. |
| Criação e material | Campo branco sobre fundo creme; objetivo e material permanecem legíveis. Ação azul única e material com marcador de origem. |
| Geração e proposta | Estado descrito, cancelamento disponível e capítulos divididos por tipografia. A proposta tem linhas e ordem, sem transformar cada lição numa caixa. |
| Mapa | Índice vertical de capítulos e marcadores compactos. Concluído, disponível e próximo preservam texto/ícone, além da cor. |
| Lição e reforço | Conteúdo em primeiro plano; código em uma superfície azul clara, fonte/citação em margem de anotação. Erro preserva a tentativa e apresenta recuperação. |
| Conclusão | Página concluída: o que foi praticado, andamento e próximo passo. Dobra discreta da folha, sem chuva de objetos ou animação decorativa contínua. |
| Explorar e perfis | Coleção editorial com capas compactas; autoria e título têm prioridade. Perfil comunica a pessoa e suas trilhas, sem placar de pessoas. |
| Configurações e privacidade | Lista estável, controles reconhecíveis e ações destrutivas separadas por significado, com confirmação. |

## Tokens

| Papel | Valor |
| --- | --- |
| Fundo de caderno | `#FBF7F0` |
| Papel / campos | `#FFFFFF` |
| Texto principal | `#172550` |
| Texto auxiliar | `#5C6275` |
| Ação | `#2455CE` |
| Ação escura / links | `#173C99` |
| Apoio azul | `#EDF2FF` |
| Divisor estrutural | `#DED8CD` |
| Limite do campo | `#88867F` |
| Sucesso | `#216B47` sobre `#EDF7EF` |
| Erro | `#A72C39` sobre `#FFF0ED` |
| Fontes | Quicksand 700 em títulos; Nunito no conteúdo e nos controles |
| Ação principal | mínimo 52 px; raio 15 px; volume tátil discreto de 3 px |
| Outros alvos | mínimo 44 px; foco visível de 3 px |

Os divisores suaves agrupam conteúdo e não definem sozinhos um campo interativo. Limites de inputs e opções usam contorno mais escuro; foco, seleção e erro possuem indicação própria. O CSS não altera a ordem semântica, não acrescenta texto essencial em pseudo-elementos e não esconde conteúdo para fazer a tela caber.

### Conferência dos pares de cor

Cálculo WCAG por luminância relativa sRGB dos tokens em 24/11/2026; não é auditoria da tela renderizada nem de estados de transparência herdados da base.

| Par | Contraste |
| --- | ---: |
| Texto principal / creme | 13,88:1 |
| Texto auxiliar / creme | 5,68:1 |
| Branco / ação azul | 6,43:1 |
| Link escuro / apoio azul | 8,75:1 |
| Sucesso / fundo de sucesso | 5,88:1 |
| Erro / fundo de erro | 6,18:1 |
| Limite de campo / branco | 3,64:1 |
| Limite de campo / creme | 3,41:1 |

## Identidade e limites

Logo, azul, Quicksand/Nunito e poses disponíveis vêm do kit do Studoo. O kit local ainda apresenta o personagem azul arredondado. **O Stu caderno dos anexos é a referência de branding, mas seus PNGs originais não estão disponíveis nesta cópia.** A arte não foi redesenhada ou gerada por aproximação; a bancada identifica o uso provisório. Isso impede apresentar a direção como aprovação final da troca de mascote.

O fundo creme é contido; superfícies de leitura, formulário e código mantêm contraste. Não há XP, moedas, ranking, sequência de dias ou promessa de domínio por concluir uma lição. Movimento é uma indicação de mudança, respeita a preferência reduzida e não acrescenta espera à ação.

## Revisão

Meta: pelo menos 9 no desenho observado, usando D1–D10 rastreáveis ao método. Esta ficha ainda não atribui nota: CSS e intenção não são evidência visual. A conferência precisa usar todas as famílias e estados na bancada em 390×844 e 360×800, verificar contraste/tamanhos, navegação por teclado e movimento reduzido e registrar os achados antes/depois. A nota do produto integrado e das plataformas nativas permanece `null` sem sua própria execução.

Critérios com atenção especial: D3 (leitura e adaptação), D4 (diferenciação e consistência), D6 (foco/contraste/alvos), D8 (recuperação) e D9 (retomada que representa somente o estado local do protótipo). Os nomes e pesos definitivos estão em `COBERTURA-E-REVISAO.md`; não se mudam pesos ou notas para atingir a meta.

## Rodada visual e congelamento

**CSS B congelado para QA independente:** SHA-256 `781e22ae783a0d7a1b7af77fbc793826010212b13c5b0c8dd419395495de635d`. Nenhum ajuste posterior à solicitação de congelamento foi aplicado. `git diff --check` passou. A fonte final ainda depende da rodada integrada congelada da coordenação; esta ficha não atribui 9 automaticamente.

A primeira captura percorreu as **32 páginas em 390×844 e 360×800 (64 vistas)**, em Chromium com dados sintéticos, com hashes estáveis antes/depois. Resultado: zero erros JavaScript, zero rolagem horizontal e nenhum CTA principal de rodapé fora da viewport. Essa rodada usava o CSS B `8cd756d8a72a9d44c4166abe8b3e8094dfacc38659fad64503179c3a08a1bcad`, base `521be8114a6c02d8b91bf74b9d1ba2a903472fc7959ac57c6fe49b9e83c1207b` e app `08ef070a9b76af07f72154db7f1de55a74459f43cd66c51be26e5708bb139aac`. É evidência histórica, não certificação do hash final. Capturas e resultado completos estão fora do Git, em `/workspace/work/revisao-direcao-b/`.

Inspeção visual detalhada: início, pedido, proposta, mapa, lição, exercício, conclusão, Explorar, perfil, editar e preferências. Foram ajustados os hooks reais de marcador de página, capas, perfil, próximo passo e pontos do mapa. O ponto azul atual passou a ficar no marcador, preservando texto e descrição sobre fundo claro; a conclusão recebeu espaçamento mais compacto, sem ocultar informação nem reduzir o corpo para caber.

Dois achados compartilhados foram enviados à coordenação: retângulo de foco do título não interativo e switches com alvo de 48×28. A coordenação informou correção em folha de acessibilidade final (foco DOM do título preservado, anéis dos controles mantidos; hitbox de switch 56×44 com track 48×28). O CTA de retomada também foi padronizado no rodapé das três direções. Essas correções não herdam a medição da primeira captura: devem entrar na rodada congelada.

Na largura de 360, métricas secundárias da conclusão podem exigir rolagem conforme a versão da copy. O próximo passo e as ações continuam em regiões próprias; conferir o corte da dobra no QA final. Houve uma captura intermediária interrompida enquanto o renderer compartilhado era atualizado; não foi promovida a resultado de aprovação. Persistência real, leitor/teclado nativos, áreas seguras e desempenho continuam sem execução nesta ficha.
