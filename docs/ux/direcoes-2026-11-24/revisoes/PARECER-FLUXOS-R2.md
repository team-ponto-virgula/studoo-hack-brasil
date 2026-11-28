# Revisão independente de fluxos — R2

24/11/2026 · candidata `31fb42736d15d75ed75d7c1cf046f01d81a9251d` · revisão de fluxo sem edição do renderer. O [parecer R1](PARECER-FLUXOS-R1.md) permanece como histórico.

**As correções da R1 passaram, mas a meta 9 ainda não está comprovada.** A rodada integrada encontrou cinco defeitos médios novos. Eles pertencem ao protótipo local, sem implicar uma falha de autenticação, gravação ou publicação do produto real.

## Fonte e prova executada

| Arquivo | SHA-256 antes/depois |
| --- | --- |
| `app.js` | `2ebf5cf30fca4f4b29e9af91a658c0692d85a809e16ae38f5f922a1bb62a6a15` |
| `media-pages.js` | `35aa4f8a274a8b4b7857bc33a7b6da9a2580fc18fddcb0a3ae6d6f072021d42a` |
| `social-pages.js` | `572a52154ab2a2d6aa681dfe6ee57b110826d8a12f461400e603039625e46a58` |

Fontes estáveis nas duas suítes. Chromium/Playwright em **390×844**, contextos novos por cenário, três direções. Sem API, IA, email, microfone, servidor de dados ou execução nativa. Clipboard foi exercitado no contexto isolado do navegador e com uma negativa simulada; não é prova do clipboard de iOS/Android.

| Execução final | Cenários | Verificações | Passaram | Falharam |
| --- | ---: | ---: | ---: | ---: |
| Regressão do roteiro R1 | 12 | 147 | 147 | 0 |
| Novos fluxos integrados | 33 | 207 | 186 | 21 |
| Total das duas suítes R2 | 45 | 354 | 333 | 21 |

Zero exceções dos roteiros finais e zero `pageerrors`. As 21 falhas são sete asserções sobre cinco defeitos, reproduzidas em A/B/C. Não são 21 defeitos diferentes. Cada direção recebeu 118 verificações, com 111 positivas e sete negativas.

O roteiro inicial teve dois ajustes de seletor/expectativa, preservados fora do Git: o novo vazio de Seguindo contém dois botões legítimos `filter-all`; e o diálogo de compartilhar já estava fechado, mas aguardava o evento de remoção. A condição final verifica `dialog[open]`. O teste de “Seguir sem acertar” passou a primeiro produzir um erro, pois a ação pertence a esse estado. Essas falhas de roteiro não foram contadas como defeitos do produto ou escondidas dentro dos totais finais.

## Correções da R1 confirmadas

- O histórico do navegador agora protege o rascunho de perfil; Cancelar/descarte e salvamento mantêm os comportamentos esperados.
- Recuperar proposta expirada, reenviar código expirado e tentar salvar novamente atualizam rota/estado. Reload não reabre a falha antiga.
- Seguindo sem perfis seguidos mostra vazio e o chip correto. Seguir, bloquear, ocultar conteúdo público e desbloquear na lista passaram. A associação de cópias privadas continua preservada.
- O percurso central continuou passando nas três direções, incluindo erro/reforço, tentativa original, acerto, conclusão local 1/5 e retomada coerente de INNER JOIN.

## Novos subfluxos que passaram

Os seis formatos receberam erro e acerto locais, com avanço: lacuna, múltipla escolha, ordenar por setas com anúncio de posição, associar, verdadeiro/falso com justificativa e aberta com critérios do exemplo. Não é validação de avaliação pedagógica por IA.

“Seguir sem acertar” exige confirmação, registra “Vale rever”, preserva o aviso após reload e remove a marca depois de rever/acertar. O áudio de exemplo só começa por toque; cancelar preserva o texto, parar cria transcrição revisável e Activity indisponível conserva a alternativa por texto. O retorno identifica que a explicação não foi avaliada por IA.

A foto tem página de enquadramento; imagem de exemplo, zoom, formato, interesses e cor chegaram ao perfil e permaneceram após reload. O Código Studoo tem página, QR e aviso de URL demonstrativa; copiar, alternativa após negativa do clipboard e cancelar a folha passaram. Não decodifiquei o QR neste roteiro.

Denunciar pelo cartão normal permitiu escolher motivo, revisar/editar os detalhes, confirmar protocolo local e ocultar o alvo correto. Publicação no Explorar exigiu conferência e confirmação; o estado pendente não ofereceu link/código; cancelar retirada conservou o estado e confirmar retirada manteve a trilha privada.

Os três HTMLs autossuficientes abriram por **HTTP**, sem buscar assets externos, e navegaram da bancada à apresentação. Não tentei contornar o bloqueio de `file://` nem declaro abertura local no celular comprovada.

## Cinco correções necessárias

| ID / gravidade | Reprodução | Resultado observado nas três direções | Correção e nova prova |
| --- | --- | --- | --- |
| R2-F1 · médio · áudio e histórico | Exercício correto → Explique → preencher rascunho → Gravar → Browser Back → Browser Forward. | A gravação de exemplo reaparece ativa, sem novo gesto; o textarea não está editável. O caminho de histórico não encerra o mesmo estado que `go()` encerra. | Encerrar temporizador/estado e preservar o rascunho antes de sair pelo histórico. Repetir Back/Forward e confirmar que voltar não reinicia a gravação. Isso não é prova de microfone real aberto. |
| R2-F2 · médio · edição composta | Perfil → Editar → alterar nome → Trocar foto. | Abre “Sair sem salvar?” e fica no editor. Para chegar ao subfluxo de foto, exige descartar ou salvar o restante antes. | Tratar foto como parte do mesmo rascunho; entrar/voltar sem descarte, aplicar o enquadramento ao draft e salvar tudo pela ação final. Testar também cancelar a foto. |
| R2-F3 · médio · identidade de visitante | Entrada → Experimentar como visitante → Ajuda → Suporte → Voltar ao estudo → Perfil. | O callback de suporte troca `isGuest` para `false` e o nome para Nina. O perfil passa a abrir sem a escolha de entrar/criar conta. | Preservar identidade no retorno do suporte. Repetir o trajeto e conferir que perfil/compartilhar continuam exigindo conta. É uma incoerência do protótipo, não uma vulnerabilidade real de login. |
| R2-F4 · médio · campo editável sem efeito | Configurar trilha → alterar nome e descrição → Salvar alterações → abrir Configurar novamente. | O nome muda, mas a descrição volta a “Praticar filtros e junções em consultas.” O campo aceitou edição sem preservá-la. | Persistir a descrição por trilha no modelo local e restaurá-la; confirmar salvar, cancelar, reload e alternância entre cópias. |
| R2-F5 · médio · alvo de denúncia na entrada direta | Abrir a página-base de Prévia diretamente → Denunciar esta trilha → escolher motivo/revisar/confirmar → Explorar. | A prévia mostra “SQL sem complicação”, mas a denúncia usa o fallback do estudo privado “SQL para a prova”. Esse título é ocultado e o alvo público continua na lista. | Usar o mesmo alvo/título da prévia apresentada, inclusive sem navegação anterior por cartão. Testar entrada direta e por cartão. O caminho normal por cartão já passou. |

As capturas e os estados dos cinco casos foram preservados. R2-F5 recebeu um diagnóstico isolado adicional com título exibido, contexto da denúncia, `reportedTitles` e títulos que continuam visíveis. Os dados são sintéticos.

## Notas e cobertura

| Faceta examinada | A | B | C | Motivo |
| --- | ---: | ---: | ---: | --- |
| D1 · clareza do contexto | 8,0 | 8,0 | 8,0 | O alvo da denúncia direta não corresponde à prévia exibida; não houve teste de compreensão com pessoas. |
| D2 · ação e autonomia | 8,0 | 8,0 | 8,0 | A edição composta exige um contorno para trocar foto; histórico reabre o estado ativo de gravação. |
| D8 · feedback e recuperação | 8,0 | 8,0 | 8,0 | Recuperações R1 corretas, mas a descrição editável não é conservada pelo salvamento. |
| D9 · continuidade e confiança | 8,0 | 8,0 | 8,0 | O retorno do suporte muda a identidade e o histórico não conserva o estado esperado do áudio. |
| D10 integral | `null` | `null` | `null` | A cobertura ampliou para 35 páginas e os subfluxos acima foram interagidos; este parecer não executou exaustivamente toda a matriz e as duas larguras 390/360. Isso depende das evidências complementares, sem exigir prova nativa para uma nota de desenho. |
| D3/D4/D5/D6/D7 integrais | `null` | `null` | `null` | Dependem dos pareceres competentes. R2-F1 é evidência concreta de controle de movimento/estado, mas não autoriza atribuir uma nota integral de D5. |

As notas são limites da R2 no recorte examinado, sem transferência para C1–C10 do produto. Os achados médios impedem a meta ≥9 nas facetas afetadas; a nota global continua `null`. A representação própria de gravação, transcrição, recorte, Código Studoo e denúncia fecha várias lacunas de desenho da R1; não as apresento novamente como ausentes nem como provas de integração nativa.

## Evidências e próxima rodada

Diretório: `/workspace/work/revisao-fluxos-r2/`. Regressão: `revisar-regressao.cjs` e `resultado.json`. Novos fluxos: `novos-fluxos.cjs` e `novos-resultados.json`. Diagnóstico do alvo: `diagnostico-denuncia-direta.json`. As capturas têm direção/cenário no nome; rodadas iniciais de seletores foram preservadas separadamente. Nada desse material chama serviços reais.

Após corrigir R2-F1–F5, congelar novo commit/hash e repetir os casos afetados com a regressão pertinente. Preservar este parecer e as medições anteriores. Nenhuma nota 9 foi atribuída por intenção, quantidade de telas ou sucesso dos testes isolados das factories.
