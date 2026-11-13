# Regras do projeto

## Paridade entre web e mobile

Tudo o que for feito na web (`src/app`, `src/ui`) precisa ser replicado no app mobile (`apps/mobile`, Expo e React Native), adaptado ao celular.

- **Adaptar, não copiar.** Use componentes nativos e pense em toque, gestos e área segura. Não se traduz HTML para o app.
- **A web vem primeiro, o mobile logo depois.** O mobile entra no mesmo PR ou em um PR seguinte, aberto antes de a tarefa ser dada por concluída.
- **Conclusão.** Uma tarefa de tela só está concluída quando as duas versões estão prontas.
- **Verificação por enquanto.** O mobile é verificado com `npm run typecheck` em `apps/mobile` e com a mesma lógica da web (regras, textos e contratos em `packages/contratos`). O teste em emulador ou aparelho fica para depois, a pedido do dono.

### Mudanças de API ou de contrato

Quem altera a API, o contrato (`packages/contratos`) ou os dados que a tela mostra avisa, no PR, o que o mobile precisa acompanhar. Exemplo: quando `fluxo` passou a ser um trecho da trilha e não um assunto, o mapeamento de `idFluxo` que o app mobile usava na tela da proposta (reconhecia os títulos "Consultas" e "Junções") passou a depender do novo comportamento da tela; ele saiu junto com essa tela, quando a trilha passou a ser gerada ao vivo.

### Lista de conferência do PR de tela

- [ ] Versão web feita e testada.
- [ ] Versão mobile feita, ou PR seguinte indicado.
- [ ] `npm run typecheck` na raiz e em `apps/mobile` passam.
- [ ] O que o mobile precisa acompanhar de mudança de API ou contrato está descrito.
