// A fonte única dos tempos do filme. As cenas (no navegador) e a trilha sonora (no Node) leem este arquivo, então
// imagem e som nascem dos mesmos números. Aqui não entra JSX nem nada do Remotion.
import clipes from './clipes.js';
import { ATOS, COMPASSO, ORDEM } from './tema.js';

/** Quadro em que a cena começa no filme, e quantos quadros ela dura. */
export const inicioDe = (ato) => ATOS[ato][0] * COMPASSO;
export const duracaoDe = (ato) => ATOS[ato][1] * COMPASSO;

/** Mapeia o quadro da cena para o quadro do clipe por pontos-chave [[cena, clipe], ...], com trechos lineares. */
export function remapear(quadro, pontos) {
  if (quadro <= pontos[0][0]) return pontos[0][1];
  for (let i = 1; i < pontos.length; i += 1) {
    const [x1, y1] = pontos[i];
    if (quadro <= x1) {
      const [x0, y0] = pontos[i - 1];
      return y0 + ((y1 - y0) * (quadro - x0)) / Math.max(1, x1 - x0);
    }
  }
  return pontos[pontos.length - 1][1];
}

/** O caminho de volta: em que quadro da cena o quadro `q` do clipe aparece, e a que velocidade (ou null, se não aparece). */
export function inverter(q, pontos) {
  for (let i = 1; i < pontos.length; i += 1) {
    const [x0, y0] = pontos[i - 1];
    const [x1, y1] = pontos[i];
    if (q >= y0 && q <= y1 && y1 > y0) return { quadro: x0 + ((q - y0) * (x1 - x0)) / (y1 - y0), velocidade: (y1 - y0) / Math.max(1, x1 - x0) };
  }
  return null;
}

/*
 * Os trechos de gravação de cada cena, em ordem. `pontos` liga o quadro da cena ao quadro do clipe: onde a inclinação
 * é 1, a gravação passa em tempo real; onde é maior, passa acelerada (os trechos de espera e de leitura).
 * Cada trecho vale do seu primeiro ponto até o primeiro ponto do trecho seguinte.
 */
export const TRECHOS = {
  // O pedido inteiro em tempo real: a trilha fica pronta no quadro 500 da cena (compasso 25 do filme).
  pedido: [{ clipe: 'pedido', pontos: [[0, 1], [640, 641]] }],
  // Mapa, toque na lição, o Stu explica; depois a lição do acorde: o som toca no quadro 400 (compasso 30).
  licao: [
    { clipe: 'mapa-inicio', pontos: [[0, 10], [190, 200]] },
    { clipe: 'conceito', pontos: [[190, 0], [235, 45]] },
    { clipe: 'acorde', pontos: [[235, 76], [640, 481]] },
  ],
  // Erro no quadro 100 (compasso 33), reforço, e o acerto no quadro 500 (compasso 37).
  erro: [
    { clipe: 'pares-erro', pontos: [[0, 150], [68, 396], [150, 478]] },
    { clipe: 'reforco', pontos: [[150, 40], [200, 90], [262, 244], [350, 332]] },
    { clipe: 'pares-certo', pontos: [[350, 46], [384, 80], [434, 285], [640, 491]] },
  ],
  // A batida do app começa no quadro 100 (compasso 39) e segue em tempo real; a lição conclui no quadro 500.
  pratica: [
    { clipe: 'pratica', pontos: [[0, 150], [60, 321], [400, 661]] },
    { clipe: 'como-foi', pontos: [[400, 100], [446, 146], [466, 276], [640, 450]] },
  ],
  // A resposta aberta de inglês: digitação acelerada, a correção em tempo real.
  assuntos: [{ clipe: 'ingles-erro', pontos: [[190, 70], [262, 250], [282, 302], [440, 460]] }],
  // O material de demonstração vira trilha; depois, a lição que cita a página.
  material: [
    { clipe: 'material-enviar', pontos: [[0, 75], [35, 110], [47, 185], [87, 225], [97, 272], [155, 330], [173, 438], [235, 500]] },
    { clipe: 'material-licao', pontos: [[235, 236], [440, 441]] },
  ],
  webApp: [
    { clipe: 'desktop', pontos: [[0, 60], [240, 300]] },
  ],
  webAppCelular: [
    // O instante em branco enquanto o app carrega a lição passa depressa.
    { clipe: 'app', pontos: [[0, 60], [42, 102], [50, 126], [240, 316]] },
  ],
  fecho: [{ clipe: 'trofeu', pontos: [[0, 40], [330, 370]] }],
};

/** O trecho ativo da cena no quadro, com o quadro do clipe: { clipe, q, indice, velocidade }. */
export function trechoAtivo(cena, quadro) {
  const lista = TRECHOS[cena];
  let indice = 0;
  for (let i = 0; i < lista.length; i += 1) if (quadro >= lista[i].pontos[0][0]) indice = i;
  const { clipe, pontos } = lista[indice];
  const q = Math.max(0, Math.min(clipes[clipe].quadros - 1, remapear(quadro, pontos)));
  return { clipe, q, indice };
}

/** Em que quadro da cena aparece a primeira marca `tipo` do clipe (o trecho precisa mostrar esse quadro). */
export function quadroDaMarca(cena, clipe, tipo, n = 0) {
  const trecho = TRECHOS[cena].find((x) => x.clipe === clipe);
  const marca = clipes[clipe].marcas.filter((m) => m.tipo === tipo)[n];
  const achado = marca && inverter(marca.q, trecho.pontos);
  if (!achado) throw new Error(`a marca ${tipo} de ${clipe} não aparece na cena ${cena}`);
  return Math.round(achado.quadro);
}

/** Todos os eventos de gravação que o filme mostra, no tempo do filme: toques, teclas e marcas (para o som). */
export function eventosDasGravacoes() {
  const eventos = [];
  for (const cena of Object.keys(TRECHOS)) {
    const ato = cena === 'webAppCelular' ? 'webApp' : cena;
    const base = inicioDe(ato);
    const fimDaCena = duracaoDe(ato);
    TRECHOS[cena].forEach((trecho, i, lista) => {
      const info = clipes[trecho.clipe];
      const de = trecho.pontos[0][0];
      const ate = Math.min(fimDaCena, i + 1 < lista.length ? lista[i + 1].pontos[0][0] : fimDaCena);
      const por = (q, tipo, dados = {}) => {
        const achado = inverter(q, trecho.pontos);
        if (!achado || achado.quadro < de || achado.quadro >= ate) return;
        eventos.push({ ...dados, quadro: base + achado.quadro, fim: base + ate, tipo, velocidade: achado.velocidade, cena: ato, clipe: trecho.clipe });
      };
      for (const toque of info.toques) por(toque.q1, 'toque', { rotulo: toque.rotulo, x: toque.x / info.largura });
      for (const clique of info.cliques) por(clique.q0, 'clique', { x: clique.x / info.largura });
      for (const tecla of info.teclas) por(tecla, 'tecla');
      for (const marca of info.marcas) if (marca.tipo !== 'rolagem' && !marca.tipo.startsWith('digita')) por(marca.q, marca.tipo, marca);
    });
  }
  return eventos.sort((a, b) => a.quadro - b.quadro);
}

/** Os cortes do filme: o quadro em que cada cena começa e a transição que a traz. */
export const CORTES = ORDEM.map((ato) => ({ ato, quadro: inicioDe(ato) }));

/*
 * Momentos de cada cena (em quadros da cena) que a imagem e o som dividem: entradas de títulos, etiquetas e batidas.
 * Tudo cai na grade de 25 quadros (uma batida) sempre que dá.
 */
export const MOMENTOS = {
  abertura: {
    frase1: 12, frase2: 52,
    cartas: [100, 125, 150, 166, 182, 196, 208, 219, 229, 238, 246, 253, 260, 266, 272, 278, 283, 288, 293, 298, 303, 308, 313, 318],
    muito: 200, pouca: 300, queda: 346,
  },
  julio: { janela: 0, tema1: 28, tema2: 400, tema3: 800, erro: 900, limpa: 1110 },
  revelacao: { iris: 0, pouso: 38, letras: [100, 112, 125, 137, 150, 162], sorriso: 175, pronto: 200, lema1: 206, lema2: 262, sai: 372 },
  pedido: { titulo1: 14, titulo2: 284, centro: 262, etiquetas: [350, 400, 450], pronto: 500 },
  licao: { titulo1: 14, explica: 150, giro: 235, mostra: 300, ouve: 400 },
  erro: { titulo: 14, errou: 100, outroJeito: 200, giro: 350, acerta: 500 },
  pratica: { titulo: 14, cronometro: 40, batida: 100, comoFoi: 400, concluida: 500 },
  assuntos: { titulo: 12, celulares: [0, 25, 50, 75, 100], aproxima: 190, correcao: 310 },
  material: { titulo: 14, formatos: [60, 72, 84, 96], giro: 235, cita: 300 },
  webApp: { entra: 0, titulo: 20, mesmo: 100 },
  miguel: { janela: 0, tema1: 28, tema2: 400, tema3: 800, pilha: [880, 905, 930, 955], limpa: 1120 },
  fecho: { titulo: 14, trofeu: 44, lema1: 200, lema2: 262, logo: 400, creditos: 440 },
};
