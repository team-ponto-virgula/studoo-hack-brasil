import test from 'node:test';
import assert from 'node:assert/strict';
import { banco } from '../src/servidor/banco/cliente';
import { GET as getConfig } from '../src/app/api/auth/config/route';
import { POST as postVisitante } from '../src/app/api/visitante/route';
import { POST as postVisitanteMobile } from '../src/app/api/mobile/visitante/route';
import { duracaoSessao, duracaoSessaoVisitante } from '../src/servidor/acesso/origem';
import { criarSessao } from '../src/servidor/acesso/sessao';
import { enderecoRede, PRAZO_VISITANTE_MS } from '../src/servidor/acesso/visitante';
import { consumirGeracaoPersistente } from '../src/servidor/ia/limite';
import { limparExpirados } from '../src/servidor/estudio/limpeza';

function req(caminho, metodo, headersExtra = {}) {
  const origem = process.env.STUDOO_ORIGEM || 'http://127.0.0.1:3000';
  return new Request(`${origem}${caminho}`, {
    method: metodo,
    headers: { origin: origem, ...headersExtra },
  });
}

function reqMobile(caminho, metodo, headersExtra = {}) {
  const origem = process.env.STUDOO_ORIGEM || 'http://127.0.0.1:3000';
  return new Request(`${origem}${caminho}`, {
    method: metodo,
    headers: { host: new URL(origem).host, ...headersExtra },
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

    const resMobilePost = await postVisitanteMobile(reqMobile('/api/mobile/visitante', 'POST'));
    assert.equal(resMobilePost.status, 404);
  } finally {
    if (anterior !== undefined) process.env.STUDOO_VISITANTE = anterior;
  }
});

test('sem STUDOO_PROXY_HTTPS=1, enderecoRede ignora x-forwarded-for e usa loopback; com proxy ligado separa por IP', () => {
  const anteriorProxy = process.env.STUDOO_PROXY_HTTPS;
  try {
    delete process.env.STUDOO_PROXY_HTTPS;
    assert.equal(enderecoRede(req('/api/visitante', 'POST', { 'x-forwarded-for': '203.0.113.10' })), 'loopback');

    process.env.STUDOO_PROXY_HTTPS = '1';
    assert.equal(enderecoRede(req('/api/visitante', 'POST', { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' })), '203.0.113.10');
  } finally {
    if (anteriorProxy === undefined) delete process.env.STUDOO_PROXY_HTTPS;
    else process.env.STUDOO_PROXY_HTTPS = anteriorProxy;
  }
});

test('visitante ligado cria conta temporária, limita por IP configurável, aplica cota própria de geração e limpa após 24h', async () => {
  const anteriorVisitante = process.env.STUDOO_VISITANTE;
  const anteriorProxy = process.env.STUDOO_PROXY_HTTPS;
  const anteriorLimiteIp = process.env.STUDOO_LIMITE_VISITANTES_IP;
  const anteriorLimiteGer = process.env.STUDOO_LIMITE_GERACOES_VISITANTE;
  const anteriorPiloto = process.env.STUDOO_SESSAO_MOBILE_PILOTO;
  const anteriorOrigem = process.env.STUDOO_ORIGEM;
  process.env.STUDOO_VISITANTE = '1';
  process.env.STUDOO_PROXY_HTTPS = '1';
  process.env.STUDOO_LIMITE_VISITANTES_IP = '2';
  process.env.STUDOO_LIMITE_GERACOES_VISITANTE = '2';
  process.env.STUDOO_SESSAO_MOBILE_PILOTO = '1';
  process.env.STUDOO_ORIGEM = 'https://studoo.example.test';

  const ipTeste = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  const usuariosCriados = [];

  try {
    const resConfig = await getConfig(req('/api/auth/config', 'GET'));
    const cfg = await resConfig.json();
    assert.equal(cfg.visitante, true);

    for (let i = 0; i < 2; i++) {
      const res = await postVisitante(req('/api/visitante', 'POST', { 'x-forwarded-for': ipTeste }));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.autenticado, true);
      const cookie = res.headers.get('set-cookie') ?? '';
      assert.ok(cookie.includes('HttpOnly'));
      assert.ok(cookie.includes(`Max-Age=${duracaoSessaoVisitante}`));
    }

    const resLimitado = await postVisitante(req('/api/visitante', 'POST', { 'x-forwarded-for': ipTeste }));
    assert.equal(resLimitado.status, 429);
    const corpoLimitado = await resLimitado.json();
    assert.equal(corpoLimitado.codigo, 'limite_visitante');

    // Canal mobile: outro IP cria sessão visitante MOBILE com duração de 24h e { token, expiraEm }.
    const ipMobile = `198.51.101.${Math.floor(Math.random() * 200) + 10}`;
    const resMobile = await postVisitanteMobile(reqMobile('/api/mobile/visitante', 'POST', {
      'x-forwarded-for': ipMobile,
      'x-forwarded-proto': 'https',
    }));
    assert.equal(resMobile.status, 200);
    const bodyMobile = await resMobile.json();
    assert.equal(typeof bodyMobile.token, 'string');
    assert.ok(bodyMobile.token.length >= 32);
    const expMobileMs = new Date(bodyMobile.expiraEm).getTime() - Date.now();
    assert.ok(expMobileMs > 23 * 3600_000 && expMobileMs <= 24 * 3600_000 + 5000);

    const encontrados = await banco.usuario.findMany({
      where: { email: { startsWith: 'visitante+', endsWith: '@visitante.studoo.local' } },
      select: { id: true, email: true },
      orderBy: { email: 'desc' },
      take: 3,
    });
    for (const u of encontrados) usuariosCriados.push(u.id);
    assert.equal(encontrados.length, 3);

    // Sessão de visitante dura 24h no banco; sessão regular dura 8h.
    const sessaoVis = await banco.sessao.findFirst({ where: { usuarioId: encontrados[0].id }, orderBy: { criadaEm: 'desc' } });
    assert.ok(sessaoVis);
    assert.equal(sessaoVis.canal, 'MOBILE');
    const diffVisH = (sessaoVis.expiraEm.getTime() - sessaoVis.criadaEm.getTime()) / 3600_000;
    assert.ok(diffVisH > 23.9 && diffVisH <= 24.01);

    const sessaoRegular = await criarSessao(encontrados[0].id, 'WEB');
    const diffRegH = (sessaoRegular.expiraEm.getTime() - Date.now()) / 3600_000;
    assert.ok(diffRegH > 7.9 && diffRegH <= duracaoSessao / 3600 + 0.01);

    // Cota própria de geração do visitante (2 permitidas, 3ª bloqueada).
    const uid = encontrados[0].id;
    assert.equal(await consumirGeracaoPersistente(uid), true);
    assert.equal(await consumirGeracaoPersistente(uid), true);
    assert.equal(await consumirGeracaoPersistente(uid), false);

    // Simula que o prazo de 24h já venceu no futuro e verifica que limparExpirados apaga as contas temporárias.
    const futuro = new Date(Date.now() + PRAZO_VISITANTE_MS + 60_000);
    const limpeza = await limparExpirados(futuro);
    assert.ok(limpeza.visitantesExpiradosRemovidos >= 2);
  } finally {
    if (anteriorVisitante === undefined) delete process.env.STUDOO_VISITANTE;
    else process.env.STUDOO_VISITANTE = anteriorVisitante;
    if (anteriorProxy === undefined) delete process.env.STUDOO_PROXY_HTTPS;
    else process.env.STUDOO_PROXY_HTTPS = anteriorProxy;
    if (anteriorLimiteIp === undefined) delete process.env.STUDOO_LIMITE_VISITANTES_IP;
    else process.env.STUDOO_LIMITE_VISITANTES_IP = anteriorLimiteIp;
    if (anteriorLimiteGer === undefined) delete process.env.STUDOO_LIMITE_GERACOES_VISITANTE;
    else process.env.STUDOO_LIMITE_GERACOES_VISITANTE = anteriorLimiteGer;
    if (anteriorPiloto === undefined) delete process.env.STUDOO_SESSAO_MOBILE_PILOTO;
    else process.env.STUDOO_SESSAO_MOBILE_PILOTO = anteriorPiloto;
    if (anteriorOrigem === undefined) delete process.env.STUDOO_ORIGEM;
    else process.env.STUDOO_ORIGEM = anteriorOrigem;
    if (usuariosCriados.length > 0) {
      await banco.sessao.deleteMany({ where: { usuarioId: { in: usuariosCriados } } });
      await banco.usuario.deleteMany({ where: { id: { in: usuariosCriados } } });
    }
    await banco.$disconnect();
  }
});
