/*
 * Os textos da página de apresentação, exatamente como na spec 18 (docs/specs/18-pagina-de-apresentacao.md, seções 1 e 3).
 * Moram aqui, e não no contrato, porque a página só existe na web (spec 07, P34). Nenhum número, promessa ou depoimento que não
 * foi medido: o único número é o tamanho do APK, medido (links.ts).
 */
export const textos = {
  pagina: {
    titulo: 'Studoo: aprenda qualquer coisa, uma lição por vez',
    descricao: 'O Studoo transforma seu material em prática, usa o erro para oferecer outro caminho e pede que você explique o que entendeu.',
  },
  pular: 'Pular para o conteúdo',
  cabecalho: { entrar: 'Entrar', abrir: 'Abrir o Studoo' },
  visitante: 'Experimentar sem conta',
  visitanteIndisponivel: 'Entrar',
  heroi: {
    titulo: 'Aprenda qualquer coisa. Uma lição por vez.',
    subtitulo: 'Conte o que quer aprender ou mande uma foto do seu material. O Studoo monta lições curtas e, quando você erra, explica de outro jeito.',
    celularRotulo: 'Telas do Studoo: escolher o que aprender, a trilha pronta e uma lição com o acerto',
  },
  acoes: {
    android: {
      rotulo: 'Baixar para Android',
      /** Começa pelo texto visível (WCAG 2.5.3) e diz, a quem usa leitor de tela, o que o botão é. */
      rotuloLeitor: 'Baixar para Android, versão de teste do Studoo',
      apoio: (tamanho: string | null) => (tamanho
        ? `Versão de teste para Android 7 ou mais novo, com ${tamanho}. O arquivo instala direto, sem loja.`
        : 'Versão de teste para Android 7 ou mais novo. O arquivo instala direto, sem loja.'),
      baixando: 'Baixando…',
      comoInstalar: 'Abra o arquivo baixado para instalar. Se o Android pedir, permita instalar apps deste navegador.',
    },
    iphoneEmBreve: {
      rotulo: 'Usar no iPhone agora',
      rotuloLeitor: 'Usar no iPhone agora, o Studoo na Tela de Início',
      apoio: 'O app para iPhone chega em breve pelo TestFlight.',
    },
    iphoneTestflight: {
      rotulo: 'Instalar no iPhone',
      rotuloLeitor: 'Instalar no iPhone, pelo TestFlight',
      apoio: 'Versão de teste pelo TestFlight, o app de testes da Apple.',
    },
    computador: {
      apoio: 'Para instalar no celular, aponte a câmera para o código.',
      instalarNoCelular: 'Instalar no celular',
    },
  },
  qr: {
    titulo: 'Instale no celular',
    alt: 'Código QR para baixar o Studoo no celular',
    legenda: 'Aponte a câmera do celular',
    arquivo: (tamanho: string | null) => (tamanho ? `Baixar o arquivo para Android (${tamanho})` : 'Baixar o arquivo para Android'),
  },
  folhaIphone: {
    titulo: 'Use o Studoo no iPhone hoje',
    texto: 'No Safari, o Studoo abre como um app, em tela cheia.',
    foraDoSafari: 'Abra esta página no Safari para adicionar à Tela de Início.',
    passos: [
      'Toque em Compartilhar, na barra do Safari.',
      'Escolha “Adicionar à Tela de Início”.',
      'Toque em Adicionar. O Studoo fica com os seus apps.',
    ],
    entendi: 'Entendi',
    fechar: 'Fechar',
  },
  s2: {
    titulo: 'Como o Studoo ensina',
    momentos: [
      { titulo: 'Seu material vira lição', linha: 'Mande uma foto, um PDF ou um documento. Cada lição mostra de onde tirou a ideia, com o trecho do seu material.' },
      { titulo: 'Errou? Tem outro jeito', linha: 'O Stu explica a mesma ideia por outro caminho, em 3 passos curtos, e você tenta de novo.' },
      { titulo: 'Explique do seu jeito', linha: 'Conte ao Stu o que entendeu. Ele mostra o que fez sentido e o que vale revisar.' },
      { titulo: 'No computador e no celular', linha: 'Com uma conta, a sua trilha é a mesma no site e no app. Você continua de onde parou.' },
    ],
    selo: 'Progresso salvo agora',
  },
  s3: {
    titulo: 'Pode ser qualquer assunto',
    linha: 'Comece com uma ideia pronta ou escreva a sua.',
    lista: 'Ideias para começar',
  },
  s4: {
    titulo: 'Instale em 3 passos',
    abas: 'Escolha o seu aparelho',
    android: {
      aba: 'Android',
      passos: [
        'Toque em “Baixar para Android”.',
        'Abra o arquivo baixado. Se o Android pedir, permita instalar deste navegador.',
        'Abra o Studoo e entre com a sua conta, ou experimente sem conta.',
      ],
    },
    iphone: {
      aba: 'iPhone',
      testflightPassos: [
        'Instale o TestFlight, o app de testes da Apple, pela App Store.',
        'Toque em “Instalar no iPhone”, nesta página.',
        'No TestFlight, toque em Instalar e abra o Studoo.',
      ],
    },
  },
  s5: { titulo: 'Qual vai ser a sua primeira lição?' },
  s6: {
    linha: 'Feito para o HackBrasil 2026.',
    privacidade: 'Política de privacidade',
    suporte: 'Suporte',
  },
} as const;
