// O rodapé (ou a ação de um campo) acima do teclado, MEDIDO na árvore de elementos que o Maestro guarda no instante em que
// o teclado está aberto (Lead, 23/11; conserto do app 97136b1: no iPhone 26 o rodapé de vidro ficava atrás do teclado).
//
// Os fluxos marcam o instante com um `assertVisible` opcional de um texto que não existe ("medir-<nome>"): o passo dá
// aviso, e o Maestro guarda a árvore dele em screen-hierarchy/step-NNN-assertCondition-medir-<nome>.json. Aqui, para cada
// medição: a base do elemento-alvo (o maior y dos bounds) tem de ficar no topo do teclado ou acima dele.
//   - topo do teclado no iPhone: o `inputView` (o contêiner do teclado na árvore do XCUITest); sem ele, o menor y das
//     teclas (letras, shift, delete, space, Done/Return);
//   - no Android: o `…inputmethod…:id/keyboard_holder`; sem ele, o menor y das teclas (`…:id/key_pos_…`).
// Estados: "sim", "NÃO", "sem teclado" (a árvore não tem teclado: nada a afirmar) e "sem alvo" (o elemento não está na
// árvore). Só "NÃO" derruba a rodada.
// Uso: node rodape-teclado.mjs <pasta com as saídas do Maestro> [<outra pasta>...]
// Imprime uma linha por medição ("Rodapé acima do teclado (<nome>): sim (base do <id> y=…, topo do teclado y=…)") e sai
// com 1 se alguma deu NÃO.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** As medições dos fluxos: o nome do marcador, o elemento medido e o que ele é. */
export const MEDICOES = [
  { nome: 'lacuna', alvo: 'enviar-resposta', rotulo: 'Verificar (lacuna, fluxo 98)' },
  { nome: 'explique', alvo: 'rodape', rotulo: 'rodapé do Explique (fluxo 98)' },
  { nome: 'pedido', alvo: 'gerar-trilha', rotulo: 'Montar minha trilha (Nova trilha, fluxo 90)' },
];

const limites = (texto) => {
  const m = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(String(texto ?? '').trim());
  return m ? { x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] } : null;
};

function* nos(arvore) {
  const pilha = [arvore];
  while (pilha.length) {
    const no = pilha.pop();
    if (!no || typeof no !== 'object') continue;
    yield no;
    for (const filho of no.children ?? []) pilha.push(filho);
  }
}

/** As teclas do iPhone na árvore do XCUITest: as de função têm id; as letras, só o texto (uma letra maiúscula). */
const TECLAS_IOS = new Set(['shift', 'delete', 'space', 'more', 'Done', 'Return', 'dictation']);
const ehTecla = (id, texto) => (/inputmethod/.test(id) && /:id\/key_pos_/.test(id)) || TECLAS_IOS.has(id) || (!id && /^[A-ZÀ-Ý]$/.test(texto));

/** O topo do teclado na árvore, ou null se não houver teclado. */
export function topoDoTeclado(arvore) {
  let conteiner = null;
  let teclas = null;
  for (const no of nos(arvore)) {
    const a = no.attributes ?? {};
    const id = a['resource-id'] ?? '';
    const caixa = limites(a.bounds);
    if (!caixa || caixa.y2 <= caixa.y1) continue;
    // iPhone: o contêiner do teclado; Android: o suporte do teclado do Gboard.
    if (id === 'inputView' || (/inputmethod/.test(id) && /:id\/keyboard_holder$/.test(id))) {
      conteiner = conteiner === null ? caixa.y1 : Math.min(conteiner, caixa.y1);
    } else if (ehTecla(id, a.accessibilityText ?? '')) {
      teclas = teclas === null ? caixa.y1 : Math.min(teclas, caixa.y1);
    }
  }
  return conteiner ?? teclas;
}

/** A medição de um elemento numa árvore: { estado, base, topo }. */
export function medirAcimaDoTeclado(arvore, alvo) {
  const topo = topoDoTeclado(arvore);
  let base = null;
  for (const no of nos(arvore)) {
    const a = no.attributes ?? {};
    if (a['resource-id'] !== alvo) continue;
    const caixa = limites(a.bounds);
    if (caixa) base = base === null ? caixa.y2 : Math.max(base, caixa.y2);
  }
  if (topo === null) return { estado: 'sem teclado', base, topo };
  if (base === null) return { estado: 'sem alvo', base, topo };
  return { estado: base <= topo ? 'sim' : 'NÃO', base, topo };
}

/** Os arquivos de árvore das medições (o mais novo de cada nome), em qualquer subpasta. */
export function arvoresDasMedicoes(pastas) {
  const achados = new Map();
  const andar = (pasta, profundidade) => {
    let itens = [];
    try { itens = readdirSync(pasta); } catch { return; }
    for (const item of itens) {
      const caminho = join(pasta, item);
      let info;
      try { info = statSync(caminho); } catch { continue; }
      if (info.isDirectory()) { if (profundidade < 8) andar(caminho, profundidade + 1); continue; }
      const m = /-medir-([a-z]+)[^/]*\.json$/.exec(item);
      if (!m || !/screen-hierarchy/.test(pasta)) continue;
      const anterior = achados.get(m[1]);
      if (!anterior || info.mtimeMs > anterior.quando) achados.set(m[1], { caminho, quando: info.mtimeMs });
    }
  };
  for (const pasta of pastas) andar(pasta, 0);
  return new Map([...achados].map(([nome, { caminho }]) => [nome, caminho]));
}

export function linhaDaMedicao(medicao, resultado) {
  const { estado, base, topo } = resultado;
  if (estado === 'sem medição') return `⚠️ Rodapé acima do teclado (${medicao.rotulo}): sem medição (a árvore do instante não foi guardada).`;
  if (estado === 'sem teclado') return `⚠️ Rodapé acima do teclado (${medicao.rotulo}): sem teclado na árvore do instante; nada a afirmar.`;
  if (estado === 'sem alvo') return `⚠️ Rodapé acima do teclado (${medicao.rotulo}): ${medicao.alvo} não está na árvore (topo do teclado y=${topo}).`;
  return `${estado === 'sim' ? '✅' : '❌'} Rodapé acima do teclado (${medicao.rotulo}): ${estado} (base do ${medicao.alvo} y=${base}, topo do teclado y=${topo}).`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pastas = process.argv.slice(2);
  const arvores = arvoresDasMedicoes(pastas);
  let falhou = false;
  for (const medicao of MEDICOES) {
    const caminho = arvores.get(medicao.nome);
    let resultado = { estado: 'sem medição', base: null, topo: null };
    if (caminho) {
      try { resultado = medirAcimaDoTeclado(JSON.parse(readFileSync(caminho, 'utf8')), medicao.alvo); } catch { /* árvore ilegível: sem medição */ }
    }
    if (resultado.estado === 'NÃO') falhou = true;
    console.log(linhaDaMedicao(medicao, resultado));
  }
  process.exit(falhou ? 1 : 0);
}
