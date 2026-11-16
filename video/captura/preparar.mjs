// Prepara uma conta para gravar: cria o usuário e a sessão, aceita trilhas prontas e conclui lições pelo serviço
// (sem passar pela tela). Uso: node --env-file=.env --import tsx preparar.mjs '<json>'
//   json: { "trilhas": [{ "objetivo": "Quero aprender violão do zero", "concluir": 3, "pratica": "consegui" }] }
// Saída (stdout, uma linha JSON): { token, trilhas: [{ id, titulo, licoes: [{ id, titulo, concluida }] }] }
import ambiente from '../ambiente.cjs';

const { REPO } = ambiente;
const { banco } = await import(`${REPO}/src/servidor/banco/cliente.ts`);
const { criarSessao } = await import(`${REPO}/src/servidor/acesso/sessao.ts`);
const { gerarProposta, aceitarProposta, avaliarLicao, concluirLicao } = await import(`${REPO}/src/servidor/aprendizado/servico.ts`);
const { DEMOS } = await import(`${REPO}/src/servidor/ia/demos.ts`);
const { respostaCerta } = await import(`${REPO}/src/dominio/aprendizado/plano.ts`);

const pedido = JSON.parse(process.argv[2] ?? '{"trilhas":[]}');
const usuario = await banco.usuario.create({ data: { email: `filme-${crypto.randomUUID()}@example.test`, fuso: 'America/Sao_Paulo' } });
const sessao = await criarSessao(usuario.id, 'WEB');
const internas = new Map(DEMOS.flatMap((demo) => demo.plano.fluxos.flatMap((fluxo) => fluxo.licoes.map((licao) => [licao.titulo, licao]))));
const trilhas = [];
// A lista do app mostra a mais nova primeiro: as trilhas são criadas na ordem inversa do pedido.
for (const item of [...pedido.trilhas].reverse()) {
  const plano = await aceitarProposta(usuario.id, (await gerarProposta(usuario.id, item.objetivo)).token);
  const licoes = plano.fluxos.flatMap((fluxo) => fluxo.licoes.map(({ id, titulo }) => ({ id, titulo, concluida: false })));
  for (const licao of licoes.slice(0, item.concluir ?? 0)) {
    const interna = internas.get(licao.titulo);
    if (!interna) throw new Error(`lição sem gabarito: ${licao.titulo}`);
    const exercicios = [interna.exercicio, ...(interna.extras ?? [])];
    let comprovante = null;
    for (const [indice, exercicio] of exercicios.entries()) {
      const avaliacao = await avaliarLicao(usuario.id, licao.id, respostaCerta(exercicio), indice);
      if (!avaliacao.correta) throw new Error(`gabarito não passou: ${licao.titulo} #${indice}`);
      comprovante = avaliacao.comprovante;
    }
    await concluirLicao(usuario.id, licao.id, comprovante, interna.pratica ? (item.pratica ?? 'consegui') : undefined,
      { segundos: 150 + Math.round(Math.random() * 90), acertosDePrimeira: exercicios.length, exercicios: exercicios.length });
    licao.concluida = true;
  }
  trilhas.unshift({ id: plano.id, titulo: plano.titulo, licoes });
  // Um instante entre as trilhas, para a ordem por data de criação ficar estável.
  await new Promise((ok) => setTimeout(ok, 30));
}
await banco.$disconnect();
console.log(JSON.stringify({ token: sessao.token, trilhas }));
