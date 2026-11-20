import { randomBytes } from "node:crypto";
import sharp from "sharp";
import type { Tema } from "@studoo/contratos";
import { conteudoValido, type PlanoInterno } from "@/dominio/aprendizado/plano";
import { banco } from "@/servidor/banco/cliente";
import type { Prisma } from "@/servidor/banco/gerado/client";
import { demoPelaChave } from "@/servidor/ia/demos";
import { processarFoto } from "./foto";
import { zerarCacheEmAlta } from "./comunidade";
import { FISICA, ORATORIA, PYTHON, SOCORROS } from "./demonstracao-trilhas";

/*
 * Conteúdo de demonstração da comunidade (spec 10, etapa C1): para o Explorar publicado não nascer vazio. Perfis
 * fictícios com o selo "Perfil de demonstração" (retratos ilustrados gerados aqui; nenhuma foto de pessoa real), as
 * trilhas prontas do modo demonstração publicadas em vários temas, e adições e valeus entre esses perfis espalhados nos
 * últimos 7 dias, para o "Em alta" ter um top. Rodar de novo renova as datas. Nada usa a IA.
 *
 * Os perfis não entram por login (sem senha, e-mail em domínio .invalid, sem código de recuperação) e só agem nas
 * trilhas de demonstração: não entram nos números de ninguém de verdade. Só roda com `STUDOO_COMUNIDADE_DEMO=1`.
 */

export const DOMINIO_DEMO = "demonstracao.studoo.invalid";

type Pessoa = { chave: string; nome: string; cor: string; resumo: string; interesses: Tema[]; retrato: Parameters<typeof retratoSvg>[0] };
type Trilha = { autor: string; id: string; plano: () => PlanoInterno; tema: Tema; legenda: string; adicoes: number; valeus: number; horas: number };

const PESSOAS: Pessoa[] = [
  { chave: "marina", nome: "Marina Costa", cor: "roxo", resumo: "Professora de música e fotógrafa de fim de semana.", interesses: ["artes"], retrato: { fundo: ["#ffd6a8", "#f59fb5"], pele: "#e0a57c", cabelo: "#2b1d16", roupa: "#6b46c1", estilo: "longo" } },
  { chave: "rafael", nome: "Rafael Nunes", cor: "azul", resumo: "Viajo sempre que dá e ensino inglês para quem vai junto.", interesses: ["idiomas", "historia"], retrato: { fundo: ["#bfe3ff", "#7fb2f0"], pele: "#c98a62", cabelo: "#1f1a17", roupa: "#1d4ed8", estilo: "curto" } },
  { chave: "lucia", nome: "Dona Lúcia", cor: "laranja", resumo: "Cozinheira de mão cheia. Ensino as receitas da família.", interesses: ["culinaria"], retrato: { fundo: ["#ffe7c2", "#ffc27a"], pele: "#8d5a3b", cabelo: "#d9d4cf", roupa: "#b25400", estilo: "coque" } },
  { chave: "tiago", nome: "Tiago Ramos", cor: "verde", resumo: "Matemática e física sem medo, com exemplos de todo dia.", interesses: ["matematica", "ciencias"], retrato: { fundo: ["#c9f2d8", "#7fd1a8"], pele: "#f1c7a5", cabelo: "#7a3b12", roupa: "#1f7a5a", estilo: "curto" } },
  { chave: "bruna", nome: "Bruna Lima", cor: "turquesa", resumo: "Dev que adora ensinar o que acabou de aprender.", interesses: ["programacao", "carreira"], retrato: { fundo: ["#c4f1f4", "#7fd3dc"], pele: "#a86b4a", cabelo: "#151012", roupa: "#0f7c86", estilo: "longo" } },
  { chave: "carla", nome: "Carla Mendes", cor: "rosa", resumo: "Enfermeira. Quero que todo mundo saiba o básico dos primeiros socorros.", interesses: ["saude"], retrato: { fundo: ["#ffe0ef", "#f7a8c8"], pele: "#e8b48f", cabelo: "#5a2e1a", roupa: "#b83280", estilo: "coque" } },
];

/** Os pesos decidem o top: pontos = adições × 3 + valeus (cada perfil age no máximo uma vez por trilha). */
const TRILHAS: Trilha[] = [
  { autor: "marina", id: "demo-violao", plano: () => demoPelaChave("violao")!.plano, tema: "artes", legenda: "Três acordes, uma batida e você já toca a primeira música.", adicoes: 5, valeus: 5, horas: 30 },
  { autor: "rafael", id: "demo-ingles", plano: () => demoPelaChave("ingles")!.plano, tema: "idiomas", legenda: "Aeroporto, hotel e restaurante sem travar.", adicoes: 4, valeus: 5, horas: 52 },
  { autor: "lucia", id: "demo-culinaria", plano: () => demoPelaChave("culinaria")!.plano, tema: "culinaria", legenda: "Arroz soltinho, ovo no ponto e o tempero na medida.", adicoes: 4, valeus: 3, horas: 76 },
  { autor: "tiago", id: "demo-fracoes", plano: () => demoPelaChave("fracoes")!.plano, tema: "matematica", legenda: "Do inteiro à soma, com pizza e barra de chocolate.", adicoes: 3, valeus: 4, horas: 20 },
  { autor: "bruna", id: "demo-python", plano: () => PYTHON, tema: "programacao", legenda: "print, variáveis, if e for: seu primeiro programa hoje.", adicoes: 3, valeus: 2, horas: 44 },
  { autor: "marina", id: "demo-fotografia", plano: () => demoPelaChave("fotografia")!.plano, tema: "artes", legenda: "Luz, enquadramento e foco com o celular que você já tem.", adicoes: 2, valeus: 3, horas: 98 },
  { autor: "rafael", id: "demo-historia", plano: () => demoPelaChave("historia")!.plano, tema: "historia", legenda: "Da Colônia à República em seis lições.", adicoes: 2, valeus: 1, horas: 120 },
  { autor: "carla", id: "demo-socorros", plano: () => SOCORROS, tema: "saude", legenda: "O que fazer nos primeiros minutos, do 192 ao engasgo.", adicoes: 1, valeus: 3, horas: 10 },
  { autor: "tiago", id: "demo-fisica", plano: () => FISICA, tema: "ciencias", legenda: "Por que o café esfria e o cinto salva vidas.", adicoes: 1, valeus: 1, horas: 64 },
  { autor: "bruna", id: "demo-oratoria", plano: () => ORATORIA, tema: "carreira", legenda: "Começo, meio e fim, e a respiração que acalma.", adicoes: 0, valeus: 2, horas: 140 },
];

const emailDe = (chave: string) => `${chave}@${DOMINIO_DEMO}`;

/** Retrato ilustrado (formas simples, sem foto de pessoa). */
function retratoSvg(r: { fundo: [string, string]; pele: string; cabelo: string; roupa: string; estilo: "curto" | "longo" | "coque" }) {
  const cabelo = r.estilo === "curto"
    ? `<path d="M285 380c0-150 80-220 170-220s170 70 170 220c-40-70-90-110-170-110s-130 40-170 110z" fill="${r.cabelo}"/>`
    : r.estilo === "coque"
      ? `<circle cx="450" cy="190" r="70" fill="${r.cabelo}"/><path d="M285 400c-5-160 75-230 165-230s175 70 165 230c-30-90-90-130-165-130s-135 40-165 130z" fill="${r.cabelo}"/>`
      : `<path d="M270 430c-20-190 90-290 190-290 130 0 220 90 200 260-30-90-90-140-150-150-40 50-140 90-240 180z" fill="${r.cabelo}"/><path d="M630 400c40 130 20 260-40 330 60-120 60-220 40-330z" fill="${r.cabelo}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 900 900">
    <defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${r.fundo[0]}"/><stop offset="1" stop-color="${r.fundo[1]}"/></linearGradient></defs>
    <rect width="900" height="900" fill="url(#f)"/><circle cx="720" cy="170" r="90" fill="#fff" opacity="0.3"/>
    <path d="M190 900c20-190 130-290 260-290s240 100 260 290z" fill="${r.roupa}"/>
    <path d="M380 560h140v90c0 30-30 50-70 50s-70-20-70-50z" fill="${r.pele}" opacity="0.85"/>
    <ellipse cx="450" cy="420" rx="165" ry="190" fill="${r.pele}"/>${cabelo}
    <circle cx="390" cy="440" r="14" fill="#2b1d16"/><circle cx="515" cy="440" r="14" fill="#2b1d16"/>
    <path d="M405 520q45 38 92 0" fill="none" stroke="#8a3b2e" stroke-width="12" stroke-linecap="round"/>
  </svg>`;
}

/** Grava a trilha pronta como trilha do perfil (sem IA): partes e lições com os ids no formato das aceitas. */
async function gravarTrilha(usuarioId: string, id: string, plano: PlanoInterno) {
  if (await banco.planoAprendizado.findUnique({ where: { usuarioId_id: { usuarioId, id } }, select: { id: true } })) return;
  const fluxos = plano.fluxos.map(({ titulo }, i) => ({ usuarioId, id: `${id}-${i + 1}`, planoId: id, titulo, ordem: i + 1 }));
  const licoes = plano.fluxos.flatMap((fluxo, i) => fluxo.licoes.map(({ titulo, ...conteudo }, j) => {
    if (!conteudoValido(conteudo)) throw new Error(`Lição inválida na demonstração: ${titulo}`);
    return { usuarioId, id: `${fluxos[i].id}-${j + 1}`, fluxoId: fluxos[i].id, titulo, ordem: j + 1, conteudo: JSON.parse(JSON.stringify(conteudo)) as Prisma.InputJsonValue };
  }));
  await banco.$transaction([
    banco.planoAprendizado.create({ data: { usuarioId, id, titulo: plano.titulo, objetivo: plano.objetivo, origem: plano.origem } }),
    banco.fluxo.createMany({ data: fluxos }),
    banco.licao.createMany({ data: licoes }),
  ]);
}

/** Posição pseudoaleatória estável (0..1) para espalhar as datas sem depender de Math.random. */
const espalhar = (semente: number) => {
  const x = Math.sin(semente * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

export function exigirFlagDemonstracao() {
  if (process.env.STUDOO_COMUNIDADE_DEMO !== "1") throw new Error("Conteúdo de demonstração desligado: defina STUDOO_COMUNIDADE_DEMO=1.");
}

/**
 * Cria (ou renova) o conteúdo de demonstração. Idempotente: os perfis, as trilhas e os links ficam; as datas de
 * publicação e os eventos dos perfis de demonstração são refeitos a partir de agora. Eventos de pessoas de verdade nas
 * trilhas de demonstração (quem adicionou ou mandou valeu) ficam como estão.
 */
export async function criarDemonstracao(agora = new Date()) {
  exigirFlagDemonstracao();
  const ids = new Map<string, string>();
  for (const pessoa of PESSOAS) {
    const dados = { perfilNome: pessoa.nome, perfilCor: pessoa.cor, perfilResumo: pessoa.resumo, perfilInteresses: pessoa.interesses, perfilDemo: true };
    const usuario = await banco.usuario.upsert({
      where: { email: emailDe(pessoa.chave) },
      create: { email: emailDe(pessoa.chave), fuso: "America/Sao_Paulo", perfilId: randomBytes(12).toString("base64url"), ...dados },
      update: { ...dados, senhaHash: null, googleSub: null },
      select: { id: true, perfilId: true },
    });
    if (!usuario.perfilId) await banco.usuario.update({ where: { id: usuario.id }, data: { perfilId: randomBytes(12).toString("base64url") } });
    // Nenhuma sessão: perfil de demonstração não entra por login.
    await banco.sessao.deleteMany({ where: { usuarioId: usuario.id } });
    if (!(await banco.fotoPerfil.findUnique({ where: { usuarioId: usuario.id }, select: { token: true } }))) {
      const { grande, pequena } = await processarFoto(await sharp(Buffer.from(retratoSvg(pessoa.retrato))).jpeg({ quality: 90 }).toBuffer());
      await banco.fotoPerfil.create({ data: { usuarioId: usuario.id, token: randomBytes(12).toString("base64url"), grande: new Uint8Array(grande), pequena: new Uint8Array(pequena) } });
    }
    ids.set(pessoa.chave, usuario.id);
  }
  const todos = [...ids.values()];
  const codigos: string[] = [];
  for (const [indice, trilha] of TRILHAS.entries()) {
    const usuarioId = ids.get(trilha.autor)!;
    await gravarTrilha(usuarioId, trilha.id, trilha.plano());
    const publicadaEm = new Date(agora.getTime() - trilha.horas * 60 * 60_000);
    const existente = await banco.linkTrilha.findUnique({ where: { usuarioId_planoId: { usuarioId, planoId: trilha.id } }, select: { codigo: true } });
    const codigo = existente?.codigo ?? randomBytes(12).toString("base64url");
    // Os outros perfis de demonstração agem, um por vez, depois da publicação e antes de agora.
    const outros = todos.filter((id) => id !== usuarioId);
    const quando = (k: number) => new Date(publicadaEm.getTime() + espalhar(indice * 31 + k) * (agora.getTime() - publicadaEm.getTime()));
    const eventos = [
      ...outros.slice(0, trilha.adicoes).map((id, k) => ({ codigo, usuarioId: id, tipo: "adicao", criadoEm: quando(k) })),
      ...outros.slice(outros.length - trilha.valeus).map((id, k) => ({ codigo, usuarioId: id, tipo: "valeu", criadoEm: quando(k + 10) })),
    ];
    const deVerdade = existente ? await banco.planoAprendizado.count({ where: { origemCodigo: codigo, usuario: { perfilDemo: false } } }) : 0;
    const dados = { noPerfil: true, noExplorar: true, tema: trilha.tema, legenda: trilha.legenda, publicadaEm, oculta: false, adicoes: trilha.adicoes + deVerdade };
    await banco.$transaction([
      existente
        ? banco.linkTrilha.update({ where: { codigo }, data: dados })
        : banco.linkTrilha.create({ data: { codigo, usuarioId, planoId: trilha.id, ...dados } }),
      banco.eventoTrilha.deleteMany({ where: { codigo, usuarioId: { in: todos } } }),
      banco.eventoTrilha.createMany({ data: eventos }),
    ]);
    codigos.push(codigo);
  }
  // Os perfis de demonstração seguem uns aos outros (nunca alguém de verdade): o /p mostra "N seguidores".
  const seguir = todos.flatMap((seguidorId, i) => todos.filter((_, j) => j !== i && (i + j) % 3 !== 0)
    .map((seguidoId, k) => ({ seguidorId, seguidoId, criadoEm: new Date(agora.getTime() - (1 + espalhar(i * 7 + k)) * 5 * 24 * 60 * 60_000 / 2) })));
  await banco.$transaction([
    banco.seguir.deleteMany({ where: { seguidorId: { in: todos }, seguidoId: { in: todos } } }),
    banco.seguir.createMany({ data: seguir }),
  ]);
  // Moderação (spec 14): o Explorar só mostra perfil, trilha e foto aprovados, e o padrão do banco é "pendente". O conteúdo
  // de demonstração (rotulado, fictício, só com STUDOO_COMUNIDADE_DEMO=1) nasce aprovado. Fica no fim, depois de todas as
  // escritas: os gatilhos da migração voltam a decisão para "pendente" quando o texto, a legenda ou as lições mudam, e estas
  // atualizações não tocam nesses campos.
  await banco.$transaction([
    banco.usuario.updateMany({ where: { id: { in: todos } }, data: { perfilModeracao: "aprovado" } }),
    banco.fotoPerfil.updateMany({ where: { usuarioId: { in: todos } }, data: { moderacao: "aprovado" } }),
    banco.linkTrilha.updateMany({ where: { codigo: { in: codigos } }, data: { moderacao: "aprovado" } }),
  ]);
  zerarCacheEmAlta();
  return { perfis: ids.size, trilhas: codigos.length, temas: new Set(TRILHAS.map((t) => t.tema)).size };
}

/** Remove todo o conteúdo de demonstração (perfis, trilhas, links, eventos e fotos). Cópias de pessoas ficam com elas. */
export async function removerDemonstracao() {
  exigirFlagDemonstracao();
  const perfis = await banco.usuario.findMany({ where: { perfilDemo: true, email: { endsWith: `@${DOMINIO_DEMO}` } }, select: { id: true } });
  for (const { id } of perfis) {
    await banco.$transaction([
      banco.apoioLicao.deleteMany({ where: { usuarioId: id } }),
      banco.registroEstudo.deleteMany({ where: { usuarioId: id } }),
      banco.licao.deleteMany({ where: { usuarioId: id } }),
      banco.fluxo.deleteMany({ where: { usuarioId: id } }),
      banco.planoAprendizado.deleteMany({ where: { usuarioId: id } }), // links e eventos deles saem em cascata
      banco.sessao.deleteMany({ where: { usuarioId: id } }),
      banco.usuario.delete({ where: { id } }), // foto, eventos e denúncias feitas por eles saem em cascata
    ]);
  }
  zerarCacheEmAlta();
  return { perfis: perfis.length };
}
