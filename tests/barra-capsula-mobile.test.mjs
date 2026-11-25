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

// Colunas iguais da Jornada Azul; reflow e foco reais ficam nas capturas HTTP em100/200%.
const respiroDaCapsula = numero(estilosDaNavegacao, /capsula: \{[^}]*padding: (\d+) \}/);
const respiroDaAba = numero(estilosDaNavegacao, /aba: \{[^}]*padding: (\d+),/);
const minimoDaAba = numero(estilosDaNavegacao, /aba: \{[^}]*minWidth: (\d+),/);
const CAPSULA = Object.fromEntries([...tela.match(/export const CAPSULA = \{([^}]*)\}/)[1].matchAll(/(\w+): (\d+)/g)].map(([, chave, valor]) => [chave, Number(valor)]));

function larguras(janela, nomes) {
  const capsula = Math.min(janela - 2 * CAPSULA.lateral, CAPSULA.larguraMaxima);
  const largura = (capsula - 2 * respiroDaCapsula) / nomes.length;
  return { capsula, abas: nomes.map(nome => ({ nome, largura })) };
}
const QUATRO = ['Minhas trilhas', 'Nova trilha', 'Explorar', 'Perfil'];

test('geometria: 16 dos lados (ou a área segura + 8), 8 acima da área segura e nunca menos de 16, até 480, 62 com raio 24 e aba de raio 16', () => {
  assert.deepEqual(CAPSULA, { lateral: 16, acimaDaAreaSegura: 8, minimoDaBorda: 16, larguraMaxima: 480, altura: 62, raio: 24, raioDaAba: 16, acimaDaCapsula: 12, raioDoBloco: 24, folgaDoFim: 16 });
  assert.match(tela, /left: Math\.max\(CAPSULA\.lateral, insets\.left \+ 8\), right: Math\.max\(CAPSULA\.lateral, insets\.right \+ 8\)/);
  assert.match(tela, /const baseDaCapsula = Math\.max\(CAPSULA\.minimoDaBorda, fundoSeguro \+ CAPSULA\.acimaDaAreaSegura\);/);
  // iPhone com barra de início (34): a base fica a 42 da borda; sem área segura (Android com botões, navegador): 16.
  const base = (seguro) => Math.max(CAPSULA.minimoDaBorda, seguro + CAPSULA.acimaDaAreaSegura);
  assert.equal(base(34), 42);
  assert.equal(base(0), 16);
  assert.equal(base(24), 32);
  // 62 = respiro de 4 + aba de 54 + respiro de 4. Na Jornada os raios têm papéis próprios: superfície24, seleção16.
  assert.equal(respiroDaCapsula * 2 + numero(estilosDaNavegacao, /minHeight: (\d+), padding/), CAPSULA.altura);
  assert.equal(CAPSULA.raio, 24);
  assert.equal(CAPSULA.raioDaAba, 16);
  assert.match(navegacao, /<SuperficieFlutuante testID="barra-de-baixo" accessibilityRole="tablist" material=\{material\} raio=\{CAPSULA\.raio\} estilo=\{navegacaoEstilos\.capsula\}/);
  assert.match(estilosDaNavegacao, /capsula: \{ width: '100%', maxWidth: CAPSULA\.larguraMaxima, flexDirection: 'row', alignItems: 'stretch', padding: 4 \}/);
  // Só a cápsula recebe o toque: as margens deixam passar para o conteúdo de trás.
  assert.match(navegacao, /collapsable=\{false\} pointerEvents="box-none"\n\s*style=\{\[navegacaoEstilos\.lugar, lados, \{ bottom: base \}\]\}>/);
});

test('abas: colunas iguais, mínimo48×54 e alvos contínuos em320/360/390', () => {
  assert.match(estilosDaNavegacao, /aba: \{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 48, minHeight: 54, padding: 6, gap: 2,/);
  assert.doesNotMatch(estilosDaNavegacao, /abaUmaPalavra/);
  for (const janela of [320,360,390]) for (const nomes of [QUATRO,QUATRO.slice(0,3),QUATRO.slice(0,2)]) {
    const {capsula,abas}=larguras(janela,nomes);
    assert.equal(new Set(abas.map(a=>a.largura)).size,1);
    assert.ok(abas.every(a=>a.largura>=minimoDaAba));
    assert.ok(Math.abs(abas.reduce((s,a)=>s+a.largura,0)+2*respiroDaCapsula-capsula)<.001);
  }
  assert.match(navegacao,/const toque = \{ top: 4, bottom: 4, left: posicao === 0 \? 4 : 0, right: posicao === itens\.length - 1 \? 4 : 0 \};/);
});

test('texto ampliado: nenhum cap ou limite de linhas no rótulo; altura real reserva a rolagem', () => {
  assert.doesNotMatch(navegacao,/maxFontSizeMultiplier|numberOfLines|adjustsFontSizeToFit/);
  assert.match(estilosDaNavegacao,/rotulo: \{ maxWidth: '100%', flexShrink: 1,/);
  assert.match(estilosDaNavegacao,/fontSize: 13, lineHeight: 17, fontWeight: '800'/);
  assert.match(tela,/<Icone nome=\{icone\} tamanho=\{24\}/);
  assert.match(tela,/const zonaDaBarra = comBarra \? \(alturaBarra \|\| CAPSULA\.altura\) \+ baseDaCapsula : 0;/);
  assert.match(navegacao,/onLayout=\{\(evento: LayoutChangeEvent\) => aoMedir\(evento.nativeEvent.layout.height\)\}/);
});

test('aba atual: seleção azul suave, ícone cheio e rótulo na ação escura; ao pressionar, o ícone a 0,9 (sem opacidade)', () => {
  assert.match(estilosDaNavegacao, /ativa: \{ backgroundColor: cores\.nevoa \}/);
  assert.match(estilosDaNavegacao, /rotuloAtivo: \{ color: cores\.acaoEscura \}/);
  assert.match(tela, /cor=\{selecionado \? cores\.acaoEscura : cores\.textoSecundario\} sistema=\{selecionado \? 'cheio' : true\}/);
  assert.match(estilosDaNavegacao, /iconePressionado: \{ transform: \[\{ scale: 0\.9 \}\] \}/);
  assert.match(tela, /pressionado && reduzir === false \? navegacaoEstilos\.iconePressionado : undefined/);
  assert.doesNotMatch(navegacao, /opacity: 0\.7/);
});

test('material: vidro do iOS 26 sem "Reduzir transparência"; senão, branco opaco com contorno de 1 por fora e sombra leve', () => {
  // Uma condição só escolhe o material, para a cápsula, para o bloco preso e para o testID que a automação lê.
  assert.match(corpoDe(tela, 'function useMaterialFlutuante'), /return VIDRO && vidroPermitido \? 'vidro' : 'opaca';/);
  const superficie = corpoDe(tela, 'function SuperficieFlutuante');
  assert.match(superficie, /if \(material === 'vidro'\) \{\n\s*return <GlassView glassEffectStyle="regular" colorScheme="light"/);
  assert.match(superficie, /<View style=\{\[estilo, estilos\.superficieOpaca, \{ borderRadius: raio \}\]\}/);
  assert.match(tela, /superficieOpaca: \{ backgroundColor: cores\.fundo, boxShadow: '0 0 0 1px rgba\(21, 39, 91, 0\.10\), 0 8px 24px rgba\(21, 39, 91, 0\.10\)' \}/);
  // A preferência vem do sistema e acompanha a troca na hora; o vidro só com ela confirmada desligada (o comportamento,
  // com a consulta atrasada, a que falha e o evento, fica em tests/transparencia-mobile.test.mjs).
  assert.match(transparencia, /AccessibilityInfo\.addEventListener\('reduceTransparencyChanged'/);
  assert.match(transparencia, /useSyncExternalStore\(assinar, \(\) => preferencia === false, \(\) => false\)/);
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
