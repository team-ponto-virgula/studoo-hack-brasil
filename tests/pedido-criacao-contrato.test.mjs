// Retomada da criação da trilha (spec 04, Retomada da criação): o contrato que a web e o app leem. As regras de decisão são puras e iguais nas duas plataformas; cada cliente tem o teste da tela dele.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSULTA_DA_CRIACAO,
  aplicarConsultaDaCriacao,
  chaveDaCriacaoPendente,
  decidirDepoisDaConsulta,
  estadoDaConsultaQueFalhou,
  MAXIMO_DE_CRIACOES_PENDENTES,
  comCriacaoPendente,
  lerCriacoesPendentes,
  pedidoIdValido,
  semCriacaoPendente,
  textoDasCriacoesPendentes,
  ErroStudoo,
} from '@studoo/contratos';

const ID = '3f1c2b4a-8d7e-4a60-9b1f-0c2d3e4f5a6b';
const OUTRO = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const plano = { id: ID, titulo: 'Python', progresso: { concluidas: 0, total: 3, percentual: 0 }, objetivo: 'x', origem: 'Conteúdo gerado pelo Studoo', fluxos: [] };
const nao = { estado: 'nao_recebido', pedidoId: ID };
const preparo = (tentativas = 1, consultarEmMs = 3000) => ({ estado: 'em_preparo', pedidoId: ID, tentativas, etapa: 'licoes', decorridoMs: 4000, limiteMs: 300000, consultarEmMs });
const pronto = { estado: 'pronto', pedidoId: ID, tentativas: 1, plano };
const falha = (tentativas = 1) => ({ estado: 'falha', pedidoId: ID, tentativas, codigo: 'ia_indisponivel', causa: 'resposta_ia', repetivel: true });
const sem = (motivo) => ({ estado: 'desconhecido', pedidoId: ID, motivo });

test('a consulta que falha nunca vira "não recebido": rede, tempo e erro do servidor deixam o estado desconhecido; a sessão vencida manda entrar', () => {
  assert.deepEqual(estadoDaConsultaQueFalhou(ID, new TypeError('fetch failed')), sem('rede'));
  assert.deepEqual(estadoDaConsultaQueFalhou(ID, Object.assign(new Error('timeout'), { name: 'AbortError' })), sem('rede'));
  assert.deepEqual(estadoDaConsultaQueFalhou(ID, new ErroStudoo('falha')), sem('servidor'));
  assert.deepEqual(estadoDaConsultaQueFalhou(ID, new ErroStudoo('ia_indisponivel')), sem('servidor'));
  assert.deepEqual(estadoDaConsultaQueFalhou(ID, new ErroStudoo('nao_autenticado')), sem('sessao'));
  assert.deepEqual(estadoDaConsultaQueFalhou(ID, 'qualquer coisa'), sem('rede'));
});

test('"pronto" é final: nenhum erro, ausência, preparo ou falha que chegue depois o desfaz (respostas chegam fora de ordem)', () => {
  let estado = aplicarConsultaDaCriacao(null, preparo());
  estado = aplicarConsultaDaCriacao(estado, pronto);
  for (const tardia of [falha(), nao, preparo(), sem('rede'), sem('servidor'), sem('sessao')]) {
    assert.deepEqual(aplicarConsultaDaCriacao(estado, tardia), pronto, `depois de pronto, ${tardia.estado} é ignorado`);
  }
  assert.deepEqual(aplicarConsultaDaCriacao(preparo(), pronto), pronto);
  assert.deepEqual(aplicarConsultaDaCriacao(falha(), pronto), pronto, 'um reenvio que deu certo vence a falha antiga');
});

test('uma resposta de tentativa mais antiga não apaga a mais nova; a consulta mais recente vale, inclusive "desconhecido"', () => {
  assert.deepEqual(aplicarConsultaDaCriacao(preparo(2), falha(1)), preparo(2), 'a falha da tentativa 1 chegou depois de o reenvio já estar em preparo');
  assert.deepEqual(aplicarConsultaDaCriacao(falha(1), preparo(2)), preparo(2), 'o reenvio começou: o preparo novo substitui a falha');
  assert.deepEqual(aplicarConsultaDaCriacao(preparo(), sem('rede')), sem('rede'), 'a consulta mais nova não falou com o servidor: o estado é desconhecido agora');
  assert.deepEqual(aplicarConsultaDaCriacao(sem('rede'), preparo()), preparo());
  assert.deepEqual(aplicarConsultaDaCriacao(preparo(), { ...pronto, pedidoId: OUTRO }), preparo(), 'outro pedido nunca se mistura');
});

test('depois de cada consulta: pronto conclui, falha confirmada mostra o motivo, em preparo espera no ritmo do servidor (limitado), sem erro prematuro', () => {
  assert.deepEqual(decidirDepoisDaConsulta(pronto, { enviadoHaMs: 90_000 }), { acao: 'concluir', plano });
  assert.deepEqual(decidirDepoisDaConsulta(falha(), { enviadoHaMs: 90_000 }), { acao: 'falhou', falha: falha() });
  assert.deepEqual(decidirDepoisDaConsulta(preparo(1, 3000), { enviadoHaMs: 200_000 }), { acao: 'esperar', emMs: 3000 }, 'em preparo nunca vira erro por tempo no cliente: quem dá o prazo é o servidor');
  assert.deepEqual(decidirDepoisDaConsulta(preparo(1, 10), { enviadoHaMs: 1000 }), { acao: 'esperar', emMs: CONSULTA_DA_CRIACAO.emPreparoMinimoMs }, 'um ritmo absurdo é limitado');
  assert.deepEqual(decidirDepoisDaConsulta(preparo(1, 600_000), { enviadoHaMs: 1000 }), { acao: 'esperar', emMs: CONSULTA_DA_CRIACAO.emPreparoMaximoMs });
});

test('"não recebido" logo depois de enviar pode ser corrida: reconfere por tempo limitado; persistindo, oferece reenviar (a um toque, mesma proposta e mesmo pedidoId)', () => {
  const { reconferirAusenteACadaMs: ritmo, reconferirAusentePorMs: janela } = CONSULTA_DA_CRIACAO;
  assert.deepEqual(decidirDepoisDaConsulta(nao, { enviadoHaMs: 500 }), { acao: 'esperar', emMs: ritmo });
  assert.deepEqual(decidirDepoisDaConsulta(nao, { enviadoHaMs: janela - 1 }), { acao: 'esperar', emMs: ritmo });
  assert.deepEqual(decidirDepoisDaConsulta(nao, { enviadoHaMs: janela }), { acao: 'reenviar' });
  assert.deepEqual(decidirDepoisDaConsulta(nao, { enviadoHaMs: 10 * janela }), { acao: 'reenviar' });
});

test('estado desconhecido: continua verificando, com espera crescente, e nunca reenvia nem mostra erro; a sessão vencida leva ao login', () => {
  const esperas = CONSULTA_DA_CRIACAO.semRespostaEsperasMs;
  const vistas = [1, 2, 3, 4, 5, 9].map((n) => decidirDepoisDaConsulta(sem('rede'), { enviadoHaMs: 1_000_000, semRespostaSeguidas: n }));
  assert.deepEqual(vistas, [esperas[0], esperas[1], esperas[2], esperas[3], esperas[3], esperas[3]].map((emMs) => ({ acao: 'verificar_depois', emMs })));
  assert.deepEqual(decidirDepoisDaConsulta(sem('servidor'), { enviadoHaMs: 1_000_000 }), { acao: 'verificar_depois', emMs: esperas[0] });
  assert.deepEqual(decidirDepoisDaConsulta(sem('sessao'), { enviadoHaMs: 1_000_000 }), { acao: 'entrar' });
});

test('os pedidos pendentes guardados no aparelho: ida e volta, vários ao mesmo tempo, uma chave por conta, e o que está fora do formato é descartado', () => {
  const pendente = { versao: 1, pedidoId: ID, token: 'abc.def', intencao: 'comecar', titulo: 'Python para quem já programa', licoes: 10, partes: 3, enviadoEm: 1_764_000_000_000, propostaExpiraEm: 1_764_001_800_000 };
  const b = { ...pendente, pedidoId: OUTRO, intencao: 'salvar', titulo: 'Violão', enviadoEm: 1_764_000_100_000 };
  delete b.propostaExpiraEm;
  assert.deepEqual(lerCriacoesPendentes(textoDasCriacoesPendentes([pendente])), [pendente]);
  assert.deepEqual(lerCriacoesPendentes(textoDasCriacoesPendentes([b, pendente])), [pendente, b], 'do mais antigo para o mais novo; A e B continuam acessíveis');
  assert.deepEqual(comCriacaoPendente([pendente], b), [pendente, b]);
  assert.deepEqual(comCriacaoPendente([pendente, b], { ...pendente, intencao: 'salvar' }), [{ ...pendente, intencao: 'salvar' }, b].sort((x, y) => x.enviadoEm - y.enviadoEm), 'o mesmo pedidoId troca, não duplica');
  assert.deepEqual(semCriacaoPendente([pendente, b], ID), [b]);
  let cheia = [];
  for (let i = 0; i < MAXIMO_DE_CRIACOES_PENDENTES + 2; i += 1) {
    cheia = comCriacaoPendente(cheia, { ...pendente, pedidoId: `3f1c2b4a-8d7e-4a60-9b1f-0c2d3e4f5a${String(10 + i)}`, enviadoEm: 1_764_000_000_000 + i });
  }
  assert.equal(cheia.length, MAXIMO_DE_CRIACOES_PENDENTES, 'passando do máximo, o mais antigo sai');
  assert.equal(cheia.at(-1).enviadoEm, 1_764_000_000_000 + MAXIMO_DE_CRIACOES_PENDENTES + 1);
  assert.notEqual(chaveDaCriacaoPendente('conta-a'), chaveDaCriacaoPendente('conta-b'));
  assert.deepEqual(lerCriacoesPendentes(JSON.stringify([pendente, pendente, { ...pendente, versao: 2 }, { ...pendente, pedidoId: 'x' }, { ...pendente, token: '' }, 7, null, b])), [pendente, b], 'repetido e inválido saem; o resto fica');
  for (const ruim of [null, undefined, '', 'não é json', '{}', 'null', '"x"', JSON.stringify([{ ...pendente, intencao: 'outra' }]), JSON.stringify([{ ...pendente, licoes: -1 }]),
    JSON.stringify([{ ...pendente, enviadoEm: 'ontem' }]), JSON.stringify([{ ...pendente, token: 'x'.repeat(6001) }])]) {
    assert.deepEqual(lerCriacoesPendentes(ruim), []);
  }
  assert.ok(pedidoIdValido(ID));
  assert.ok(!pedidoIdValido('../planos') && !pedidoIdValido('') && !pedidoIdValido(42));
});
