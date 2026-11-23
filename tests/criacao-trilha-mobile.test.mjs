// Criar a trilha no app (spec 04, "Criar a trilha", pedido do dono de 19/11): da prévia à etapa 1 num toque, sem tela no
// meio, sem pausa fixa e sem enfeite; o mesmo token na nova tentativa; sair durante a criação não cancela no servidor; e a
// passagem do nó 1 para a aula. Conferido no código do app (a prévia web e a conferência nativa provam o resto).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (rel) => readFileSync(new URL(`../apps/mobile/src/${rel}`, import.meta.url), 'utf8');
const estudo = ler('estudo.tsx');
const caminho = ler('caminho.tsx');
const trecho = (texto, de, ate) => {
  const inicio = texto.indexOf(de);
  assert.ok(inicio >= 0, `achou ${de}`);
  const fim = texto.indexOf(ate, inicio + de.length);
  assert.ok(fim > inicio, `achou ${ate}`);
  return texto.slice(inicio, fim);
};
const comecar = trecho(estudo, 'async function comecar(', 'function terminarCriacao()');
const geracao = trecho(estudo, 'function GeracaoAoVivo(', '\nfunction PlacaDaGeracao');

test('sem pausa fixa: o aceite espera só a resposta e a busca da lição começa junto com a passagem', () => {
  assert.doesNotMatch(estudo, /ESCRITA_MINIMA_MS|PAUSA_LICOES_PRONTAS_MS|\bpausa\(/, 'as pausas de 1.200 e 900 ms saíram');
  assert.doesNotMatch(comecar, /Promise\.all/);
  const aceite = comecar.indexOf('await cliente.aceitarProposta(proposta.token)');
  const busca = comecar.indexOf('cliente.obterLicao(primeira)');
  const espera = comecar.indexOf('await esperar(');
  assert.ok(aceite > 0 && aceite < busca && busca < espera, 'aceite → busca da lição → aos 320 ms, a aula');
  assert.match(comecar, /await esperar\(inicio \+ \(reduzida \? 0 : RITMO_DA_GERACAO\.aulaMontaMs\) - Date\.now\(\)\);/);
  // Aos 200 ms, embaixo do círculo: a aula, se chegou; senão o esqueleto dela (pendente 'abrir') até chegar. A camada só some
  // depois disso (aulaNaTela), a partir dos 320 ms.
  assert.match(comecar, /if \(!licao && !falhaLicao\) \{\n\s*setPendente\('abrir'\);\n\s*aulaNaTela\(\);\n\s*await busca;/);
  assert.match(comecar, /terminarCriacao\(\);\n\s*aulaNaTela\(\);/);
  assert.match(comecar, /navegar\(\{ tipo: 'licao', plano, licao: pronta \}\);\n\s*anunciar\(mensagens\.geracao\.anuncioCriada\(pronta\.titulo\)\);/);
});

test('nenhuma tela entre a prévia e a etapa 1: "Escrevendo suas lições" saiu', () => {
  assert.doesNotMatch(estudo, /PreparandoLicoes|ListaPreparo|CenaPreparo|LinhaPreparo|DicaPreparo|preparando-licoes|titulo-preparo/);
  assert.match(estudo, /if \(pendente === 'abrir' && etapa\.tipo !== 'plano'\) return <SkeletonLicao texto=\{mensagens\.licao\.carregando\} \/>;/);
});

test('o toque: o mesmo botão vira "Criando sua trilha…" (afundado, com o giro), "Ajustar pedido" sai e o leitor de tela ouve', () => {
  assert.match(comecar, /setPendente\('aceitar'\);\n\s*setErro\(null\);\n\s*setCriacao\('criando'\);\n\s*\/\/[^\n]*\n\s*anunciar\(mensagens\.geracao\.anuncioCriando\);/);
  assert.doesNotMatch(comecar, /toque_opcao/, 'o toque em "Começar a lição 1" não tem som: o de conclusão fica sozinho');
  assert.match(geracao, /testID=\{expirada \? 'montar-de-novo' : 'comecar-trilha'\}/);
  assert.match(geracao, /rotulo=\{salvando \? mensagens\.geracao\.criandoTrilha : expirada \? mensagens\.geracao\.montarDeNovo : mensagens\.geracao\.comecarLicao1\}/);
  assert.match(geracao, /ocupado=\{salvando\} afundado=\{salvando\} giro=\{salvando\}/);
  assert.match(geracao, /const secundaria = \(empilhar \|\| !ajustarFora\) && \(/, '"Ajustar pedido" mantém a medida só no rodapé empilhado');
  assert.match(geracao, /duration: RITMO_DA_GERACAO\.ajustarSaiMs/);
  // A espera real: a linha só depois de 1,5 s sem resposta.
  assert.match(geracao, /setTimeout\(\(\) => setEsperaReal\(true\), RITMO_DA_GERACAO\.esperaRealMs\)/);
  assert.match(geracao, /testID="criacao-espera"[^>]*>\{mensagens\.geracao\.escrevendoLicoes\}/);
  // O botão: o giro de 16 px e uma linha só.
  const interface_ = ler('interface.tsx');
  assert.match(interface_, /\{giro && <Giro cor=\{corTexto\} \/>\}/);
  assert.match(interface_, /<Text numberOfLines=\{giro \|\| umaLinha \? 1 : undefined\}/);
  assert.match(geracao, /estilo=\{empilhar \? estudoEstilos\.geracaoBotaoSecundario : dividir \? estudoEstilos\.botaoDividido : undefined\} umaLinha \/>/, '"Ajustar pedido" numa linha');
  assert.match(interface_, /degrauFora\(4, 16, labio, pressed \|\| afundado\)/);
  assert.match(interface_, /giro: \{ width: 16, height: 16, borderRadius: 8, borderWidth: 2 \}/);
});

test('até 600 px, a ação principal ocupa a largura e vem antes do ajuste; o espaço do ajuste mantém o botão parado ao criar', () => {
  assert.match(geracao, /const empilhar = pronta && width <= 600;/);
  assert.match(geracao, /\{empilhar && principal\}\s*\{empilhar && erroDaCriacao\}\s*\{empilhar \? <View style=\{estudoEstilos\.geracaoLugarSecundario\}>/);
  assert.match(geracao, /marginTop: -alturaDoAjuste, minHeight: alturaDoAjuste/, 'a espera ocupa o espaço do ajuste e pode crescer');
  assert.match(estudo, /geracaoAcoesEmpilhadas: \{ gap: 8 \}/);
  assert.match(estudo, /geracaoRodapeEstreito: \{ paddingHorizontal: 16 \}/);
  assert.match(estudo, /geracaoLugarSecundario: \{ minHeight: 44, justifyContent: 'center' \}/);
  assert.match(geracao, /pointerEvents=\{salvando \? 'none' : undefined\} accessibilityElementsHidden=\{salvando\}/);
});

test('erro e proposta expirada: o botão volta, a linha diz o motivo e o novo toque usa o mesmo token', () => {
  assert.match(comecar, /const expirada = codigoDaFalha\(falha\) === 'proposta_invalida';\n\s*setCriacao\(expirada \? 'expirada' : 'erro'\);/);
  assert.match(geracao, /testID="criacao-erro"/);
  assert.match(geracao, /\{expirada \? mensagens\.geracao\.propostaExpirada : mensagens\.geracao\.erroCriacao\}/);
  assert.match(geracao, /acao=\{\(\) => \(expirada \? remontar\(\) : comecar\(proposta\)\)\}/);
  assert.match(estudo, /remontar=\{\(\) => void gerar\(geracao\.objetivo\)\}/, '"Montar de novo" refaz a geração com o mesmo pedido');
  assert.match(comecar, /cliente\.aceitarProposta\(proposta\.token\)/, 'o token da proposta mostrada: o servidor devolve a trilha já criada');
  assert.match(caminho, /\{ nome: 'stu-encorajador' \}/, 'no erro, o Stu fica ao lado do nó 1, encorajador');
});

test('sair durante "Criando sua trilha…": sem cancelar no servidor, a resposta não abre a aula e a trilha entra na lista', () => {
  assert.match(estudo, /if \(criacaoAtual\.current === 'criando'\) \{\n\s*sairDaCriacao\(\);\n\s*return true;\n\s*\}\n\s*\/\/[^\n]*\n\s*if \(emCurso\.current && !\(etapa\.tipo === 'licao' && abandonarCorrecao\(\)\)\) return true;/);
  assert.match(estudo, /desativado=\{ocupado && criacao !== 'criando'\} acao=\{criacao === 'criando' \? sairDaCriacao : tocarMinhasTrilhas\}/);
  const depois = comecar.slice(comecar.indexOf('// A trilha existe no servidor'));
  assert.match(depois, /atualizarPlano\(plano\);\n\s*if \(aceiteAtual\.current !== vez \|\| etapaAtual\.current\.tipo !== 'geracao'\) return;\n\s*setObjetivo\(''\);/,
    'a trilha entra na lista, mas só a criação ativa pode limpar o pedido');
  assert.doesNotMatch(trecho(estudo, 'function sairDaCriacao()', '\n  }\n'), /cliente\./, 'nenhuma chamada ao servidor ao sair');
  const editar = trecho(estudo, 'function atualizarObjetivo(', 'function atualizarPlano(');
  assert.match(editar, /etapaAtual\.current\.tipo === 'planos'\) setEtapa\(\{ tipo: 'objetivo' \}\);/,
    'na conta sem trilhas, uma trilha nova não troca o formulário pela lista enquanto a pessoa digita');
});

test('a passagem: som único, pulso do nó 1, círculo do nó 1 por cima e a aula que entra; reduzida só com opacidade', () => {
  assert.ok(comecar.indexOf("tocaSons.tocarEfeito('geracao_pronta')") < comecar.indexOf("setCriacao('criada')"));
  assert.match(comecar, /lenteDoNo1\.current\?\.measureInWindow\(/);
  const passagem = trecho(estudo, 'function PassagemDaCriacao(', '\n}\n');
  assert.match(passagem, /testID="passagem-criacao" pointerEvents="none"/, 'não recebe toque: a aula responde assim que monta');
  assert.match(passagem, /delay: Math\.max\(0, RITMO_DA_GERACAO\.circuloAtrasoMs - \(Date\.now\(\) - inicio\)\)/);
  assert.match(passagem, /if \(!aulaNaTela\) return;/, 'a camada só some com a aula na tela: a prévia nunca reaparece por baixo');
  assert.match(passagem, /delay: reduzida \? 0 : Math\.max\(0, RITMO_DA_GERACAO\.aulaEntraMs - \(Date\.now\(\) - inicio\)\)/);
  assert.match(passagem, /sumir\.start\(\(\{ finished \}\) => \{ if \(finished\) terminar\.current\(\); \}\);/);
  assert.match(passagem, /Easing\.out\(Easing\.cubic\)/);
  assert.match(passagem, /reduzida\n\s*\? <View style=\{\[StyleSheet\.absoluteFill, \{ backgroundColor: cores\.fundo \}\]\} \/>/);
  // O nó 1 pulsa e vira o nó atual; o caminho firma em 180 ms; o Stu comemora uma vez.
  assert.match(caminho, /toValue: 1\.12, duration: Math\.round\(RITMO_DA_GERACAO\.pulsoMs \* 0\.55\)/);
  assert.match(caminho, /const visual = virouAtual \? coresDaLente\.atual/);
  assert.match(caminho, /duration: RITMO_DA_GERACAO\.firmarMs/);
  assert.match(caminho, /criacao === 'criada' \? \{ nome: 'stu-comemorando', animado: 'acontecimento', acontecimento: 'criada' \}/);
  assert.match(caminho, /criacao === 'criando'\n\s*\? \{ nome: 'stu-estudando', animado: 'laco' \}/);
});

test('a prévia é rascunho e diz só o que é verdade: sem confete, dicas, "Mais uma!", estrelinhas nem contagem', () => {
  assert.match(caminho, /faceRascunho: \{ borderWidth: 2, borderStyle: 'dashed', borderColor: corRascunho \}/);
  assert.match(caminho, /const corRascunho = '#9CB4F5';/);
  // No aceite, todos os nós perdem o tracejado junto com o caminho (revisão do Lead), não só o nó 1.
  assert.match(caminho, /rascunho=\{rascunho && no\.estado === 'previa' && !firmar\}/);
  assert.doesNotMatch(caminho, /maisUma|estrelinha|comMaisUma/);
  const placa = trecho(estudo, 'function PlacaDaGeracao(', '\n}\n');
  // Spec 17, mudança 1: depois de 3 s, a placa revê as frases do contrato (geracao.dicas, verdadeiras, sem número); a espera
  // longa e a proposta continuam como antes. Sem relógio fixo (setInterval): ela acorda só na próxima troca.
  assert.match(placa, /pronta \? mensagens\.geracao\.propostaPronta\(licoes, partes\) : esperaLonga \? mensagens\.geracao\.aguardandoLicao\n\s*: indice === null \? mensagens\.geracao\.montandoTitulo : dicas\[indice\]/);
  assert.doesNotMatch(placa, /placaProntaTexto|setInterval/);
  const semComentarios = geracao.replace(/\{\/\*[\s\S]*?\*\/\}|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(semComentarios, /contagem|contados|faixaGerando|dicas=|anuncioFim/);
  assert.match(geracao, /festaPermitida=\{false\} trofeuDoZero rascunho/);
  assert.match(geracao, /\$\{mensagens\.geracao\.propostaPronta\(total, partes\)\} \$\{mensagens\.geracao\.comecarLicao1\}\./, 'o anúncio do fim da proposta');
  // No fim da proposta, o Stu faz um ciclo de stu-feliz ao lado do troféu (a festa fica para o aceite).
  assert.match(caminho, /\{doZero \? <Stu nome="stu-feliz" tamanho=\{64\} sombra animado="uma-vez" \/>/);
});

test('o nó 1 à vista no toque: inteiro na área livre (entre a placa e o rodapé), com o centro a 40% dela', () => {
  const efeito = trecho(geracao, "if (criacao !== 'criando') return;\n    const primeiro", '}, [criacao]);');
  // A faixa do alto cresce com o nome em duas linhas (spec 16, item 34): a placa começa 10 abaixo da faixa medida (52 com uma linha).
  assert.match(efeito, /const topoLivre = cartaoDeVolta \? 0 : alturaFaixaGeracao \+ 10 \+ alturaPlaca;/);
  assert.match(efeito, /if \(naTela - RITMO_DA_GERACAO\.no1AcimaDoCentro >= topoLivre && naTela \+ RITMO_DA_GERACAO\.no1AbaixoDoCentro <= altura\) return;/);
  assert.match(efeito, /rolarAteNo1\(Math\.max\(0, Math\.round\(centro - \(topoLivre \+ \(altura - topoLivre\) \* RITMO_DA_GERACAO\.no1NaAreaLivre\)\)\)\);/);
  // A rolagem tem 240 ms, quadro a quadro, com saída suave.
  const rolar = trecho(geracao, 'function rolarAteNo1(alvo: number, duracaoPedida: number = RITMO_DA_GERACAO.rolarAteNo1Ms) {', '\n  }\n');
  assert.match(rolar, /scrollTo\(\{ y: de \+ \(alvo - de\) \* \(1 - \(1 - t\) \*\* 3\), animated: false \}\)/);
  // 4140a58: a passagem não espera a rolagem; com o aceite de volta, o que falta termina até t = 120 ms (longe demais ou com
  // movimento reduzido, pula), e o círculo mede o nó 1 nesse instante.
  assert.doesNotMatch(comecar, /fimDaRolagemNo1/);
  assert.match(comecar, /rolagemDoNo1\.current\?\.terminar\(reduzida \? 0 : RITMO_DA_GERACAO\.circuloAtrasoMs\);/);
  assert.match(comecar, /if \(!reduzida\) setTimeout\(medirNo1, RITMO_DA_GERACAO\.circuloAtrasoMs \+ 5\);/);
  assert.match(geracao, /const longe = Math\.abs\(alvo - rolado\.current\) > \(visivel\.current \|\| height\);\n\s*rolarAteNo1\(alvo, prazoMs <= 0 \|\| longe \? 0 : prazoMs\);/);
  // Chegar ao alto durante a criação não traz o cartão do título de volta (ele empurraria o nó 1 para baixo do rodapé).
  assert.match(geracao, /if \(pronta && !cartaoDeVolta && y <= 4 && criacaoAgora\.current === null\) setCartaoDeVolta\(true\);/);
});

test('ajustes do Designer (917e40c): a placa sai na passagem, a parte da prévia sem contagem e o troféu sem brilho antes de concluir', () => {
  assert.equal((geracao.match(/<PlacaDaGeracao [^>]*sai=\{criacao === 'criada'\} reduzir=\{reduzir\} \/>/g) ?? []).length, 2);
  const placa = trecho(estudo, 'function PlacaDaGeracao(', '\n}\n');
  assert.match(placa, /duration: RITMO_DA_GERACAO\.placaSaiMs/);
  assert.match(placa, /outputRange: \[0, -RITMO_DA_GERACAO\.placaSaiDeslize\]/);
  const parte = trecho(caminho, 'function Parte(', '\n}\n');
  assert.match(parte, /if \(resumo\.previa\) texto = null;/);
  assert.match(parte, /\{texto !== null && <Text/);
  const chegada = trecho(caminho, 'function Chegada(', '\n}\n');
  assert.match(chegada, /\{feita && <View style=\{\[caminhoEstilos\.camada, circulo\(tamanho \+ 28\)/, 'o brilho dourado só conquistado');
  assert.match(chegada, /\{feita && \(\n\s*<>\n\s*<Desenho nome="estrela"/, 'as estrelas só conquistado');
  assert.match(chegada, /silhueta=\{feita \? undefined : '#8A93B0'\}/, 'antes, a silhueta cinza');
});
