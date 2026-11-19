// A resposta certa e uma errada do primeiro exercício da primeira lição da trilha criada pela prova da criação (fluxo 90),
// para o fluxo 95 (uma resposta errada e uma certa). A API não manda o gabarito ao app: ele vem da demonstração da IA
// simulada (src/servidor/ia/demos.ts), como no preparo (preparar-dados.mjs), cruzada com o exercício público pelo título da
// lição. Só múltipla escolha com uma opção certa: o id de cada opção vira o testID dela no app (opcao-<id>).
// A trilha é a única nova desde a fotografia de antes da fase (trilhas-antes-da-criacao.json); com zero ou duas ou mais,
// nada é escolhido.
//
// Saída: RESPOSTA_CERTA=<id> e RESPOSTA_ERRADA=<id>, uma por linha, e o que foi visto em --saida (JSON). Código 3 se não
// der para escolher sem dúvida (o motivo vai para a saída de erro), 1 se a API não responder.
// Só roda contra a API do próprio computador, com IA simulada e conta `.test`, como preparar-dados.mjs.
// Uso: NODE_EXTRA_CA_CERTS=<ca.crt> node --env-file=.env --import tsx resposta-da-prova.mjs \
//        --api https://127.0.0.1:3443 --antes <trilhas-antes-da-criacao.json> --saida <resposta-da-prova.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { criarClienteStudoo } from '@studoo/contratos';
import { DEMOS } from '../../../../src/servidor/ia/demos.ts';

const { values: opcoes } = parseArgs({
  options: {
    api: { type: 'string', default: 'https://127.0.0.1:3443' },
    antes: { type: 'string' },
    saida: { type: 'string' },
  },
});

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

function terminar(codigo, motivo, registro = {}) {
  if (opcoes.saida) writeFileSync(opcoes.saida, `${JSON.stringify({ momento: new Date().toISOString(), motivo, ...registro }, null, 2)}\n`);
  if (codigo !== 0) console.error(motivo);
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

let foto = null;
try { foto = JSON.parse(readFileSync(opcoes.antes ?? '', 'utf8')); } catch { foto = null; }
if (!foto?.base?.ok || !Array.isArray(foto.planos)) terminar(3, 'Sem a fotografia conferida de antes da fase: não dá para saber qual trilha é a da prova.');
const antes = new Set(foto.planos.map((plano) => plano.id));

let cliente;
let novas;
try {
  const { token } = await criarClienteStudoo(transporte(base)).loginNativo(email, senha);
  cliente = criarClienteStudoo(transporte(base, token));
  novas = (await cliente.listarPlanos()).filter((plano) => !antes.has(plano.id));
} catch (erro) {
  terminar(1, `A API não respondeu à lista de trilhas: ${erro?.codigo ?? erro?.message ?? erro}.`);
}
if (novas.length !== 1) terminar(3, `Há ${novas.length} trilha(s) nova(s) desde a fotografia de antes da fase; a resposta só é escolhida com exatamente uma.`);

try {
  const detalhe = await cliente.obterPlano(novas[0].id);
  const demo = DEMOS.find((candidata) => candidata.plano.titulo === detalhe.titulo);
  if (!demo) terminar(3, `A trilha nova, "${detalhe.titulo}", não é de uma demonstração da IA simulada: sem gabarito.`, { trilha: detalhe.titulo });
  const primeira = detalhe.fluxos?.[0]?.licoes?.[0];
  if (!primeira) terminar(3, `A trilha nova, "${detalhe.titulo}", não tem lição.`, { trilha: detalhe.titulo });
  const licao = await cliente.obterLicao(primeira.id);
  const publico = licao.exercicios?.[0];
  const daDemo = demo.plano.fluxos.flatMap((fluxo) => fluxo.licoes).find((candidata) => candidata.titulo === licao.titulo);
  const interno = daDemo?.exercicio;
  const registro = { trilha: detalhe.titulo, licao: licao.titulo, tipo: publico?.tipo, enunciado: publico?.enunciado };
  if (publico?.tipo !== 'multipla_escolha' || interno?.tipo !== 'multipla_escolha') {
    terminar(3, `O primeiro exercício de "${licao.titulo}" é ${publico?.tipo ?? 'nenhum'}, não múltipla escolha.`, registro);
  }
  const gabarito = Array.isArray(interno.gabarito) ? interno.gabarito : [];
  const ids = publico.opcoes.map((opcao) => opcao.id);
  const certa = gabarito.length === 1 && ids.includes(gabarito[0]) ? gabarito[0] : null;
  const errada = ids.find((id) => !gabarito.includes(id)) ?? null;
  if (!certa || !errada) terminar(3, `O gabarito de "${licao.titulo}" não bate com as opções da API (gabarito ${gabarito.join(', ') || 'vazio'}; opções ${ids.join(', ')}).`, registro);
  const texto = (id) => publico.opcoes.find((opcao) => opcao.id === id)?.texto;
  if (opcoes.saida) {
    writeFileSync(opcoes.saida, `${JSON.stringify({ momento: new Date().toISOString(), ...registro, certa: { id: certa, texto: texto(certa) }, errada: { id: errada, texto: texto(errada) } }, null, 2)}\n`);
  }
  console.log(`RESPOSTA_CERTA=${certa}`);
  console.log(`RESPOSTA_ERRADA=${errada}`);
} catch (erro) {
  terminar(1, `A API não respondeu ao detalhe da trilha ou da lição: ${erro?.codigo ?? erro?.message ?? erro}.`);
}
