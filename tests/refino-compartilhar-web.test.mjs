// Refinamento da UI (spec 16), item 31: o estado do compartilhamento é um só, curto, no botão do mapa e no selo de Minhas trilhas ("Compartilhar", "Compartilhada",
// "Em revisão", "Não publicada"). O texto longo fica no Perfil e na folha. O servidor entrega a revisão no resumo da trilha (`link.moderacao`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { estadoDoCompartilhamento } from '@studoo/contratos';
import { mensagens } from '@studoo/contratos/experiencia';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');

test('o estado curto: sem link, aprovado (ou resposta antiga, sem o campo), em revisão e recusado', () => {
  assert.equal(estadoDoCompartilhamento(undefined), 'sem-link');
  assert.equal(estadoDoCompartilhamento(null), 'sem-link');
  assert.equal(estadoDoCompartilhamento({ codigo: 'x', noPerfil: false, moderacao: 'aprovado' }), 'compartilhada');
  assert.equal(estadoDoCompartilhamento({ codigo: 'x', noPerfil: false }), 'compartilhada', 'o servidor antigo não mandava a revisão: segue "Compartilhada", como hoje');
  assert.equal(estadoDoCompartilhamento({ codigo: 'x', noPerfil: true, moderacao: 'pendente' }), 'em-revisao');
  assert.equal(estadoDoCompartilhamento({ codigo: 'x', noPerfil: true, moderacao: 'recusado' }), 'nao-publicada');
});

test('os quatro textos curtos são os do contrato, os mesmos do app', () => {
  assert.equal(mensagens.compartilhar.entrada, 'Compartilhar');
  assert.equal(mensagens.compartilhar.selo, 'Compartilhada');
  assert.equal(mensagens.seguranca.seloEmRevisao, 'Em revisão');
  assert.equal(mensagens.seguranca.seloNaoPublicada, 'Não publicada');
});

test('web: o botão do mapa e o selo do cartão dizem o mesmo estado, com o selo neutro (em revisão) e o âmbar (não publicada) da spec 14', () => {
  const tela = ler('src/app/estudo.tsx');
  assert.match(tela, /const estado = estadoDoCompartilhamento\(plano\.link\);\s*return <p className="selo-compartilhada" data-estado=\{estado\}><Icone nome="compartilhar" \/>\{rotuloDoEstado\(estado\)\}<\/p>;/);
  assert.match(tela, /className="trilha-compartilhar" data-estado=\{estadoDoCompartilhamento\(plano\.link\)\}/);
  assert.match(tela, /<Icone nome="compartilhar" \/>\{rotuloDoEstado\(estadoDoCompartilhamento\(plano\.link\)\)\}/);
  assert.match(tela, /case 'em-revisao': return mensagens\.seguranca\.seloEmRevisao;\s*case 'nao-publicada': return mensagens\.seguranca\.seloNaoPublicada;\s*case 'compartilhada': return mensagens\.compartilhar\.selo;\s*default: return mensagens\.compartilhar\.entrada;/);
  const css = ler('src/app/compartilhar.css');
  assert.match(css, /\.selo-compartilhada\[data-estado='em-revisao'\] \{ background: #f1f4fd; color: #5e6a85; \}/, 'neutro, como .seguranca-estado');
  assert.match(css, /\.selo-compartilhada\[data-estado='nao-publicada'\] \{ background: #fff6ea; color: #9a5b00; \}/, 'âmbar, como .seguranca-estado[data-recusado]');
  assert.match(css, /\.trilha-compartilhar\[data-estado='nao-publicada'\] \{ color: #9a5b00; background: #fff6ea; \}/);
  // O texto longo continua só no Perfil e na folha (a tela do mapa e o cartão não o repetem).
  assert.doesNotMatch(tela.slice(tela.indexOf('function MarcaCompartilhar'), tela.indexOf('function CartaoDestaque')), /seguranca\.emRevisao|seguranca\.naoPublicada/);
});
