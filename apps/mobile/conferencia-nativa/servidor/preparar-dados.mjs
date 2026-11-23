// Preparo dos dados da conferência nativa: deixa a conta sintética no estado que o percurso de capturas espera, pela
// mesma API e pelo mesmo cliente do contrato que o app usa (`criarClienteStudoo`, canal do app: Bearer, sem cookie).
//
// O que faz, numa API local com IA=falsa:
//   1. entra com STUDOO_EMAIL e STUDOO_SENHA (a conta sintética do `db:seed`) e apaga as trilhas que ela já tiver;
//   2. preenche o perfil;
//   3. cria uma trilha por formato de exercício, a partir das demonstrações da IA simulada (src/servidor/ia/demos.ts), e
//      conclui lições pela API até a lição atual de cada trilha começar pelo formato pedido. As respostas certas vêm de
//      `respostaCerta`, do domínio: o percurso na tela não precisa responder nada;
//   4. cria o link de compartilhar da trilha em andamento mais recente (o cartão "Seu próximo passo");
//   5. escreve um JSON com o que foi criado e um arquivo `CHAVE=valor` com os títulos, para os fluxos do Maestro.
//
// Só roda contra o próprio computador e com conta `.test`: nunca contra um site publicado.
//
// Uso, na raiz do repositório:
//   NODE_EXTRA_CA_CERTS=ca.crt node --env-file=.env --import tsx apps/mobile/conferencia-nativa/servidor/preparar-dados.mjs \
//     --api https://127.0.0.1:3443 --saida pasta
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { criarClienteStudoo, ErroStudoo } from '@studoo/contratos';
import { candidatasErradas } from '../../../../scripts/verificar-publicado.mjs';
import { respostaCerta } from '../../../../src/dominio/aprendizado/plano.ts';
import { DEMOS } from '../../../../src/servidor/ia/demos.ts';

/**
 * Um formato por trilha, na ordem de criação. A lista de Minhas trilhas vem da mais nova para a mais antiga, e o
 * destaque "Seu próximo passo" é a primeira em andamento: a última desta lista com lições concluídas.
 * `demo` é a preferência; se a demonstração deixar de ter uma lição que começa pelo formato, outra livre assume.
 */
const FORMATOS = [
  { formato: 'ordenar', demo: 'culinaria', objetivo: 'Quero aprender a cozinhar receitas básicas' },
  { formato: 'associar', demo: 'violao', objetivo: 'Quero tocar violão do zero' },
  { formato: 'multipla_escolha', demo: 'historia', objetivo: 'História do Brasil, da Colônia à República' },
  { formato: 'verdadeiro_falso', demo: 'fracoes', objetivo: 'Quero entender frações' },
  // Ramo teste/landing-heroi: sem a trilha de fotografia, que o fluxo 88 cria do zero (sem o aviso de trilha repetida).
  { formato: 'lacuna', demo: 'ingles', objetivo: 'Inglês para viagem' },
];

/** Perfil fictício da conta sintética (nenhum dado de pessoa de verdade). */
const PERFIL = {
  nome: 'Nina Prado',
  cor: 'turquesa',
  resumo: 'Estudo um pouco por dia: idiomas, cozinha e música.',
  interesses: ['idiomas', 'artes', 'culinaria'],
};

class FalhaDoPreparo extends Error {}

const { values: opcoes } = parseArgs({
  options: {
    api: { type: 'string', default: 'https://127.0.0.1:3443' },
    saida: { type: 'string', default: '.' },
  },
});

/** O transporte do app (apps/mobile/src/api-nativa.ts), com o `fetch` do Node: sem cookie, sem Origin, token no Authorization. */
function transporte(base, token) {
  return async (caminho, pedido) => {
    const resposta = await fetch(new URL(caminho, base), {
      ...pedido,
      redirect: 'error',
      signal: AbortSignal.timeout(90_000),
      headers: { 'Cache-Control': 'no-store', ...pedido.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const corpo = resposta.status === 204 ? null : await resposta.json().catch(() => null);
    return { status: resposta.status, ok: resposta.ok, json: async () => corpo };
  };
}

/** Diz em que etapa o preparo parou e com que código da API, em vez de uma pilha de erro solta. */
async function etapa(nome, acao) {
  try {
    return await acao();
  } catch (erro) {
    if (erro instanceof FalhaDoPreparo) throw erro;
    const motivo = erro instanceof ErroStudoo ? `a API respondeu "${erro.codigo}"`
      : erro?.cause?.code ? `falha de rede (${erro.cause.code})`
        : erro instanceof Error ? erro.message : String(erro);
    throw new FalhaDoPreparo(`${nome}: ${motivo}`);
  }
}

const licoesDoPlano = (plano) => plano.fluxos.flatMap((fluxo) => fluxo.licoes);
const licoesDaDemo = (demo) => demo.plano.fluxos.flatMap((fluxo) => fluxo.licoes);
const exerciciosInternos = (licao) => [licao.exercicio, ...(licao.extras ?? [])].filter(Boolean);
/**
 * Para o seletor de texto do Maestro, que é uma expressão regular: escapa os caracteres especiais e troca cada letra
 * fora do ASCII por "." (qualquer caractere). O título continua único, e o parâmetro não depende de como a linha de
 * comando da máquina codifica acentos.
 */
const paraRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[^\x20-\x7e]/gu, '.');

/** A primeira lição da demonstração cujo primeiro exercício é do formato; -1 se não houver. */
function indiceDoFormato(demo, formato) {
  return licoesDaDemo(demo).findIndex((licao) => licao.exercicio?.tipo === formato);
}

/** Escolhe a demonstração de cada formato: a preferida, se ainda servir; senão, a primeira livre que sirva. */
function escolherDemos() {
  // Ramo teste/landing-heroi: a fotografia fica livre para o fluxo 88, nunca como substituta de outra.
  const usadas = new Set(['fotografia']);
  const escolhas = [];
  for (const pedido of FORMATOS) {
    const preferida = DEMOS.find((demo) => demo.chave === pedido.demo);
    const serve = (demo) => demo && !usadas.has(demo.chave) && indiceDoFormato(demo, pedido.formato) >= 0;
    const demo = serve(preferida) ? preferida : DEMOS.find(serve);
    if (!demo) {
      const mapa = DEMOS.map((d) => `${d.chave}: ${licoesDaDemo(d).map((l) => l.exercicio?.tipo).join(', ')}`).join(' | ');
      throw new FalhaDoPreparo(`Nenhuma demonstração livre tem lição que começa por "${pedido.formato}". Primeiros exercícios hoje: ${mapa}`);
    }
    usadas.add(demo.chave);
    // O objetivo escrito só vale para a demonstração preferida; para outra, o próprio título dela é reconhecido.
    const objetivo = demo === preferida ? pedido.objetivo : demo.plano.titulo;
    const reconhecida = DEMOS.find((d) => d.reconhecer(objetivo));
    if (reconhecida !== demo) {
      throw new FalhaDoPreparo(`O objetivo "${objetivo}" não leva à demonstração "${demo.chave}" (levou a "${reconhecida?.chave ?? 'nenhuma'}"). Ajuste FORMATOS em preparar-dados.mjs.`);
    }
    escolhas.push({ formato: pedido.formato, demo, objetivo, concluir: indiceDoFormato(demo, pedido.formato) });
  }
  return escolhas;
}

/** Conclui uma lição pela API, respondendo certo a cada exercício. Devolve os avisos, se algum exercício não bateu. */
async function concluirLicao(cliente, demo, resumoDaLicao, ordem) {
  const avisos = [];
  const licao = await cliente.obterLicao(resumoDaLicao.id);
  const daDemo = licoesDaDemo(demo).find((candidata) => candidata.titulo === licao.titulo);
  const internos = daDemo ? exerciciosInternos(daDemo) : [];
  let comprovante = '';
  let acertos = 0;
  for (const [indice, publico] of licao.exercicios.entries()) {
    const interno = internos[indice];
    // Sem o exercício na demonstração (conteúdo mudou), vale uma resposta só com a forma certa: a conclusão pede o
    // comprovante de uma avaliação, não o acerto. O aviso vai para o registro.
    const resposta = interno?.tipo === publico.tipo ? respostaCerta(interno) : candidatasErradas(publico)[0];
    if (resposta === undefined) throw new FalhaDoPreparo(`"${licao.titulo}": não sei responder um exercício do tipo "${publico.tipo}".`);
    const avaliacao = await cliente.avaliarLicao(licao.id, resposta, indice);
    if (avaliacao.correta) acertos += 1;
    else avisos.push(`"${licao.titulo}", exercício ${indice + 1} (${publico.tipo}): a resposta do preparo não foi aceita como certa.`);
    comprovante = avaliacao.comprovante;
  }
  await cliente.concluirLicao(licao.id, comprovante, licao.pratica ? 'consegui' : undefined, {
    segundos: 180 + 45 * ordem,
    acertosDePrimeira: acertos,
    exercicios: licao.exercicios.length,
  });
  return avisos;
}

async function preparar() {
  const base = new URL(opcoes.api);
  const email = process.env.STUDOO_EMAIL ?? '';
  const senha = process.env.STUDOO_SENHA ?? '';
  if (base.protocol !== 'https:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
    throw new FalhaDoPreparo('O preparo só roda contra a API do próprio computador, em HTTPS (por exemplo https://127.0.0.1:3443).');
  }
  if (process.env.IA !== 'falsa' || !email.endsWith('.test') || !senha) {
    throw new FalhaDoPreparo('O preparo pede IA=falsa e a conta sintética (STUDOO_EMAIL em domínio .test e STUDOO_SENHA) no ambiente.');
  }

  const escolhas = escolherDemos();
  const avisos = [];

  const configuracao = await etapa('Configuração de acesso', () => criarClienteStudoo(transporte(base)).configuracaoAcesso());
  if (configuracao.ia !== 'falsa') throw new FalhaDoPreparo(`A API responde com IA "${configuracao.ia}"; o preparo só segue com a IA simulada.`);
  if (!configuracao.compartilhar || !configuracao.comunidade) {
    throw new FalhaDoPreparo('A API está sem compartilhar ou sem comunidade: o percurso não teria Explorar nem Perfil. Ligue STUDOO_COMPARTILHAR=1 e STUDOO_COMUNIDADE=1.');
  }

  const { token } = await etapa('Entrada pelo canal do app', () => criarClienteStudoo(transporte(base)).loginNativo(email, senha));
  const cliente = criarClienteStudoo(transporte(base, token));

  try {
    const antigas = await etapa('Lista de trilhas', () => cliente.listarPlanos());
    for (const plano of antigas) await etapa(`Apagar a trilha antiga "${plano.titulo}"`, () => cliente.apagarPlano(plano.id));

    await etapa('Perfil', () => cliente.salvarPerfil(PERFIL.nome, PERFIL.cor, { resumo: PERFIL.resumo, interesses: PERFIL.interesses }));

    const trilhas = [];
    for (const escolha of escolhas) {
      const titulo = escolha.demo.plano.titulo;
      const proposta = await etapa(`Proposta de "${titulo}"`, () => cliente.gerarProposta(escolha.objetivo));
      if (proposta.titulo !== titulo) {
        throw new FalhaDoPreparo(`O objetivo "${escolha.objetivo}" gerou "${proposta.titulo}", e não "${titulo}".`);
      }
      const plano = await etapa(`Aceite de "${titulo}"`, () => cliente.aceitarProposta(proposta.token));
      const licoes = licoesDoPlano(plano);
      for (const [ordem, licao] of licoes.slice(0, escolha.concluir).entries()) {
        avisos.push(...await etapa(`Concluir "${licao.titulo}" em "${titulo}"`, () => concluirLicao(cliente, escolha.demo, licao, ordem)));
      }

      // Confere o que o percurso vai encontrar: o progresso e o primeiro exercício da lição atual.
      const depois = await etapa(`Conferência de "${titulo}"`, () => cliente.obterPlano(plano.id));
      const atual = licoesDoPlano(depois).find((licao) => !licao.concluida);
      if (!atual || depois.progresso.concluidas !== escolha.concluir) {
        throw new FalhaDoPreparo(`"${titulo}": esperava ${escolha.concluir} lições concluídas e uma lição atual; a API diz ${depois.progresso.concluidas} de ${depois.progresso.total}.`);
      }
      const detalhe = await etapa(`Lição atual de "${titulo}"`, () => cliente.obterLicao(atual.id));
      if (detalhe.exercicios[0]?.tipo !== escolha.formato) {
        throw new FalhaDoPreparo(`"${titulo}": a lição atual ("${atual.titulo}") começa por "${detalhe.exercicios[0]?.tipo}", e não por "${escolha.formato}".`);
      }
      trilhas.push({
        formato: escolha.formato, demo: escolha.demo.chave, id: plano.id, titulo,
        licaoAtual: atual.titulo, exercicios: detalhe.exercicios.map((exercicio) => exercicio.tipo),
        concluidas: depois.progresso.concluidas, total: depois.progresso.total, compartilhada: false,
      });
    }

    // A lista vem da mais nova para a mais antiga; o destaque é a primeira em andamento (planoInicial, em estudo.tsx).
    const lista = await etapa('Lista de trilhas', () => cliente.listarPlanos());
    const destaque = lista.find(({ progresso }) => progresso.concluidas > 0 && progresso.concluidas < progresso.total)
      ?? lista.find(({ progresso }) => progresso.concluidas < progresso.total) ?? lista[0];
    const link = await etapa(`Link de compartilhar de "${destaque.titulo}"`, () => cliente.criarLink(destaque.id));
    const doDestaque = trilhas.find((trilha) => trilha.id === destaque.id);
    if (doDestaque) doDestaque.compartilhada = true;

    const resultado = {
      api: base.origin,
      conta: { email, nome: PERFIL.nome },
      destaque: { titulo: destaque.titulo, concluidas: destaque.progresso.concluidas, total: destaque.progresso.total, codigoDoLink: link.codigo },
      ordemDaLista: lista.map((plano) => plano.titulo),
      trilhas,
      avisos,
    };

    // Uma linha `CHAVE=valor` por parâmetro dos fluxos. O título vai escapado: o seletor de texto do Maestro é regex.
    const parametros = trilhas.map((trilha) => `TRILHA_${trilha.formato.toUpperCase()}=${paraRegex(trilha.titulo)}`);

    mkdirSync(opcoes.saida, { recursive: true });
    writeFileSync(join(opcoes.saida, 'dados-da-conferencia.json'), `${JSON.stringify(resultado, null, 2)}\n`);
    writeFileSync(join(opcoes.saida, 'parametros-dos-fluxos.txt'), `${parametros.join('\n')}\n`);

    console.log(`Conta ${email}: perfil "${PERFIL.nome}" e ${trilhas.length} trilhas.`);
    for (const trilha of trilhas) {
      console.log(`- ${trilha.formato}: "${trilha.titulo}", ${trilha.concluidas} de ${trilha.total} concluídas; lição atual "${trilha.licaoAtual}" (${trilha.exercicios.join(', ')})${trilha.compartilhada ? '; compartilhada' : ''}`);
    }
    console.log(`Destaque de Minhas trilhas: "${destaque.titulo}".`);
    for (const aviso of avisos) console.log(`AVISO: ${aviso}`);
  } finally {
    // A sessão do preparo não fica aberta: o app entra com a sua.
    await cliente.logout().catch(() => undefined);
  }
}

try {
  await preparar();
} catch (erro) {
  console.error(`Preparo dos dados falhou. ${erro instanceof FalhaDoPreparo ? erro.message : erro instanceof Error ? erro.stack : String(erro)}`);
  process.exitCode = 1;
}
