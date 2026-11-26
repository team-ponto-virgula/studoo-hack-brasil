import {
  aplicarConsultaDaCriacao,
  chaveDaCriacaoPendente,
  comCriacaoPendente,
  decidirDepoisDaConsulta,
  estadoDaConsultaQueFalhou,
  lerCriacoesPendentes,
  semCriacaoPendente,
  textoDasCriacoesPendentes,
  type CausaDeFalhaDaCriacao,
  type CodigoErro,
  type CriacaoPendente,
  type EstadoCriacao,
  type EstadoCriacaoNoCliente,
  type EtapaDaCriacao,
  type PlanoDetalhe,
  type PropostaPlano,
} from '@studoo/contratos';

/*
 * A retomada da criação de trilha na web (spec 04, Retomada da criação). Sem React e sem DOM: o estudo.tsx entrega as dependências (cliente, armazenamento, relógio) e desenha o que o
 * controlador diz. O que ele faz:
 * - guarda o pedido ANTES de enviar o aceite, por conta, e só o apaga quando a criação termina (pronta, recusada ou descartada);
 * - envia o aceite e, enquanto a resposta não chega, consulta o pedido ao servidor (sem IA): "pronto" vence qualquer erro ou resposta antiga;
 * - "não recebido" logo depois de enviar pode ser corrida: reconfere por tempo limitado e só depois oferece reenviar, a um toque, com a mesma proposta e o mesmo id;
 * - consulta que não falou com o servidor deixa o estado DESCONHECIDO (nunca vira ausência): sem conexão identificada, ou sem confirmação, e segue verificando;
 * - recupera os pedidos guardados ao abrir (recarregar, voltar), e cada pedido (A e B) tem a sua vez e o seu laço, sem se misturarem.
 */

export type FaseDaCriacao = 'enviando' | 'em_preparo' | 'sem_conexao' | 'sem_confirmacao' | 'nao_chegou' | 'pronta' | 'falha';

/** A falha confirmada, como a tela precisa dela. `recebidaEm` (relógio do aparelho) deixa a tela calcular o prazo RESTANTE do limite, em vez de repetir o prazo cheio. */
export interface FalhaDaCriacao {
  codigo: CodigoErro;
  causa: CausaDeFalhaDaCriacao;
  repetivel: boolean;
  aguardarSegundos?: number;
  tentativas: number;
  recebidaEm: number;
}

export interface CriacaoEmCurso {
  pendente: CriacaoPendente;
  fase: FaseDaCriacao;
  etapa: EtapaDaCriacao | null;
  plano?: PlanoDetalhe;
  falha?: FalhaDaCriacao;
  /** A trilha foi confirmada pela consulta (a resposta do envio se perdeu), não pela resposta do envio. */
  porConsulta?: boolean;
}

export interface ArmazenamentoDaCriacao {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

export interface DependenciasDaCriacao {
  cliente: { aceitarProposta(token: string): Promise<PlanoDetalhe>; consultarCriacao(pedidoId: string): Promise<EstadoCriacao> };
  /** O identificador opaco da conta (GET /api/sessao): uma chave de armazenamento por conta. */
  conta: string;
  armazenamento: ArmazenamentoDaCriacao | null;
  /** Chamado a cada mudança, com a lista inteira (do mais antigo para o mais novo). */
  aoMudar: (criacoes: readonly CriacaoEmCurso[]) => void;
  aoPronta?: (criacao: CriacaoEmCurso) => void;
  /** A triagem de segurança recusou o pedido: a tela volta ao pedido, como sempre. */
  aoRecusada?: (criacao: CriacaoEmCurso) => void;
  aoSessaoVencida?: () => void;
  agora?: () => number;
  dormir?: (ms: number, sinal: AbortSignal) => Promise<void>;
  estaOnline?: () => boolean;
  /** Enquanto o envio não responde, a consulta só começa depois desta carência (a resposta costuma chegar sozinha). */
  carenciaDaConsultaMs?: number;
  /** A consulta que não responde neste tempo conta como "sem resposta" (não trava o laço). */
  tempoDaConsultaMs?: number;
  /** Quantas consultas seguidas sem resposta (ou quanto tempo sem confirmar) até a tela dizer "ainda não conseguimos confirmar". */
  semConfirmacaoApos?: { consultas: number; ms: number };
}

const PADRAO = {
  carenciaDaConsultaMs: 8_000,
  tempoDaConsultaMs: 12_000,
  semConfirmacaoApos: { consultas: 2, ms: 10_000 },
  /** Um pedido guardado há mais que isto sem terminar não é mais retomado (a proposta venceu há muito). */
  guardaMaximaMs: 24 * 60 * 60 * 1000,
  /** O teto do sono de um laço que espera o fim de um limite (o prazo pode ser de horas: a página acorda o laço quando reaparece). */
  esperaMaximaDoLimiteMs: 60 * 60 * 1000,
} as const;

interface Item {
  c: CriacaoEmCurso;
  enviadoEm: number;
  semResposta: number;
  ultimaConfirmacao: number;
  /** Depois de um reenvio, uma falha de tentativa anterior a esta ainda é a antiga: não vale. */
  minimoDeTentativas: number;
  acumulado: EstadoCriacaoNoCliente | null;
  parar: AbortController;
  sono: AbortController | null;
  laco: Promise<void> | null;
  final: boolean;
}

function codigoDoErro(erro: unknown): string | null {
  if (typeof erro === 'object' && erro !== null && (erro as { name?: unknown }).name === 'ErroStudoo') {
    const codigo = (erro as { codigo?: unknown }).codigo;
    return typeof codigo === 'string' ? codigo : 'falha';
  }
  return null;
}

function dormirPadrao(ms: number, sinal: AbortSignal): Promise<void> {
  return new Promise((resolver) => {
    if (sinal.aborted) { resolver(); return; }
    const fim = () => { clearTimeout(id); sinal.removeEventListener('abort', fim); resolver(); };
    const id = setTimeout(fim, ms);
    sinal.addEventListener('abort', fim, { once: true });
  });
}

export function criarControladorDeCriacoes(dependencias: DependenciasDaCriacao) {
  const d = dependencias;
  const agora = d.agora ?? (() => Date.now());
  const dormir = d.dormir ?? dormirPadrao;
  const estaOnline = d.estaOnline ?? (() => true);
  const carencia = d.carenciaDaConsultaMs ?? PADRAO.carenciaDaConsultaMs;
  const tempoDaConsulta = d.tempoDaConsultaMs ?? PADRAO.tempoDaConsultaMs;
  const semConfirmacaoApos = d.semConfirmacaoApos ?? PADRAO.semConfirmacaoApos;
  const chave = chaveDaCriacaoPendente(d.conta);
  const itens = new Map<string, Item>();
  let parado = false;

  // ---- armazenamento (por conta; qualquer falha do armazenamento deixa o controlador funcionando só na memória)
  function lerLista(): CriacaoPendente[] {
    try { return lerCriacoesPendentes(d.armazenamento?.getItem(chave)); } catch { return []; }
  }
  function gravarLista(lista: readonly CriacaoPendente[]) {
    try {
      if (lista.length === 0) d.armazenamento?.removeItem(chave);
      else d.armazenamento?.setItem(chave, textoDasCriacoesPendentes(lista));
    } catch { /* Sem armazenamento: segue só na memória. */ }
  }
  const guardar = (pendente: CriacaoPendente) => gravarLista(comCriacaoPendente(lerLista(), pendente));
  const esquecer = (pedidoId: string) => gravarLista(semCriacaoPendente(lerLista(), pedidoId));

  function lista(): CriacaoEmCurso[] {
    return [...itens.values()].map((item) => item.c).sort((a, b) => a.pendente.enviadoEm - b.pendente.enviadoEm);
  }
  function mudar(item: Item, parte: Partial<CriacaoEmCurso>) {
    item.c = { ...item.c, ...parte };
    if (!parado) d.aoMudar(lista());
  }

  // ---- o fim de uma criação
  function concluir(item: Item, plano: PlanoDetalhe, porConsulta: boolean) {
    if (item.final) return;
    item.final = true;
    item.parar.abort();
    esquecer(item.c.pendente.pedidoId);
    mudar(item, { fase: 'pronta', plano, etapa: null, falha: undefined, porConsulta });
    d.aoPronta?.(item.c);
  }
  function falhar(item: Item, falha: Omit<FalhaDaCriacao, 'recebidaEm'>, opcoes: { guardar: boolean }) {
    item.parar.abort();
    if (!opcoes.guardar) esquecer(item.c.pendente.pedidoId);
    mudar(item, { fase: 'falha', etapa: null, falha: { ...falha, recebidaEm: agora() } });
  }

  // ---- a consulta
  async function consultarSeguro(pedidoId: string): Promise<EstadoCriacaoNoCliente> {
    let relogio: ReturnType<typeof setTimeout> | undefined;
    try {
      const limite = new Promise<never>((_, rejeitar) => {
        relogio = setTimeout(() => rejeitar(Object.assign(new Error('A consulta demorou.'), { name: 'AbortError' })), tempoDaConsulta);
      });
      return await Promise.race([d.cliente.consultarCriacao(pedidoId), limite]);
    } catch (erro) {
      return estadoDaConsultaQueFalhou(pedidoId, erro);
    } finally {
      clearTimeout(relogio);
    }
  }

  function dormirDoLaco(item: Item, parar: AbortController, ms: number): Promise<void> {
    const sono = new AbortController();
    item.sono = sono;
    return dormir(ms, AbortSignal.any([parar.signal, sono.signal])).finally(() => { if (item.sono === sono) item.sono = null; });
  }

  async function acompanhar(item: Item, apos: number, parar: AbortController): Promise<void> {
    try {
      if (apos > 0) await dormirDoLaco(item, parar, apos);
      while (!item.final && !parar.signal.aborted && !parado) {
        let recebido = await consultarSeguro(item.c.pendente.pedidoId);
        if (item.final || parar.signal.aborted || parado) return;
        // Depois de um reenvio, a falha da tentativa anterior ainda está lá até o servidor registrar a nova: é o mesmo que "ainda não chegou".
        if (recebido.estado === 'falha' && recebido.tentativas < item.minimoDeTentativas) recebido = { estado: 'nao_recebido', pedidoId: recebido.pedidoId };
        const dado = recebido.estado !== 'desconhecido';
        if (dado) { item.ultimaConfirmacao = agora(); item.semResposta = 0; } else item.semResposta += 1;
        item.acumulado = aplicarConsultaDaCriacao(item.acumulado, recebido);
        const atual = item.acumulado;
        const acao = decidirDepoisDaConsulta(atual, { enviadoHaMs: agora() - item.enviadoEm, semRespostaSeguidas: Math.max(1, item.semResposta) });

        if (acao.acao === 'concluir') { concluir(item, acao.plano, true); return; }
        if (acao.acao === 'falhou') {
          const f = acao.falha;
          const falha = { codigo: f.codigo, causa: f.causa, repetivel: f.repetivel, tentativas: f.tentativas, ...(f.aguardarSegundos ? { aguardarSegundos: f.aguardarSegundos } : {}) };
          // Limite com prazo conhecido: a falha fica na tela com o prazo RESTANTE, e este laço dorme até o prazo e CONSULTA O MESMO PEDIDO de novo (nunca envia nada): o servidor diz se liberou
          // (repetível, sem prazo), se a trilha ficou pronta ou se o limite continua (com o prazo que sobrou). "Verificar status" acorda o laço antes.
          if (!f.repetivel && f.aguardarSegundos && f.aguardarSegundos > 0) {
            mudar(item, { fase: 'falha', etapa: null, falha: { ...falha, recebidaEm: agora() } });
            await dormirDoLaco(item, parar, Math.min(f.aguardarSegundos * 1000 + 500, PADRAO.esperaMaximaDoLimiteMs));
            continue;
          }
          falhar(item, falha, { guardar: true });
          return;
        }
        if (acao.acao === 'reenviar') {
          const vencida = item.c.pendente.propostaExpiraEm !== undefined && agora() >= item.c.pendente.propostaExpiraEm;
          if (vencida) falhar(item, { codigo: 'proposta_invalida', causa: 'proposta_expirada', repetivel: false, tentativas: 0 }, { guardar: false });
          else mudar(item, { fase: 'nao_chegou', etapa: null });
          return;
        }
        if (acao.acao === 'entrar') {
          d.aoSessaoVencida?.();
          return;
        }
        if (acao.acao === 'esperar') {
          mudar(item, atual.estado === 'em_preparo' ? { fase: 'em_preparo', etapa: atual.etapa } : { fase: 'enviando' });
          await dormirDoLaco(item, parar, acao.emMs);
          continue;
        }
        // Sem resposta do servidor: o estado é desconhecido. Sem rede identificada, "sem conexão"; com rede, só depois de um tempo "ainda não conseguimos confirmar".
        const semConfirmar = item.semResposta >= semConfirmacaoApos.consultas || agora() - item.ultimaConfirmacao >= semConfirmacaoApos.ms;
        if (!estaOnline()) mudar(item, { fase: 'sem_conexao' });
        else if (semConfirmar) mudar(item, { fase: 'sem_confirmacao' });
        await dormirDoLaco(item, parar, acao.emMs);
      }
    } finally {
      if (item.parar === parar) item.laco = null;
    }
  }
  function iniciarLaco(item: Item, apos: number) {
    if (item.laco || item.final || parado) return;
    if (item.parar.signal.aborted) item.parar = new AbortController();
    item.laco = acompanhar(item, apos, item.parar);
  }

  // ---- o envio
  function tratarErroDoEnvio(item: Item, erro: unknown) {
    const codigo = codigoDoErro(erro);
    const sem = { tentativas: item.c.falha?.tentativas ?? 1 };
    if (codigo === 'nao_autenticado') { item.parar.abort(); d.aoSessaoVencida?.(); return; }
    if (codigo === 'conteudo_nocivo') {
      falhar(item, { codigo: 'conteudo_nocivo', causa: 'seguranca', repetivel: false, ...sem }, { guardar: false });
      d.aoRecusada?.(item.c);
      return;
    }
    if (codigo === 'proposta_invalida') {
      falhar(item, { codigo: 'proposta_invalida', causa: 'proposta_expirada', repetivel: false, ...sem }, { guardar: false });
      return;
    }
    if (codigo === 'consentimento_ia' || codigo === 'invalido' || codigo === 'nao_encontrado') {
      // O servidor nem chegou a registrar o pedido: não há o que retomar.
      falhar(item, { codigo: codigo as CodigoErro, causa: 'outra', repetivel: true, ...sem }, { guardar: false });
      return;
    }
    // Rede (sem código) ou erro do servidor: o que houve de verdade só o servidor sabe. A consulta decide, sem esperar a carência.
    if (item.laco) item.sono?.abort();
    else iniciarLaco(item, 0);
  }

  async function enviar(item: Item) {
    item.enviadoEm = agora();
    item.semResposta = 0;
    item.ultimaConfirmacao = agora();
    item.final = false;
    if (item.parar.signal.aborted) item.parar = new AbortController();
    mudar(item, { fase: 'enviando', etapa: null, falha: undefined });
    iniciarLaco(item, carencia);
    try {
      const plano = await d.cliente.aceitarProposta(item.c.pendente.token);
      concluir(item, plano, false);
    } catch (erro) {
      if (item.final || parado) return;
      tratarErroDoEnvio(item, erro);
    }
  }

  function novoItem(pendente: CriacaoPendente, fase: FaseDaCriacao): Item {
    return {
      c: { pendente, fase, etapa: null }, enviadoEm: pendente.enviadoEm, semResposta: 0, ultimaConfirmacao: agora(), minimoDeTentativas: 0,
      acumulado: null, parar: new AbortController(), sono: null, laco: null, final: false,
    };
  }

  // ---- a interface do controlador
  return {
    criacoes: lista,

    /** Antes de o aceite sair: guarda o pedido (com a prévia, para redesenhá-la depois) e envia. */
    iniciar(proposta: PropostaPlano, intencao: 'comecar' | 'salvar'): void {
      const pedidoId = proposta.pedidoId;
      if (!pedidoId || parado) return;
      const existente = itens.get(pedidoId);
      if (existente && !existente.final && existente.c.fase !== 'falha' && existente.c.fase !== 'nao_chegou') return;
      const licoes = proposta.fluxos.reduce((total, fluxo) => total + fluxo.licoes.length, 0);
      const pendente: CriacaoPendente = {
        versao: 1, pedidoId, token: proposta.token, intencao, titulo: proposta.titulo, licoes, partes: proposta.fluxos.length, enviadoEm: agora(),
        ...(proposta.validaPorMs !== undefined ? { propostaExpiraEm: agora() + proposta.validaPorMs } : {}),
        previa: { objetivo: proposta.objetivo, origem: proposta.origem, fluxos: proposta.fluxos, ...(proposta.diagnostico ? { diagnostico: proposta.diagnostico } : {}) },
      };
      guardar(pendente);
      const item = existente ?? novoItem(pendente, 'enviando');
      item.c = { pendente, fase: 'enviando', etapa: null };
      item.acumulado = null;
      item.minimoDeTentativas = 0;
      itens.set(pedidoId, item);
      void enviar(item);
    },

    /** Ao abrir a página: retoma os pedidos guardados da conta. Cada um é consultado, sem enviar nada. */
    retomar(): void {
      if (parado) return;
      const limite = agora() - PADRAO.guardaMaximaMs;
      const guardados = lerLista();
      const validos = guardados.filter((pendente) => pendente.enviadoEm >= limite);
      if (validos.length !== guardados.length) gravarLista(validos);
      for (const pendente of validos) {
        if (itens.has(pendente.pedidoId)) continue;
        const item = novoItem(pendente, 'enviando');
        itens.set(pendente.pedidoId, item);
        iniciarLaco(item, 0);
      }
      d.aoMudar(lista());
    },

    /** "Verificar status": consulta já, o mesmo pedido, sem esperar o próximo intervalo. */
    verificar(pedidoId: string): void {
      const item = itens.get(pedidoId);
      if (!item || item.final || parado) return;
      item.semResposta = 0;
      if (item.laco) { item.sono?.abort(); return; }
      if (item.c.fase === 'falha' || item.c.fase === 'nao_chegou') mudar(item, { fase: 'enviando', falha: undefined });
      item.acumulado = null;
      iniciarLaco(item, 0);
    },

    /** "Reenviar pedido" e "Tentar de novo": o mesmo token e o mesmo pedidoId, por ação explícita da pessoa. */
    reenviar(pedidoId: string): void {
      const item = itens.get(pedidoId);
      if (!item || item.final || parado) return;
      if (item.c.fase !== 'nao_chegou' && item.c.fase !== 'falha') return;
      item.minimoDeTentativas = item.c.falha ? item.c.falha.tentativas + 1 : 0;
      item.acumulado = null;
      item.parar.abort(); // encerra o laço antigo; o envio abre um novo
      item.laco = null;
      guardar({ ...item.c.pendente, enviadoEm: agora() });
      item.c = { ...item.c, pendente: { ...item.c.pendente, enviadoEm: agora() } };
      void enviar(item);
    },

    /** Fecha o aviso (a pessoa viu o resultado ou desistiu): esquece o pedido neste aparelho. O servidor não muda. */
    descartar(pedidoId: string): void {
      const item = itens.get(pedidoId);
      if (!item) return;
      item.final = true;
      item.parar.abort();
      itens.delete(pedidoId);
      esquecer(pedidoId);
      if (!parado) d.aoMudar(lista());
    },

    /** A rede voltou ou a página reapareceu: todos os pedidos que esperam consultam já. */
    acordar(): void {
      for (const item of itens.values()) {
        if (item.final) continue;
        // Falha ou "não chegou" sem laço (esperando a pessoa) não acordam sozinhos; um laço que dorme até o fim de um limite acorda e consulta.
        if (!item.laco && (item.c.fase === 'falha' || item.c.fase === 'nao_chegou')) continue;
        item.semResposta = 0;
        if (item.laco) item.sono?.abort();
        else iniciarLaco(item, 0);
      }
    },

    /** A pessoa saiu da conta neste aparelho: nada do que era dela fica guardado. */
    esquecerTudo(): void {
      parado = true;
      for (const item of itens.values()) { item.final = true; item.parar.abort(); }
      itens.clear();
      try { d.armazenamento?.removeItem(chave); } catch { /* Sem armazenamento: nada a apagar. */ }
    },

    /** A página saiu de cena: para os laços (o que está guardado fica para a próxima abertura). */
    parar(): void {
      parado = true;
      for (const item of itens.values()) item.parar.abort();
    },
  };
}

export type ControladorDeCriacoes = ReturnType<typeof criarControladorDeCriacoes>;
