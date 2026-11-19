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

test('§2 "Ver como funciona": arte em 52% da altura útil (280 a 420), sem selo de demonstração, textos centrados', async () => {
  const apresentacao = await readFile(new URL('../apps/mobile/src/apresentacao.tsx', import.meta.url), 'utf8');
  assert.match(apresentacao, /return Math\.round\(Math\.min\(420, Math\.max\(280, alturaUtil \* 0\.52\)\)\);/);
  assert.match(apresentacao, /style=\{\{ height: arteDoPasso\(indice\) \}\}>/, 'cada arte na altura calculada');
  // Só no último passo com as duas ações empilhadas, numa janela baixa, a arte cede até 200 para o texto caber sem rolar.
  assert.match(apresentacao, /if \(!empilhar \|\| indice !== total - 1 \|\| !alturaAtual \|\| !textos\) return alturaArte;\n\s*return Math\.max\(200, Math\.min\(alturaArte, Math\.floor\(alturaAtual - 64 - textos\)\)\);/);
  assert.doesNotMatch(apresentacao, /SeloDemonstracao|leitura: 'demonstracao'/, 'o selo é de conteúdo simulado, não de ilustração');
  assert.match(apresentacao, /textos: \{ flexGrow: 1, justifyContent: 'center', paddingTop: 20 \}/, 'título e texto no meio do que sobra');
});

test('§2 "Ver como funciona": textos da arte com 14 px ou mais, dois cartões no passo 3 e o Stu estudando no passo 1', async () => {
  const apresentacao = await readFile(new URL('../apps/mobile/src/apresentacao.tsx', import.meta.url), 'utf8');
  const cenas = await readFile(new URL('../apps/mobile/src/estudio-cenas.tsx', import.meta.url), 'utf8');
  const estilos = apresentacao.slice(apresentacao.indexOf('const apresentacaoEstilos = StyleSheet.create({'));
  for (const nome of ['fonteRotulo', 'fonteOnde', 'fonteTrechoTexto', 'seloTexto']) {
    const tamanho = Number(estilos.match(new RegExp(`  ${nome}: \\{[^}]*fontSize: (\\d+)`))?.[1]);
    assert.ok(tamanho >= 14, `${nome} com ${tamanho} px`);
  }
  assert.match(apresentacao, /<SeloSincronia grande sincronia=/);
  assert.match(apresentacao, /<CenaPonte [^>]*textosDaArte/);
  assert.match(cenas, /margemTextoArte: \{ fontSize: 14, lineHeight: 18 \},\n\s*textoArte: \{ fontSize: 14, lineHeight: 20 \},/);
  // Com o rótulo em 14, as margens quebram em duas linhas para as tábuas não ficarem espremidas.
  assert.match(cenas, /margemArte: \{ maxWidth: 92, paddingHorizontal: 4 \},/);
  assert.equal((cenas.match(/textosDaArte && cena\.margemArte\]/g) ?? []).length, 2);
  // Passo 3: só "O que fez sentido" e "Próximo passo", em 15.
  assert.match(apresentacao, /<CadernoDoStu apresentacao\n/);
  const variante = cenas.slice(cenas.indexOf('if (apresentacao) {'), cenas.indexOf('// Os parágrafos do caderno'));
  assert.match(variante, /\{m\.acertos\}/);
  assert.match(variante, /\{m\.proximo\}/);
  assert.doesNotMatch(variante, /m\.lacuna|m\.pergunta|ensinoAutomatico/);
  assert.match(cenas, /tituloArte: \{ fontSize: 15, lineHeight: 19\.5 \},\n\s*textoArte: \{ fontSize: 15, lineHeight: 21 \},\n\s*vistoArte: \{ fontSize: 14 \},/);
});

test('§2 "Ver como funciona": no último passo, Voltar no alto e as ações finais com "Entrar"', async () => {
  const apresentacao = await readFile(new URL('../apps/mobile/src/apresentacao.tsx', import.meta.url), 'utf8');
  const sessao = await readFile(new URL('../apps/mobile/src/sessao.tsx', import.meta.url), 'utf8');
  // "Voltar" sobe para o alto, à esquerda, como botão de texto (no lugar do "Pular"); fora do último passo, fica no rodapé.
  assert.match(apresentacao, /\{ultimo && passo > 0 && \(\n\s*<Botao rotulo=\{mensagens\.apresentacao\.voltar\} testID="voltar-apresentacao" variante="texto" compacto fonte=\{16\} iconeAntes="setaVoltar"/);
  assert.match(apresentacao, /\{!ultimo && passo > 0 && \(\n\s*<View style=\{apresentacaoEstilos\.metade\}>\n\s*<Botao rotulo=\{mensagens\.apresentacao\.voltar\} testID="voltar-apresentacao" variante="secundario"/);
  // Aberta pela entrada: com o visitante, "Experimentar sem conta" em cima e "Entrar" (secundário) embaixo; sem ele, só "Entrar".
  assert.match(apresentacao, /const comEntrar = ultimo && semSessao && entrar !== undefined;\n\s*const empilhar = comEntrar && rotuloFinalUltimo !== undefined;/);
  assert.match(apresentacao, /<Botao rotulo=\{mensagens\.entrada\.entrar\} testID="entrar-apresentacao" variante=\{empilhar \? 'secundario' : 'primario'\} acao=\{entrar\} \/>/);
  assert.match(sessao, /entrar=\{\(\) => \{ devolverFoco\.current = 'email'; setVendoApresentacao\(false\); \}\}/);
});

test('§8 vazios: com a lista vazia, a fileira de temas sai (ficam as abas e o aviso com o Stu e a ação)', async () => {
  const comunidade = await readFile(new URL('../apps/mobile/src/comunidade.tsx', import.meta.url), 'utf8');
  assert.match(comunidade, /const vazio = pagina && pagina\.emAlta\.length === 0 && pagina\.novas\.length === 0;/);
  assert.match(comunidade, /\{!vazio && !\(aba === 'seguindo' && pagina\?\.seguindoAlguem === false\) && \(\n\s*<Fileira papel="radiogroup" rotulo=\{c\.temas\}/);
  // As abas continuam fora da condição, e os três vazios com o Stu.
  assert.match(comunidade, /accessibilityRole="radiogroup" accessibilityLabel=\{c\.abasRotulo\}/);
  assert.match(comunidade, /<Stu nome="stu-curioso" tamanho=\{96\} animado="uma-vez" \/>/);
});

test('§9 alvos: todo botão de texto e link de ação com 12 de toque por fora (44 × 44 no mínimo)', async () => {
  const ler = (arquivo) => readFile(new URL(`../apps/mobile/src/${arquivo}`, import.meta.url), 'utf8');
  const [interfaceApp, sessao, licao, formatos, perfil] = await Promise.all(['interface.tsx', 'sessao.tsx', 'licao.tsx', 'aula-formatos.tsx', 'perfil.tsx'].map(ler));
  const textoLivre = interfaceApp.slice(interfaceApp.indexOf('  return (\n    <Pressable\n      ref={referencia}'), interfaceApp.indexOf('estilos.botaoTextoLivre'));
  assert.match(textoLivre, /hitSlop=\{12\}/, 'o Botao de texto');
  assert.match(interfaceApp, /testID="aviso-acao" accessibilityRole="button" hitSlop=\{12\}/);
  assert.match(sessao, /testID="ver-como-funciona" accessibilityRole="button" disabled=\{ocupado\} hitSlop=\{12\}/);
  assert.match(sessao, /hitSlop=\{12\} onPress=\{\(\) => recuperar\(email\)\}/, '"Esqueci minha senha"');
  assert.match(licao, /testID="etapa-anterior" accessibilityRole="button" disabled=\{ocupado\} hitSlop=\{12\}/);
  assert.equal((licao.match(/style=\{licaoEstilos\.avisoLink\}/g) ?? []).length, (licao.match(/hitSlop=\{12\} style=\{licaoEstilos\.avisoLink\}/g) ?? []).length);
  assert.equal((licao.match(/style=\{licaoEstilos\.consultaBotao\} hitSlop=\{12\}>/g) ?? []).length, 2, '"Rever a explicação" e a consulta');
  assert.match(formatos, /onPress=\{\(\) => setSemCronometro\(true\)\} hitSlop=\{12\}/);
  assert.match(perfil, /testID="foto-link" accessibilityRole="button" disabled=\{salvando\} onPress=\{tocarNaFoto\} hitSlop=\{12\}/);
});

test('§10 texto auxiliar: 13 px no mínimo (14 nas dicas), sem opacidade em texto e #4B5675 sobre lavanda ou creme', async () => {
  const { readdir } = await import('node:fs/promises');
  const pasta = new URL('../apps/mobile/src/', import.meta.url);
  const arquivos = (await readdir(pasta)).filter((nome) => /\.(tsx|ts)$/.test(nome));
  const pequenos = [];
  for (const nome of arquivos) {
    const fonte = await readFile(new URL(nome, pasta), 'utf8');
    for (const [linha, tamanho] of fonte.split('\n').flatMap((l) => [...l.matchAll(/fontSize: (\d+(?:\.\d+)?)\b/g)].map((m) => [l, Number(m[1])]))) {
      if (tamanho < 13) pequenos.push(`${nome}: ${linha.trim().slice(0, 60)}`);
    }
  }
  // Só os rótulos da barra de abas (navegação, não texto auxiliar) ficam abaixo de 13: 12 e 11 na barra no fluxo e 12 na
  // cápsula da spec 05 (19/11), que não tem mais o rótulo de quatro abas.
  const restantes = pequenos.map((p) => p.replace(/: \{.*$/, ''));
  assert.ok(restantes.length > 0 && restantes.every((nome) => ['interface.tsx: rotulo', 'interface.tsx: rotuloQuatro'].includes(nome)), restantes.join(', '));
  const [tema, voz, cenas, caminho, formatos] = await Promise.all(['tema.ts', 'voz-ao-vivo-painel.tsx', 'estudio-cenas.tsx', 'caminho.tsx', 'aula-formatos.tsx']
    .map((nome) => readFile(new URL(nome, pasta), 'utf8')));
  assert.match(tema, /textoSecundarioForte: '#4B5675',/);
  assert.doesNotMatch(voz, /color: cores\.texto, opacity: 0\.\d/, 'a voz ao vivo sem texto esmaecido');
  assert.match(voz, /dica: \{ marginVertical: 12, color: cores\.textoSecundario, fontFamily: fontes\.corpo, fontSize: 14,/);
  assert.doesNotMatch(cenas.slice(cenas.indexOf('  tabuaFalta:'), cenas.indexOf('  tabua: {')), /opacity/, 'o número da tábua que falta sem opacidade');
  assert.match(caminho, /dica: \{ marginTop: 6, color: cores\.textoSecundario, fontFamily: fontes\.corpo, fontWeight: '700', fontSize: 14,/);
  // A tradução da escuta (lavanda) e as legendas do exemplo e dos recursos (creme) no secundário mais escuro.
  assert.ok((formatos.match(/color: cores\.textoSecundarioForte/g) ?? []).length >= 6);
});
