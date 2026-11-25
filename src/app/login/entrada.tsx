'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ErroStudoo } from '@studoo/contratos';
import { normalizarEmailEntrada } from '@studoo/contratos/autenticacao';
import { clienteStudooWeb as cliente } from '../../contratos/cliente-web';
import { mensagens, textoErro } from '../../mensagens/pt-BR';
import { Icone } from '../../ui';
import { tocaSons } from '../sons';
import { EstruturaAcesso, GoogleAcesso, SetaAcesso } from '../acesso/componentes';

type ConfigAcessoInicial = { google: boolean; recuperacao: boolean; cadastro?: boolean; visitante: boolean };
type ErrosCampo = { email?: string; senha?: string };

/** E-mail primeiro; a mudança de etapa não consulta se uma conta existe. */
export function Entrada({ configInicial, sessaoVerificada = false }: { configInicial?: ConfigAcessoInicial; sessaoVerificada?: boolean }) {
  const router = useRouter();
  const [config, setConfig] = useState<ConfigAcessoInicial>(configInicial ?? { google: false, recuperacao: false, cadastro: false, visitante: false });
  const [verificando, setVerificando] = useState(!sessaoVerificada);
  const [etapa, setEtapa] = useState<'email' | 'senha'>('email');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [errosCampo, setErrosCampo] = useState<ErrosCampo>({});
  const [contaExcluida, setContaExcluida] = useState(false);
  const [gesto, setGesto] = useState(0);
  const campoEmail = useRef<HTMLInputElement>(null);
  const campoSenha = useRef<HTMLInputElement>(null);
  const visitanteDialogo = useRef<HTMLDialogElement>(null);
  const visitanteBotao = useRef<HTMLButtonElement>(null);
  const emEnvio = useRef(false);
  const montado = useRef(true);
  const mudarEtapaComFoco = useRef(false);

  useEffect(() => {
    montado.current = true;
    tocaSons.prepararEfeitos('entrar');
    const params = new URLSearchParams(window.location.search);
    setContaExcluida(params.get('conta') === 'excluida');
    const codigo = params.get('erro');
    if (codigo && ['google_invalido', 'google_indisponivel', 'google_conta_existente', 'nao_autenticado'].includes(codigo)) setErro(codigo);
    if (!configInicial) void cliente.configuracaoAcesso().then(c => {
      if (montado.current) setConfig({ google: c.google, recuperacao: Boolean(c.recuperacao), cadastro: Boolean(c.cadastro), visitante: Boolean(c.visitante) });
    }).catch(() => undefined);
    if (!sessaoVerificada) void cliente.sessao().then(() => {
      if (montado.current) { router.replace('/'); router.refresh(); }
    }).catch(() => { if (montado.current) setVerificando(false); });
    return () => { montado.current = false; };
  }, [configInicial, sessaoVerificada, router]);

  useEffect(() => {
    if (!mudarEtapaComFoco.current) return;
    mudarEtapaComFoco.current = false;
    (etapa === 'senha' ? campoSenha : campoEmail).current?.focus();
  }, [etapa]);

  function mudarEtapa(proxima: 'email' | 'senha') {
    if (emEnvio.current) return;
    setErrosCampo({}); setErro(null); setCapsLock(false);
    mudarEtapaComFoco.current = true;
    setEtapa(proxima); setGesto(g => g + 1);
  }
  function limparErro(campo: keyof ErrosCampo) {
    setErrosCampo(atual => ({ ...atual, [campo]: undefined }));
    setErro(null);
  }
  function conferirCapsLock(evento: KeyboardEvent<HTMLInputElement>) { setCapsLock(evento.getModifierState('CapsLock')); }

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (emEnvio.current) return;
    const normalizado = normalizarEmailEntrada(email);
    if (!normalizado) {
      if (etapa !== 'email') mudarEtapa('email');
      setErrosCampo({ email: mensagens.login.emailInvalido });
      campoEmail.current?.focus();
      return;
    }
    setEmail(normalizado);
    if (etapa === 'email') { mudarEtapa('senha'); return; }
    if (!senha) { setErrosCampo({ senha: mensagens.login.senhaVazia }); campoSenha.current?.focus(); return; }
    emEnvio.current = true; setEnviando(true); setErro(null); setErrosCampo({});
    let navegando = false;
    try {
      await cliente.login(normalizado, senha);
      if (!montado.current) return;
      setSenha(''); void tocaSons.tocarEfeito('entrar');
      navegando = true;
      router.replace('/'); router.refresh();
    } catch (falha) {
      if (!montado.current) return;
      const codigo = falha instanceof ErroStudoo ? falha.codigo : 'rede';
      setErro(codigo);
      if (codigo === 'credenciais_invalidas') { setSenha(''); campoSenha.current?.focus(); }
    } finally {
      if (!navegando) {
        emEnvio.current = false;
        if (montado.current) setEnviando(false);
      }
    }
  }

  function abrirGoogle() {
    if (emEnvio.current) return;
    emEnvio.current = true; setEnviando(true);
    window.location.assign('/api/auth/google/iniciar');
  }
  async function experimentarSemConta() {
    if (emEnvio.current) return;
    emEnvio.current = true; setEnviando(true); setErro(null);
    let navegando = false;
    try {
      await cliente.entrarVisitante();
      if (!montado.current) return;
      visitanteDialogo.current?.close();
      navegando = true;
      router.replace('/'); router.refresh();
    } catch (falha) {
      if (montado.current) setErro(falha instanceof ErroStudoo ? falha.codigo : 'rede');
    } finally {
      if (!navegando) {
        emEnvio.current = false;
        if (montado.current) setEnviando(false);
      }
    }
  }
  const descricaoSenha = [capsLock && 'senha-caps', errosCampo.senha && 'senha-erro'].filter(Boolean).join(' ') || undefined;

  return <EstruturaAcesso gesto={gesto} ocupado={enviando} voltar={() => etapa === 'senha' ? mudarEtapa('email') : router.push('/boas-vindas')}>
    <section aria-labelledby="acesso-titulo">
      <div key={etapa} className="acesso__entrada-etapa">
        <h1 id="acesso-titulo" className="acesso__titulo">{etapa === 'senha' ? 'Sua senha.' : 'Olá de novo.'}</h1>
        <p className="acesso__descricao">{etapa === 'senha' ? 'Use a senha da sua conta Studoo.' : 'Entre para continuar aprendendo.'}</p>
      </div>
      {verificando ? <p className="acesso__estado" role="status">Verificando seu acesso…</p> : <>
        <form className="acesso__formulario" noValidate method="post" onSubmit={entrar} aria-busy={enviando}>
          <div hidden={etapa !== 'email'} className="acesso__campo">
            <label htmlFor="email">{mensagens.login.email}</label>
            <input ref={campoEmail} id="email" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
              value={email} onChange={e => { setEmail(e.target.value); limparErro('email'); }} placeholder="voce@exemplo.com" maxLength={254}
              required disabled={enviando} aria-invalid={Boolean(errosCampo.email)} aria-describedby={errosCampo.email ? 'email-erro' : undefined} />
            {errosCampo.email && <p className="acesso__erro" id="email-erro" role="alert">{errosCampo.email}</p>}
          </div>
          <div hidden={etapa !== 'senha'} className="acesso__entrada-etapa">
            <div className="acesso__email-contexto"><span>{email}</span><button className="acesso__texto" type="button" disabled={enviando} onClick={() => mudarEtapa('email')}>Alterar</button></div>
            <div className="acesso__senha-rotulo"><label htmlFor="senha">{mensagens.login.senha}</label>
              {config.recuperacao && <Link className="acesso__texto" href="/recuperar" onClick={e => {
                if (emEnvio.current) { e.preventDefault(); return; }
                try { sessionStorage.setItem('studoo.recuperar.email', email.trim()); } catch { /* A recuperação funciona sem armazenamento. */ }
              }}>{mensagens.acesso.esqueci}</Link>}
            </div>
            <div className="acesso__senha">
              <input ref={campoSenha} id="senha" name="senha" type={mostrarSenha ? 'text' : 'password'} autoComplete="current-password" autoCapitalize="none" spellCheck={false}
                value={senha} onChange={e => { setSenha(e.target.value); limparErro('senha'); }} onKeyDown={conferirCapsLock} onKeyUp={conferirCapsLock} onBlur={() => setCapsLock(false)}
                required disabled={enviando || etapa !== 'senha'} aria-invalid={Boolean(errosCampo.senha)} aria-describedby={descricaoSenha} placeholder="Sua senha" />
              <button type="button" className="acesso__olho" aria-controls="senha" aria-pressed={mostrarSenha} aria-label={mostrarSenha ? 'Ocultar senha' : mensagens.login.mostrarSenha}
                disabled={enviando} onClick={() => setMostrarSenha(atual => !atual)}><Icone nome={mostrarSenha ? 'olhoFechado' : 'olho'} /></button>
            </div>
            {capsLock && <p className="acesso__aviso" id="senha-caps">{mensagens.login.capsLock}</p>}
            {errosCampo.senha && <p className="acesso__erro" id="senha-erro" role="alert">{errosCampo.senha}</p>}
          </div>
          {erro && !visitanteDialogo.current?.open && <p className="acesso__erro" role="alert">{textoErro(erro)}</p>}
          <button className="acesso__principal" type="submit" disabled={enviando}><span>{enviando ? mensagens.login.entrando : etapa === 'email' ? 'Continuar' : mensagens.login.entrar}</span><SetaAcesso /></button>
          {etapa === 'senha' && <button className="acesso__outros-metodos" type="button" disabled={enviando} onClick={() => mudarEtapa('email')}>Outras formas de entrar</button>}
        </form>
        {etapa === 'email' && <>
          {config.google && <div className="acesso__social"><div className="acesso__divisor"><span>ou</span></div><GoogleAcesso ocupado={enviando} iniciar={abrirGoogle} /></div>}
          <div className="acesso__alternativas">
            {(config.cadastro || config.google) && <p className="acesso__cadastro-link">{mensagens.acesso.semConta}{' '}<Link className="acesso__texto" href="/cadastro" onClick={e => {
              if (emEnvio.current) { e.preventDefault(); return; }
              try { sessionStorage.setItem('studoo.cadastro.email', email.trim()); } catch { /* Prefill opcional. */ }
            }}>{mensagens.acesso.criarConta}</Link></p>}
            {config.visitante && <button ref={visitanteBotao} className="acesso__visitante" type="button" disabled={enviando} onClick={() => { setErro(null); visitanteDialogo.current?.showModal(); }}>{mensagens.acesso.experimentar}</button>}
          </div>
        </>}
      </>}
      {contaExcluida && <p className="acesso__aviso" role="status">{mensagens.privacidade.excluida}</p>}
    </section>
    <dialog ref={visitanteDialogo} className="acesso__dialogo" aria-labelledby="visitante-titulo" aria-describedby="visitante-aviso"
      onCancel={e => { if (emEnvio.current) e.preventDefault(); }} onClose={() => visitanteBotao.current?.focus()}>
      <div className="acesso__dialogo-corpo">
        <h2 id="visitante-titulo">Experimentar sem conta</h2>
        <p id="visitante-aviso">{mensagens.acesso.experimentarAviso} O progresso desta sessão não passa para uma conta.</p>
        {erro && <p className="acesso__erro" role="alert">{textoErro(erro)}</p>}
        <button className="acesso__principal" type="button" disabled={enviando} onClick={() => void experimentarSemConta()}>{enviando ? 'Preparando…' : 'Experimentar'}</button>
        <button className="acesso__outros-metodos" type="button" disabled={enviando} onClick={() => visitanteDialogo.current?.close()}>Voltar ao login</button>
      </div>
    </dialog>
  </EstruturaAcesso>;
}
