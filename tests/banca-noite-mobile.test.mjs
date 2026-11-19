import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { conceitoEmBlocos, falasDoTexto, fimDasFrases } from '../packages/contratos/src/licao.ts';

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

// A aula de inglês da demonstração (src/servidor/ia/demos.ts): 3 frases, 72 palavras e 6 frases com áudio.
const INGLES = 'Para começar uma conversa em inglês, três frases curtas resolvem: um cumprimento (“Hello!”, olá), seu nome (“I\'m Ana”, eu sou a Ana) e de onde você vem (“I\'m from Brazil”, eu sou do Brasil). “Nice to meet you” (prazer em conhecer) mostra simpatia. Na imigração do aeroporto, o agente pergunta o motivo da viagem (“What is the purpose of your visit?”), e você responde: “I\'m here on vacation” (estou aqui de férias).';

test('§7 conceito: as frases terminam fora das aspas, dos parênteses e das abreviações', () => {
  const frases = (texto) => fimDasFrases(texto).map((fim, i, fins) => texto.slice(i ? fins[i - 1] : 0, fim).trim());
  assert.deepEqual(frases('Ele disse “How are you?” e sorriu. Depois foi embora.'), ['Ele disse “How are you?” e sorriu.', 'Depois foi embora.']);
  assert.deepEqual(frases('Responda: “I\'m here on vacation.” Depois agradeça.'), ['Responda: “I\'m here on vacation.”', 'Depois agradeça.']);
  assert.deepEqual(frases('Pergunte “Where is…?” (onde fica…?). Na resposta, ouça. No fim, agradeça: “Thank you!”'),
    ['Pergunte “Where is…?” (onde fica…?).', 'Na resposta, ouça.', 'No fim, agradeça: “Thank you!”']);
  assert.deepEqual(frases('O Sr. Silva e J. K. Rowling chegaram. Custou 4.99 e 1.000. Fim!'), ['O Sr. Silva e J. K. Rowling chegaram.', 'Custou 4.99 e 1.000.', 'Fim!']);
  assert.deepEqual(frases('Linha um\nLinha dois. Três.'), ['Linha um', 'Linha dois.', 'Três.']);
});

test('§7 conceito: até 3 frases e cerca de 50 palavras no balão; o resto em "Continuar lendo"', () => {
  // A de inglês: as duas primeiras frases (43 palavras) no balão; a terceira passaria de 60.
  const { inicio, resto } = conceitoEmBlocos(INGLES);
  assert.match(inicio, /mostra simpatia\.$/);
  assert.match(resto, /^Na imigração do aeroporto/);
  // Até 3 frases curtas: cabe tudo. A quarta frase vai para o resto, mesmo curta.
  assert.deepEqual(conceitoEmBlocos('Um. Dois. Três.'), { inicio: 'Um. Dois. Três.', resto: '' });
  assert.deepEqual(conceitoEmBlocos('A luz muda tudo. A janela ajuda. O sol do meio-dia, não. A hora dourada é a melhor.'),
    { inicio: 'A luz muda tudo. A janela ajuda. O sol do meio-dia, não.', resto: 'A hora dourada é a melhor.' });
  // Uma frase só, longa, fica inteira (nunca menos de uma frase).
  const longa = `${'palavra '.repeat(80).trim()}.`;
  assert.deepEqual(conceitoEmBlocos(longa), { inicio: longa, resto: '' });
});

test('§7 conceito: as frases com áudio viram uma lista, na ordem, sem repetir e só fora do português', () => {
  assert.deepEqual(falasDoTexto(conceitoEmBlocos(INGLES).inicio, 'en-US'), ['Hello!', "I'm Ana", "I'm from Brazil", 'Nice to meet you']);
  assert.deepEqual(falasDoTexto(INGLES, 'en-US').slice(4), ['What is the purpose of your visit?', "I'm here on vacation"]);
  assert.deepEqual(falasDoTexto('Diga “Hello” e “Hello” de novo, como em “olá, tudo bem?”.', 'en-US'), ['Hello']);
  assert.deepEqual(falasDoTexto(INGLES, 'pt-BR'), []);
  assert.deepEqual(falasDoTexto(INGLES, undefined), []);
});

test('§7 conceito no app: sem links no meio do parágrafo, "Continuar lendo" que abre no lugar e "Ouvir" de 44', async () => {
  const formatos = await readFile(new URL('../apps/mobile/src/aula-formatos.tsx', import.meta.url), 'utf8');
  const licao = await readFile(new URL('../apps/mobile/src/licao.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(formatos, /TextoComFalas|falaInline|toqueParaOuvir/, 'as frases não são mais links no parágrafo');
  assert.match(licao, /<ConceitoEmBlocos texto=\{licao\.conceito\} idioma=\{licao\.falas\?\.\[0\]\?\.idioma\} aberto=\{conceitoAberto\} abrir=\{abrirConceito\}/);
  assert.match(formatos, /<Botao testID="conceito-continuar" rotulo=\{t\.continuarLendo\} variante="texto" compacto icone="seta" giroIcone="90deg" acao=\{abrir\} \/>/);
  assert.match(formatos, /const falas = falasDoTexto\(aberto \|\| !resto \? texto : inicio, idioma\);/, 'a lista acompanha o texto à vista');
  assert.match(formatos, /ouvirFrase: \{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44,/);
  assert.match(formatos, /<Icone nome="som" tamanho=\{18\} cor=\{cores\.acaoEscura\} \/>\n\s*<Text style=\{formatos\.ouvirFraseTexto\}>\{t\.audio\.ouvir\}<\/Text>/);
  // O "Continuar lendo" do rodapé faz o mesmo que o do balão enquanto o resto está recolhido.
  assert.match(licao, /if \(recolhido && explicacaoY\.current \+ corteDoConceitoY\.current >= posicaoRolagem\.current\) \{\n\s*abrirConceito\(\);/);
});
