import { mensagens } from '../mensagens/pt-BR';
import type { CriacaoEmCurso, FalhaDaCriacao } from './criacao-retomada';

/*
 * O que a tela diz de cada fase de uma criação de trilha (spec 04, Retomada da criação): o texto perto da ação, as ações que cabem e o que o leitor de tela ouve. Pura e sem DOM, para o
 * teste conferir os textos e as ações de cada estado sem navegador. Os textos são os do contrato (`mensagens.geracao`), iguais na web e no app.
 */

export type AcaoDaCriacaoNaTela = 'verificar' | 'reenviar' | 'abrir' | 'ver' | 'montar' | 'fechar';

export interface ApresentacaoDaCriacao {
  /** O texto de estado, perto da ação. */
  texto: string;
  /** Uma explicação a mais, discreta (a espera longa: a pessoa pode sair). */
  dica?: string;
  /** O que o leitor de tela ouve quando esta fase começa (uma vez). `null` quando a fase não se anuncia sozinha. */
  anuncio: string | null;
  tom: 'neutro' | 'erro' | 'ok';
  acoes: { id: AcaoDaCriacaoNaTela; rotulo: string; desabilitada?: boolean }[];
}

const t = mensagens.geracao;
/** Depois de tanto tempo em preparo, a linha de espera avisa que a pessoa pode sair (sem prometer sucesso). */
export const ESPERA_QUE_JUSTIFICA_O_AVISO_MS = 20_000;

/** O prazo RESTANTE do limite, a partir do prazo que o servidor deu e de quando a resposta chegou (o relógio do aparelho): cai com o tempo, em vez de voltar cheio a cada consulta. */
export function segundosRestantes(falha: Pick<FalhaDaCriacao, 'aguardarSegundos' | 'recebidaEm'>, agora: number): number {
  if (!falha.aguardarSegundos) return 0;
  return Math.max(0, Math.ceil(falha.aguardarSegundos - (agora - falha.recebidaEm) / 1000));
}

export function textoDaFalha(falha: FalhaDaCriacao, agora: number): string {
  const f = t.falhaDaCriacao;
  if (falha.causa === 'limite') {
    if (falha.liberadaAposEspera) return f.limiteLiberado;
    const restante = segundosRestantes(falha, agora);
    return restante > 0 ? f.limiteComEspera(restante) : f.limite;
  }
  if (falha.causa === 'outra' && falha.codigo !== 'falha' && Object.hasOwn(mensagens.erros, falha.codigo)) {
    return mensagens.erros[falha.codigo as keyof typeof mensagens.erros] as string;
  }
  return f[falha.causa];
}

export function apresentarCriacao(c: CriacaoEmCurso, contexto: { agora: number; online: boolean }): ApresentacaoDaCriacao {
  const fechar = { id: 'fechar' as const, rotulo: t.fecharAviso };
  switch (c.fase) {
    case 'enviando':
    case 'em_preparo': {
      const texto = c.pendente.intencao === 'salvar' ? t.salvandoSuaTrilha : t.preparandoTrilha;
      const demorou = contexto.agora - c.pendente.enviadoEm >= ESPERA_QUE_JUSTIFICA_O_AVISO_MS;
      return { texto, ...(demorou ? { dica: t.aindaPreparando } : {}), anuncio: null, tom: 'neutro', acoes: [] };
    }
    case 'sem_conexao':
      return { texto: t.semConexaoVerificar, anuncio: t.semConexaoVerificar, tom: 'neutro', acoes: [{ id: 'verificar', rotulo: t.verificarStatus, desabilitada: !contexto.online }] };
    case 'sem_confirmacao':
      return { texto: t.semConfirmacao, anuncio: t.semConfirmacao, tom: 'neutro', acoes: [{ id: 'verificar', rotulo: t.verificarStatus }] };
    case 'nao_chegou':
      return { texto: t.pedidoNaoChegou, anuncio: t.pedidoNaoChegou, tom: 'erro', acoes: [{ id: 'reenviar', rotulo: t.reenviarPedido }, fechar] };
    case 'pronta': {
      if (c.pendente.intencao === 'salvar') {
        return { texto: t.trilhaSalvaPronta, anuncio: t.trilhaSalvaPronta, tom: 'ok', acoes: [{ id: 'ver', rotulo: t.abrirMinhasTrilhas }, fechar] };
      }
      return { texto: t.trilhaPronta, anuncio: t.anuncioTrilhaPronta, tom: 'ok', acoes: [{ id: 'abrir', rotulo: t.abrirLicao1 }, fechar] };
    }
    case 'falha': {
      const falha = c.falha;
      if (!falha) return { texto: t.falhaDaCriacao.outra, anuncio: t.falhaDaCriacao.outra, tom: 'erro', acoes: [fechar] };
      const texto = textoDaFalha(falha, contexto.agora);
      const anuncio = texto;
      if (falha.causa === 'proposta_expirada') return { texto, anuncio, tom: 'erro', acoes: [{ id: 'montar', rotulo: t.montarDeNovo }, fechar] };
      if (falha.causa === 'seguranca') return { texto, anuncio, tom: 'erro', acoes: [fechar] };
      // "Tentar de novo" fica SEMPRE visível na falha que pode ser repetida e só se habilita quando o SERVIDOR permite (`repetivel`): o relógio do aparelho não libera nada. No limite confirmado
      // ele aparece desativado; ao fim do prazo o laço consulta o mesmo pedido sozinho (sem botão para isso), e é a resposta que o habilita. Sem prazo conhecido, vale o campo que a API devolveu.
      if (!falha.repetivel) return { texto, anuncio, tom: 'erro', acoes: falha.causa === 'limite' ? [{ id: 'reenviar', rotulo: t.tentarDeNovo, desabilitada: true }, fechar] : [fechar] };
      return { texto, anuncio, tom: 'erro', acoes: [{ id: 'reenviar', rotulo: t.tentarDeNovo }, fechar] };
    }
  }
}
