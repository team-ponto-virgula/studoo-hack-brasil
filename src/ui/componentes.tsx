import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { mensagens, textoErro } from '../mensagens/pt-BR';

export function Logo({ decorativo = false }: { decorativo?: boolean }) {
  return (
    <picture className="logo-quadro">
      <source media="(prefers-reduced-motion: reduce)" srcSet="/marca/logo-com-sorriso.svg" />
      <img className="logo" src="/marca/logo-animado.svg" width={140} height={46}
        alt={decorativo ? '' : mensagens.nome} />
    </picture>
  );
}

export function Stu() {
  return <img className="stu" src="/marca/stu-oi.svg" alt="" width={200} height={220} />;
}

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'texto';
};

export function Botao({ variante = 'primario', className = '', type = 'button', ...props }: BotaoProps) {
  return <button type={type} className={`botao botao--${variante} ${className}`} {...props} />;
}

export function AcaoPrincipal({ children }: { children: ReactNode }) {
  return <div className="acao-principal">{children}</div>;
}

export function EstadoErro({ codigo, children }: { codigo: string; children?: ReactNode }) {
  return (
    <div className="estado-erro">
      <p role="alert"><span className="sinal" aria-hidden="true">!</span>{textoErro(codigo)}</p>
      {children}
    </div>
  );
}

export function EstadoVazio({ children }: { children: ReactNode }) {
  return <p className="estado-vazio">{children}</p>;
}

export function Skeleton({ texto = mensagens.carregando }: { texto?: string }) {
  return (
    <div className="skeleton" role="status">
      <p className="somente-leitor">{texto}</p>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </div>
  );
}
