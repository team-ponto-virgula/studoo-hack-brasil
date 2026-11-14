'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { ErroStudoo } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../../contratos/cliente-web';
import { mensagens } from '../../mensagens/pt-BR';
import { AcaoPrincipal, Botao, EstadoErro, Icone, Logo, Paisagem, Skeleton, Stu } from '../../ui';

type ErrosCampo = { email?: string; senha?: string };

const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Entrada no Studoo. O formulário confere o e-mail e a senha antes de enviar e mostra o erro no próprio campo;
 * a senha pode ser mostrada e o Caps Lock ativado é avisado. Na tela larga, a paisagem do mundo ocupa a metade direita;
 * no celular, vira uma faixa acima do título.
 */
export function Entrada() {
  const [googleDisponivel, setGoogleDisponivel] = useState(false);
  const [configuracaoCarregada, setConfiguracaoCarregada] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [errosCampo, setErrosCampo] = useState<ErrosCampo>({});
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  /** Conta os erros: a cada um, o formulário treme de novo. */
  const [tremor, setTremor] = useState(0);
  const emEnvio = useRef(false);
  const campoEmail = useRef<HTMLInputElement>(null);
  const campoSenha = useRef<HTMLInputElement>(null);

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

    const codigo = new URLSearchParams(window.location.search).get('erro');
    if (codigo && ['google_invalido', 'google_indisponivel', 'google_conta_existente'].includes(codigo)) setErro(codigo);
    void cliente.configuracaoAcesso().then(config => { if (ativo) setGoogleDisponivel(config.google); })
      .catch(() => undefined).finally(() => { if (ativo) setConfiguracaoCarregada(true); });
    void verificarSessao();
    return () => { ativo = false; };
  }, []);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (emEnvio.current) return;

    const formulario = new FormData(evento.currentTarget);
    const email = String(formulario.get('email') ?? '').trim();
    const senha = String(formulario.get('senha') ?? '');
    const erros: ErrosCampo = {};
    if (!formatoEmail.test(email)) erros.email = mensagens.login.emailInvalido;
    if (!senha) erros.senha = mensagens.login.senhaVazia;
    setErrosCampo(erros);
    if (erros.email || erros.senha) setTremor((anterior) => anterior + 1);
    if (erros.email) {
      campoEmail.current?.focus();
      return;
    }
    if (erros.senha) {
      campoSenha.current?.focus();
      return;
    }

    emEnvio.current = true;
    setEnviando(true);
    setErro(null);

    try {
      await cliente.login(email, senha);
      window.location.replace('/');
    } catch (falha) {
      setErro(falha instanceof ErroStudoo ? falha.codigo : 'rede');
      setTremor((anterior) => anterior + 1);
      setEnviando(false);
      emEnvio.current = false;
    }
  }

  function conferirCapsLock(evento: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(evento.getModifierState('CapsLock'));
  }

  function limparErro(campo: keyof ErrosCampo) {
    if (errosCampo[campo]) setErrosCampo((anteriores) => ({ ...anteriores, [campo]: undefined }));
  }

  const descricaoSenha = [capsLock && 'senha-caps', errosCampo.senha && 'senha-erro'].filter(Boolean).join(' ') || undefined;

  return (
    <div className="entrada">
      <main className="entrada-conteudo" id="conteudo-principal">
        <div className="entrada-forma">
          <header className="entrada-cabecalho">
            <Logo />
            <Paisagem compacta className="entrada-banner">
              <Stu />
            </Paisagem>
            <h1>{mensagens.login.titulo}</h1>
            <p className="introducao">{mensagens.login.instrucoes}</p>
          </header>
          {verificando ? <Skeleton /> : (
            <form className="formulario" method="post" noValidate onSubmit={entrar} aria-busy={enviando}
              data-tremor={tremor ? (tremor % 2 ? 'a' : 'b') : undefined}>
              <Botao variante="secundario" disabled={!googleDisponivel || enviando}
                onClick={() => { window.location.assign('/api/auth/google/iniciar'); }}>{mensagens.acesso.google}</Botao>
              {configuracaoCarregada && !googleDisponivel && <p className="acesso-ajuda">{mensagens.acesso.googleIndisponivel}</p>}
              <p className="acesso-divisor">{mensagens.acesso.ou}</p>
              <div className="campo">
                <label htmlFor="email">{mensagens.login.email}</label>
                <input ref={campoEmail} id="email" name="email" type="email" inputMode="email" autoComplete="username"
                  autoCapitalize="none" spellCheck={false} required disabled={enviando} aria-invalid={errosCampo.email ? true : undefined}
                  aria-describedby={errosCampo.email ? 'email-erro' : undefined} onChange={() => limparErro('email')} />
                {errosCampo.email && (
                  <p className="campo-erro" id="email-erro"><span className="sinal" aria-hidden="true">!</span>{errosCampo.email}</p>
                )}
              </div>
              <div className="campo">
                <label htmlFor="senha">{mensagens.login.senha}</label>
                <div className="campo-senha">
                  <input ref={campoSenha} id="senha" name="senha" type={mostrarSenha ? 'text' : 'password'} autoComplete="current-password"
                    autoCapitalize="none" spellCheck={false} required disabled={enviando}
                    aria-invalid={errosCampo.senha ? true : undefined} aria-describedby={descricaoSenha}
                    onChange={() => limparErro('senha')} onKeyDown={conferirCapsLock} onKeyUp={conferirCapsLock}
                    onBlur={() => setCapsLock(false)} />
                  <button type="button" className="campo-senha__alternar" aria-controls="senha" aria-pressed={mostrarSenha}
                    aria-label={mensagens.login.mostrarSenha} disabled={enviando}
                    onClick={() => setMostrarSenha((atual) => !atual)}>
                    <Icone nome={mostrarSenha ? 'olhoFechado' : 'olho'} />
                  </button>
                </div>
                {capsLock && <p className="campo-aviso" id="senha-caps">{mensagens.login.capsLock}</p>}
                {errosCampo.senha && (
                  <p className="campo-erro" id="senha-erro"><span className="sinal" aria-hidden="true">!</span>{errosCampo.senha}</p>
                )}
              </div>
              <a className="acesso-link" href="/recuperar">{mensagens.acesso.esqueci}</a>
              {erro && <EstadoErro codigo={erro} />}
              <AcaoPrincipal>
                <Botao type="submit" disabled={enviando}>
                  {enviando ? (
                    <>
                      <span className="carregando" aria-hidden="true"><span /><span /><span /></span>
                      <span className="somente-leitor">{mensagens.login.entrando}</span>
                    </>
                  ) : mensagens.login.entrar}
                </Botao>
              </AcaoPrincipal>
            </form>
          )}
        </div>
      </main>
      <div className="entrada-arte">
        <Paisagem className="entrada-paisagem">
          <div className="entrada-mensagem">
            <p className="entrada-mensagem__titulo">{mensagens.login.arteTitulo}</p>
            <p>{mensagens.login.arteTexto}</p>
          </div>
          <div className="entrada-temas" aria-hidden="true">
            {mensagens.login.temas.map((tema, indice) => (
              <span key={tema} className="entrada-tema" style={{ '--i': indice } as CSSProperties}>{tema}</span>
            ))}
          </div>
          <Stu />
        </Paisagem>
      </div>
    </div>
  );
}
