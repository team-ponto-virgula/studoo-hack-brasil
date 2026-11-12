import type { ConteudoLicao, ExercicioInterno } from "@/dominio/aprendizado/plano";

const origem = "Conteúdo simulado do Studoo (IA falsa)";

const estrutura = [
  { fluxo: "Primeiros passos", licoes: ["Mapa do assunto", "Vocabulário essencial", "Primeiro exemplo"] },
  { fluxo: "Praticando", licoes: ["Exercício guiado", "Erros comuns", "Variações"] },
  { fluxo: "Indo além", licoes: ["Casos do dia a dia", "Revisão ativa", "Desafio final"] },
] as const;

/** Hash FNV-1a: estável entre execuções, para a trilha de um objetivo sempre sair igual. */
function hash(texto: string): number {
  let valor = 0x811c9dc5;
  for (const caractere of texto) {
    valor = Math.imul(valor ^ caractere.codePointAt(0)!, 0x01000193) >>> 0;
  }
  return valor;
}

function normalizar(objetivo: string): string {
  return objetivo.replace(/\s+/g, " ").trim();
}

/** Nome curto do assunto para usar dentro de frases: sem pontuação final e com até 60 caracteres. */
function assuntoDe(objetivo: string): string {
  const limpo = normalizar(objetivo).replace(/[\s.!?…:;,]+$/u, "");
  if (limpo.length <= 60) return limpo;
  return `${limpo.slice(0, 59).replace(/\s+\S*$/, "")}…`;
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
}

export function planoGenerico(objetivo: string) {
  const normalizado = normalizar(objetivo);
  return {
    titulo: maiuscula(assuntoDe(objetivo)),
    objetivo: normalizado,
    origem,
    fluxos: estrutura.map(({ fluxo, licoes }) => ({
      titulo: fluxo,
      licoes: licoes.map((titulo) => ({ titulo })),
    })),
  };
}

type Escolha = { certa: string; erradas: [string, string] };

function lacuna(
  enunciado: string,
  trecho: string,
  gabarito: string,
  feedbackCorreto: string,
  feedbackIncorreto: string,
): ExercicioInterno {
  return {
    tipo: "lacuna",
    enunciado: `${enunciado} Responda com uma palavra.`,
    trecho,
    gabarito: [gabarito],
    feedbackCorreto,
    feedbackIncorreto,
  };
}

/** A opção certa muda de posição conforme o objetivo, sem perder o determinismo. */
function multiplaEscolha(
  semente: number,
  enunciado: string,
  { certa, erradas }: Escolha,
  feedbackCorreto: string,
  feedbackIncorreto: string,
  contexto?: string,
): ExercicioInterno {
  const ordem = [certa, ...erradas];
  const deslocamento = semente % ordem.length;
  const girada = [...ordem.slice(deslocamento), ...ordem.slice(0, deslocamento)];
  const ids = ["a", "b", "c"];
  const opcoes = girada.map((texto, indice) => ({ id: ids[indice], texto }));
  return {
    tipo: "multipla_escolha",
    enunciado,
    ...(contexto && { contexto }),
    opcoes,
    gabarito: [opcoes.find(({ texto }) => texto === certa)!.id],
    feedbackCorreto,
    feedbackIncorreto,
  };
}

function montar(assunto: string, semente: number, fluxo: number, licao: number): ConteudoLicao | null {
  const s = (n: number) => semente + n;
  const aspas = `“${assunto}”`;
  switch (`${fluxo}.${licao}`) {
    case "0.0":
      return {
        objetivo: `Enxergar as partes principais de ${aspas} antes de estudar.`,
        conceito: `Um mapa do assunto lista as partes de ${aspas} e mostra como elas se ligam. Com o mapa pronto, você sabe por onde começar e o que deixar para depois.`,
        exemplo: `Para ${aspas}, escreva em uma folha três ou quatro partes do assunto e ligue as que dependem uma da outra. A parte que não depende de nenhuma é um bom começo.`,
        origem,
        exercicio: lacuna(
          `Complete a frase sobre como começar a estudar ${aspas}.`,
          "Antes de estudar, desenhe o ___ do assunto e liste as suas partes.",
          "mapa",
          "Isso mesmo: o mapa mostra as partes e a ordem em que elas se ligam.",
          "A palavra é mapa. Ele organiza as partes do assunto antes de você entrar nos detalhes.",
        ),
      };
    case "0.1":
      return {
        objetivo: `Reunir os termos que aparecem com mais frequência em ${aspas}.`,
        conceito: "Cada área tem palavras próprias. Anotar cada termo com uma explicação sua e um exemplo evita que ele vire apenas uma palavra decorada.",
        exemplo: `Ao ler sobre ${aspas}, separe os termos novos em uma lista. Ao lado de cada um, escreva o que ele significa com as suas palavras.`,
        origem,
        exercicio: multiplaEscolha(
          s(1),
          `Qual hábito ajuda a fixar os termos novos de ${aspas}?`,
          {
            certa: "Escrever cada termo com um exemplo seu",
            erradas: ["Ler a lista de termos uma única vez", "Pular os termos mais difíceis"],
          },
          "Um exemplo seu liga o termo ao que você já conhece, e isso ajuda a lembrar.",
          "Ler uma vez ou pular os difíceis não fixa nada. Escrever o termo com um exemplo seu é o que cria a ligação.",
        ),
      };
    case "0.2":
      return {
        objetivo: `Ver um primeiro exemplo completo de ${aspas}.`,
        conceito: "Um bom exemplo é pequeno e completo: mostra o ponto de partida, o passo que importa e o resultado. Entender o exemplo vale mais do que ler muitos deles.",
        exemplo: `Escolha um exemplo curto de ${aspas}. Leia o ponto de partida, cubra a solução e tente chegar ao resultado antes de conferir.`,
        origem,
        exercicio: lacuna(
          "Complete a frase sobre como aproveitar um exemplo.",
          "Depois de ler um exemplo, tente ___ o exemplo sem olhar.",
          "refazer",
          "Refazer sem olhar mostra o que você entendeu e o que ainda falta.",
          "A palavra é refazer. Repetir o exemplo sem olhar é o que mostra se você entendeu.",
        ),
      };
    case "1.0":
      return {
        objetivo: `Resolver um exercício de ${aspas} com ajuda em cada passo.`,
        conceito: "Um exercício guiado divide o problema em passos pequenos. Em cada passo você decide algo simples, e a soma dos passos resolve o problema inteiro.",
        exemplo: `Em um problema sobre ${aspas}, primeiro diga o que é pedido. Depois liste o que você já sabe e só então escolha a primeira ação.`,
        origem,
        exercicio: multiplaEscolha(
          s(2),
          "Qual é o primeiro passo de um exercício guiado?",
          {
            certa: "Dizer com as suas palavras o que é pedido",
            erradas: ["Escolher a resposta que parece mais provável", "Copiar a solução de um exemplo parecido"],
          },
          "Entender o pedido evita resolver o problema errado.",
          "Escolher no palpite ou copiar não mostra o que o problema pede. Comece dizendo com as suas palavras o que é pedido.",
          `Você está praticando ${aspas}.`,
        ),
      };
    case "1.1":
      return {
        objetivo: `Reconhecer os erros mais comuns ao estudar ${aspas}.`,
        conceito: "Errar faz parte de aprender. Anotar o erro e a causa dele transforma a tentativa que falhou em um guia do que revisar.",
        exemplo: `Quando errar um exercício de ${aspas}, escreva o que respondeu, o que era certo e o que fez você se enganar.`,
        origem,
        exercicio: lacuna(
          "Complete a frase sobre como lidar com um erro.",
          "Cada ___ que você anota vira uma pista do que revisar.",
          "erro",
          "Exatamente: o erro anotado mostra onde vale a pena voltar.",
          "A palavra é erro. Anotar o erro e a causa dele indica o que revisar.",
        ),
      };
    case "1.2":
      return {
        objetivo: `Praticar ${aspas} em situações um pouco diferentes.`,
        conceito: "Uma ideia só está aprendida quando funciona fora do exemplo original. Mudar um detalhe do problema mostra se você entendeu a regra ou só decorou a resposta.",
        exemplo: `Pegue um exercício de ${aspas} que você acertou e mude um dado. Veja se o mesmo caminho ainda funciona e o que muda no resultado.`,
        origem,
        exercicio: multiplaEscolha(
          s(3),
          "Por que vale a pena mudar um detalhe de um exercício já resolvido?",
          {
            certa: "Para testar se você entendeu a regra",
            erradas: ["Para gastar mais tempo no mesmo exercício", "Para esquecer o exercício original"],
          },
          "A variação mostra se a regra se sustenta quando o problema muda.",
          "A variação não serve para gastar tempo nem para esquecer o original. Ela testa se você entendeu a regra.",
        ),
      };
    case "2.0":
      return {
        objetivo: `Aplicar ${aspas} em situações do dia a dia.`,
        conceito: "Ligar o que você estuda a algo que acontece na sua rotina torna o assunto mais fácil de lembrar e mostra para que ele serve.",
        exemplo: `Procure uma situação da sua semana em que ${aspas} apareça ou ajudaria. Descreva a situação em duas frases.`,
        origem,
        exercicio: multiplaEscolha(
          s(4),
          `Qual é uma boa forma de ligar ${aspas} ao seu dia a dia?`,
          {
            certa: "Descrever uma situação real em que o assunto ajudaria",
            erradas: ["Decorar a definição sem aplicar", "Evitar pensar em usos práticos"],
          },
          "Uma situação real dá um motivo para lembrar do assunto.",
          "Decorar ou evitar usos práticos não cria ligação. Descreva uma situação real em que o assunto ajudaria.",
        ),
      };
    case "2.1":
      return {
        objetivo: `Revisar ${aspas} tentando lembrar antes de consultar.`,
        conceito: "Na revisão ativa, você tenta lembrar do assunto antes de abrir o material. O esforço de lembrar fortalece a memória mais do que reler.",
        exemplo: `Feche as anotações e escreva tudo o que lembra sobre ${aspas}. Só então confira o que faltou e anote para a próxima revisão.`,
        origem,
        exercicio: lacuna(
          "Complete a frase sobre revisão ativa.",
          "Na revisão ativa, você tenta lembrar antes de ___ as anotações.",
          "consultar",
          "Isso: tentar lembrar primeiro dá mais resultado do que reler.",
          "A palavra é consultar. A revisão ativa pede o esforço de lembrar antes de abrir as anotações.",
        ),
      };
    case "2.2":
      return {
        objetivo: `Fechar a trilha de ${aspas} com um desafio que reúne o que você viu.`,
        conceito: "O desafio final junta as partes do mapa, os termos e os erros que você anotou. Resolvê-lo sem ajuda mostra o que você já domina e o que ainda merece revisão.",
        exemplo: `Monte um problema sobre ${aspas} que use pelo menos duas partes do seu mapa. Resolva sem consultar e depois confira com as anotações.`,
        origem,
        exercicio: multiplaEscolha(
          s(5),
          "O que fazer ao terminar o desafio final?",
          {
            certa: "Conferir com as anotações e marcar o que revisar",
            erradas: ["Dar o assunto por encerrado sem conferir", "Apagar as anotações de erros"],
          },
          "Conferir e marcar o que revisar fecha o ciclo de estudo.",
          "Encerrar sem conferir ou apagar os erros joga fora o que você aprendeu. Confira com as anotações e marque o que revisar.",
        ),
      };
    default:
      return null;
  }
}

/** Conteúdo simulado e determinístico da lição `licao` do fluxo `fluxo`. Null fora da trilha de 3 × 3. */
export function conteudoGenerico(objetivo: string, fluxo: number, licao: number): ConteudoLicao | null {
  return montar(assuntoDe(objetivo), hash(normalizar(objetivo)), fluxo, licao);
}
