export type QuestaoDeAplicacao = {
  habilidade: string;
  enunciado: string;
  opcoes: string[];
  correta: number;
  conceito: string;
  exemplo: string;
};

export const EQUACAO = [
  {
    habilidade: 'Isolar a incógnita',
    enunciado: 'Qual valor de x torna 2x + 3 = 11 verdadeira?',
    opcoes: ['7', '4', '5'], correta: 1,
    conceito: 'Para isolar x, desfaça as operações na ordem inversa, aplicando a mesma operação aos dois membros.',
    exemplo: 'Em 3x + 2 = 14, subtraia 2 dos dois membros e divida por 3. Você obtém x = 4.',
  },
  {
    habilidade: 'Preservar a igualdade',
    enunciado: 'De x + 5 = 12 para x = 7, o que precisa ser feito aos dois membros?',
    opcoes: ['Somar 5', 'Dividir por 5', 'Subtrair 5'], correta: 2,
    conceito: 'A igualdade funciona como uma balança: a mesma adição ou subtração dos dois lados preserva a igualdade.',
    exemplo: 'Em x + 4 = 9, retire 4 dos dois lados. Assim x = 5.',
  },
  {
    habilidade: 'Resolver equações com x dos dois lados',
    enunciado: 'Qual valor resolve 3(x + 2) = x + 14?',
    opcoes: ['4', '5', '8'], correta: 0,
    conceito: 'Distribua os fatores e reúna os termos com x no mesmo membro antes de isolar a incógnita.',
    exemplo: 'Em 2(x + 3) = x + 9, distribua o 2 e retire x dos dois lados. Fica x + 6 = 9, então x = 3.',
  },
  {
    habilidade: 'Modelar um problema com equação',
    enunciado: 'Uma corrida custa R$ 5 fixos e R$ 3 por km. Qual equação representa um total de R$ 20?',
    opcoes: ['5k + 3 = 20', '3k + 5 = 20', '3k = 20 + 5'], correta: 1,
    conceito: 'Escolha a incógnita, separe o valor fixo do valor que varia e confira se cada termo tem a mesma unidade.',
    exemplo: 'Num frete de R$ 8 fixos mais R$ 2 por quilo, pagar R$ 18 corresponde a 8 + 2k = 18. Logo, k = 5 quilos.',
  },
  {
    habilidade: 'Conferir a solução no contexto',
    enunciado: 'Uma compra tem uma taxa fixa de R$ 4 e custa R$ 6 por item. Para um total de R$ 22, qual verificação confirma a quantidade de itens?',
    opcoes: ['6 × 4 + 4 = 22', '6 × 3 + 4 = 22', '6 × 2 + 4 = 22'], correta: 1,
    conceito: 'Substituir a solução na equação original confirma a igualdade. Depois confira se o valor faz sentido e tem a unidade pedida.',
    exemplo: 'Se x = 3, então 6x + 4 = 18 + 4 = 22. Como x conta itens, três é uma solução inteira que cabe no contexto.',
  },
] satisfies QuestaoDeAplicacao[];

export const SOLAR = [
  {
    habilidade: 'Distinguir estrelas, planetas e luas',
    enunciado: 'Um astro gira ao redor de Marte e reflete luz do Sol. Como se classifica nesse sistema?',
    opcoes: ['Estrela', 'Planeta', 'Lua'], correta: 2,
    conceito: 'Uma estrela emite luz própria. Um planeta orbita sua estrela, enquanto uma lua orbita um planeta ou outro corpo menor.',
    exemplo: 'A Lua é um satélite natural da Terra. O brilho que vemos dela vem principalmente da luz solar refletida.',
  },
  {
    habilidade: 'Explicar fases da Lua',
    enunciado: 'Ao longo do mês vemos porções diferentes da Lua iluminada. Qual é a causa principal?',
    opcoes: ['A posição relativa de Sol, Terra e Lua muda', 'A Lua muda de tamanho', 'A sombra da Terra sempre encobre parte da Lua'], correta: 0,
    conceito: 'O Sol ilumina aproximadamente metade da Lua. Conforme ela orbita a Terra, muda a fração dessa metade que vemos.',
    exemplo: 'Perto da lua nova, a face iluminada está voltada mais para o Sol do que para a Terra.',
  },
  {
    habilidade: 'Distinguir rotação e translação',
    enunciado: 'Qual movimento da Terra explica a alternância diária entre claro e escuro?',
    opcoes: ['A translação em torno do Sol', 'A rotação em torno do próprio eixo', 'A órbita da Lua'], correta: 1,
    conceito: 'Rotação é girar em torno do próprio eixo. Translação é o movimento orbital em torno de outro corpo.',
    exemplo: 'Enquanto a Terra gira, um mesmo lugar passa pela metade iluminada e pela metade escura.',
  },
  {
    habilidade: 'Relacionar distância orbital e duração do ano',
    enunciado: 'Comparando Terra e Marte, qual leva mais tempo para completar uma volta ao Sol?',
    opcoes: ['A Terra', 'Os dois levam o mesmo tempo', 'Marte'], correta: 2,
    conceito: 'Para corpos que orbitam o mesmo astro, órbitas maiores têm períodos mais longos. A relação é a terceira lei de Kepler.',
    exemplo: 'O ano marciano dura cerca de 687 dias terrestres. Marte está mais longe do Sol do que a Terra.',
  },
] satisfies QuestaoDeAplicacao[];

export const normalizarAssunto = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export function assuntoDoDiagnostico(objetivo: string) {
  const texto = normalizarAssunto(objetivo);
  if (/\bequac(?:ao|oes)\b.*\b(?:primeiro|1\s*[oº°]?)\s+grau\b/.test(texto)) return 'equacao';
  if (/\bsistema solar\b/.test(texto)) return 'solar';
  return null;
}
