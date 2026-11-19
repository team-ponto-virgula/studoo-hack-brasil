'use client';

import { useRouter } from 'next/navigation';

/*
 * Seguir e Novidades na web (spec 10, etapa C2): o botão Seguir (cabeçalho do /p e cartão "Quem compartilhou" do /t)
 * e a seção Novidades da tela Perfil. Sem lista pública de seguidores e sem notificação.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { type EstadoSeguir, type Novidade, type PessoaNovidade } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao, Icone } from '../ui';
import { Avatar, CHAVE_DEPOIS_DO_LOGIN, codigoDoErro, guardar } from './compartilhar';
import { tocaSons } from './sons';

const c = mensagens.comunidade;

/**
 * Botão Seguir: sem sessão leva ao login e volta ao perfil; para a própria pessoa e conta de visitante não aparece.
 * `aria-pressed` diz se segue; o resultado é anunciado numa região viva.
 */
export function BotaoSeguir({ perfilId, nome, estado, logado, aoMudar }: {
  perfilId: string;
  nome: string;
  estado?: EstadoSeguir;
  logado: boolean;
  aoMudar?: (seguidores: number) => void;
}) {
  const router = useRouter();
  const [seguindo, setSeguindo] = useState(Boolean(estado?.seguindo));
  const [ocupado, setOcupado] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  if (logado && estado && !estado.podeSeguir) return null;

  async function alternar() {
    if (!logado) {
      guardar(CHAVE_DEPOIS_DO_LOGIN, `/p/${perfilId}`);
      router.push('/login');
      return;
    }
    const ativo = !seguindo;
    if (ativo) void tocaSons.tocarEfeito('seguir');
    setOcupado(true);
    setSeguindo(ativo);
    try {
      const r = await cliente.seguir(perfilId, ativo);
      setSeguindo(r.seguindo);
      aoMudar?.(r.seguidores);
      setAnuncio(ativo ? c.passouASeguir(nome) : c.deixouDeSeguir(nome));
    } catch (falha) {
      setSeguindo(!ativo);
      setAnuncio(textoErro(codigoDoErro(falha)));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Botao variante={seguindo ? 'secundario' : 'primario'} className="botao-seguir" aria-pressed={seguindo} disabled={ocupado}
        aria-label={seguindo ? c.seguindoRotulo(nome) : c.seguirRotulo(nome)} onClick={() => void alternar()}>
        {seguindo ? <><Icone nome="check" />{c.seguindo}</> : <><Icone nome="pessoaMais" />{c.seguir}</>}
      </Botao>
      <span className="somente-leitor" role="status" aria-live="polite">{anuncio}</span>
    </>
  );
}

function Rostos({ pessoas }: { pessoas: PessoaNovidade[] }) {
  if (pessoas.length === 0) return null;
  return (
    <span className="novidade__rostos" aria-hidden="true">
      {pessoas.slice(0, 3).map((p) => <Avatar key={p.perfilId} nome={p.nome} cor={p.cor} foto={p.foto} />)}
    </span>
  );
}

function textoDaNovidade(n: Novidade): string {
  if (n.tipo === 'adicoes') return c.novidadeAdicoes(n.quantidade, n.titulo);
  const total = n.pessoas.length + n.outros;
  const quem = c.listaPessoas(n.pessoas.map((p) => p.nome), n.outros);
  if (n.tipo === 'valeus') return c.novidadeValeus(quem, total, n.titulo);
  return c.novidadeSeguidores(n.pessoas.length > 0 ? quem : null, total);
}

/** Só os nomes e o título da trilha em negrito; o resto da frase em peso normal. */
function comDestaques(texto: string, destaques: string[]): ReactNode[] {
  const partes: ReactNode[] = [];
  let resto = texto;
  let chave = 0;
  while (resto) {
    let primeiro: { i: number; d: string } | null = null;
    for (const d of destaques) {
      const i = d ? resto.indexOf(d) : -1;
      if (i >= 0 && (!primeiro || i < primeiro.i)) primeiro = { i, d };
    }
    if (!primeiro) { partes.push(resto); break; }
    if (primeiro.i > 0) partes.push(resto.slice(0, primeiro.i));
    partes.push(<strong key={chave++}>{primeiro.d}</strong>);
    resto = resto.slice(primeiro.i + primeiro.d.length);
  }
  return partes;
}

const destaquesDe = (n: Novidade) => [...('titulo' in n ? [`“${n.titulo}”`] : []), ...(n.tipo === 'adicoes' ? [] : n.pessoas.map((p) => p.nome))];

/** Novidades da dona (últimos 7 dias), agrupadas; sem novidade, uma linha discreta. Abrir a trilha leva ao mapa. */
export function NovidadesDoPerfil({ abrirPlano }: { abrirPlano: (id: string) => void }) {
  const [itens, setItens] = useState<Novidade[] | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    cliente.novidades().then((r) => { if (ativo) setItens(r.itens); }).catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, []);
  if (erro) return null;
  if (itens === null) return <div className="novidades novidades--carregando" aria-hidden="true"><span /><span /></div>;
  if (itens.length === 0) return <p className="novidades__vazio">{c.novidadesVazio}</p>;
  return (
    <section className="novidades" aria-labelledby="novidades-titulo">
      <div className="novidades__topo">
        <h2 id="novidades-titulo" className="perfil-secao__titulo">{c.novidadesTitulo}</h2>
        <span className="novidades__semana">{c.novidadesSemana}</span>
      </div>
      <ul className="novidades__lista">
        {itens.map((n, i) => (
          <li key={`${n.tipo}-${'planoId' in n ? n.planoId : 'seguidores'}-${i}`} className="novidade" data-tipo={n.tipo}>
            <span className="novidade__icone" aria-hidden="true"><Icone nome={n.tipo === 'adicoes' ? 'livro' : n.tipo === 'valeus' ? 'valeu' : 'pessoa'} /></span>
            <div className="novidade__corpo">
              {'planoId' in n
                ? <button type="button" className="novidade__texto novidade__texto--link" onClick={() => abrirPlano(n.planoId)}>{comDestaques(textoDaNovidade(n), destaquesDe(n))}</button>
                : <p className="novidade__texto">{comDestaques(textoDaNovidade(n), destaquesDe(n))}</p>}
              <span className="novidade__quando">{c.quando(n.em)}</span>
            </div>
            {n.tipo !== 'adicoes' && <Rostos pessoas={n.pessoas} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
