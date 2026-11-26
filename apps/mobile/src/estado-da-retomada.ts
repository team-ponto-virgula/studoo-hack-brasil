import { decidirDepoisDaConsulta, type PlanoDetalhe } from '@studoo/contratos';
import { mensagens } from '@studoo/contratos/experiencia';
import type { CriacaoAcompanhada } from './use-criacoes-pendentes';

const t = mensagens.geracao;

type Acao =
  | { tipo: 'consultar' | 'entrar' | 'reenviar' | 'tentar' | 'editar' | 'remontar' }
  | { tipo: 'abrir'; plano: PlanoDetalhe };

type Apresentacao = { texto: string; acao: Acao; consultarEmMs?: number };

export function apresentarRetomada({ pedido, estado, semRespostaSeguidas }: CriacaoAcompanhada,
  agora = Date.now()): Apresentacao {
  const semConfirmacao = { texto: t.semConfirmacao, acao: { tipo: 'consultar' } } as const;
  if (!estado) return { ...semConfirmacao, consultarEmMs: 0 };

  const decisao = decidirDepoisDaConsulta(estado, { enviadoHaMs: Math.max(0, agora - pedido.enviadoEm), semRespostaSeguidas });
  switch (decisao.acao) {
    case 'concluir':
      return {
        texto: pedido.intencao === 'salvar' ? t.trilhaSalvaPronta : t.trilhaPronta,
        acao: { tipo: 'abrir', plano: decisao.plano },
      };
    case 'esperar':
      return {
        ...semConfirmacao,
        texto: estado.estado === 'em_preparo'
          ? pedido.intencao === 'salvar' ? t.salvandoSuaTrilha : t.preparandoTrilha : t.semConfirmacao,
        consultarEmMs: decisao.emMs,
      };
    case 'verificar_depois':
      // A falha de transporte também cobre o prazo da consulta. Só um sinal explícito de offline autoriza esse diagnóstico.
      return { ...semConfirmacao, consultarEmMs: decisao.emMs };
    case 'entrar':
      return { ...semConfirmacao, acao: { tipo: 'entrar' } };
    case 'reenviar':
      if (pedido.propostaExpiraEm !== undefined && agora >= pedido.propostaExpiraEm) {
        return { texto: t.propostaExpirada, acao: { tipo: 'remontar' } };
      }
      return { texto: t.pedidoNaoChegou, acao: { tipo: 'reenviar' } };
    case 'falhou': {
      const { causa, repetivel, aguardarSegundos } = decisao.falha;
      if (causa === 'limite' && aguardarSegundos !== undefined && aguardarSegundos > 0) {
        return {
          texto: t.falhaDaCriacao.limiteComEspera(aguardarSegundos),
          acao: { tipo: 'consultar' },
          consultarEmMs: aguardarSegundos * 1_000,
        };
      }
      const tipo = causa === 'seguranca' ? 'editar' : causa === 'proposta_expirada' ? 'remontar'
        : repetivel ? 'tentar' : 'consultar';
      return { texto: t.falhaDaCriacao[causa] ?? t.falhaDaCriacao.outra, acao: { tipo } };
    }
  }
}
