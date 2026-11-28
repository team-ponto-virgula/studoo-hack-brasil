export const linhasDoTitulo = ['Seu caderno', 'vira lição.'] as const;

export const textos = {
  pagina: {
    titulo: `Studoo — ${linhasDoTitulo.join(' ')}`,
    descricao: 'Transforme uma foto, um PDF ou um assunto em lições curtas. Resolva uma questão com o Stu e descubra como ele ajuda quando você erra.',
  },
  pular: 'Pular para o conteúdo',
  cabecalho: { entrar: 'Entrar', abrir: 'Abrir o Studoo', instalar: 'Instalar' },
  visitante: 'Experimentar sem conta',
  visitanteIndisponivel: 'Entrar',
  heroi: {
    titulo: linhasDoTitulo.join(' '),
    /** A imagem de compartilhar usa a última frase: ela precisa fazer sentido sozinha. */
    subtitulo: 'Mande uma foto, um PDF ou só o assunto que você quer estudar. O Stu cria lições curtas e explica de outro jeito quando você erra.',
    /** O que o Stu diz ao lado do título: é ele quem recebe a pessoa. */
    ola: 'Oi! Eu sou o Stu.',
    /** As três entradas do Studoo, nas fichas que flutuam ao lado do Stu. */
    entradas: ['Foto do caderno', 'PDF ou documento', 'Só o assunto'],
    comecar: { selo: 'Começar', rotulo: 'Veja uma lição nascer' },
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
  /** O nome que o leitor de tela ouve antes de cada fala do Stu. */
  falaDoStu: 'O Stu diz: ',
  trilha: {
    rotulo: 'Paradas desta página',
    parada: (numero: number, total: number) => `Parada ${numero} de ${total}`,
  },
  /**
   * A página é uma trilha: cada parada é uma região do mundo do Studoo (as mesmas do mapa do app) e mostra um momento de uma lição só, a de frações,
   * do caderno à chegada. `atalho` é o nome curto da trilha do cabeçalho; `lugar`, o nome da região no marco; `fala`, o que o Stu diz ali.
   */
  paradas: [
    {
      id: 'material', regiao: 'floresta', atalho: 'Caderno', lugar: 'Floresta das Anotações',
      titulo: 'Seu material vira lição',
      linha: 'Mande uma foto, um PDF ou um documento. Cada lição mostra de onde tirou a ideia, com o trecho do seu material.',
      fala: 'Eu não invento nada. Toque no [1] e veja de onde saiu.',
    },
    {
      id: 'ponte', regiao: 'lago', atalho: 'Ponte', lugar: 'Lago da Ponte',
      titulo: 'Errar não tira ponto. Vira ponte.',
      linha: 'O Stu explica a mesma ideia por outro caminho, em 3 passos curtos, e você tenta de novo.',
      fala: 'Eu também erro. Por isso ando com tábuas na mochila.',
    },
    {
      id: 'ensinar', regiao: 'montanhas', atalho: 'Ensinar', lugar: 'Pico do Entendi',
      titulo: 'Entendeu? Ensine ao Stu.',
      linha: 'Conte ao Stu o que entendeu. Ele mostra o que fez sentido e o que vale revisar.',
      fala: 'Me explica como se eu tivesse faltado na aula.',
    },
    {
      id: 'assuntos', regiao: 'vila', atalho: 'Assuntos', lugar: 'Vila dos Assuntos',
      titulo: 'O que você quer aprender?',
      linha: 'Comece por uma ideia pronta ou escreva a sua.',
      fala: 'Já estudei violão, frações e receita de bolo. Qual é o seu?',
    },
    {
      id: 'baixar', regiao: 'nuvens', atalho: 'Instalar', lugar: 'Acima das Nuvens',
      titulo: 'Leve o Stu no celular',
      linha: 'Com uma conta, a sua trilha é a mesma no site e no app. Você continua de onde parou.',
      fala: 'Me leva no bolso?',
    },
  ],
  material: {
    le: 'O Studoo lê',
    formatos: ['Foto', 'PDF', 'DOCX', 'CSV'],
    ouAssunto: 'ou só o assunto',
    anotacao: {
      legenda: 'Anotação de exemplo',
      titulo: 'Frações',
      /** A frase marcada é a que a lição cita em [1]. */
      marcada: 'O número de baixo conta todas as partes iguais.',
      resto: 'O de cima conta as partes que escolhemos.',
    },
    vira: 'vira',
    licao: {
      legenda: 'Lição de exemplo, montada com a anotação',
      selo: 'Conceito',
      titulo: 'Numerador e denominador',
      quem: 'O Stu explica',
      texto: 'Toda fração tem dois números. O de baixo diz em quantas partes iguais o inteiro foi dividido. O de cima diz quantas dessas partes foram escolhidas.',
      baseado: 'Baseado no seu material',
      fonte: 'Fonte do seu material',
      origem: 'Anotação de exemplo',
    },
    noApp: {
      legenda: 'No app, com um PDF de verdade',
      alt: 'Lição de fotografia no Android com a explicação do Stu e a referência [1] ao material usado',
      pdf: { rotulo: 'Abrir PDF de exemplo', rotuloLeitor: 'Abrir PDF de exemplo em nova aba' },
    },
  },
  ponte: {
    selo: 'Sua vez',
    pergunta: 'Que fração do retângulo está pintada?',
    figura: 'Retângulo dividido em oito partes iguais. Três estão pintadas com listras.',
    escolha: 'Escolha uma resposta.',
    respostas: [
      { fracao: '3/5', nome: 'três quintos', pista: 'O número de baixo conta o retângulo inteiro. Inclua as partes pintadas e as partes em branco.' },
      { fracao: '3/8', nome: 'três oitavos', pista: 'Três das oito partes iguais estão pintadas. Essa parte do retângulo é três oitavos.' },
      { fracao: '5/8', nome: 'cinco oitavos', pista: 'Você encontrou a parte em branco. Para achar a parte pintada, conte só os pedaços com listras.' },
    ],
    certa: '3/8',
    acerto: 'Mandou bem! ',
    pista: 'Uma pista do Stu. ',
    /** A ponte do reforço, como no app: de onde a pessoa travou, três tábuas, de volta ao exercício. */
    outroJeito: 'Outro jeito de entender',
    ondeTravou: 'Onde travou',
    exercicio: 'Exercício',
    passos: [
      'Pense numa barra de chocolate com 8 quadradinhos iguais.',
      'O número de baixo conta a barra inteira: 8.',
      'O de cima conta só os pedaços que você separou.',
    ],
    /** Dito junto da pista (o leitor de tela ouve onde está o reforço). */
    vejaAPonte: 'Logo abaixo, o Stu montou outro jeito de entender.',
    tenteDeNovo: 'Agora volte ao retângulo e tente de novo.',
    atravessou: 'O Stu atravessou a ponte com você.',
    /** O que o Stu diz ao lado do lago quando a ponte muda (no começo vale a fala da parada). */
    falas: { montada: 'Três tábuas e a gente chega do outro lado.', atravessada: 'Chegamos! Errar fazia parte do caminho.' },
    verPonte: 'Ver a ponte mesmo assim',
    dePrimeira: 'De primeira! Se errasse, o Stu montaria uma ponte de 3 passos.',
    seguir: 'Escolher meu assunto',
    refazer: 'Refazer',
    semScript: { resumo: 'Ver a resposta', texto: 'Três das oito partes estão pintadas. A resposta é 3/8.' },
    noApp: { legenda: 'No app, a ponte é assim', alt: 'A ponte do Studoo: outro jeito de entender, em 3 passos' },
  },
  ensinar: {
    legenda: 'Escolha uma explicação de exemplo',
    explicacoes: [
      {
        rotulo: 'Com exemplo',
        texto: 'O número de baixo é em quantas partes iguais o inteiro foi dividido. O de cima é quantas eu peguei. Numa pizza de 8 fatias, 3 fatias são 3/8.',
        fezSentido: ['Você disse o que cada número conta.', 'Você usou um exemplo, e isso ajuda a lembrar.'],
        revisar: ['Nenhuma ideia importante ficou de fora.'],
      },
      {
        rotulo: 'Bem curta',
        texto: 'Fração é um número em cima do outro.',
        fezSentido: ['Você lembrou que a fração tem dois números.'],
        revisar: ['Faltou dizer o que cada número conta.', 'Um exemplo ajuda: tente com uma pizza ou uma barra de chocolate.'],
      },
    ],
    vazio: 'Escolha uma explicação e veja o que o Stu responde.',
    ouvindo: 'O Stu está ouvindo…',
    fezSentido: 'O que fez sentido',
    revisar: 'O que revisar',
    aviso: 'Retorno de exemplo. No app, o Stu responde ao que você escrever.',
    noApp: { legenda: 'No app, o retorno do Stu', alt: 'O retorno do Stu à sua explicação' },
  },
  assuntos: {
    noApp: { legenda: 'É assim que a trilha chega no app', alt: 'Tela do Studoo com a trilha pronta' },
  },
  sincronia: {
    selo: 'Progresso salvo agora',
    /** A aba da janela de navegador: o nome do site, sem endereço inventado. */
    janelaAba: 'Studoo',
    janelaAlt: 'A mesma trilha no site, aberta no navegador do computador',
    celularAlt: 'O mapa da trilha no app',
  },
  ampliar: { app: 'Ampliar tela do app', site: 'Ampliar tela do site', tituloApp: 'Tela do app', tituloSite: 'Tela do site' },
  s3: {
    lista: 'Ideias para começar',
    campo: 'Seu assunto de estudo',
    exemplo: 'Ex.: astronomia',
  },
  s4: {
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
  s5: { lugar: 'Chegada', titulo: 'Qual vai ser a sua primeira lição?' },
  s6: {
    linha: 'Feito para o HackBrasil 2026.',
    privacidade: 'Política de privacidade',
    suporte: 'Suporte',
  },
} as const;
