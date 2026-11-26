// A retomada da criação na tela da web (spec 04, Retomada da criação): os textos de cada fase (os do Designer, pelo contrato), o que a prévia e os avisos desenham, e as regras que a tela
// promete: o aviso não mexe no foco nem no texto que a pessoa digita, cada mudança é anunciada uma vez, "Sem conexão" só quando o aparelho está offline, o prazo do limite é o RESTANTE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mensagens } from '@studoo/contratos/experiencia';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const { apresentarCriacao, segundosRestantes, textoDaFalha, ESPERA_QUE_JUSTIFICA_O_AVISO_MS } = await import('../src/app/criacao-textos.ts');
const { CriacoesEmCurso } = await import('../src/app/criacoes-em-curso.tsx');
const { PreviaTrilha } = await import('../src/app/previa-trilha.tsx');

const g = mensagens.geracao;
const A = '3f1c2b4a-8d7e-4a60-9b1f-0c2d3e4f5a6b';
const B = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const T0 = 2_000_000;
const pendente = (id, extra = {}) => ({ versao: 1, pedidoId: id, token: 'x.y', intencao: 'comecar', titulo: id === A ? 'Python para programadores experientes' : 'Violão do zero', licoes: 10, partes: 3, enviadoEm: T0, ...extra });
const criacao = (fase, extra = {}, p = {}) => ({ pendente: pendente(A, p), fase, etapa: null, ...extra });
const falha = (extra = {}) => ({ codigo: 'ia_indisponivel', causa: 'resposta_ia', repetivel: true, tentativas: 1, recebidaEm: T0, ...extra });
const ap = (c, agora = T0 + 1000, online = true) => apresentarCriacao(c, { agora, online });

test('preparando: "Preparando sua trilha…" (ou "Salvando sua trilha…"), sem ação; só depois de um tempo entra a linha que diz que a pessoa pode sair, sem prometer sucesso', () => {
  for (const fase of ['enviando', 'em_preparo']) {
    const comecar = ap(criacao(fase));
    assert.deepEqual({ texto: comecar.texto, acoes: comecar.acoes, anuncio: comecar.anuncio, tom: comecar.tom }, { texto: 'Preparando sua trilha…', acoes: [], anuncio: null, tom: 'neutro' });
    assert.equal(comecar.dica, undefined);
    assert.equal(ap(criacao(fase, {}, { intencao: 'salvar' })).texto, 'Salvando sua trilha…');
  }
  const demorou = ap(criacao('em_preparo'), T0 + ESPERA_QUE_JUSTIFICA_O_AVISO_MS);
  assert.equal(demorou.dica, 'Você pode sair. Quando estiver pronta, a trilha aparece em Minhas trilhas.');
  assert.doesNotMatch(demorou.dica, /garant|sempre|segundos|minutos/i);
});

test('sem conexão e sem confirmação são estados diferentes: "Sem conexão" só com o aparelho offline; com rede e sem resposta, "Ainda não conseguimos confirmar"; os dois oferecem "Verificar status"', () => {
  const semConexao = ap(criacao('sem_conexao'), T0 + 1000, false);
  assert.equal(semConexao.texto, 'Sem conexão. Vamos verificar o status quando a conexão voltar.');
  assert.equal(semConexao.anuncio, semConexao.texto, 'o leitor ouve o que a tela mostra');
  assert.deepEqual(semConexao.acoes, [{ id: 'verificar', rotulo: 'Verificar status', desabilitada: true }], 'sem rede, a verificação espera a rede (e roda sozinha quando ela volta)');
  assert.deepEqual(ap(criacao('sem_conexao'), T0 + 1000, true).acoes, [{ id: 'verificar', rotulo: 'Verificar status', desabilitada: false }]);
  const semConfirmacao = ap(criacao('sem_confirmacao'));
  assert.equal(semConfirmacao.texto, 'Ainda não conseguimos confirmar se sua trilha foi salva.');
  assert.equal(semConfirmacao.anuncio, semConfirmacao.texto);
  assert.deepEqual(semConfirmacao.acoes, [{ id: 'verificar', rotulo: 'Verificar status' }]);
  assert.doesNotMatch(semConfirmacao.texto, /Sem conexão/, 'servidor lento com rede não é "sem conexão"');
  assert.equal(semConfirmacao.tom, 'neutro');
});

test('pedido que não chegou (ausência confirmada): "Reenviar pedido", com a mesma proposta; trilha pronta: "Abrir lição 1"; trilha salva para depois: Minhas trilhas', () => {
  const naoChegou = ap(criacao('nao_chegou'));
  assert.equal(naoChegou.texto, 'Seu pedido não chegou ao servidor.');
  assert.deepEqual(naoChegou.acoes.map((a) => a.rotulo), ['Reenviar pedido', 'Fechar']);
  const pronta = ap(criacao('pronta', { plano: { id: A } }));
  assert.equal(pronta.texto, 'Sua trilha está pronta.');
  assert.equal(pronta.anuncio, 'Sua trilha está pronta. Abrir lição 1.');
  assert.deepEqual(pronta.acoes.map((a) => [a.id, a.rotulo]), [['abrir', 'Abrir lição 1'], ['fechar', 'Fechar']]);
  assert.equal(pronta.tom, 'ok');
  const salva = ap(criacao('pronta', { plano: { id: A } }, { intencao: 'salvar' }));
  assert.equal(salva.texto, 'Sua trilha foi salva em Minhas trilhas.');
  assert.deepEqual(salva.acoes.map((a) => [a.id, a.rotulo]), [['ver', 'Ver em Minhas trilhas'], ['fechar', 'Fechar']]);
});

test('falha confirmada: o motivo em linguagem simples, anunciado como aparece; "Tentar de novo" só se der; proposta vencida pede "Montar de novo"; sem diagnóstico inventado', () => {
  const porCausa = (causa, extra) => ap(criacao('falha', { falha: falha({ causa, ...extra }) }));
  assert.equal(porCausa('resposta_ia').texto, 'A IA não conseguiu escrever as lições desta vez.');
  assert.equal(porCausa('tempo').texto, 'A criação demorou mais do que o esperado e foi interrompida.');
  assert.equal(porCausa('interrompida').texto, 'A criação foi interrompida antes de terminar.');
  assert.equal(porCausa('outra', { codigo: 'falha' }).texto, 'Não deu para criar a trilha.');
  assert.equal(porCausa('outra', { codigo: 'consentimento_ia' }).texto, mensagens.erros.consentimento_ia, 'o aceite de IA negado diz o seu motivo');
  for (const causa of ['resposta_ia', 'tempo', 'interrompida']) {
    const a = porCausa(causa);
    assert.equal(a.anuncio, a.texto, 'o leitor ouve o motivo exibido, não "veja o aviso"');
    assert.deepEqual(a.acoes.map((x) => [x.rotulo, !!x.desabilitada]), [['Tentar de novo', false], ['Fechar', false]]);
    assert.equal(a.tom, 'erro');
  }
  assert.doesNotMatch(porCausa('resposta_ia').texto, /\d|minuto|segundo/, 'sem prazo nem número que não se conhece');
  const vencida = porCausa('proposta_expirada', { repetivel: false, codigo: 'proposta_invalida' });
  assert.equal(vencida.texto, 'Esta proposta expirou. Monte de novo.');
  assert.deepEqual(vencida.acoes.map((x) => x.rotulo), ['Montar de novo', 'Fechar']);
  const segura = porCausa('seguranca', { repetivel: false, codigo: 'conteudo_nocivo' });
  assert.equal(segura.texto, mensagens.erros.conteudo_nocivo);
  assert.deepEqual(segura.acoes.map((x) => x.rotulo), ['Fechar'], 'o mesmo token não se repete');
});

test('limite com prazo: mostra o que RESTA (cai com o tempo, não volta cheio) e o botão «Tentar de novo» fica visível e DESATIVADO; só o SERVIDOR o habilita, nunca o relógio do aparelho', () => {
  const limite = criacao('falha', { falha: falha({ causa: 'limite', repetivel: false, aguardarSegundos: 600 }) });
  const agora = ap(limite, T0 + 1000);
  assert.equal(agora.texto, 'Chegamos ao limite de criações por agora. Tente de novo em 10 minutos.');
  assert.equal(agora.anuncio, agora.texto, 'o prazo vai junto no que o leitor ouve');
  assert.deepEqual(agora.acoes.map((a) => [a.id, a.rotulo, !!a.desabilitada]), [['reenviar', 'Tentar de novo', true], ['fechar', 'Fechar', false]], 'visível e desativado; sem "Verificar status" aqui');
  assert.ok(!agora.acoes.some((a) => a.id === 'verificar'), 'a consulta do fim do prazo é do laço, não de um botão');
  assert.equal(ap(limite, T0 + 5 * 60_000).texto, 'Chegamos ao limite de criações por agora. Tente de novo em 5 minutos.', 'cinco minutos depois, restam cinco');
  assert.equal(ap(limite, T0 + 9.5 * 60_000).texto, 'Chegamos ao limite de criações por agora. Tente de novo em 1 minuto.');
  const depois = ap(limite, T0 + 10 * 60_000 + 1);
  assert.equal(depois.texto, 'Chegamos ao limite de criações por agora. Tente de novo mais tarde.', 'passado o prazo, nenhuma espera é prometida');
  assert.deepEqual(depois.acoes.map((a) => [a.id, !!a.desabilitada]), [['reenviar', true], ['fechar', false]], 'o prazo acabou no relógio, mas quem libera é o servidor: o botão continua desativado até a consulta dizer que pode');
  // O servidor liberou depois da espera (a consulta do mesmo pedido devolveu repetível, sem prazo): agora sim, e a frase combina com o botão (não diz "mais tarde").
  const liberada = criacao('falha', { falha: falha({ causa: 'limite', repetivel: true, liberadaAposEspera: true }) });
  const aberta = ap(liberada, T0 + 11 * 60_000);
  assert.deepEqual(aberta.acoes.map((a) => [a.id, a.rotulo, !!a.desabilitada]), [['reenviar', 'Tentar de novo', false], ['fechar', 'Fechar', false]]);
  assert.equal(aberta.texto, 'O limite acabou. Você já pode tentar de novo.');
  assert.equal(aberta.anuncio, aberta.texto);
  // Sem prazo conhecido desde o começo, vale o campo de permissão que a API devolveu: repetível, o botão já está ativo; não repetível, fica visível e desativado.
  const semPrazo = ap(criacao('falha', { falha: falha({ causa: 'limite', repetivel: true }) }), T0 + 1000);
  assert.equal(semPrazo.texto, 'Chegamos ao limite de criações por agora. Tente de novo mais tarde.');
  assert.deepEqual(semPrazo.acoes.map((a) => [a.id, !!a.desabilitada]), [['reenviar', false], ['fechar', false]]);
  const semPrazoBloqueado = ap(criacao('falha', { falha: falha({ causa: 'limite', repetivel: false }) }), T0 + 1000);
  assert.deepEqual(semPrazoBloqueado.acoes.map((a) => [a.id, !!a.desabilitada]), [['reenviar', true], ['fechar', false]], 'a permissão manda, sem prazo ou com ele');
  assert.equal(segundosRestantes({ aguardarSegundos: 90, recebidaEm: T0 }, T0 + 30_000), 60);
  assert.equal(segundosRestantes({ recebidaEm: T0 }, T0), 0);
  assert.equal(textoDaFalha(falha({ causa: 'limite' }), T0), 'Chegamos ao limite de criações por agora. Tente de novo mais tarde.', 'sem prazo conhecido, sem prazo na frase');
  assert.equal(mensagens.geracao.falhaDaCriacao.limiteComEspera(3600), 'Chegamos ao limite de criações por agora. Tente de novo em 1 hora.');
  // A consulta que perde a resposta cai no estado de dúvida, com "Verificar status" (o botão volta a ser o de verificar).
  const duvida = ap(criacao('sem_confirmacao'));
  assert.deepEqual(duvida.acoes.map((a) => [a.id, a.rotulo]), [['verificar', 'Verificar status']]);
});

const trilhaDaPrevia = (proposta) => ({
  objetivo: 'Aprender Python', titulo: 'Python', diagnosticoId: undefined, proposta,
  fluxos: [{ titulo: 'Base', licoes: ['Tipos', 'Coleções'] }, { titulo: 'Prática', licoes: ['Projeto'] }],
});
const propostaDaPrevia = { token: 'x.y', pedidoId: A, titulo: 'Python', objetivo: 'Aprender Python', origem: 'Conteúdo gerado pelo Studoo', fluxos: [{ titulo: 'Base', licoes: [{ titulo: 'Tipos' }, { titulo: 'Coleções' }] }, { titulo: 'Prática', licoes: [{ titulo: 'Projeto' }] }] };
const parametros = (extra = {}) => ({ aceite: 'livre', passagem: null, sair() {}, cancelar() {}, ajustar() {}, aceitar() {}, remontar() {}, abrirExistente() {}, geracao: trilhaDaPrevia(propostaDaPrevia), ...extra });
const previa = (extra) => renderToStaticMarkup(createElement(PreviaTrilha, parametros(extra)));

test('a prévia: a contagem da proposta é "Sua proposta tem N lições em M partes."; "pronta" não aparece antes de salvar', () => {
  const html = previa();
  assert.match(html, /Sua proposta tem 3 lições em 2 partes\./);
  assert.doesNotMatch(html, /Sua trilha está pronta/);
  assert.match(html, />Começar a lição 1<\/button>/);
});

test('a prévia, durante o preparo: o botão diz "Preparando sua trilha…" (ocupado), e a linha de saída só entra com a dica; sem conexão, o status fica perto da ação e a ação principal é "Verificar status"', () => {
  const preparando = previa({ aceite: 'iniciando', dica: 'Você pode sair. Quando estiver pronta, a trilha aparece em Minhas trilhas.' });
  assert.match(preparando, /previa-giro[\s\S]*?Preparando sua trilha…/);
  assert.match(preparando, /<span class="previa-espera__dica">Você pode sair\. Quando estiver pronta, a trilha aparece em Minhas trilhas\.<\/span>/);
  assert.match(preparando, /<p class="previa-espera" data-visivel="true">/, 'a dica faz a linha aparecer mesmo antes de a linha de frases entrar');
  assert.doesNotMatch(preparando, /previa-espera__linha/, 'com a dica, as frases que se revezam saem: o rodapé não cresce com duas linhas de espera');
  const css = ler('src/app/previa-trilha.css');
  assert.match(css, /\.previa-rodape \{[^}]*max-height: 55dvh; overflow-y: auto; overscroll-behavior: contain;/, 'texto a 200% numa janela baixa: o rodapé rola por dentro e o mapa mantém área (spec 04, C8)');

  const semConexao = ap(criacao('sem_conexao'), T0 + 1, false);
  const html = previa({ retomada: { texto: semConexao.texto, tom: semConexao.tom, acao: { rotulo: semConexao.acoes[0].rotulo, desabilitada: true }, aoAcionar() {} } });
  assert.match(html, /<p class="previa-erro" data-tom="neutro">Sem conexão\. Vamos verificar o status quando a conexão voltar\.<\/p>/);
  assert.match(html, /<button[^>]*class="[^"]*previa-comecar[^"]*"[^>]*aria-disabled="true"[^>]*>Verificar status<\/button>/);
  assert.doesNotMatch(html, /role="alert"/, 'o anúncio é um só, pela região viva do estudo: o texto da prévia não repete');
  assert.doesNotMatch(html, />Começar a lição 1<\/button>/, 'a ação principal troca');
  assert.match(html, /data-falha="true"/, 'o rodapé reserva a linha do texto de estado (até 600 px)');
  assert.doesNotMatch(html, /previa-salvar/, 'e "Salvar para depois" não compete com o status');
});

test('a prévia, trilha pronta numa retomada: "Sua trilha está pronta." e "Abrir lição 1" como ação principal (tom ok)', () => {
  const pronta = ap(criacao('pronta', { plano: { id: A } }));
  const html = previa({ retomada: { texto: pronta.texto, tom: pronta.tom, acao: { rotulo: pronta.acoes[0].rotulo }, aoAcionar() {} } });
  assert.match(html, /<p class="previa-erro" data-tom="ok">Sua trilha está pronta\.<\/p>/);
  assert.match(html, /<button[^>]*class="[^"]*previa-comecar[^"]*"[^>]*>Abrir lição 1<\/button>/);
});

test('os avisos: um cartão por pedido (A e B), cada um com o título e o estado dele; sem foco, sem alerta, sem nada que mova a tela; vazio não desenha nada', () => {
  assert.equal(renderToStaticMarkup(createElement(CriacoesEmCurso, { criacoes: [], agora: T0, online: true, aoAcionar() {} })), '');
  const a = criacao('em_preparo');
  const b = { pendente: pendente(B, { intencao: 'salvar' }), fase: 'pronta', etapa: null, plano: { id: B } };
  const html = renderToStaticMarkup(createElement(CriacoesEmCurso, { criacoes: [a, b], agora: T0 + 1000, online: true, aoAcionar() {} }));
  assert.equal((html.match(/<article /g) ?? []).length, 2);
  assert.match(html, new RegExp(`<article[^>]*data-fase="em_preparo"[^>]*data-pedido="${A}"`));
  assert.match(html, new RegExp(`<article[^>]*data-fase="pronta"[^>]*data-pedido="${B}"`));
  assert.match(html, /Python para programadores experientes/);
  assert.match(html, /Preparando sua trilha…/);
  assert.match(html, /Sua trilha foi salva em Minhas trilhas\./);
  assert.match(html, />Ver a prévia<\/button>/, 'quem ainda prepara tem como voltar à prévia');
  assert.match(html, />Ver em Minhas trilhas<\/button>/);
  assert.doesNotMatch(html, /autofocus|autoFocus|tabindex|role="alert"|role="status"|aria-live/i, 'o cartão não toma o foco nem anuncia por conta própria: quem anuncia é a região viva do estudo, uma vez');
  assert.match(html, /aria-label="Criação de trilhas"/);
});

test('o fonte do estudo: o aceite passa pelo controlador (o pedido é guardado antes de enviar), o aviso não mexe no pedido que a pessoa digita nem no foco, e cada fase é anunciada uma vez', () => {
  const estudo = ler('src/app/estudo.tsx');
  assert.match(estudo, /if \(proposta\?\.pedidoId && controlador\.current\) \{[\s\S]*?controlador\.current\.iniciar\(proposta, iniciar \? 'comecar' : 'salvar'\);[\s\S]*?return;\s*\}\s*return comecarDireto\(painel, iniciar\);/,
    'com pedidoId e conta, o controlador guarda e envia; sem eles, o aceite de sempre');
  const corpo = (nome) => estudo.slice(estudo.indexOf(`function ${nome}(`), estudo.indexOf('\n  }\n', estudo.indexOf(`function ${nome}(`)));
  for (const nome of ['aoMudarCriacoes', 'concluirCriacao', 'recusarCriacao']) {
    const texto = corpo(nome);
    assert.ok(texto.length > 80, nome);
    assert.doesNotMatch(texto, /\.focus\(|setObjetivo\(|scrollTo|scrollIntoView/, `${nome} não mexe no foco, no texto digitado nem na rolagem`);
  }
  assert.match(corpo('aoMudarCriacoes'), /const anterior = fasesAnunciadas\.current\.get\(id\);\s*if \(anterior === situacao\) continue;/, 'a mesma situação não é anunciada duas vezes');
  assert.match(corpo('aoMudarCriacoes'), /criacao\.fase === 'falha' \? `falha:\$\{criacao\.falha\?\.causa\}:\$\{criacao\.falha\?\.repetivel \? 'liberada' : 'bloqueada'\}` : criacao\.fase;/,
    'o prazo que cai não é uma situação nova, mas a falha que o servidor liberou é (o leitor ouve a mudança)');
  assert.match(corpo('aoMudarCriacoes'), /if \(criacao\.fase === 'pronta' && estaNaPrevia\(id\)\) continue;/, 'na prévia que a pessoa acompanha, o fim é anunciado pelo fluxo (não duas vezes)');
  assert.match(corpo('aoMudarCriacoes'), /if \(!anuncio && preparando && anterior !== undefined && anterior !== 'enviando' && anterior !== 'em_preparo'\) \{\s*anuncio = criacao\.pendente\.intencao === 'salvar' \? mensagens\.geracao\.anuncioSalvandoSuaTrilha : mensagens\.geracao\.anuncioPreparando;/,
    'voltar a preparar depois de dúvida ou falha (rede que voltou, reenvio) é dito uma vez, sem deixar o texto antigo na região viva');
  assert.doesNotMatch(corpo('aoAcionarCriacao'), /anunciar\(/, 'reenviar não anuncia por conta própria: o anúncio de "preparando" sai da mudança de fase, uma vez');
  assert.match(estudo, /const naPrevia = telaRef\.current\.tipo === 'geracao' && geracaoRef\.current\?\.proposta\?\.pedidoId === pedidoId && !!painel\?\.isConnected;\s*if \(!naPrevia \|\| !painel\) return;/,
    'fora da prévia, a trilha confirmada só vira aviso: a tela da pessoa fica onde está');
  assert.match(estudo, /const avisosDeCriacao = tela\.tipo === 'licao' \|\| tela\.tipo === 'abrindo-criada' \? \[\] : criacoes\.filter\(\(item\) => item\.pendente\.pedidoId !== pedidoDaPrevia\);/);
  assert.match(estudo, /\{inicio === 'pronto' && tela\.tipo !== 'planos' && <CriacoesEmCurso criacoes=\{avisosDeCriacao\}/, 'no alto de todas as telas, menos Minhas trilhas');
  const planos = estudo.slice(estudo.indexOf("tela.tipo === 'planos' && planos.length > 0 && (() => {"));
  assert.ok(planos.indexOf('<h1 tabIndex={-1}>{mensagens.planos.titulo}</h1>') < planos.indexOf('<CriacoesEmCurso criacoes={avisosDeCriacao}'), 'em Minhas trilhas, os avisos vêm DEPOIS do título da seção (que continua visível)');
  const vazia = estudo.slice(estudo.indexOf('id="planos-vazio-titulo">'));
  assert.ok(vazia.indexOf('</h1>') < vazia.indexOf('<CriacoesEmCurso') && vazia.indexOf('<CriacoesEmCurso') < vazia.indexOf('planos-vazio"'), 'e na biblioteca vazia também: título, avisos, convite');
  assert.match(vazia, /\{avisosDeCriacao\.length === 0 && <div className="planos-vazio" data-testid="planos-vazio">/, 'com uma criação em curso, o convite "Nenhuma trilha ainda" não aparece junto do aviso');
  assert.match(estudo, /setAnuncio\(destino\.tipo === 'planos' && planos\.length === 0 && criacoes\.length === 0 \? `\$\{mensagens\.planos\.vazioTitulo\}\.` : ''\);/, 'a biblioteca vazia não se anuncia com uma criação em curso');
  const css = ler('src/app/previa-trilha.css');
  assert.match(css, /\.painel--geracao\[data-fase=criada\] \.previa-mapa \{ overflow: hidden; \}/, 'o mapa só trava na passagem para a aula');
  assert.doesNotMatch(css, /:is\(\[data-fase=salvando\],\[data-fase=criada\]\) \.previa-mapa \{ overflow: hidden/, 'durante o preparo o mapa rola (teclado inclusive), para a pessoa chegar ao fim dele');
  assert.match(estudo, /controlador\.current\.retomar\(\);/, 'ao abrir, os pedidos guardados da conta voltam a ser acompanhados');
  assert.match(estudo, /iniciarControlador\(sessao\.conta\);/, 'a conta vem da sessão: uma chave por conta');
  assert.match(estudo, /controlador\.current\?\.esquecerTudo\(\); irParaLogin\(\);/, 'sair da conta apaga o que era dela neste aparelho');
  assert.match(estudo, /navegar\(\{ tipo: 'plano', plano, aviso: mensagens\.geracao\.licaoNaoAbriu \}\);/, 'trilha salva e só a lição falhou: reabre só a lição, nada é recriado');
  assert.equal(mensagens.geracao.licaoNaoAbriu, 'Sua trilha foi salva, mas não deu para abrir a lição 1. Toque na lição para tentar de novo.');
});
