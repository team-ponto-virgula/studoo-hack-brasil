// As trilhas da conta sintética em volta da prova da criação (fluxos/criacao/90-criacao-da-trilha.yaml), pela API.
//
//   antes:  fotografa a lista logo antes da fase e confere a base do preparo (dados-da-conferencia.json): a conta é a do
//           preparo, a lista do preparo não está vazia, e a conta tem exatamente as trilhas dele, nem uma a mais.
//   depois: compara a lista com a fotografia. Exatamente uma trilha nova, com o detalhe lido, nenhuma sumida e a base
//           conferida: é a trilha da própria prova, sem dúvida; com --apagar, só ela sai, e a lista tem de voltar a ser a
//           da fotografia (se a lista final não responder, fica registrado que a remoção foi pedida e faltou confirmar).
//           Nenhuma nova: nada a apagar (a fase falhou antes de criar, ou o fluxo passou sem criar). Duas ou mais: falha
//           de duplicação, com o detalhe de cada uma, e nada é apagado. O detalhe da trilha nova sem resposta, uma trilha
//           sumida, ou a base que não conferiu: nada é apagado.
// Cada modo escreve um JSON com o que viu (--saida) e uma linha legível; o código de saída diz o caso:
//   0 conferido (antes: base certa; depois: a trilha da prova apagada, ou nenhuma nova), 3 base que não confere,
//   4 duplicação, 5 trilha do preparo sumida, 6 a remoção falhou ou a lista não voltou à fotografia, 7 o detalhe da
//   trilha nova não respondeu (nada é apagado), 8 a remoção foi aceita, mas a lista final não respondeu para confirmar,
//   1 erro de API antes de comparar.
// Entrar de novo pela API cria outra sessão e não derruba a do app (src/servidor/acesso/sessao.ts, entrar).
//
// Só roda contra a API do próprio computador, com IA simulada e conta `.test`, como preparar-dados.mjs.
// Uso: NODE_EXTRA_CA_CERTS=<ca.crt> node --env-file=.env --import tsx trilhas-da-criacao.mjs antes \
//        --api https://127.0.0.1:3443 --dados <dados-da-conferencia.json> --saida <trilhas-antes-da-criacao.json>
//      ... trilhas-da-criacao.mjs depois --api … --antes <trilhas-antes-da-criacao.json> --saida <…> [--apagar]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { criarClienteStudoo } from '@studoo/contratos';

const { values: opcoes, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    api: { type: 'string', default: 'https://127.0.0.1:3443' },
    dados: { type: 'string' },
    antes: { type: 'string' },
    saida: { type: 'string' },
    apagar: { type: 'boolean', default: false },
    'titulo-esperado': { type: 'string' },
  },
});
const modo = positionals[0];

/** O transporte do app, como em preparar-dados.mjs: sem cookie, sem Origin, token no Authorization. */
function transporte(base, token) {
  return async (caminho, pedido) => {
    const resposta = await fetch(new URL(caminho, base), {
      ...pedido,
      redirect: 'error',
      signal: AbortSignal.timeout(60_000),
      headers: { 'Cache-Control': 'no-store', ...pedido.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const corpo = resposta.status === 204 ? null : await resposta.json().catch(() => null);
    return { status: resposta.status, ok: resposta.ok, json: async () => corpo };
  };
}

function terminar(codigo, linha, registro) {
  if (opcoes.saida) writeFileSync(opcoes.saida, `${JSON.stringify({ modo, momento: new Date().toISOString(), ...registro }, null, 2)}\n`);
  console.log(linha);
  process.exit(codigo);
}

const base = new URL(opcoes.api);
const email = process.env.STUDOO_EMAIL ?? '';
const senha = process.env.STUDOO_SENHA ?? '';
if (base.protocol !== 'https:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
  console.error('Só roda contra a API do próprio computador, em HTTPS.');
  process.exit(2);
}
if (process.env.IA !== 'falsa' || !email.endsWith('.test') || !senha) {
  console.error('Só roda com IA simulada e com a conta sintética (.test).');
  process.exit(2);
}
if (modo !== 'antes' && modo !== 'depois') {
  console.error('Uso: trilhas-da-criacao.mjs antes|depois …');
  process.exit(2);
}

const resumo = (plano) => ({ id: plano.id, titulo: plano.titulo, progresso: plano.progresso });
let cliente;
let planos;
try {
  const { token } = await criarClienteStudoo(transporte(base)).loginNativo(email, senha);
  cliente = criarClienteStudoo(transporte(base, token));
  planos = (await cliente.listarPlanos()).map(resumo);
} catch (erro) {
  terminar(1, `A API não respondeu à lista de trilhas: ${erro?.codigo ?? erro?.message ?? erro}.`, { erro: String(erro?.codigo ?? erro?.message ?? erro) });
}

if (modo === 'antes') {
  let preparo = null;
  try { preparo = JSON.parse(readFileSync(opcoes.dados ?? '', 'utf8')); } catch { preparo = null; }
  const esperadas = Array.isArray(preparo?.trilhas) ? preparo.trilhas.map((trilha) => trilha?.id).filter(Boolean) : [];
  const ids = planos.map((plano) => plano.id);
  const faltam = esperadas.filter((id) => !ids.includes(id));
  const sobram = ids.filter((id) => !esperadas.includes(id));
  let motivo = '';
  if (!preparo) motivo = 'o arquivo do preparo não abriu';
  else if (preparo.conta?.email !== email) motivo = `a conta do preparo (${preparo.conta?.email ?? 'nenhuma'}) não é a desta execução`;
  else if (esperadas.length === 0 || esperadas.length !== (preparo.trilhas?.length ?? 0)) motivo = 'a lista de trilhas do preparo está vazia ou sem id';
  else if (faltam.length || sobram.length) motivo = `a conta não tem exatamente as trilhas do preparo (faltam ${faltam.length}, sobram ${sobram.length})`;
  const ok = motivo === '';
  terminar(ok ? 0 : 3,
    ok ? `Antes da criação: ${planos.length} trilhas, exatamente as do preparo.` : `Antes da criação: a base não confere, ${motivo}. Depois da fase, nada será apagado.`,
    { base: { ok, motivo, esperadas, faltam, sobram }, planos });
}

// --- depois
let foto = null;
try { foto = opcoes.antes && existsSync(opcoes.antes) ? JSON.parse(readFileSync(opcoes.antes, 'utf8')) : null; } catch { foto = null; }
if (!foto?.base?.ok || !Array.isArray(foto.planos)) {
  terminar(3, `Depois da criação: sem fotografia conferida de antes da fase (${foto?.base?.motivo || 'fotografia ausente'}); nada foi apagado.`,
    { caso: 'base-invalida', planos });
}
const antes = new Set(foto.planos.map((plano) => plano.id));
const agora = new Set(planos.map((plano) => plano.id));
const novas = planos.filter((plano) => !antes.has(plano.id));
const sumidas = foto.planos.filter((plano) => !agora.has(plano.id));
const detalhes = [];
for (const plano of novas) {
  try {
    const detalhe = await cliente.obterPlano(plano.id);
    detalhes.push({ id: plano.id, titulo: detalhe.titulo, objetivo: detalhe.objetivo, origem: detalhe.origem, progresso: detalhe.progresso });
  } catch (erro) {
    detalhes.push({ id: plano.id, titulo: plano.titulo, erro: String(erro?.codigo ?? erro?.message ?? erro) });
  }
}
const registro = { novas: detalhes, sumidas, antes: foto.planos.length, depois: planos.length };
if (sumidas.length) {
  terminar(5, `Depois da criação: ${sumidas.length} trilha(s) de antes sumiu(ram) (${sumidas.map((plano) => `"${plano.titulo}"`).join(', ')}); nada foi apagado.`, { caso: 'trilha-sumiu', ...registro });
}
if (novas.length === 0) {
  terminar(0, 'Depois da criação: nenhuma trilha nova; nada a apagar.', { caso: 'nenhuma-nova', ...registro });
}
if (novas.length > 1) {
  terminar(4, `Depois da criação: ${novas.length} trilhas novas numa criação só (duplicação): ${detalhes.map((d) => `"${d.titulo}" (${d.id})`).join(', ')}. Nada foi apagado.`, { caso: 'duplicada', ...registro });
}
const nova = detalhes[0];
// Sem o detalhe, a trilha nova não está identificada: ela e o registro ficam, para quem for ver a causa.
if (nova.erro) {
  terminar(7, `Depois da criação: uma trilha nova, "${nova.titulo}" (${nova.id}), mas o detalhe dela não respondeu (${nova.erro}); nada foi apagado.`,
    { caso: 'detalhe-falhou', ...registro });
}
if (opcoes['titulo-esperado'] && nova.titulo !== opcoes['titulo-esperado']) {
  terminar(7, 'Depois da criação: a trilha nova não tem o título esperado da prova. Nada foi apagado.', { caso: 'titulo-divergente', ...registro });
}
if (!opcoes.apagar) {
  terminar(0, `Depois da criação: uma trilha nova, "${nova.titulo}" (${nova.id}); não apagada (sem --apagar).`, { caso: 'uma-nova', ...registro });
}
try {
  await cliente.apagarPlano(nova.id);
} catch (erro) {
  terminar(6, `Depois da criação: a trilha da prova, "${nova.titulo}" (${nova.id}), não foi apagada: ${erro?.codigo ?? erro?.message ?? erro}.`, { caso: 'apagar-falhou', ...registro });
}
let final;
try {
  final = (await cliente.listarPlanos()).map((plano) => plano.id);
} catch (erro) {
  terminar(8, `Depois da criação: a remoção da trilha da prova, "${nova.titulo}" (${nova.id}), foi pedida e aceita, mas a lista final não respondeu (${erro?.codigo ?? erro?.message ?? erro}): falta confirmar que ela saiu.`,
    { caso: 'remocao-sem-confirmacao', ...registro });
}
const igual = final.length === antes.size && final.every((id) => antes.has(id));
terminar(igual ? 0 : 6,
  igual ? `Depois da criação: a trilha da prova, "${nova.titulo}" (${nova.id}), foi apagada; a lista voltou à de antes (${final.length}).`
    : `Depois da criação: apagada a trilha da prova, mas a lista não voltou à de antes (${final.length} trilhas, eram ${antes.size}).`,
  { caso: igual ? 'apagada' : 'lista-diferente', final, ...registro });
