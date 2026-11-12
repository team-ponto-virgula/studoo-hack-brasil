'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ErroStudoo } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../../contratos/cliente-web';
import { mensagens } from '../../mensagens/pt-BR';
import { AcaoPrincipal, Botao, EstadoErro, Logo, Skeleton, Stu } from '../../ui';

export function Entrada() {
  const [verificando, setVerificando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emEnvio = useRef(false);

  useEffect(() => {
    let ativo = true;

    async function verificarSessao() {
      try {
        await cliente.sessao();
        if (ativo) window.location.replace('/');
      } catch {
        if (ativo) setVerificando(false);
      }
    }

    void verificarSessao();
    return () => { ativo = false; };
  }, []);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (emEnvio.current) return;

    const formulario = new FormData(evento.currentTarget);
    const email = formulario.get('email');
    const senha = formulario.get('senha');
    if (typeof email !== 'string' || typeof senha !== 'string') return;

    emEnvio.current = true;
    setEnviando(true);
    setErro(null);

    try {
      await cliente.login(email, senha);
      window.location.replace('/');
    } catch (falha) {
      setErro(falha instanceof ErroStudoo ? falha.codigo : 'rede');
      setEnviando(false);
      emEnvio.current = false;
    }
  }

  return (
    <div className="entrada">
      <main className="entrada-conteudo" id="conteudo-principal">
        <div className="entrada-marca"><Logo /></div>
        <div className="entrada-forma">
          <h1>{mensagens.login.titulo}</h1>
          <p className="introducao">{mensagens.login.instrucoes}</p>
          {verificando ? <Skeleton /> : (
            <form className="formulario" method="post" onSubmit={entrar} aria-busy={enviando}>
              <div className="campo">
                <label htmlFor="email">{mensagens.login.email}</label>
                <input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={enviando} />
              </div>
              <div className="campo">
                <label htmlFor="senha">{mensagens.login.senha}</label>
                <input id="senha" name="senha" type="password" autoComplete="current-password" required disabled={enviando} />
              </div>
              {erro && <EstadoErro codigo={erro} />}
              <AcaoPrincipal><Botao type="submit" disabled={enviando}>{enviando ? mensagens.login.entrando : mensagens.login.entrar}</Botao></AcaoPrincipal>
            </form>
          )}
        </div>
      </main>
      <div className="entrada-arte" aria-hidden="true">
        <div className="entrada-circulo"><Stu /></div>
      </div>
    </div>
  );
}
