// Fluxo de contrato com duas sessões reais, uma Web e uma MOBILE, no mesmo servidor HTTPS de teste.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const origem = new URL(process.env.STUDOO_QA_ORIGEM);
if (origem.protocol !== 'https:' || !['127.0.0.1', 'localhost'].includes(origem.hostname) ||
    !['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL).hostname) ||
    new URL(process.env.DATABASE_URL).pathname !== '/studoo_local' || process.env.EMAIL !== 'falso') {
  throw Error('Use somente o servidor HTTPS e o banco de testes de loopback, com e-mail falso.');
}
const alvo = JSON.parse(await readFile('.studoo-local/publicacao-qa.json', 'utf8'));
let chamadas = 0;
async function pedir(canal, rota, status, { method = 'GET', corpo, sessao } = {}) {
  const headers = canal === 'web' ? { Origin: origem.origin } : {};
  if (sessao) headers[canal === 'web' ? 'Cookie' : 'Authorization'] = sessao;
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(new URL(rota, origem), { method, headers, body: JSON.stringify(corpo), redirect: 'error' });
  const dados = r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text();
  assert.equal(r.status, status, canal + ' ' + method + ' ' + rota + ' ' + (dados?.codigo || ''));
  chamadas++;
  return { dados, cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
async function codigoLocal(email, assunto) {
  for (const arquivo of await readdir('.studoo-local/emails')) {
    const carta = JSON.parse(await readFile('.studoo-local/emails/' + arquivo, 'utf8'));
    if (carta.to === email && carta.subject.includes(assunto)) return carta.text.match(/\b\d{6}\b/)[0];
  }
  throw Error('Código não encontrado na caixa de teste.');
}
const perfil = '/api/perfis/' + alvo.perfil;
const trilha = '/api/compartilhar/' + alvo.codigo;
const cfg = (await pedir('app', '/api/auth/config', 200)).dados;
assert.ok(cfg.cadastro && cfg.recuperacao && cfg.comunidade && cfg.compartilhar);
const consultar = (protocolo, sessao) => pedir('web', '/api/suporte/protocolo', 200, { method: 'POST', corpo: { protocolo }, sessao });
for (const cadastro of ['app', 'web']) {
  const prefixo = cadastro === 'web' ? '/api' : '/api/mobile';
  const email = 'paridade-' + randomUUID() + '@example.test';
  const senha = randomUUID(), nova = randomUUID();
  await pedir(cadastro, prefixo + '/cadastro/codigo', 200, { method: 'POST', corpo: { email } });
  await pedir(cadastro, prefixo + '/cadastro', 201, { method: 'POST', corpo: { email, senha, codigo: await codigoLocal(email, 'criar a conta') } });
  const entrarWeb = async senha => (await pedir('web', '/api/login', 200, { method: 'POST', corpo: { email, senha } })).cookie;
  const entrarApp = async senha => 'Bearer ' + (await pedir('app', '/api/mobile/sessao', 200, { method: 'POST', corpo: { email, senha } })).dados.token;
  let web = await entrarWeb(senha), app = await entrarApp(senha);
  const estado = (await pedir('app', '/api/privacidade', 200, { sessao: app })).dados;
  assert.ok(estado.consentimentoIa.necessario);
  assert.deepEqual((await pedir('web', '/api/privacidade', 200, { sessao: web })).dados, estado);
  await pedir('app', '/api/privacidade/consentimento-ia', 200, { method: 'POST', sessao: app, corpo: { versao: estado.consentimentoIa.versao } });
  assert.ok((await pedir('web', '/api/privacidade', 200, { sessao: web })).dados.consentimentoIa.aceitoEm);
  await pedir('web', '/api/privacidade/consentimento-ia', 200, { method: 'DELETE', sessao: web });
  assert.equal((await pedir('app', '/api/privacidade', 200, { sessao: app })).dados.consentimentoIa.aceitoEm, null);
  await pedir('app', '/api/aprendizado/propostas', 428, { method: 'POST', sessao: app, corpo: { objetivo: 'Geometria de teste' } });
  await pedir('web', perfil, 200, { sessao: web });
  await pedir('app', '/api/bloqueios', 200, { method: 'POST', sessao: app, corpo: { alvoTipo: 'perfil', alvo: alvo.perfil } });
  await pedir('web', perfil, 404, { sessao: web });
  await pedir('app', trilha, 404, { sessao: app });
  const bloqueados = (await pedir('web', '/api/bloqueios', 200, { sessao: web })).dados.itens;
  const bloqueio = bloqueados.find(pessoa => pessoa.perfilId === alvo.perfil);
  assert.ok(bloqueio);
  await pedir('web', '/api/bloqueios/' + bloqueio.id, 204, { method: 'DELETE', sessao: web });
  await pedir('app', perfil, 200, { sessao: app });
  const relato = await pedir('app', '/api/denuncias', 200, { method: 'POST', sessao: app, corpo: { alvoTipo: 'trilha', alvo: alvo.codigo, motivo: 'ofensivo' } });
  await pedir('web', trilha, 404, { sessao: web });
  await pedir('app', trilha, 404, { sessao: app });
  await pedir('web', trilha, 200);
  assert.equal((await consultar(relato.dados.protocolo)).dados.estado, 'Recebido');
  await pedir(cadastro, prefixo + '/senha/recuperar', 200, { method: 'POST', corpo: { email } });
  await pedir(cadastro, prefixo + '/senha/redefinir', 200, { method: 'POST', corpo: { email, codigo: await codigoLocal(email, 'recuperar'), senha: nova } });
  await pedir('app', '/api/sessao', 401, { sessao: app });
  await pedir('web', '/api/sessao', 401, { sessao: web });
  web = await entrarWeb(nova);
  app = await entrarApp(nova);
  await pedir(cadastro, '/api/conta', 204, { method: 'DELETE', sessao: cadastro === 'web' ? web : app, corpo: { confirmacao: 'EXCLUIR' } });
  await pedir('app', '/api/sessao', 401, { sessao: app });
  await pedir('web', '/api/sessao', 401, { sessao: web });
  assert.equal((await consultar(relato.dados.protocolo)).dados.estado, 'Recebido');
  console.log('Cadastro ' + cadastro + ': consentimento, bloqueio, denúncia, protocolo, recuperação e exclusão entre Web e MOBILE conferidos.');
}
console.log(chamadas + ' respostas de um único servidor HTTPS local. Nenhuma chamada a provedor de IA.');
