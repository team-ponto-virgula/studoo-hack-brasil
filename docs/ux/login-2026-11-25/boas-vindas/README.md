# Boas-vindas — entrada separada do login

**Proposta visual mobile, 25/11/2026. Não cria contas.**

Esta composição apresenta o Studoo sem misturar benefícios ao formulário aprovado. O Stu original aparece com 150px, como personagem principal das boas-vindas; o login R2 concentra a identidade na logo.

## Três quadros, a mesma organização

1. **Seu assunto vira uma trilha.** Um pedido de SQL se transforma em lições.
2. **Um erro abre outro caminho.** Uma resposta tem outra explicação e nova tentativa.
3. **Continue de onde parou.** A lição concluída aparece no progresso e indica o próximo passo.

Cada quadro mostra apenas uma promessa e um pequeno exemplo identificado. A navegação é manual por CTA ou indicadores, sem autoplay. “Já tenho conta” permanece disponível e aponta ao [login R2](../evolucao/index.html). O último CTA abre uma explicação de protótipo: não há cadastro ou persistência real nessa página.

## Capturas

| Quadro | 390×844 | 360×800 |
| --- | --- | --- |
| Assunto e trilha | [Ver](capturas/beneficio-1-390-100.png) | [Ver](capturas/beneficio-1-360-100.png) |
| Outra explicação | [Ver](capturas/beneficio-2-390-100.png) | [Ver](capturas/beneficio-2-360-100.png) |
| Progresso e retomada | [Ver](capturas/beneficio-3-390-100.png) | [Ver](capturas/beneficio-3-360-100.png) |

Também foram capturados os três quadros com texto a 200% em ambas as larguras, usando rolagem natural. Os 12 PNGs estão em `capturas/`; DPR2. Sem rolagem horizontal ou erros JavaScript nas capturas. Em escala normal, o CTA de 56px aparece sem rolar nas duas larguras; os controles têm alvos de 44px ou mais. [Medidas](capturas/medidas.json) e [fontes/limites](capturas/fonte.json).

Uma revisão independente passou **8/8 verificações**: avançar/voltar, foco no título, diálogo ilustrativo e retorno do foco, navegação para o login R2, ações alcançáveis nas três páginas com texto normal/ampliado e movimento reduzido. O movimento normal de 240ms termina sem repetição. Arquivos e assets ficaram estáveis; sem erro JavaScript/console ou chamada de API. [Registro](capturas/resultado-interacoes.json). Essas conferências não executam cadastro real ou onboarding persistente.

Para abrir no navegador da máquina Cloud, servir a pasta pai na porta 3031, conforme o [README da R2](../evolucao/README.md), e acessar `http://localhost:3031/boas-vindas/`.

## Escopo da próxima implementação

O [plano de onboarding completo](../ONBOARDING.md) descreve conta nova → objetivo → consentimento de IA → trilha → primeira lição → progresso, reaproveitando os fluxos reais. O cadastro deve inicializar estado por conta no servidor. Entrar em conta existente, inclusive após reinstalação, não reinicia o roteiro. A orientação incompleta pode ser retomada sem bloquear o login explícito.

Este artefato não implementa aquela regra de conta, nem os fluxos autenticados. O código e os assets privados da referência estudada não foram copiados. A arte do Stu foi reutilizada do próprio repositório.
