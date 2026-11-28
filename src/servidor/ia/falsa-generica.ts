import type { Opcao } from "@studoo/contratos";
import type { ConteudoLicao, ExercicioInterno } from "@/dominio/aprendizado/plano";

const origem = "Modo demonstração: conteúdo de exemplo";

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
    trechoTipo: "frase",
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

const op = (id: string, texto: string): Opcao => ({ id, texto });

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
          "O mapa mostra as partes e a ordem em que elas se ligam.",
          "Releia o conceito: é o desenho que mostra as partes do assunto e como elas se ligam.",
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
          "Releia o exemplo: o que você faz com ele quando cobre a solução e tenta chegar sozinho ao resultado?",
        ),
      };
    case "1.0":
      return {
        objetivo: `Resolver um exercício de ${aspas} com ajuda em cada passo.`,
        conceito: "Um exercício guiado divide o problema em passos pequenos. Em cada passo você decide algo simples, e a soma dos passos resolve o problema inteiro.",
        exemplo: `Em um problema sobre ${aspas}, primeiro diga o que é pedido. Depois liste o que você já sabe e só então escolha a primeira ação.`,
        origem,
        exercicio: {
          tipo: "ordenar",
          enunciado: "Coloque os passos de um exercício guiado na ordem certa.",
          contexto: `Você está praticando ${aspas}.`,
          itens: [
            op("pedido", "Dizer com as suas palavras o que é pedido"),
            op("sabe", "Listar o que você já sabe"),
            op("acao", "Escolher a primeira ação"),
            op("conferir", "Conferir o resultado"),
          ],
          gabarito: ["pedido", "sabe", "acao", "conferir"],
          feedbackCorreto: "Entender o pedido, juntar o que já sabe, agir e conferir.",
          feedbackIncorreto: "Comece pelo pedido: diga o que o problema quer. Depois liste o que já sabe, escolha a primeira ação e confira no fim.",
        },
      };
    case "1.1":
      return {
        objetivo: `Reconhecer os erros mais comuns ao estudar ${aspas}.`,
        conceito: "Errar faz parte de aprender. Anotar o erro e a causa dele transforma a tentativa que falhou em um guia do que revisar.",
        exemplo: `Quando errar um exercício de ${aspas}, escreva o que respondeu, o que era certo e o que fez você se enganar.`,
        origem,
        exercicio: {
          tipo: "verdadeiro_falso",
          enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
          afirmacao: `Errar um exercício de ${aspas} mostra que você não leva jeito para o assunto.`,
          justificativas: [
            op("pista", "O erro anotado mostra exatamente o que revisar"),
            op("talento", "Quem tem talento acerta tudo de primeira"),
            op("sorte", "Acertar ou errar depende só de sorte"),
          ],
          gabarito: ["falso", "pista"],
          feedbackCorreto: "Errar faz parte. O erro anotado vira um guia do que revisar.",
          feedbackIncorreto: "É falsa: o erro não mede talento. Anotado, ele mostra exatamente onde vale a pena voltar.",
        },
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
        pratica: {
          tarefa: `Hoje, procure uma situação da sua rotina em que ${aspas} aparece ou ajudaria. Anote a situação em duas frases.`,
          minutos: 5,
          passos: ["Pense no que você fez hoje.", "Escolha um momento em que o assunto apareceu.", "Escreva o que aconteceu e como o assunto ajudaria."],
        },
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
          "Tentar lembrar primeiro dá mais resultado do que reler.",
          "Releia o conceito: o esforço de lembrar vem antes. Que verbo diz o que você faz com as anotações depois?",
        ),
      };
    case "2.2":
      return {
        objetivo: `Fechar a trilha de ${aspas} com um desafio que reúne o que você viu.`,
        conceito: "O desafio final junta as partes do mapa, os termos e os erros que você anotou. Resolvê-lo sem ajuda mostra o que você já domina e o que ainda merece revisão.",
        exemplo: `Monte um problema sobre ${aspas} que use pelo menos duas partes do seu mapa. Resolva sem consultar e depois confira com as anotações.`,
        origem,
        exercicio: {
          tipo: "aberta",
          enunciado: `Explique com as suas palavras uma ideia de ${aspas} que você aprendeu e dê um exemplo.`,
          minimo: 40,
          gabarito: ["exemplo|por exemplo|como quando|imagine|tipo quando", "porque|por que|pois|entao|assim|isso faz"],
          criterios: ["Dá um exemplo concreto", "Explica o porquê da ideia"],
          modelo: `Uma ideia de ${aspas} que aprendi é começar pelo mapa do assunto. Por exemplo, antes de estudar, eu listo as partes e vejo qual depende de qual, porque assim sei por onde começar.`,
          feedbackCorreto: "Boa explicação: tem uma ideia, um exemplo e o porquê.",
          feedbackIncorreto: "Tente de novo com um exemplo concreto (“por exemplo…”) e explique o porquê (“porque…”).",
        },
      };
    default:
      return null;
  }
}

/** Conteúdo simulado e determinístico da lição `licao` do fluxo `fluxo`. Null fora da trilha de 3 × 3. */
export function conteudoGenerico(objetivo: string, fluxo: number, licao: number): ConteudoLicao | null {
  return montar(assuntoDe(objetivo), hash(normalizar(objetivo)), fluxo, licao);
}
