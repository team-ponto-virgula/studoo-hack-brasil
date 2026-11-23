// Defeitos B3 e B4 da spec 17, na web. B3: o cartão do aceite de IA abria rolado até o fim em 390, com o título cortado: agora abre no topo, com o foco no título, os botões presos
// embaixo e só o texto do meio rolando (o texto não muda). B4: "Agora não" deixava o aviso "Para continuar, permita o uso de IA." sem saída: o aviso ganha o botão secundário
// "Permitir o uso de IA" (`privacidade.permitirAgora`), que reabre o mesmo cartão.
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
const { FolhaAceite } = await import('../src/app/aceite-ia.tsx');
const { Pedido } = await import('../src/app/pedido.tsx');

const t = mensagens.privacidade;
const estado = {
  politica: '/politica-de-privacidade',
  consentimentoIa: {
    necessario: true, versao: '2026-11', aceitoEm: null,
    provedores: [
      { id: 'deepseek', nome: 'DeepSeek', usos: ['Escrever as lições da sua trilha'], politica: 'https://exemplo.test/deepseek' },
      { id: 'openai', nome: 'OpenAI', usos: ['Corrigir as respostas abertas'], politica: 'https://exemplo.test/openai' },
    ],
  },
};
const cartao = renderToStaticMarkup(createElement(FolhaAceite, { estado, aoResponder: () => {} }));

test('B3: o cartão do aceite tem o título no alto, o texto numa área própria que rola e os botões numa faixa presa embaixo', () => {
  const titulo = cartao.indexOf('class="folha-titulo"');
  const corpo = cartao.indexOf('class="folha-aceite__corpo"');
  const rodape = cartao.indexOf('class="folha-aceite__rodape"');
  assert.ok(titulo > 0 && corpo > titulo && rodape > corpo, 'ordem: título, texto, botões');
  assert.match(cartao, /<h2 id="[^"]+" class="folha-titulo" tabindex="-1">Usar a IA para montar e corrigir seus estudos\?<\/h2>/, 'o título recebe o foco por código (tabindex -1), sem entrar na ordem do Tab');
  assert.ok(cartao.includes(t.aceiteTitulo));
  // O texto, a lista de quem recebe o quê e o aviso do "sem IA" estão no corpo que rola; os botões, na faixa fixa.
  const doCorpo = cartao.slice(corpo, rodape);
  for (const texto of [t.aceiteTexto, t.aceiteQuem, t.aceiteSemIa, 'DeepSeek', 'OpenAI']) assert.ok(doCorpo.includes(texto.replace(/&/g, '&amp;')) || doCorpo.includes(texto), `no corpo: ${texto}`);
  const daFaixa = cartao.slice(rodape);
  assert.ok(daFaixa.includes(t.agoraNao) && daFaixa.includes(t.permitir), 'os dois botões na faixa fixa');
  assert.ok(!doCorpo.includes('<button'), 'nenhum botão dentro do texto que rola');
  // A caixa continua sendo um diálogo, nomeado pelo título e descrito pelo texto.
  const rotulo = /aria-labelledby="([^"]+)"/.exec(cartao)?.[1];
  const descricao = /aria-describedby="([^"]+)"/.exec(cartao)?.[1];
  assert.ok(rotulo && cartao.includes(`id="${rotulo}" class="folha-titulo"`));
  assert.ok(descricao && doCorpo.includes(`id="${descricao}"`));
  assert.match(cartao, /role="dialog" aria-modal="true"/);
});

test('B3: o texto do aceite não mudou (decisão do dono sobre a mudança 5: o texto mais curto fica para depois)', () => {
  assert.equal(t.aceiteTitulo, 'Usar a IA para montar e corrigir seus estudos?');
  assert.equal(t.aceiteTexto, 'Para montar trilhas, ler materiais, ouvir sua voz e comentar suas respostas, o Studoo envia esses dados a um serviço de IA de outra empresa. Nada é enviado sem a sua permissão.');
  assert.equal(t.agoraNao, 'Agora não');
  assert.equal(t.permitir, 'Permitir e continuar');
});

test('B3: ao abrir, o texto volta ao topo e o foco vai para o título, sem rolar (e não mais para o botão do fim)', () => {
  const fonte = ler('src/app/aceite-ia.tsx');
  assert.match(fonte, /corpo\.current\?\.scrollTo\(\{ top: 0 \}\)/);
  assert.match(fonte, /querySelector<HTMLElement>\('\.folha-titulo'\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(fonte, /querySelector<HTMLButtonElement>\('\.folha-acoes button'\)\?\.focus\(\)/, 'o foco não vai mais para o botão (que rolava o cartão até o fim)');
  assert.match(fonte, /useDialogo\(caixa, \(\) => \{ if \(!ocupado\) aoResponder\(false\); \}\)/, 'Esc e Tab presos continuam');
});

test('B3: o CSS prende o título e os botões e deixa só o meio rolar (cartão de coluna, corpo com rolagem, faixa que não encolhe)', () => {
  const css = ler('src/app/privacidade.css');
  assert.match(css, /\.folha\.folha--aceite \{[^}]*display: flex; flex-direction: column;[^}]*padding: 0; overflow: hidden;/);
  assert.match(css, /\.folha--aceite > \.folha-titulo \{[^}]*flex: none;/);
  assert.match(css, /\.folha-aceite__corpo \{[^}]*flex: 1 1 auto; min-height: 0;[^}]*overflow-y: auto;/);
  assert.match(css, /\.folha-aceite__rodape \{[^}]*flex: none;[^}]*safe-area-inset-bottom[^}]*border-top: 2px solid var\(--nevoa\)/);
  // A altura máxima do cartão (92svh) é da folha de sempre: é ela que faz o meio rolar em 390.
  assert.match(ler('src/app/compartilhar.css'), /\.folha \{[^}]*max-height: 92svh;/);
});

const props = (falha, extra = {}) => ({
  onProposta: () => {}, objetivo: 'Quero aprender culinária básica', ocupado: false, aviso: null, falha, temPlanos: false, aoMudar: () => {}, anunciar: () => {},
  gerar: () => {}, verPlanos: () => {}, comoFunciona: () => {}, ...extra,
});

test('B4: depois de "Agora não", o aviso do pedido ganha o botão "Permitir o uso de IA" (e não o "Tentar novamente", que repetiria o mesmo erro)', () => {
  const html = renderToStaticMarkup(createElement(Pedido, props('consentimento_ia')));
  assert.ok(html.includes('Para continuar, permita o uso de IA.'), 'o aviso de sempre');
  assert.ok(html.includes(`>${t.permitirAgora}</button>`), 'o botão novo');
  assert.equal(t.permitirAgora, 'Permitir o uso de IA', 'o texto já existia no contrato: nenhum texto novo');
  assert.ok(!html.includes(`>${mensagens.tentarNovamente}</button>`), 'sem "Tentar novamente" aqui');
  assert.match(html, /<button[^>]*class="[^"]*botao--secundario[^"]*"[^>]*>Permitir o uso de IA<\/button>|<button[^>]*>Permitir o uso de IA<\/button>/);
});

test('B4: as outras falhas seguem como eram (repetir quando faz sentido, ver planos no limite, nada nas demais)', () => {
  const repetir = renderToStaticMarkup(createElement(Pedido, props('ia_indisponivel')));
  assert.ok(repetir.includes(`>${mensagens.tentarNovamente}</button>`));
  assert.ok(!repetir.includes(t.permitirAgora));
  const limite = renderToStaticMarkup(createElement(Pedido, props('limite_geracoes', { temPlanos: true })));
  assert.ok(limite.includes(`>${mensagens.pedido.verPlanos}</button>`));
  assert.ok(!limite.includes(t.permitirAgora));
  const semFalha = renderToStaticMarkup(createElement(Pedido, props(null)));
  assert.ok(!semFalha.includes(t.permitirAgora));
});

test('B4: o botão reabre o mesmo cartão (pedirAceiteIa com o estado de privacidade) e, com "Permitir e continuar", refaz o pedido uma vez', () => {
  const fonte = ler('src/app/pedido.tsx');
  assert.match(fonte, /const semAceite = falha === 'consentimento_ia';/);
  assert.match(fonte, /if \(await pedirAceiteIa\(await cliente\.privacidade\(\)\)\) tentar\(\);/);
  assert.match(fonte, /\) : semAceite \? \(\s*<Botao variante="secundario" disabled=\{ocupado\} onClick=\{\(\) => void permitirDeNovo\(\)\}>\{mensagens\.privacidade\.permitirAgora\}<\/Botao>/);
});
