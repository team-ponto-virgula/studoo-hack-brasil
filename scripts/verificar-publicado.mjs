// Percurso automático do site publicado (agendamento `studoo-verificar` do Dokploy, dentro do contêiner):
// login, proposta, criar trilha, errar um exercício, criar a ponte, acertar a ponte e apagar a trilha.
// Uso: node scripts/verificar-publicado.mjs
// Lê do ambiente: PORT (padrão 3000), STUDOO_ORIGEM (cabeçalho Origin; padrão o próprio endereço), STUDOO_EMAIL e
// STUDOO_SENHA. Sem dependências e sem segredo no arquivo. Uma linha por etapa (`nome: HTTP <status> ok|falhou`) e saída
// diferente de zero se qualquer etapa falhar; a trilha criada é apagada no fim, mesmo com falha no meio.
import { pathToFileURL } from "node:url";

/** Limite de cada pedido. Com IA real: proposta ~5 s, aceite até ~20 s, ponte ~7 s. */
export const LIMITES_MS = { aceite: 90_000, padrao: 45_000 };

const ABERTA_1 = "Ainda não sei responder esta pergunta.";
const ABERTA_2 = "Prefiro pular esta pergunta por enquanto.";

/** Repete a frase até ter `minimo` letras e números (o mínimo da resposta aberta não conta espaços), até 1000 caracteres. */
function frasePara(minimo, frase) {
  let texto = frase;
  while (texto.replace(/\s+/gu, "").length < minimo && texto.length < 900) texto += ` ${frase}`;
  return texto;
}

/**
 * Respostas válidas para o exercício público (sem gabarito), na ordem de tentativa. A lição pública não diz qual é a
 * certa, então a lista é montada para que pelo menos uma seja certamente errada: se a primeira acertar, a seguinte não
 * pode acertar também (ordem invertida, pares girados, o outro valor do verdadeiro ou falso). Tipo desconhecido: lista
 * vazia, e o percurso passa para o exercício seguinte da lição.
 */
export function candidatasErradas(exercicio) {
  switch (exercicio?.tipo) {
    case "multipla_escolha":
      // Só uma opção é a certa (o domínio exige gabarito único): com duas ou mais, alguma é errada.
      return (exercicio.opcoes ?? []).map(({ id }) => id);
    case "ordenar": {
      const ids = (exercicio.itens ?? []).map(({ id }) => id);
      if (ids.length < 2) return [];
      // Se a ordem mostrada for a certa, a invertida é certamente errada.
      return [ids.join(","), [...ids].reverse().join(",")];
    }
    case "associar": {
      const esquerda = (exercicio.esquerda ?? []).map(({ id }) => id);
      const direita = (exercicio.direita ?? []).map(({ id }) => id);
      if (esquerda.length < 2 || esquerda.length !== direita.length) return [];
      const comDeslocamento = (passo) => esquerda.map((id, i) => `${id}=${direita[(i + passo) % direita.length]}`).join(",");
      // Se os pares na ordem mostrada forem os certos, girar a direita uma posição erra todos.
      return [comDeslocamento(0), comDeslocamento(1)];
    }
    case "verdadeiro_falso": {
      const justificativa = exercicio.justificativas?.[0]?.id;
      if (!justificativa) return [];
      // Só um dos dois valores é o certo: com a mesma justificativa, uma das duas respostas é errada.
      return [`verdadeiro:${justificativa}`, `falso:${justificativa}`];
    }
    case "aberta": {
      const minimo = Number(exercicio.minimo) || 1;
      return [frasePara(minimo, ABERTA_1), frasePara(minimo, ABERTA_2)];
    }
    case "lacuna":
      // Sequências sem sentido: não batem com nenhuma palavra, número nem grafia aproximada do gabarito.
      return ["xqzwvk", "kkwwyyqz"];
    default:
      return [];
  }
}

/** Respostas para o desafio da ponte (sempre múltipla escolha; o verdadeiro ou falso fica coberto por precaução). */
function candidatasPonte(exercicio) {
  if (exercicio?.tipo === "verdadeiro_falso") {
    return ["verdadeiro", "falso"].flatMap((v) => (exercicio.justificativas ?? []).map(({ id }) => `${v}:${id}`));
  }
  return (exercicio?.opcoes ?? []).map((o) => (typeof o === "string" ? o : o.id ?? o.texto ?? "")).filter(Boolean);
}

/**
 * Executa o percurso e devolve `{ falhou, linhas }`. `aposCriarTrilha` e `esperaLimpezaMs` existem para os testes.
 */
export async function verificar({
  base = `http://127.0.0.1:${process.env.PORT || "3000"}`,
  origem = process.env.STUDOO_ORIGEM || base,
  email = process.env.STUDOO_EMAIL,
  senha = process.env.STUDOO_SENHA,
  limites = LIMITES_MS,
  esperaLimpezaMs = 30_000,
  intervaloLimpezaMs = 3_000,
  aposCriarTrilha,
  escrever = (linha) => console.log(linha),
} = {}) {
  const linhas = [];
  let falhou = false;
  let cookie = "";
  const etapa = (nome, status, ok, detalhe) => {
    const linha = `${nome}: HTTP ${status} ${ok ? "ok" : "falhou"}${detalhe ? ` (${detalhe})` : ""}`;
    linhas.push(linha);
    escrever(linha);
    if (!ok) falhou = true;
  };

  /** Pedido com limite próprio. Estouro e erro de rede viram status 0 com o motivo. */
  async function pedir(caminho, metodo = "GET", corpo, ms = limites.padrao) {
    const headers = { origin: origem };
    if (cookie) headers.cookie = cookie;
    if (corpo !== undefined) headers["content-type"] = "application/json";
    try {
      const resposta = await fetch(base + caminho, {
        method: metodo,
        headers,
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(ms),
      });
      const dados = await resposta.json().catch(() => ({}));
      return { status: resposta.status, ok: resposta.ok, dados, cabecalhos: resposta.headers };
    } catch (erro) {
      const tempo = erro?.name === "TimeoutError" || erro?.name === "AbortError";
      return { status: 0, ok: false, dados: {}, motivo: tempo ? `tempo esgotado: ${ms / 1000} s` : "sem conexão" };
    }
  }

  const listarPlanos = async () => {
    const r = await pedir("/api/aprendizado/planos");
    return r.ok && Array.isArray(r.dados) ? r.dados.map((p) => p.id) : null;
  };

  let planoId = "";
  let aceiteSemResposta = false;
  let planosAntes = null;
  try {
    const login = await pedir("/api/login", "POST", { email, senha });
    cookie = (login.cabecalhos?.get("set-cookie") || "").split(";")[0] || "";
    etapa("login", login.status, login.ok && Boolean(cookie), login.motivo);
    if (!login.ok || !cookie) return { falhou, linhas };

    planosAntes = await listarPlanos();

    const proposta = await pedir("/api/aprendizado/propostas", "POST", { objetivo: "Verificacao automatica Studoo" });
    const token = proposta.dados?.token || "";
    etapa("proposta", proposta.status, proposta.ok && Boolean(token), proposta.motivo);
    if (!token) return { falhou, linhas };

    const plano = await pedir("/api/aprendizado/planos", "POST", { token }, limites.aceite);
    planoId = plano.dados?.id || plano.dados?.plano?.id || "";
    const licaoId = plano.dados?.fluxos?.[0]?.licoes?.[0]?.id || "";
    aceiteSemResposta = plano.status === 0;
    etapa("criar_trilha", plano.status, plano.ok && Boolean(planoId) && Boolean(licaoId), plano.motivo);
    if (!licaoId) return { falhou, linhas };
    if (aposCriarTrilha) await aposCriarTrilha({ planoId, licaoId });

    // Errar: a primeira resposta errada e válida, do primeiro exercício que der para errar (índice 0, 1 ou 2).
    const licao = await pedir(`/api/aprendizado/licoes/${encodeURIComponent(licaoId)}`);
    const exercicios = Array.isArray(licao.dados?.exercicios) ? licao.dados.exercicios
      : licao.dados?.exercicio ? [licao.dados.exercicio] : [];
    let errou = null;
    let ultimo = licao;
    for (const [indice, exercicio] of exercicios.entries()) {
      let tentativas = 0;
      for (const resposta of candidatasErradas(exercicio)) {
        tentativas += 1;
        ultimo = await pedir(`/api/aprendizado/licoes/${encodeURIComponent(licaoId)}/avaliar`, "POST", { resposta, indice });
        if (ultimo.status === 0) break;
        if (ultimo.ok && ultimo.dados?.correta === false) {
          errou = { indice, tipo: exercicio.tipo, tentativas };
          break;
        }
      }
      if (errou || ultimo.status === 0) break;
    }
    etapa("errar_exercicio", ultimo.status, Boolean(errou), errou
      ? `exercício ${errou.indice + 1}, ${errou.tipo}, ${errou.tentativas} tentativa(s)`
      : ultimo.motivo ?? `nenhum exercício deu para errar (${exercicios.map((e) => e?.tipo).join(", ") || "sem exercícios"})`);
    if (!errou) return { falhou, linhas };

    const ponte = await pedir(`/api/estudio/licoes/${encodeURIComponent(licaoId)}/ponte`, "POST", {});
    const desafio = ponte.dados?.ponte?.exercicio || ponte.dados?.reforco?.exercicio || ponte.dados?.exercicio || {};
    etapa("criar_ponte", ponte.status, ponte.ok && Boolean(desafio.enunciado), ponte.motivo);
    if (!ponte.ok) return { falhou, linhas };

    let acertou = false;
    let avaliacao = { status: 0 };
    for (const resposta of candidatasPonte(desafio)) {
      avaliacao = await pedir(`/api/estudio/licoes/${encodeURIComponent(licaoId)}/ponte/avaliar`, "POST", { resposta });
      if (avaliacao.status === 0) break;
      if (avaliacao.ok && avaliacao.dados?.correta === true) {
        acertou = true;
        break;
      }
    }
    etapa("acertar_ponte", avaliacao.status, acertou, avaliacao.motivo);
  } finally {
    if (planoId) {
      const apagar = await pedir(`/api/aprendizado/planos/${encodeURIComponent(planoId)}`, "DELETE");
      etapa("apagar_trilha", apagar.status, apagar.ok, apagar.motivo);
    } else if (aceiteSemResposta && planosAntes) {
      // O aceite estourou o limite daqui, mas pode terminar no servidor: espera a trilha nova aparecer e apaga só se
      // for exatamente uma (com mais de uma, alguém mais está usando a conta e nada é apagado).
      let novos = [];
      for (let gasto = 0; gasto <= esperaLimpezaMs; gasto += intervaloLimpezaMs) {
        const agora = await listarPlanos();
        novos = (agora ?? []).filter((id) => !planosAntes.includes(id));
        if (novos.length) break;
        await new Promise((r) => setTimeout(r, intervaloLimpezaMs));
      }
      if (novos.length === 1) {
        const apagar = await pedir(`/api/aprendizado/planos/${encodeURIComponent(novos[0])}`, "DELETE");
        etapa("apagar_trilha", apagar.status, apagar.ok, apagar.motivo ?? "trilha do aceite que estourou o limite");
      } else {
        etapa("apagar_trilha", 0, false, novos.length ? `${novos.length} trilhas novas na conta; nenhuma apagada` : "nenhuma trilha nova para apagar");
      }
    }
  }
  return { falhou, linhas };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verificar()
    .then(({ falhou }) => {
      if (falhou) process.exitCode = 1;
    })
    .catch((erro) => {
      console.log(`erro_execucao: falhou (${erro?.message ?? erro})`);
      process.exitCode = 1;
    });
}
