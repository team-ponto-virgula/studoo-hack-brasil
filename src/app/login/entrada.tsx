'use client';

import Link from 'next/link';
import { BotaoSom } from '../som';
import { BotaoGoogle } from '../botao-google';
import { useRouter } from 'next/navigation';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { ErroStudoo } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../../contratos/cliente-web';
import { mensagens } from '../../mensagens/pt-BR';
import { Botao, EstadoErro, Icone, Logo, Mascote, Paisagem, Skeleton, Stu } from '../../ui';
import { Apresentacao } from '../apresentacao';
import { tocaSons } from '../sons';

type ErrosCampo = { email?: string; senha?: string };

const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Entrada no Studoo. O formulário confere o e-mail e a senha antes de enviar e mostra o erro no próprio campo;
 * a senha pode ser mostrada e o Caps Lock ativado é avisado. Na tela larga, a paisagem do mundo ocupa a metade direita;
 * no celular, vira uma faixa acima do título.
 */
type ConfigAcessoInicial = {
  google: boolean;
  recuperacao: boolean;
  cadastro?: boolean;
  visitante: boolean;
};

export function Entrada({ configInicial, sessaoVerificada = false }: { configInicial?: ConfigAcessoInicial; sessaoVerificada?: boolean }) {
  const router = useRouter();
  const [googleDisponivel, setGoogleDisponivel] = useState(Boolean(configInicial?.google));
  const [recuperacaoDisponivel, setRecuperacaoDisponivel] = useState(Boolean(configInicial?.recuperacao));
  const [visitanteDisponivel, setVisitanteDisponivel] = useState(Boolean(configInicial?.visitante));
  const [cadastroDisponivel, setCadastroDisponivel] = useState(Boolean(configInicial?.cadastro));
  // Depois de "Excluir conta" no Perfil, o login confirma que a conta se foi.
  const [contaExcluida, setContaExcluida] = useState(false);
  useEffect(() => { setContaExcluida(new URLSearchParams(window.location.search).get('conta') === 'excluida'); }, []);
  const [configuracaoCarregada, setConfiguracaoCarregada] = useState(Boolean(configInicial));
  const [verificando, setVerificando] = useState(!sessaoVerificada);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [errosCampo, setErrosCampo] = useState<ErrosCampo>({});
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  /** Conta os erros: a cada um, o formulário treme de novo. */
  const [tremor, setTremor] = useState(0);
  const [vendoApresentacao, setVendoApresentacao] = useState(false);
  const emEnvio = useRef(false);
  const campoEmail = useRef<HTMLInputElement>(null);
  const campoSenha = useRef<HTMLInputElement>(null);
  const linkComoFunciona = useRef<HTMLButtonElement>(null);
  const devolverFocoApresentacao = useRef(false);

  useEffect(() => {
    if (!vendoApresentacao && devolverFocoApresentacao.current) {
      devolverFocoApresentacao.current = false;
      linkComoFunciona.current?.focus();
    }
  }, [vendoApresentacao]);

  useEffect(() => {
    tocaSons.prepararEfeitos('entrar');
    let ativo = true;

    async function verificarSessao() {
      try {
        await cliente.sessao();
        if (ativo) router.replace('/');
      } catch {
        if (ativo) setVerificando(false);
      }
    }

    const codigo = new URLSearchParams(window.location.search).get('erro');
    if (codigo && ['google_invalido', 'google_indisponivel', 'google_conta_existente', 'nao_autenticado'].includes(codigo)) setErro(codigo);
    if (!configInicial) {
      void cliente.configuracaoAcesso().then(config => {
        if (ativo) {
          setGoogleDisponivel(config.google);
          setRecuperacaoDisponivel(Boolean(config.recuperacao));
          setVisitanteDisponivel(Boolean(config.visitante));
          setCadastroDisponivel(Boolean(config.cadastro));
        }
      })
        .catch(() => undefined).finally(() => { if (ativo) setConfiguracaoCarregada(true); });
    }
    if (!sessaoVerificada) void verificarSessao();
    return () => { ativo = false; };
  }, [configInicial, sessaoVerificada, router]);

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
      void tocaSons.tocarEfeito('entrar');
      router.replace('/');
    } catch (falha) {
      setErro(falha instanceof ErroStudoo ? falha.codigo : 'rede');
      if (falha instanceof ErroStudoo && falha.codigo === 'credenciais_invalidas' && campoSenha.current) campoSenha.current.value = '';
      setTremor((anterior) => anterior + 1);
      setEnviando(false);
      emEnvio.current = false;
    }
  }

  async function experimentarSemConta() {
    if (emEnvio.current) return;
    emEnvio.current = true;
    setEnviando(true);
    setErro(null);
    try {
      await cliente.entrarVisitante();
      router.replace('/');
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

  if (vendoApresentacao) {
    return (
      <div className="entrada">
        <main className="entrada-conteudo" id="conteudo-principal">
          <Apresentacao
            primeiraVez={false}
            semSessao
            rotuloFinalUltimo={visitanteDisponivel ? mensagens.acesso.experimentar : undefined}
            concluir={(_, concluiuFinal) => {
              if (concluiuFinal && visitanteDisponivel) {
                setVendoApresentacao(false);
                void experimentarSemConta();
                return;
              }
              devolverFocoApresentacao.current = true;
              setVendoApresentacao(false);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="entrada">
      <main className="entrada-conteudo" id="conteudo-principal">
        <div className="entrada-forma">
          <header className="entrada-cabecalho">
            <div className="som-marca"><Logo /><BotaoSom /></div>
            <Paisagem compacta className="entrada-banner">
              <Mascote expressao="stu-acolhida" tamanho={76} sombra prioridade animado="laco" className="stu" />
            </Paisagem>
            {/* Refino 10 (spec 16): até 767 px o Stu da acolhida (72, acenando) fica à direita do título, alinhado ao topo dele; a faixa de paisagem de cima sai. Parado com movimento reduzido. */}
            <div className="entrada-titulo-faixa">
              <h1>{mensagens.login.titulo}</h1>
              <Mascote expressao="stu-acolhida" tamanho={72} prioridade animado="laco" className="entrada-stu-celular" />
            </div>
            <p className="introducao">{mensagens.login.instrucoes}</p>
            <button ref={linkComoFunciona} type="button" className="acesso-link" onClick={() => setVendoApresentacao(true)}>
              {mensagens.acesso.verComoFunciona}
            </button>
          </header>
          {verificando ? <Skeleton /> : (
            <form className="formulario" method="post" noValidate onSubmit={entrar} aria-busy={enviando}
              data-tremor={tremor ? (tremor % 2 ? 'a' : 'b') : undefined}>
              {visitanteDisponivel && (
                <div className="acesso-visitante">
                  <Botao variante="primario" disabled={enviando} onClick={() => void experimentarSemConta()}>
                    {mensagens.acesso.experimentar}
                  </Botao>
                  <p className="acesso-ajuda">{mensagens.acesso.experimentarAviso}</p>
                </div>
              )}
              {configuracaoCarregada && googleDisponivel && (
                <BotaoGoogle ocupado={enviando} />
              )}
              {(visitanteDisponivel || (configuracaoCarregada && googleDisponivel)) && (
                <p className="acesso-divisor">{mensagens.acesso.ou}</p>
              )}
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
              {erro && <EstadoErro codigo={erro} />}
              {/* "Entrar" logo depois da senha, na largura toda, sem rodapé preso (spec 04, banca da noite, item 1): com o
                  visitante ligado é o secundário (o principal é experimentar); sem ele, o principal. */}
              <div className="entrada-entrar">
                <Botao type="submit" variante={visitanteDisponivel ? 'secundario' : 'primario'} disabled={enviando}>
                  {enviando ? (
                    <>
                      <span className="carregando" aria-hidden="true"><span /><span /><span /></span>
                      <span className="somente-leitor">{mensagens.login.entrando}</span>
                    </>
                  ) : mensagens.login.entrar}
                </Botao>
              </div>
              {configuracaoCarregada && recuperacaoDisponivel && (
                <Link className="acesso-link entrada-esqueci" href="/recuperar" onClick={() => {
                  try { sessionStorage.setItem('studoo.recuperar.email', campoEmail.current?.value.trim() ?? ''); } catch { /* A recuperação também funciona sem armazenamento. */ }
                }}>{mensagens.acesso.esqueci}</Link>
              )}
              <Link className="acesso-link entrada-esqueci" href="/suporte">{mensagens.seguranca.precisaDeAjuda}</Link>
              {configuracaoCarregada && cadastroDisponivel && (
                <p className="acesso-ajuda entrada-criar">{mensagens.acesso.semConta}{' '}
                  <Link className="acesso-link" href="/cadastro">{mensagens.acesso.criarConta}</Link></p>
              )}
            </form>
          )}
          {contaExcluida && <p className="folha-status" role="status">{mensagens.privacidade.excluida}</p>}
          {/* Política pública (revisão Apple): ao alcance antes de criar conta ou entrar como visitante. */}
          <a className="acesso-link entrada-privacidade" href="/privacidade" target="_blank" rel="noopener">{mensagens.privacidade.politica}</a>
        </div>
      </main>
      <aside className="entrada-arte" aria-label={mensagens.login.arteTitulo}>
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
          {/* Sem `prioridade`: a arte larga some no celular e a imagem preguiçosa nem é pedida lá (spec 13, §E6). */}
          <Mascote expressao="stu-acolhida" tamanho={240} sombra className="stu" />
        </Paisagem>
      </aside>
    </div>
  );
}
