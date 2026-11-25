import type { HTMLAttributes, ReactNode } from 'react';
import { Icone } from './caminho';

/** Superfície do Studoo. O tom indica o papel, sem transformar informação em ação. */
export function CartaoStudoo({ children, tom = 'padrao', className = '', ...props }: HTMLAttributes<HTMLDivElement> & {
  tom?: 'padrao' | 'destaque' | 'sucesso' | 'alerta';
}) {
  return <div className={`jornada-cartao jornada-cartao--${tom} ${className}`} {...props}>{children}</div>;
}

/** O contexto explica onde a pessoa está; só uma ação pode acompanhar o título. */
export function CabecalhoSecao({ titulo, contexto, descricao, acao, nivel = 2, tituloId, children, className = '', ...props }: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  titulo: ReactNode;
  contexto?: string;
  descricao?: string;
  acao?: ReactNode;
  nivel?: 1 | 2 | 3;
  tituloId?: string;
}) {
  const Titulo = nivel === 1 ? 'h1' : nivel === 3 ? 'h3' : 'h2';
  return (
    <div className={`jornada-cabecalho ${className}`} {...props}>
      <div className="jornada-cabecalho__linha">
        <div className="jornada-cabecalho__texto">
          {contexto && <p className="jornada-contexto">{contexto}</p>}
          <Titulo className="jornada-cabecalho__titulo" id={tituloId}>{titulo}</Titulo>
        </div>
        {acao && <div className="jornada-cabecalho__acao">{acao}</div>}
      </div>
      {descricao && <p className="jornada-cabecalho__descricao">{descricao}</p>}
      {children}
    </div>
  );
}

const estados = {
  atual: { rotulo: 'Próximo passo', icone: 'livro' },
  concluida: { rotulo: 'Concluída', icone: 'check' },
  bloqueada: { rotulo: 'Ainda bloqueada', icone: 'cadeado' },
  disponivel: { rotulo: 'Disponível', icone: 'livro' },
} as const;

/** O estado é legível sem depender da cor ou do desenho do ícone. */
export function EstadoTrilha({ estado, rotulo, className = '', ...props }: HTMLAttributes<HTMLSpanElement> & {
  estado: keyof typeof estados;
  rotulo?: string;
}) {
  const desenho = estados[estado];
  return (
    <span className={`jornada-estado jornada-estado--${estado} ${className}`} {...props}>
      <Icone nome={desenho.icone} /><span>{rotulo ?? desenho.rotulo}</span>
    </span>
  );
}

/** Exibe somente progresso fornecido pelo produto; nunca cria etapas ou métricas. */
export function ProgressoStudoo({ concluidas, total, rotulo = 'Lições concluídas', className = '', ...props }: HTMLAttributes<HTMLDivElement> & {
  concluidas: number;
  total: number;
  rotulo?: string;
}) {
  const maximo = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const feitas = Number.isFinite(concluidas) ? Math.min(maximo, Math.max(0, Math.floor(concluidas))) : 0;
  const contagem = `${feitas} de ${maximo}`;
  return (
    <div className={`jornada-progresso ${className}`} {...props}>
      <div className="jornada-progresso__rotulo"><span>{rotulo}</span><strong>{contagem}</strong></div>
      <progress value={feitas} max={maximo || 1} aria-label={rotulo} aria-valuetext={contagem} />
    </div>
  );
}
