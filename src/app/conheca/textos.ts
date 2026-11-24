export const linhasDoTitulo = ['Seu caderno', 'vira lição.'] as const;

export const textos = {
  pagina: {
    titulo: `Studoo — ${linhasDoTitulo.join(' ')}`,
    descricao: 'Transforme uma foto, um PDF ou um assunto em lições curtas. Resolva uma questão com o Stu e descubra como ele ajuda quando você erra.',
  },
  pular: 'Pular para o conteúdo',
  cabecalho: { entrar: 'Entrar', abrir: 'Abrir o Studoo' },
  visitante: 'Experimentar sem conta',
  visitanteIndisponivel: 'Entrar',
  heroi: {
    titulo: linhasDoTitulo.join(' '),
    subtitulo: 'Mande uma foto, um PDF ou só o assunto que você quer estudar. O Stu cria lições curtas e dá uma pista quando você erra.',
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
      apoio: 'Adicione o Studoo pelo Safari para abrir pela Tela de Início.',
      disponibilidade: 'O convite público do TestFlight ainda não está disponível.',
    },
    /** O iPad (o app nativo é só de iPhone, supportsTablet: false): o caminho é sempre a Tela de Início pelo Safari, também depois do TestFlight. */
    ipad: {
      rotulo: 'Usar no iPad agora',
      rotuloLeitor: 'Usar no iPad agora, o Studoo na Tela de Início',
      apoio: 'No iPad, o Studoo fica na Tela de Início e abre em tela cheia, como um app.',
    },
    iphoneTestflight: {
      rotulo: 'Instalar no iPhone',
      rotuloLeitor: 'Instalar no iPhone, pelo TestFlight',
      apoio: 'Versão de teste pelo TestFlight, o app de testes da Apple.',
    },
    computador: {
      instalarNoCelular: 'Instalar no celular',
    },
  },
  qr: {
    titulo: 'Instale no celular',
    alt: 'Código QR para baixar o Studoo no celular',
    legenda: 'Aponte a câmera do celular',
    arquivo: (tamanho: string | null) => (tamanho ? `Baixar o arquivo para Android (${tamanho})` : 'Baixar o arquivo para Android'),
    conviteIphone: 'Abrir convite do TestFlight',
  },
  folhaIphone: {
    titulo: 'Use o Studoo no iPhone hoje',
    tituloIpad: 'Use o Studoo no iPad hoje',
    texto: 'Abra o app pelo botão abaixo. No Safari, siga estes passos para adicioná-lo à Tela de Início.',
    foraDoSafari: 'Copie o endereço do app e abra-o no Safari para adicionar à Tela de Início.',
    passos: [
      'Com o app aberto, toque em Compartilhar na barra do Safari.',
      'Escolha “Adicionar à Tela de Início”.',
      'Toque em Adicionar. O Studoo fica com os seus apps.',
    ],
    entendi: 'Entendi',
    abrirApp: 'Abrir o app para adicionar',
    fechar: 'Fechar',
  },
  s2: {
    titulo: 'Veja como o Stu ensina',
    momentos: [
      { escolha: 'Seu material', titulo: 'Seu material vira lição', linha: 'Mande uma foto, um PDF ou um documento. Cada lição mostra de onde tirou a ideia, com o trecho do seu material.' },
      { escolha: 'Tentar de novo', titulo: 'Errou? Tem outro jeito', linha: 'O Stu explica a mesma ideia por outro caminho, em 3 passos curtos, e você tenta de novo.' },
      { escolha: 'Ensinar ao Stu', titulo: 'Explique do seu jeito', linha: 'Conte ao Stu o que entendeu. Ele mostra o que fez sentido e o que vale revisar.' },
      { escolha: 'Continuar depois', titulo: 'No computador e no celular', linha: 'Com uma conta, a sua trilha é a mesma no site e no app. Você continua de onde parou.' },
    ],
    selo: 'Progresso salvo agora',
    /** A aba da janela de navegador do momento 4: o nome do site, sem endereço inventado. */
    janelaAba: 'Studoo',
    /** O `alt` da captura da web (a lista da spec não traz este; é o mesmo tom dos outros). */
    janelaAlt: 'A mesma trilha no site, aberta no navegador do computador',
  },
  s3: {
    titulo: 'O que você quer aprender?',
    lista: 'Ideias para começar',
  },
  s4: {
    titulo: 'Leve o Stu no celular',
    abas: 'Escolha o seu aparelho',
    android: {
      aba: 'Android',
      passos: [
        'Toque em “Baixar para Android”.',
        'Abra o arquivo baixado. Se o Android pedir, permita instalar deste navegador.',
        'Abra o Studoo e entre com a sua conta, ou experimente sem conta.',
      ],
      /** No computador, com o cartão do QR ao lado (spec 18, seção 3): os passos falam do celular, e o botão "Baixar para Android" não existe ali. */
      passosNoComputador: [
        'Aponte a câmera do Android para o código ao lado.',
        'Toque no link que aparecer e abra o arquivo baixado. Se o Android pedir, permita instalar deste navegador.',
        'Abra o Studoo e entre com a sua conta, ou experimente sem conta.',
      ],
    },
    /** A aba do iOS para quem está num iPad: os passos da Tela de Início. */
    ipad: { aba: 'iPad' },
    iphone: {
      aba: 'iPhone',
      testflightPassos: [
        'Instale o TestFlight, o app de testes da Apple, pela App Store.',
        'Toque em “Instalar no iPhone”, nesta página.',
        'No TestFlight, toque em Instalar e abra o Studoo.',
      ],
      /** No computador, antes do TestFlight (spec 18, seção 3): o QR leva o iPhone à página, no Safari, e dali à Tela de Início. */
      passosNoComputador: [
        'Leia o código com a câmera do iPhone. No Safari, toque em “Abrir o app para adicionar”.',
        'Toque em Compartilhar e escolha “Adicionar à Tela de Início”.',
        'Toque em Adicionar. O Studoo fica com os seus apps.',
      ],
      /** No computador, com o TestFlight (spec 18, seção 3). */
      testflightPassosNoComputador: [
        'Instale o TestFlight, o app de testes da Apple, pela App Store.',
        'Aponte a câmera do iPhone para o código ao lado e abra o convite.',
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
