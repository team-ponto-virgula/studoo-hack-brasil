// Banca da noite (spec 04, revisão de 19–20/11) na web, itens 3, 4 e 2: pedido com material e ideias à vista, conclusão
// com uma ação clara e "Ver como funciona" com arte grande e sem selo de demonstração.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (arquivo) => readFileSync(join(raiz, arquivo), 'utf8');
const pedido = ler('src/app/pedido.tsx');
const pedidoCss = ler('src/app/pedido.css');
const estudo = ler('src/app/estudo.tsx');
const globais = ler('src/app/globals.css');
const tour = ler('src/app/apresentacao.tsx');
const tourCss = ler('src/app/apresentacao.css');

test('item 3: Stu de 72 com halo lavanda, sem o aviso, material compacto e a fileira terminando em "Surpreenda-me"', () => {
  assert.equal((pedido.match(/<Stu expressao="[a-z-]+" tamanho=\{72\}/g) ?? []).length, 5);
  assert.doesNotMatch(pedido, /className="pedido-heroi__estrela"|\{mensagens\.planos\.semTrilhas\}|className="pedido-alternar__selo"/);
  const ideias = pedido.slice(pedido.indexOf('className="pedido-ideias"'));
  assert.ok(ideias.indexOf('tema.exemplos.map') < ideias.indexOf('pedido-ideia--surpresa'), '"Surpreenda-me" no fim');
  const bloco = pedidoCss.slice(pedidoCss.lastIndexOf('/*\n * Banca da noite, item 3'));
  assert.match(bloco, /#e9e7ff/);
  assert.match(bloco, /\.pedido-ideias \{ flex-wrap: nowrap;[^}]*overflow-x: auto; \}/);
  assert.match(bloco, /\.pedido-ideia \{ min-height: 44px;/);
  assert.match(bloco, /\.pedido-alternar \{ box-sizing: border-box; height: 64px;/);
  assert.match(bloco, /@media \(max-height: 700px\) \{[^@]*\.pedido-heroi__stu \.stu \{ width: 56px; \}[^@]*\.pedido-heroi__fala \{ display: none; \}[^@]*font-size: 24px; line-height: 30px;[^@]*min-height: 88px;/);
});

test('item 4: trilha concluída com compartilhar como principal, assunto novo e voltar em texto; sem selo; praticou recolhido', () => {
  const conclusao = estudo.slice(estudo.indexOf('function LicaoConcluida'), estudo.indexOf('function LicaoConcluida') + 9000);
  assert.doesNotMatch(conclusao, /conclusao-selo/);
  assert.match(conclusao, /\{compartilhar && <Botao disabled=\{ocupado\} onClick=\{compartilhar\}><Icone nome="compartilhar" \/>\{mensagens\.compartilhar\.concluidaAcao\}<\/Botao>\}\s*<Botao variante=\{compartilhar \? 'secundario' : 'primario'\}[^>]*onClick=\{novoAssunto\}>\{mensagens\.licao\.novoAssunto\}<\/Botao>\s*<Botao variante="texto"[^>]*onClick=\{voltar\}>/);
  assert.match(conclusao, /\{!praticouAberto && \(\s*<button type="button" className="conclusao-ver-praticou"[\s\S]*?>\{mensagens\.licao\.historia\.verPraticou\}<\/button>/);
  const aberto = conclusao.slice(conclusao.indexOf('{praticouAberto && ('), conclusao.indexOf('className="conclusao-sincronia"'));
  assert.match(aberto, /conclusao-historia/);
  assert.match(aberto, /FrasesDaLicao/);
  const bloco = globais.slice(globais.lastIndexOf('/*\n * Conclusão (spec 04, banca da noite, item 4'));
  assert.match(bloco, /\.conclusao-numeros li \{ border: 2px solid #e1e7fa; background: #fff; box-shadow: none; \}/);
  assert.match(bloco, /\.conclusao-numeros__valor \{[^}]*color: #0b1b5c;[^}]*font-size: 22px;/);
});

test('item 2: arte em 52% (280 a 420), sem selo de demonstração, Stu estudando no passo 1, dois cartões no 3 e "Entrar" no fim', () => {
  const arte1 = tour.slice(tour.indexOf('function ArteMaterial'), tour.indexOf('function ArtePonte'));
  const arte2 = tour.slice(tour.indexOf('function ArtePonte'), tour.indexOf('function ArteExplique'));
  const arte3 = tour.slice(tour.indexOf('function ArteExplique'), tour.indexOf('function ArteProgresso'));
  for (const arte of [arte1, arte2, arte3]) assert.doesNotMatch(arte, /className="estudio-selo"|\.simulado\}/);
  assert.match(arte1, /<Stu expressao="stu-estudando" tamanho=\{160\}/);
  assert.deepEqual([...arte3.matchAll(/data-tipo="(\w+)"/g)].map(([, tipo]) => tipo), ['acertos', 'proximo']);
  assert.match(arte3, /<Stu expressao="stu-concentrado"/);
  assert.match(tourCss, /\.apresentacao-arte:not\(\.apresentacao-areas\) \{ display: grid; height: clamp\(280px, 52svh, 420px\);/);
  assert.match(tour, /<Botao onClick=\{avancar\}>\{rotuloFinalUltimo\}<\/Botao>\s*<Botao variante="secundario" onClick=\{aoEntrar\}>\{mensagens\.login\.entrar\}<\/Botao>/);
  assert.match(tour, /: <Botao onClick=\{aoEntrar\}>\{mensagens\.login\.entrar\}<\/Botao>/, 'sem visitante, "Entrar" é o principal');
  assert.match(tour, /className="apresentacao-voltar-alto"/);
  assert.match(ler('src/app/login/entrada.tsx'), /aoEntrar=\{\(\) => \{ focarEmailDepois\.current = true; setVendoApresentacao\(false\); \}\}/);
});
