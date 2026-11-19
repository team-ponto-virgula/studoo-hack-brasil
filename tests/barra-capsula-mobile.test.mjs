import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Barra de abas em cápsula no app (spec 05, "Barra de abas em cápsula", pedido do dono de 20/11): a geometria, o material, o
// texto ampliado, o fim da rolagem e as ações presas.
const ler = (arquivo) => readFile(new URL(`../apps/mobile/src/${arquivo}`, import.meta.url), 'utf8');
const [tela, transparencia, caminho, estudo, comunidade] = await Promise.all(['interface.tsx', 'transparencia.ts', 'caminho.tsx', 'estudo.tsx', 'comunidade.tsx'].map(ler));
const corpoDe = (fonte, inicio) => {
  const comeco = fonte.indexOf(inicio);
  assert.ok(comeco >= 0, `${inicio} não encontrado`);
  return fonte.slice(comeco, fonte.indexOf('\n}\n', comeco));
};
const navegacao = corpoDe(tela, 'function NavegacaoInferior');
const estilosDaNavegacao = tela.slice(tela.indexOf('const navegacaoEstilos = StyleSheet.create({'));
const numero = (fonte, expressao) => Number(fonte.match(expressao)?.[1]);

// A largura de cada aba como no CSS da web (flex: 1 1 auto, mínimo de 48, os rótulos de uma palavra sem encolher), com as
// larguras dos rótulos medidas na Nunito 800 do projeto (Chromium): 12 px e 1,3× (15,6 px).
const ROTULOS = {
  12: { 'Minhas trilhas': 81, 'Nova trilha': 63, Explorar: 49, Perfil: 32, palavras: { Minhas: 41, trilhas: 37, Nova: 29, trilha: 31 } },
  15.6: { 'Minhas trilhas': 104, 'Nova trilha': 81, Explorar: 63, Perfil: 40, palavras: { Minhas: 53, trilhas: 47, Nova: 38, trilha: 39 } },
};
const respiroDaCapsula = numero(estilosDaNavegacao, /capsula: \{[^}]*padding: (\d+) \}/);
const respiroDaAba = numero(estilosDaNavegacao, /aba: \{[^}]*padding: (\d+),/);
const minimoDaAba = numero(estilosDaNavegacao, /aba: \{[^}]*minWidth: (\d+),/);
const CAPSULA = Object.fromEntries([...tela.match(/export const CAPSULA = \{([^}]*)\}/)[1].matchAll(/(\w+): (\d+)/g)].map(([, chave, valor]) => [chave, Number(valor)]));

function larguras(janela, nomes, px) {
  const capsula = Math.min(janela - 2 * CAPSULA.lateral, CAPSULA.larguraMaxima);
  const util = capsula - 2 * respiroDaCapsula;
  const abas = nomes.map((nome) => ({ nome, base: ROTULOS[px][nome] + 2 * respiroDaAba, encolhe: nome.includes(' ') ? 1 : 0, congelada: false, largura: 0 }));
  // Distribui a sobra (ou a falta) entre as abas soltas; quem passa do mínimo de 48 fica nele e a conta recomeça.
  for (;;) {
    const soltas = abas.filter((aba) => !aba.congelada);
    const livre = util - abas.reduce((soma, aba) => soma + (aba.congelada ? aba.largura : aba.base), 0);
    if (livre >= 0) soltas.forEach((aba) => { aba.largura = aba.base + livre / soltas.length; });
    else {
      const peso = soltas.reduce((soma, aba) => soma + aba.base * aba.encolhe, 0);
      soltas.forEach((aba) => { aba.largura = aba.base + (peso ? (livre * aba.base * aba.encolhe) / peso : 0); });
    }
    const abaixo = soltas.filter((aba) => aba.largura < minimoDaAba);
    if (!abaixo.length) break;
    abaixo.forEach((aba) => { aba.largura = minimoDaAba; aba.congelada = true; });
  }
  return { capsula, abas };
}
const QUATRO = ['Minhas trilhas', 'Nova trilha', 'Explorar', 'Perfil'];

test('geometria: 16 dos lados (ou a área segura + 8), 8 acima da área segura e nunca menos de 16, até 480, 62 com raio 31', () => {
  assert.deepEqual(CAPSULA, { lateral: 16, acimaDaAreaSegura: 8, minimoDaBorda: 16, larguraMaxima: 480, altura: 62, raio: 31, raioDaAba: 27, acimaDaCapsula: 12, raioDoBloco: 24, folgaDoFim: 16 });
  assert.match(tela, /left: Math\.max\(CAPSULA\.lateral, insets\.left \+ 8\), right: Math\.max\(CAPSULA\.lateral, insets\.right \+ 8\)/);
  assert.match(tela, /const baseDaCapsula = Math\.max\(CAPSULA\.minimoDaBorda, fundoSeguro \+ CAPSULA\.acimaDaAreaSegura\);/);
  // iPhone com barra de início (34): a base fica a 42 da borda; sem área segura (Android com botões, navegador): 16.
  const base = (seguro) => Math.max(CAPSULA.minimoDaBorda, seguro + CAPSULA.acimaDaAreaSegura);
  assert.equal(base(34), 42);
  assert.equal(base(0), 16);
  assert.equal(base(24), 32);
  // 62 = respiro de 4 + aba de 54 + respiro de 4; a subcápsula de 27 fica concêntrica com o 31.
  assert.equal(respiroDaCapsula * 2 + numero(estilosDaNavegacao, /minHeight: (\d+), padding/), CAPSULA.altura);
  assert.equal(CAPSULA.raio - respiroDaCapsula, CAPSULA.raioDaAba);
  assert.match(navegacao, /<SuperficieFlutuante testID="barra-de-baixo" accessibilityRole="tablist" material=\{material\} raio=\{CAPSULA\.raio\} estilo=\{navegacaoEstilos\.capsula\}/);
  assert.match(estilosDaNavegacao, /capsula: \{ width: '100%', maxWidth: CAPSULA\.larguraMaxima, flexDirection: 'row', alignItems: 'stretch', padding: 4 \}/);
  // Só a cápsula recebe o toque: as margens deixam passar para o conteúdo de trás.
  assert.match(navegacao, /collapsable=\{false\} pointerEvents="box-none"\n\s*style=\{\[navegacaoEstilos\.lugar, lados, \{ bottom: base \}\]\}>/);
});

test('abas: largura pelo rótulo, 48 × 54 no mínimo, sem vão, e as quatro numa linha de 320 a 390 (a tabela da spec 05)', () => {
  assert.match(estilosDaNavegacao, /aba: \{ flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 48, minHeight: 54, padding: 6, gap: 2,/);
  assert.match(estilosDaNavegacao, /abaUmaPalavra: \{ flexShrink: 0 \}/);
  assert.doesNotMatch(estilosDaNavegacao.slice(0, estilosDaNavegacao.indexOf('aba:')), /gap:/, 'sem vão entre as abas');
  const arredondar = (resultado) => resultado.abas.map((aba) => Math.round(aba.largura));
  assert.deepEqual(arredondar(larguras(320, QUATRO, 12)), [94, 76, 62, 48]);
  assert.deepEqual(arredondar(larguras(390, QUATRO, 12)), [112, 94, 80, 63]);
  assert.deepEqual(arredondar(larguras(390, ['Minhas trilhas', 'Nova trilha'], 12)), [184, 166]);
  for (const janela of [320, 360, 390]) {
    for (const aba of larguras(janela, QUATRO, 12).abas) {
      assert.ok(ROTULOS[12][aba.nome] + 2 * respiroDaAba <= aba.largura + 0.5, `${aba.nome} cabe numa linha a ${janela}`);
    }
  }
  // O toque vai até a borda da cápsula: os 4 de respiro em cima, embaixo e nas pontas.
  assert.match(navegacao, /const toque = \{ top: 4, bottom: 4, left: posicao === 0 \? 4 : 0, right: posicao === itens\.length - 1 \? 4 : 0 \};/);
});

test('texto ampliado: até 1,3×, as de duas palavras em duas linhas e as de uma inteiras (360 e 320 da spec 05)', () => {
  assert.match(navegacao, /<Text numberOfLines=\{umaPalavra \? 1 : 2\} maxFontSizeMultiplier=\{1\.3\}/);
  assert.doesNotMatch(navegacao, /adjustsFontSizeToFit/, 'nenhum rótulo encolhe');
  assert.deepEqual(larguras(360, QUATRO, 15.6).abas.map((aba) => Math.round(aba.largura)), [107, 86, 75, 52]);
  assert.deepEqual(larguras(320, QUATRO, 15.6).abas.map((aba) => Math.round(aba.largura)), [85, 68, 75, 52]);
  for (const janela of [320, 360]) {
    for (const aba of larguras(janela, QUATRO, 15.6).abas) {
      const maior = aba.nome.includes(' ') ? Math.max(...aba.nome.split(' ').map((palavra) => ROTULOS[15.6].palavras[palavra])) : ROTULOS[15.6][aba.nome];
      assert.ok(maior + 2 * respiroDaAba <= aba.largura + 0.5, `${aba.nome} cabe (em até duas linhas) a ${janela} com 1,3×`);
    }
  }
  // O ícone fica em 24 e o rótulo em Nunito 800 12/15; a altura vem da medida (a cápsula cresce com duas linhas).
  assert.match(tela, /<Icone nome=\{icone\} tamanho=\{24\}/);
  assert.match(estilosDaNavegacao, /rotulo: \{ fontFamily: fontes\.corpo, fontSize: 12, lineHeight: 15, fontWeight: '800', color: cores\.textoSecundario, textAlign: 'center' \}/);
  assert.match(tela, /const zonaDaBarra = comBarra \? \(alturaBarra \|\| CAPSULA\.altura\) \+ baseDaCapsula : 0;/);
  assert.match(navegacao, /onLayout=\{\(evento: LayoutChangeEvent\) => aoMedir\(evento\.nativeEvent\.layout\.height\)\}/);
});

test('aba atual: subcápsula opaca #E9E7FF, ícone cheio e rótulo #1D4ED8; ao pressionar, o ícone a 0,9 (sem opacidade)', () => {
  assert.match(estilosDaNavegacao, /ativa: \{ backgroundColor: cores\.ceu \}/);
  assert.match(estilosDaNavegacao, /rotuloAtivo: \{ color: cores\.acaoEscura \}/);
  assert.match(tela, /cor=\{selecionado \? cores\.acaoEscura : cores\.textoSecundario\} sistema=\{selecionado \? 'cheio' : true\}/);
  assert.match(estilosDaNavegacao, /iconePressionado: \{ transform: \[\{ scale: 0\.9 \}\] \}/);
  assert.match(tela, /pressionado && reduzir === false \? navegacaoEstilos\.iconePressionado : undefined/);
  assert.doesNotMatch(navegacao, /opacity: 0\.7/);
});

test('material: vidro do iOS 26 sem "Reduzir transparência"; senão, branco opaco com contorno de 1 por fora e sombra leve', () => {
  // Uma condição só escolhe o material, para a cápsula, para o bloco preso e para o testID que a automação lê.
  assert.match(corpoDe(tela, 'function useMaterialFlutuante'), /return VIDRO && !transparenciaReduzida \? 'vidro' : 'opaca';/);
  const superficie = corpoDe(tela, 'function SuperficieFlutuante');
  assert.match(superficie, /if \(material === 'vidro'\) \{\n\s*return <GlassView glassEffectStyle="regular" colorScheme="light"/);
  assert.match(superficie, /<View style=\{\[estilo, estilos\.superficieOpaca, \{ borderRadius: raio \}\]\}/);
  assert.match(tela, /superficieOpaca: \{ backgroundColor: cores\.fundo, boxShadow: '0 0 0 1px rgba\(11, 27, 92, 0\.10\), 0 8px 24px rgba\(11, 27, 92, 0\.14\)' \}/);
  // A preferência vem do sistema e acompanha a troca na hora; na web (sem a consulta), fica "não".
  assert.match(transparencia, /AccessibilityInfo\.addEventListener\('reduceTransparencyChanged'/);
  assert.match(transparencia, /if \(typeof AccessibilityInfo\.isReduceTransparencyEnabled === 'function'\) \{/);
  assert.match(transparencia, /useSyncExternalStore\(assinar, \(\) => reduzida, \(\) => false\)/);
});

test('fim da rolagem: a cápsula, a distância até a borda e mais 16; a ação presa e mais 12; o mapa pinta o fim por baixo', () => {
  assert.match(tela, /const reservaDaBarra = comBarra && !fimSobABarra \? zonaDaBarra \+ CAPSULA\.folgaDoFim \+ zonaDoPreso : 0;/);
  assert.match(tela, /const zonaDoPreso = rodapePreso \? CAPSULA\.acimaDaCapsula \+ alturaRodape : 0;/);
  assert.match(tela, /scrollIndicatorInsets=\{comBarra \? \{ bottom: sobreposicao \} : undefined\}/);
  // O conteúdo rola por baixo da cápsula em todas as plataformas (não só no vidro): a cápsula nunca fica no fluxo.
  assert.doesNotMatch(tela, /barraSobreposta/);
  assert.match(tela, /\{comBarra && <NavegacaoInferior base=\{baseDaCapsula\} lados=\{lados\} aoMedir=\{setAlturaBarra\} \/>\}/);
  // A reserva vem da Tela: o fim das telas da comunidade e do perfil volta ao respiro de sempre (era 120 com a barra no fluxo).
  assert.match(comunidade, /export const FIM_COM_BARRA = \{ paddingBottom: 24 \} as const;/);
  // O mapa: o morro do troféu continua por baixo da cápsula (com o espaço dela a mais), sem faixa vazia no fim.
  assert.match(estudo, /fimSobABarra=\{!largo\}/);
  assert.match(caminho, /const espacoDaBarra = useContext\(EspacoDaBarra\);/);
  assert.match(caminho, /extra=\{largo \? 0 : extraChegada \+ espacoDaBarra\}/);
});

test('ações presas: 12 acima da cápsula, nas mesmas margens, num bloco de raio 24 e respiro 8; sem a cápsula, o rodapé de sempre', () => {
  assert.match(tela, /const rodapePreso = comBarra && Boolean\(rodape\);/);
  assert.match(tela, /<View pointerEvents="box-none" style=\{\[estilos\.presoLugar, lados, \{ bottom: zonaDaBarra \+ CAPSULA\.acimaDaCapsula \}\]\}>/);
  assert.match(tela, /<SuperficieFlutuante testID="rodape" material=\{material\} raio=\{CAPSULA\.raioDoBloco\} estilo=\{estilos\.blocoPreso\}/);
  assert.match(tela, /blocoPreso: \{ width: '100%', maxWidth: CAPSULA\.larguraMaxima, padding: 8 \}/);
  assert.match(tela, /\{rodape && !rodapePreso && \(\(\) => \{/);
  // O aviso fica 16 acima da ação presa ou da cápsula; o menu "•••" sabe o que está ocupado embaixo.
  assert.match(tela, /const ocupadoEmbaixo = rodapePreso \? zonaDaBarra \+ zonaDoPreso : rodape \? alturaRodape : comBarra \? zonaDaBarra : fundoSeguro;/);
  assert.match(tela, /<BaixoOcupado\.Provider value=\{baixoDoAviso - 16\}>/);
});

test('o que não muda: as abas e a ordem, "Nova trilha" uma vez só, some com o teclado e fica fora da aula e da geração', () => {
  assert.deepEqual([...navegacao.matchAll(/\{ id: '(planos|objetivo|explorar|perfil)', rotulo/g)].map((achado) => achado[1]), ['planos', 'objetivo', 'explorar', 'perfil']);
  assert.equal((navegacao.match(/mensagens\.planos\.novo/g) ?? []).length, 1);
  assert.match(navegacao, /if \(nav\.explorar\) itens\.push/);
  assert.match(navegacao, /if \(nav\.perfil\) itens\.push/);
  assert.match(navegacao, /accessibilityRole="tab" accessibilityState=\{\{ selected: selecionado, disabled: nav\.ocupado \}\}/);
  assert.match(navegacao, /const selecionado = item\.id === nav\.atual \|\| item\.id === 'planos' && nav\.atual === 'plano';/);
  assert.match(tela, /const comBarra = Boolean\(navegacao\) && !teclado;/);
});

test('automação: o material escolhido fica num testID da árvore nativa, sem rótulo nem fala e sem mudar os toques', () => {
  assert.match(navegacao, /const material = useMaterialFlutuante\(\);\n\s*if \(!nav\) return null;/);
  // barra-material-vidro ou barra-material-opaca pela mesma condição do GlassView, num View que não achata (collapsable).
  assert.match(navegacao, /<View testID=\{material === 'vidro' \? 'barra-material-vidro' : 'barra-material-opaca'\} collapsable=\{false\} pointerEvents="box-none"/);
  const marcador = navegacao.slice(navegacao.indexOf("<View testID={material === 'vidro'"), navegacao.indexOf('<SuperficieFlutuante testID="barra-de-baixo"'));
  assert.doesNotMatch(marcador, /accessible|accessibilityLabel|accessibilityRole|aria-/, 'o marcador não é elemento de acessibilidade');
  // A cápsula e as abas mantêm os testIDs e a semântica.
  assert.match(navegacao, /testID="barra-de-baixo" accessibilityRole="tablist"/);
  assert.match(navegacao, /testID=\{`nav-\$\{item\.id\}`\} accessibilityRole="tab"/);
  assert.match(tela, /<SuperficieFlutuante testID="rodape" material=\{material\}/);
});
