'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ErroStudoo } from '@studoo/contratos';
import { codigoAceito, normalizarEmailEntrada, senhaAceita } from '@studoo/contratos/autenticacao';
import { clienteStudooWeb as cliente } from '../../contratos/cliente-web';
import { mensagens, textoErro } from '../../mensagens/pt-BR';
import { Icone } from '../../ui';
import { EstruturaAcesso, GoogleAcesso, SetaAcesso } from '../acesso/componentes';

const m = mensagens.cadastro;
type Etapa = 'email' | 'codigo' | 'senha';
type Campo = 'email' | 'codigo' | 'senha' | 'confirmacao';

/** Cadastro de verdade: a conta só nasce quando o servidor confirma código e senha. */
export function Cadastro({ googleDisponivel, emailDisponivel = true }: { googleDisponivel: boolean; emailDisponivel?: boolean }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [validacao, setValidacao] = useState<{ campo: Campo; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const [espera, setEspera] = useState(0);
  const [gesto, setGesto] = useState(0);
  const emCurso = useRef(false);
  const montado = useRef(true);
  const focoAposTroca = useRef(false);
  const campoEmail = useRef<HTMLInputElement>(null);
  const campoCodigo = useRef<HTMLInputElement>(null);
  const campoSenha = useRef<HTMLInputElement>(null);
  const campoConfirmacao = useRef<HTMLInputElement>(null);

  useEffect(() => {
    montado.current = true;
    try {
      const inicial = sessionStorage.getItem('studoo.cadastro.email');
      sessionStorage.removeItem('studoo.cadastro.email');
      if (inicial && normalizarEmailEntrada(inicial)) setEmail(inicial);
    } catch { /* O cadastro também funciona sem armazenamento local. */ }
    return () => { montado.current = false; };
  }, []);
  useEffect(() => {
    if (!focoAposTroca.current) return;
    focoAposTroca.current = false;
    ({ email: campoEmail, codigo: campoCodigo, senha: campoSenha })[etapa].current?.focus();
  }, [etapa]);
  useEffect(() => {
    if (!espera) return;
    const timer = window.setTimeout(() => setEspera(segundos => Math.max(0, segundos - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [espera]);

  function conferir(campo: Campo, texto: string) {
    setValidacao({ campo, texto });
    ({ email: campoEmail, codigo: campoCodigo, senha: campoSenha, confirmacao: campoConfirmacao })[campo].current?.focus();
  }
  function limpar(campo: Campo) {
    setValidacao(atual => atual?.campo === campo ? null : atual); setErro(null);
  }
  function trocarEtapa(proxima: Etapa) {
    if (emCurso.current) return;
    setValidacao(null); setErro(null); setEtapa(proxima); setGesto(g => g + 1); focoAposTroca.current = true;
  }
  function trocarEmail() {
    if (emCurso.current) return;
    setCodigo(''); setSenha(''); setConfirmacao(''); setMostrar(false);
    trocarEtapa('email');
  }

  async function enviarCodigo() {
    if (emCurso.current) return;
    const normalizado = normalizarEmailEntrada(email);
    if (!normalizado) { conferir('email', m.emailInvalido); return; }
    emCurso.current = true; setOcupado(true); setErro(null); setValidacao(null);
    try {
      await cliente.pedirCodigoCadastro(normalizado);
      if (!montado.current) return;
      setEmail(normalizado); setCodigo(''); setEtapa('codigo'); setEspera(60); setGesto(g => g + 1); focoAposTroca.current = true;
      // Reenvio na mesma etapa não dispara o effect de mudança.
      requestAnimationFrame(() => { if (montado.current) campoCodigo.current?.focus(); });
    } catch (falha) {
      if (montado.current) setErro(falha instanceof ErroStudoo ? falha.codigo : 'rede');
    } finally {
      emCurso.current = false;
      if (montado.current) setOcupado(false);
    }
  }

  async function criar() {
    if (emCurso.current) return;
    const normalizado = normalizarEmailEntrada(email);
    if (!normalizado) { trocarEtapa('email'); conferir('email', m.emailInvalido); return; }
    if (!codigoAceito(codigo)) { trocarEtapa('codigo'); conferir('codigo', m.codigoInvalido); return; }
    if (!senhaAceita(senha)) { conferir('senha', m.senhaInvalida); return; }
    if (senha !== confirmacao) { conferir('confirmacao', m.senhasDiferentes); return; }
    emCurso.current = true; setOcupado(true); setErro(null); setValidacao(null);
    let navegando = false;
    try {
      await cliente.cadastrar(normalizado, codigo, senha);
      if (!montado.current) return;
      setSenha(''); setConfirmacao(''); setCodigo('');
      navegando = true;
      router.replace('/onboarding'); router.refresh();
    } catch (falha) {
      if (!montado.current) return;
      const motivo = falha instanceof ErroStudoo ? falha.codigo : 'rede';
      setErro(motivo);
      if (motivo === 'codigo_invalido') {
        setEtapa('codigo'); setCodigo(''); focoAposTroca.current = true; setGesto(g => g + 1);
      }
    } finally {
      if (!navegando) {
        emCurso.current = false;
        if (montado.current) setOcupado(false);
      }
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (emCurso.current) return;
    if (etapa === 'email') { void enviarCodigo(); return; }
    if (etapa === 'codigo') {
      if (!codigoAceito(codigo)) { conferir('codigo', m.codigoInvalido); return; }
      trocarEtapa('senha'); return;
    }
    void criar();
  }
  function abrirGoogle() {
    if (emCurso.current) return;
    emCurso.current = true; setOcupado(true);
    window.location.assign('/api/auth/google/iniciar');
  }
  const titulos: Record<Etapa, string> = { email: 'Vamos começar.', codigo: 'Confira seu e-mail.', senha: 'Proteja sua conta.' };
  const descricoes: Record<Etapa, string> = {
    email: emailDisponivel ? 'Crie sua conta e prepare seu primeiro estudo.' : 'Use sua conta Google para começar.',
    codigo: m.enviado,
    senha: 'Escolha uma senha para voltar quando quiser.',
  };
  const erroCampo = (campo: Campo) => validacao?.campo === campo;

  return <EstruturaAcesso gesto={gesto} variante="cadastro" ocupado={ocupado} voltar={() => {
    if (etapa === 'senha') trocarEtapa('codigo');
    else if (etapa === 'codigo') trocarEmail();
    else router.push('/boas-vindas');
  }}>
    <section aria-labelledby="cadastro-titulo">
      <div key={etapa} className="acesso__entrada-etapa">
        <h1 id="cadastro-titulo" className="acesso__titulo">{titulos[etapa]}</h1>
        <p className="acesso__descricao" role={etapa === 'codigo' ? 'status' : undefined}>{descricoes[etapa]}</p>
      </div>
      {emailDisponivel && <form className="acesso__formulario" noValidate onSubmit={enviar} aria-busy={ocupado}>
        {etapa !== 'email' && <div className="acesso__email-contexto"><span>{email}</span><button className="acesso__texto" type="button" disabled={ocupado} onClick={trocarEmail}>Alterar</button></div>}
        <div hidden={etapa !== 'email'} className="acesso__campo">
          <label htmlFor="cadastro-email">{m.email}</label>
          <input ref={campoEmail} id="cadastro-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
            value={email} onChange={e => { setEmail(e.target.value); limpar('email'); }} placeholder="voce@exemplo.com" maxLength={254} required disabled={ocupado}
            aria-invalid={erroCampo('email')} aria-describedby={erroCampo('email') ? 'cadastro-validacao' : undefined} />
        </div>
        <div hidden={etapa !== 'codigo'} className="acesso__campo acesso__codigo">
          <label htmlFor="cadastro-codigo">{m.codigo}</label>
          <input ref={campoCodigo} id="cadastro-codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
            value={codigo} onChange={e => { setCodigo(e.target.value.replace(/\D/g, '')); limpar('codigo'); }} placeholder="000000" required disabled={ocupado}
            aria-invalid={erroCampo('codigo')} aria-describedby={[erroCampo('codigo') && 'cadastro-validacao', 'cadastro-validade'].filter(Boolean).join(' ')} />
          <small id="cadastro-validade" className="acesso__dica">{m.validade}</small>
        </div>
        <div hidden={etapa !== 'senha'}>
          <div className="acesso__campo"><label htmlFor="cadastro-senha">{m.senha}</label><div className="acesso__senha">
            <input ref={campoSenha} id="cadastro-senha" type={mostrar ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={256}
              value={senha} onChange={e => { setSenha(e.target.value); limpar('senha'); }} disabled={ocupado} required aria-invalid={erroCampo('senha')}
              aria-describedby={['cadastro-dica', erroCampo('senha') && 'cadastro-validacao'].filter(Boolean).join(' ')} />
            <button type="button" className="acesso__olho" aria-label={mostrar ? 'Ocultar senha' : mensagens.login.mostrarSenha} aria-controls="cadastro-senha cadastro-confirmar" aria-pressed={mostrar}
              disabled={ocupado} onClick={() => setMostrar(v => !v)}><Icone nome={mostrar ? 'olhoFechado' : 'olho'} /></button>
          </div><small id="cadastro-dica" className="acesso__dica">{m.dicaSenha}</small></div>
          <div className="acesso__campo"><label htmlFor="cadastro-confirmar">{m.confirmarSenha}</label>
            <input ref={campoConfirmacao} id="cadastro-confirmar" type={mostrar ? 'text' : 'password'} autoComplete="new-password" maxLength={256}
              value={confirmacao} onChange={e => { setConfirmacao(e.target.value); limpar('confirmacao'); }} disabled={ocupado} required aria-invalid={erroCampo('confirmacao')}
              aria-describedby={erroCampo('confirmacao') ? 'cadastro-validacao' : undefined} /></div>
        </div>
        {validacao && <p id="cadastro-validacao" className="acesso__erro" role="alert">{validacao.texto}</p>}
        {erro && <p className="acesso__erro" role="alert">{textoErro(erro)}</p>}
        <button className="acesso__principal" type="submit" disabled={ocupado}>
          <span>{ocupado ? etapa === 'senha' ? m.criando : m.enviando : etapa === 'email' ? m.enviar : etapa === 'codigo' ? 'Continuar' : m.criar}</span><SetaAcesso />
        </button>
        {etapa === 'codigo' && <div className="acesso__codigos-acoes">
          <button className="acesso__texto" type="button" disabled={ocupado || espera > 0} onClick={() => void enviarCodigo()}>{espera ? m.aguarde(espera) : m.reenviar}</button>
        </div>}
        {etapa === 'senha' && <button className="acesso__outros-metodos" type="button" disabled={ocupado} onClick={() => trocarEtapa('codigo')}>Voltar ao código</button>}
      </form>}
      {etapa === 'email' && googleDisponivel && <div className="acesso__social">
        {emailDisponivel && <div className="acesso__divisor"><span>ou</span></div>}
        <GoogleAcesso ocupado={ocupado} iniciar={abrirGoogle} />
      </div>}
      <p className="acesso__privacidade-cadastro">Ao criar a conta, você concorda com a <a href="/privacidade" target="_blank" rel="noopener">Política de privacidade</a>.</p>
      <Link className="acesso__outros-metodos" href="/login" onClick={e => { if (emCurso.current) e.preventDefault(); }}>{mensagens.acesso.jaTenhoConta}</Link>
    </section>
  </EstruturaAcesso>;
}
