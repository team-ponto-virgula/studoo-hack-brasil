// Revisão de design das configurações da trilha na web (spec 10, "Revisão de design (19/11)"), com o tema sugerido
// marcado sem gravar, a engrenagem alinhada e o recorte da capa com a área dos selos. Igual ao app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (arquivo) => readFileSync(join(raiz, arquivo), 'utf8');
const tela = ler('src/app/configuracoes.tsx');
const css = ler('src/app/configuracoes.css');
const perfil = ler('src/app/perfil.tsx');
const perfilCss = ler('src/app/perfil.css');

test('tema sugerido: vem marcado sem tema salvo e nada é gravado até a pessoa tocar num tema (linha na spec 10)', () => {
  assert.match(tela, /const temaMarcado = conf \? conf\.tema \?\? conf\.temaSugerido \?\? null : null;/);
  assert.match(tela, /checked=\{temaMarcado === tema\} onChange=\{\(\) => undefined\}\s*onClick=\{\(\) => \{ if \(conf\.tema !== tema\) void salvar\('tema', \{ tema \}\); \}\}/);
  assert.doesNotMatch(tela, /useEffect\([^)]*temaSugerido/, 'nada salva o sugerido sozinho');
  assert.match(ler('docs/specs/10-comunidade.md'), /\*\*Tema sugerido \(decisão do Lead, 19\/11\)\.\*\* Sem tema salvo, o tema sugerido pelo título já vem marcado/);
});

test('"Salvando…" e "Salvo" no rótulo de cada campo (some em 2,5 s), a frase ao leitor e o som `salvo`; nada sob o título', () => {
  const topo = tela.slice(tela.indexOf('className="configuracoes__topo"'), tela.indexOf('className="somente-leitor" role="status"'));
  assert.doesNotMatch(topo, /configuracoes__estado|k\.salvo/);
  for (const campo of ['titulo', 'descricao', 'tema']) assert.match(tela, new RegExp(`<RotuloDoCampo estado=\\{estados\\.${campo}\\}`));
  assert.match(tela, /export const SALVO_VISIVEL_MS = 2500;/);
  assert.match(tela, /anunciar\(campo === 'capa' \? k\.capaSalva : k\.salvoLeitor\[campo\]\);/);
  assert.match(tela, /function salvou\([^)]*\) \{[\s\S]*?void tocaSons\.tocarEfeito\('salvo'\);/);
  assert.match(css, /\.configuracoes__estado \{[^}]*color: #5e6a85; font-size: 0\.8125rem; font-weight: 800;/);
  assert.match(css, /\.configuracoes__estado\[data-estado='salvo'\] \{ color: #1f7a5a; \}/);
  assert.match(css, /\.configuracoes__giro \{ width: 14px; height: 14px;/);
  assert.match(css, /animation: configuracoes-salvo-sai 200ms ease-in 2300ms forwards;/);
});

test('prévia na largura da seção (2:1, raio 16) com "Trocar capa" por cima e o nome acessível com a capa atual', () => {
  assert.match(tela, /<button type="button" className="configuracoes__capa-botao" aria-label=\{k\.trocarCapaRotulo\(nomeCapa\)\}/);
  assert.doesNotMatch(tela, /k\.capaEscolhida/);
  assert.match(css, /\.configuracoes__previa \{ display: block; width: 100%; aspect-ratio: 2 \/ 1; overflow: hidden; border-radius: 16px; \}/);
  assert.match(css, /\.configuracoes__trocar \{\s*position: absolute; right: 10px; bottom: 10px;[^}]*height: 40px;[^}]*box-shadow: 0 2px 8px rgb\(15 23 42 \/ 0\.25\); font-size: 0\.9375rem; font-weight: 800;/);
});

test('galeria: grupo de escolha única com o visto de 24 na escolhida, "Do tema" embaixo de "Padrão", fecha em 300 ms', () => {
  assert.match(tela, /className="galeria-capas" role="radiogroup"/);
  assert.match(tela, /aria-checked=\{escolhida\}/);
  assert.match(tela, /\{escolhida && <span className="galeria-capas__visto"><Icone nome="check" \/><\/span>\}/);
  assert.match(tela, /dica: k\.capaPadraoDoTema/);
  assert.doesNotMatch(tela, /capaPadraoDica/);
  assert.match(tela, /export const GALERIA_FECHA_MS = 300;/);
  assert.match(css, /\.galeria-capas__visto \{\s*position: absolute; top: 6px; right: 6px; display: grid; width: 24px; height: 24px;[^}]*border: 2px solid #fff;/);
  assert.match(css, /\.galeria-capas__dica \{[^}]*color: #5e6a85; font-size: 0\.8125rem; font-weight: 700;/);
  assert.match(tela, /<span className="campo-dica">\{k\.usarFotoAjuda\}<\/span>/);
  assert.match(css, /\.galeria-capas__foto \.botao \{ width: 100%; min-height: 48px; \}/);
  assert.match(css, /\.galeria-capas__foto \.campo-dica \{ white-space: nowrap; \}/);
});

test('véu só nos 45% de cima, engrenagem alinhada com Compartilhar e o recorte da capa (folha de baixo, dica e selos)', () => {
  assert.match(ler('src/app/globals.css'), /\.capa-veu \{ position: absolute; inset: 0 0 auto; height: 45%; background: linear-gradient\(to bottom, rgb\(15 23 42 \/ 0\.38\), rgb\(15 23 42 \/ 0\)\);/);
  assert.doesNotMatch(ler('src/app/compartilhar.css'), /\.trilha-compartilhar \{ margin-top/);
  assert.match(css, /\.trilha-topo__acoes \{ display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; \}/);
  assert.match(tela, /dica=\{k\.capaFotoDica\} aviso=\{k\.capaFotoAviso\} comSelos/);
  const recorte = perfil.slice(perfil.indexOf('export function RecorteImagem'));
  assert.match(recorte, /<div className="folha-fundo" role="presentation">/);
  assert.match(recorte, /\{dica \?\? \(toque \? p\.recorteDicaToque : p\.recorteDica\)\}/);
  assert.match(recorte, /comSelos && <><span className="recorte__selo" \/><span className="recorte__selo recorte__selo--2" \/><\/>/);
  assert.match(recorte, /const passo = evento\.shiftKey \? 32 : 8;/);
  assert.match(perfilCss, /\.recorte__selo \{ position: absolute; top: 10px; left: 10px; width: 96px; height: 28px; border: 1\.5px dashed[^}]*background: rgb\(255 255 255 \/ 0\.55\); \}/);
});
