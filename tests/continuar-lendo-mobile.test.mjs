import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// "Continuar lendo" sem efeito no iPhone (20/11): na lição, com o rodapé de vidro do iOS 26 por cima do conteúdo, a altura
// do conteúdo vinha da caixa da rolagem menos o espaço do fim. Numa etapa curta, a caixa fica presa na altura da janela
// (flexGrow), o rodapé é medido depois e o espaço do fim entra sem a caixa mudar de tamanho: sem evento novo, a "falta"
// ficava com a altura do rodapé e o rodapé mostrava "Continuar lendo" num conteúdo que não rola. No mesmo caminho, o fim
// podia ser decidido antes de a altura do conteúdo chegar ("Avançar" com texto embaixo do rodapé).
const licao = await readFile(new URL('../apps/mobile/src/licao.tsx', import.meta.url), 'utf8');
const tela = await readFile(new URL('../apps/mobile/src/interface.tsx', import.meta.url), 'utf8');

/** O modelo das medidas da Tela no iPhone com vidro: a caixa estica até a janela; o espaço do fim tem a altura do rodapé. */
function medidas({ janela, natural, rodape }) {
  const caixa = Math.max(janela, natural + rodape);
  return { visivel: janela - rodape, antiga: caixa - rodape, nova: natural, maximo: caixa - janela };
}

test('o modelo do defeito: com a caixa presa, a medida antiga sobra a altura do rodapé; a natural, não', () => {
  // Etapa curta (o exemplo da bola): 380 de conteúdo numa janela de 735 com o rodapé de vidro de 104.
  // Antes de o rodapé ser medido, a caixa vale 735 e a medida antiga fica em 735 - 0; o espaço do fim entra depois sem
  // evento (a caixa continua 735).
  const semRodape = medidas({ janela: 735, natural: 380, rodape: 0 });
  const comRodape = medidas({ janela: 735, natural: 380, rodape: 104 });
  const faltaAntiga = semRodape.antiga - comRodape.visivel;
  assert.equal(comRodape.maximo, 0, 'não há o que rolar');
  assert.ok(faltaAntiga > 24, `a medida antiga dizia que faltavam ${faltaAntiga} px: "Continuar lendo" sem efeito`);
  assert.ok(comRodape.nova - comRodape.visivel <= 24, 'a altura natural diz que acabou: "Avançar"');
  // Etapa longa: no fim da rolagem, a altura natural chega a zero de falta (nada fica embaixo do rodapé).
  const longa = medidas({ janela: 735, natural: 1500, rodape: 104 });
  assert.equal(longa.nova - (longa.maximo + longa.visivel), 0);
});

test('a lição mede a altura natural do conteúdo (sem a caixa esticada nem o espaço do fim)', () => {
  assert.match(licao, /aoMedirNatural=\{\(altura\) => \{ alturaConteudo\.current = altura; medirMais\(\); \}\}/);
  assert.doesNotMatch(licao, /aoMedirConteudo=/, 'a medida da caixa menos o espaço do fim não decide mais o "Continuar lendo"');
  // A Tela informa a altura natural pela própria caixa do conteúdo (onLayout), fora o espaço do fim.
  assert.match(tela, /onLayout=\{\(evento\) => \{ alturaDoConteudo\.current = evento\.nativeEvent\.layout\.height; informarNatural\(\); \}\}/);
  assert.match(tela, /aoMedirNatural\(\(cabecalhoNaRolagem \? alturaCabecalho : 0\) \+ \(faixaFixa \? \(faixaColada \? 0 : 20\) \+ acima \+ alturaFaixa : 0\) \+ alturaDoConteudo\.current\);/);
});

test('o fim só é decidido com as duas medidas e depois da medida inicial da etapa', () => {
  const medir = licao.slice(licao.indexOf('  function medirMais() {'), licao.indexOf('  /**\n   * "Continuar lendo": rola'));
  assert.match(medir, /if \(!alturaVisivel\.current \|\| !alturaConteudo\.current\) return;/);
  assert.match(medir, /if \(leitura && !novo && medidaPronta\.current\) chegouAoFim\.current = true;/);
  assert.match(licao, /medidaPronta\.current = false;\n[^\n]*\n\s*clearTimeout\(conferirLeitura\.current\);\n\s*const medida = setTimeout\(\(\) => \{ medidaPronta\.current = true; medirMais\(\); \}, 250\);/);
});

test('um toque em "Continuar lendo" nunca fica sem efeito: se a tela não andou, o rodapé vira "Avançar"', () => {
  const ler = licao.slice(licao.indexOf('  function lerMais() {'), licao.indexOf('  /** Leva até o "Como foi?"'));
  assert.match(ler, /const antes = posicaoRolagem\.current;/);
  assert.match(ler, /if \(Math\.abs\(posicaoRolagem\.current - antes\) >= 1\) return;\n\s*chegouAoFim\.current = true;\n\s*setTemMais\(false\);\n\s*setTemAbaixo\(false\);/);
  // A conferência pendente não passa para a etapa seguinte nem sobrevive à saída da lição.
  assert.match(licao, /useEffect\(\(\) => \(\) => \{ pararVoz\(\); clearTimeout\(conferirLeitura\.current\); \}, \[\]\);/);
});
