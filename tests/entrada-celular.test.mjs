// Entrada no celular (spec 04, revisão de banca da noite, item 1): cabe sem rolar, com "Entrar" junto dos campos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const entrada = readFileSync(join(raiz, 'src/app/login/entrada.tsx'), 'utf8');
const css = readFileSync(join(raiz, 'src/app/globals.css'), 'utf8').replace(/((?:font-size|line-height):\s*)([\d.]+)rem/g, (_, nome, valor) => `${nome}${Number(valor) * 16}px`);

test('entrada e cadastro usam o mesmo Google colorido, decorativo e com densidade adequada', () => {
  const cadastro = readFileSync(join(raiz, 'src/app/cadastro/cadastro.tsx'), 'utf8');
  const google = readFileSync(join(raiz, 'src/app/botao-google.tsx'), 'utf8');
  assert.match(entrada, /googleDisponivel && \(\s*<BotaoGoogle ocupado=\{enviando\}/);
  assert.match(cadastro, /etapa === 'email' && googleDisponivel && <div[^>]*>\s*<BotaoGoogle ocupado=\{ocupado\}/);
  const botao = cadastro.indexOf('<BotaoGoogle');
  const divisor = cadastro.indexOf('{m.ou}');
  const instrucao = cadastro.indexOf('m.instrucao');
  assert.ok(botao < divisor && divisor < instrucao && instrucao < cadastro.indexOf('id="cadastro-email"'));
  assert.match(entrada, /mensagens\.acesso\.ou/);
  assert.match(google, /alt="" aria-hidden="true"/);
  assert.match(google, /width=\{20\} height=\{20\}/);
  assert.match(google, /\{mensagens\.acesso\.google\}/);
  assert.match(google, /window\.location\.assign\('\/api\/auth\/google\/iniciar'\)/);
  assert.match(css, /\.botao\.botao-google[^}]*gap: 12px/);
  for (const [nome, tamanho] of [['google-g.png', 20], ['google-g@2x.png', 40], ['google-g@3x.png', 60]]) {
    assert.ok(google.includes('packages/contratos/assets/' + nome));
    const imagem = readFileSync(join(raiz, 'packages/contratos/assets', nome));
    assert.deepEqual([imagem.readUInt32BE(16), imagem.readUInt32BE(20)], [tamanho, tamanho]);
  }
});

test('a conta sem trilhas abre o pedido (sem foco sozinho até 1023 px, para a cápsula aparecer), mas sua aba de trilhas tem um vazio próprio', () => {
  const estudo = readFileSync(join(raiz, 'src/app/estudo.tsx'), 'utf8');
  assert.match(estudo, /ativos\.length === 0 \|\| abriuComRascunho\.current\) \{(?:\s*\/\/[^\n]*)*\s*setTela\(\{ tipo: 'objetivo' \}\);/);
  assert.match(estudo, /visivel && tela\.tipo === 'objetivo' && \(\s*<Pedido/);
  const inicio = estudo.indexOf('className="painel planos-sem-trilhas"');
  const fim = estudo.indexOf('</section>', inicio);
  assert.ok(inicio > 0);
  const vazio = estudo.slice(inicio, fim);
  assert.match(vazio, /data-testid="planos-vazio"/);
  assert.match(vazio, /expressao="stu-curioso" tamanho=\{96\}/);
  assert.match(vazio, /vazioTitulo[\s\S]*vazioTexto[\s\S]*focarCampo: true[\s\S]*vazioAcao/);
  assert.doesNotMatch(vazio, /<Pedido|role="dialog"/);
  assert.match(estudo, /const abaNovaTrilha = tela\.tipo === 'objetivo';/);
});

test('"Entrar" fica dentro do formulário, logo depois da senha, e "Esqueci minha senha" embaixo dele; sem rodapé preso', () => {
  const senha = entrada.indexOf('id="senha"');
  const entrar = entrada.indexOf('<div className="entrada-entrar">');
  const esqueci = entrada.indexOf('className="acesso-link entrada-esqueci"');
  assert.ok(senha > 0 && entrar > senha && esqueci > entrar, 'senha, Entrar e Esqueci, nessa ordem');
  assert.ok(entrar < entrada.indexOf('</form>'), 'dentro do formulário');
  assert.doesNotMatch(entrada, /<AcaoPrincipal>/);
  assert.match(entrada, /variante=\{visitanteDisponivel \? 'secundario' : 'primario'\}/, 'secundário com o visitante, principal sem ele');
});

test('no celular: sem faixa até 860 px de altura (120 px acima), título 28/34, texto 15/22 e Entrar de 52 na largura toda', () => {
  const bloco = css.slice(css.lastIndexOf('/* Entrada no celular'));
  assert.match(bloco, /\.entrada-entrar > \.botao \{ width: 100%; min-height: var\(--jornada-acao\); \}/);
  assert.match(bloco, /\.entrada-banner \{ height: 120px;/);
  assert.match(bloco, /\.entrada-cabecalho h1 \{ font-size: 28px; line-height: 34px;/);
  assert.match(bloco, /\.entrada-cabecalho \.introducao \{ font-size: 15px; line-height: 22px; \}/);
  assert.match(bloco, /@media \(max-width: 767px\) and \(max-height: 860px\) \{ \.entrada-banner \{ display: none; \} \}/);
  assert.match(bloco, /\.entrada-cabecalho \.acesso-link \{ min-height: 44px; \}/);
});

test('no pedido as sugestões formam uma fileira rolável e Surpreenda-me fecha a lista', () => {
  const pedido = readFileSync(join(raiz, 'src/app/pedido.tsx'), 'utf8');
  const estilo = readFileSync(join(raiz, 'src/app/pedido.css'), 'utf8');
  const ideias = pedido.indexOf('tema.exemplos.map');
  assert.ok(pedido.indexOf('className="pedido-alternar"') < ideias);
  assert.ok(ideias > 0 && pedido.indexOf('onClick={surpreender}') > ideias);
  assert.doesNotMatch(pedido, /pedido-alternar__selo|pedido\.seuMaterial/);
  assert.match(estilo, /\.pedido-ideias\s*\{[^}]*overflow-x: auto/);
  const ideiasCss = /\.pedido-ideias\s*\{([^}]*)\}/.exec(estilo)?.[1] ?? '';
  assert.match(ideiasCss, /display: flex;/);
  assert.doesNotMatch(ideiasCss, /flex-wrap: (?:wrap|wrap-reverse);/, 'nowrap é o padrão flex; não pode virar uma grade ou quebrar a fileira');
  assert.match(estilo, /\.pedido-ideia\s*\{[^}]*flex: none/, 'cada sugestão preserva sua largura na fileira rolável');
  assert.match(estilo, /\.pedido-ideia\s*\{[^}]*min-height: 44px/);
});
