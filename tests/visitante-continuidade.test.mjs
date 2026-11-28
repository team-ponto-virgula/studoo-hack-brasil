// Continuidade e isolamento de sessão de visitante (rodadas web 24/11, item 1):
// 1. Chamar POST /api/visitante com cookie válido da mesma sessão reutiliza a sessão sem criar novo visitante nem sobrescrever o cookie.
// 2. Dois visitantes diferentes permanecem isolados (trilha/lição de um retorna 404 para o outro).
// 3. O mesmo visitante conclui o fluxo completo avaliar → ponte → avaliarPonte → ensinar → concluir sem perder a sessão.
// 4. Após logout, novo POST /api/visitante cria visitante novo e isolado.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { POST as postVisitante } from '../src/app/api/visitante/route.ts';
import { GET as getSessao, DELETE as deleteSessao } from '../src/app/api/sessao/route.ts';
import { GET as getPlanos } from '../src/app/api/aprendizado/planos/route.ts';
import { GET as getPlano } from '../src/app/api/aprendizado/planos/[id]/route.ts';
import { GET as getLicao } from '../src/app/api/aprendizado/licoes/[id]/route.ts';
import { POST as postAvaliar } from '../src/app/api/aprendizado/licoes/[id]/avaliar/route.ts';
import { POST as postConcluir } from '../src/app/api/aprendizado/licoes/[id]/concluir/route.ts';
import { POST as postPonte } from '../src/app/api/estudio/licoes/[id]/ponte/route.ts';
import { POST as postAvaliarPonte } from '../src/app/api/estudio/licoes/[id]/ponte/avaliar/route.ts';
import { POST as postEnsinar } from '../src/app/api/estudio/licoes/[id]/ensinar/route.ts';
import { aceitarProposta, gerarProposta } from '../src/servidor/aprendizado/servico.ts';
import { usuarioDaSessao } from '../src/servidor/acesso/sessao.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import { nomeCookieSessao } from '../src/servidor/acesso/origem.ts';

const origem = process.env.STUDOO_ORIGEM || 'http://127.0.0.1:3000';
const anteriorVisitante = process.env.STUDOO_VISITANTE;
const anteriorIa = process.env.IA;
const anteriorPausa = process.env.STUDOO_IA_FALSA_PAUSA_MS;
const anteriorLimiteIp = process.env.STUDOO_LIMITE_VISITANTES_IP;
const usuariosCriados = new Set();

process.env.STUDOO_VISITANTE = '1';
process.env.IA = 'falsa';
process.env.STUDOO_IA_FALSA_PAUSA_MS = '0';
process.env.STUDOO_LIMITE_VISITANTES_IP = '50';

function extrairToken(res) {
  const bruto = res.headers.get('set-cookie') ?? '';
  const m = new RegExp(`${nomeCookieSessao()}=([^;]+)`).exec(bruto);
  return m ? m[1] : '';
}
const headerCookie = (token) => (token ? `${nomeCookieSessao()}=${token}` : '');

function req(caminho, { metodo = 'GET', cookie, corpo } = {}) {
  const headers = { origin: origem };
  if (cookie) headers.cookie = cookie;
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
  if (anteriorVisitante === undefined) delete process.env.STUDOO_VISITANTE;
  else process.env.STUDOO_VISITANTE = anteriorVisitante;
  if (anteriorIa === undefined) delete process.env.IA;
  else process.env.IA = anteriorIa;
  if (anteriorPausa === undefined) delete process.env.STUDOO_IA_FALSA_PAUSA_MS;
  else process.env.STUDOO_IA_FALSA_PAUSA_MS = anteriorPausa;
  if (anteriorLimiteIp === undefined) delete process.env.STUDOO_LIMITE_VISITANTES_IP;
  else process.env.STUDOO_LIMITE_VISITANTES_IP = anteriorLimiteIp;
  await banco.$disconnect();
});

test('POST /api/visitante com cookie válido reutiliza a mesma sessão e conclui avaliar → ponte → avaliarPonte → ensinar → concluir', async () => {
  // Aba 1 entra como visitante.
  const resEntrada1 = await postVisitante(req('/api/visitante', { metodo: 'POST' }));
  assert.equal(resEntrada1.status, 200);
  const tokenA = extrairToken(resEntrada1);
  assert.ok(tokenA, 'gera cookie de sessão');
  const cookieA = headerCookie(tokenA);

  const resSessao1 = await getSessao(req('/api/sessao', { cookie: cookieA }));
  assert.equal(resSessao1.status, 200);
  const sessao1 = await resSessao1.json();
  assert.equal(sessao1.autenticado, true);
  assert.equal(sessao1.visitante, true);
  const usuarioAId = await usuarioDaSessao(tokenA, 'WEB');
  assert.ok(usuarioAId);
  usuariosCriados.add(usuarioAId);

  // Cria uma trilha para o visitante A.
  const proposta = await gerarProposta(usuarioAId, 'Triângulos básicos');
  const plano = await aceitarProposta(usuarioAId, proposta.token);
  const licaoId = plano.fluxos[0].licoes[0].id;

  // Aba 2 (aba de /login deixada aberta no mesmo navegador) clica "Experimentar sem conta" (POST /api/visitante):
  // deve preservar a sessão A, manter a lista com 1 trilha e permitir reabrir a trilha nas duas abas!
  const resEntrada2 = await postVisitante(req('/api/visitante', { metodo: 'POST', cookie: cookieA }));
  assert.equal(resEntrada2.status, 200);
  assert.equal(resEntrada2.headers.get('set-cookie'), null, 'não sobrescreve o cookie ativo com outro visitante');

  // A sessão continua sendo exatamente do usuário A, com 1 trilha na lista e reabertura 200.
  assert.equal(await usuarioDaSessao(tokenA, 'WEB'), usuarioAId);
  const resPlanosA = await getPlanos(req('/api/aprendizado/planos', { cookie: cookieA }));
  assert.equal(resPlanosA.status, 200);
  const listaA = await resPlanosA.json();
  assert.equal(listaA.length, 1, 'lista de trilhas continua com 1 trilha após segundo clique');
  const resPlanoA = await getPlano(req(`/api/aprendizado/planos/${plano.id}`, { cookie: cookieA }), ctx({ id: plano.id }));
  assert.equal(resPlanoA.status, 200, 'a mesma trilha reabre sem 404');

  // Aba 1 segue o fluxo completo da lição sem 401 nem 404.
  const resLicao = await getLicao(req(`/api/aprendizado/licoes/${licaoId}`, { cookie: cookieA }), ctx({ id: licaoId }));
  assert.equal(resLicao.status, 200);
  const licao = await resLicao.json();
  const exercicio = licao.exercicios[0];

  // 1) Resposta errada para acionar ponte.
  const respostaErrada = exercicio.tipo === 'multipla_escolha'
    ? (exercicio.opcoes.find((o) => o.id !== 'a')?.id ?? 'b')
    : 'resposta incorreta de teste';
  const resErrada = await postAvaliar(
    req(`/api/aprendizado/licoes/${licaoId}/avaliar`, { metodo: 'POST', cookie: cookieA, corpo: { resposta: respostaErrada, indice: 0 } }),
    ctx({ id: licaoId }),
  );
  assert.equal(resErrada.status, 200);

  // 2) Ponte de reforço (gerar e avaliar).
  const resPonte = await postPonte(
    req(`/api/estudio/licoes/${licaoId}/ponte`, { metodo: 'POST', cookie: cookieA }),
    ctx({ id: licaoId }),
  );
  assert.equal(resPonte.status, 200);
  const apoioPonte = await resPonte.json();
  assert.ok(apoioPonte.ponte?.exercicio?.enunciado, 'gera ponte de reforço');

  const respostaPonte = apoioPonte.ponte.exercicio.tipo === 'multipla_escolha'
    ? (apoioPonte.ponte.exercicio.opcoes?.[0]?.id ?? 'a')
    : 'explicacao curta de reforco';
  const resAvaliarPonte = await postAvaliarPonte(
    req(`/api/estudio/licoes/${licaoId}/ponte/avaliar`, {
      metodo: 'POST',
      cookie: cookieA,
      corpo: { resposta: respostaPonte },
    }),
    ctx({ id: licaoId }),
  );
  assert.equal(resAvaliarPonte.status, 200);

  // 3) Avaliar exercícios e obter comprovante (na IA falsa, 'a' ou texto completo acerta; tentamos até obter comprovante).
  let comprovante = null;
  for (let i = 0; i < licao.exercicios.length; i++) {
    const ex = licao.exercicios[i];
    const tentativas = ex.tipo === 'multipla_escolha'
      ? ex.opcoes.map((o) => o.id)
      : ['triangulo tem tres lados e tres vertices porque fecha uma figura'];
    for (const resp of tentativas) {
      const r = await postAvaliar(
        req(`/api/aprendizado/licoes/${licaoId}/avaliar`, { metodo: 'POST', cookie: cookieA, corpo: { resposta: resp, indice: i } }),
        ctx({ id: licaoId }),
      );
      assert.equal(r.status, 200);
      const dados = await r.json();
      if (dados.comprovante) comprovante = dados.comprovante;
      if (dados.correta) break;
    }
  }
  assert.ok(comprovante, 'recebe comprovante da lição');

  // 4) Explique com suas palavras (ensinar).
  const resEnsinar = await postEnsinar(
    req(`/api/estudio/licoes/${licaoId}/ensinar`, {
      metodo: 'POST',
      cookie: cookieA,
      corpo: { texto: 'Um triângulo tem 3 lados e 3 vértices. Por exemplo, uma placa triangular na rua.' },
    }),
    ctx({ id: licaoId }),
  );
  assert.equal(resEnsinar.status, 200);

  // 5) Concluir a lição.
  const resConcluir = await postConcluir(
    req(`/api/aprendizado/licoes/${licaoId}/concluir`, {
      metodo: 'POST',
      cookie: cookieA,
      corpo: { comprovante },
    }),
    ctx({ id: licaoId }),
  );
  assert.equal(resConcluir.status, 200);
  const concluida = await resConcluir.json();
  assert.ok(concluida.plano.progresso.concluidas >= 1);

  // Visitante B (sem cookie) continua 100% isolado e recebe 404 na lição do visitante A.
  const resEntradaB = await postVisitante(req('/api/visitante', { metodo: 'POST' }));
  assert.equal(resEntradaB.status, 200);
  const tokenB = extrairToken(resEntradaB);
  const cookieB = headerCookie(tokenB);
  assert.notEqual(cookieB, cookieA);
  const usuarioBId = await usuarioDaSessao(tokenB, 'WEB');
  assert.ok(usuarioBId && usuarioBId !== usuarioAId);
  usuariosCriados.add(usuarioBId);

  const resCruzado = await getLicao(req(`/api/aprendizado/licoes/${licaoId}`, { cookie: cookieB }), ctx({ id: licaoId }));
  assert.equal(resCruzado.status, 404, 'isolamento entre visitantes distintos continua intacto');

  // Logout de A + novo POST /api/visitante cria visitante C novo.
  const resLogout = await deleteSessao(req('/api/sessao', { metodo: 'DELETE', cookie: cookieA }));
  assert.equal(resLogout.status, 204);
  const resEntradaC = await postVisitante(req('/api/visitante', { metodo: 'POST', cookie: cookieA }));
  assert.equal(resEntradaC.status, 200);
  const tokenC = extrairToken(resEntradaC);
  assert.ok(tokenC && tokenC !== tokenA, 'após logout cria nova sessão de visitante');
  const usuarioCId = await usuarioDaSessao(tokenC, 'WEB');
  assert.ok(usuarioCId && usuarioCId !== usuarioAId);
  usuariosCriados.add(usuarioCId);
});
