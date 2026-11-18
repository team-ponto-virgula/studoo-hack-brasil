import test from 'node:test';
import assert from 'node:assert/strict';
import { banco } from '../src/servidor/banco/cliente';
import { GET as getConfig } from '../src/app/api/auth/config/route';
import { POST as postVisitante } from '../src/app/api/visitante/route';
import { PRAZO_VISITANTE_MS } from '../src/servidor/acesso/visitante';
import { limparExpirados } from '../src/servidor/estudio/limpeza';

function req(caminho, metodo, headersExtra = {}) {
  const origem = process.env.STUDOO_ORIGEM || 'http://127.0.0.1:3000';
  return new Request(`${origem}${caminho}`, {
    method: metodo,
    headers: { origin: origem, ...headersExtra },
  });
}

test('visitante desligado por padrão fecha /api/visitante e expõe visitante: false em /api/auth/config', async () => {
  const anterior = process.env.STUDOO_VISITANTE;
  delete process.env.STUDOO_VISITANTE;
  try {
    const resConfig = await getConfig(req('/api/auth/config', 'GET'));
    assert.equal(resConfig.status, 200);
    const cfg = await resConfig.json();
    assert.equal(cfg.visitante, false);

    const resPost = await postVisitante(req('/api/visitante', 'POST'));
    assert.equal(resPost.status, 404);
  } finally {
    if (anterior !== undefined) process.env.STUDOO_VISITANTE = anterior;
  }
});

test('visitante ligado cria conta temporária, inicia sessão, limita por IP e limpa após 24h', async () => {
  const anteriorVisitante = process.env.STUDOO_VISITANTE;
  const anteriorProxy = process.env.STUDOO_PROXY_HTTPS;
  process.env.STUDOO_VISITANTE = '1';
  process.env.STUDOO_PROXY_HTTPS = '1';
  const ipTeste = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  const usuariosCriados = [];

  try {
    const resConfig = await getConfig(req('/api/auth/config', 'GET'));
    const cfg = await resConfig.json();
    assert.equal(cfg.visitante, true);

    for (let i = 0; i < 5; i++) {
      const res = await postVisitante(req('/api/visitante', 'POST', { 'x-forwarded-for': ipTeste }));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.autenticado, true);
      assert.ok(res.headers.get('set-cookie')?.includes('HttpOnly'));
    }

    const resLimitado = await postVisitante(req('/api/visitante', 'POST', { 'x-forwarded-for': ipTeste }));
    assert.equal(resLimitado.status, 429);

    const encontrados = await banco.usuario.findMany({
      where: { email: { startsWith: 'visitante+', endsWith: '@visitante.studoo.local' } },
      select: { id: true, email: true },
      orderBy: { email: 'desc' },
      take: 5,
    });
    for (const u of encontrados) usuariosCriados.push(u.id);
    assert.ok(encontrados.length >= 5);

    // Simula que o prazo de 24h já venceu no futuro e verifica que limparExpirados apaga as contas temporárias.
    const futuro = new Date(Date.now() + PRAZO_VISITANTE_MS + 60_000);
    const limpeza = await limparExpirados(futuro);
    assert.ok(limpeza.visitantesExpiradosRemovidos >= 5);
  } finally {
    if (anteriorVisitante === undefined) delete process.env.STUDOO_VISITANTE;
    else process.env.STUDOO_VISITANTE = anteriorVisitante;
    if (anteriorProxy === undefined) delete process.env.STUDOO_PROXY_HTTPS;
    else process.env.STUDOO_PROXY_HTTPS = anteriorProxy;
    if (usuariosCriados.length > 0) {
      await banco.sessao.deleteMany({ where: { usuarioId: { in: usuariosCriados } } });
      await banco.usuario.deleteMany({ where: { id: { in: usuariosCriados } } });
    }
    await banco.$disconnect();
  }
});
