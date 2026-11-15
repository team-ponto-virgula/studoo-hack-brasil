import { ILUSTRACAO_VIOLAO } from "./ilustracao-violao";
import type { Opcao } from "@studoo/contratos";
import type { PlanoInterno } from "@/dominio/aprendizado/plano";

/*
 * Trilhas prontas do modo demonstração (IA falsa), com conteúdo de verdade sobre o assunto: violão, inglês para viagem,
 * culinária básica, história do Brasil, frações e fotografia com o celular (todas as ideias populares da tela inicial). Elas mostram o que o Studoo faz além de programação, sem chave da IA: acorde com
 * diagrama e som, frases para ouvir, linha do tempo, prática com cronômetro e os formatos de exercício (ordenar,
 * associar, verdadeiro ou falso com justificativa, resposta aberta, lacuna tolerante).
 * Cada trilha segue as regras de ordem (spec 03): uma sequência de aprendizado, trechos sem nome de assunto e revisão.
 */

export type Demo = {
  chave: string;
  /** Reconhece o objetivo da pessoa. A primeira demo que reconhecer fica com a trilha. */
  reconhecer: (objetivo: string) => boolean;
  plano: PlanoInterno;
};

const op = (id: string, texto: string): Opcao => ({ id, texto });
const origem = (tema: string) => `Modo demonstração: trilha pronta sobre ${tema}`;
const trechos = ["Primeiros passos", "Praticando", "Desafio"] as const;

const origemViolao = origem("violão");
const violao: Demo = {
  chave: "violao",
  reconhecer: (objetivo) => /\b(?:viol[aã]o|acordes?|guitarra ac[uú]stica)\b/i.test(objetivo),
  plano: {
    titulo: "Violão do zero: primeiros acordes",
    objetivo: "Tocar os primeiros acordes e trocar entre eles sem parar o ritmo.",
    origem: origemViolao,
    fluxos: [
      {
        titulo: trechos[0],
        licoes: [
          {
            titulo: "Conhecer as partes do violão",
            objetivo: "Reconhecer as partes do violão que você usa para afinar e tocar.",
            conceito: "O violão tem três partes principais: a cabeça, onde ficam as tarraxas que afinam as cordas; o braço, dividido em casas pelos trastes; e o corpo, com a boca, por onde o som sai. As cordas são contadas de baixo para cima: a 1ª é a mais fina e a 6ª, a mais grossa.",
            exemplo: "Para afinar a 5ª corda, você gira a tarraxa dela, na cabeça. Para tocar uma nota mais aguda nessa mesma corda, aperta a corda numa casa do braço, mais perto do corpo.",
            recurso: { tipo: "imagem", src: ILUSTRACAO_VIOLAO, descricao: "1 tarraxa · 2 casa (entre dois trastes) · 3 boca · 4 6ª corda", fonte: "Ilustração" },
            origem: origemViolao,
            exercicio: {
              tipo: "associar",
              enunciado: "Ligue cada parte do violão ao que ela faz.",
              esquerda: [op("tarraxa", "Tarraxa"), op("casa", "Casa"), op("boca", "Boca"), op("sexta", "6ª corda")],
              direita: [
                op("afina", "Gira para afinar a corda"),
                op("nota", "Espaço do braço onde você aperta a corda"),
                op("som", "Abertura por onde o som sai"),
                op("grave", "A corda mais grossa e mais grave"),
              ],
              gabarito: ["tarraxa=afina", "casa=nota", "boca=som", "sexta=grave"],
              feedbackCorreto: "Isso! A tarraxa afina, a casa muda a nota, a boca projeta o som e a 6ª corda é a mais grave.",
              feedbackIncorreto: "Reveja a explicação: a tarraxa fica na cabeça e afina; a casa é um espaço do braço; a boca é a abertura do corpo; a 6ª corda é a mais grossa.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: "Complete com o nome da parte que você gira para afinar.",
                trecho: "Para afinar a corda, eu giro a ___ na cabeça do violão.",
                trechoTipo: "frase",
                gabarito: ["tarraxa"],
                feedbackCorreto: "Exato: a tarraxa estica ou afrouxa a corda, e isso muda a afinação.",
                feedbackIncorreto: "Releia o conceito: é a peça da cabeça do violão que você gira para esticar ou afrouxar a corda.",
              },
            ],
          },
          {
            titulo: "Montar o acorde Lá menor (Am)",
            objetivo: "Posicionar os dedos para tocar o acorde Lá menor.",
            conceito: "Um acorde é um grupo de notas tocadas juntas. No diagrama do próximo passo, as linhas verticais são as cordas, com a 6ª à esquerda, e as horizontais são os trastes. Os números dizem qual dedo usar: 1 é o indicador, 2 o médio e 3 o anelar. O X marca a corda que não deve soar e o O, a corda solta.",
            exemploTipo: "demonstracao",
            exemplo: "Veja o Lá menor no diagrama e ouça como ele soa. Depois, siga os passos com o violão na mão.",
            passos: [
              "Indicador (1) na 1ª casa da 2ª corda.",
              "Médio (2) na 2ª casa da 4ª corda.",
              "Anelar (3) na 2ª casa da 3ª corda.",
              "Toque da 5ª corda para baixo, sem tocar a 6ª.",
            ],
            recurso: { tipo: "acorde", nome: "Am", casas: [-1, 0, 2, 2, 1, 0], dedos: [0, 0, 2, 3, 1, 0] },
            origem: origemViolao,
            exercicio: {
              tipo: "multipla_escolha",
              enunciado: "No Lá menor, qual corda não deve soar?",
              opcoes: [op("a", "A 6ª corda, a mais grossa"), op("b", "A 1ª corda, a mais fina"), op("c", "A 3ª corda")],
              gabarito: ["a"],
              feedbackCorreto: "Isso: o X em cima da 6ª corda diz que ela fica de fora. O acorde começa na 5ª corda.",
              feedbackIncorreto: "Procure o X no diagrama: ele fica sobre a 6ª corda, a mais grossa. É a única que não soa no Lá menor.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'No diagrama, o que quer dizer o O em cima de uma corda?',
                opcoes: [op("a", 'A corda soa solta, sem dedo nenhum'), op("b", 'A corda não deve soar'), op("c", 'Use o dedo zero, o polegar')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: O é corda solta; X é a corda que fica de fora.',
                feedbackIncorreto: 'O X e o O são opostos: um tira a corda do acorde, o outro a deixa soar.',
              },
            ],
            pratica: {
              tarefa: "Monte o Lá menor e toque as cordas uma a uma, da 5ª à 1ª. Se alguma soar abafada, aproxime o dedo do traste.",
              minutos: 3,
              passos: ["Monte o acorde devagar, dedo por dedo.", "Toque cada corda e escute.", "Tire a mão e monte de novo, 5 vezes."],
              dica: "Use a ponta dos dedos, com as unhas curtas, e deixe o polegar atrás do braço do violão.",
            },
          },
        ],
      },
      {
        titulo: trechos[1],
        licoes: [
          {
            titulo: "Trocar do Lá menor para o Dó (C)",
            objetivo: "Trocar entre Lá menor e Dó movendo um dedo só.",
            conceito: "Trocar de acorde fica mais fácil quando você procura os dedos que não saem do lugar. Do Lá menor para o Dó, o indicador continua na 1ª casa da 2ª corda e o médio continua na 2ª casa da 4ª corda. Só o anelar muda: vai para a 3ª casa da 5ª corda.",
            exemploTipo: "demonstracao",
            exemplo: "Ouça o Dó e compare com o Lá menor: dois dedos ficam e um dedo anda.",
            passos: [
              "Lá menor (Am): indicador na 1ª casa da 2ª corda, médio na 2ª casa da 4ª e anelar na 2ª casa da 3ª.",
              "Para o Dó (C), o indicador e o médio ficam onde estão.",
              "Só o anelar viaja: da 2ª casa da 3ª corda para a 3ª casa da 5ª corda.",
              "Para voltar ao Lá menor, o anelar faz o caminho de volta.",
            ],
            recurso: { tipo: "acorde", nome: "C", casas: [-1, 3, 2, 0, 1, 0], dedos: [0, 3, 2, 0, 1, 0], anterior: { nome: "Am", casas: [-1, 0, 2, 2, 1, 0], dedos: [0, 0, 2, 3, 1, 0] } },
            origem: origemViolao,
            exercicio: {
              tipo: "ordenar",
              enunciado: "Coloque os passos da troca de Lá menor para Dó na ordem em que acontecem.",
              itens: [
                op("montar", "Monte o Lá menor"),
                op("levantar", "Levante só o anelar, sem tirar o indicador e o médio"),
                op("levar", "Apoie o anelar na 3ª casa da 5ª corda"),
                op("tocar", "Toque o Dó a partir da 5ª corda"),
              ],
              gabarito: ["montar", "levantar", "levar", "tocar"],
              feedbackCorreto: "Perfeito: do Lá menor, só o anelar sobe e desce no lugar novo, e o Dó soa.",
              feedbackIncorreto: "Siga o movimento da mão: você começa no Lá menor, levanta só o anelar, apoia ele na 3ª casa da 5ª corda e então toca o Dó.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Na troca de Lá menor para Dó, quais dedos ficam no lugar?',
                opcoes: [op("a", 'O indicador e o médio'), op("b", 'O anelar e o médio'), op("c", 'Nenhum: todos mudam')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: indicador e médio são a âncora; só o anelar viaja.',
                feedbackIncorreto: 'Compare os dois diagramas: só um dos números muda de lugar.',
              },
            ],
            pratica: {
              tarefa: "Alterne Lá menor e Dó contando até 4 em cada acorde, devagar. Pare quando a troca sair sem você olhar para a mão.",
              minutos: 4,
              dica: "Pense no anelar como o único dedo que viaja: o indicador e o médio são a âncora.",
            },
          },
          {
            titulo: "Ritmo: batida para baixo e para cima",
            objetivo: "Tocar uma batida simples, para baixo e para cima, em quatro tempos.",
            conceito: "A batida marca o pulso da música e é feita pela mão que toca as cordas, perto da boca do violão. Na batida mais simples, essa mão desce em cada tempo e sobe entre eles, sem parar, como um pêndulo. Um compasso é um grupo de 4 tempos: tocar 8 compassos é contar de 1 a 4 oito vezes.",
            exemploTipo: "demonstracao",
            exemplo: "Ouça a batida com o Lá menor e conte junto: 1 e 2 e 3 e 4 e. No número, a mão desce (↓); no “e”, a mão sobe (↑).",
            recurso: { tipo: "acorde", nome: "Am", casas: [-1, 0, 2, 2, 1, 0], dedos: [0, 0, 2, 3, 1, 0], batida: true },
            passos: [
              "Conte 1, 2, 3, 4 em voz alta, num ritmo lento.",
              "↓ Desça a mão em cada número, passando pelas cordas.",
              "↑ Suba a mão em cada “e”, mais leve.",
              "Mantenha o braço balançando, mesmo se errar uma corda.",
            ],
            origem: origemViolao,
            exercicio: {
              tipo: "verdadeiro_falso",
              enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
              afirmacao: "Quando a mão erra a batida, o certo é parar o braço e recomeçar do zero.",
              justificativas: [
                op("pendulo", "O braço continua balançando, como um pêndulo, para não perder o tempo"),
                op("forca", "Parar ajuda a tocar cada corda com mais força"),
                op("depois", "O ritmo só importa depois que os acordes estão perfeitos"),
              ],
              gabarito: ["falso", "pendulo"],
              feedbackCorreto: "Isso: o braço não para. Errar uma corda passa; perder o tempo atrapalha a música inteira.",
              feedbackIncorreto: "É falsa: o braço segue balançando como um pêndulo. Parar faz você perder o tempo da música.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: 'Complete com o número de tempos.',
                trecho: 'Um compasso tem ___ tempos.',
                trechoTipo: "frase",
                gabarito: ['4', 'quatro'],
                feedbackCorreto: 'Isso: um compasso tem 4 tempos, e 8 compassos são 8 contagens de 1 a 4.',
                feedbackIncorreto: 'É quanto você conta antes de recomeçar a contagem da batida.',
              },
            ],
            pratica: {
              tarefa: "Com o Lá menor montado, faça a batida para baixo e para cima por 8 compassos (conte de 1 a 4 oito vezes), em voz alta.",
              minutos: 3,
              dica: "Ouça a batida no exemplo e toque junto. Devagar e no tempo vale mais do que rápido e atropelado.",
            },
          },
        ],
      },
      {
        titulo: trechos[2],
        licoes: [
          {
            titulo: "Revisão: Lá menor, Dó e a batida",
            objetivo: "Juntar os dois acordes e a batida numa sequência curta.",
            conceito: "Agora você junta tudo: o Lá menor, o Dó e a batida. Uma sequência comum é Am, Am, C, C: cada nome é um compasso de 4 tempos, então são dois compassos (8 tempos) de cada acorde, sem parar o braço.",
            exemploTipo: "demonstracao",
            exemplo: "Conte de 1 a 4 duas vezes no Lá menor e mais duas no Dó, repetindo. Na troca, o anelar sai no último “e”, para o Dó soar já no tempo 1. Ouça a batida no Dó.",
            recurso: { tipo: "acorde", nome: "C", casas: [-1, 3, 2, 0, 1, 0], dedos: [0, 3, 2, 0, 1, 0], batida: true, anterior: { nome: "Am", casas: [-1, 0, 2, 2, 1, 0], dedos: [0, 0, 2, 3, 1, 0] } },
            origem: origemViolao,
            exercicio: {
              tipo: "multipla_escolha",
              enunciado: "Na troca de Lá menor para Dó, qual dedo muda de lugar?",
              opcoes: [op("a", "O anelar"), op("b", "O indicador"), op("c", "O médio")],
              gabarito: ["a"],
              feedbackCorreto: "Isso: só o anelar viaja, da 3ª corda para a 3ª casa da 5ª corda.",
              feedbackIncorreto: "O indicador e o médio ficam parados nos dois acordes. Quem muda é o anelar.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: "Complete com o nome do dedo.",
                trecho: "Nos diagramas de acorde, o número 1 indica o dedo ___.",
                trechoTipo: "frase",
                gabarito: ["indicador"],
                feedbackCorreto: "Certo: 1 é o indicador, 2 o médio, 3 o anelar e 4 o mínimo.",
                feedbackIncorreto: "Lembre da legenda do diagrama: os números contam os dedos a partir do que fica ao lado do polegar.",
              },
            ],
            pratica: {
              tarefa: "Toque a sequência Am, Am, C, C por 2 minutos, com a batida para baixo e para cima.",
              minutos: 2,
            },
          },
          {
            titulo: "Explique a troca com suas palavras",
            objetivo: "Explicar como trocar de acorde sem perder o ritmo.",
            conceito: "Explicar o que você faz ajuda a fixar o movimento. Uma boa explicação diz quais dedos servem de âncora, qual dedo se move e o que acontece com o braço da batida.",
            exemplo: "Veja uma boa explicação de outro movimento, a batida: “Eu conto 1 e 2 e 3 e 4 e. No número, a mão desce; no ‘e’, ela sobe. O braço não para nem quando eu erro uma corda.”",
            origem: origemViolao,
            exercicio: {
              tipo: "aberta",
              enunciado: "Explique, em duas ou três frases, como você troca do Lá menor para o Dó sem parar a batida.",
              minimo: 40,
              gabarito: [
                "anelar|dedo 3",
                "indicador|medio|dedo 1|dedo 2|ficam|fica|parad|ancora|no lugar",
                "nao para|nao paro|nunca para|nunca paro|sem parar|continu|segue|seguindo|mantem|manter|mantenho|balanc|pendulo|no tempo",
              ],
              criterios: ["Diz que o anelar é o dedo que se move", "Diz quais dedos ficam no lugar", "Diz que a batida não para (o braço segue no tempo)"],
              modelo: "Eu deixo o indicador e o médio no lugar, porque eles são iguais nos dois acordes, e só levo o anelar para a 3ª casa da 5ª corda. Enquanto isso, o braço da batida continua balançando, para o Dó entrar no tempo certo.",
              feedbackCorreto: "Ótima explicação: âncora, dedo que viaja e a batida que não para.",
              feedbackIncorreto: "Faltou alguma parte: diga quais dedos ficam, qual dedo se move e o que acontece com a batida.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Por que vale explicar um movimento com as suas palavras?',
                opcoes: [op("a", 'Porque explicar ajuda a fixar o movimento'), op("b", 'Para decorar a ordem das cordas'), op("c", 'Porque assim o violão fica afinado')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: quem explica entende o que faz e repete o acerto.',
                feedbackIncorreto: 'Releia o conceito: o que explicar faz com o que você aprendeu?',
              },
            ],
          },
        ],
      },
    ],
  },
};

const origemIngles = origem("inglês para viagem");
const falaEn = (texto: string, traducao: string) => ({ texto, idioma: "en-US", traducao });
const ingles: Demo = {
  chave: "ingles",
  reconhecer: (objetivo) =>
    /\b(?:ingl[eê]s|english)\b/i.test(objetivo) && !/entrevista|neg[oó]cio|business|trabalho|profissional|reuni[aã]o/i.test(objetivo),
  plano: {
    titulo: "Inglês para viagem",
    objetivo: "Conversar em inglês nas situações mais comuns de uma viagem.",
    origem: origemIngles,
    fluxos: [
      {
        titulo: trechos[0],
        licoes: [
          {
            titulo: "Cumprimentar e se apresentar",
            objetivo: "Cumprimentar alguém, dizer seu nome, de onde você é e por que veio (até na imigração do aeroporto).",
            conceito: "Para começar uma conversa em inglês, três frases curtas resolvem: um cumprimento, seu nome e de onde você vem. “Hello” serve em quase toda situação; “Nice to meet you” mostra simpatia ao conhecer alguém. Na imigração do aeroporto, diga também por que veio: “I'm here on vacation” (estou aqui de férias).",
            exemplo: "Na recepção de um hotel: “Hello! I'm Ana. I'm from Brazil.” A pessoa responde: “Nice to meet you, Ana!”",
            falas: [
              falaEn("Hello! I'm Ana.", "Olá! Eu sou a Ana."),
              falaEn("I'm from Brazil.", "Eu sou do Brasil."),
              falaEn("Nice to meet you!", "Prazer em conhecer você!"),
              falaEn("I'm here on vacation.", "Estou aqui de férias."),
              falaEn("I'm staying for ten days.", "Vou ficar dez dias."),
            ],
            origem: origemIngles,
            exercicio: {
              tipo: "associar",
              enunciado: "Ligue cada frase à tradução.",
              esquerda: [op("hello", "Hello!"), op("from", "I'm from Brazil."), op("nice", "Nice to meet you!")],
              direita: [op("ola", "Olá!"), op("brasil", "Eu sou do Brasil."), op("prazer", "Prazer em conhecer você!")],
              gabarito: ["hello=ola", "from=brasil", "nice=prazer"],
              feedbackCorreto: "Isso! Com essas três frases você já começa uma conversa.",
              feedbackIncorreto: "Ouça as frases do exemplo de novo: “Hello” é olá, “I'm from” diz de onde você é e “Nice to meet you” é prazer em conhecer.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: "Na imigração, o agente pergunta por que você veio. O que você responde?",
                opcoes: [op("a", "I'm here on vacation."), op("b", "Nice to meet you!"), op("c", "How much is it?")],
                gabarito: ["a"],
                feedbackCorreto: "Isso: “I'm here on vacation” diz que você veio passear, de férias.",
                feedbackIncorreto: "O agente quer saber o motivo da viagem. Qual frase fala de férias?",
              },
            ],
          },
          {
            titulo: "Pedir informações na rua",
            objetivo: "Perguntar onde fica um lugar e entender a resposta.",
            conceito: "Para pedir ajuda, comece com “Excuse me” (com licença) e pergunte “Where is…?” (onde fica…?). Na resposta, preste atenção em “next to” (ao lado de), “in front of” (em frente a) e “far from” (longe de). No fim, “Thank you!” agradece.",
            exemplo: "“Excuse me, where is the train station?” — “It's on the next corner.” — “Thank you!”",
            falas: [
              falaEn("Excuse me, where is the train station?", "Com licença, onde fica a estação de trem?"),
              falaEn("It's on the next corner.", "Fica na próxima esquina."),
              falaEn("It's next to the hotel.", "Fica ao lado do hotel."),
              falaEn("It's in front of the bank.", "Fica em frente ao banco."),
              falaEn("It's far from here.", "Fica longe daqui."),
              falaEn("Thank you!", "Obrigado!"),
            ],
            origem: origemIngles,
            exercicio: {
              tipo: "lacuna",
              enunciado: "Complete a pergunta com a palavra que significa “onde”.",
              trecho: "Excuse me, ___ is the museum?",
              trechoTipo: "frase",
              gabarito: ["where"],
              // Em outro idioma, a grafia é a lição: "were" não vale por "where".
              exata: true,
              feedbackCorreto: "Isso: “Where is the museum?” pergunta onde fica o museu.",
              feedbackIncorreto: "É a palavra que pergunta por um lugar, o “onde” do inglês. Começa com “wh”, como “what” e “who”.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: "Ouça a resposta e escolha o que ela quer dizer.",
                fala: { texto: "It's next to the bank.", idioma: "en-US" },
                opcoes: [op("a", "Fica ao lado do banco."), op("b", "Fica em frente ao banco."), op("c", "Fica longe do banco.")],
                gabarito: ["a"],
                feedbackCorreto: "Isso: “next to” quer dizer ao lado de.",
                feedbackIncorreto: "A frase é “It's next to the bank”: “next to” quer dizer ao lado de.",
              },
            ],
          },
        ],
      },
      {
        titulo: trechos[1],
        licoes: [
          {
            titulo: "No hotel: fazer o check-in",
            objetivo: "Fazer o check-in com frases simples.",
            conceito: "No check-in, a conversa segue uma ordem: você cumprimenta (“Good evening!”), diz que tem uma reserva (“I have a reservation.”), mostra o documento (“Here's my passport.”) e recebe a chave. Saber a ordem ajuda a prever o que a pessoa vai dizer depois, como “What's your name?” (qual é o seu nome?).",
            exemplo: "“Good evening! I have a reservation.” — “What's your name?” — “Ana Souza. Here's my passport.” — “Here's your key. Your room is 204.”",
            falas: [
              falaEn("Good evening! I have a reservation.", "Boa noite! Eu tenho uma reserva."),
              falaEn("What's your name?", "Qual é o seu nome?"),
              falaEn("Here's my passport.", "Aqui está meu passaporte."),
              falaEn("Thank you for the key!", "Obrigada pela chave!"),
            ],
            origem: origemIngles,
            exercicio: {
              tipo: "ordenar",
              enunciado: "Coloque as falas do check-in na ordem da conversa.",
              itens: [
                op("oi", "Good evening!"),
                op("reserva", "I have a reservation."),
                op("passaporte", "Here's my passport."),
                op("chave", "Thank you for the key!"),
              ],
              gabarito: ["oi", "reserva", "passaporte", "chave"],
              feedbackCorreto: "Perfeito: cumprimento, reserva, documento e o agradecimento pela chave.",
              feedbackIncorreto: "Pense na conversa real: primeiro você cumprimenta, depois fala da reserva, mostra o passaporte e só então recebe a chave.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: "Ouça o que a recepcionista pergunta e escolha a melhor resposta.",
                fala: { texto: "What's your name?", idioma: "en-US" },
                opcoes: [op("a", "Ana Souza. Here's my passport."), op("b", "It's fifteen dollars."), op("c", "It's next to the hotel.")],
                gabarito: ["a"],
                feedbackCorreto: "Isso: ela perguntou o seu nome (“What's your name?”), e você já mostra o passaporte.",
                feedbackIncorreto: "Ouça de novo: “name” é nome. Qual resposta diz quem você é?",
              },
            ],
          },
          {
            titulo: "Números e preços",
            objetivo: "Entender preços falados em inglês.",
            conceito: "Primeiro, os números de 1 a 10: one, two, three, four, five, six, seven, eight, nine, ten. Os de 13 a 19 terminam em “‑teen” (thirteen, fifteen) e as dezenas terminam em “‑ty” (thirty, fifty). A diferença está no fim da palavra: fifteen é 15 e fifty é 50.",
            exemplo: "“How much is it?” — “It's fifteen dollars.” São quinze dólares, não cinquenta: o “‑teen” no fim indica a casa dos dez.",
            falas: [
              falaEn("One, two, three, four, five, six, seven, eight, nine, ten.", "Um, dois, três, quatro, cinco, seis, sete, oito, nove, dez."),
              falaEn("How much is it?", "Quanto custa?"),
              falaEn("It's fifteen dollars.", "Custa quinze dólares."),
              falaEn("It's fifty dollars.", "Custa cinquenta dólares."),
              falaEn("How much is the coffee?", "Quanto custa o café?"),
            ],
            origem: origemIngles,
            exercicio: {
              tipo: "multipla_escolha",
              enunciado: "Ouça o preço e escolha o valor.",
              fala: { texto: "It's thirteen dollars.", idioma: "en-US" },
              opcoes: [op("a", "13 dólares"), op("b", "30 dólares"), op("c", "3 dólares")],
              gabarito: ["a"],
              feedbackCorreto: "Isso: “thirteen” termina em “‑teen”, então é 13.",
              feedbackIncorreto: "Ouça de novo o fim da palavra: “‑teen” é a casa dos dez (13 a 19); “‑ty” são as dezenas (30, 40…).",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: "Complete a pergunta para saber o preço do café.",
                trecho: "How ___ is the coffee?",
                trechoTipo: "frase",
                gabarito: ["much"],
                exata: true,
                feedbackCorreto: "Isso: “How much is…?” pergunta o preço de qualquer coisa.",
                feedbackIncorreto: "É a pergunta de preço que você ouviu nesta lição, com a palavra que quer dizer “muito”.",
              },
            ],
            pratica: {
              tarefa: "Diga em voz alta, devagar, estes preços em inglês. Repita até cada um soar natural.",
              minutos: 2,
              passos: ["Fifteen dollars (15)", "Fifty dollars (50)", "Thirteen dollars (13)", "Thirty dollars (30)"],
              dica: "Em “fifteen”, a força fica no fim: fif‑TEEN. Em “fifty”, fica no começo: FIF‑ty.",
            },
          },
        ],
      },
      {
        titulo: trechos[2],
        licoes: [
          {
            titulo: "Revisão: um dia de viagem",
            objetivo: "Juntar cumprimentos, informações e preços numa conversa.",
            conceito: "Num dia de viagem você junta tudo: cumprimentar, pedir informações e entender preços. Ouça com atenção o fim das palavras e, se não entender, peça para repetir: “Sorry, can you repeat?”",
            exemplo: "“Excuse me, where is the bus stop?” — “It's next to the hotel.” — “Thank you! How much is the ticket?” — “It's fifteen dollars.”",
            falas: [
              falaEn("Where is the bus stop?", "Onde fica o ponto de ônibus?"),
              falaEn("How much is the ticket?", "Quanto custa a passagem?"),
              falaEn("Sorry, can you repeat?", "Desculpe, pode repetir?"),
            ],
            origem: origemIngles,
            exercicio: {
              tipo: "verdadeiro_falso",
              enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
              afirmacao: "“Fifty dollars” e “fifteen dollars” são o mesmo preço.",
              justificativas: [
                op("teen", "“Fifteen” termina em “‑teen” e é 15; “fifty” termina em “‑ty” e é 50"),
                op("igual", "As duas palavras começam com “fif”, então valem o mesmo"),
                op("moeda", "Só muda a moeda, não o valor"),
              ],
              gabarito: ["falso", "teen"],
              feedbackCorreto: "Isso: o fim da palavra muda tudo. 15 é “fifteen” e 50 é “fifty”.",
              feedbackIncorreto: "É falsa: “fifteen” (15) termina em “‑teen” e “fifty” (50) termina em “‑ty”.",
            },
            extras: [
              {
                tipo: "ordenar",
                enunciado: "Coloque a conversa no ponto de ônibus na ordem.",
                itens: [
                  op("onde", "Excuse me, where is the bus stop?"),
                  op("perto", "It's next to the hotel."),
                  op("preco", "Thank you! How much is the ticket?"),
                  op("valor", "It's fifteen dollars."),
                ],
                gabarito: ["onde", "perto", "preco", "valor"],
                feedbackCorreto: "Isso: pergunta, resposta, agradecimento e preço, como numa conversa de verdade.",
                feedbackIncorreto: "Pense na conversa: primeiro você pede licença e pergunta onde fica; depois vêm a resposta, o agradecimento e a pergunta do preço.",
              },
              {
                tipo: "lacuna",
                enunciado: "Você não entendeu o preço. Complete o pedido para a pessoa repetir.",
                trecho: "Sorry, can you ___?",
                trechoTipo: "frase",
                gabarito: ["repeat"],
                exata: true,
                feedbackCorreto: "Isso: “Sorry, can you repeat?” salva qualquer conversa.",
                feedbackIncorreto: "É o verbo “repetir” em inglês, que apareceu no conceito desta lição. Ele se parece com o português.",
              },
            ],
          },
          {
            titulo: "Pedir comida no restaurante",
            objetivo: "Fazer um pedido educado no restaurante.",
            conceito: "Para pedir, use “I would like…” ou a forma curta “I'd like…” (eu gostaria de…), seguida do prato, e termine com “please”. É educado e funciona em qualquer lugar.",
            exemplo: "“I'd like a sandwich and an orange juice, please.” Para pedir a conta: “Can I have the check, please?”",
            falas: [
              falaEn("I'd like a sandwich, please.", "Eu gostaria de um sanduíche, por favor."),
              falaEn("Can I have the check, please?", "Pode me trazer a conta, por favor?"),
            ],
            origem: origemIngles,
            exercicio: {
              tipo: "aberta",
              enunciado: "Escreva em inglês como você pediria um café e um pão de queijo, de um jeito educado.",
              minimo: 15,
              gabarito: ["i'd like|i would like|can i have|could i have|may i have", "please", "coffee"],
              criterios: ["Usa uma forma educada de pedir (I'd like, Can I have…)", "Termina com “please”", "Pede o café (coffee)"],
              modelo: "I'd like a coffee and a cheese bread, please.",
              feedbackCorreto: "Pedido perfeito: educado, claro e com “please”.",
              feedbackIncorreto: "Quase: use “I'd like…” ou “Can I have…”, diga o que quer (coffee) e termine com “please”.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Ouça o pedido e escolha o que a pessoa quer.',
                fala: { texto: 'Can I have the check, please?', idioma: "en-US" },
                opcoes: [op("a", 'A conta'), op("b", 'Um café'), op("c", 'Um sanduíche')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: “check” é a conta do restaurante.',
                feedbackIncorreto: 'Ouça de novo: a palavra-chave é “check”. Ela apareceu no exemplo desta lição.',
              },
            ],
          },
        ],
      },
    ],
  },
};

const origemCulinaria = origem("culinária básica");
const culinaria: Demo = {
  chave: "culinaria",
  reconhecer: (objetivo) => /\b(?:culin[aá]ri\w*|cozinh\w*|receitas?|gastronomia|cozinhar)\b/i.test(objetivo),
  plano: {
    titulo: "Culinária: receitas básicas",
    objetivo: "Cozinhar receitas simples com segurança e no ponto certo.",
    origem: origemCulinaria,
    fluxos: [
      {
        titulo: trechos[0],
        licoes: [
          {
            titulo: "Organizar antes de cozinhar",
            objetivo: "Preparar a bancada antes de acender o fogo.",
            conceito: "Os cozinheiros chamam de mise en place deixar tudo pronto antes de ligar o fogo: ingredientes lavados, medidos e cortados, e os utensílios à mão. Assim nada queima enquanto você procura um tempero.",
            exemplo: "Para um arroz, separe 1 xícara de arroz, 2 de água, meia cebola picada, 1 dente de alho e sal antes de acender a boca do fogão.",
            origem: origemCulinaria,
            exercicio: {
              tipo: "ordenar",
              enunciado: "Coloque o começo de uma receita na ordem certa.",
              itens: [
                op("ler", "Ler a receita inteira"),
                op("lavar", "Lavar as mãos e os ingredientes"),
                op("medir", "Medir e cortar os ingredientes"),
                op("fogo", "Acender o fogo"),
              ],
              gabarito: ["ler", "lavar", "medir", "fogo"],
              feedbackCorreto: "Isso: entender a receita, lavar, medir e cortar. Só então o fogo.",
              feedbackIncorreto: "O fogo é sempre o último: primeiro leia a receita, lave as mãos e os ingredientes, depois meça e corte.",
            },
            extras: [
              {
                tipo: "verdadeiro_falso",
                enunciado: 'A frase é verdadeira ou falsa? Escolha também o porquê.',
                afirmacao: 'Mise en place é deixar tudo pronto antes de ligar o fogo.',
                justificativas: [
                  op("certa", 'Assim nada queima enquanto você procura um ingrediente'),
                  op("e1", 'É o nome de um prato francês'),
                  op("e2", 'Serve só para cozinhas de restaurante'),
                ],
                gabarito: ['verdadeiro', "certa"],
                feedbackCorreto: 'Isso: com tudo à mão, a panela não fica esperando.',
                feedbackIncorreto: 'Releia o conceito: o que acontece se você procura o tempero com a panela no fogo?',
              },
            ],
          },
          {
            titulo: "Cortes básicos de legumes",
            objetivo: "Reconhecer os cortes mais usados e quando usar cada um.",
            conceito: "Cada corte tem um formato e um uso. A brunoise, em cubinhos bem pequenos, some no refogado; a julienne, em tiras finas, cozinha rápido e enfeita a salada; e as rodelas são o corte mais simples, para cenoura e abobrinha.",
            exemplo: "Uma cenoura em julienne vira palitos finos como fósforos; a mesma cenoura em brunoise vira cubinhos de uns 3 mm.",
            origem: origemCulinaria,
            exercicio: {
              tipo: "associar",
              enunciado: "Ligue cada corte ao formato dele.",
              esquerda: [op("brunoise", "Brunoise"), op("julienne", "Julienne"), op("rodelas", "Rodelas")],
              direita: [
                op("cubinhos", "Cubinhos bem pequenos, de uns 3 mm"),
                op("tiras", "Tiras finas, como palitos de fósforo"),
                op("discos", "Discos cortados na largura do legume"),
              ],
              gabarito: ["brunoise=cubinhos", "julienne=tiras", "rodelas=discos"],
              feedbackCorreto: "Isso! Brunoise são cubinhos, julienne são tiras e rodelas são discos.",
              feedbackIncorreto: "Reveja o exemplo da cenoura: julienne são palitos finos, brunoise são cubinhos e rodelas são discos.",
            },
            extras: [
              {
                tipo: "verdadeiro_falso",
                enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
                afirmacao: "Uma faca sem fio é mais segura porque corta menos.",
                justificativas: [
                  op("escorrega", "A faca cega escorrega e exige mais força, o que causa acidentes"),
                  op("devagar", "A faca cega obriga a cortar devagar, então é mais segura"),
                  op("igual", "O fio da faca não faz diferença na segurança"),
                ],
                gabarito: ["falso", "escorrega"],
                feedbackCorreto: "Isso: a faca afiada corta com pouca força e não escorrega. Acidente acontece com faca cega.",
                feedbackIncorreto: "É falsa: a faca sem fio escorrega no alimento e exige força, e é aí que o corte acontece no dedo.",
              },
            ],
          },
        ],
      },
      {
        titulo: trechos[1],
        licoes: [
          {
            titulo: "Arroz soltinho",
            objetivo: "Cozinhar arroz branco soltinho.",
            conceito: "O arroz fica soltinho quando cada grão é envolvido em gordura antes de cozinhar e quando você não mexe enquanto ele cozinha. A proporção comum é de 2 partes de água para 1 de arroz branco.",
            exemploTipo: "demonstracao",
            exemplo: "Siga o passo a passo para 1 xícara de arroz, que rende umas 3 porções.",
            passos: [
              "Refogue meia cebola picada e 1 dente de alho em 1 colher de óleo.",
              "Junte 1 xícara de arroz e mexa por 1 minuto, até os grãos ficarem brilhantes.",
              "Acrescente 2 xícaras de água quente e sal a gosto.",
              "Tampe deixando uma fresta e cozinhe em fogo baixo por cerca de 15 minutos, sem mexer.",
              "Desligue quando a água secar e deixe descansar tampado por 5 minutos.",
            ],
            origem: origemCulinaria,
            exercicio: {
              tipo: "lacuna",
              enunciado: "Complete a proporção de água para arroz branco.",
              trecho: "1 xícara de arroz = ___ xícaras de água",
              trechoTipo: "formula",
              gabarito: ["2", "duas", "dois"],
              feedbackCorreto: "Isso: o dobro de água. É a proporção que deixa o grão macio e solto.",
              feedbackIncorreto: "Lembre da regra do conceito: a água é o dobro do arroz. Quanto é o dobro de 1 xícara?",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Por que refogar o arroz antes de pôr a água?',
                opcoes: [op("a", 'A gordura envolve os grãos, e eles cozinham soltos'), op("b", 'Para o arroz cozinhar mais rápido'), op("c", 'Para a água ferver mais depressa')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: o grão envolvido em gordura não gruda no outro.',
                feedbackIncorreto: 'O conceito diz o que deixa cada grão separado. O que envolve o grão no refogado?',
              },
            ],
            pratica: {
              tarefa: "Faça 1 xícara de arroz seguindo o passo a passo. Use o cronômetro para o tempo de cozimento.",
              minutos: 15,
              dica: "Resista à vontade de mexer: mexer solta amido e deixa o arroz empapado.",
            },
          },
          {
            titulo: "O ponto do ovo cozido",
            objetivo: "Escolher o tempo de cozimento do ovo pelo ponto da gema.",
            conceito: "O tempo na água fervente decide a gema: quanto mais tempo, mais firme ela fica. Comece a contar quando a água voltar a ferver e, no fim, passe o ovo para água fria para parar o cozimento.",
            exemplo: "Com ovos grandes, saídos da geladeira: 6 minutos dão gema mole, 8 minutos dão gema cremosa e 10 minutos dão gema firme.",
            recurso: {
              tipo: "linha_do_tempo",
              eventos: [
                { quando: "6 min", texto: "Gema mole, clara firme" },
                { quando: "8 min", texto: "Gema cremosa" },
                { quando: "10 min", texto: "Gema firme, boa para salada" },
              ],
            },
            origem: origemCulinaria,
            exercicio: {
              tipo: "multipla_escolha",
              enunciado: "Você quer o ovo com a gema cremosa. Quanto tempo na água fervente?",
              opcoes: [op("a", "8 minutos"), op("b", "4 minutos"), op("c", "15 minutos")],
              gabarito: ["a"],
              feedbackCorreto: "Isso: 8 minutos deixam a gema cremosa, nem mole nem firme.",
              feedbackIncorreto: "Olhe a linha do tempo: 6 minutos é gema mole, 8 é cremosa e 10 é firme.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: 'Complete o passo final.',
                trecho: 'Para parar o cozimento, passe o ovo para a água ___.',
                trechoTipo: "frase",
                gabarito: ['fria', 'gelada'],
                feedbackCorreto: 'Isso: a água fria para o cozimento na hora, e a gema fica no ponto.',
                feedbackIncorreto: 'É o contrário da água fervente: ela esfria o ovo na hora.',
              },
            ],
            pratica: {
              tarefa: "Cozinhe um ovo no ponto que você prefere. Use o cronômetro e, no fim, passe o ovo para água fria.",
              minutos: 8,
            },
          },
        ],
      },
      {
        titulo: trechos[2],
        licoes: [
          {
            titulo: "Temperar na medida",
            objetivo: "Temperar aos poucos e no momento certo.",
            conceito: "Tempere aos poucos e prove no caminho: é fácil pôr mais sal e quase impossível tirar. Ervas frescas, como salsinha, entram no fim, para não perderem o aroma, e um pouco de limão realça o sabor sem precisar de mais sal.",
            exemplo: "No feijão, ponha metade do sal no começo, prove depois de 10 minutos e ajuste. A salsinha picada entra só quando você desliga o fogo.",
            origem: origemCulinaria,
            exercicio: {
              tipo: "verdadeiro_falso",
              enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
              afirmacao: "Ervas frescas, como salsinha e cebolinha, devem entrar no começo do cozimento.",
              justificativas: [
                op("aroma", "Ervas frescas perdem o aroma no calor longo, por isso entram no fim"),
                op("sal", "As ervas substituem todo o sal da receita"),
                op("cor", "No começo elas ficam mais verdes"),
              ],
              gabarito: ["falso", "aroma"],
              feedbackCorreto: "Isso: erva fresca vai no fim, para o aroma chegar ao prato.",
              feedbackIncorreto: "É falsa: o calor longo apaga o aroma das ervas frescas. Elas entram no fim.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Quando a salsinha fresca entra no prato?',
                opcoes: [op("a", 'No fim, quando você desliga o fogo'), op("b", 'No começo, junto com o alho'), op("c", 'Na água do cozimento')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: no fim, ela guarda o aroma.',
                feedbackIncorreto: 'Ervas frescas perdem o aroma no fogo. Quando ela fica menos tempo no calor?',
              },
            ],
          },
          {
            titulo: "Revisão: planejar um almoço simples",
            objetivo: "Planejar a ordem de preparo de um almoço com três itens.",
            conceito: "Um almoço simples junta o que você viu: organizar antes, cortar no formato certo, controlar o tempo e temperar provando. A ordem certa é a que faz tudo ficar pronto junto.",
            exemplo: "Arroz, ovo cozido e salada: comece pelo arroz, que demora mais. Enquanto ele cozinha, cozinhe os ovos e corte a salada em julienne.",
            origem: origemCulinaria,
            exercicio: {
              tipo: "aberta",
              enunciado: "Descreva, em duas ou três frases, a ordem em que você prepararia arroz, ovo cozido e uma salada, e por quê.",
              minimo: 40,
              gabarito: ["arroz", "ovo", "salada|legume|alface|tomate|cenoura", "demora|mais tempo|primeiro|enquanto|tempo|antes"],
              criterios: ["Fala do arroz", "Fala do ovo", "Fala da salada", "Explica a ordem pelo tempo de cada preparo"],
              modelo: "Eu começaria pelo arroz, porque ele demora mais. Enquanto ele cozinha, coloco os ovos para ferver por 8 minutos e corto a salada, que fica por último para não murchar.",
              feedbackCorreto: "Ótimo plano: o que demora mais vem primeiro e o resto acontece enquanto isso.",
              feedbackIncorreto: "Faltou algo: cite os três preparos e explique a ordem pelo tempo de cada um (o arroz demora mais).",
            },
            extras: [
              {
                tipo: "ordenar",
                enunciado: 'Coloque o almoço na ordem que deixa tudo pronto junto.',
                itens: [
                  op("p1", 'Começar pelo arroz, que demora mais'),
                  op("p2", 'Enquanto o arroz cozinha, preparar os ovos e a salada'),
                  op("p3", 'Servir tudo junto'),
                ],
                gabarito: ["p1", "p2", "p3"],
                feedbackCorreto: 'Isso: o que demora mais começa primeiro, e o resto cabe no tempo dele.',
                feedbackIncorreto: 'Pense no que demora mais: ele começa primeiro.',
              },
            ],
          },
        ],
      },
    ],
  },
};

const origemHistoria = origem("história do Brasil");
const historia: Demo = {
  chave: "historia",
  reconhecer: (objetivo) =>
    /hist[oó]ria\s+(?:do\s+brasil|brasileira)|brasil\s+(?:col[oô]nia|imp[eé]rio|rep[uú]blica)|independ[eê]ncia\s+do\s+brasil|proclama[cç][aã]o\s+da\s+rep[uú]blica/i.test(objetivo),
  plano: {
    titulo: "História do Brasil: da Colônia à República",
    objetivo: "Entender os grandes marcos da história do Brasil, de 1500 a 1889.",
    origem: origemHistoria,
    fluxos: [
      {
        titulo: trechos[0],
        licoes: [
          {
            titulo: "Antes de 1500: os povos originários",
            objetivo: "Reconhecer que o território já era habitado por muitos povos indígenas.",
            conceito: "Quando a frota de Pedro Álvares Cabral chegou, em 1500, o território já era habitado por milhões de indígenas, de centenas de povos diferentes, como os tupis, os guaranis e os jês. Cada povo tinha língua, costumes e formas próprias de organização.",
            exemplo: "Muitas palavras do português do Brasil vêm do tupi, como “pipoca”, “mandioca” e “Ipiranga”.",
            origem: origemHistoria,
            exercicio: {
              tipo: "verdadeiro_falso",
              enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
              afirmacao: "Em 1500, o território que hoje é o Brasil era praticamente vazio.",
              justificativas: [
                op("povos", "Milhões de indígenas, de centenas de povos, já viviam aqui"),
                op("clima", "O clima impedia que pessoas vivessem na região"),
                op("cidades", "Os portugueses já tinham cidades no litoral"),
              ],
              gabarito: ["falso", "povos"],
              feedbackCorreto: "Isso: a história do território começa muito antes de 1500, com os povos originários.",
              feedbackIncorreto: "É falsa: milhões de indígenas, de centenas de povos, já viviam aqui quando Cabral chegou.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Qual destas palavras vem do tupi?',
                opcoes: [op("a", 'Mandioca'), op("b", 'Escola'), op("c", 'Janela')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: mandioca vem do tupi, como pipoca e Ipiranga.',
                feedbackIncorreto: 'O exemplo da lição cita palavras de origem tupi; uma delas está nas opções.',
              },
            ],
          },
          {
            titulo: "Colônia: o ciclo do açúcar",
            objetivo: "Explicar onde e como funcionava a economia do açúcar.",
            conceito: "Nos séculos XVI e XVII, o açúcar foi a principal riqueza da colônia. Os engenhos se concentraram no Nordeste, sobretudo em Pernambuco e na Bahia, e funcionavam com o trabalho forçado de africanos escravizados.",
            exemplo: "Um engenho reunia a plantação de cana, a moenda que espremia a cana, a casa-grande dos senhores e a senzala, onde viviam as pessoas escravizadas.",
            origem: origemHistoria,
            exercicio: {
              tipo: "multipla_escolha",
              enunciado: "Em que região se concentraram os engenhos de açúcar?",
              opcoes: [op("a", "No Nordeste, em Pernambuco e na Bahia"), op("b", "No Sul, no Rio Grande do Sul"), op("c", "Na Amazônia")],
              gabarito: ["a"],
              feedbackCorreto: "Isso: o clima e o solo do litoral nordestino favoreciam a cana.",
              feedbackIncorreto: "Os engenhos ficaram no Nordeste, principalmente em Pernambuco e na Bahia.",
            },
            extras: [
              {
                tipo: "verdadeiro_falso",
                enunciado: 'A frase é verdadeira ou falsa? Escolha também o porquê.',
                afirmacao: 'Os engenhos de açúcar funcionavam com trabalho livre e assalariado.',
                justificativas: [
                  op("certa", 'Funcionavam com o trabalho forçado de africanos escravizados'),
                  op("e1", 'Os engenhos não precisavam de trabalhadores'),
                  op("e2", 'Só os senhores trabalhavam na moenda'),
                ],
                gabarito: ['falso', "certa"],
                feedbackCorreto: 'Isso: a riqueza do açúcar dependia da escravidão.',
                feedbackIncorreto: 'Releia o conceito: quem trabalhava nos engenhos, e em que condição?',
              },
            ],
          },
        ],
      },
      {
        titulo: trechos[1],
        licoes: [
          {
            titulo: "Linha do tempo: da chegada à República",
            objetivo: "Ordenar os grandes marcos de 1500 a 1889.",
            conceito: "Uma linha do tempo ajuda a ver o que causou o quê. A vinda da família real, em 1808, fez do Rio de Janeiro a sede do governo português e preparou o caminho para a Independência, em 1822.",
            exemplo: "Leia a linha do tempo de cima para baixo: cada marco muda o que vem depois.",
            recurso: {
              tipo: "linha_do_tempo",
              eventos: [
                { quando: "1500", texto: "Chegada da frota de Cabral" },
                { quando: "1808", texto: "A família real portuguesa chega ao Rio de Janeiro" },
                { quando: "1822", texto: "Independência do Brasil" },
                { quando: "1888", texto: "A Lei Áurea abole a escravidão" },
                { quando: "1889", texto: "Proclamação da República" },
              ],
            },
            origem: origemHistoria,
            exercicio: {
              tipo: "ordenar",
              enunciado: "Coloque os acontecimentos em ordem cronológica.",
              itens: [
                op("cabral", "Chegada da frota de Cabral"),
                op("familia", "Chegada da família real ao Rio"),
                op("independencia", "Independência do Brasil"),
                op("republica", "Proclamação da República"),
              ],
              gabarito: ["cabral", "familia", "independencia", "republica"],
              feedbackCorreto: "Perfeito: 1500, 1808, 1822 e 1889.",
              feedbackIncorreto: "Use a linha do tempo: 1500 (Cabral), 1808 (família real), 1822 (Independência) e 1889 (República).",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Qual acontecimento preparou o caminho para a Independência?',
                opcoes: [op("a", 'A vinda da família real, em 1808'), op("b", 'A Lei Áurea, em 1888'), op("c", 'A Proclamação da República, em 1889')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: com a corte no Rio, o Brasil ganhou peso e autonomia.',
                feedbackIncorreto: 'Procure o que veio antes de 1822 e fez do Rio a sede do governo.',
              },
            ],
          },
          {
            titulo: "Independência em 1822",
            objetivo: "Ligar personagens aos acontecimentos que marcaram.",
            conceito: "Em 7 de setembro de 1822, às margens do riacho Ipiranga, em São Paulo, Dom Pedro declarou o Brasil independente de Portugal. Ele se tornou o primeiro imperador, Dom Pedro I, e o Brasil virou um império.",
            exemplo: "Dom João, pai de Dom Pedro, tinha trazido a corte para o Rio em 1808. Quando voltou a Portugal, deixou o filho como príncipe regente, e foi ele quem declarou a Independência.",
            origem: origemHistoria,
            exercicio: {
              tipo: "associar",
              enunciado: "Ligue cada personagem ao que fez.",
              esquerda: [op("pedro", "Dom Pedro I"), op("joao", "Dom João (futuro D. João VI)"), op("isabel", "Princesa Isabel"), op("deodoro", "Deodoro da Fonseca")],
              direita: [
                op("independencia", "Declarou a Independência em 1822"),
                op("corte", "Trouxe a corte portuguesa para o Rio em 1808"),
                op("aurea", "Assinou a Lei Áurea em 1888"),
                op("republica", "Proclamou a República em 1889"),
              ],
              gabarito: ["pedro=independencia", "joao=corte", "isabel=aurea", "deodoro=republica"],
              feedbackCorreto: "Isso! Cada personagem ligado ao seu marco.",
              feedbackIncorreto: "Volte à linha do tempo: Dom João chega em 1808, Dom Pedro declara a Independência em 1822, Isabel assina a Lei Áurea em 1888 e Deodoro proclama a República em 1889.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: "Complete a frase que, segundo a tradição, Dom Pedro disse no Ipiranga.",
                trecho: "“Independência ou ___!”",
                trechoTipo: "citacao",
                gabarito: ["morte"],
                feedbackCorreto: "Isso: “Independência ou morte!”, o chamado Grito do Ipiranga.",
                feedbackIncorreto: "Lembre do Grito do Ipiranga, em 1822: a frase opõe a independência ao pior destino possível.",
              },
            ],
          },
        ],
      },
      {
        titulo: trechos[2],
        licoes: [
          {
            titulo: "Abolição e República",
            objetivo: "Situar a abolição da escravidão e a Proclamação da República.",
            conceito: "Depois de leis graduais, como a do Ventre Livre, de 1871, a Lei Áurea, de 13 de maio de 1888, aboliu a escravidão. O Brasil foi o último país das Américas a fazer isso. No ano seguinte, em 15 de novembro de 1889, o marechal Deodoro da Fonseca proclamou a República.",
            exemplo: "1888 e 1889 estão colados: a abolição desagradou grandes fazendeiros, que deixaram de apoiar o Império, e isso pesou na queda da monarquia.",
            origem: origemHistoria,
            exercicio: {
              tipo: "lacuna",
              enunciado: "Complete com o ano da Lei Áurea.",
              trecho: "A escravidão foi abolida no Brasil em ___, pela Lei Áurea.",
              trechoTipo: "frase",
              gabarito: ["1888"],
              feedbackCorreto: "Isso: 13 de maio de 1888.",
              feedbackIncorreto: "A Lei Áurea veio um ano antes da Proclamação da República, que foi em 1889.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: "O que aconteceu em 15 de novembro de 1889?",
                opcoes: [op("a", "A Proclamação da República"), op("b", "A Independência do Brasil"), op("c", "A chegada da família real")],
                gabarito: ["a"],
                feedbackCorreto: "Isso: Deodoro da Fonseca proclamou a República, e o Império acabou.",
                feedbackIncorreto: "Em 15 de novembro de 1889 foi proclamada a República. A Independência é de 1822 e a família real chegou em 1808.",
              },
            ],
          },
          {
            titulo: "Revisão: explique uma mudança",
            objetivo: "Explicar uma causa e uma consequência na história do Brasil.",
            conceito: "Explicar uma causa e uma consequência mostra que você entendeu a história, não só as datas. Uma boa explicação diz o que aconteceu, quem foi afetado e o que mudou depois.",
            exemplo: "“A vinda da família real, em 1808, fez do Rio a sede do governo e abriu os portos. Isso deu ao Brasil mais autonomia e ajudou a Independência, em 1822.”",
            origem: origemHistoria,
            exercicio: {
              tipo: "aberta",
              enunciado: "Explique, em duas ou três frases, por que a abolição, em 1888, ajudou a derrubar o Império em 1889.",
              minimo: 40,
              gabarito: [
                "abolicao|lei aurea|escravidao|escraviz|1888",
                "fazendeir|proprietari|elite|senhores|cafeicult",
                "apoio|deixaram|descontent|insatisf|desagrad|contra|perderam",
                "republica|imperio|monarquia|1889",
              ],
              criterios: [
                "Cita a abolição ou a Lei Áurea",
                "Fala dos grandes fazendeiros",
                "Diz que eles deixaram de apoiar o Império",
                "Liga isso à queda do Império ou à República",
              ],
              modelo: "A Lei Áurea acabou com a escravidão sem indenizar os fazendeiros. Insatisfeitos, muitos deixaram de apoiar o Império, e esse apoio que faltou pesou na Proclamação da República, em 1889.",
              feedbackCorreto: "Boa explicação: causa (a abolição), quem reagiu (os fazendeiros) e a consequência (a República).",
              feedbackIncorreto: "Faltou alguma ligação: diga quem ficou insatisfeito com a abolição e como isso enfraqueceu o Império.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: 'Complete com o ano.',
                trecho: 'A Independência do Brasil foi em ___.',
                trechoTipo: "frase",
                gabarito: ['1822'],
                feedbackCorreto: 'Isso: 1822, o ano do Grito do Ipiranga.',
                feedbackIncorreto: 'Foi 14 anos depois da chegada da família real, em 1808.',
              },
            ],
          },
        ],
      },
    ],
  },
};

const origemFracoes = origem("frações");
const fracoes: Demo = {
  chave: "fracoes",
  reconhecer: (objetivo) => /\bfra[cç](?:[aã]o|[oõ]es)\b/i.test(objetivo),
  plano: {
    titulo: "Frações: do inteiro à soma",
    objetivo: "Entender, comparar e somar frações.",
    origem: origemFracoes,
    fluxos: [
      {
        titulo: trechos[0],
        licoes: [
          {
            titulo: "O que o numerador e o denominador contam",
            objetivo: "Ler uma fração dizendo o que cada número conta.",
            conceito: "Uma fração mostra partes de um inteiro dividido em partes iguais. O número de baixo, o denominador, diz em quantas partes iguais o inteiro foi dividido. O número de cima, o numerador, diz quantas dessas partes estamos considerando.",
            exemplo: "Uma pizza foi cortada em 8 fatias iguais e você comeu 3. Você comeu 3/8 da pizza: 8 é o total de fatias iguais e 3 são as que você comeu.",
            recurso: { tipo: "fracao", numerador: 3, denominador: 8, rotulo: "3/8" },
            origem: origemFracoes,
            exercicio: {
              tipo: "multipla_escolha",
              enunciado: "Em 5/6, o que o número 6 indica?",
              opcoes: [
                op("a", "Em quantas partes iguais o inteiro foi dividido"),
                op("b", "Quantas partes foram escolhidas"),
                op("c", "Quantas partes sobraram"),
              ],
              gabarito: ["a"],
              feedbackCorreto: "Isso: o denominador, embaixo, conta o total de partes iguais.",
              feedbackIncorreto: "O 6 fica embaixo: é o denominador, o total de partes iguais. As escolhidas são as 5 de cima.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: "Uma barra foi dividida em 5 partes iguais e 2 foram pintadas. Complete a fração pintada.",
                trecho: "2/___",
                trechoTipo: "formula",
                gabarito: ["5"],
                feedbackCorreto: "Certo: 2 pintadas de 5 partes iguais, 2/5.",
                feedbackIncorreto: "O denominador conta todas as partes iguais da barra, pintadas ou não. Conte de novo.",
              },
            ],
          },
          {
            titulo: "Frações equivalentes",
            objetivo: "Reconhecer frações diferentes que valem a mesma quantidade.",
            conceito: "Frações equivalentes representam a mesma quantidade com números diferentes. Multiplicando o numerador e o denominador pelo mesmo número, o valor não muda: 1/2 = 2/4 = 3/6.",
            exemplo: "Se cada metade de uma barra for cortada ao meio, a barra passa a ter 4 partes e a metade vira 2 delas: 1/2 = 2/4.",
            recurso: { tipo: "fracao", numerador: 2, denominador: 4, rotulo: "2/4 = 1/2" },
            origem: origemFracoes,
            exercicio: {
              tipo: "associar",
              enunciado: "Ligue cada fração à sua equivalente.",
              esquerda: [op("meio", "1/2"), op("doisTercos", "2/3"), op("tresQuartos", "3/4")],
              direita: [op("tresSextos", "3/6"), op("quatroSextos", "4/6"), op("seisOitavos", "6/8")],
              gabarito: ["meio=tresSextos", "doisTercos=quatroSextos", "tresQuartos=seisOitavos"],
              feedbackCorreto: "Isso! Em cada par, numerador e denominador foram multiplicados pelo mesmo número.",
              feedbackIncorreto: "Procure o número que multiplica os dois termos: 1/2 × 3 = 3/6, 2/3 × 2 = 4/6 e 3/4 × 2 = 6/8.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: 'Complete a fração equivalente.',
                trecho: '1/3 = ___/6',
                trechoTipo: "frase",
                gabarito: ['2'],
                feedbackCorreto: 'Isso: 1/3 vezes 2 em cima e embaixo dá 2/6.',
                feedbackIncorreto: 'Multiplique o numerador e o denominador pelo mesmo número: 3 vezes quanto dá 6?',
              },
            ],
          },
        ],
      },
      {
        titulo: trechos[1],
        licoes: [
          {
            titulo: "Comparar frações com o mesmo denominador",
            objetivo: "Ordenar frações que têm o mesmo denominador.",
            conceito: "Quando o denominador é o mesmo, as partes têm o mesmo tamanho. Então é maior a fração com mais partes, ou seja, com o maior numerador.",
            exemplo: "Entre 2/7 e 5/7, as partes são sétimos nos dois casos. Cinco sétimos são mais que dois sétimos: 5/7 > 2/7.",
            origem: origemFracoes,
            exercicio: {
              tipo: "ordenar",
              enunciado: "Coloque as frações da menor para a maior.",
              itens: [op("um", "1/7"), op("tres", "3/7"), op("cinco", "5/7"), op("seis", "6/7")],
              gabarito: ["um", "tres", "cinco", "seis"],
              feedbackCorreto: "Perfeito: com o mesmo denominador, basta comparar os numeradores.",
              feedbackIncorreto: "Todas são sétimos. Compare só os numeradores: 1, 3, 5 e 6.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Qual é maior: 3/8 ou 5/8?',
                opcoes: [op("a", '5/8'), op("b", '3/8'), op("c", 'São iguais')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: oitavos dos dois lados, e 5 oitavos são mais que 3.',
                feedbackIncorreto: 'Com o mesmo denominador, as partes têm o mesmo tamanho. Quem tem mais partes?',
              },
            ],
          },
          {
            titulo: "Comparar frações com o mesmo numerador",
            objetivo: "Comparar frações que têm o mesmo numerador.",
            conceito: "Quando o numerador é o mesmo, compare o tamanho das partes. Quanto maior o denominador, mais partes o inteiro tem e menor é cada parte. Por isso 1/8 é menor que 1/4.",
            exemplo: "Dividir uma pizza em 8 fatias deixa cada fatia menor do que dividi-la em 4. Uma fatia de 8 (1/8) é menor que uma fatia de 4 (1/4).",
            recurso: { tipo: "fracao", numerador: 1, denominador: 8, rotulo: "1/8" },
            origem: origemFracoes,
            exercicio: {
              tipo: "verdadeiro_falso",
              enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
              afirmacao: "1/8 é maior que 1/4, porque 8 é maior que 4.",
              justificativas: [
                op("partes", "Com o mesmo numerador, quanto maior o denominador, menores são as partes"),
                op("numero", "O maior número de baixo sempre dá a maior fração"),
                op("iguais", "As duas frações valem o mesmo, porque o numerador é 1"),
              ],
              gabarito: ["falso", "partes"],
              feedbackCorreto: "Isso: oito partes são menores que quatro partes do mesmo inteiro. 1/8 < 1/4.",
              feedbackIncorreto: "É falsa: com o mesmo numerador, o denominador maior divide o inteiro em partes menores. 1/8 < 1/4.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Qual destas frações é a menor?',
                opcoes: [op("a", '1/10'), op("b", '1/5'), op("c", '1/2')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: dividido em 10, cada parte é a menor de todas.',
                feedbackIncorreto: 'Mesmo numerador: quanto mais partes o inteiro tem, menor é cada parte.',
              },
            ],
          },
        ],
      },
      {
        titulo: trechos[2],
        licoes: [
          {
            titulo: "Somar frações com o mesmo denominador",
            objetivo: "Somar frações que têm o mesmo denominador.",
            conceito: "Para somar frações com o mesmo denominador, some os numeradores e mantenha o denominador. As partes continuam do mesmo tamanho; você só junta mais delas.",
            exemplo: "2/9 + 5/9: as duas frações são nonos. Juntando 2 nonos com 5 nonos, ficam 7 nonos: 7/9.",
            origem: origemFracoes,
            exercicio: {
              tipo: "lacuna",
              enunciado: "Complete a soma.",
              trecho: "2/9 + 5/9 = ___/9",
              trechoTipo: "formula",
              gabarito: ["7"],
              feedbackCorreto: "Isso: 2 + 5 = 7, e o denominador continua 9.",
              feedbackIncorreto: "Com o mesmo denominador, some só os numeradores; o denominador continua 9.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: "Quanto é 3/10 + 4/10?",
                opcoes: [op("a", "7/10"), op("b", "7/20"), op("c", "12/10")],
                gabarito: ["a"],
                feedbackCorreto: "Certo: 3 + 4 = 7 décimos.",
                feedbackIncorreto: "Os décimos continuam décimos: some os numeradores (3 + 4 = 7) e mantenha o 10.",
              },
            ],
            pratica: {
              tarefa: "Pegue uma folha, dobre ao meio três vezes e abra: ela fica com 8 partes iguais. Pinte 3/8 e depois mais 2/8. Quanto da folha ficou pintado?",
              minutos: 5,
              passos: ["Dobre a folha ao meio três vezes.", "Abra e conte as 8 partes iguais.", "Pinte 3 partes, depois mais 2.", "Escreva a fração pintada."],
              dica: "Se as dobras não ficarem iguais, as partes não são oitavos. Capriche no vinco.",
            },
          },
          {
            titulo: "Revisão: explique uma soma de frações",
            objetivo: "Explicar com suas palavras por que a soma de frações funciona assim.",
            conceito: "Explicar a regra mostra que você entendeu, e não só decorou. Uma boa explicação fala do tamanho das partes (o denominador) e de quantas partes você juntou (os numeradores).",
            exemplo: "Por exemplo: “Em 1/5 + 3/5 eu tenho quintos dos dois lados. Juntando 1 quinto com 3 quintos, ficam 4 quintos: 4/5.”",
            origem: origemFracoes,
            exercicio: {
              tipo: "aberta",
              enunciado: "Explique, em duas ou três frases, por que 1/4 + 2/4 = 3/4 e não 3/8.",
              minimo: 40,
              gabarito: [
                "denominador|partes iguais|mesmo tamanho|quartos|tamanho",
                "numerador|soma|somamos|juntamos|junto|1 + 2|1 mais 2",
                "conserva|mantem|mantenho|continua|nao muda|o mesmo|igual",
              ],
              criterios: [
                "Fala do denominador ou do tamanho das partes",
                "Diz que se somam os numeradores",
                "Diz que o denominador continua o mesmo",
              ],
              modelo: "As duas frações são de quartos, então as partes têm o mesmo tamanho. Somamos os numeradores, 1 + 2 = 3, e o denominador continua 4, porque as partes continuam sendo quartos.",
              feedbackCorreto: "Ótima explicação: o tamanho das partes não muda e você só juntou mais partes.",
              feedbackIncorreto: "Faltou alguma ideia: fale do denominador (o tamanho das partes), da soma dos numeradores e de por que o 4 não muda.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: 'Complete a soma.',
                trecho: '2/7 + 3/7 = ___/7',
                trechoTipo: "frase",
                gabarito: ['5'],
                feedbackCorreto: 'Isso: sétimos dos dois lados, então junte os numeradores.',
                feedbackIncorreto: 'Com o mesmo denominador, junte só os numeradores.',
              },
            ],
          },
        ],
      },
    ],
  },
};

const origemFotografia = origem("fotografia com o celular");
const fotografia: Demo = {
  chave: "fotografia",
  reconhecer: (objetivo) => /\bfotograf\w*|\bfotos?\b/i.test(objetivo),
  plano: {
    titulo: "Fotografia com o celular",
    objetivo: "Tirar fotos melhores com o celular: luz, enquadramento e foco.",
    origem: origemFotografia,
    fluxos: [
      {
        titulo: trechos[0],
        licoes: [
          {
            titulo: "Lente limpa e mãos firmes",
            objetivo: "Evitar fotos embaçadas antes mesmo de enquadrar.",
            conceito: "Muitas fotos borradas não são culpa do celular. A lente fica engordurada no bolso e deixa tudo nebuloso, e a mão que treme na hora do toque borra a imagem. Limpe a lente e segure o celular com as duas mãos, cotovelos junto ao corpo.",
            exemplo: "Uma foto de um prato no restaurante sai leitosa. Depois de passar a barra da camiseta na lente e apoiar os cotovelos na mesa, a mesma foto sai nítida.",
            origem: origemFotografia,
            exercicio: {
              tipo: "verdadeiro_falso",
              enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
              afirmacao: "Foto embaçada é sempre culpa de um celular ruim.",
              justificativas: [
                op("lente", "Lente suja e mão tremendo deixam qualquer foto borrada"),
                op("camera", "Só celulares caros conseguem fotos nítidas"),
                op("luz", "Foto embaçada acontece só à noite"),
              ],
              gabarito: ["falso", "lente"],
              feedbackCorreto: "Isso: limpar a lente e firmar as mãos resolve a maioria das fotos borradas.",
              feedbackIncorreto: "É falsa: lente engordurada e mão tremendo borram fotos em qualquer celular.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Como segurar o celular para a foto não tremer?',
                opcoes: [op("a", 'Com as duas mãos e os cotovelos junto ao corpo'), op("b", 'Com uma mão, de braço esticado'), op("c", 'Pela ponta, com dois dedos')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: duas mãos e cotovelos firmes seguram o tremor.',
                feedbackIncorreto: 'Releia o conceito: o que fazer com as mãos e com os cotovelos?',
              },
            ],
            pratica: {
              tarefa: "Tire uma foto de um objeto perto de você. Depois limpe a lente com um pano macio, segure o celular com as duas mãos e tire a mesma foto. Compare as duas.",
              minutos: 2,
              dica: "Use um pano de óculos ou a barra de uma camiseta de algodão. Evite papel, que pode riscar a lente.",
            },
          },
          {
            titulo: "A regra dos terços",
            objetivo: "Posicionar o assunto da foto com a regra dos terços.",
            conceito: "Imagine a tela dividida por duas linhas horizontais e duas verticais, como um jogo da velha. Colocar o assunto numa dessas linhas, ou num dos cruzamentos, deixa a foto mais equilibrada do que colocá-lo bem no meio. O horizonte também fica melhor numa das linhas horizontais.",
            exemploTipo: "demonstracao",
            exemplo: "A maioria dos celulares desenha essa grade na tela da câmera. Ative e use como guia.",
            passos: [
              "Abra a câmera e entre nas configurações.",
              "Ative a opção “grade” ou “linhas de grade”.",
              "Coloque o assunto num dos quatro cruzamentos.",
              "Deixe o horizonte numa das linhas horizontais, não no meio.",
            ],
            origem: origemFotografia,
            exercicio: {
              tipo: "multipla_escolha",
              enunciado: "Numa foto de praia, onde fica o horizonte pela regra dos terços?",
              opcoes: [op("a", "Numa das linhas horizontais da grade"), op("b", "Exatamente no meio da foto"), op("c", "Na borda de baixo da foto")],
              gabarito: ["a"],
              feedbackCorreto: "Isso: numa das linhas, dando mais espaço para o céu ou para o mar.",
              feedbackIncorreto: "Pela regra dos terços, o horizonte fica numa das linhas horizontais da grade, e não no meio.",
            },
            extras: [
              {
                tipo: "verdadeiro_falso",
                enunciado: 'A frase é verdadeira ou falsa? Escolha também o porquê.',
                afirmacao: 'Pela regra dos terços, o assunto fica melhor bem no meio da foto.',
                justificativas: [
                  op("certa", 'Fica mais equilibrado numa das linhas ou cruzamentos da grade'),
                  op("e1", 'O meio é sempre o lugar mais bonito'),
                  op("e2", 'A grade só serve para paisagens'),
                ],
                gabarito: ['falso', "certa"],
                feedbackCorreto: 'Isso: fora do centro, numa linha da grade, a foto respira.',
                feedbackIncorreto: 'Pense no jogo da velha da tela: onde a lição manda pôr o assunto?',
              },
            ],
            pratica: {
              tarefa: "Ative a grade da câmera e fotografe um objeto três vezes: no meio, num cruzamento da esquerda e num da direita. Veja qual ficou mais interessante.",
              minutos: 3,
            },
          },
        ],
      },
      {
        titulo: trechos[1],
        licoes: [
          {
            titulo: "Usar a luz natural",
            objetivo: "Escolher a luz certa para cada foto.",
            conceito: "A luz muda tudo. A luz da janela, vinda de lado, é suave e valoriza rostos. O sol do meio-dia faz sombras duras e olhos apertados. Perto do nascer e do pôr do sol vem a hora dourada, com luz quente e suave.",
            exemplo: "O mesmo retrato fica duro ao meio-dia no quintal e suave perto da janela, com a pessoa de lado para a luz.",
            recurso: {
              tipo: "linha_do_tempo",
              eventos: [
                { quando: "Manhã cedo", texto: "Luz dourada e suave" },
                { quando: "Meio-dia", texto: "Sol a pino: sombras duras" },
                { quando: "Fim de tarde", texto: "Hora dourada, luz quente" },
              ],
            },
            origem: origemFotografia,
            exercicio: {
              tipo: "associar",
              enunciado: "Ligue cada luz ao resultado que ela costuma dar.",
              esquerda: [op("contraluz", "Contraluz"), op("janela", "Luz de janela, de lado"), op("meiodia", "Sol do meio-dia")],
              direita: [
                op("silhueta", "Silhueta escura do assunto"),
                op("suave", "Rosto com sombra suave"),
                op("dura", "Sombras duras e olhos franzidos"),
              ],
              gabarito: ["contraluz=silhueta", "janela=suave", "meiodia=dura"],
              feedbackCorreto: "Isso! Escolher de onde vem a luz é metade da foto.",
              feedbackIncorreto: "Reveja o conceito: contraluz faz silhueta, janela de lado suaviza e o sol do meio-dia endurece as sombras.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Quando acontece a hora dourada?',
                opcoes: [op("a", 'Perto do nascer e do pôr do sol'), op("b", 'Ao meio-dia'), op("c", 'À meia-noite')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: com o sol baixo, a luz fica quente e suave.',
                feedbackIncorreto: 'É quando o sol está baixo e a luz fica quente e suave.',
              },
            ],
          },
          {
            titulo: "Foco e brilho com um toque",
            objetivo: "Ajustar o foco e o brilho antes de fotografar.",
            conceito: "Tocar na tela sobre o assunto diz ao celular o que deve ficar nítido. Depois do toque, a maioria das câmeras mostra um controle de brilho: deslizar o dedo para cima clareia e, para baixo, escurece a foto.",
            exemplo: "Num retrato contra o céu, o rosto sai escuro. Tocando no rosto, o celular foca e clareia; se o céu estourar, é só deslizar um pouco para baixo.",
            origem: origemFotografia,
            exercicio: {
              tipo: "ordenar",
              enunciado: "Coloque os passos de uma boa foto na ordem.",
              itens: [
                op("enquadrar", "Enquadrar a cena"),
                op("tocar", "Tocar no assunto para focar"),
                op("brilho", "Ajustar o brilho deslizando o dedo"),
                op("disparar", "Tirar a foto"),
              ],
              gabarito: ["enquadrar", "tocar", "brilho", "disparar"],
              feedbackCorreto: "Perfeito: enquadra, foca, ajusta e só então dispara.",
              feedbackIncorreto: "Primeiro você escolhe o que vai aparecer, depois foca, ajusta o brilho e por fim tira a foto.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: 'Complete o gesto.',
                trecho: 'Depois de tocar no rosto, deslize o dedo para ___ para clarear a foto.',
                trechoTipo: "frase",
                gabarito: ['cima'],
                feedbackCorreto: 'Isso: para cima clareia, para baixo escurece.',
                feedbackIncorreto: 'Para baixo escurece; clarear é o movimento contrário.',
              },
            ],
            pratica: {
              tarefa: "Fotografe algo perto de uma janela. Toque no assunto para focar, deslize o brilho para cima e para baixo e tire duas versões.",
              minutos: 3,
            },
          },
        ],
      },
      {
        titulo: trechos[2],
        licoes: [
          {
            titulo: "Revisão: um retrato perto da janela",
            objetivo: "Juntar luz, enquadramento e foco num retrato.",
            conceito: "Um bom retrato junta tudo: luz suave de lado, os olhos numa linha dos terços e o foco no rosto. E nada de zoom no máximo: é melhor se aproximar.",
            exemploTipo: "demonstracao",
            exemplo: "Siga os passos com alguém da sua casa.",
            passos: [
              "Coloque a pessoa de lado para a janela.",
              "Ative a grade e deixe os olhos numa linha horizontal.",
              "Toque no rosto para focar.",
              "Ajuste o brilho e fotografe.",
            ],
            origem: origemFotografia,
            exercicio: {
              tipo: "lacuna",
              enunciado: "Complete com o que você faz na tela para focar no rosto.",
              trecho: "Para focar no rosto, eu ___ na tela sobre o rosto.",
              trechoTipo: "frase",
              gabarito: ["toco", "toque", "encosto", "clico"],
              feedbackCorreto: "Isso: o toque diz ao celular o que deve ficar nítido.",
              feedbackIncorreto: "Pense no gesto que você faz na tela, sobre o rosto da pessoa, para o celular focar ali.",
            },
            extras: [
              {
                tipo: "verdadeiro_falso",
                enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
                afirmacao: "Usar o zoom digital no máximo deixa a foto mais nítida.",
                justificativas: [
                  op("pixels", "O zoom digital só amplia os pixels; é melhor se aproximar"),
                  op("lente", "O zoom digital troca a lente por uma melhor"),
                  op("luz", "O zoom digital deixa entrar mais luz"),
                ],
                gabarito: ["falso", "pixels"],
                feedbackCorreto: "Isso: aproxime-se do assunto em vez de esticar o zoom.",
                feedbackIncorreto: "É falsa: o zoom digital só amplia os pixels e a foto perde nitidez. Chegue mais perto.",
              },
            ],
          },
          {
            titulo: "Explique suas escolhas",
            objetivo: "Explicar como você planeja uma foto.",
            conceito: "Saber explicar por que você fez cada escolha ajuda a repetir o acerto. Uma boa explicação diz de onde vem a luz, onde fica o assunto e onde você foca.",
            exemplo: "Por exemplo: “Fotografei o vaso de lado para a janela, coloquei ele num cruzamento da grade e toquei nas flores para focar.”",
            origem: origemFotografia,
            exercicio: {
              tipo: "aberta",
              enunciado: "Descreva como você tiraria a foto de um amigo perto de uma janela: onde ele fica, de onde vem a luz e onde você toca para focar.",
              minimo: 40,
              gabarito: ["janela|luz natural|luz de lado|de lado", "rosto|olhos|amigo", "toc|foco|focar|encost", "terco|tercos|grade|cruzamento|linha"],
              criterios: ["Usa a luz da janela", "Foca no rosto ou nos olhos", "Diz que toca na tela para focar", "Usa a grade ou a regra dos terços"],
              modelo: "Coloco meu amigo de lado para a janela, para a luz suave bater no rosto. Ativo a grade, deixo os olhos numa linha dos terços e toco na tela sobre o rosto para focar antes de fotografar.",
              feedbackCorreto: "Ótimo planejamento: luz, enquadramento e foco no lugar certo.",
              feedbackIncorreto: "Faltou alguma escolha: diga de onde vem a luz, onde fica o rosto na grade e onde você toca para focar.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Num retrato perto da janela, de onde a luz deve vir?',
                opcoes: [op("a", 'De lado, da janela'), op("b", 'De trás da pessoa'), op("c", 'Do flash, de frente')],
                gabarito: ["a"],
                feedbackCorreto: 'Isso: a luz de lado é suave e valoriza o rosto.',
                feedbackIncorreto: 'Lembre da lição de luz natural: qual luz é suave e valoriza rostos?',
              },
            ],
          },
        ],
      },
    ],
  },
};

/** Demos na ordem de reconhecimento. SQL tem a sua própria trilha em `falsa.ts`. */
export const DEMOS: readonly Demo[] = [violao, ingles, culinaria, historia, fracoes, fotografia];

export function demoDoObjetivo(objetivo: string): Demo | undefined {
  return DEMOS.find((demo) => demo.reconhecer(objetivo));
}

export function demoPelaChave(chave: string): Demo | undefined {
  return DEMOS.find((demo) => demo.chave === chave);
}
