// Apaga, pela API, as trilhas da conta sintética que não vieram do preparo (dados-da-conferencia.json). A prova da criação
// de trilha (fluxos/criacao/90-criacao-da-trilha.yaml) acrescenta uma, e os fluxos das telas contam com as seis do preparo
// (a ordem da lista e o último cartão de Minhas trilhas, por exemplo). Entrar de novo pela API cria outra sessão e não
// derruba a do app (src/servidor/acesso/sessao.ts, entrar).
//
// Só roda contra a API do próprio computador, com IA simulada e conta `.test`, como preparar-dados.mjs.
// Uso: NODE_EXTRA_CA_CERTS=<ca.crt> node --env-file=.env --import tsx apagar-trilhas-novas.mjs \
//        --api https://127.0.0.1:3443 --dados <pasta>/dados-da-conferencia.json
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { criarClienteStudoo } from '@studoo/contratos';

const { values: opcoes } = parseArgs({
  options: {
    api: { type: 'string', default: 'https://127.0.0.1:3443' },
    dados: { type: 'string' },
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
if (!opcoes.dados) {
  console.error('Falta --dados (o dados-da-conferencia.json do preparo).');
  process.exit(2);
}

const doPreparo = new Set(JSON.parse(readFileSync(opcoes.dados, 'utf8')).trilhas.map((trilha) => trilha.id));
const { token } = await criarClienteStudoo(transporte(base)).loginNativo(email, senha);
const cliente = criarClienteStudoo(transporte(base, token));
const planos = await cliente.listarPlanos();
const novos = planos.filter((plano) => !doPreparo.has(plano.id));
for (const plano of novos) {
  await cliente.apagarPlano(plano.id);
  console.log(`Apagada: "${plano.titulo}" (${plano.id}).`);
}
console.log(`${novos.length} trilha(s) nova(s) apagada(s); ficaram ${planos.length - novos.length} (o preparo tinha ${doPreparo.size}).`);
