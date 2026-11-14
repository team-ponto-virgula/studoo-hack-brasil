# Revisão de paridade entre web e Android

Web e app devem oferecer o mesmo percurso, conteúdo, identidade visual e ações. O desktop conserva a barra lateral; no celular, a navegação e as ações principais ficam na parte inferior. Os componentes continuam nativos no Android.

## Ajustes desta revisão

- A entrada do app abre diretamente no login, como a web. A antiga etapa separada de boas-vindas foi retirada; o Stu e a paisagem continuam no formulário e a apresentação de cinco passos continua após o primeiro acesso.
- Login valida e-mail e senha vazios com mensagens no campo. Após credenciais inválidas, as duas versões limpam a senha. A indisponibilidade do Google só aparece depois de concluir a consulta de configuração.
- O separador entre Google e e-mail, a tipografia dos títulos em celular, a paisagem e os espaçamentos da entrada foram alinhados.
- Recuperação usa o mesmo símbolo de cadeado/confirmação, aviso de envio, etapas, rótulos de carregamento e ação inferior. A versão web estreita deixa de colocar o formulário dentro de um cartão adicional. No app, o título recebe foco ao mudar de etapa.
- Conclusão da aula fica sem o cabeçalho adicional no app. Na web em celular, as duas ações finais ficam juntas no rodapé, como no app. A chuva de confetes usa a mesma quantidade de peças.
- A CSP web permite os atributos de estilo usados pelo React para posicionamento, cores e progresso. Tags de estilo continuam exigindo nonce em produção, assim como os scripts.
- `packages/contratos/src/experiencia.ts` passa a ser a fonte de textos de apresentação, pedido, geração, trilha, aula, retomada, autenticação e erros. Os arquivos de mensagens de cada plataforma mantêm apenas os acessores e aliases necessários. Não há mudança na API nem no banco.

## Percursos revisados

| Percurso | Verificação |
| --- | --- |
| Entrada | Google/configuração, e-mail e senha, validações e mostrar senha |
| Recuperação | Pedido de código, código inválido, troca, confirmação e retorno ao login |
| Apresentação | Cinco passos e escolha de área |
| Pedido | Área, sugestões, campo, fala do Stu e geração |
| Geração | Andamento, prévia pronta e preparação das lições |
| Aula | Conceito, exemplo, exercício, erro, nova tentativa e acerto |
| Conclusão | Resumo, progresso e ações para continuar |
| Trilha | Caminho, marcos, próximo passo e retorno aos planos |
| Meus planos | Cartões e retomada |

As capturas locais ficam em `artifacts/paridade/`. A web usa API e banco locais com IA falsa; a prévia do app usa React Native Web e API simulada. Quantidade de planos e conteúdo gerado dependem da conta e dos dados de cada ambiente, e não são diferenças de interface.

Os testes de paridade verificam a fonte única de textos, os desenhos e as cores de texto, ação, campos e feedback. Os testes de movimento verificam preferência de movimento reduzido, segundo plano e limpeza das assinaturas. Build e tipos são conferidos nas duas plataformas.

Permanecem adaptações deliberadas: navegador versus SecureStore para sessão, navegador do sistema para Google no Android, gestos e teclado nativos, áreas seguras e barra lateral no desktop. Esta revisão não substitui a validação em aparelho Android: teclado físico/virtual, TalkBack e desempenho nativo ainda precisam ser conferidos ali.
