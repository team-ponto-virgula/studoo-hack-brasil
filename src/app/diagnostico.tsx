'use client';

import { useEffect, useRef, useState } from 'react';
import { ErroStudoo, type PassoDiagnostico, type PerfilDiagnostico } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { Botao } from '../ui';

type Pergunta = Extract<PassoDiagnostico, { tipo: 'pergunta' }>;
const niveis = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' } as const;

export function ResumoDiagnostico({ perfil }: { perfil: PerfilDiagnostico }) {
  return <div>
    <p><strong>Ponto de partida</strong>{' '}
      {perfil.demonstrados.length ? 'Você demonstrou: ' + perfil.demonstrados.join(', ') + '.' : 'Vamos começar pelos fundamentos.'}
      {perfil.lacunas.length > 0 && ' Vamos praticar: ' + perfil.lacunas.join(', ') + '.'}
    </p>
    <p><strong>Você vai aprender</strong>{' '}{perfil.escopo} · {niveis[perfil.nivel]}</p>
  </div>;
}

export function DiagnosticoDoPedido({ objetivo, ativo, continuar, cancelar, aoDesconectar }: {
  objetivo: string;
  ativo: boolean;
  continuar: (id?: string) => void;
  cancelar: () => void;
  aoDesconectar?: () => void;
}) {
  const [passo, setPasso] = useState<PassoDiagnostico | null>(null);
  const [anteriores, setAnteriores] = useState<{ passo: Pergunta; opcao: string }[]>([]);
  const [posicaoRevisao, setPosicaoRevisao] = useState<number | null>(null);
  const exibido = posicaoRevisao === null ? passo : anteriores[posicaoRevisao]?.passo;
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(false);
  const vivo = useRef(true);
  const emCurso = useRef(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  useEffect(() => { if (ativo) titulo.current?.focus(); }, [ativo, exibido]);

  async function consultar(opcaoId?: string) {
    if (emCurso.current) return;
    emCurso.current = true;
    setOcupado(true);
    setErro(false);
    try {
      const pergunta = exibido?.tipo === 'pergunta' ? exibido : null;
      const resposta = opcaoId && pergunta
        ? await cliente.responderDiagnostico(pergunta.id, pergunta.pergunta.id, opcaoId)
        : await cliente.iniciarDiagnostico(objetivo);
      if (!vivo.current) return;
      if (opcaoId && pergunta) {
        const jaRespondida = anteriores[pergunta.numero - 1];
        if (!jaRespondida || jaRespondida.opcao !== opcaoId) {
          setAnteriores([...anteriores.slice(0, pergunta.numero - 1), { passo: pergunta, opcao: opcaoId }]);
        }
      }
      setPasso(resposta);
      setPosicaoRevisao(null);
    } catch (falha) {
      if (!vivo.current) return;
      if (aoDesconectar && falha instanceof ErroStudoo && falha.codigo === 'nao_autenticado') aoDesconectar();
      else setErro(true);
    } finally {
      emCurso.current = false;
      if (vivo.current) setOcupado(false);
    }
  }

  return <section className="painel painel--pedido" aria-labelledby="diagnostico-titulo" aria-busy={ocupado}>
    <h1 id="diagnostico-titulo" tabIndex={-1} ref={titulo}>
      {exibido?.tipo === 'pergunta' ? exibido.pergunta.enunciado : exibido?.tipo === 'resultado' ? 'Seu ponto de partida' : 'Por onde começamos?'}
    </h1>
    <p>{objetivo}</p>
    {!passo && <p>Responda algumas perguntas rápidas para ajustar a trilha ao que você quer aprender e ao que já sabe fazer.</p>}
    {ocupado && <p role="status">Preparando o próximo passo…</p>}
    {erro && <p role="alert">Não foi possível carregar a pergunta. Você pode tentar novamente ou montar a trilha direto.</p>}
    <div className="estudio-acoes">
      {!passo && <Botao disabled={ocupado} onClick={() => void consultar()}>{erro ? 'Tentar novamente' : 'Responder perguntas'}</Botao>}
      {exibido?.tipo === 'pergunta' && exibido.pergunta.opcoes.map(opcao =>
        <Botao key={opcao.id} variante="secundario" disabled={ocupado} onClick={() => void consultar(opcao.id)}>{opcao.texto}</Botao>)}
      {exibido?.tipo === 'resultado' && <>
        <ResumoDiagnostico perfil={exibido.perfil} />
        <Botao onClick={() => continuar(exibido.id)}>Montar minha trilha</Botao>
      </>}
      <Botao variante="texto" onClick={() => continuar(passo && anteriores.length ? passo.id : undefined)}>Pular perguntas</Botao>
      {(posicaoRevisao ?? anteriores.length) > 0 && <Botao variante="texto" disabled={ocupado}
        onClick={() => setPosicaoRevisao((posicaoRevisao ?? anteriores.length) - 1)}>Pergunta anterior</Botao>}
      <Botao variante="texto" onClick={cancelar}>Voltar ao pedido</Botao>
    </div>
  </section>;
}
