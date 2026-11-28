'use client';

import { mensagens } from '../mensagens/pt-BR';
import { Botao } from '../ui';
import type { CriacaoEmCurso } from './criacao-retomada';
import { apresentarCriacao, type AcaoDaCriacaoNaTela } from './criacao-textos';
import './criacoes-em-curso.css';

/**
 * Os avisos de criação de trilha (spec 04, Retomada da criação): uma trilha que segue sendo criada, que precisa de uma confirmação, que falhou ou que ficou pronta enquanto a pessoa está em
 * outra tela (digitando outro pedido, em Minhas trilhas…) ou depois de reabrir. Ficam perto do alto da tela, SEM mover o foco nem a tela da pessoa; o que mudou é anunciado uma vez, pela região viva
 * do estudo, e não aqui. Cada pedido tem o seu cartão (A e B convivem), e a prévia que está na tela não aparece aqui: ela mostra o próprio estado perto da ação.
 */
export function CriacoesEmCurso({ criacoes, agora, online, aoAcionar }: {
  criacoes: readonly CriacaoEmCurso[];
  agora: number;
  online: boolean;
  aoAcionar: (pedidoId: string, acao: AcaoDaCriacaoNaTela) => void;
}) {
  if (criacoes.length === 0) return null;
  return (
    <section className="criacoes-em-curso" aria-label={mensagens.geracao.criacoesEmCurso}>
      {criacoes.map((criacao) => {
        const a = apresentarCriacao(criacao, { agora, online });
        const preparando = criacao.fase === 'enviando' || criacao.fase === 'em_preparo';
        return (
          <article key={criacao.pendente.pedidoId} className="criacao-aviso" data-fase={criacao.fase} data-tom={a.tom} data-pedido={criacao.pendente.pedidoId}>
            <h2 className="criacao-aviso__titulo">{criacao.pendente.titulo}</h2>
            <p className="criacao-aviso__texto">{a.texto}</p>
            {a.dica && <p className="criacao-aviso__dica">{a.dica}</p>}
            <div className="criacao-aviso__acoes">
              {preparando && <Botao variante="secundario" onClick={() => aoAcionar(criacao.pendente.pedidoId, 'ver')}>{mensagens.geracao.verCriacao}</Botao>}
              {a.acoes.map((acao, i) => (
                <Botao key={acao.id} variante={i === 0 && a.tom !== 'neutro' && acao.id !== 'fechar' ? 'primario' : 'secundario'} aria-disabled={acao.desabilitada || undefined}
                  onClick={() => { if (!acao.desabilitada) aoAcionar(criacao.pendente.pedidoId, acao.id); }}>
                  {acao.rotulo}
                </Botao>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
