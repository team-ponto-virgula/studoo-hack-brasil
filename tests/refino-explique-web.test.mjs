// Refinamento da UI (spec 16), lote 3, o "Explique com suas palavras" na web. Item 24: com o "Explique" aberto, o rodapé do acerto vira UMA linha de 64 px (o visto e o título à esquerda, "Continuar" à direita,
// no mesmo verde claro), sem o texto do retorno. Item 25: os três passos do "Explique" (antes pílulas com borda, que pareciam filtros) viram uma linha só de indicador, como a da ponte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mensagens } from '@studoo/contratos/experiencia';
import { linhaDoPassoDoEnsino, nomeDaEtapaDoEnsino, passoAtivoDoEnsino } from '../src/app/ensino-passos.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const m = mensagens.estudio;

test('item 25: o nome do passo sai sem o número da lista antiga, e o "Passo n de 3" é o da ponte', () => {
  assert.deepEqual(m.ensinoEtapas.map(nomeDaEtapaDoEnsino), ['Gravar ou escrever', 'Revisar texto', 'Ver retorno do Stu']);
  assert.equal(nomeDaEtapaDoEnsino(m.vozAoVivo.passoComVoz), 'Conversar, gravar ou escrever');
  assert.equal(nomeDaEtapaDoEnsino('Sem número'), 'Sem número');
  assert.equal(m.ponteIndicador(1), 'Passo 1 de 3');
  assert.equal(m.ponteIndicador(3), 'Passo 3 de 3');
});

test('item 25: o passo ativo é o 1º enquanto grava ou conversa, o 3º com o retorno do Stu, o 2º com texto para revisar e o 1º sem texto (a conta do app)', () => {
  const ativo = (extra) => passoAtivoDoEnsino({ gravando: false, vozAtiva: false, temRetorno: false, temTexto: false, ...extra });
  assert.equal(ativo({}), 0, 'sem texto');
  assert.equal(ativo({ temTexto: true }), 1, 'com texto para revisar');
  assert.equal(ativo({ temTexto: true, temRetorno: true }), 2, 'com o retorno do Stu');
  assert.equal(ativo({ temRetorno: true }), 2);
  assert.equal(ativo({ gravando: true, temTexto: true }), 0, 'gravando: o 1º');
  assert.equal(ativo({ vozAtiva: true, temTexto: true, temRetorno: true }), 0, 'conversando ao vivo: o 1º, mesmo com o retorno de antes na tela');
  assert.equal(ativo({ gravando: true, temRetorno: true }), 0);
});

test('item 25: a linha mostra "Passo 1 de 3 · Gravar ou escrever" e o leitor de tela ouve "Passo 1 de 3: Gravar ou escrever"', () => {
  const etapas = [m.ensinoEtapas[0], m.ensinoEtapas[1], m.ensinoEtapas[2]];
  assert.deepEqual(linhaDoPassoDoEnsino(0, etapas, m.ponteIndicador), { visivel: 'Passo 1 de 3 · Gravar ou escrever', leitor: 'Passo 1 de 3: Gravar ou escrever' });
  assert.deepEqual(linhaDoPassoDoEnsino(1, etapas, m.ponteIndicador), { visivel: 'Passo 2 de 3 · Revisar texto', leitor: 'Passo 2 de 3: Revisar texto' });
  assert.deepEqual(linhaDoPassoDoEnsino(2, etapas, m.ponteIndicador), { visivel: 'Passo 3 de 3 · Ver retorno do Stu', leitor: 'Passo 3 de 3: Ver retorno do Stu' });
  const comVoz = [m.vozAoVivo.passoComVoz, m.ensinoEtapas[1], m.ensinoEtapas[2]];
  assert.equal(linhaDoPassoDoEnsino(0, comVoz, m.ponteIndicador).visivel, 'Passo 1 de 3 · Conversar, gravar ou escrever', 'com a voz ao vivo liberada, a 1ª etapa muda de nome');
});

test('item 25: a web desenha uma linha só (não tocável), com a conta do app, e as pílulas com borda saíram do código e do CSS', () => {
  const fonte = ler('src/app/estudio.tsx');
  assert.match(fonte, /import \{ linhaDoPassoDoEnsino, passoAtivoDoEnsino \} from '\.\/ensino-passos';/);
  assert.match(fonte, /passoAtivoDoEnsino\(\{ gravando, vozAtiva: etapaVoz === 'ativa', temRetorno: Boolean\(ensino\), temTexto: Boolean\(texto\.trim\(\)\) \}\)/);
  assert.match(fonte, /\[vozAoVivoDisponivel \? m\.vozAoVivo\.passoComVoz : m\.ensinoEtapas\[0\], m\.ensinoEtapas\[1\], m\.ensinoEtapas\[2\]\],\s*m\.ponteIndicador,/);
  const linha = /<p className="ensino-indicador">([\s\S]*?)<\/p>/.exec(fonte)?.[1] ?? '';
  assert.match(linha, /<span aria-hidden="true">\{passoDoEnsino\.visivel\}<\/span>\s*<span className="somente-leitor">\{passoDoEnsino\.leitor\}<\/span>/, 'o que se vê é escondido do leitor, que ouve a versão com ":"');
  assert.doesNotMatch(linha, /<button|<a |tabIndex|onClick|role=/, 'a linha não é tocável nem focável nem região viva');
  assert.doesNotMatch(fonte, /className="ensino-passos"|<ol\b|ensinoEtapasLabel/, 'as três pílulas saíram');
  const css = ler('src/app/estudio.css');
  assert.match(css, /\.estudio-card \.ensino-indicador \{ margin: 0 0 12px; color: #5e6a85; font-size: 0\.875rem; font-weight: 800; line-height: 1\.4286; \}/, '14/20, 800, #5E6A85 (ganha de ".estudio-card p")');
  assert.doesNotMatch(css, /\.ensino-passos/, 'o CSS das pílulas saiu');
});

test('item 24: com o "Explique" aberto, o rodapé do acerto é UMA linha de 64 px: 48 do botão mais 8 de cada lado, título 16/800 em #1F7A5A à esquerda e "Continuar" compacto à direita', () => {
  const css = ler('src/app/aula.css');
  const regra = (seletor) => new RegExp(`\\.aula-rodape\\[data-retorno='certa'\\]\\[data-compacto\\]${seletor} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  assert.match(regra(''), /padding-block: 8px calc\(8px \+ env\(safe-area-inset-bottom\)\);/, '8 em cima e 8 embaixo (a área segura do iPhone entra por fora)');
  assert.match(regra(' \\.aula-rodape__conteudo'), /flex-direction: row; flex-wrap: nowrap; align-items: center;/, 'uma fileira só, também no celular (antes: coluna)');
  assert.match(regra(' \\.aula-retorno'), /display: flex; flex: 1 1 0; align-items: center;[^}]*min-width: 0;/);
  assert.match(regra(' \\.aula-retorno__icone'), /width: 32px; height: 32px;/);
  const titulo = regra(' \\.aula-retorno h2');
  assert.match(titulo, /font-size: 1rem; font-weight: 800; line-height: 1\.375;/, '16/800');
  assert.match(titulo, /white-space: nowrap;[\s\S]*|text-overflow: ellipsis/, 'o título não quebra a linha');
  assert.match(regra(' \\.aula-rodape__acoes'), /flex: none; width: auto;/);
  const botao = regra(' \\.aula-rodape__acoes > \\.botao');
  assert.match(botao, /min-height: 48px;/);
  assert.match(botao, /width: auto;/, '"Continuar" compacto: do tamanho do rótulo, não a largura toda');
  // A conta dos 64 px.
  assert.equal(8 + 48 + 8, 64);
  // O título herda o verde do sucesso (#1F7A5A), e o fundo é o verde claro do acerto de sempre.
  assert.match(css, /--sucesso: #1f7a5a|\.aula-retorno h2 \{ color: var\(--sucesso\);/);
  assert.match(ler('src/app/globals.css'), /--sucesso: #1f7a5a;/);
  assert.match(css, /\.aula-rodape\[data-retorno='certa'\] \{ --fundo-rodape: #e3f6ea; --linha-rodape: #e3f6ea; \}/, 'o mesmo verde claro');
});

test('item 24: o texto do retorno, o convite e a nota saem do rodapé compacto, e a linha só vale no acerto com o "Explique" aberto (ao fechar, o rodapé volta ao normal)', () => {
  const css = ler('src/app/aula.css');
  assert.match(css, /\.aula-rodape\[data-compacto\] \.aula-retorno p, \.aula-rodape\[data-compacto\] \.aula-retorno__link,\s*\.aula-rodape\[data-compacto\] \.aula-rodape__nota \{ display: none; \}/, 'o texto do retorno sai (já foi lido)');
  // Só no acerto: o erro com o reforço aberto não ganha a linha.
  assert.doesNotMatch(css, /\.aula-rodape\[data-retorno='errada'\]\[data-compacto\]/);
  const aula = ler('src/app/aula.tsx');
  assert.match(aula, /const compacto = Boolean\(\(avaliacao && !avaliacao\.correta && pedidoPonte > 0 && !ponteFeita\) \|\| \(expliqueAberto && avaliacao\)\);/, 'a linha acompanha o "Explique" aberto: ao fechar, `expliqueAberto` volta a falso e o rodapé ao normal');
  assert.match(aula, /<footer className="aula-rodape" data-retorno=\{retorno\} data-compacto=\{compacto \|\| undefined\}/);
  assert.match(aula, /aoAbrirExplique=\{setExpliqueAberto\}/);
  assert.match(ler('src/app/estudio.tsx'), /aoAbrirExplique\?\.\(e\.currentTarget\.open\);/, 'abrir e fechar o "Explique" avisa a aula');
  assert.match(aula, /\{!compacto && \(\s*<Mascote expressao=\{expressaoDaReacao\}/, 'no compacto o Stu da reação sai (o "Explique" já tem o dele)');
});
