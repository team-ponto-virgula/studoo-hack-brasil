import { decidirDepoisDaConsulta, type PlanoDetalhe } from '@studoo/contratos';
import { mensagens } from '@studoo/contratos/experiencia';
import type { CriacaoAcompanhada } from './use-criacoes-pendentes';

const t = mensagens.geracao;

type Acao =
  | { tipo: 'consultar' | 'entrar' | 'reenviar' | 'editar' | 'remontar' }
  | { tipo: 'tentar'; desativada?: true }
  | { tipo: 'abrir'; plano: PlanoDetalhe };

type Apresentacao = { texto: string; acao: Acao; consultarEmMs?: number };

export function apresentarRetomada({ pedido, estado, semRespostaSeguidas, esperaDoLimite }: CriacaoAcompanhada,
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
      const { causa, repetivel, aguardarSegundos, tentativas } = decisao.falha;
      if (causa === 'limite') {
        const espera = esperaDoLimite?.tentativas === tentativas ? esperaDoLimite : undefined;
        if (repetivel === true) {
          const texto = espera ? t.falhaDaCriacao.limiteLiberado : t.falhaDaCriacao.limite;
          return { texto, acao: { tipo: 'tentar' } };
        }
        const acao = { tipo: 'tentar', desativada: true } as const;
        if (aguardarSegundos === undefined || aguardarSegundos <= 0) {
          return { texto: t.falhaDaCriacao.limite, acao };
        }
        const terminaEm = espera?.terminaEm ?? agora + aguardarSegundos * 1_000;
        const restanteMs = Math.max(0, terminaEm - agora);
        return {
          texto: restanteMs > 0 ? t.falhaDaCriacao.limiteComEspera(Math.ceil(restanteMs / 1_000)) : t.falhaDaCriacao.limite,
          acao,
          consultarEmMs: restanteMs,
        };
      }
      const tipo = causa === 'seguranca' ? 'editar' : causa === 'proposta_expirada' ? 'remontar'
        : repetivel ? 'tentar' : 'consultar';
      return { texto: t.falhaDaCriacao[causa] ?? t.falhaDaCriacao.outra, acao: { tipo } };
    }
  }
}
