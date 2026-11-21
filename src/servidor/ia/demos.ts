import { geometria } from "./demo-geometria";
import { funcoes } from "./demo-funcoes";
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
            conceito: "O violão tem três partes principais: a cabeça, onde ficam as tarraxas que afinam as cordas; o braço, dividido em casas pelos trastes; e o corpo, com a boca, por onde o som sai. As cordas são contadas de baixo para cima: a 1ª é a mais fina e a 6ª, a mais grossa. Quem é destro aperta as cordas no braço com a mão esquerda e toca as cordas sobre a boca com a direita (quem é canhoto, ao contrário).",
            exemplo: "Para afinar a 6ª corda (a mais grossa, o número 4 da ilustração), você gira a tarraxa dela, na cabeça. Para tocar uma nota mais aguda nessa mesma corda, aperta a corda numa casa do braço, mais perto do corpo.",
            recurso: { tipo: "imagem", src: ILUSTRACAO_VIOLAO, descricao: "① tarraxa, na cabeça · ② casa, no braço (entre dois trastes) · ③ boca, no corpo · ④ 6ª corda, a mais grossa", fonte: "Ilustração" },
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
              feedbackCorreto: "A tarraxa afina, a casa muda a nota, a boca projeta o som e a 6ª corda é a mais grave.",
              feedbackIncorreto: "Abra “Ver a ilustração”, embaixo do exercício: cada número mostra onde a parte fica. Comece pelo que você gira para afinar e pela abertura do corpo; os outros pares saem por exclusão.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: "Complete com o nome da parte que você gira para afinar.",
                trecho: "Para afinar a corda, eu giro a ___ na cabeça do violão.",
                trechoTipo: "frase",
                gabarito: ["tarraxa"],
                feedbackCorreto: "Exato: a tarraxa estica ou afrouxa a corda, e isso muda a afinação.",
                feedbackIncorreto: "Abra “Rever a explicação”, embaixo do exercício: é a peça da cabeça do violão que você gira para esticar ou afrouxar a corda.",
                armadilhas: [
                  { termos: "chave|chaves|cravelha", aviso: "Muita gente chama essa peça assim! O nome que a lição usa é o da ilustração, no número 1." },
                ],
              },
            ],
            pratica: {
              tarefa: "Pegue o violão na postura certa e toque cada corda solta, da 6ª (a mais grossa) à 1ª, ouvindo o som ficar mais agudo. Se quiser, já afine a 6ª corda.",
              minutos: 5,
              passos: [
                "Sente-se e apoie a curva do corpo do violão na perna direita (canhoto: na esquerda).",
                "A mão esquerda segura o braço, com o polegar atrás dele; a direita fica sobre a boca, para tocar.",
                "Com o polegar direito, toque cada corda solta, da 6ª à 1ª: o som vai do mais grave ao mais agudo.",
                "Bônus, se quiser: abra um app afinador gratuito (ou toque “Ouvir o Mi” e compare) e gire a tarraxa da 6ª corda devagar: som mais grave que o Mi, estique; mais agudo, solte.",
              ],
              dica: "Afinar de ouvido leva tempo, e ninguém acerta no primeiro dia. Hoje, o que vale é a postura e conhecer as cordas; na afinação, gire um quarto de volta por vez.",
              som: { rotulo: "Ouvir o Mi (6ª corda solta)", casas: [0, -1, -1, -1, -1, -1] },
            },
            outroJeito: "Pense no violão como uma pessoa deitada: a cabeça fica numa ponta, com as tarraxas como orelhas que você gira para afinar; o braço é comprido e marcado em casas, como uma régua; e o corpo é a barriga oca, com a boca no meio, por onde o som sai.",
          },
          {
            titulo: "Montar o acorde Lá menor (Am)",
            objetivo: "Posicionar os dedos para tocar o acorde Lá menor.",
            conceito: "Um acorde é um grupo de notas tocadas juntas. O diagrama abaixo mostra o braço do violão em pé, com a cabeça para cima, como se você olhasse para ele de frente: as linhas verticais são as cordas, com a 6ª (a mais grossa) à esquerda, e as horizontais são os trastes. É o mesmo violão da lição 1, só que em pé: a 6ª corda, que ficava no alto com o violão deitado, aparece à esquerda. Os números dizem qual dedo usar: 1 é o indicador, 2 o médio e 3 o anelar. O X marca a corda que não deve soar e o O, a corda solta.",
            exemploTipo: "demonstracao",
            exemplo: "Veja o Lá menor no diagrama e ouça como ele soa. Depois, siga os passos com o violão na mão.",
            passos: [
              "Com a mão esquerda (canhoto: a direita), indicador (1) na 1ª casa da 2ª corda.",
              "Médio (2) na 2ª casa da 4ª corda.",
              "Anelar (3) na 2ª casa da 3ª corda.",
              "Com a outra mão, toque da 5ª corda para baixo, sem tocar a 6ª.",
            ],
            recurso: { tipo: "acorde", nome: "Am", casas: [-1, 0, 2, 2, 1, 0], dedos: [0, 0, 2, 3, 1, 0] },
            origem: origemViolao,
            exercicio: {
              tipo: "multipla_escolha",
              enunciado: "No Lá menor, qual corda não deve soar?",
              opcoes: [op("a", "A 6ª corda, a mais grossa"), op("b", "A 1ª corda, a mais fina"), op("c", "A 3ª corda")],
              gabarito: ["a"],
              feedbackCorreto: "O X em cima da 6ª corda diz que ela fica de fora. O acorde começa na 5ª corda.",
              feedbackIncorreto: "Abra “Ver o acorde Am”, embaixo do exercício, e procure o X: ele marca a corda que fica de fora. As cordas vão da mais grossa, à esquerda, para a mais fina, à direita.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'No diagrama, o que quer dizer o O em cima de uma corda?',
                opcoes: [op("a", 'A corda soa solta, sem dedo nenhum'), op("b", 'A corda não deve soar'), op("c", 'Use o dedo zero, o polegar')],
                gabarito: ["a"],
                feedbackCorreto: 'O é corda solta; X é a corda que fica de fora.',
                feedbackIncorreto: 'O X e o O são opostos: um tira a corda do acorde, o outro a deixa soar.',
              },
            ],
            pratica: {
              tarefa: "Monte o Lá menor e toque as cordas uma a uma, da 5ª à 1ª. Se alguma soar abafada, aproxime o dedo do traste.",
              minutos: 3,
              passos: ["Monte o acorde devagar, dedo por dedo.", "Toque cada corda e escute.", "Tire a mão e monte de novo, 5 vezes."],
              dica: "Use a ponta dos dedos, com as unhas curtas, e deixe o polegar atrás do braço do violão.",
            },
            outroJeito: "Leia o diagrama como se o violão estivesse em pé na sua frente: a corda mais grossa fica à esquerda. Cada bolinha é um dedo apertando a corda logo antes do traste; o X diz “não toque esta” e o O, “toque solta”. No Lá menor, os três dedos formam um triângulo pequeno, perto da cabeça.",
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
              feedbackCorreto: "Do Lá menor, só o anelar sobe e desce no lugar novo, e o Dó soa.",
              feedbackIncorreto: "Siga o movimento da mão: em que acorde você está antes de trocar? E o que precisa sair do lugar antes de um dedo chegar à casa nova?",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Na troca de Lá menor para Dó, quais dedos ficam no lugar?',
                opcoes: [op("a", 'O indicador e o médio'), op("b", 'O anelar e o médio'), op("c", 'Nenhum: todos mudam')],
                gabarito: ["a"],
                feedbackCorreto: 'Indicador e médio são a âncora; só o anelar viaja.',
                feedbackIncorreto: 'Compare os dois diagramas: só um dos números muda de lugar.',
              },
            ],
            pratica: {
              tarefa: "Alterne Lá menor e Dó contando até 4 em cada acorde, devagar. Pare quando a troca sair sem você olhar para a mão.",
              minutos: 4,
              dica: "Pense no anelar como o único dedo que viaja: o indicador e o médio são a âncora.",
            },
            outroJeito: "Pense nos dedos como pés numa escada: dois ficam firmes no degrau (indicador e médio) e só um sobe para o próximo (o anelar). Treinar a troca é treinar esse único passo, sem tirar os outros do lugar.",
          },
          {
            titulo: "Ritmo: batida para baixo e para cima",
            objetivo: "Tocar uma batida simples, para baixo e para cima, em quatro tempos.",
            conceito: "A batida marca o pulso da música e é feita pela mão que toca as cordas, perto da boca do violão. Na batida mais simples, essa mão desce em cada tempo e sobe entre eles, sem parar, como um pêndulo. Um compasso é um grupo de tempos; nesta batida, cada compasso tem 4 tempos (o mais comum na música popular), e tocar 8 compassos é contar de 1 a 4 oito vezes.",
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
              feedbackCorreto: "O braço não para. Errar uma corda passa; perder o tempo atrapalha a música inteira.",
              feedbackIncorreto: "Pense no pêndulo de um relógio: ele para quando alguém se distrai? O que acontece com o tempo da música se o braço parar?",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: 'Complete com o número de tempos.',
                trecho: 'Nesta batida, cada compasso tem ___ tempos.',
                trechoTipo: "frase",
                gabarito: ['4', 'quatro'],
                feedbackCorreto: 'Nesta batida, o compasso tem 4 tempos, e 8 compassos são 8 contagens de 1 a 4.',
                feedbackIncorreto: 'É quanto você conta antes de recomeçar a contagem da batida.',
              },
            ],
            pratica: {
              tarefa: "Com o Lá menor montado, faça a batida para baixo e para cima por 8 compassos (conte de 1 a 4 oito vezes), em voz alta.",
              minutos: 3,
              dica: "Ouça a batida no exemplo e toque junto. Devagar e no tempo vale mais do que rápido e atropelado.",
            },
            outroJeito: "Imagine que você sacode uma gota de água da mão, para baixo e para cima, sem parar: é esse balanço que faz a batida. A mão desce no número e sobe no “e” mesmo quando não acerta as cordas, como um relógio que não para.",
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
              feedbackCorreto: "Só o anelar viaja, da 3ª corda para a 3ª casa da 5ª corda.",
              feedbackIncorreto: "O indicador e o médio ficam parados nos dois acordes. Quem muda é o anelar.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: "Complete com o nome do dedo.",
                trecho: "Nos diagramas de acorde, o número 1 indica o dedo ___.",
                trechoTipo: "frase",
                gabarito: ["indicador"],
                feedbackCorreto: "1 é o indicador, 2 o médio, 3 o anelar e 4 o mínimo.",
                feedbackIncorreto: "Lembre da legenda do diagrama: os números contam os dedos a partir do que fica ao lado do polegar.",
              },
            ],
            pratica: {
              tarefa: "Toque a sequência Am, Am, C, C por 2 minutos, com a batida para baixo e para cima.",
              minutos: 2,
            },
            outroJeito: "Pense numa caminhada: dois passos com um pé (Am, Am) e dois com o outro (C, C). O braço da batida é o ritmo dos passos, que não para; a troca de acorde acontece no último “e”, como quem já levanta o pé antes de pisar.",
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
              essenciais: [0],
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
                feedbackCorreto: 'Quem explica entende o que faz e repete o acerto.',
                feedbackIncorreto: 'Releia o conceito: o que explicar faz com o que você aprendeu?',
              },
            ],
            outroJeito: "Uma boa explicação responde a três perguntas, como uma receita: o que fica parado, o que se mexe e o que nunca para. Se a sua responde às três, alguém que nunca tocou conseguiria repetir o movimento.",
          },
        ],
      },
    ],
  },
};

const origemIngles = origem("inglês para viagem");
/**
 * Pronúncia escrita do jeito que se lê em português, com a sílaba forte em maiúsculas: ajuda quem está sem voz no
 * aparelho e quem nunca ouviu a palavra (é uma aproximação; o áudio continua sendo a referência).
 */
const PRONUNCIA_EN: Record<string, string> = {
  "Hello! I'm Ana.": "rê-LOU! áim É-na",
  "I'm from Brazil.": "áim from bra-ZIL",
  "Nice to meet you!": "NÁIS tu MÍT iu",
  "I'm here on vacation.": "áim RÍR on vei-KÊI-shan",
  "I'm staying for ten days.": "áim STÊI-in for TÉN dêiz",
  "Excuse me, where is the train station?": "eks-KIÚZ mi, UÉR iz dâ TRÊIN STÊI-shan?",
  "Go straight, then turn left.": "GOU STRÊIT, dén TÂRN LÉFT",
  "Turn right at the corner.": "TÂRN RÁIT ét dâ KÓR-ner",
  "It's next to the hotel.": "its NÉKST tu dâ rou-TÉL",
  "It's in front of the bank.": "its in FRÂNT ov dâ BÉNK",
  "It's far from here.": "its FÁR from RÍR",
  "Good evening! I have a reservation.": "gud ÍV-nin! ái RÉV a ré-zer-VÊI-shan",
  "What's your name?": "UÓTS iór NÊIM?",
  "Here's my passport.": "RÍRZ mái PÉS-port",
  "Thank you for the key!": "TÊNK iu for dâ KÍ!",
  "One, two, three, four, five, six, seven, eight, nine, ten.": "UÂN, TU, TRÍ, FÓR, FÁIV, SÍKS, SÉ-ven, ÊIT, NÁIN, TÉN",
  "How much is it?": "RÁU MÂTCH iz it?",
  "Eleven, twelve, twenty.": "i-LÉ-ven, TUÉLV, TUÊN-ti",
  "What is the purpose of your visit?": "UÓT iz dâ PÂR-pas ov iór VÍ-zit?",
  "It's fifteen dollars.": "its fif-TÍN DÓ-lars",
  "It's fifty dollars.": "its FÍF-ti DÓ-lars",
  "How much is the coffee?": "RÁU MÂTCH iz dâ KÓ-fi?",
  "Can I have the menu, please?": "kén ái RÉV dâ MÉ-niu, PLÍZ?",
  "I'd like a sandwich, please.": "áid LÁIK a SÉND-uitch, PLÍZ",
  "Water, please.": "UÓ-ter, PLÍZ",
  "It was delicious!": "it uóz de-LÍ-shas!",
  "Can I have the check, please?": "kén ái RÉV dâ TCHÉK, PLÍZ?",
  "Where is the bus stop?": "UÉR iz dâ BÂS STÓP?",
  "How much is the ticket?": "RÁU MÂTCH iz dâ TÍ-ket?",
  "Sorry, can you repeat?": "SÓ-ri, kén iu ri-PÍT?",
  "I'm flying to New York.": "áim FLÁI-in tu NIÚ IÓRK",
  "It's next to the bank.": "its NÉKST tu dâ BÉNK",
  "Turn left at the corner.": "TÂRN LÉFT ét dâ KÓR-ner",
  "It's thirteen dollars.": "its târ-TÍN DÓ-lars",
  "The coffee is four ninety-nine.": "dâ KÓ-fi iz FÓR NÁIN-ti NÁIN",
  "Any bags to check?": "É-ni BÉGZ tu TCHÉK?",
  "Yes, one bag.": "IÉS, UÂN BÉG",
  "Here's your boarding pass.": "RÍRZ iór BÓR-din PÉS",
  "Where is gate twelve?": "UÉR iz GUÊIT TUÉLV?",
};
/** Erros comuns de quem começa no inglês, para o retorno do “Explique” sem IA (valem em todas as lições da trilha). */
const verboQueSome = {
  termos: "i here|i from|i staying|i happy|i flying|i going|i ready|i tired|i hungry",
  aviso: "Em inglês, o verbo não some: “I'm here” (I am here), “I'm flying to…”, “I'm from Brazil”.",
};
const deFerias = {
  // Sem “on vacations”: a tolerância a um deslize de digitação acharia o certo (“on vacation”).
  termos: "for vacation|in vacation|in holiday",
  aviso: "Para dizer que está de férias, o inglês usa “on vacation”: “I'm here on vacation”.",
};
const falaEn = (texto: string, traducao: string) =>
  ({ texto, idioma: "en-US", traducao, ...(PRONUNCIA_EN[texto] ? { pronuncia: PRONUNCIA_EN[texto] } : {}) });
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
            conceito: "Para começar uma conversa em inglês, três frases curtas resolvem: um cumprimento (“Hello!”, olá), seu nome (“I'm Ana”, eu sou a Ana) e de onde você vem (“I'm from Brazil”, eu sou do Brasil). “Nice to meet you” (prazer em conhecer) mostra simpatia. Na imigração do aeroporto, o agente pergunta o motivo da viagem (“What is the purpose of your visit?”), e você responde: “I'm here on vacation” (estou aqui de férias).",
            exemplo: "Na recepção de um hotel: “Hello! I'm Ana. I'm from Brazil.” A pessoa responde: “Nice to meet you, Ana!”",
            falas: [
              falaEn("Hello! I'm Ana.", "Olá! Eu sou a Ana."),
              falaEn("I'm from Brazil.", "Eu sou do Brasil."),
              falaEn("Nice to meet you!", "Prazer em conhecer você!"),
              falaEn("I'm here on vacation.", "Estou aqui de férias."),
              falaEn("I'm staying for ten days.", "Vou ficar dez dias."),
              falaEn("What is the purpose of your visit?", "Qual é o motivo da sua visita?"),
            ],
            origem: origemIngles,
            exercicio: {
              tipo: "associar",
              enunciado: "Ligue cada frase à tradução.",
              esquerda: [op("hello", "Hello!"), op("from", "I'm from Brazil."), op("nice", "Nice to meet you!")],
              direita: [op("ola", "Olá!"), op("brasil", "Eu sou do Brasil."), op("prazer", "Prazer em conhecer você!")],
              gabarito: ["hello=ola", "from=brasil", "nice=prazer"],
              feedbackCorreto: "Com essas três frases você já começa uma conversa.",
              feedbackIncorreto: "Volte às frases do exemplo (ouça ou leia) e procure palavras conhecidas. Dica: “from” aparece quando alguém diz de onde é.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: "Na imigração, ouça a pergunta do agente e escolha a resposta.",
                fala: falaEn("What is the purpose of your visit?", "Qual é o motivo da sua visita?"),
                opcoes: [op("a", "I'm here on vacation."), op("b", "Nice to meet you!"), op("c", "How much is it?")],
                gabarito: ["a"],
                feedbackCorreto: "“I'm here on vacation” diz que você veio passear, de férias.",
                feedbackIncorreto: "Ouça (ou leia) de novo: “purpose of your visit” é o motivo da viagem. Qual frase fala de férias?",
              },
              {
                tipo: "lacuna",
                enunciado: "Complete a apresentação com a palavra que diz de onde você vem.",
                trecho: "Hello! I'm Ana. I'm ___ Brazil.",
                trechoTipo: "frase",
                gabarito: ["from"],
                exata: true,
                feedbackCorreto: "“I'm from Brazil” diz de onde você é.",
                feedbackIncorreto: "É a palavra que vem logo antes do país, nas frases desta lição. Ela tem quatro letras e começa com “f”.",
                armadilhas: [
                  { termos: "of|de|do", aviso: "Quase: em português é “sou do Brasil”, mas o inglês usa outra palavra para dizer de onde você vem. Releia as frases da lição." },
                ],
              },
            ],
            outroJeito: "Pense num cartão de visita falado, em três linhas: o cumprimento (“Hello!”), quem é você (“I'm Ana.”) e de onde vem (“I'm from Brazil.”). “Nice to meet you” é o aperto de mão do fim. Na imigração, entra uma quarta linha: por que veio (“I'm here on vacation.”).",
            armadilhas: [verboQueSome, deFerias],
            pratica: {
              tarefa: "Apresente-se em voz alta, como na imigração: diga as quatro frases da lição com o seu nome.",
              minutos: 2,
              passos: ["Hello! I'm (seu nome).", "I'm from Brazil.", "I'm here on vacation.", "I'm staying for ten days."],
              dica: "Fale devagar e repita até sair sem olhar. Se puder, grave no celular e ouça.",
            },
          },
          {
            titulo: "No aeroporto: check-in e embarque",
            objetivo: "Fazer o check-in do voo e achar o portão de embarque.",
            conceito: "No balcão da companhia aérea, mostre o passaporte e diga para onde vai: “I'm flying to New York” (vou voar para Nova York). A atendente pode perguntar “Any bags to check?” (alguma mala para despachar?). No cartão de embarque (“boarding pass”), procure o portão (“gate”) e o horário de embarque (“boarding time”).",
            exemplo: "“Hi! I'm flying to New York. Here's my passport.” — “Any bags to check?” — “Yes, one bag.” — “Here's your boarding pass. Gate twelve.”",
            falas: [
              falaEn("I'm flying to New York.", "Vou voar para Nova York."),
              falaEn("Any bags to check?", "Alguma mala para despachar?"),
              falaEn("Yes, one bag.", "Sim, uma mala."),
              falaEn("Here's your boarding pass.", "Aqui está seu cartão de embarque."),
              falaEn("Where is gate twelve?", "Onde fica o portão doze?"),
            ],
            origem: origemIngles,
            exercicio: {
              tipo: "associar",
              enunciado: "Ligue cada palavra do aeroporto ao que ela quer dizer.",
              esquerda: [op("gate", "Gate"), op("cartao", "Boarding pass"), op("mala", "Bag")],
              direita: [op("portao", "Portão de embarque"), op("passe", "Cartão de embarque"), op("bolsa", "Mala")],
              gabarito: ["gate=portao", "cartao=passe", "mala=bolsa"],
              feedbackCorreto: "No cartão de embarque você acha o portão, e a mala vai no balcão.",
              feedbackIncorreto: "Releia a explicação: o “boarding pass” é o papel (ou a tela) que mostra para onde ir. Comece por ele.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: "No balcão, ouça a pergunta da atendente e escolha a resposta.",
                fala: falaEn("Any bags to check?", "Alguma mala para despachar?"),
                opcoes: [op("a", "Yes, one bag."), op("b", "Gate twelve."), op("c", "Nice to meet you!")],
                gabarito: ["a"],
                feedbackCorreto: "“bags” são malas, e “Yes, one bag” diz que você vai despachar uma.",
                feedbackIncorreto: "Ouça (ou leia) de novo: “bags” são malas. Qual resposta fala de mala?",
              },
              {
                tipo: "ordenar",
                enunciado: "Coloque a conversa do balcão do aeroporto na ordem.",
                itens: [
                  op("voo", "Hi! I'm flying to New York."),
                  op("malas", "Any bags to check?"),
                  op("uma", "Yes, one bag."),
                  op("cartao", "Here's your boarding pass."),
                ],
                gabarito: ["voo", "malas", "uma", "cartao"],
                feedbackCorreto: "Você diz para onde vai, despacha a mala e recebe o cartão de embarque.",
                feedbackIncorreto: "Pense no balcão: primeiro você diz para onde vai; o cartão de embarque é a última coisa que você recebe.",
              },
            ],
            outroJeito: "Pense no aeroporto em três paradas: o balcão (passaporte e malas, “bags”), o cartão de embarque (“boarding pass”, com o portão e o horário) e o portão (“gate”), onde você espera chamarem o seu voo.",
            armadilhas: [verboQueSome],
            pratica: {
              tarefa: "Ensaie o balcão do aeroporto em voz alta, fazendo as duas partes da conversa.",
              minutos: 2,
              passos: ["Hi! I'm flying to New York. Here's my passport.", "Any bags to check? — Yes, one bag.", "Where is gate twelve?"],
              dica: "Troque “New York” pela cidade da sua viagem: assim a frase já fica pronta para usar.",
            },
          },
          {
            titulo: "Pedir informações na rua",
            objetivo: "Perguntar onde fica um lugar e entender a resposta.",
            conceito: "Para pedir ajuda, comece com “Excuse me” (com licença) e pergunte “Where is…?” (onde fica…?). Na resposta, preste atenção na direção: “turn left” (vire à esquerda), “turn right” (vire à direita) ou “go straight” (siga em frente). No fim, agradeça: “Thank you!”",
            exemplo: "“Excuse me, where is the train station?” — “Go straight, then turn left. It's next to the hotel.” — “Thank you!” Para dizer onde fica um lugar: “next to” (ao lado de), “in front of” (em frente a) e “far from” (longe de).",
            falas: [
              falaEn("Excuse me, where is the train station?", "Com licença, onde fica a estação de trem?"),
              falaEn("Go straight, then turn left.", "Siga em frente e depois vire à esquerda."),
              falaEn("Turn right at the corner.", "Vire à direita na esquina."),
              falaEn("It's next to the hotel.", "Fica ao lado do hotel."),
              falaEn("It's in front of the bank.", "Fica em frente ao banco."),
              falaEn("It's far from here.", "Fica longe daqui."),
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
              feedbackCorreto: "“Where is the museum?” pergunta onde fica o museu.",
              feedbackIncorreto: "É a palavra que pergunta por um lugar, o “onde” do inglês. Começa com “wh”, como “what” e “who”.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: "Ouça a resposta e escolha o que ela quer dizer.",
                fala: falaEn("It's next to the bank.", "Fica ao lado do banco."),
                opcoes: [op("a", "Fica ao lado do banco."), op("b", "Fica em frente ao banco."), op("c", "Fica longe do banco.")],
                gabarito: ["a"],
                feedbackCorreto: "“next to” quer dizer ao lado de.",
                feedbackIncorreto: "A frase é “It's next to the bank”: “next to” quer dizer ao lado de.",
              },
              {
                tipo: "multipla_escolha",
                enunciado: "Ouça o caminho e escolha para onde ir.",
                fala: falaEn("Turn left at the corner.", "Vire à esquerda na esquina."),
                opcoes: [op("a", "Vire à esquerda na esquina."), op("b", "Vire à direita na esquina."), op("c", "Siga em frente até a esquina.")],
                gabarito: ["a"],
                feedbackCorreto: "“turn left” é virar à esquerda, e “at the corner”, na esquina.",
                feedbackIncorreto: "Ouça (ou leia) de novo: “left” é esquerda e “right” é direita. “Go straight” seria seguir em frente.",
              },
            ],
            outroJeito: "Pense no GPS do celular: ele diz para onde virar (“turn left”, “turn right”), quando seguir (“go straight”) e onde fica o destino (“next to”, “in front of”). Na rua, as pessoas falam do mesmo jeito: repare primeiro na direção, depois no lugar.",
            armadilhas: [
              verboQueSome,
              { termos: "turn to left|turn to right|turn at left|turn at right", aviso: "Sem o “to”: em inglês é só “turn left” e “turn right”." },
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
              falaEn("Thank you for the key!", "Obrigado(a) pela chave!"),
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
              feedbackCorreto: "Cumprimento, reserva, documento e o agradecimento pela chave.",
              feedbackIncorreto: "Imagine a conversa real no balcão do hotel, uma fala de cada vez.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: "Ouça o que a recepcionista pergunta e escolha a melhor resposta.",
                fala: falaEn("What's your name?", "Qual é o seu nome?"),
                opcoes: [op("a", "Ana Souza. Here's my passport."), op("b", "It's fifteen dollars."), op("c", "It's next to the hotel.")],
                gabarito: ["a"],
                feedbackCorreto: "Ela perguntou o seu nome (“What's your name?”), e você já mostra o passaporte.",
                feedbackIncorreto: "Ouça (ou leia) de novo: “name” é nome. Qual resposta diz quem você é?",
              },
              {
                tipo: "lacuna",
                enunciado: "Complete o que você diz ao chegar no balcão do hotel.",
                trecho: "Good evening! I have a ___.",
                trechoTipo: "frase",
                gabarito: ["reservation"],
                exata: true,
                feedbackCorreto: "“I have a reservation” diz que você já reservou o quarto.",
                feedbackIncorreto: "É a palavra para “reserva”, parecida com o português e terminada em “‑tion”.",
                armadilhas: [
                  { termos: "reserve|reserva", aviso: "Quase: “reserve” é o verbo (reservar). Para dizer “uma reserva”, a palavra termina em “‑tion”." },
                ],
              },
            ],
            outroJeito: "Pense no check-in como uma fila de quatro passos, igual em quase todo hotel: cumprimentar, dizer que tem reserva, mostrar o documento e receber a chave. Sabendo em que passo você está, dá para imaginar a próxima pergunta, mesmo sem entender tudo.",
            armadilhas: [
              verboQueSome,
              { termos: "i have reservation|i have one reservation", aviso: "Com o “a”: “I have a reservation” (eu tenho uma reserva)." },
            ],
            pratica: {
              tarefa: "Ensaie o check-in do hotel em voz alta, na ordem da conversa.",
              minutos: 2,
              passos: ["Good evening! I have a reservation.", "My name is (seu nome).", "Here's my passport.", "Thank you for the key!"],
              dica: "Diga o seu nome devagar e soletre se precisar: é a parte que mais se repete no balcão.",
            },
          },
          {
            titulo: "Números e preços",
            objetivo: "Entender preços falados em inglês.",
            conceito: "Os números de 1 a 12 estão no exemplo, a seguir, com os algarismos, para ouvir e repetir. O que mais confunde é o fim da palavra: de 13 a 19, ela termina em ‑teen (“fifteen”, 15); as dezenas terminam em ‑ty (“fifty”, 50). Preço com centavos se diz em duas partes: “four ninety-nine” é 4,99.",
            exemplo: "“How much is it?” — “It's fifteen dollars.” São quinze dólares, não cinquenta: o “‑teen” no fim indica a casa dos dez.",
            falas: [
              // A tradução dos números traz os algarismos: a lista vira uma tabelinha de consulta.
              falaEn("One, two, three, four, five, six, seven, eight, nine, ten.", "1, 2, 3, 4, 5, 6, 7, 8, 9, 10."),
              falaEn("Eleven, twelve, twenty.", "11, 12, 20."),
              falaEn("How much is it?", "Quanto custa?"),
              falaEn("It's fifteen dollars.", "Custa quinze dólares."),
              falaEn("It's fifty dollars.", "Custa cinquenta dólares."),
              falaEn("The coffee is four ninety-nine.", "O café custa 4,99."),
            ],
            origem: origemIngles,
            exercicio: {
              tipo: "multipla_escolha",
              enunciado: "Ouça o preço e escolha o valor.",
              fala: falaEn("It's thirteen dollars.", "Custa treze dólares."),
              opcoes: [op("a", "13 dólares"), op("b", "30 dólares"), op("c", "3 dólares")],
              gabarito: ["a"],
              feedbackCorreto: "“thirteen” termina em “‑teen”, então é 13.",
              feedbackIncorreto: "Ouça (ou leia) de novo o fim da palavra: “‑teen” é a casa dos dez (13 a 19); “‑ty” são as dezenas (30, 40…).",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: "Complete a pergunta para saber o preço do café.",
                trecho: "How ___ is the coffee?",
                trechoTipo: "frase",
                gabarito: ["much"],
                exata: true,
                feedbackCorreto: "“How much is…?” pergunta o preço de qualquer coisa.",
                feedbackIncorreto: "É a pergunta de preço que você ouviu nesta lição, com a palavra que quer dizer “muito”.",
              },
              {
                tipo: "associar",
                enunciado: "Ligue cada número em inglês ao algarismo.",
                esquerda: [op("fifteen", "Fifteen"), op("fifty", "Fifty"), op("thirteen", "Thirteen"), op("thirty", "Thirty")],
                direita: [op("n15", "15"), op("n50", "50"), op("n13", "13"), op("n30", "30")],
                gabarito: ["fifteen=n15", "fifty=n50", "thirteen=n13", "thirty=n30"],
                feedbackCorreto: "O ‑teen fica entre 13 e 19, e o ‑ty é a dezena redonda.",
                feedbackIncorreto: "Olhe o fim de cada palavra: ‑teen é a casa dos dez (de 13 a 19); ‑ty é uma dezena redonda, como 20 ou 40.",
              },
            ],
            pratica: {
              tarefa: "Diga em voz alta, devagar, estes preços em inglês. Repita até cada um soar natural.",
              minutos: 2,
              passos: ["Fifteen dollars (15)", "Fifty dollars (50)", "Thirteen dollars (13)", "Thirty dollars (30)"],
              dica: "Em “fifteen” (fif-TÍN), a força fica no fim. Em “fifty” (FÍF-ti), fica no começo.",
            },
            outroJeito: "Truque para não confundir: no ‑teen, a força da voz vai no fim (târ-TÍN, fif-TÍN) e o número fica entre 13 e 19. No ‑ty, a força vai no começo (TÂR-ti, FÍF-ti) e é uma dezena redonda: 30, 50. Na dúvida, peça para a pessoa mostrar o preço escrito.",
            armadilhas: [verboQueSome],
          },
        ],
      },
      {
        titulo: trechos[2],
        licoes: [
          {
            titulo: "Pedir comida no restaurante",
            objetivo: "Fazer um pedido educado no restaurante.",
            conceito: "Para pedir, use “I would like…” ou a forma curta “I'd like…” (eu gostaria de…), seguida do prato, e termine com “please”. É educado e funciona em qualquer lugar.",
            exemplo: "“I'd like a sandwich and an orange juice, please.” Para pedir a conta: “Can I have the check, please?”",
            falas: [
              falaEn("Can I have the menu, please?", "Pode me trazer o cardápio, por favor?"),
              falaEn("I'd like a sandwich, please.", "Eu gostaria de um sanduíche, por favor."),
              falaEn("Water, please.", "Água, por favor."),
              falaEn("It was delicious!", "Estava delicioso!"),
              falaEn("Can I have the check, please?", "Pode me trazer a conta, por favor?"),
            ],
            origem: origemIngles,
            exercicio: {
              tipo: "aberta",
              enunciado: "Escreva em inglês como você pediria um café (coffee) e um pão de queijo (cheese bread), de um jeito educado.",
              minimo: 15,
              gabarito: ["i'd like|i would like|can i have|could i have|may i have", "please", "coffee", "cheese bread|cheesebread"],
              criterios: ["Usa uma forma educada de pedir (I'd like, Can I have…)", "Termina com “please”", "Pede o café (coffee)", "Pede o pão de queijo (cheese bread)"],
              essenciais: [0],
              modelo: "I'd like a coffee and a cheese bread, please.",
              feedbackCorreto: "Pedido perfeito: educado, claro e com “please”.",
              feedbackIncorreto: "Para pedir com educação, use “I'd like…” (eu gostaria de) ou “Can I have…”, diga o que quer (coffee) e termine com “please”.",
              armadilhas: [
                { termos: "i like", aviso: "Cuidado: “I like” quer dizer “eu gosto”. Para pedir, use “I'd like” (eu gostaria de)." },
                { termos: "i want|i wanna", aviso: "“I want” (eu quero) soa brusco num pedido. O jeito educado é “I'd like…” ou “Can I have…”." },
                { termos: "give me", aviso: "“Give me” (me dá) soa como ordem. Prefira “Can I have…, please?”." },
              ],
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Ouça o pedido e escolha o que a pessoa quer.',
                fala: falaEn("Can I have the check, please?", "Pode me trazer a conta, por favor?"),
                opcoes: [op("a", 'A conta'), op("b", 'Um café'), op("c", 'Um sanduíche')],
                gabarito: ["a"],
                feedbackCorreto: '“check” é a conta do restaurante.',
                feedbackIncorreto: 'Ouça (ou leia) de novo: a palavra-chave é “check”. Ela apareceu no exemplo desta lição.',
              },
              {
                tipo: "lacuna",
                enunciado: "Você acabou de sentar. Complete o pedido do cardápio.",
                trecho: "Can I have the ___, please?",
                trechoTipo: "frase",
                gabarito: ["menu"],
                exata: true,
                feedbackCorreto: "“Can I have the menu, please?” pede o cardápio com educação.",
                feedbackIncorreto: "É a palavra para “cardápio”, a primeira coisa que você pede ao sentar. Ela está nas frases desta lição, e no Brasil também se usa.",
              },
            ],
            outroJeito: "Pense no pedido como um sanduíche: o pão de cima é “I'd like…” (eu gostaria de), o recheio é o que você quer e o pão de baixo é “please”. Cuidado com “I like”, sem o ’d: quer dizer “eu gosto”, não “eu quero”.",
            armadilhas: [verboQueSome],
          },
          {
            titulo: "Revisão: um dia de viagem",
            objetivo: "Juntar cumprimentos, imigração, hotel, informações, preços e pedidos numa viagem.",
            conceito: "Num dia de viagem você junta tudo: se apresentar na imigração, fazer o check-in do hotel, pedir informações, entender preços e pedir comida. Ouça com atenção o fim das palavras e, se não entender, peça para repetir: “Sorry, can you repeat?”",
            exemplo: "“Excuse me, where is the bus stop?” — “It's next to the hotel.” — “Thank you! How much is the ticket?” — “It's fifteen dollars.” No almoço: “I'd like a sandwich, please.”",
            falas: [
              falaEn("Where is the bus stop?", "Onde fica o ponto de ônibus?"),
              falaEn("How much is the ticket?", "Quanto custa a passagem?"),
              falaEn("I'd like a sandwich, please.", "Eu gostaria de um sanduíche, por favor."),
              falaEn("Sorry, can you repeat?", "Desculpe, pode repetir?"),
            ],
            origem: origemIngles,
            exercicio: {
              tipo: "aberta",
              enunciado: "Você chegou: escreva em inglês o que diria na imigração e no hotel (de onde você é, por que veio e que tem uma reserva).",
              minimo: 30,
              gabarito: ["i'm from|i am from", "on vacation|vacation", "reservation"],
              criterios: ["Diz de onde é (I'm from…)", "Diz que está de férias (on vacation)", "Diz que tem uma reserva (I have a reservation)"],
              modelo: "I'm from Brazil. I'm here on vacation. I have a reservation.",
              feedbackCorreto: "Com essas três frases você passa pela imigração e faz o check-in.",
              feedbackIncorreto: "Junte as frases das lições: de onde você é (I'm from…), por que veio (I'm here on…) e que tem uma reserva (I have a…).",
              armadilhas: [verboQueSome, deFerias],
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
                feedbackCorreto: "Pergunta, resposta, agradecimento e preço, como numa conversa de verdade.",
                feedbackIncorreto: "Pense na conversa: quem pergunta primeiro? Cada resposta vem logo depois da pergunta dela.",
              },
              {
                tipo: "lacuna",
                enunciado: "Você não entendeu o preço. Complete o pedido para a pessoa repetir.",
                trecho: "Sorry, can you ___?",
                trechoTipo: "frase",
                gabarito: ["repeat"],
                exata: true,
                feedbackCorreto: "“Sorry, can you repeat?” salva qualquer conversa.",
                feedbackIncorreto: "É o verbo “repetir” em inglês, que apareceu no conceito desta lição. Ele se parece com o português.",
              },
            ],
            outroJeito: "Um dia de viagem é uma sequência de conversas curtas com a mesma forma: você pergunta, ouve com atenção o fim das palavras e agradece. Se algo escapar, “Sorry, can you repeat?” dá uma segunda chance a qualquer conversa.",
            armadilhas: [verboQueSome, deFerias],
            pratica: {
              tarefa: "Faça a viagem inteira em voz alta, da imigração ao almoço, sem olhar se conseguir.",
              minutos: 3,
              passos: ["I'm from Brazil. I'm here on vacation.", "Good evening! I have a reservation.", "Excuse me, where is the bus stop?", "How much is the ticket?", "I'd like a sandwich, please."],
              dica: "Se travar numa frase, diga “Sorry, can you repeat?” e siga: é isso que se faz na viagem.",
            },
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
              feedbackCorreto: "Entender a receita, lavar, medir e cortar. Só então o fogo.",
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
                feedbackCorreto: 'Com tudo à mão, a panela não fica esperando.',
                feedbackIncorreto: 'Releia o conceito: o que acontece se você procura o tempero com a panela no fogo?',
              },
            ],
            outroJeito: "Pense num programa de culinária na TV: tudo já está em potinhos antes de a câmera ligar. Em casa funciona igual: separe, meça e corte tudo antes de acender o fogo, e na hora de cozinhar você só junta.",
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
              feedbackCorreto: "Brunoise são cubinhos, julienne são tiras e rodelas são discos.",
              feedbackIncorreto: "Pense no formato de cada corte: qual deles vira tiras, como palitos? Qual vira discos? O que sobrar é o dos cubinhos.",
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
                feedbackCorreto: "A faca afiada corta com pouca força e não escorrega. Acidente acontece com faca cega.",
                feedbackIncorreto: "Pense no que acontece quando a faca não entra no alimento: você faz mais força. E para onde ela vai se escorregar?",
              },
            ],
            outroJeito: "Pense no tamanho do pedaço: quanto menor, mais rápido cozinha e mais se mistura. Os cubinhos bem pequenos somem no refogado, as tiras finas cozinham num instante e os discos são o corte de quem tem pressa.",
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
              feedbackCorreto: "O dobro de água. É a proporção que deixa o grão macio e solto.",
              feedbackIncorreto: "Lembre da regra do conceito: a água é o dobro do arroz. Quanto é o dobro de 1 xícara?",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Por que refogar o arroz antes de pôr a água?',
                opcoes: [op("a", 'A gordura envolve os grãos, e eles cozinham soltos'), op("b", 'Para o arroz cozinhar mais rápido'), op("c", 'Para a água ferver mais depressa')],
                gabarito: ["a"],
                feedbackCorreto: 'O grão envolvido em gordura não gruda no outro.',
                feedbackIncorreto: 'O conceito diz o que deixa cada grão separado. O que envolve o grão no refogado?',
              },
            ],
            pratica: {
              tarefa: "Faça 1 xícara de arroz seguindo o passo a passo. Use o cronômetro para o tempo de cozimento.",
              minutos: 15,
              dica: "Resista à vontade de mexer: mexer solta amido e deixa o arroz empapado.",
            },
            outroJeito: "Pense em cada grão vestindo uma capa de óleo antes de entrar na água: a capa impede que os grãos grudem. Depois, deixe a panela trabalhar sozinha, porque mexer arranca a capa e solta o amido que gruda.",
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
              feedbackCorreto: "8 minutos deixam a gema cremosa, nem mole nem firme.",
              feedbackIncorreto: "Olhe a linha do tempo: 6 minutos é gema mole, 8 é cremosa e 10 é firme.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: 'Complete o passo final.',
                trecho: 'Para parar o cozimento, passe o ovo para a água ___.',
                trechoTipo: "frase",
                gabarito: ['fria', 'gelada'],
                feedbackCorreto: 'A água fria para o cozimento na hora, e a gema fica no ponto.',
                feedbackIncorreto: 'É o contrário da água fervente: ela esfria o ovo na hora.',
              },
            ],
            pratica: {
              tarefa: "Cozinhe um ovo no ponto que você prefere. Use o cronômetro e, no fim, passe o ovo para água fria.",
              minutos: 8,
            },
            outroJeito: "Pense na gema como algo que vai firmando aos poucos: quanto mais minutos na água fervendo, mais dura ela fica. A água fria no fim é o freio: para o cozimento na hora certa.",
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
              feedbackCorreto: "Erva fresca vai no fim, para o aroma chegar ao prato.",
              feedbackIncorreto: "Pense no cheiro da salsinha picada na hora: o que acontece com um perfume que fica muito tempo no calor?",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Quando a salsinha fresca entra no prato?',
                opcoes: [op("a", 'No fim, quando você desliga o fogo'), op("b", 'No começo, junto com o alho'), op("c", 'Na água do cozimento')],
                gabarito: ["a"],
                feedbackCorreto: 'No fim, ela guarda o aroma.',
                feedbackIncorreto: 'Ervas frescas perdem o aroma no fogo. Quando ela fica menos tempo no calor?',
              },
            ],
            outroJeito: "Tempere como quem acerta o volume da música: aos poucos, provando no caminho. Aumentar é fácil; abaixar depois de passar do ponto é quase impossível. E as ervas frescas são o perfume do prato: entram no fim, para o cheiro não evaporar.",
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
                feedbackCorreto: 'O que demora mais começa primeiro, e o resto cabe no tempo dele.',
                feedbackIncorreto: 'Pense no que demora mais: ele começa primeiro.',
              },
            ],
            outroJeito: "Planeje de trás para a frente: o que demora mais começa primeiro. Se o arroz leva uns 20 minutos e o ovo 8, o arroz vai ao fogo antes, e o resto acontece enquanto ele cozinha.",
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
              feedbackCorreto: "A história do território começa muito antes de 1500, com os povos originários.",
              feedbackIncorreto: "Releia o conceito: quem já vivia aqui quando a frota chegou? Muitas palavras que usamos até hoje vêm das línguas desses povos.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Qual destas palavras vem do tupi?',
                opcoes: [op("a", 'Mandioca'), op("b", 'Escola'), op("c", 'Janela')],
                gabarito: ["a"],
                feedbackCorreto: 'Mandioca vem do tupi, como pipoca e Ipiranga.',
                feedbackIncorreto: 'O exemplo da lição cita palavras de origem tupi; uma delas está nas opções.',
              },
            ],
            outroJeito: "Pense numa casa que já tinha moradores quando um visitante chegou: em 1500, o território não estava vazio. Os tupis, os guaranis e os jês, entre centenas de povos, já davam nome a rios e lugares, e muitos desses nomes usamos até hoje.",
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
              feedbackCorreto: "O clima e o solo do litoral nordestino favoreciam a cana.",
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
                feedbackCorreto: 'A riqueza do açúcar dependia da escravidão.',
                feedbackIncorreto: 'Releia o conceito: quem trabalhava nos engenhos, e em que condição?',
              },
            ],
            outroJeito: "Pense no engenho como uma fábrica no meio da plantação: a cana entrava de um lado e o açúcar saía do outro, rumo à Europa. Essa riqueza dependia do trabalho forçado de africanos escravizados, e por isso o Nordeste foi o centro da colônia nesses séculos.",
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
              feedbackCorreto: "1500, 1808, 1822 e 1889.",
              feedbackIncorreto: "Use a linha do tempo da lição: os marcos estão em ordem, do mais antigo ao mais recente. Comece pelo que aconteceu primeiro.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Qual acontecimento preparou o caminho para a Independência?',
                opcoes: [op("a", 'A vinda da família real, em 1808'), op("b", 'A Lei Áurea, em 1888'), op("c", 'A Proclamação da República, em 1889')],
                gabarito: ["a"],
                feedbackCorreto: 'Com a corte no Rio, o Brasil ganhou peso e autonomia.',
                feedbackIncorreto: 'Procure o que veio antes de 1822 e fez do Rio a sede do governo.',
              },
            ],
            outroJeito: "Pense em peças de dominó em fila: uma derruba a outra. A família real chega ao Rio, o Rio vira sede do governo, o Brasil ganha autonomia, e isso empurra a Independência. A República vem logo depois do fim da escravidão.",
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
              feedbackCorreto: "Cada personagem ligado ao seu marco.",
              feedbackIncorreto: "Volte à linha do tempo: Dom João chega em 1808, Dom Pedro declara a Independência em 1822, Isabel assina a Lei Áurea em 1888 e Deodoro proclama a República em 1889.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: "Complete a frase que, segundo a tradição, Dom Pedro disse no Ipiranga.",
                trecho: "“Independência ou ___!”",
                trechoTipo: "citacao",
                gabarito: ["morte"],
                feedbackCorreto: "“Independência ou morte!”, o chamado Grito do Ipiranga.",
                feedbackIncorreto: "Lembre do Grito do Ipiranga, em 1822: a frase opõe a independência ao pior destino possível.",
              },
            ],
            outroJeito: "Pense numa família em que o pai volta para a terra natal e deixa o filho cuidando da casa: Dom João voltou a Portugal e Dom Pedro ficou como regente. Quando Portugal quis mandar de novo, o filho declarou a casa independente, às margens do Ipiranga.",
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
              feedbackCorreto: "13 de maio de 1888.",
              feedbackIncorreto: "A Lei Áurea veio um ano antes da Proclamação da República, que foi em 1889.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: "O que aconteceu em 15 de novembro de 1889?",
                opcoes: [op("a", "A Proclamação da República"), op("b", "A Independência do Brasil"), op("c", "A chegada da família real")],
                gabarito: ["a"],
                feedbackCorreto: "Deodoro da Fonseca proclamou a República, e o Império acabou.",
                feedbackIncorreto: "Em 15 de novembro de 1889 foi proclamada a República. A Independência é de 1822 e a família real chegou em 1808.",
              },
            ],
            outroJeito: "Pense nas duas datas como causa e consequência coladas: a Lei Áurea acabou com a escravidão e tirou dos grandes fazendeiros o motivo para apoiar o imperador. Sem esse apoio, a monarquia caiu no ano seguinte, com a República.",
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
                feedbackCorreto: '1822, o ano do Grito do Ipiranga.',
                feedbackIncorreto: 'Foi 14 anos depois da chegada da família real, em 1808.',
              },
            ],
            outroJeito: "Uma boa explicação histórica é como uma notícia: o que aconteceu, quem foi afetado e o que mudou depois. Se você responde às três perguntas com um fato e uma data, a explicação fica completa.",
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
              feedbackCorreto: "O denominador, embaixo, conta o total de partes iguais.",
              feedbackIncorreto: "O 6 fica embaixo: é o denominador, o total de partes iguais. As escolhidas são as 5 de cima.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: "Uma barra foi dividida em 5 partes iguais e 2 foram pintadas. Complete a fração pintada.",
                trecho: "2/___",
                trechoTipo: "formula",
                gabarito: ["5"],
                feedbackCorreto: "2 pintadas de 5 partes iguais, 2/5.",
                feedbackIncorreto: "O denominador conta todas as partes iguais da barra, pintadas ou não. Conte de novo.",
              },
            ],
            outroJeito: "Pense numa barra de chocolate: o número de baixo diz em quantos quadradinhos iguais ela foi dividida, e o de cima, quantos quadradinhos você pegou. 3/8 é “peguei 3 de 8 quadradinhos”.",
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
              feedbackCorreto: "Em cada par, numerador e denominador foram multiplicados pelo mesmo número.",
              feedbackIncorreto: "Procure o número que multiplica o numerador e o denominador ao mesmo tempo. Comece por 1/2: por quanto você multiplica o 2 para chegar a um denominador da direita?",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: 'Complete a fração equivalente.',
                trecho: '1/3 = ___/6',
                trechoTipo: "frase",
                gabarito: ['2'],
                feedbackCorreto: '1/3 vezes 2 em cima e embaixo dá 2/6.',
                feedbackIncorreto: 'Multiplique o numerador e o denominador pelo mesmo número: 3 vezes quanto dá 6?',
              },
            ],
            outroJeito: "Pense em trocar uma nota de 10 reais por duas de 5: o valor é o mesmo, só muda a quantidade de notas. Multiplicar em cima e embaixo pelo mesmo número corta as mesmas partes em pedaços menores, sem mudar o total.",
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
              feedbackCorreto: "Com o mesmo denominador, basta comparar os numeradores.",
              feedbackIncorreto: "Todas são sétimos. Compare só os numeradores: 1, 3, 5 e 6.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Qual é maior: 3/8 ou 5/8?',
                opcoes: [op("a", '5/8'), op("b", '3/8'), op("c", 'São iguais')],
                gabarito: ["a"],
                feedbackCorreto: 'Oitavos dos dois lados, e 5 oitavos são mais que 3.',
                feedbackIncorreto: 'Com o mesmo denominador, as partes têm o mesmo tamanho. Quem tem mais partes?',
              },
            ],
            outroJeito: "Se as fatias têm o mesmo tamanho, ganha quem tem mais fatias. Com o mesmo número embaixo, basta comparar o número de cima.",
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
              feedbackCorreto: "Oito partes são menores que quatro partes do mesmo inteiro. 1/8 < 1/4.",
              feedbackIncorreto: "Pense numa pizza: se você a divide em mais fatias, cada fatia fica maior ou menor?",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Qual destas frações é a menor?',
                opcoes: [op("a", '1/10'), op("b", '1/5'), op("c", '1/2')],
                gabarito: ["a"],
                feedbackCorreto: 'Dividido em 10, cada parte é a menor de todas.',
                feedbackIncorreto: 'Mesmo numerador: quanto mais partes o inteiro tem, menor é cada parte.',
              },
            ],
            outroJeito: "Pense em dividir uma pizza entre mais amigos: quanto mais gente, menor a fatia de cada um. Com o mesmo número em cima, a fração com o número de baixo maior tem pedaços menores, então vale menos.",
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
              feedbackCorreto: "2 + 5 = 7, e o denominador continua 9.",
              feedbackIncorreto: "Com o mesmo denominador, some só os numeradores; o denominador continua 9.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: "Quanto é 3/10 + 4/10?",
                opcoes: [op("a", "7/10"), op("b", "7/20"), op("c", "12/10")],
                gabarito: ["a"],
                feedbackCorreto: "3 + 4 = 7 décimos.",
                feedbackIncorreto: "Os décimos continuam décimos: some os numeradores (3 + 4 = 7) e mantenha o 10.",
              },
            ],
            pratica: {
              tarefa: "Pegue uma folha, dobre ao meio três vezes e abra: ela fica com 8 partes iguais. Pinte 3/8 e depois mais 2/8. Quanto da folha ficou pintado?",
              minutos: 5,
              passos: ["Dobre a folha ao meio três vezes.", "Abra e conte as 8 partes iguais.", "Pinte 3 partes, depois mais 2.", "Escreva a fração pintada."],
              dica: "Se as dobras não ficarem iguais, as partes não são oitavos. Capriche no vinco.",
            },
            outroJeito: "Pense em somar maçãs: 2 maçãs + 5 maçãs = 7 maçãs. Nas frações com o mesmo denominador, “nonos” é o nome da fruta: 2 nonos + 5 nonos = 7 nonos. O nome não muda; só a quantidade.",
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
                feedbackCorreto: 'Sétimos dos dois lados, então junte os numeradores.',
                feedbackIncorreto: 'Com o mesmo denominador, junte só os numeradores.',
              },
            ],
            outroJeito: "Uma boa explicação de soma de frações responde a duas perguntas: qual é o tamanho das partes (o denominador, que não muda) e quantas partes você juntou (a soma dos numeradores).",
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
              feedbackCorreto: "Limpar a lente e firmar as mãos resolve a maioria das fotos borradas.",
              feedbackIncorreto: "Pense no que borra uma foto até num celular caro: o que fica entre a cena e a câmera? E se a mão se mexe na hora do toque?",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Como segurar o celular para a foto não tremer?',
                opcoes: [op("a", 'Com as duas mãos e os cotovelos junto ao corpo'), op("b", 'Com uma mão, de braço esticado'), op("c", 'Pela ponta, com dois dedos')],
                gabarito: ["a"],
                feedbackCorreto: 'Duas mãos e cotovelos firmes seguram o tremor.',
                feedbackIncorreto: 'Releia o conceito: o que fazer com as mãos e com os cotovelos?',
              },
            ],
            pratica: {
              tarefa: "Tire uma foto de um objeto perto de você. Depois limpe a lente com um pano macio, segure o celular com as duas mãos e tire a mesma foto. Compare as duas.",
              minutos: 2,
              dica: "Use um pano de óculos ou a barra de uma camiseta de algodão. Evite papel, que pode riscar a lente.",
            },
            outroJeito: "Pense na lente como os óculos do celular: com uma marca de dedo, tudo fica embaçado, por melhor que seja a câmera. E segurar firme é como fotografar prendendo a respiração: cotovelos colados no corpo viram um tripé.",
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
              feedbackCorreto: "Numa das linhas, dando mais espaço para o céu ou para o mar.",
              feedbackIncorreto: "Lembre da grade da câmera, como um jogo da velha: qual lugar a regra dos terços pede para evitar? O horizonte fica melhor longe dele.",
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
                feedbackCorreto: 'Fora do centro, numa linha da grade, a foto respira.',
                feedbackIncorreto: 'Pense no jogo da velha da tela: onde a lição manda pôr o assunto?',
              },
            ],
            pratica: {
              tarefa: "Ative a grade da câmera e fotografe um objeto três vezes: no meio, num cruzamento da esquerda e num da direita. Veja qual ficou mais interessante.",
              minutos: 3,
            },
            outroJeito: "Pense no jogo da velha: o centro é o lugar óbvio, mas as linhas e os cruzamentos dão mais movimento à foto. Coloque o assunto num cruzamento e o horizonte numa das linhas, deixando mais espaço para o que importa, o céu ou o mar.",
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
              feedbackCorreto: "Escolher de onde vem a luz é metade da foto.",
              feedbackIncorreto: "Reveja o conceito: contraluz faz silhueta, janela de lado suaviza e o sol do meio-dia endurece as sombras.",
            },
            extras: [
              {
                tipo: "multipla_escolha",
                enunciado: 'Quando acontece a hora dourada?',
                opcoes: [op("a", 'Perto do nascer e do pôr do sol'), op("b", 'Ao meio-dia'), op("c", 'À meia-noite')],
                gabarito: ["a"],
                feedbackCorreto: 'Com o sol baixo, a luz fica quente e suave.',
                feedbackIncorreto: 'É quando o sol está baixo e a luz fica quente e suave.',
              },
            ],
            outroJeito: "Pense na luz como uma lanterna: apontada de cima, como o sol do meio-dia, ela marca sombras duras; vinda de lado e suave, como a da janela, ela desenha o rosto. A hora dourada é a lanterna mais quente e baixa do dia.",
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
              feedbackCorreto: "Enquadra, foca, ajusta e só então dispara.",
              feedbackIncorreto: "Primeiro você escolhe o que vai aparecer, depois foca, ajusta o brilho e por fim tira a foto.",
            },
            extras: [
              {
                tipo: "lacuna",
                enunciado: 'Complete o gesto.',
                trecho: 'Depois de tocar no rosto, deslize o dedo para ___ para clarear a foto.',
                trechoTipo: "frase",
                gabarito: ['cima'],
                feedbackCorreto: 'Para cima clareia, para baixo escurece.',
                feedbackIncorreto: 'Para baixo escurece; clarear é o movimento contrário.',
              },
            ],
            pratica: {
              tarefa: "Fotografe algo perto de uma janela. Toque no assunto para focar, deslize o brilho para cima e para baixo e tire duas versões.",
              minutos: 3,
            },
            outroJeito: "Tocar na tela é apontar com o dedo: “é isto que importa”. O celular foca e acerta a luz ali. Se ainda ficar claro ou escuro demais, o controle de brilho funciona como um regulador de luz: para cima clareia, para baixo escurece.",
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
              feedbackCorreto: "O toque diz ao celular o que deve ficar nítido.",
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
                feedbackCorreto: "Aproxime-se do assunto em vez de esticar o zoom.",
                feedbackIncorreto: "Pense no que o zoom digital faz: ele aproxima a lente ou só estica a imagem que já foi capturada?",
              },
            ],
            outroJeito: "Antes de cada retrato, faça três perguntas: de onde vem a luz (de lado, suave), onde ficam os olhos (numa linha da grade) e onde está o foco (no rosto). Se precisar de mais perto, dê dois passos em vez de usar o zoom.",
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
                feedbackCorreto: 'A luz de lado é suave e valoriza o rosto.',
                feedbackIncorreto: 'Lembre da lição de luz natural: qual luz é suave e valoriza rostos?',
              },
            ],
            outroJeito: "Uma boa explicação de foto é como um bilhete: diz de onde vem a luz, onde ficou o assunto e onde você tocou para focar. Quem lê deve conseguir refazer a foto só com a sua explicação.",
          },
        ],
      },
    ],
  },
};

/** Demos na ordem de reconhecimento. SQL tem a sua própria trilha em `falsa.ts`. */
export const DEMOS: readonly Demo[] = [violao, ingles, culinaria, historia, fracoes, fotografia, geometria, funcoes];

export function demoDoObjetivo(objetivo: string): Demo | undefined {
  return DEMOS.find((demo) => demo.reconhecer(objetivo));
}

export function demoPelaChave(chave: string): Demo | undefined {
  return DEMOS.find((demo) => demo.chave === chave);
}
