'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { ErroStudoo } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../../../contratos/cliente-web';
import { textoErro } from '../../../mensagens/pt-BR';
import { textos } from '../textos';

/**
 * A ideia escolhida numa ficha da página vai para o rascunho que o app já lê e apaga ao abrir (`estudo.tsx`): a primeira tela do app abre o campo
 * "O que você quer aprender?" preenchido e com o foco. A chave é a mesma do app (um teste confere), sem importar o app inteiro para a página.
 */
export const CHAVE_IDEIA_INICIAL = 'studoo.rascunho.objetivo';

/**
 * "Experimentar sem conta": começa a sessão de visitante pelo mesmo caminho do botão da entrada (`/api/visitante`) e abre o app,
 * sem passar pela tela de login. Com o modo visitante desligado no servidor, o mesmo lugar leva ao login. Quem JÁ tem sessão (visitante ou
 * conta) não ganha outra: criar uma trocaria o cookie de quem entrou com a conta; o botão vira "Abrir o Studoo" e abre o app com a sessão de sempre.
 */
export function BotaoVisitante({ ativo, comSessao = false, variante, className = '', ideia, rotulo, id, icone }: {
  ativo: boolean;
  comSessao?: boolean;
  variante: 'primario' | 'secundario' | 'texto';
  className?: string;
  ideia?: string;
  rotulo?: string;
  id?: string;
  /** Desenho decorativo antes do texto (as fichas do S3). */
  icone?: ReactNode;
}) {
  const roteador = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emEnvio = useRef(false);
  const classe = `botao botao--${variante} ${className}`.trim();
  if (!ativo && !comSessao) return <Link id={id} className={classe} href="/login">{icone}{rotulo && icone ? rotulo : textos.visitanteIndisponivel}</Link>;

  async function entrar() {
    if (emEnvio.current) return;
    emEnvio.current = true;
    setEnviando(true);
    setErro(null);
    try {
      if (!comSessao) await cliente.entrarVisitante();
      if (ideia) {
        try { window.sessionStorage.setItem(CHAVE_IDEIA_INICIAL, ideia); } catch { /* sem armazenamento: o campo abre vazio */ }
      }
      roteador.replace('/');
    } catch (falha) {
      setErro(falha instanceof ErroStudoo ? falha.codigo : 'rede');
      setEnviando(false);
      emEnvio.current = false;
    }
  }

  return (
    <>
      <button id={id} type="button" className={classe} aria-busy={enviando || undefined} data-enviando={enviando || undefined} onClick={() => void entrar()}>
        {icone}{rotulo ?? (comSessao ? textos.cabecalho.abrir : textos.visitante)}
      </button>
      {erro && <p className="cn-erro" role="alert">{textoErro(erro)}</p>}
    </>
  );
}
