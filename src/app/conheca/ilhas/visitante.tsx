'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ErroStudoo, LIMITES_GERACAO } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../../../contratos/cliente-web';
import { textoErro } from '../../../mensagens/pt-BR';
import { textos } from '../textos';

/**
 * A ideia escolhida numa ficha da página vai para o rascunho que o app já lê e apaga ao abrir (`estudo.tsx`): a primeira tela do app abre o campo
 * "O que você quer aprender?" preenchido e com o foco. A chave é a mesma do app (um teste confere), sem importar o app inteiro para a página.
 */
export const CHAVE_IDEIA_INICIAL = 'studoo.rascunho.objetivo';

function guardarIdeia(ideia?: string) {
  if (!ideia) return;
  try { window.sessionStorage.setItem(CHAVE_IDEIA_INICIAL, ideia); } catch { /* Sem armazenamento, o app ainda abre. */ }
}

// Os botões e o formulário abrem a mesma sessão quando há dois toques antes da resposta.
let sessaoPendente: ReturnType<typeof cliente.entrarVisitante> | undefined;
function entrarComoVisitante() {
  sessaoPendente ??= cliente.entrarVisitante().finally(() => { sessaoPendente = undefined; });
  return sessaoPendente;
}

function useEntrada(ativo: boolean, comSessao: boolean) {
  const roteador = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emEnvio = useRef(false);

  async function entrar(ideia?: string) {
    if (emEnvio.current) return;
    emEnvio.current = true;
    setEnviando(true);
    setErro(null);
    try {
      if (!comSessao && ativo) await entrarComoVisitante();
      guardarIdeia(ideia);
      roteador.replace(ativo || comSessao ? '/' : '/login');
    } catch (falha) {
      setErro(textoErro(falha instanceof ErroStudoo ? falha.codigo : 'rede'));
      setEnviando(false);
      emEnvio.current = false;
    }
  }
  return { entrar, enviando, erro };
}

export function AssuntoProprio({ ativo, comSessao }: { ativo: boolean; comSessao: boolean }) {
  const campo = useRef<HTMLInputElement>(null);
  const [curto, setCurto] = useState(false);
  const { entrar, enviando, erro } = useEntrada(ativo, comSessao);

  function continuar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const assunto = campo.current?.value.trim() ?? '';
    if (assunto.length < LIMITES_GERACAO.objetivoMin) {
      setCurto(true);
      campo.current?.focus();
      return;
    }
    void entrar(assunto);
  }

  return (
    <form className="cn-assunto" aria-labelledby="cn-titulo-s3" onSubmit={continuar} noValidate>
      <label htmlFor="cn-assunto-campo" className="somente-leitor">Seu assunto de estudo</label>
      <div className="cn-assunto__linha">
        <input id="cn-assunto-campo" ref={campo} type="text" required maxLength={LIMITES_GERACAO.objetivoMax} enterKeyHint="go"
          placeholder="Ex.: astronomia" aria-invalid={curto || undefined} aria-describedby={curto ? 'cn-assunto-erro' : undefined}
          onChange={(e) => { if (curto && e.target.value.trim().length >= LIMITES_GERACAO.objetivoMin) setCurto(false); }} />
        <button type="submit" className="botao botao--primario" disabled={enviando}>{enviando ? 'Abrindo…' : ativo || comSessao ? 'Continuar' : 'Continuar no login'} <span aria-hidden="true">→</span></button>
      </div>
      {curto && <p className="cn-erro" id="cn-assunto-erro" role="alert">Escreva um assunto com pelo menos {LIMITES_GERACAO.objetivoMin} caracteres.</p>}
      {erro && <p className="cn-erro" role="alert">{erro}</p>}
    </form>
  );
}

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
  const { entrar, enviando, erro } = useEntrada(ativo, comSessao);
  const classe = `botao botao--${variante} ${className}`.trim();
  if (!ativo && !comSessao) return <Link id={id} className={classe} aria-label={ideia} title={ideia} href="/login" onClick={() => guardarIdeia(ideia)}>{icone}{rotulo && icone ? rotulo : textos.visitanteIndisponivel}</Link>;

  return (
    <>
      <button id={id} type="button" className={classe} aria-label={ideia} title={ideia} aria-busy={enviando || undefined} data-enviando={enviando || undefined} onClick={() => void entrar(ideia)}>
        {icone}{rotulo ?? (comSessao ? textos.cabecalho.abrir : textos.visitante)}
      </button>
      {erro && <p className="cn-erro" role="alert">{erro}</p>}
    </>
  );
}
