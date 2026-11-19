import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import type { NomeStu } from '@studoo/contratos';
import { Mascote, type ModoAnimacaoStu } from './mascote';
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

/**
 * O Stu (spec 13): o mascote oficial, decorativo, com a classe `stu` que o CSS de cada lugar posiciona. `expressao` e
 * `tamanho` pelo mapa de troca (§A2) e o modo de animação pela emenda (§E1); sem modo, a imagem parada.
 */
export function Stu({ expressao = 'stu-feliz', tamanho = 96, animado, acontecimento, ciclos, sombra = false }: {
  expressao?: NomeStu;
  tamanho?: number;
  animado?: ModoAnimacaoStu;
  acontecimento?: string | number;
  ciclos?: number;
  sombra?: boolean;
} = {}) {
  return <Mascote expressao={expressao} tamanho={tamanho} animado={animado} acontecimento={acontecimento} ciclos={ciclos} sombra={sombra} className="stu" />;
}

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>;
  variante?: 'primario' | 'secundario' | 'texto' | 'sucesso' | 'alerta';
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
      <Stu expressao="stu-encorajador" tamanho={48} animado="uma-vez" />
      <div className="estado-erro__corpo">
        <p role="alert"><span className="sinal" aria-hidden="true">!</span>{textoErro(codigo)}</p>
        {children}
      </div>
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
