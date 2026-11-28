import { ESPERA_DA_GERACAO, faltaParaTrocarADica } from '@studoo/contratos';

/*
 * Regras puras da prévia da trilha. A rolagem (spec 16, item 1): quando a trilha fica pronta, a tela rola em 600 ms, com saída suave, até o nó 1 ficar no
 * centro da área livre (entre o alto e o rodapé); com movimento reduzido, vai direto. O troféu fica a uma rolagem de distância. A espera (spec 17, mudança 1, revista em 23/11):
 * a linha embaixo de "Começar a lição 1" troca de frase a cada 5 s na criação da trilha (`trocarDicasDaEspera`). Sem DOM aqui: o teste confere a conta com um relógio de brinquedo.
 */

/** A duração da rolagem até o nó 1 quando a proposta fica pronta. */
export const DURACAO_ATE_O_NO_1_MS = 600;

/** Saída suave (cúbica): começa depressa e pousa devagar. */
export function saidaSuave(fracao: number): number {
  const limitada = Math.min(1, Math.max(0, fracao));
  return 1 - (1 - limitada) ** 3;
}

/**
 * O `scrollTop` que põe o centro do nó no centro da área livre, sem passar dos limites da rolagem (mapa curto: o que der). As posições vêm do DOM:
 * `centroDoNoNaTela` e `topoDaArea` em coordenadas da janela, `rolagem` é o `scrollTop` de agora.
 */
export function rolagemParaCentrarNo(medidas: { centroDoNoNaTela: number; topoDaArea: number; alturaDaArea: number; rolagem: number; alturaDoConteudo: number }): number {
  const { centroDoNoNaTela, topoDaArea, alturaDaArea, rolagem, alturaDoConteudo } = medidas;
  const centroNoConteudo = centroDoNoNaTela - topoDaArea + rolagem;
  const alvo = centroNoConteudo - alturaDaArea / 2;
  return Math.min(Math.max(0, alvo), Math.max(0, alturaDoConteudo - alturaDaArea));
}

/** O `scrollTop` no instante `decorrido` de uma rolagem de `de` até `para` que dura `duracao` ms (movimento reduzido: `duracao` 0, já no destino). */
export function rolagemNoInstante(de: number, para: number, decorrido: number, duracao: number): number {
  if (duracao <= 0) return para;
  return de + (para - de) * saidaSuave(decorrido / duracao);
}

/** A duração da rolagem do acompanhamento (a vaga do nó que acabou de chegar vai para 60% do mapa). */
export const DURACAO_ACOMPANHAR_MS = 420;

/** O que a rolagem própria precisa de uma área rolável: a posição, o `scrollTo` (para parar uma rolagem suave nativa) e os eventos da pessoa. */
export interface AreaRolavel {
  scrollTop: number;
  scrollTo(opcoes: { top: number; behavior: 'auto' }): void;
  addEventListener(tipo: string, ouvinte: () => void, opcoes?: { passive: boolean }): void;
  removeEventListener(tipo: string, ouvinte: () => void): void;
}

/** O relógio, os quadros e a janela (para o teclado): o navegador por padrão; o teste troca por um relógio dele. */
export interface AmbienteDeRolagem {
  agora(): number;
  pedirQuadro(chamar: (agora: number) => void): number;
  cancelarQuadro(id: number): void;
  aoTeclar(ouvinte: (tecla: string) => void): () => void;
}

/** Teclas que rolam a área: se a pessoa as usa no meio da rolagem própria, a rolagem própria sai da frente. */
const TECLAS_DE_ROLAGEM = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

function ambienteDoNavegador(): AmbienteDeRolagem {
  return {
    agora: () => performance.now(),
    pedirQuadro: (chamar) => requestAnimationFrame(chamar),
    cancelarQuadro: (id) => cancelAnimationFrame(id),
    aoTeclar: (ouvinte) => {
      const tratar = (ev: KeyboardEvent) => ouvinte(ev.key);
      window.addEventListener('keydown', tratar);
      return () => window.removeEventListener('keydown', tratar);
    },
  };
}

/**
 * Rola a área até `alvo` em `duracao` ms (saída suave), quadro a quadro; com `duracao` 0, vai direto. A rolagem própria é a única que anda nesta área: antes de começar,
 * qualquer rolagem suave nativa em andamento é parada (o acompanhamento dos nós usa esta mesma função), e ela NÃO compara a posição com a do quadro anterior para saber se a
 * pessoa mexeu: quem sai da frente é a entrada da pessoa (roda, toque, clique na barra ou tecla de rolagem). Antes, a posição que mudava sozinha (a rolagem suave do
 * último nó, ainda andando quando a proposta chegava) era lida como "a pessoa mexeu", e a trilha pronta ficava no meio do mapa. `aoTerminar` roda ao chegar ou quando a
 * pessoa assume. Devolve quem cancela (sem chamar `aoTerminar`).
 */
export function rolarAte(area: AreaRolavel, alvo: number, duracao: number, aoTerminar: () => void, ambiente: AmbienteDeRolagem = ambienteDoNavegador()): () => void {
  // `auto` (sem rolagem suave no CSS desta área) é "sem animação" em todos os navegadores e para uma rolagem suave nativa que ainda ande; `instant` só existe nos mais novos.
  area.scrollTo({ top: area.scrollTop, behavior: 'auto' });
  const de = area.scrollTop;
  if (duracao <= 0 || Math.abs(alvo - de) < 1) {
    area.scrollTop = alvo;
    aoTerminar();
    return () => undefined;
  }
  const inicio = ambiente.agora();
  let quadro = 0;
  let acabou = false;
  const entradas = ['wheel', 'touchstart', 'touchmove', 'pointerdown'];
  const pararDeOuvir = ambiente.aoTeclar((tecla) => { if (TECLAS_DE_ROLAGEM.has(tecla)) pessoaAssumiu(); });
  const encerrar = () => {
    acabou = true;
    ambiente.cancelarQuadro(quadro);
    for (const tipo of entradas) area.removeEventListener(tipo, pessoaAssumiu);
    pararDeOuvir();
  };
  function pessoaAssumiu() {
    if (acabou) return;
    encerrar();
    aoTerminar();
  }
  for (const tipo of entradas) area.addEventListener(tipo, pessoaAssumiu, { passive: true });
  const passo = (agora: number) => {
    if (acabou) return;
    const decorrido = agora - inicio;
    area.scrollTop = rolagemNoInstante(de, alvo, decorrido, duracao);
    if (decorrido < duracao) { quadro = ambiente.pedirQuadro(passo); return; }
    area.scrollTop = alvo;
    encerrar();
    aoTerminar();
  };
  quadro = ambiente.pedirQuadro(passo);
  return encerrar;
}

/**
 * O IntersectionObserver entrega junto várias notificações do mesmo alvo quando a página está ocupada (celular, CPU cheia, a animação de 600 ms rodando): vale a mais nova,
 * a última, nunca a primeira. Com a primeira, o troféu que já tinha saído da tela continuava "à vista", o Stu pulava para ele depois da ida ao nó 1 e o "Ver o fim da trilha" sumia.
 */
export function entradaMaisNova<T>(entradas: readonly T[]): T | undefined {
  return entradas[entradas.length - 1];
}

/** O relógio da espera: o do navegador por padrão; o teste troca por um relógio dele. */
export interface RelogioDaEspera {
  agora(): number;
  esperar(ms: number, chamar: () => void): number;
  parar(id: number): void;
}

export const relogioDoNavegador: RelogioDaEspera = {
  agora: () => performance.now(),
  esperar: (ms, chamar) => window.setTimeout(chamar, ms),
  parar: (id) => window.clearTimeout(id),
};

/** O que a placa mostra da espera: a frase da vez (`null` é "Montando sua trilha") e se ela está sumindo (a primeira metade do efeito de 300 ms). */
export interface EstadoDaEspera {
  indice: number | null;
  saindo: boolean;
}

/**
 * Liga a troca das frases da linha de espera a partir de agora (spec 17, mudança 1, revista em 23/11): a linha embaixo do botão "Começar a lição 1" diz "Escrevendo suas lições…" por 3 s e depois, a cada
 * 5 s, a frase seguinte, em laço. Cada troca é um efeito de 300 ms: a frase some (150 ms, `saindo`) e a seguinte aparece (150 ms); com movimento reduzido, a troca é direta. Quem decide a frase da vez
 * é `qualDica(decorridoMs)`, que devolve o índice em `mensagens.geracao.dicas` (ou `null` nos 3 primeiros segundos): `dicaDaEspera` do contrato, o mesmo do app. O tempo conta desde que esta função é
 * chamada, isto é, desde que a linha aparece. O relógio dorme `faltaParaTrocarADica` e confere de novo se acordar um instante antes. Devolve quem desliga tudo (sem chamar `aoMudar`).
 */
export function trocarDicasDaEspera({ qualDica, reduzido, aoMudar, relogio = relogioDoNavegador }: {
  qualDica: (decorridoMs: number) => number | null;
  reduzido: () => boolean;
  aoMudar: (estado: EstadoDaEspera) => void;
  relogio?: RelogioDaEspera;
}): () => void {
  const inicio = relogio.agora();
  const metade = Math.round(ESPERA_DA_GERACAO.efeitoMs / 2);
  let mostrada: number | null = null;
  let proxima = 0;
  let saida = 0;
  let desligado = false;
  const agendar = () => {
    if (desligado) return;
    proxima = relogio.esperar(faltaParaTrocarADica(relogio.agora() - inicio), () => {
      if (desligado) return;
      const alvo = qualDica(relogio.agora() - inicio);
      if (alvo !== null && alvo !== mostrada) {
        if (reduzido()) {
          mostrada = alvo;
          aoMudar({ indice: alvo, saindo: false });
        } else {
          aoMudar({ indice: mostrada, saindo: true });
          saida = relogio.esperar(metade, () => {
            if (desligado) return;
            mostrada = alvo;
            aoMudar({ indice: alvo, saindo: false });
          });
        }
      }
      agendar();
    });
  };
  agendar();
  return () => {
    desligado = true;
    relogio.parar(proxima);
    relogio.parar(saida);
  };
}
