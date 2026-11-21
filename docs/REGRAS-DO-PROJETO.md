# Regras do projeto

## Paridade entre web e mobile

Tudo o que for feito na web (`src/app`, `src/ui`) precisa existir igual no app mobile (`apps/mobile`, Expo e React Native).

- **Igual por padrão; diferença só por obrigação da plataforma.** Na mesma largura, a mesma tela: mesma ordem, tamanhos, textos, ícones e comportamento. Só vale diferença que a plataforma impõe, como sessão no SecureStore, Google pelo navegador do sistema, voltar do aparelho, área segura, teclado virtual, TalkBack e seletores do sistema. "Fica melhor assim no toque" não é motivo: se é melhor, as duas mudam.
- **Toda diferença tem motivo escrito.** Cada diferença que sobra fica na tabela de `docs/specs/07-paridade-web-mobile.md`, com o motivo técnico e quem muda. O que não está na tabela é defeito.
- **Ação principal em tela estreita.** Até 600 px, a ação principal aparece sem rolar, ocupa a largura toda e vem antes de qualquer saída secundária, nas duas plataformas.
- **Quem está fora da regra segue quem a cumpre.** A web costuma vir primeiro e o app copia. Quando o app já cumpre uma regra que a web não cumpre, a web móvel segue o app; a decisão fica registrada na tabela da spec 07.
- **Conclusão.** Uma tarefa de tela só está concluída quando as duas versões estão prontas e os pares de captura em 390×844 e 360×800 não mostram diferença fora da tabela.
- **Verificação.** As duas plataformas passam por `npm run typecheck` (na raiz e em `apps/mobile`), pelas suítes rápidas (`test:paridade`, `test:movimento`, `test:visitante-mobile`, `test:estudio:interface`, `test:formatos`, `test:dominio`) e pelos pares de captura lado a lado. A conferência em aparelho Android (teclado, TalkBack, fontes e desempenho) fica para depois, a pedido do dono.

### Mudanças de API ou de contrato

Quem altera a API, o contrato (`packages/contratos`) ou os dados que a tela mostra avisa, no PR, o que o mobile precisa acompanhar. Exemplo: quando `fluxo` passou a ser um trecho da trilha e não um assunto, o mapeamento de `idFluxo` que o app mobile usava na tela da proposta (reconhecia os títulos "Consultas" e "Junções") passou a depender do novo comportamento da tela; ele saiu junto com essa tela, quando a trilha passou a ser gerada ao vivo.

### Lista de conferência do PR de tela

- [ ] Versão web feita e testada.
- [ ] Versão mobile feita, ou PR seguinte indicado.
- [ ] Pares de captura em 390×844 e 360×800 sem diferença fora da tabela da spec 07 (diferença nova entra lá, com o motivo).
- [ ] `npm run typecheck` na raiz e em `apps/mobile` passam.
- [ ] O que o mobile precisa acompanhar de mudança de API ou contrato está descrito.
