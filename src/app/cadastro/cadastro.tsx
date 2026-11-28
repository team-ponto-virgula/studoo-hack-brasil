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
import { BotaoGoogle } from '../botao-google';
import { emailDoCodigo, esquecerEmailDoCodigo, lembrarEmailDoCodigo, tomarCodigoDoLink } from '../codigo-do-link';

const m = mensagens.cadastro;

/**
 * Criar conta: e-mail → código de 6 dígitos (prova que o e-mail é da pessoa) + senha → entra na hora.
 * Mesmo desenho da recuperação de senha, sem janelas nativas do navegador.
 * Pelo botão do e-mail (`/cadastro#codigo=…`), a tela já abre no segundo passo com o código; o e-mail vem do que este
 * navegador lembrou ao pedir o código, e sem ele a pessoa digita o e-mail ali mesmo.
 */
export function Cadastro({ googleDisponivel }: { googleDisponivel: boolean }) {
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
  /** O código veio do link do e-mail: com o e-mail lembrado neste navegador ou sem ele (aí o campo fica aberto). */
  const [doLink, setDoLink] = useState<'com-email' | 'sem-email' | null>(null);
  const emCurso = useRef(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const codigoDoLink = tomarCodigoDoLink();
    if (!codigoDoLink) return;
    const lembrado = emailDoCodigo();
    if (lembrado) setEmail(lembrado);
    setCodigo(codigoDoLink); setDoLink(lembrado ? 'com-email' : 'sem-email'); setEtapa('codigo');
  }, []);
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
      lembrarEmailDoCodigo(normalizado);
      setEtapa('codigo'); setEspera(60); setDoLink(null);
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
      esquecerEmailDoCodigo();
      setSenha(''); setConfirmacao('');
      router.replace('/');
    });
  }

  return <main className="recuperar" id="conteudo-principal">
    <header className="recuperar-topo"><Logo /><div className="recuperar-acoes"><BotaoSom /><Link className="botao botao--texto" href="/login">{mensagens.voltar}</Link></div></header>
    <section className="recuperar-cartao">
      <div className="recuperar-simbolo" aria-hidden="true"><Icone nome="cadeado" /></div>
      <h1 ref={titulo} tabIndex={-1}>{m.titulo}</h1>
      {etapa === 'email' && googleDisponivel && <div className="cadastro-google">
        <BotaoGoogle ocupado={ocupado} />
        <p className="acesso-divisor">{m.ou}</p>
      </div>}
      <p className="introducao">{etapa === 'email' ? m.instrucao : m.validade}</p>
      <form className="formulario" noValidate aria-busy={ocupado}
        onSubmit={etapa === 'email' ? (e) => { e.preventDefault(); enviar(); } : criar}>
        <div className="campo"><label htmlFor="cadastro-email">{m.email}</label>
          <input id="cadastro-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email}
            disabled={ocupado || (etapa === 'codigo' && doLink !== 'sem-email')} maxLength={254} required
            onChange={e => { setEmail(e.target.value); setValidacao(''); setErro(null); }} /></div>
        {etapa === 'codigo' && <>
          <p role="status" className="recuperar-aviso">{doLink === 'com-email' ? m.codigoDoLink : doLink === 'sem-email' ? m.codigoDoLinkSemEmail : m.enviado}</p>
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
          <Botao variante="texto" disabled={ocupado} onClick={() => { setEtapa('email'); setCodigo(''); setDoLink(null); setValidacao(''); setErro(null); }}>{m.trocarEmail}</Botao>
        </>}
      </form>
      <div className="cadastro-links">
        <a className="acesso-link" href="/privacidade" target="_blank" rel="noopener">{m.politica}</a>
        <Link className="acesso-link" href="/login">{mensagens.acesso.jaTenhoConta}</Link>
      </div>
    </section>
  </main>;
}
