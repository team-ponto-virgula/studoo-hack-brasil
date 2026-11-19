import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Revisão de banca da noite (19–20/11, spec 04): o que o app segue em cada item, item por item.
const estudo = await readFile(new URL('../apps/mobile/src/estudo.tsx', import.meta.url), 'utf8');
const textos = await readFile(new URL('../packages/contratos/src/experiencia.ts', import.meta.url), 'utf8');

test('§3 pedido: sem o aviso de "sem trilhas", Stu de 72 (56 na janela baixa, sem subtítulo), material compacto e a fileira de ideias', () => {
  assert.doesNotMatch(estudo, /mensagens\.planos\.semTrilhas/, 'o aviso repetia o título');
  assert.match(estudo, /const baixa = useWindowDimensions\(\)\.height <= 700;\n\s*const tamanhoDoStu = baixa \? 56 : 72;/);
  assert.match(estudo, /\{!baixa && <Text accessibilityLiveRegion="polite" style=\{estudoEstilos\.pedidoFala\}>/);
  assert.doesNotMatch(estudo, /mensagens\.pedido\.seuMaterial/, 'sem a pílula "Seu material"');
  assert.match(estudo, /alternar: \{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64,/);
  // A fileira rola para o lado, com as fichas de 44 e "Surpreenda-me" no fim.
  assert.match(estudo, /<ScrollView key=\{tema\.id\} testID="ideias-pedido" horizontal/);
  assert.match(estudo, /\)\)\}\n\s*<Surpresa desativada=\{ocupado\} acao=\{surpreender\} \/>\n\s*<\/ScrollView>/);
  assert.match(estudo, /chip: \{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44,/);
});

test('§4 conclusão: na trilha concluída, compartilhar é o principal, o assunto novo o secundário e voltar um botão de texto', () => {
  const trilha = estudo.slice(estudo.indexOf('rodape={total > 0 && concluidas === total ? ('), estudo.indexOf('Lição concluída: como antes'));
  const ordem = ['testID="conclusao-compartilhar"', 'testID="novo-assunto"', 'testID="voltar-plano" variante="texto"'].map((t) => trilha.indexOf(t));
  assert.ok(ordem.every((i) => i > 0), 'as três ações estão no rodapé da trilha concluída');
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem, 'de cima para baixo: compartilhar, assunto novo, voltar');
  assert.match(trilha, /variante=\{abrirFolha && !etapa\.plano\.recebida \? 'secundario' : 'primario'\}/, 'sem o compartilhar, o assunto novo é o principal');
  // A lição concluída fica como era.
  assert.match(estudo, /testID="voltar-plano" variante=\{proxima \? 'secundario' : 'primario'\}/);
});

test('§4 conclusão: sem o selo de visto, números em blocos brancos e o que praticou recolhido', () => {
  assert.doesNotMatch(estudo, /seloConclusao|seloAnel/, 'sem o selo de visto sobre o Stu');
  assert.match(estudo, /numero: \{ overflow: 'hidden', borderRadius: 16, borderWidth: 2, borderColor: cores\.gelo, backgroundColor: cores\.fundo/);
  assert.match(estudo, /numeroValorTexto: \{ color: cores\.texto, fontFamily: fontes\.corpo, fontWeight: '900', fontSize: 22,/);
  assert.match(estudo, /<Icone nome=\{icone\} tamanho=\{16\} cor=\{cor\} traco=\{2\.75\} \/>/);
  // O ícone em cima do rótulo de 13, para "DE PRIMEIRA" caber inteiro (ao lado do ícone, saía cortado).
  assert.match(estudo, /numeroRotulo: \{ alignItems: 'center', gap: 2,/);
  assert.match(estudo, /\{verPraticado \? \(/);
  assert.match(estudo, /rotulo=\{mensagens\.licao\.historia\.verPraticou\} testID="ver-praticado" variante="texto"/);
  assert.match(textos, /verPraticou: 'Ver o que você praticou',/);
});

test('§6 geração: sem os três pontos no alto, a dica da placa em 14/20 #0B1B5C e o resumo do nó em 13', async () => {
  const caminho = await readFile(new URL('../apps/mobile/src/caminho.tsx', import.meta.url), 'utf8');
  const faixa = estudo.slice(estudo.indexOf('<View testID="faixa-geracao"'), estudo.indexOf('<Text style={estudoEstilos.faixaGeracaoContagem}>'));
  assert.doesNotMatch(faixa, /Pontinhos/, 'os pontos pareciam um menu');
  assert.match(estudo, /placaGeracaoLinha: \{ marginTop: 4, color: cores\.texto, fontFamily: fontes\.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 \}/);
  assert.match(caminho, /discretoResumo: \{ marginTop: 2, color: cores\.textoSecundario, fontFamily: fontes\.corpo, fontSize: 13,/);
  // O nome do nó que nasce fica na cor secundária, sem opacidade parada (só a entrada de 220 ms da spec 04).
  assert.match(caminho, /discretoTexto: \{\n\s*color: cores\.textoSecundario,/);
});
