import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const ler = caminho => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
async function carregar(caminho, imports = {}) {
  const codigo = ts.transpileModule(await ler(caminho), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const contexto = { exports: {}, require: nome => {
    assert.ok(nome in imports, `Importação inesperada: ${nome}`); return imports[nome];
  } };
  vm.runInNewContext(codigo, contexto);
  return contexto.exports;
}
const comuns = await carregar('packages/contratos/src/experiencia.ts');
const imports = { '@studoo/contratos/experiencia': comuns, './api-nativa': { codigoDaFalha: e => e.codigo } };
const web = await carregar('src/mensagens/pt-BR.ts', imports);
const app = await carregar('apps/mobile/src/mensagens.ts', imports);

test('os desenhos do mundo são iguais na web e no app', async () => {
  assert.equal(await ler('src/ui/mundo-desenhos.ts'), await ler('apps/mobile/src/mundo-desenhos.ts'));
});
test('apresentação, pedido, trilha, aula, geração e acesso usam uma única fonte de textos', () => {
  for (const chave of ['apresentacao', 'pedido', 'trilha', 'licao', 'geracao', 'preparo', 'retomada', 'acesso', 'erros', 'estudio']) {
    assert.equal(web.mensagens[chave], app.mensagens[chave], chave);
  }
  assert.equal(web.mensagens.planos.contagem(1, 5), app.mensagens.planos.progresso(1, 5));
  assert.equal(web.mensagens.planos.contagem(1, 1), app.mensagens.planos.progresso(1, 1));
});
test('login tem os mesmos rótulos, validações e instruções', () => {
  for (const chave of Object.keys(web.mensagens.login)) assert.equal(web.mensagens.login[chave], app.mensagens.entrada[chave]);
  assert.equal(web.mensagens.login.instrucoes, app.mensagens.entrada.texto);
});
test('todos os erros da API têm a mesma mensagem nas duas interfaces', () => {
  for (const codigo of Object.keys(web.mensagens.erros)) assert.equal(web.textoErro(codigo), app.mensagemDoCodigo(codigo));
  assert.equal(web.textoErro('desconhecido'), app.mensagemDoCodigo('desconhecido'));
});

test('cores de ação, texto, campos e feedback seguem a mesma paleta', async () => {
  const css = await ler('src/app/globals.css');
  const { cores } = await carregar('apps/mobile/src/tema.ts');
  const nomes = { fundo: 'fundo', nevoa: 'nevoa', gelo: 'gelo', texto: 'texto', textoSecundario: 'texto2', acao: 'acao', acaoEscura: 'acao-escura', sucesso: 'sucesso', sucessoClaro: 'sucesso-claro', alerta: 'alerta', erro: 'erro', ouro: 'ouro', ouroEscuro: 'ouro-escuro', ceu: 'ceu', bordaCampo: 'borda-campo' };
  const normalizar = valor => valor.length === 4 ? '#' + [...valor.slice(1)].map(c => c + c).join('') : valor;
  for (const [app, web] of Object.entries(nomes)) {
    const valor = css.match(new RegExp(`--${web}:\\s*(#[a-f0-9]+);`, 'i'))?.[1];
    assert.ok(valor, web);
    assert.equal(normalizar(valor).toLowerCase(), cores[app].toLowerCase(), app);
  }
});
