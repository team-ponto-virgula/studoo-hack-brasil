'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ErroStudoo } from '@studoo/contratos';
import { codigoAceito, normalizarEmailEntrada, senhaAceita } from '@studoo/contratos/autenticacao';
import { clienteStudooWeb as cliente } from '../../contratos/cliente-web';
import { mensagens } from '../../mensagens/pt-BR';
import { AcaoPrincipal, Botao, EstadoErro, Icone, Logo } from '../../ui';
import { BotaoSom } from '../som';

const m = mensagens.cadastro;

/**
 * Criar conta: e-mail → código de 6 dígitos (prova que o e-mail é da pessoa) + senha → entra na hora.
 * Mesmo desenho da recuperação de senha, sem janelas nativas do navegador.
 */
export function Cadastro() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [validacao, setValidacao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const [espera, setEspera] = useState(0);
  const emCurso = useRef(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, [etapa]);
  useEffect(() => {
    if (!espera) return;
    const timer = window.setTimeout(() => setEspera(s => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [espera]);

  async function executar(acao: () => Promise<void>) {
    if (emCurso.current) return;
    emCurso.current = true; setOcupado(true); setErro(null); setValidacao('');
    try { await acao(); }
    catch (e) { setErro(e instanceof ErroStudoo ? e.codigo : 'rede'); }
    finally { emCurso.current = false; setOcupado(false); }
  }
  function enviar() {
    const normalizado = normalizarEmailEntrada(email);
    if (!normalizado) { setValidacao(m.emailInvalido); return; }
    void executar(async () => {
      await cliente.pedirCodigoCadastro(normalizado);
      setEtapa('codigo'); setEspera(60);
    });
  }
  function criar(evento: FormEvent) {
    evento.preventDefault();
    const normalizado = normalizarEmailEntrada(email);
    if (!normalizado) { setValidacao(m.emailInvalido); return; }
    if (!codigoAceito(codigo)) { setValidacao(m.codigoInvalido); return; }
    if (!senhaAceita(senha)) { setValidacao(m.senhaInvalida); return; }
    if (senha !== confirmacao) { setValidacao(m.senhasDiferentes); return; }
    void executar(async () => {
      await cliente.cadastrar(normalizado, codigo, senha);
      setSenha(''); setConfirmacao('');
      router.replace('/');
    });
  }

  return <main className="recuperar" id="conteudo-principal">
    <header className="recuperar-topo"><Logo /><div className="recuperar-acoes"><BotaoSom /><Link className="botao botao--texto" href="/login">{mensagens.voltar}</Link></div></header>
    <section className="recuperar-cartao">
      <div className="recuperar-simbolo" aria-hidden="true"><Icone nome="cadeado" /></div>
      <h1 ref={titulo} tabIndex={-1}>{m.titulo}</h1>
      <p className="introducao">{etapa === 'email' ? m.instrucao : m.validade}</p>
      <form className="formulario" noValidate aria-busy={ocupado}
        onSubmit={etapa === 'email' ? (e) => { e.preventDefault(); enviar(); } : criar}>
        <div className="campo"><label htmlFor="cadastro-email">{m.email}</label>
          <input id="cadastro-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email}
            disabled={ocupado || etapa === 'codigo'} maxLength={254} required
            onChange={e => { setEmail(e.target.value); setValidacao(''); setErro(null); }} /></div>
        {etapa === 'codigo' && <>
          <p role="status" className="recuperar-aviso">{m.enviado}</p>
          <div className="campo"><label htmlFor="cadastro-codigo">{m.codigo}</label>
            <input id="cadastro-codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
              value={codigo} onChange={e => { setCodigo(e.target.value.replace(/\D/g, '')); setValidacao(''); setErro(null); }} disabled={ocupado} required /></div>
          <div className="campo"><label htmlFor="cadastro-senha">{m.senha}</label><div className="campo-senha">
            <input id="cadastro-senha" type={mostrar ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={256}
              value={senha} onChange={e => setSenha(e.target.value)} disabled={ocupado} aria-describedby="cadastro-dica" required />
            <button type="button" className="campo-senha__alternar" aria-label={mensagens.login.mostrarSenha} aria-pressed={mostrar}
              disabled={ocupado} onClick={() => setMostrar(v => !v)}><Icone nome={mostrar ? 'olhoFechado' : 'olho'} /></button>
          </div><small id="cadastro-dica">{m.dicaSenha}</small></div>
          <div className="campo"><label htmlFor="cadastro-confirmar">{m.confirmarSenha}</label>
            <input id="cadastro-confirmar" type={mostrar ? 'text' : 'password'} autoComplete="new-password" maxLength={256}
              value={confirmacao} onChange={e => setConfirmacao(e.target.value)} disabled={ocupado} required /></div>
        </>}
        {validacao && <p role="alert" className="campo-erro">{validacao}</p>}
        {erro && <EstadoErro codigo={erro} />}
        <AcaoPrincipal><Botao type="submit" disabled={ocupado}>
          {etapa === 'email' ? (ocupado ? m.enviando : m.enviar) : (ocupado ? m.criando : m.criar)}
        </Botao></AcaoPrincipal>
        {etapa === 'codigo' && <>
          <Botao variante="texto" disabled={ocupado || espera > 0} onClick={enviar}>{espera ? m.aguarde(espera) : m.reenviar}</Botao>
          <Botao variante="texto" disabled={ocupado} onClick={() => { setEtapa('email'); setCodigo(''); setValidacao(''); setErro(null); }}>{m.trocarEmail}</Botao>
        </>}
      </form>
      <div className="cadastro-links">
        <a className="acesso-link" href="/privacidade" target="_blank" rel="noopener">{m.politica}</a>
        <Link className="acesso-link" href="/login">{mensagens.acesso.jaTenhoConta}</Link>
      </div>
    </section>
  </main>;
}
