import type { Opcao } from "@studoo/contratos";
import type { PlanoInterno } from "@/dominio/aprendizado/plano";

/*
 * Trilhas prontas extras, só para o conteúdo de demonstração da comunidade (spec 10, etapa C1): completam os temas das
 * demos da IA falsa (violão, inglês, culinária, história, frações e fotografia) com programação, saúde, ciências e
 * carreira. Não entram no reconhecimento de objetivos da IA falsa. Conteúdo curto (2 partes, 4 lições) e verdadeiro.
 */

const op = (id: string, texto: string): Opcao => ({ id, texto });
const origem = (tema: string) => `Modo demonstração: trilha pronta sobre ${tema}`;

const origemPython = origem("programação em Python");
export const PYTHON: PlanoInterno = {
  titulo: "Python: primeiros passos",
  objetivo: "Escrever os primeiros programas em Python.",
  origem: origemPython,
  fluxos: [
    {
      titulo: "Primeiros passos",
      licoes: [
        {
          titulo: "Mostrar uma mensagem com print",
          objetivo: "Usar print para mostrar um texto na tela.",
          conceito: "Em Python, print mostra na tela o que estiver entre os parênteses. Texto vai entre aspas; número pode ir sem aspas.",
          exemplo: "print(\"Olá, Studoo!\") mostra Olá, Studoo! na tela. print(2 + 3) mostra 5.",
          origem: origemPython,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "O que aparece na tela com print(\"10\" + \"5\")?",
            opcoes: [op("a", "105"), op("b", "15"), op("c", "Um erro")],
            gabarito: ["a"],
            feedbackCorreto: "Entre aspas, 10 e 5 são textos: o + junta os dois textos, 105.",
            feedbackIncorreto: "Repare nas aspas: \"10\" e \"5\" são textos, e somar textos é juntá-los.",
          },
          outroJeito: "Pense no print como um alto-falante: ele repete exatamente o que você der. Com aspas, ele lê o texto como está.",
        },
        {
          titulo: "Guardar valores em variáveis",
          objetivo: "Criar uma variável e usar o valor dela depois.",
          conceito: "Uma variável é um nome que guarda um valor. O sinal = guarda o valor da direita no nome da esquerda. Depois, usar o nome é usar o valor.",
          exemplo: "idade = 16 guarda 16 em idade. print(idade + 1) mostra 17.",
          origem: origemPython,
          exercicio: {
            tipo: "lacuna",
            enunciado: "Complete para guardar o texto Ana na variável nome.",
            trecho: "nome ___ \"Ana\"",
            trechoTipo: "codigo",
            gabarito: ["="],
            feedbackCorreto: "O = guarda o valor da direita no nome da esquerda.",
            feedbackIncorreto: "Em Python, quem guarda um valor numa variável é o sinal de igual.",
          },
          outroJeito: "Uma variável é como uma etiqueta numa caixa: você escreve o nome na etiqueta e guarda o valor dentro.",
        },
      ],
    },
    {
      titulo: "Praticando",
      licoes: [
        {
          titulo: "Decidir com if",
          objetivo: "Usar if e else para escolher o que o programa faz.",
          conceito: "O if testa uma condição. Se ela for verdadeira, o bloco recuado embaixo dele roda; se não, roda o bloco do else. O recuo (espaços no começo da linha) mostra o que está dentro de cada bloco.",
          exemplo: "if nota >= 7:\n    print(\"Aprovado\")\nelse:\n    print(\"Recuperação\")",
          origem: origemPython,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "Com nota = 6, o que o exemplo mostra?",
            opcoes: [op("a", "Recuperação"), op("b", "Aprovado"), op("c", "Nada")],
            gabarito: ["a"],
            feedbackCorreto: "6 não é maior nem igual a 7: a condição é falsa e roda o else.",
            feedbackIncorreto: "Teste a condição: 6 >= 7 é falso. Quando o if é falso, quem roda é o else.",
          },
          outroJeito: "O if é uma bifurcação na estrada: a placa (a condição) diz para que lado seguir.",
        },
        {
          titulo: "Repetir com for",
          objetivo: "Usar for para repetir uma ação para cada item de uma lista.",
          conceito: "O for passa por cada item de uma lista, um de cada vez, e roda o bloco recuado para cada um. range(3) gera 0, 1 e 2.",
          exemplo: "for fruta in [\"maçã\", \"uva\"]:\n    print(fruta)\nmostra maçã e depois uva.",
          origem: origemPython,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "Quantas vezes for i in range(4): print(i) mostra algo?",
            opcoes: [op("a", "4 vezes"), op("b", "3 vezes"), op("c", "5 vezes")],
            gabarito: ["a"],
            feedbackCorreto: "range(4) gera 0, 1, 2 e 3: quatro números, quatro repetições.",
            feedbackIncorreto: "range(4) começa no 0 e para antes do 4: 0, 1, 2, 3. Conte quantos são.",
          },
          outroJeito: "O for é como distribuir convites: para cada nome da lista, você faz a mesma coisa.",
        },
      ],
    },
  ],
};

const origemSocorros = origem("primeiros socorros em casa");
export const SOCORROS: PlanoInterno = {
  titulo: "Primeiros socorros em casa",
  objetivo: "Saber o que fazer nos primeiros minutos de um acidente doméstico.",
  origem: origemSocorros,
  fluxos: [
    {
      titulo: "Primeiros passos",
      licoes: [
        {
          titulo: "Pedir ajuda certo: 192",
          objetivo: "Saber quando e como chamar o SAMU.",
          conceito: "Em emergência médica, ligue 192 (SAMU). Diga o endereço completo, o que aconteceu, a idade da pessoa e se ela está acordada e respirando. Não desligue até a central mandar.",
          exemplo: "“Estou na Rua das Flores, 120, apartamento 3. Meu pai, de 70 anos, caiu, está acordado, mas não consegue levantar.”",
          origem: origemSocorros,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "Qual informação vem primeiro na ligação para o 192?",
            opcoes: [op("a", "O endereço completo"), op("b", "O nome do médico da família"), op("c", "O horário do acidente")],
            gabarito: ["a"],
            feedbackCorreto: "Sem o endereço, a ambulância não chega. Comece por ele.",
            feedbackIncorreto: "Pense no que a ambulância precisa para chegar até você.",
          },
          outroJeito: "Pense em responder: onde, o quê, quem. Primeiro onde, para a ajuda sair o quanto antes.",
        },
        {
          titulo: "Queimadura leve",
          objetivo: "Cuidar de uma queimadura pequena do jeito certo.",
          conceito: "Coloque a área sob água corrente em temperatura ambiente por 10 a 20 minutos. Não use gelo, manteiga, pasta de dente nem pó de café. Não estoure bolhas. Queimadura grande, no rosto ou nas mãos de criança pede atendimento.",
          exemplo: "Respingou óleo quente no braço: água corrente da torneira por uns 15 minutos e, depois, cobrir com um pano limpo.",
          origem: origemSocorros,
          exercicio: {
            tipo: "verdadeiro_falso",
            enunciado: "Verdadeiro ou falso? Escolha também o motivo.",
            afirmacao: "Passar manteiga ajuda a aliviar a queimadura.",
            justificativas: [op("retem", "A manteiga segura o calor na pele e pode infeccionar"), op("hidrata", "A manteiga hidrata e protege a pele")],
            gabarito: ["falso", "retem"],
            feedbackCorreto: "Falso: a manteiga segura o calor. O certo é água corrente em temperatura ambiente.",
            feedbackIncorreto: "Gordura não deixa o calor sair da pele. O que esfria com segurança é água corrente.",
          },
          outroJeito: "A queimadura continua “cozinhando” a pele por um tempo. A água corrente leva esse calor embora.",
        },
      ],
    },
    {
      titulo: "Praticando",
      licoes: [
        {
          titulo: "Sangramento no nariz",
          objetivo: "Parar um sangramento nasal comum.",
          conceito: "Sente a pessoa com a cabeça levemente inclinada para a frente e aperte a parte mole do nariz por 10 minutos, sem soltar. Não incline a cabeça para trás: o sangue escorre para a garganta.",
          exemplo: "Criança com sangramento depois de brincar: sentada, cabeça um pouco para a frente, nariz apertado por 10 minutos no relógio.",
          origem: origemSocorros,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "Para onde vai a cabeça durante um sangramento no nariz?",
            opcoes: [op("a", "Levemente para a frente"), op("b", "Para trás"), op("c", "Deitada de barriga para cima")],
            gabarito: ["a"],
            feedbackCorreto: "Para a frente, o sangue sai pelo nariz e não desce para a garganta.",
            feedbackIncorreto: "Para trás, o sangue escorre para a garganta e pode causar enjoo. Incline para a frente.",
          },
          outroJeito: "Pense numa torneira pingando: você aperta o cano (a parte mole do nariz) e deixa a água sair para fora, não para dentro.",
        },
        {
          titulo: "Engasgo em adulto",
          objetivo: "Reconhecer um engasgo grave e agir.",
          conceito: "Se a pessoa tosse com força, incentive a tossir. Se não consegue falar, tossir nem respirar, peça para alguém ligar 192 e faça a manobra de Heimlich: por trás, punho fechado acima do umbigo, puxões fortes para dentro e para cima, até sair o objeto.",
          exemplo: "Alguém leva as mãos ao pescoço e não emite som: é engasgo grave. Um chama o 192, o outro faz a manobra.",
          origem: origemSocorros,
          exercicio: {
            tipo: "ordenar",
            enunciado: "Coloque os passos na ordem.",
            itens: [op("ver", "Perceber que a pessoa não fala nem tosse"), op("ligar", "Pedir para alguém ligar 192"), op("posicao", "Ficar por trás com o punho acima do umbigo"), op("puxar", "Puxar para dentro e para cima")],
            gabarito: ["ver", "ligar", "posicao", "puxar"],
            feedbackCorreto: "Reconhecer, pedir ajuda e agir: nessa ordem.",
            feedbackIncorreto: "Primeiro reconheça o engasgo grave; depois peça ajuda; só então a manobra.",
          },
          outroJeito: "A manobra empurra o ar dos pulmões para cima, como apertar uma garrafa para a tampa pular.",
        },
      ],
    },
  ],
};

const origemFisica = origem("física do dia a dia");
export const FISICA: PlanoInterno = {
  titulo: "Física do dia a dia",
  objetivo: "Explicar fenômenos comuns com ideias de física.",
  origem: origemFisica,
  fluxos: [
    {
      titulo: "Primeiros passos",
      licoes: [
        {
          titulo: "Inércia e o cinto de segurança",
          objetivo: "Usar a inércia para explicar por que o cinto salva vidas.",
          conceito: "Inércia é a tendência de um corpo continuar como está: parado, parado; em movimento, em movimento. Quando o carro freia de repente, o corpo continua indo para a frente. O cinto é a força que segura o corpo.",
          exemplo: "No ônibus que arranca, você vai para trás; quando ele freia, você vai para a frente. É o corpo tentando manter o movimento que tinha.",
          origem: origemFisica,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "O carro freia de repente. Por que o passageiro sem cinto vai para a frente?",
            opcoes: [op("a", "O corpo tende a continuar em movimento"), op("b", "O banco empurra o passageiro"), op("c", "A gravidade puxa para a frente")],
            gabarito: ["a"],
            feedbackCorreto: "Inércia: o carro para, mas o corpo continua indo até algo o segurar.",
            feedbackIncorreto: "Ninguém empurra o passageiro: o carro é que para, e o corpo segue o movimento que tinha.",
          },
          outroJeito: "Imagine uma bola no carrinho de supermercado: quando o carrinho para de repente, a bola rola para a frente.",
        },
        {
          titulo: "Atrito: amigo e inimigo",
          objetivo: "Reconhecer onde o atrito ajuda e onde atrapalha.",
          conceito: "Atrito é a força que aparece quando duas superfícies se esfregam. Ele nos deixa andar sem escorregar e faz o freio funcionar, mas também gasta pneus e esquenta peças.",
          exemplo: "No piso molhado o atrito diminui e a gente escorrega; por isso o tênis tem sola com ranhuras.",
          origem: origemFisica,
          exercicio: {
            tipo: "associar",
            enunciado: "Ligue cada situação ao papel do atrito.",
            esquerda: [op("andar", "Caminhar na calçada"), op("pneu", "Pneu gasto com o tempo"), op("freio", "Freio da bicicleta")],
            direita: [op("ajuda", "Ajuda: o pé não escorrega"), op("atrapalha", "Atrapalha: desgasta a borracha"), op("para", "Ajuda: diminui a velocidade")],
            gabarito: ["andar=ajuda", "pneu=atrapalha", "freio=para"],
            feedbackCorreto: "O mesmo atrito que gasta o pneu é o que deixa você andar e frear.",
            feedbackIncorreto: "Pergunte em cada caso: o esfregar está ajudando a segurar ou gastando alguma coisa?",
          },
          outroJeito: "Esfregue as mãos: elas esquentam e é difícil deslizar uma sobre a outra. Isso é atrito.",
        },
      ],
    },
    {
      titulo: "Praticando",
      licoes: [
        {
          titulo: "Por que o café esfria",
          objetivo: "Explicar a troca de calor entre objetos.",
          conceito: "O calor passa sempre do mais quente para o mais frio, até as temperaturas ficarem iguais. O café quente perde calor para o ar e para a xícara. Uma tampa e uma garrafa térmica diminuem essa troca.",
          exemplo: "Um copo de água gelada fica morno na mesa: agora é o ar que passa calor para a água.",
          origem: origemFisica,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "Uma colher de metal fica numa sopa quente. O que acontece?",
            opcoes: [op("a", "A colher esquenta, porque recebe calor da sopa"), op("b", "A sopa esquenta mais, porque recebe calor da colher"), op("c", "Nada muda")],
            gabarito: ["a"],
            feedbackCorreto: "O calor vai da sopa (mais quente) para a colher (mais fria).",
            feedbackIncorreto: "O calor sempre sai do mais quente para o mais frio. Quem está mais quente aqui?",
          },
          outroJeito: "O calor é como água entre dois baldes ligados: corre do mais cheio para o mais vazio até o nível ficar igual.",
        },
        {
          titulo: "Pressão: faca e salto alto",
          objetivo: "Relacionar força, área e pressão.",
          conceito: "Pressão é a força dividida pela área onde ela age. A mesma força numa área menor faz mais pressão. Por isso uma faca afiada corta melhor e um salto fino afunda na areia.",
          exemplo: "Pisar no pé de alguém de salto fino dói mais do que de tênis: o peso é o mesmo, mas a área é muito menor.",
          origem: origemFisica,
          exercicio: {
            tipo: "lacuna",
            enunciado: "Complete: com a mesma força, quanto menor a área, ___ a pressão.",
            trecho: "quanto menor a área, ___ a pressão",
            trechoTipo: "frase",
            gabarito: ["maior"],
            feedbackCorreto: "Área menor, pressão maior: a força fica concentrada.",
            feedbackIncorreto: "Pense na faca afiada: a lâmina fina concentra a força num lugar pequeno.",
          },
          outroJeito: "Espalhar a força numa área grande é como andar de raquete na neve: você não afunda.",
        },
      ],
    },
  ],
};

const origemOratoria = origem("oratória");
export const ORATORIA: PlanoInterno = {
  titulo: "Falar em público sem travar",
  objetivo: "Preparar e apresentar uma fala curta com mais segurança.",
  origem: origemOratoria,
  fluxos: [
    {
      titulo: "Primeiros passos",
      licoes: [
        {
          titulo: "Começo, meio e fim",
          objetivo: "Organizar uma fala em três partes.",
          conceito: "Uma boa fala curta tem um começo que diz do que você vai falar, um meio com até três ideias e um fim que retoma a ideia principal e diz o que a plateia pode fazer.",
          exemplo: "“Vou mostrar três jeitos de economizar água. Primeiro... Segundo... Terceiro... Então, comece hoje pelo banho de cinco minutos.”",
          origem: origemOratoria,
          exercicio: {
            tipo: "ordenar",
            enunciado: "Coloque as partes da fala em ordem.",
            itens: [op("abre", "Dizer do que vai falar"), op("ideias", "Apresentar até três ideias"), op("fecha", "Retomar a ideia principal e convidar à ação")],
            gabarito: ["abre", "ideias", "fecha"],
            feedbackCorreto: "Começo, meio e fim: a plateia sabe onde está o tempo todo.",
            feedbackIncorreto: "A plateia precisa saber do que é a fala antes das ideias, e o convite vem no fim.",
          },
          outroJeito: "É como uma viagem: diga para onde vão, mostre o caminho e, na chegada, lembre por que valeu a pena.",
        },
        {
          titulo: "Ensaiar em voz alta",
          objetivo: "Usar o ensaio para ganhar segurança e caber no tempo.",
          conceito: "Ensaiar em voz alta, com relógio, mostra onde você trava e se a fala cabe no tempo. Ler em silêncio não basta: a boca precisa praticar as frases.",
          exemplo: "Gravar o ensaio no celular e ouvir uma vez ajuda a ver onde você corre ou repete “né”.",
          origem: origemOratoria,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "Qual ensaio prepara melhor para uma fala de 3 minutos?",
            opcoes: [op("a", "Falar em voz alta cronometrando"), op("b", "Ler o roteiro em silêncio"), op("c", "Decorar palavra por palavra")],
            gabarito: ["a"],
            feedbackCorreto: "Em voz alta e com relógio você ensaia o que vai acontecer de verdade.",
            feedbackIncorreto: "Em silêncio a boca não pratica, e decorar palavra por palavra trava se esquecer uma.",
          },
          outroJeito: "Ninguém aprende a andar de bicicleta lendo sobre bicicleta: a fala também se aprende falando.",
        },
      ],
    },
    {
      titulo: "Praticando",
      licoes: [
        {
          titulo: "Pausas que ajudam",
          objetivo: "Usar pausas no lugar de vícios de linguagem.",
          conceito: "Uma pausa curta dá tempo para você pensar e para a plateia entender. Ela soa segura. Trocar “éé”, “né” e “tipo” por um segundo de silêncio deixa a fala mais clara.",
          exemplo: "“O resultado foi... (pausa) o dobro do esperado.” A pausa antes do número chama a atenção para ele.",
          origem: origemOratoria,
          exercicio: {
            tipo: "verdadeiro_falso",
            enunciado: "Verdadeiro ou falso? Escolha também o motivo.",
            afirmacao: "Ficar um segundo em silêncio passa insegurança para a plateia.",
            justificativas: [op("clareza", "A pausa dá tempo de entender e soa segura"), op("vazio", "Silêncio sempre parece que você esqueceu")],
            gabarito: ["falso", "clareza"],
            feedbackCorreto: "Falso: pausas curtas soam seguras e ajudam a plateia.",
            feedbackIncorreto: "Uma pausa curta não parece esquecimento: ela dá peso ao que vem depois.",
          },
          outroJeito: "A pausa é a vírgula da fala: sem ela, tudo vira uma frase só.",
        },
        {
          titulo: "Respirar contra o nervosismo",
          objetivo: "Usar a respiração para diminuir o nervosismo antes de falar.",
          conceito: "Nervosismo é normal. Respirar devagar, soltando o ar por mais tempo do que puxou (por exemplo, puxar em 4 e soltar em 6), acalma o corpo em um ou dois minutos.",
          exemplo: "Antes de entrar na sala: três respirações puxando em 4 tempos e soltando em 6, com os ombros soltos.",
          origem: origemOratoria,
          exercicio: {
            tipo: "multipla_escolha",
            enunciado: "Qual respiração ajuda a acalmar?",
            opcoes: [op("a", "Soltar o ar mais devagar do que puxou"), op("b", "Puxar e soltar bem rápido"), op("c", "Prender o ar o máximo possível")],
            gabarito: ["a"],
            feedbackCorreto: "Soltar o ar devagar acalma o corpo.",
            feedbackIncorreto: "Respiração rápida acelera o corpo. O que acalma é soltar o ar mais devagar.",
          },
          outroJeito: "Soltar o ar devagar é como baixar o volume do corpo: o coração acompanha.",
        },
      ],
    },
  ],
};
