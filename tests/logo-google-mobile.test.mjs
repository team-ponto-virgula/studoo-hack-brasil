import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// O "G" oficial do Google no "Continuar com Google" do app (spec 06, regra de 20/11): o mesmo PNG da web em
// packages/contratos/assets, 20 × 20 à esquerda do rótulo, 12 até o texto, decorativo, na entrada e no cadastro.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const ladoDoPng = async (caminho) => { const b = await readFile(new URL(caminho, raiz)); assert.equal(b.toString('ascii', 1, 4), 'PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('o ativo é um só, compartilhado com a web, nas três densidades (20, 40 e 60 px)', async () => {
  assert.deepEqual(await ladoDoPng('packages/contratos/assets/google-g.png'), [20, 20]);
  assert.deepEqual(await ladoDoPng('packages/contratos/assets/google-g@2x.png'), [40, 40]);
  assert.deepEqual(await ladoDoPng('packages/contratos/assets/google-g@3x.png'), [60, 60]);
  const marca = await ler('apps/mobile/src/marca-google.ts');
  assert.match(marca, /fonte: require\('\.\.\/\.\.\/\.\.\/packages\/contratos\/assets\/google-g\.png'\),\s*tamanho: 20,/);
});

test('o botão do Google mostra a imagem, na entrada e no primeiro passo do cadastro', async () => {
  const sessao = await ler('apps/mobile/src/sessao.tsx');
  assert.match(sessao, /<Botao rotulo=\{mensagens\.acesso\.google\} testID="login-google" variante="secundario" imagemAntes=\{LOGO_GOOGLE\}/);
  const cadastro = await ler('apps/mobile/src/cadastro.tsx');
  assert.match(cadastro, /<Botao rotulo=\{mensagens\.acesso\.google\} testID="cadastro-google" variante="secundario" imagemAntes=\{LOGO_GOOGLE\}/);
  // No topo do primeiro passo, antes do e-mail; a Apple (iPhone) acima do Google, como na entrada.
  // Com o Google (4e944df): título, provedores, divisor "ou crie com seu e-mail", instrução e campo; sem ele, como antes.
  const [apple, google, ou, instrucao, email] = ['testID="cadastro-apple"', 'testID="cadastro-google"', '{m.ou}', '{comProvedor && <Text testID="cadastro-instrucao"', 'testID="cadastro-email"'].map((x) => cadastro.indexOf(x));
  assert.ok(apple > 0 && apple < google && google < ou && ou < instrucao && instrucao < email, `ordem: ${[apple, google, ou, instrucao, email]}`);
  assert.match(cadastro, /\{!comProvedor && <Text testID="cadastro-instrucao" style=\{estilos\.introducao\}>\{etapa === 'email' \? m\.instrucao : m\.validade\}<\/Text>\}/);
  assert.doesNotMatch(cadastro, /mensagens\.acesso\.ou/, 'o "ou entre com e-mail" fica só na entrada');
  assert.match(cadastro, /const comProvedor = etapa === 'email' && \(provedores\.google \|\| provedores\.apple\);/);
  assert.match(sessao, /google=\{continuarComGoogle\} apple=\{continuarComApple\} \/>;/);
});

test('a imagem é decorativa (sem nome acessível), com 12 até o texto e 38% quando desativada', async () => {
  const fonte = await ler('apps/mobile/src/interface.tsx');
  const imagem = fonte.slice(fonte.indexOf('{imagemAntes && ('), fonte.indexOf('/>', fonte.indexOf('{imagemAntes && (')));
  assert.match(imagem, /<Image source=\{imagemAntes\.fonte\} resizeMode="contain" accessible=\{false\} accessibilityElementsHidden importantForAccessibility="no"/);
  assert.doesNotMatch(imagem, /accessibilityLabel|alt=/);
  assert.match(imagem, /width: imagemAntes\.tamanho, height: imagemAntes\.tamanho, marginRight: 4, opacity: apagado \? 0\.38 : 1/);
  assert.match(fonte, /botaoConteudo: \{[^}]*gap: 8/, 'gap de 8 + margem de 4 = 12 até o texto');
});
