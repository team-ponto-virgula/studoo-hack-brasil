# Três direções mobile — brief de construção

24/11/2026 · pedido do dono: três direções completas das páginas principais, Duolingo como base de inspiração, revisão de 0 a 10 e meta mínima 9 em desenho. Não substitui as notas do produto integrado ou a execução nativa. A intro suave segue sua distribuição interna separada.

## Direções

- **A · Jornada Azul:** progressão visível e feedback próximo da ação; botões táteis, nós e capítulos, acolhimento do Stu. A maior proximidade com o princípio do Duolingo, com a identidade do Studoo.
- **B · Caderno Claro:** papel claro, organização de caderno, capítulos e anotações; estudo e revisão com ritmo editorial. O caderno do novo Stu informa materialidade, sem inventar sua arte.
- **C · Foco Vivo:** interface contemporânea e concentrada, azul profundo, conceito e próxima ação; módulos compactos, detalhes sob demanda e continuidade visível.

As três compartilham contratos de aprendizagem e estados, mas variam composição, hierarquia, forma dos componentes e ritmo. Não são três trocas de paleta. Sem XP, streak, ranking ou moedas. Quicksand/Nunito, logo e assets do kit atual preservados; os PNGs originais do Stu caderno não estão disponíveis nesta cópia. A arte provisória é identificada na bancada e impede afirmar branding final aprovado.

## Artefato

Protótipo mobile navegável, dados sintéticos locais, sem API, serviços de login, voz ou banco. A bancada identifica o escopo; cada ação demonstra uma transição real do protótipo, sem botões mortos. Conclusão e retomada locais são rotuladas como exemplos, não evidência de persistência no produto. Revisão em 390×844/360×800, teclado, foco, contraste, alvos, movimento reduzido e conteúdo ampliado no navegador.

## Organização dos arquivos

`prototipo/app.html`, `app.js` e `base.css` pertencem à coordenação. `directions/jornada.css`, `caderno.css` e `foco.css` contêm estilos específicos; o seletor raiz é `body[data-direction="jornada|caderno|foco"]`. Cada direção tem ficha própria. Não alterar o renderer de produção neste lote.

Classes compartilhadas previstas: `.app`, `.topbar`, `.brand`, `.icon-button`, `.app-main`, `.screen[data-page]`, `.eyebrow`, `.lead`, `.panel`, `.hero`, `.hero-copy`, `.mascot`, `.primary`, `.secondary`, `.quiet`, `.bottom-actions`, `.bottom-nav`, `.nav-item`, `.list`, `.row`, `.row-icon`, `.row-content`, `.chip`, `.stats`, `.metric`, `.note`, `.field-label`, `.field`, `.textarea`, `.choice`, `.selected`, `.chapter`, `.map`, `.map-node`, `.lesson-step`, `.step-name`, `.feedback`, `.correct`, `.incorrect`, `.code`, `.avatar`, `.cover`, `.toggle`, `.tag`, `.source-card`, `.empty`, `.study-meta`, `.material-file`, `.section-title`, `.profile-cover`, `.share-card`, `.dialog`, `.plan-list`.

O renderer fornece composições próprias de início/mapa/conclusão por direção. Os estilos podem diferenciar superfícies, tipografia dentro das fontes locais, ritmos, componentes, biblioteca/comunidade e perfil. Preservar a ordem semântica do DOM. CTA≥52px, demais alvos≥44px, corpo≥16px, auxiliares≥12px e contraste AA nos pares aplicáveis. Foco visível. Nenhum texto essencial em pseudo-elementos. Movimento respeita `prefers-reduced-motion` e não bloqueia entrada.

## Cobertura

A matriz de famílias, estados e critérios está em `COBERTURA-E-REVISAO.md`; as fontes novas em `PESQUISA.md`. Revisões independentes devem citar telas e medições, registrar notas antes/depois e manter limites. A meta não autoriza mudar pesos nem arredondar falhas para 9.
