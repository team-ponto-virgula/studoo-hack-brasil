import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { trilhaRepetida } from '../packages/contratos/src/aprendizado.ts';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

test('trilhaRepetida compara assunto normalizado antes dos dois-pontos', () => {
  assert.equal(trilhaRepetida('Frações: da pizza à soma', 'Frações: do básico ao cálculo'), true);
  assert.equal(trilhaRepetida('fracoes', 'Frações: revisão'), true);
  assert.equal(trilhaRepetida('Inglês: viagem', 'Fotografia com celular'), false);
  assert.equal(trilhaRepetida('', 'Frações'), false);
});

test('vocabulário unificado da ponte e movimento respeitam a preferência de acessibilidade', async () => {
  assert.equal(mensagens.estudio.ponteMapaFeita, mensagens.licao.historia.ponteTitulo);

  const [proxySrc, estudoSrc, estudioTsxSrc, aulaSrc] = await Promise.all([
    readFile(new URL('../src/proxy.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/estudo.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/estudio.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/aula.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(proxySrc, /const estilo = desenvolvimento \? "'unsafe-inline'" : `'nonce-\$\{nonce\}'`/);
  assert.equal(estudoSrc.includes('window.confirm'), false);
  assert.match(estudioTsxSrc, /prefers-reduced-motion: reduce/);
  assert.match(aulaSrc, /prefers-reduced-motion: reduce/);
});

const fontePonte = ts.transpileModule(
  await readFile(new URL('../src/app/ponte-reforco.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

// Como em estudio-interface: executa os handlers reais com hooks em memória, sem câmera, som nem DOM.
// A nova tela é um componente próprio. Cada abertura o remonta; os passos pertencem a essa montagem.
function montarPonte(ponte) {
  let cursor = 0;
  const slots = [];
  let arvore;
  let props;
  const encontrar = (no, predicado) => {
    if (!no || typeof no !== 'object') return undefined;
    if (Array.isArray(no)) return no.map((filho) => encontrar(filho, predicado)).find(Boolean);
    return predicado(no) ? no : encontrar(no.props?.children, predicado);
  };
  const texto = (no) => Array.isArray(no) ? no.map(texto).join(' ')
    : typeof no === 'string' || typeof no === 'number' ? String(no)
      : no && typeof no === 'object' ? texto(no.props?.children) : '';
  const hooks = {
    useState(inicial) {
      const i = cursor++;
      slots[i] ??= { valor: typeof inicial === 'function' ? inicial() : inicial };
      return [slots[i].valor, (valor) => { slots[i].valor = typeof valor === 'function' ? valor(slots[i].valor) : valor; }];
    },
    useRef(inicial) { return slots[cursor++] ??= { current: inicial }; },
    useId() { return 'ponte-teste'; },
    useEffect() {},
  };
  const jsx = (type, props) => ({ type, props });
  const imports = {
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '../mensagens/pt-BR': { mensagens },
    '../ui': { Botao: 'Botao', Stu: 'Stu', Icone: 'Icone' },
    './sons': { tocaSons: { tocarEfeito: async () => {} } },
    // A espera viva enquanto a ponte é montada: componente de apresentação.
    '../ui/espera-viva': { EsperaViva: 'EsperaViva' },
  };
  const modulo = { exports: {}, require: (nome) => {
    assert.ok(nome in imports, nome);
    return imports[nome];
  }, requestAnimationFrame: (f) => f() };
  vm.runInNewContext(fontePonte, modulo);
  let voltou = 0;
  const avaliacoes = [];
  props = {
    ponte, feedbackOriginal: 'Retorno do exercício', ocupado: false, erro: '',
    voltar: () => { voltou++; },
    verificar: async (resposta) => {
      avaliacoes.push(resposta);
      const correta = resposta === 'certa';
      if (correta) props.ponte = { ...props.ponte, concluida: true };
      return { correta, feedback: correta ? 'Entendeu o exemplo.' : 'Confira o exemplo.' };
    },
  };
  function render() { cursor = 0; arvore = modulo.exports.PonteReforco(props); }
  render();
  return {
    render,
    texto: () => texto(arvore),
    avaliacoes,
    voltou: () => voltou,
    opcao: (valor) => encontrar(arvore, (no) => no.type === 'input' && no.props.type === 'radio' &&
      no.props.checked === valor),
    escolher(posicao) {
      const opcoes = [];
      const visitar = (no) => {
        if (Array.isArray(no)) no.forEach(visitar);
        else if (no && typeof no === 'object') {
          if (no.type === 'input' && no.props.type === 'radio') opcoes.push(no);
          visitar(no.props?.children);
        }
      };
      visitar(arvore);
      assert.ok(opcoes[posicao], 'opção do desafio');
      opcoes[posicao].props.onChange();
      render();
    },
    async agir(rotulo) {
      const botao = encontrar(arvore, (no) => no.type === 'Botao' && texto(no.props.children) === rotulo);
      assert.ok(botao, `ação: ${rotulo}`);
      assert.ok(!botao.props.disabled, `ação habilitada: ${rotulo}`);
      // O botão de produção inicia uma Promise sem retorná-la; esvazia as microtarefas antes de renderizar de novo.
      botao.props.onClick();
      for (let i = 0; i < 6; i++) await Promise.resolve();
      render();
    },
    ponte: () => props.ponte,
  };
}

const ponteExemplo = {
  motivo: 'Outro caminho para o filtro.', conceito: 'O limite faz parte da comparação.', exemplo: 'A nota 7 também entra.',
  concluida: false, exercicio: { tipo: 'multipla_escolha', enunciado: 'Qual consulta inclui o limite?',
    opcoes: [{ id: 'errada', texto: 'Somente acima de 7.' }, { id: 'certa', texto: 'A partir de 7.' }] },
};

test('ponte em três passos: tentativa errada pode ser refeita e reabrir a concluída oferece releitura sem nova avaliação', async () => {
  const m = mensagens.estudio;
  const ui = montarPonte(ponteExemplo);
  assert.ok(ui.texto().includes(ponteExemplo.conceito));
  assert.ok(!ui.texto().includes(ponteExemplo.exemplo));
  await ui.agir(m.ponteVerExemplo);
  assert.ok(ui.texto().includes(ponteExemplo.exemplo));
  assert.ok(!ui.texto().includes(ponteExemplo.exercicio.enunciado));
  await ui.agir(m.ponteIrDesafio);
  assert.ok(ui.texto().includes(ponteExemplo.exercicio.enunciado));
  ui.escolher(0);
  await ui.agir(m.verificar);
  assert.deepEqual(ui.avaliacoes, ['errada']);
  assert.ok(ui.texto().includes('Confira o exemplo.'));
  await ui.agir(m.ponteTentarDeNovo);
  assert.equal(ui.opcao(true), undefined, 'a nova tentativa começa sem opção escolhida');
  ui.escolher(1);
  await ui.agir(m.verificar);
  assert.deepEqual(ui.avaliacoes, ['errada', 'certa']);
  assert.ok(ui.texto().includes(m.ponteVencida));
  assert.ok(!ui.texto().includes(m.ponteReabertaAviso));
  ui.render();
  assert.ok(ui.texto().includes('Entendeu o exemplo.'), 'renderizar novamente preserva o resultado desta abertura');
  await ui.agir(m.ponteVoltarExercicio);
  assert.equal(ui.voltou(), 1);

  const reaberta = montarPonte(ui.ponte());
  assert.ok(reaberta.texto().includes(m.ponteReabertaAviso));
  assert.ok(reaberta.texto().includes(ponteExemplo.conceito));
  assert.ok(reaberta.texto().includes(ponteExemplo.exemplo));
  assert.ok(!reaberta.texto().includes(ponteExemplo.exercicio.enunciado));
  await reaberta.agir(m.ponteVoltarExercicio);
  assert.equal(reaberta.voltou(), 1);
  assert.deepEqual(reaberta.avaliacoes, [], 'a releitura não reavalia o desafio nem infla o progresso');

  const outra = montarPonte({ ...ponteExemplo, conceito: 'Outro erro, outra explicação.' });
  assert.ok(outra.texto().includes('Outro erro, outra explicação.'));
  assert.ok(!outra.texto().includes(m.ponteReabertaAviso));
  assert.ok(!outra.texto().includes(ponteExemplo.exercicio.enunciado), 'uma nova abertura começa no primeiro passo');
});
