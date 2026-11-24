// Cobertura automatizada das 12 correções das rodadas web (24/11/2026) + complementos do Designer e Mobile & QA.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { join, resolve } from 'node:path';
import { mensagens } from '@studoo/contratos/experiencia';
import { demoPelaChave } from '../src/servidor/ia/demos.ts';
import { ILUSTRACAO_VIOLAO } from '../src/servidor/ia/ilustracao-violao.ts';
import { conteudoParaCopia } from '../src/servidor/compartilhar/servico.ts';
import { buscarLicao } from '../src/servidor/aprendizado/servico.ts';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { GET as explorarGet } from '../src/app/api/explorar/route.ts';
import { PUT as perfilPut } from '../src/app/api/perfil/route.ts';
import { POST as criarSharePost } from '../src/app/api/aprendizado/planos/[id]/compartilhar/route.ts';
import { PATCH as linkPatch } from '../src/app/api/compartilhar/[codigo]/route.ts';
import { aceitarProposta, gerarProposta } from '../src/servidor/aprendizado/servico.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import { ensinarStu, revisarCoerenciaEnsino } from '../src/servidor/estudio/apoio.ts';
import { publicacaoRevisada } from './fixtures/moderacao.mjs';
import {
  lerFiltroExplorarDaUrl,
  lerRotaDaUrl,
  tituloDaTelaWeb,
  urlDaTelaWeb,
  urlDoExplorar,
} from '../src/app/navegacao-web.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const origem = process.env.STUDOO_ORIGEM || 'http://127.0.0.1:3000';

const usuariosCriados = [];
process.env.IA = 'falsa';
process.env.STUDOO_IA_FALSA_PAUSA_MS = '0';
process.env.STUDOO_COMPARTILHAR = '1';
process.env.STUDOO_COMUNIDADE = '1';

function req(caminho, { metodo = 'GET', token, corpo } = {}) {
  const headers = { origin: origem };
  if (token) headers.cookie = cookieSessao(token);
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  return new Request(`${origem}${caminho}`, {
    method: metodo,
    headers,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
}
const ctx = (params) => ({ params: Promise.resolve(params) });

after(async () => {
  for (const id of usuariosCriados) {
    await banco.registroEstudo.deleteMany({ where: { usuarioId: id } });
    await banco.apoioLicao.deleteMany({ where: { usuarioId: id } });
    await banco.licao.deleteMany({ where: { usuarioId: id } });
    await banco.fluxo.deleteMany({ where: { usuarioId: id } });
    await banco.planoAprendizado.deleteMany({ where: { usuarioId: id } });
    await banco.sessao.deleteMany({ where: { usuarioId: id } });
    await banco.usuario.deleteMany({ where: { id } });
  }
  await banco.$disconnect();
});

// ── Item 4: Violão (cópia nova, cópia já salva no banco, proteção de imagem de material privado) ──
test('item 4 (Violão - cópia nova): conteudoParaCopia preserva a ilustração pública embutida do catálogo', () => {
  const violao = demoPelaChave('violao');
  assert.ok(violao, 'demo de violão existe');
  const licao1 = violao.plano.fluxos[0].licoes[0];
  assert.equal(licao1.recurso?.tipo, 'imagem');
  assert.equal(licao1.recurso?.src, ILUSTRACAO_VIOLAO);

  const copiado = conteudoParaCopia({
    conceito: licao1.conceito,
    exemplo: licao1.exemplo,
    recurso: licao1.recurso,
    exercicio: licao1.exercicio,
    origem: 'Demonstração do Studoo',
  }, 'Marina');
  assert.deepEqual(copiado.recurso, licao1.recurso, 'ilustração pública numerada preservada na cópia nova');
});

test('item 4 (Violão - proteção de material privado): conteudoParaCopia continua removendo imagens de material e URLs arbitrárias', () => {
  const exercicioBase = { tipo: 'aberta', enunciado: 'O que é?', gabarito: ['algo'], feedbackCorreto: 'Certo', feedbackIncorreto: 'Tente de novo', criterios: ['Algo'] };
  const conteudoMaterial = {
    conceito: 'Resumo do caderno.',
    exemplo: 'Exemplo.',
    recurso: { tipo: 'imagem', src: ILUSTRACAO_VIOLAO, legenda: 'Mesmo com src igual, veio de material', alt: 'Foto' },
    referencias: [{ materialId: 'mat-privado-1', nome: 'caderno-secreto.pdf', trecho: 'Página 3 do caderno pessoal', pagina: 3, leitura: 'texto' }],
    exercicio: exercicioBase,
    origem: 'Material de estudo',
  };
  const copiadoMaterial = conteudoParaCopia(conteudoMaterial, 'Ana');
  assert.equal(copiadoMaterial.recurso, undefined, 'recurso de trilha gerada de material nunca é copiado');
  assert.equal(copiadoMaterial.referencias?.[0]?.materialId, 'compartilhado', 'referência sanitizada sem materialId privado');
  assert.doesNotMatch(JSON.stringify(copiadoMaterial), /caderno-secreto|mat-privado-1/);

  const conteudoExterno = {
    conceito: 'Resumo.',
    exemplo: 'Exemplo.',
    recurso: { tipo: 'imagem', src: 'https://privado.example/foto.png', legenda: 'Privada', alt: 'Privada' },
    exercicio: exercicioBase,
    origem: 'Conteúdo gerado pelo Studoo',
  };
  assert.equal(conteudoParaCopia(conteudoExterno, 'Ana').recurso, undefined, 'imagem externa/arbitrária continua removida');

  const conteudoDataUrl = {
    conceito: 'Resumo.',
    exemplo: 'Exemplo.',
    recurso: { tipo: 'imagem', src: 'data:image/png;base64,AAAA', legenda: 'Inline', alt: 'Inline' },
    exercicio: exercicioBase,
    origem: 'Conteúdo gerado pelo Studoo',
  };
  assert.equal(conteudoParaCopia(conteudoDataUrl, 'Ana').recurso, undefined, 'data URL de imagem continua removida');
});

test('item 4 (Violão - cópia já existente no banco): buscarLicao restaura o recurso público na leitura', async () => {
  const violao = demoPelaChave('violao');
  const licao1 = violao.plano.fluxos[0].licoes[0];
  const conteudoSemRecurso = {
    objetivo: licao1.objetivo,
    conceito: licao1.conceito,
    exemplo: licao1.exemplo,
    exercicio: licao1.exercicio,
    origem: 'Demonstração do Studoo',
  };

  const usuario = await banco.usuario.create({ data: { email: `violao-existente-${randomUUID()}@example.test`, fuso: 'UTC' } });
  usuariosCriados.push(usuario.id);

  const planoId = randomUUID();
  const fluxoId = randomUUID();
  const licaoId = randomUUID();
  await banco.planoAprendizado.create({
    data: { id: planoId, usuarioId: usuario.id, origem: 'compartilhado', objetivo: violao.plano.objetivo, titulo: violao.plano.titulo },
  });
  await banco.fluxo.create({
    data: { id: fluxoId, planoId, usuarioId: usuario.id, ordem: 0, titulo: violao.plano.fluxos[0].titulo },
  });
  await banco.licao.create({
    data: { id: licaoId, fluxoId, usuarioId: usuario.id, ordem: 0, titulo: licao1.titulo, conteudo: conteudoSemRecurso },
  });

  const lida = await buscarLicao(usuario.id, licaoId);
  assert.ok(lida, 'lição encontrada');
  assert.equal(lida.recurso?.tipo, 'imagem', 'recurso restaurado na leitura de cópia antiga');
  assert.equal(lida.recurso?.src, ILUSTRACAO_VIOLAO);
});

// ── Item 7: "Explique com suas palavras" coerente (sem contradição nos vértices) ──
test('item 7: revisarCoerenciaEnsino impede contradição quando elogia vértices e pede definição de vértices', () => {
  const contraditorio = {
    acertos: ['Você explicou corretamente o que são os lados e os vértices de um triângulo.'],
    lacuna: 'Faltou explicar o que é um vértice no triângulo.',
    pergunta: 'Como identificar um vértice na prática?',
    proximoPasso: 'Defina com suas palavras o que é um vértice.',
    simulado: false,
  };
  const revisado = revisarCoerenciaEnsino(
    contraditorio,
    'Um triângulo é uma figura com 3 lados retos que se encontram em 3 vértices, formando 3 ângulos internos.',
  );
  assert.doesNotMatch(revisado.lacuna, /faltou explicar o que é um vértice/i);
  assert.match(revisado.lacuna, /exemplo concreto|situação nova/i);
  assert.doesNotMatch(revisado.proximoPasso, /defina.*vértice/i);
});

test('item 7: ensinoFalso não acusa lacuna de termo já usado no plural/singular (lados/vértices)', async () => {
  const usuario = await banco.usuario.create({ data: { email: `ensino-triangulo-${randomUUID()}@example.test`, fuso: 'UTC' } });
  usuariosCriados.push(usuario.id);
  const planoId = randomUUID();
  const fluxoId = randomUUID();
  const licaoId = randomUUID();
  await banco.planoAprendizado.create({
    data: { id: planoId, usuarioId: usuario.id, origem: 'falsa', objetivo: 'O que define um triângulo', titulo: 'Triângulos do zero' },
  });
  await banco.fluxo.create({
    data: { id: fluxoId, planoId, usuarioId: usuario.id, ordem: 0, titulo: 'Base' },
  });
  await banco.licao.create({
    data: {
      id: licaoId,
      fluxoId,
      usuarioId: usuario.id,
      ordem: 0,
      titulo: 'O que define um triângulo',
      conteudo: {
        objetivo: 'Reconhecer os 3 lados, os 3 vértices e os 3 ângulos de um triângulo.',
        conceito: 'Um triângulo é uma figura fechada com três lados, três vértices e três ângulos.',
        exemplo: 'Uma placa triangular na rua mostra claramente cada lado e cada vértice.',
        origem: 'Conteúdo gerado pelo Studoo',
        exercicio: {
          tipo: 'multipla_escolha',
          enunciado: 'O que forma um triângulo?',
          opcoes: [{ id: 'a', texto: '3 lados e 3 vértices' }, { id: 'b', texto: '2 lados' }],
          gabarito: ['a'],
          feedbackCorreto: 'Certo',
          feedbackIncorreto: 'Revise',
        },
      },
    },
  });
  const feedback = await ensinarStu(
    usuario.id,
    licaoId,
    'O triângulo é uma figura fechada com 3 lados retos que se encontram em 3 vértices, formando 3 ângulos.',
  );
  assert.ok(feedback?.lacuna, 'retorna feedback do ensino');
  assert.doesNotMatch(feedback.lacuna, /faltou citar.*vértice/i);
  assert.doesNotMatch(feedback.lacuna, /faltou citar.*lado/i);
});

// ── Item 3: URLs, histórico, recarregamento e <title> por tela ──
test('item 3: navegacao-web mapeia URLs, filtros do Explorar e títulos de aba sem perda de contexto', () => {
  assert.deepEqual(lerRotaDaUrl('/', '?tela=perfil'), { tipo: 'perfil' });
  assert.deepEqual(lerRotaDaUrl('/', '?tela=trilhas'), { tipo: 'planos' });
  assert.deepEqual(lerRotaDaUrl('/', '?tela=nova'), { tipo: 'objetivo' });
  assert.deepEqual(lerRotaDaUrl('/', '?trilha=abc123'), { tipo: 'plano', planoId: 'abc123' });
  assert.deepEqual(lerRotaDaUrl('/', '?trilha=abc123&config=1'), { tipo: 'configuracoes', planoId: 'abc123' });
  assert.deepEqual(lerRotaDaUrl('/explorar', '?tema=idiomas&q=viagem'), {
    tipo: 'explorar',
    filtro: { aba: 'todos', tema: 'idiomas', busca: 'viagem' },
  });
  assert.equal(urlDoExplorar({ aba: 'todos', tema: 'idiomas', busca: 'viagem' }), '/explorar?tema=idiomas&q=viagem');
  assert.equal(urlDaTelaWeb({ tipo: 'perfil' }), '/?tela=perfil');
  assert.equal(urlDaTelaWeb({ tipo: 'planos' }), '/?tela=trilhas');
  assert.equal(tituloDaTelaWeb('perfil'), 'Perfil · Studoo');
  assert.equal(tituloDaTelaWeb('planos'), 'Minhas trilhas · Studoo');
  assert.equal(tituloDaTelaWeb('explorar', { tema: 'idiomas' }), 'Idiomas · Explorar · Studoo');
  assert.equal(lerFiltroExplorarDaUrl('?aba=seguindo&tema=invalido&q=%20violao%20').tema, null);
  assert.equal(lerFiltroExplorarDaUrl('?aba=seguindo&q=%20violao%20').busca, 'violao');
});

// ── Item 12: Busca textual no Explorar (API) ──
test('item 12: GET /api/explorar?q=... filtra sem diferenciar acentos/caixa e limpa emAlta', async () => {
  const usuario = await banco.usuario.create({ data: { email: `busca-explorar-${randomUUID()}@example.test`, fuso: 'UTC' } });
  usuariosCriados.push(usuario.id);
  const { token } = await criarSessao(usuario.id);
  await perfilPut(req('/api/perfil', { metodo: 'PUT', token, corpo: { nome: 'Marina Buscável', cor: 'azul' } }));

  const proposta = await gerarProposta(usuario.id, 'Aprender acordes de violão clássico');
  const plano = await aceitarProposta(usuario.id, proposta.token);
  const rShare = await criarSharePost(
    req(`/api/aprendizado/planos/${plano.id}/compartilhar`, { metodo: 'POST', token, corpo: {} }),
    ctx({ id: plano.id }),
  );
  const share = await rShare.json();
  await publicacaoRevisada(usuario.id, share.codigo);
  await linkPatch(
    req(`/api/compartilhar/${share.codigo}`, {
      metodo: 'PATCH',
      token,
      corpo: { visibilidade: 'explorar', tema: 'artes', legenda: 'Primeiros acordes com pestana leve.' },
    }),
    ctx({ codigo: share.codigo }),
  );
  await publicacaoRevisada(usuario.id, share.codigo);

  // Busca sem acento encontra título com acento e legenda.
  const rBusca = await explorarGet(req('/api/explorar?q=pestana', { token }));
  assert.equal(rBusca.status, 200);
  const corpoBusca = await rBusca.json();
  assert.deepEqual(corpoBusca.emAlta, [], 'com busca ativa, não repete Em alta');
  assert.ok(corpoBusca.novas.some((c) => c.codigo === share.codigo), 'encontrou pela legenda');

  const rAutor = await explorarGet(req('/api/explorar?q=marina%20buscavel', { token }));
  assert.equal(rAutor.status, 200);
  const corpoAutor = await rAutor.json();
  assert.ok(corpoAutor.novas.some((c) => c.codigo === share.codigo), 'encontrou pelo nome do autor sem acento');

  const rInexistente = await explorarGet(req('/api/explorar?q=termo-inexistente-99999', { token }));
  assert.equal(rInexistente.status, 200);
  const corpoVazio = await rInexistente.json();
  assert.equal(corpoVazio.novas.length, 0);
});

// ── Itens 2, 5, 6, 8, 9, 10, 11, 12 (verificações contratuais de UI/CSS/acessibilidade) ──
test('itens 2 e 8: visitante tem textos honestos na conclusão, saída, Perfil, Explorar > Seguindo e /p/[id]', () => {
  assert.equal(
    mensagens.licao.historia.sincroniaVisitante,
    'Sessão de visitante · seu progresso fica por até 24 h a partir da entrada neste navegador',
  );
  assert.doesNotMatch(mensagens.licao.historia.sincroniaVisitante, /qualquer aparelho/i);
  assert.match(mensagens.sairVisitantePergunta, /24 h|visitante/i);
  assert.equal(mensagens.comunidade.voltarComunidade, 'Voltar à Comunidade');
  assert.equal(mensagens.comunidade.entrarOuCriar, 'Entrar ou criar conta');

  const estudo = ler('src/app/estudo.tsx');
  assert.match(estudo, /visitante \? mensagens\.licao\.historia\.sincroniaVisitante : mensagens\.licao\.historia\.sincronia/);
  assert.match(estudo, /telaRef\.current\.tipo === 'concluida' && atual === ultimaUrlSincronizada\.current/);
  assert.match(estudo, /mensagem: visitante \? mensagens\.sairVisitantePergunta : mensagens\.sairPergunta/);
  assert.match(estudo, /cancelarRotulo: mensagens\.ficar/);

  const comunidade = ler('src/app/comunidade.tsx');
  assert.match(comunidade, /c\.seguindoVisitanteTitulo/);
  assert.match(comunidade, /c\.voltarComunidade/);
  assert.match(comunidade, /c\.entrarOuCriar/);

  const seguir = ler('src/app/seguir.tsx');
  assert.match(seguir, /c\.entrarOuCriar/);
  assert.match(seguir, /c\.seguirVisitanteAviso/);
});

test('itens 5, 6, 9, 10, 11 e 12: folga de viewport, PonteReforco, foco, semântica, prévia, fontes e Voltar em suporte/privacidade', () => {
  // Item 5: scroll-padding-bottom na aula e garantia de visibilidade dos botões em estudio.tsx
  assert.match(ler('src/app/aula.css'), /scroll-padding-bottom:\s*124px;/);
  assert.match(ler('src/app/estudio.tsx'), /garantirAcoesEnsinoVisiveis/);
  assert.match(ler('src/app/estudio.tsx'), /acoesMaterialRef/);

  // Item 6: PonteReforco exibe erro e feedback no rodapé fixo, sem limpar resposta em erro de rede/API
  const ponte = ler('src/app/ponte-reforco.tsx');
  const idxRodape = ponte.indexOf('className="reforco__rodape"');
  assert.ok(idxRodape > 0);
  const rodape = ponte.slice(idxRodape);
  assert.match(rodape, /\{ponte && erro && \(\s*<p role="alert" className="campo-erro reforco__aviso">\{erro\}<\/p>/);
  assert.match(rodape, /\{ponte && resultado && \(/);
  assert.match(ponte, /const nova = await verificar\(resposta\);\s*if \(nova\) \{/, 'em falha de envio (nova undefined), mantém a seleção atual e exibe erro no rodapé');

  // Item 9: foco restaurado em Excluir conta e Editar + semântica de Interesses e Cor
  assert.match(ler('src/app/privacidade-perfil.tsx'), /gatilho\.current\?\.focus\(\)/);
  const perfil = ler('src/app/perfil.tsx');
  assert.match(perfil, /\(botaoEditarRef\.current \?\? document\.getElementById\(editarId\)\)\?\.focus\(\)/);
  assert.match(perfil, /role="group" aria-label=\{p\.interessesRotulo\}/);
  assert.match(perfil, /role="radiogroup" aria-label=\{m\.corRotulo\}/);

  // Item 10: [1] sem aria-expanded (atalho de fonte) e prévia com Parte 2 após lições da Parte 1
  const aula = ler('src/app/aula.tsx');
  assert.match(aula, /aria-label=\{`Ir para a fonte \$\{idx \+ 1\}`\}/);
  assert.match(aula, /aria-controls="aula-citacao-ativa"/);
  assert.doesNotMatch(aula, /className="aula-citacao-marcador"[^>]*aria-expanded/);
  const previa = ler('src/app/previa-trilha.tsx');
  assert.ok(
    previa.indexOf('<div className="previa-no__centro">') < previa.indexOf('{fronteira && <>'),
    'no DOM da prévia, a lição vem antes da fronteira da próxima parte',
  );

  // Item 11: sem preload não usado no layout e Cache-Control imutável para /marca/*.woff2
  const layout = ler('src/app/layout.tsx');
  assert.doesNotMatch(layout, /rel="preload"[^>]*as="font"/);
  const nextConfig = ler('next.config.ts');
  assert.ok(nextConfig.includes('/marca/:arquivo(.*\\\\.woff2)'));
  assert.match(nextConfig, /immutable/);

  // Item 12: Voltar explícito em /suporte e /privacidade + deduplicação no Explorar
  assert.match(ler('src/app/suporte/formulario.tsx'), /<VoltarDaPagina/);
  assert.match(ler('src/app/privacidade/page.tsx'), /<VoltarDaPagina/);
  assert.match(ler('src/app/comunidade.tsx'), /unicoIgual/);
});
