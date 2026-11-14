'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ErroStudoo } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../../contratos/cliente-web';
import { mensagens } from '../../mensagens/pt-BR';
import { Botao, EstadoErro, Icone, Logo } from '../../ui';

const m = mensagens.acesso;
export function Recuperar() {
  const [etapa, setEtapa] = useState<'email' | 'codigo' | 'pronto'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [validacao, setValidacao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [espera, setEspera] = useState(0);
  const emCurso = useRef(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, [etapa]);
  useEffect(() => {
    if (!espera) return;
    const timer = window.setTimeout(() => setEspera(s => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [espera]);
  function emailValido() { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }
  async function executar(acao: () => Promise<void>) {
    if (emCurso.current) return;
    emCurso.current = true; setOcupado(true); setErro(null); setValidacao('');
    try { await acao(); }
    catch (e) { setErro(e instanceof ErroStudoo ? e.codigo : 'rede'); }
    finally { emCurso.current = false; setOcupado(false); }
  }
  function enviar() {
    if (!emailValido()) { setValidacao(m.emailInvalido); return; }
    void executar(async () => {
      await cliente.recuperarSenha(email.trim());
      setEtapa('codigo'); setEnviado(true); setEspera(60);
    });
  }
  function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!emailValido()) { setValidacao(m.emailInvalido); return; }
    if (!/^\d{6}$/.test(codigo)) { setValidacao(m.codigoInvalido); return; }
    if (senha.length < 8 || senha.length > 256) { setValidacao(m.senhaInvalida); return; }
    if (senha !== confirmacao) { setValidacao(m.senhasDiferentes); return; }
    void executar(async () => {
      await cliente.redefinirSenha(email.trim(), codigo, senha);
      setSenha(''); setConfirmacao(''); setCodigo(''); setEtapa('pronto');
    });
  }
  return <main className="recuperar" id="conteudo-principal">
    <Logo />
    <section className="recuperar-cartao">
      <div className="recuperar-simbolo" aria-hidden="true"><Icone nome={etapa === 'pronto' ? 'check' : 'cadeado'} /></div>
      <h1 ref={titulo} tabIndex={-1}>{etapa === 'pronto' ? m.sucesso : m.recuperar}</h1>
      <p className="introducao">{etapa === 'pronto' ? m.sucessoTexto : etapa === 'email' ? m.instrucao : m.validade}</p>
      {etapa !== 'pronto' && <form className="formulario" noValidate aria-busy={ocupado}
        onSubmit={etapa === 'email' ? (e) => { e.preventDefault(); enviar(); } : salvar}>
        <div className="campo"><label htmlFor="recuperar-email">{m.email}</label>
          <input id="recuperar-email" type="email" autoComplete="email" autoCapitalize="none" value={email}
            disabled={ocupado} onChange={e => { setEmail(e.target.value); setEnviado(false); }} maxLength={254} required /></div>
        {enviado && <p role="status" className="recuperar-aviso">{m.enviado}</p>}
        {etapa === 'codigo' && <>
          <div className="campo"><label htmlFor="recuperar-codigo">{m.codigo}</label>
            <input id="recuperar-codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
              value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} disabled={ocupado} required /></div>
          <div className="campo"><label htmlFor="nova-senha">{m.novaSenha}</label><div className="campo-senha">
            <input id="nova-senha" type={mostrar ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={256}
              value={senha} onChange={e => setSenha(e.target.value)} disabled={ocupado} aria-describedby="dica-senha" required />
            <button type="button" className="campo-senha__alternar" aria-label={mensagens.login.mostrarSenha} aria-pressed={mostrar}
              onClick={() => setMostrar(v => !v)}><Icone nome={mostrar ? 'olhoFechado' : 'olho'} /></button>
          </div><small id="dica-senha">{m.dicaSenha}</small></div>
          <div className="campo"><label htmlFor="confirmar-senha">{m.confirmarSenha}</label>
            <input id="confirmar-senha" type={mostrar ? 'text' : 'password'} autoComplete="new-password" maxLength={256}
              value={confirmacao} onChange={e => setConfirmacao(e.target.value)} disabled={ocupado} required /></div>
        </>}
        {validacao && <p role="alert" className="campo-erro">{validacao}</p>}
        {erro && <EstadoErro codigo={erro} />}
        <Botao type="submit" disabled={ocupado}>{etapa === 'email' ? ocupado ? m.enviando : m.enviar : ocupado ? m.salvando : m.salvar}</Botao>
        {etapa === 'email'
          ? <Botao variante="texto" disabled={ocupado} onClick={() => { setEtapa('codigo'); setValidacao(''); setErro(null); }}>{m.tenhoCodigo}</Botao>
          : <Botao variante="texto" disabled={ocupado || espera > 0} onClick={enviar}>{espera ? m.aguarde(espera) : m.reenviar}</Botao>}
      </form>}
      <a className="acesso-link" href="/login">{m.entrar}</a>
    </section>
  </main>;
}
