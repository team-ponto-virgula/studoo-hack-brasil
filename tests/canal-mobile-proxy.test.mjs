import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://teste:teste@127.0.0.1:5432/teste";
process.env.STUDOO_CHAVE_ASSINATURA ??= "0123456789abcdef".repeat(4);

const { rotaEntradaMobile } = await import("../src/servidor/acesso/http.ts");

const envOriginal = {
  STUDOO_SESSAO_MOBILE_PILOTO: process.env.STUDOO_SESSAO_MOBILE_PILOTO,
  STUDOO_ORIGEM: process.env.STUDOO_ORIGEM,
  STUDOO_PROXY_HTTPS: process.env.STUDOO_PROXY_HTTPS,
};

afterEach(() => {
  process.env.STUDOO_SESSAO_MOBILE_PILOTO = envOriginal.STUDOO_SESSAO_MOBILE_PILOTO;
  process.env.STUDOO_ORIGEM = envOriginal.STUDOO_ORIGEM;
  if (envOriginal.STUDOO_PROXY_HTTPS === undefined) delete process.env.STUDOO_PROXY_HTTPS;
  else process.env.STUDOO_PROXY_HTTPS = envOriginal.STUDOO_PROXY_HTTPS;
});

function chamarMobile(url, headers) {
  return rotaEntradaMobile(new Request(url, { method: "POST", headers }), async () => new Response("ok", { status: 200 }));
}

test("sem STUDOO_PROXY_HTTPS, X-Forwarded-Proto https não libera canal HTTP", async () => {
  process.env.STUDOO_SESSAO_MOBILE_PILOTO = "1";
  process.env.STUDOO_ORIGEM = "https://studoo.example.test";
  delete process.env.STUDOO_PROXY_HTTPS;

  const res = await chamarMobile("http://127.0.0.1:3000/api/mobile/sessao", {
    host: "studoo.example.test",
    "x-forwarded-proto": "https",
  });
  assert.equal(res.status, 404);
});

test("com STUDOO_PROXY_HTTPS=1, aceita x-forwarded-proto https com host autorizado e recusa proto http, host errado, origin ou cookie", async () => {
  process.env.STUDOO_SESSAO_MOBILE_PILOTO = "1";
  process.env.STUDOO_ORIGEM = "https://studoo.example.test";
  process.env.STUDOO_PROXY_HTTPS = "1";

  const ok = await chamarMobile("http://127.0.0.1:3000/api/mobile/sessao", {
    host: "studoo.example.test",
    "x-forwarded-proto": "https",
  });
  assert.equal(ok.status, 200);

  const protoHttp = await chamarMobile("http://127.0.0.1:3000/api/mobile/sessao", {
    host: "studoo.example.test",
    "x-forwarded-proto": "http",
  });
  assert.equal(protoHttp.status, 404);

  const hostErrado = await chamarMobile("http://127.0.0.1:3000/api/mobile/sessao", {
    host: "outro.example.test",
    "x-forwarded-proto": "https",
  });
  assert.equal(hostErrado.status, 404);

  const comOrigin = await chamarMobile("http://127.0.0.1:3000/api/mobile/sessao", {
    host: "studoo.example.test",
    "x-forwarded-proto": "https",
    origin: "https://studoo.example.test",
  });
  assert.equal(comOrigin.status, 403);

  const comCookie = await chamarMobile("http://127.0.0.1:3000/api/mobile/sessao", {
    host: "studoo.example.test",
    "x-forwarded-proto": "https",
    cookie: "studoo_sessao=abc",
  });
  assert.equal(comCookie.status, 401);
});
