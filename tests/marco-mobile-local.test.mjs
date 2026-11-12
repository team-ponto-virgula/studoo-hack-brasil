import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';

const web = 'http://localhost:3000';
const mobile = 'https://127.0.0.1:3443';
const caminho = '/api/aprendizado';

function chamar(base, rota, { metodo = 'GET', corpo, token, cookie, origem } = {}) {
  const headers = {};
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (origem) headers.Origin = origem;
  return fetch(new URL(rota, base), {
    method: metodo, headers,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

test('sessão nativa HTTPS de 8 horas e progresso na conta web', async (t) => {
  const conexao = new URL(process.env.DATABASE_URL ?? 'invalid:');
  assert.equal(conexao.hostname, '127.0.0.1');
  assert.equal(conexao.pathname, '/studoo_local');
  assert.equal(process.env.IA, 'falsa');
  assert.equal(process.env.EMAIL, 'falso');
  const banco = new pg.Client({ connectionString: conexao.href });
  const id = randomUUID();
  const credenciais = { email: `mobile-${id}@example.test`, senha: process.env.STUDOO_SENHA };
  await banco.connect();
  t.after(async () => {
    try {
      for (const tabela of ['RegistroEstudo', 'Licao', 'Fluxo', 'PlanoAprendizado', 'Sessao']) {
        await banco.query(`DELETE FROM "${tabela}" WHERE "usuarioId" = $1`, [id]);
      }
      await banco.query('DELETE FROM "Usuario" WHERE "id" = $1', [id]);
    } finally { await banco.end(); }
  });

  const criada = await banco.query(`INSERT INTO "Usuario" ("id", "email", "senhaHash", "fuso")
    SELECT $1, $2, "senhaHash", "fuso" FROM "Usuario" WHERE "email" = $3`, [id, credenciais.email, process.env.STUDOO_EMAIL]);
  assert.equal(criada.rowCount, 1);

  const logar = (base = mobile, origem) => chamar(base, '/api/mobile/sessao', {
    metodo: 'POST', corpo: credenciais, origem,
  });
  assert.equal((await logar(web)).status, 404);
  assert.equal((await logar(mobile, web)).status, 403);
  assert.equal((await chamar(mobile, '/api/sessao')).status, 401);

  const entrada = await logar();
  assert.equal(entrada.status, 200);
  assert.equal(entrada.headers.get('set-cookie'), null);
  assert.equal(entrada.headers.get('cache-control'), 'no-store');
  const { token, expiraEm } = await entrada.json();
  assert.ok(typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token));
  const hash = createHash('sha256').update(token).digest('hex');
  const { rows: [sessao] } = await banco.query('SELECT "canal", "criadaEm", "expiraEm" FROM "Sessao" WHERE "tokenHash" = $1 AND "usuarioId" = $2', [hash, id]);
  assert.equal(sessao.canal, 'MOBILE');
  assert.equal(sessao.expiraEm - sessao.criadaEm, 8 * 60 * 60 * 1000);
  assert.equal(sessao.expiraEm.toISOString(), expiraEm);

  const entradaWeb = await chamar(web, '/api/login', { metodo: 'POST', corpo: credenciais, origem: web });
  assert.equal(entradaWeb.status, 200);
  const cookie = entradaWeb.headers.get('set-cookie').split(';')[0];
  const tokenWeb = cookie.split('=')[1];
  assert.equal((await chamar(mobile, '/api/sessao', { token: tokenWeb })).status, 401);
  assert.equal((await chamar(web, '/api/sessao', { cookie: `studoo-sessao=${token}` })).status, 401);
  assert.equal((await chamar(mobile, '/api/sessao', { token, cookie })).status, 401);
  assert.equal((await chamar(mobile, '/api/sessao', { token, origem: web })).status, 403);
  assert.equal((await chamar(mobile, '/api/sessao', { token })).status, 200);

  async function enviar(rota, corpo) {
    const resposta = await chamar(mobile, `${caminho}${rota}`, { metodo: 'POST', corpo, token });
    assert.equal(resposta.status, 200);
    return resposta.json();
  }
  const proposta = await enviar('/propostas', { objetivo: 'Praticar filtros e junções em SQL.' });
  const plano = await enviar('/planos', { token: proposta.token });
  const licao = plano.fluxos[0].proximaLicaoId;
  const avaliacao = await enviar(`/licoes/${licao}/avaliar`, { resposta: '>=' });
  assert.equal(avaliacao.correta, true);
  await enviar(`/licoes/${licao}/concluir`, { comprovante: avaliacao.comprovante });
  const leituraWeb = await chamar(web, `${caminho}/planos/${plano.id}`, { cookie });
  assert.equal(leituraWeb.status, 200);
  const progressoWeb = await leituraWeb.json();
  assert.deepEqual(progressoWeb.progresso, { concluidas: 1, total: 4, percentual: 25 });
  assert.equal(progressoWeb.fluxos[0].proximaLicaoId, plano.fluxos[0].licoes[1].id);

  assert.equal((await chamar(mobile, '/api/sessao', { metodo: 'DELETE', token })).status, 204);
  assert.equal((await chamar(mobile, '/api/sessao', { token })).status, 401);
  assert.equal((await chamar(web, '/api/sessao', { cookie })).status, 200);
});
