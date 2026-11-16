// Tema do filme: as cores e as fontes do próprio Studoo, e a grade de tempo.
// A música anda a 144 batidas por minuto: é o dobro dos 72 BPM da batida de violão que o app toca, então o som de
// verdade do app entra no tempo da trilha sem precisar acelerar a gravação. A 60 quadros por segundo, cada batida tem
// 25 quadros e cada compasso, 100.
export const CORES = {
  fundo: '#ffffff',
  nevoa: '#f1f4fd',
  gelo: '#e1e7fa',
  ceu: '#eef3ff',
  texto: '#1b2a5e',
  texto2: '#5e6a85',
  acao: '#3858d6',
  acaoEscura: '#2a44a8',
  acaoClara: '#5470dc',
  bochecha: '#889cec',
  sucesso: '#1f7a5a',
  sucessoClaro: '#2f9e6f',
  ouro: '#ffd166',
  ouroEscuro: '#e0a92e',
  ambar: '#e58a1f',
  erro: '#c23b4e',
  noite: '#0d1536',
  noite2: '#1b2a5e',
  rosa: '#f28db2',
  verdeMapa: '#cfe9c4',
  verdeMapa2: '#b9dfb0',
};

export const FONTE = { titulo: 'Quicksand, sans-serif', corpo: 'Nunito, sans-serif' };

export const FPS = 60;
export const BPM = 144;
/** Quadros por batida (25) e por compasso (100). */
export const BATIDA = (FPS * 60) / BPM;
export const COMPASSO = BATIDA * 4;
/** Quadro de um ponto da grade: `t(3, 2)` é o compasso 3, batida 2 (as duas contagens começam em 0). */
export const t = (compassos, batidas = 0) => Math.round(compassos * COMPASSO + batidas * BATIDA);

export const LARGURA = 1920;
export const ALTURA = 1080;

/** O roteiro em compassos: [início, duração]. O filme inteiro tem 72 compassos (2 minutos). */
export const ATOS = {
  abertura: [0, 4],
  julio: [4, 12],
  revelacao: [16, 4],
  pedido: [20, 6],
  licao: [26, 6],
  erro: [32, 6],
  pratica: [38, 6],
  assuntos: [44, 4],
  material: [48, 4],
  webApp: [52, 2],
  miguel: [54, 12],
  fecho: [66, 6],
};
export const ORDEM = ['abertura', 'julio', 'revelacao', 'pedido', 'licao', 'erro', 'pratica', 'assuntos', 'material', 'webApp', 'miguel', 'fecho'];
export const TOTAL_COMPASSOS = 72;
export const TOTAL_QUADROS = TOTAL_COMPASSOS * COMPASSO;
/** Quadros que cada cena continua desenhando depois do seu fim, por baixo da transição da próxima. */
export const SOBRA = 36;

/** A nota de transparência das cenas com gravação. */
export const NOTA_DEMO = 'Gravação real do app em modo demonstração: trilhas prontas, sem IA ao vivo.';

/** Quem fala, e por quanto tempo (os espaços têm 20 s cada). */
export const ORADORES = {
  julio: { nome: 'Júlio', arquivo: 'falas/julio.mp4' },
  miguel: { nome: 'Miguel', arquivo: 'falas/miguel.mp4' },
};
