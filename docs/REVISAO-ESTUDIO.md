# Revisão do estudo adaptativo — 14/11/2026

Implementação na branch `feat/aprendizado-adaptativo`. Não representa publicação em produção.

## Verificado

- Typecheck web e app; build Next de produção.
- Nove testes de estudo adaptativo, com banco real e provedores simulados: fluxo completo, referências, isolamento de contas, expiração, reforço sem avanço indevido do progresso, DOCX, CSV, imagem WebP/OCR, voz, formatos inválidos, limites e canais de autenticação web/nativo.
- Suítes existentes: domínio (13), paridade (5), IA (8), movimento (4), Google mobile (5), Resend (3), acesso Google/recuperação (13).
- Percursos HTTP existentes: marco e trilha, 17 testes. Nesta máquina a porta 3000 está ocupada; foram usadas cópias locais dos testes alterando apenas a asserção de porta para 3100.
- Chromium contra o build e banco locais: PDF textual real, prévia, criação da trilha, referência, erro, reforço, explicação ao Stu, conclusão e ponte no mapa.
- DOCX e CSV enviados pelos seletores reais da web e da prévia nativa. Texto por parágrafo e tabela por linha conferidos, inclusive em 360 px. Web também revisada em 1440 px, sem transbordamento horizontal da página; a tabela possui rolagem própria.
- Prévia React Native Web ligada à mesma API e banco locais: material, referências, reforço, ensino, conclusão e mapa. A adaptação temporária da prévia mantém a autenticação de demonstração; o canal bearer nativo foi testado separadamente nas rotas.
- Gravação nas duas interfaces com dispositivo de áudio simulado do Chromium e resposta de transcrição interceptada. O texto permanece editável e exige envio explícito. Não equivale a teste de microfone físico ou reconhecimento real de fala.
- Enter na explicação não aciona a conclusão da aula. A volta à trilha recarrega a ponte salva e conserva o nó de origem; movimento reduzido desliga a animação.

As capturas e roteiros de navegador desta sessão estão em `artifacts/estudio/`, fora do Git. Os testes automatizados permanentes estão em `tests/estudio.test.mjs` e no CI.

## Validações externas pendentes

Não há `OPENAI_API_KEY` disponível neste ambiente. A leitura de imagem, geração, reforço, avaliação e transcrição com respostas reais do provedor precisam de uma execução com chave válida.

Não há SDK/emulador Android instalado. É necessário gerar novo development build, instalar em um aparelho e verificar seletor, câmera, microfone, permissões negadas, teclado, segundo plano e leitura por acessibilidade. A regra atual do projeto aceita typecheck e paridade como verificação provisória do app; a prévia de navegador não substitui esse teste.

Nenhum resultado com estudantes foi coletado ou inventado. O protocolo e a tabela vazia estão em `DEMO-HACKATHON.md`.

Para disponibilizar: aplicar migrações no ambiente de destino, configurar IA real e canal nativo HTTPS, agendar a limpeza dos materiais expirados e reconstruir o app. Credenciais ficam apenas no ambiente do servidor.

## Segunda revisão — correções e regressões

- **Arquivo no limite de tamanho:** foi reproduzido um `RangeError` ao validar base64 de um arquivo válido de 5 MB. A expressão regular com grupos repetidos foi substituída por conferência canônica após decodificação. Há testes para o limite, excesso de tamanho e base64 inválido.
- **Resposta atrasada e clique duplicado:** uma consulta de apoio antiga podia apagar da tela uma ponte recém-criada. Web e app agora descartam essa resposta após uma atualização local e impedem chamadas simultâneas antes mesmo do próximo render.
- **Microfone e segundo plano:** uma permissão concedida com atraso podia iniciar a gravação com o app oculto. As duas interfaces conferem se ainda estão ativas; o app também libera o modo de áudio se o preparo for interrompido. Durante a gravação, os comandos de reforço ficam indisponíveis para não disputar a requisição de transcrição.
- **Referências e cobertura da simulação:** DOCX e CSV mantêm os rótulos de parágrafos/linhas nos exercícios. Todas as seções legíveis são consideradas; a simulação não corta mais o material após a quarta seção.

Validação desta revisão: 11 testes de servidor/arquivos, 7 testes de efeitos e handlers de interface, 5 testes de paridade, typecheck web/nativo e build. Os novos testes de interface reproduzem respostas e permissões atrasadas sem usar hardware; foram incluídos no CI. As pendências de OpenAI real e Android físico acima permanecem.
