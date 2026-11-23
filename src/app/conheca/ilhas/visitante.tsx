'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { ErroStudoo } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../../../contratos/cliente-web';
import { textoErro } from '../../../mensagens/pt-BR';
import { textos } from '../textos';

/** A ideia escolhida numa ficha da página: a primeira tela do app a lê (e apaga) para já abrir o campo preenchido. */
export const CHAVE_IDEIA_INICIAL = 'studoo:ideia-inicial';

/**
 * "Experimentar sem conta": começa a sessão de visitante pelo mesmo caminho do botão da entrada (`/api/visitante`) e abre o app,
 * sem passar pela tela de login. Com o modo visitante desligado no servidor, o mesmo lugar leva ao login.
 */
export function BotaoVisitante({ ativo, variante, className = '', ideia, rotulo, id, icone }: {
  ativo: boolean;
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
  if (!ativo) return <Link id={id} className={classe} href="/login">{icone}{rotulo && icone ? rotulo : textos.visitanteIndisponivel}</Link>;

  async function entrar() {
    if (emEnvio.current) return;
    emEnvio.current = true;
    setEnviando(true);
    setErro(null);
    try {
      await cliente.entrarVisitante();
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
        {icone}{rotulo ?? textos.visitante}
      </button>
      {erro && <p className="cn-erro" role="alert">{textoErro(erro)}</p>}
    </>
  );
}
