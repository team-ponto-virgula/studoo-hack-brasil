import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { readdir, readFile, unlink } from 'node:fs/promises';
import { after, beforeEach, test } from 'node:test';
import { banco } from '../src/servidor/banco/cliente.ts';
import { cadastrar, pedirCodigoCadastro } from '../src/servidor/acesso/cadastro.ts';
import { criarHashSenha } from '../src/servidor/acesso/credenciais.ts';
import { criarSessao, entrar, hashToken, usuarioDaSessao } from '../src/servidor/acesso/sessao.ts';
import { emitirNonceApple, entrarApple } from '../src/servidor/acesso/apple.ts';
import { desafioPkce, iniciarGoogle, retornarGoogle, trocarCodigoMobile } from '../src/servidor/acesso/google.ts';
import { criarSessaoVisitante } from '../src/servidor/acesso/visitante.ts';
import { excluirConta } from '../src/servidor/privacidade/conta.ts';
import { gerarProposta, aceitarProposta, buscarLicao, conteudoDaLicao, avaliarLicao, concluirLicao } from '../src/servidor/aprendizado/servico.ts';
import { respostaCerta } from '../src/dominio/aprendizado/plano.ts';
import { obterOnboarding, atualizarOnboarding } from '../src/servidor/onboarding/servico.ts';
import { GET, POST } from '../src/app/api/onboarding/route.ts';
import { criarClienteOnboarding, objetivoOnboardingValido } from '../packages/contratos/src/onboarding.ts';

const prefixo = `onb-${randomUUID()}`;
const usuarios = new Set();
const emails = new Set();
const credencial = (token, canal = 'WEB') => ({ token, canal });
const erro = codigo => e => e.codigo === codigo;
const chaveApple = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });

beforeEach(() => {
  process.env.STUDOO_ORIGEM = 'http://localhost:3100';
  process.env.STUDOO_DOMINIO_EMAIL = 'example.test';
  process.env.STUDOO_CHAVE_ASSINATURA = '7f'.repeat(32);
  process.env.IA = 'falsa'; process.env.EMAIL = 'falso';
  process.env.STUDOO_IA_FALSA_PAUSA_MS = '0'; process.env.STUDOO_IA_FALSA_PAUSA_PROPOSTA_MS = '0';
  process.env.STUDOO_CADASTRO = '1'; process.env.STUDOO_VISITANTE = '1';
  process.env.STUDOO_SESSAO_MOBILE_PILOTO = '1';
  delete process.env.STUDOO_PROXY_HTTPS;
  process.env.GOOGLE_CLIENT_ID = 'teste-onboarding.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'segredo-falso';
  process.env.STUDOO_GOOGLE_MOBILE_REDIRECT_URI = 'studoo-dev://auth/google';
  process.env.STUDOO_APPLE = '1'; process.env.APPLE_TEAM_ID = 'TEAM123456'; process.env.APPLE_KEY_ID = 'KEY1234567';
  process.env.APPLE_PRIVATE_KEY = chaveApple.replace(/\n/g, '\\n'); process.env.APPLE_BUNDLE_IDS = 'com.studoo.mobile';
});

after(async () => {
  for (const usuarioId of usuarios) await excluirConta(usuarioId, 'EXCLUIR');
  for (const nome of await readdir('.studoo-local/emails').catch(() => [])) {
    const mensagem = JSON.parse(await readFile(`.studoo-local/emails/${nome}`, 'utf8'));
    if (emails.has(mensagem.to)) await unlink(`.studoo-local/emails/${nome}`);
  }
  await banco.$disconnect();
});

const emailNovo = () => { const email = `${prefixo}-${emails.size}@example.test`; emails.add(email); return email; };
async function conta(nova = true) {
  const u = await banco.usuario.create({ data: {
    email: emailNovo(), senhaHash: await criarHashSenha('senha-onboarding-2026'), fuso: 'America/Sao_Paulo',
    ...(nova ? { onboarding: { create: {} } } : {}),
  } });
  usuarios.add(u.id);
  return u;
}
async function codigoPara(email) {
  for (const nome of await readdir('.studoo-local/emails')) {
    const mensagem = JSON.parse(await readFile(`.studoo-local/emails/${nome}`, 'utf8'));
    if (mensagem.to === email && /é: (\d{6})/.test(mensagem.text)) return /é: (\d{6})/.exec(mensagem.text)[1];
  }
  throw new Error('Código sintético não encontrado');
}
async function trilha(usuarioId) {
  const proposta = await gerarProposta(usuarioId, 'Aprender SQL para minha primeira consulta');
  return aceitarProposta(usuarioId, proposta.token);
}
async function concluirPrimeira(usuarioId, plano, indice = 0) {
  const id = plano.fluxos.flatMap(f => f.licoes)[indice].id;
  const licao = await buscarLicao(usuarioId, id);
  const avaliacao = await avaliarLicao(usuarioId, id, respostaCerta((await conteudoDaLicao(usuarioId, id)).exercicio));
  assert.equal(avaliacao.correta, true);
  await concluirLicao(usuarioId, id, avaliacao.comprovante);
  return { id, comprovante: avaliacao.comprovante };
}
function request(token, body, headers = {}) {
  return new Request('http://localhost:3100/api/onboarding', {
    method: body ? 'POST' : 'GET', headers: {
      origin: 'http://localhost:3100', ...(token ? { cookie: `studoo-sessao=${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}), ...headers,
    }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function loginGoogle({ sub = randomUUID(), email = emailNovo(), mobile = false } = {}) {
  if (mobile) process.env.STUDOO_ORIGEM = 'https://studoo.example.test';
  const verificador = randomBytes(32).toString('hex');
  const inicio = new URL('/api/auth/google/iniciar', process.env.STUDOO_ORIGEM);
  if (mobile) { inicio.searchParams.set('mobile', '1'); inicio.searchParams.set('desafio', desafioPkce(verificador)); }
  const entrada = await iniciarGoogle(new Request(inicio));
  const autorizacao = new URL(entrada.headers.get('location'));
  const retorno = new URL('/api/auth/google/retorno', process.env.STUDOO_ORIGEM);
  retorno.searchParams.set('state', autorizacao.searchParams.get('state')); retorno.searchParams.set('code', 'codigo-falso');
  const resposta = await retornarGoogle(new Request(retorno, { headers: { cookie: entrada.headers.get('set-cookie').split(';')[0] } }), async () => ({ sub, email }));
  const usuario = await banco.usuario.findUniqueOrThrow({ where: { googleSub: sub } }); usuarios.add(usuario.id);
  const token = mobile ? (await trocarCodigoMobile(new URL(resposta.headers.get('location')).searchParams.get('codigo'), verificador)).token
    : /(?:__Host-)?studoo-sessao=([\w-]+)/.exec(resposta.headers.getSetCookie().join(';'))[1];
  return { usuario, token, sub, email, resposta };
}

test('cadastro real inicializa estado atomicamente; marcador é só da sessão criada, não da instalação', async () => {
  const email = emailNovo();
  await pedirCodigoCadastro(email, `rede-${randomUUID()}`);
  const primeira = await cadastrar(email, await codigoPara(email), 'senha-onboarding-2026', 'WEB');
  const usuarioId = await usuarioDaSessao(primeira.token, 'WEB'); usuarios.add(usuarioId);
  const inicial = await obterOnboarding(usuarioId, credencial(primeira.token));
  assert.equal(inicial.iniciarAutomaticamente, true); assert.equal(inicial.onboarding.etapa, 'preparacao');
  assert.equal((await atualizarOnboarding(usuarioId, { acao: 'iniciar' }, credencial(primeira.token))).iniciarAutomaticamente, false);
  assert.equal((await atualizarOnboarding(usuarioId, { acao: 'iniciar' }, credencial(primeira.token))).iniciarAutomaticamente, false);
  await atualizarOnboarding(usuarioId, { acao: 'preparar', objetivo: 'SQL para minha prova', metaLicoesDia: 2, fuso: 'America/Manaus' });
  const novoLogin = await entrar(email, 'senha-onboarding-2026');
  const restaurado = await obterOnboarding(usuarioId, credencial(novoLogin.token));
  assert.equal(restaurado.iniciarAutomaticamente, false);
  assert.equal(restaurado.onboarding.objetivo, 'SQL para minha prova'); assert.equal(restaurado.onboarding.metaLicoesDia, 2);
  assert.equal(restaurado.onboarding.etapa, 'trilha');
});

test('Google web novo abre onboarding; login Google existente entra direto e mantém a mesma conta', async () => {
  const novo = await loginGoogle();
  assert.equal(new URL(novo.resposta.headers.get('location')).pathname, '/onboarding');
  assert.equal((await obterOnboarding(novo.usuario.id, credencial(novo.token))).iniciarAutomaticamente, true);
  const repetido = await loginGoogle({ sub: novo.sub, email: novo.email });
  assert.equal(repetido.usuario.id, novo.usuario.id);
  assert.equal(new URL(repetido.resposta.headers.get('location')).pathname, '/');
  assert.equal((await obterOnboarding(repetido.usuario.id, credencial(repetido.token))).iniciarAutomaticamente, false);
});

test('Google mobile propaga o marcador pelo código PKCE uma vez; acesso seguinte não reenrola', async () => {
  const novo = await loginGoogle({ mobile: true });
  assert.equal((await obterOnboarding(novo.usuario.id, credencial(novo.token, 'MOBILE'))).iniciarAutomaticamente, true);
  const repetido = await loginGoogle({ sub: novo.sub, email: novo.email, mobile: true });
  assert.equal(repetido.usuario.id, novo.usuario.id);
  assert.equal((await obterOnboarding(repetido.usuario.id, credencial(repetido.token, 'MOBILE'))).iniciarAutomaticamente, false);
});

test('Apple inicializa onboarding só na conta nova, preservando o vínculo por sub', async () => {
  process.env.STUDOO_ORIGEM = 'https://studoo.example.test';
  const sub = `onboarding-${randomUUID()}`; const email = emailNovo();
  const provedores = { verificar: async () => ({ sub, email, cliente: 'com.studoo.mobile' }), trocar: async () => 'renovacao-falsa' };
  const entrarUmaVez = async () => entrarApple({ identityToken: 'token-falso', authorizationCode: 'codigo-falso', nonce: (await emitirNonceApple(`rede-${randomUUID()}`)).nonce }, provedores);
  const primeira = await entrarUmaVez();
  const usuarioId = await usuarioDaSessao(primeira.token, 'MOBILE'); usuarios.add(usuarioId);
  assert.equal((await obterOnboarding(usuarioId, credencial(primeira.token, 'MOBILE'))).iniciarAutomaticamente, true);
  const segunda = await entrarUmaVez();
  assert.equal(await usuarioDaSessao(segunda.token, 'MOBILE'), usuarioId);
  assert.equal((await obterOnboarding(usuarioId, credencial(segunda.token, 'MOBILE'))).iniciarAutomaticamente, false);
  // Evita revogação de uma autorização real na limpeza: estes provedores são exclusivamente falsos.
  await banco.usuario.update({ where: { id: usuarioId }, data: { appleRenovacao: null, appleCliente: null } });
});

test('conta legada define meta sem ganhar onboarding; visitante não vira conta nem grava meta', async () => {
  const usuario = await conta(false); const sessao = await criarSessao(usuario.id, 'WEB');
  let estado = await obterOnboarding(usuario.id, credencial(sessao.token));
  assert.equal(estado.onboarding, null); assert.equal(estado.iniciarAutomaticamente, false);
  estado = await atualizarOnboarding(usuario.id, { acao: 'definir-meta', metaLicoesDia: 3 });
  assert.equal(estado.onboarding, null); assert.equal(estado.retencao.metaLicoesDia, 3);
  await assert.rejects(atualizarOnboarding(usuario.id, { acao: 'retomar' }), erro('nao_encontrado'));
  const visitante = await criarSessaoVisitante(`rede-${randomUUID()}`); usuarios.add(visitante.usuarioId);
  assert.equal((await obterOnboarding(visitante.usuarioId)).onboarding, null);
  await assert.rejects(atualizarOnboarding(visitante.usuarioId, { acao: 'definir-meta', metaLicoesDia: 2 }), erro('invalido'));
});

test('checkpoint privado rejeita plano alheio, conclusão alegada e objetivo sem uso; adiamento é reversível', async () => {
  const a = await conta(); const b = await conta(); const planoB = await trilha(b.id);
  await assert.rejects(atualizarOnboarding(a.id, { acao: 'vincular-plano', planoId: planoB.id }), erro('nao_encontrado'));
  await assert.rejects(atualizarOnboarding(a.id, { acao: 'concluir', concluidoEm: new Date().toISOString() }), erro('invalido'));
  assert.equal(objetivoOnboardingValido('x'.repeat(501)), false);
  await assert.rejects(atualizarOnboarding(a.id, { acao: 'preparar', objetivo: 'x'.repeat(501), metaLicoesDia: 1 }), erro('invalido'));
  await assert.rejects(atualizarOnboarding(a.id, { acao: 'definir-meta', metaLicoesDia: 4 }), erro('invalido'));
  await assert.rejects(atualizarOnboarding(a.id, { acao: 'definir-meta', metaLicoesDia: 1, fuso: 'inventado/falso' }), erro('invalido'));
  await atualizarOnboarding(a.id, { acao: 'preparar', objetivo: 'SQL no trabalho', metaLicoesDia: 2 });
  const adiado = await atualizarOnboarding(a.id, { acao: 'adiar' }); assert.ok(adiado.onboarding.adiadoEm);
  const retomado = await atualizarOnboarding(a.id, { acao: 'retomar' });
  assert.equal(retomado.onboarding.adiadoEm, null); assert.equal(retomado.onboarding.objetivo, 'SQL no trabalho');
  assert.equal((await obterOnboarding(b.id)).onboarding.objetivo, null);
});

test('abrir/avaliar não conclui onboarding; primeira conclusão real vincula, salva e indica próxima lição', async () => {
  const usuario = await conta();
  await atualizarOnboarding(usuario.id, { acao: 'preparar', objetivo: 'SQL para primeira consulta', metaLicoesDia: 2 });
  const plano = await trilha(usuario.id);
  const licaoId = plano.fluxos[0].licoes[0].id;
  const licao = await buscarLicao(usuario.id, licaoId);
  await avaliarLicao(usuario.id, licaoId, respostaCerta((await conteudoDaLicao(usuario.id, licaoId)).exercicio));
  const antes = await obterOnboarding(usuario.id);
  assert.equal(antes.onboarding.etapa, 'licao'); assert.equal(antes.onboarding.concluidoEm, null);
  assert.equal(antes.retencao.licoesHoje, 0);
  const concluida = await concluirPrimeira(usuario.id, plano);
  const depois = await obterOnboarding(usuario.id);
  assert.equal(depois.onboarding.etapa, 'concluido'); assert.ok(depois.onboarding.concluidoEm);
  assert.equal(depois.onboarding.planoId, plano.id); assert.equal(depois.retencao.licoesHoje, 1);
  assert.equal(depois.retencao.metaAtingida, false); assert.notEqual(depois.retencao.proximoPasso.licaoId, concluida.id);
  await concluirLicao(usuario.id, concluida.id, concluida.comprovante);
  const repetida = await obterOnboarding(usuario.id);
  assert.equal(repetida.retencao.licoesHoje, 1); assert.equal(repetida.onboarding.concluidoEm, depois.onboarding.concluidoEm);
  await concluirPrimeira(usuario.id, plano, 1);
  const meta = await obterOnboarding(usuario.id);
  assert.equal(meta.retencao.licoesHoje, 2); assert.equal(meta.retencao.metaAtingida, true);
});

test('conclusão recupera POST vincular perdido; plano apagado antes de estudar retorna à preparação útil', async () => {
  const usuario = await conta();
  await atualizarOnboarding(usuario.id, { acao: 'preparar', objetivo: 'SQL para a prova', metaLicoesDia: 1 });
  const plano = await trilha(usuario.id);
  // A UI perdeu a resposta de vincular-plano: nenhum POST desse tipo acontece antes da conclusão.
  await concluirPrimeira(usuario.id, plano);
  assert.equal((await obterOnboarding(usuario.id)).onboarding.etapa, 'concluido');
  const outro = await conta();
  await atualizarOnboarding(outro.id, { acao: 'preparar', objetivo: 'SQL para retomar', metaLicoesDia: 1 });
  const rascunho = await trilha(outro.id);
  await atualizarOnboarding(outro.id, { acao: 'vincular-plano', planoId: rascunho.id });
  const { apagarPlano } = await import('../src/servidor/aprendizado/servico.ts');
  await apagarPlano(outro.id, rascunho.id);
  const semTrilha = await obterOnboarding(outro.id);
  assert.equal(semTrilha.onboarding.etapa, 'trilha'); assert.equal(semTrilha.onboarding.planoId, null);
});

test('meta diária usa data local e primeiras conclusões, sem antecipar registros futuros', async () => {
  const usuario = await conta(); const plano = await trilha(usuario.id);
  const { id } = await concluirPrimeira(usuario.id, plano);
  await banco.registroEstudo.update({ where: { usuarioId_licaoId: { usuarioId: usuario.id, licaoId: id } }, data: { concluidoEm: new Date('2026-11-25T02:59:00Z') } });
  const antes = await obterOnboarding(usuario.id, undefined, new Date('2026-11-25T03:01:00Z'));
  assert.equal(antes.retencao.licoesHoje, 0, '02:59Z pertence ao dia anterior em São Paulo');
  assert.equal(antes.retencao.totalLicoesConcluidas, 1);
  await banco.registroEstudo.update({ where: { usuarioId_licaoId: { usuarioId: usuario.id, licaoId: id } }, data: { concluidoEm: new Date('2026-11-25T03:00:00Z') } });
  assert.equal((await obterOnboarding(usuario.id, undefined, new Date('2026-11-25T03:01:00Z'))).retencao.licoesHoje, 1);
  assert.equal((await obterOnboarding(usuario.id, undefined, new Date('2026-11-25T02:59:00Z'))).retencao.totalLicoesConcluidas, 0);
});

test('trocar objetivo ou modo não recupera a trilha da preparação anterior', async () => {
  const usuario = await conta();
  await atualizarOnboarding(usuario.id, { acao: 'preparar', objetivo: 'SQL para a prova', metaLicoesDia: 1 });
  const a = await trilha(usuario.id);
  await atualizarOnboarding(usuario.id, { acao: 'vincular-plano', planoId: a.id });
  const b = await atualizarOnboarding(usuario.id, { acao: 'preparar', objetivo: 'SQL no trabalho', metaLicoesDia: 1 });
  assert.equal(b.onboarding.planoId, null); assert.equal(b.onboarding.etapa, 'trilha');
  assert.equal((await obterOnboarding(usuario.id)).onboarding.planoId, null);
  await assert.rejects(atualizarOnboarding(usuario.id, { acao: 'vincular-plano', planoId: a.id }), erro('nao_encontrado'));
  const material = await atualizarOnboarding(usuario.id, { acao: 'preparar', objetivo: 'SQL no trabalho', modo: 'material', metaLicoesDia: 1 });
  assert.equal(material.onboarding.modo, 'material'); assert.equal(material.onboarding.planoId, null);
  assert.equal((await obterOnboarding(usuario.id)).onboarding.modo, 'material');
});

test('retenção após primeira vitória acompanha a atividade recente em outra trilha', async () => {
  const usuario = await conta();
  await atualizarOnboarding(usuario.id, { acao: 'preparar', objetivo: 'SQL primeiro estudo', metaLicoesDia: 3 });
  const a = await trilha(usuario.id); await concluirPrimeira(usuario.id, a);
  const primeira = await obterOnboarding(usuario.id);
  assert.equal(primeira.onboarding.planoId, a.id); assert.equal(primeira.retencao.proximoPasso.planoId, a.id);
  const b = await trilha(usuario.id); await concluirPrimeira(usuario.id, b);
  const recente = await obterOnboarding(usuario.id);
  assert.equal(recente.onboarding.planoId, a.id, 'a primeira vitória é histórica e continua igual');
  assert.equal(recente.retencao.proximoPasso.planoId, b.id, 'a retomada acompanha o estudo mais recente');
});

test('rota usa sessão e origem, mantém erro no cliente compartilhado e não confia em usuarioId no corpo', async () => {
  assert.equal((await GET(request())).status, 401);
  const a = await conta(); const b = await conta(); const sessao = await criarSessao(a.id, 'WEB');
  const response = await POST(request(sessao.token, { acao: 'definir-meta', metaLicoesDia: 2, usuarioId: b.id }));
  assert.equal(response.status, 200);
  assert.equal((await obterOnboarding(a.id)).retencao.metaLicoesDia, 2); assert.equal((await obterOnboarding(b.id)).retencao.metaLicoesDia, 1);
  assert.equal((await POST(request(sessao.token, { acao: 'definir-meta', metaLicoesDia: 3 }, { origin: 'https://fora.example' }))).status, 403);
  const cliente = criarClienteOnboarding(async (_path, options) => options.method === 'GET' ? GET(request(sessao.token)) : POST(request(sessao.token, JSON.parse(options.body))));
  assert.equal((await cliente.obterOnboarding()).retencao.metaLicoesDia, 2);
  await cliente.atualizarOnboarding({ acao: 'definir-meta', metaLicoesDia: 3 });
  assert.equal((await cliente.obterOnboarding()).retencao.metaLicoesDia, 3);
  const semSessao = criarClienteOnboarding(async () => GET(request()));
  await assert.rejects(semSessao.obterOnboarding(), erro('nao_autenticado'));
});

test('o mesmo endpoint privado funciona no canal nativo e rejeita mistura de canais', async () => {
  const usuario = await conta();
  const nativa = await criarSessao(usuario.id, 'MOBILE', undefined, undefined, true);
  const web = await criarSessao(usuario.id, 'WEB');
  process.env.STUDOO_ORIGEM = 'https://localhost:3443';
  const nativo = (token, body, extras = {}) => new Request('https://localhost:3443/api/onboarding', {
    method: body ? 'POST' : 'GET', headers: {
      host: 'localhost:3443', authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}), ...extras,
    }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const leitura = await GET(nativo(nativa.token));
  assert.equal(leitura.status, 200); assert.equal((await leitura.json()).iniciarAutomaticamente, true);
  const inicio = await POST(nativo(nativa.token, { acao: 'iniciar' }));
  assert.equal(inicio.status, 200); assert.equal((await inicio.json()).iniciarAutomaticamente, false);
  assert.equal((await GET(nativo(web.token))).status, 401);
  assert.equal((await GET(nativo(nativa.token, undefined, { cookie: 'studoo-sessao=qualquer' }))).status, 401);
  assert.equal((await GET(nativo(nativa.token, undefined, { origin: 'https://localhost:3443' }))).status, 403);
});
