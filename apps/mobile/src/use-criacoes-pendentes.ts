import {
  aplicarConsultaDaCriacao, estadoDaConsultaQueFalhou, MAXIMO_DE_CRIACOES_PENDENTES,
  type CriacaoPendente, type EstadoCriacaoNoCliente, type PlanoDetalhe,
} from '@studoo/contratos';
import { useCallback, useRef, useState, type RefObject } from 'react';
import { FalhaMobile, type ClienteNativo } from './api-nativa';
import { abrirCriacoesNoAparelho, esquecerCriacaoNoAparelho, guardarCriacaoNoAparelho } from './criacoes-no-aparelho';

export type CriacaoAcompanhada = {
  pedido: CriacaoPendente;
  estado: EstadoCriacaoNoCliente | null;
  semRespostaSeguidas: number;
};

const acompanhar = (pedido: CriacaoPendente): CriacaoAcompanhada => ({ pedido, estado: null, semRespostaSeguidas: 0 });

export function useCriacoesPendentes(cliente: ClienteNativo, montado: RefObject<boolean>) {
  const [itens, setItens] = useState<CriacaoAcompanhada[]>([]);
  const atuais = useRef(itens);
  const carga = useRef<Promise<string | undefined> | null>(null);
  const consultas = useRef(new Map<string, Promise<EstadoCriacaoNoCliente>>());

  const atualizar = useCallback((mudar: (anteriores: CriacaoAcompanhada[]) => CriacaoAcompanhada[]) => {
    if (!montado.current) return;
    const novos = mudar(atuais.current);
    atuais.current = novos;
    setItens(novos);
  }, [montado]);

  const carregar = useCallback(() => {
    carga.current ??= (async () => {
      const conta = await cliente.contaDaSessao();
      if (!conta || !montado.current) return undefined;
      const pendentes = await abrirCriacoesNoAparelho(conta);
      atualizar(() => pendentes.reverse().map(acompanhar));
      return conta;
    })().catch(erro => { carga.current = null; throw erro; });
    return carga.current;
  }, [atualizar, cliente, montado]);

  function obter(pedidoId: string) {
    return atuais.current.find(item => item.pedido.pedidoId === pedidoId);
  }

  async function guardar(pedido: CriacaoPendente, reenvio = false) {
    const conta = await carregar();
    if (!conta || !montado.current) throw new FalhaMobile('armazenamento');
    const registro = await guardarCriacaoNoAparelho(conta, pedido, reenvio);
    atualizar(anteriores => {
      if (!registro.enviar && anteriores.some(item => item.pedido.pedidoId === pedido.pedidoId)) return anteriores;
      return [acompanhar(registro.pedido), ...anteriores.filter(item => item.pedido.pedidoId !== pedido.pedidoId)].slice(0, MAXIMO_DE_CRIACOES_PENDENTES);
    });
    return registro.enviar;
  }

  async function esquecer(pedidoId: string) {
    const conta = await carregar();
    if (conta) await esquecerCriacaoNoAparelho(conta, pedidoId);
    atualizar(anteriores => anteriores.filter(item => item.pedido.pedidoId !== pedidoId));
  }

  const aplicar = useCallback((pedido: CriacaoPendente, recebido: EstadoCriacaoNoCliente) => {
    atualizar(anteriores => anteriores.map(item => {
      if (item.pedido.pedidoId !== pedido.pedidoId || item.pedido.enviadoEm !== pedido.enviadoEm) return item;
      const estado = aplicarConsultaDaCriacao(item.estado, recebido);
      if (estado === item.estado) return item;
      const semRespostaSeguidas = estado.estado === 'desconhecido' ? item.semRespostaSeguidas + 1 : 0;
      return { ...item, estado, semRespostaSeguidas };
    }));
  }, [atualizar]);

  const consultar = useCallback((pedido: CriacaoPendente) => {
    const chave = `${pedido.pedidoId}:${pedido.enviadoEm}`;
    const emAndamento = consultas.current.get(chave);
    if (emAndamento) return emAndamento;
    const consulta = (async () => {
      let recebido: EstadoCriacaoNoCliente;
      try {
        const estado = await cliente.consultarCriacao(pedido.pedidoId);
        if (estado?.pedidoId !== pedido.pedidoId ||
            !['nao_recebido', 'em_preparo', 'pronto', 'falha'].includes(estado.estado) ||
            (estado.estado === 'pronto' && estado.plano?.id !== pedido.pedidoId) ||
            (estado.estado === 'em_preparo' && !Number.isFinite(estado.consultarEmMs))) {
          recebido = { estado: 'desconhecido', motivo: 'servidor', pedidoId: pedido.pedidoId };
        } else {
          recebido = estado;
        }
      } catch (falha) {
        recebido = estadoDaConsultaQueFalhou(pedido.pedidoId, falha);
      }
      aplicar(pedido, recebido);
      return recebido;
    })().finally(() => consultas.current.delete(chave));
    consultas.current.set(chave, consulta);
    return consulta;
  }, [aplicar, cliente]);

  return {
    itens, carregar, obter, guardar, esquecer, consultar,
    temPendencias: () => atuais.current.length > 0,
    confirmar: (pedido: CriacaoPendente, plano: PlanoDetalhe) =>
      aplicar(pedido, { estado: 'pronto', pedidoId: pedido.pedidoId, plano }),
  };
}
