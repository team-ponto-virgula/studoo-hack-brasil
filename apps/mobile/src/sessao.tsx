import { limparAndamentosDaSessao } from './licao';
import { ErroStudoo } from '@studoo/contratos';
import { useEffect, useState } from 'react';
import { apagarToken, criarClienteNativo, guardarToken, lerToken, sessaoInvalida, type ClienteNativo } from './api-nativa';
import { entrarComGoogle } from './google-nativo';
import { entrarComApple } from './apple-nativo';
import { entrarComoVisitante } from './visitante-nativo';
import { BoasVindasMobile, EntradaMobile } from './acesso-mobile';
import { RecuperarAcesso } from './recuperar';
import { CriarConta } from './cadastro';
import { Estudo, type DestinoPublico } from './estudo';
import { AvisoDoApp, Botao, EstadoErro, Tela, Titulo, useAvisoDoAppRaiz } from './interface';
import { SkeletonTrilha } from './caminho';
import { NavegacaoContexto } from './navegacao';
import { apagarPreferenciasDaConta, apagarTinhaTrilhas, guardarRetornoDaTrilha, lerTinhaTrilhas } from './preferencias';
import { ConsentimentoIa } from './consentimento-ia';
import { tomarRascunho } from './rascunho';
import { mensagemDeErro, mensagens } from './mensagens';
import { tocaSons } from './sons';
import { useAvisoDaMusica } from './som';

type Sessao =
  | { tipo: 'verificando' }
  | { tipo: 'boasVindas' }
  | { tipo: 'entrada'; erro?: string }
  | { tipo: 'recuperar'; email: string }
  | { tipo: 'cadastro'; email: string }
  | { tipo: 'falha'; erro: string }
  | { tipo: 'ativa'; cliente: ClienteNativo; visitante?: boolean };

export function AppMobile({ destino }: { destino?: DestinoPublico } = {}) {
  const [sessao, setSessao] = useState<Sessao>({ tipo: 'verificando' });
  const [tentativa, setTentativa] = useState(0);
  const [tinhaTrilhas, setTinhaTrilhas] = useState(false);
  useEffect(() => {
    // Acesso e cadastro ficam silenciosos sem alterar a preferência de música da pessoa.
    if (sessao.tipo !== 'ativa') tocaSons.definirAreaPermitida(false);
    return () => tocaSons.definirAreaPermitida(false);
  }, [sessao.tipo]);
  useEffect(() => {
    void lerTinhaTrilhas().then(setTinhaTrilhas);
  }, []);
  // O som (spec 12, uma música só): as preferências ao abrir; o Lo-fi começa no primeiro toque em qualquer tela, já na
  // entrada (login ou visitante), e segue o mesmo ao entrar, sair da conta e trocar de tela, sem recomeçar.
  useEffect(() => {
    void tocaSons.carregarPreferencias();
  }, []);
  // O aviso do app mora aqui, na raiz, para valer também na entrada: o da primeira vez que a música toca, com "Desligar".
  const avisoDoApp = useAvisoDoAppRaiz();
  useAvisoDaMusica(avisoDoApp.avisar);

  useEffect(() => {
    let ativo = true;

    async function restaurarSessao() {
      try {
        const token = await lerToken();
        if (!ativo) return;
        if (!token) {
          setSessao({ tipo: 'boasVindas' });
          return;
        }

        const cliente = criarClienteNativo(token);
        const dados = await cliente.sessao();
        if (ativo) setSessao({ tipo: 'ativa', cliente, visitante: dados.visitante });
      } catch (erro) {
        if (!ativo) return;
        if (sessaoInvalida(erro)) {
          const estado = await encerrarNoAparelho(mensagens.erros.nao_autenticado);
          if (ativo) setSessao(estado);
        } else {
          setSessao({ tipo: 'falha', erro: mensagemDeErro(erro) });
        }
      }
    }

    void restaurarSessao();
    return () => { ativo = false; };
  }, [tentativa]);

  async function entrar(email: string, senha: string) {
    const { token } = await criarClienteNativo().loginNativo(email, senha);
    await abrirSessao(token);
  }

  /** Criar conta por e-mail: a conta nasce já com a sessão do app (201 + SessaoNativa). */
  async function cadastrar(email: string, codigo: string, senha: string) {
    const { token } = await criarClienteNativo().cadastrarNativo(email, codigo, senha);
    await abrirSessao(token);
  }

  /** Guarda o token novo no aparelho e abre o estudo; sem conseguir guardar, encerra a sessão no servidor. */
  async function abrirSessao(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ErroStudoo('falha');

    const cliente = criarClienteNativo(token);
    try {
      await guardarToken(token);
    } catch (erro) {
      await cliente.logout().catch(() => undefined);
      throw erro;
    }
    void tocaSons.tocarEfeito('entrar');
    setSessao({ tipo: 'ativa', cliente });
  }

  async function sair(cliente: ClienteNativo) {
    try {
      await cliente.logout();
    } catch (erro) {
      if (!sessaoInvalida(erro)) throw erro;
    }
    setSessao({ tipo: 'verificando' });
    setSessao(await encerrarNoAparelho());
  }

  /** Conta excluída no servidor: o aparelho esquece a sessão e o que guardava dela, e a entrada mostra o aviso. */
  async function aoExcluida() {
    tomarRascunho();
    await apagarPreferenciasDaConta();
    setSessao({ tipo: 'verificando' });
    setSessao(await encerrarNoAparelho());
    avisoDoApp.avisar(mensagens.privacidade.excluida, { icone: 'check' });
  }

  /** Google e Apple entram do mesmo jeito na entrada e no primeiro passo do cadastro (spec 06). */
  async function continuarComGoogle() {
    const token = await entrarComGoogle();
    if (!token) return;
    void tocaSons.tocarEfeito('entrar');
    setSessao({ tipo: 'ativa', cliente: criarClienteNativo(token) });
  }
  async function continuarComApple() {
    const token = await entrarComApple();
    if (!token) return;
    void tocaSons.tocarEfeito('entrar');
    setSessao({ tipo: 'ativa', cliente: criarClienteNativo(token) });
  }

  async function expirar() {
    setSessao({ tipo: 'verificando' });
    setSessao(await encerrarNoAparelho(mensagens.erros.nao_autenticado));
  }

  return <AvisoDoApp.Provider value={avisoDoApp}>{tela()}</AvisoDoApp.Provider>;

  function tela() {
  switch (sessao.tipo) {
    case 'ativa':
      return (
        <ConsentimentoIa cliente={sessao.cliente} aoExcluida={aoExcluida}>
          {(cliente) => <Estudo cliente={cliente} visitante={sessao.visitante === true} destino={destino} sair={() => sair(sessao.cliente)} expirar={expirar} />}
        </ConsentimentoIa>
      );
    case 'boasVindas':
      return <BoasVindasMobile entrar={() => setSessao({ tipo: 'entrada' })} criarConta={() => setSessao({ tipo: 'cadastro', email: '' })} />;
    case 'entrada':
      return <EntradaMobile voltar={() => setSessao({ tipo: 'boasVindas' })} erroInicial={sessao.erro} entrar={entrar}
        google={continuarComGoogle}
        apple={continuarComApple}
        criarConta={(email) => setSessao({ tipo: 'cadastro', email })}
        visitante={async () => {
          const token = await entrarComoVisitante();
          void tocaSons.tocarEfeito('entrar');
          setSessao({ tipo: 'ativa', cliente: criarClienteNativo(token), visitante: true });
        }}
        recuperar={(email) => setSessao({ tipo: 'recuperar', email })} />;
    case 'recuperar':
      return <RecuperarAcesso emailInicial={sessao.email} voltar={() => setSessao({ tipo: 'entrada' })} />;
    case 'cadastro':
      return <CriarConta emailInicial={sessao.email} voltar={() => setSessao({ tipo: 'entrada' })} criar={cadastrar}
        google={continuarComGoogle} apple={continuarComApple} />;
    case 'falha':
      return (
        // Como na web (3A): o erro fica num cartão com o Stu e a ação dentro dele, em vez de uma tela só com o rodapé.
        <Tela pagina="falha">
          <Titulo>{mensagens.entrada.titulo}</Titulo>
          <EstadoErro mensagem={sessao.erro} foco acao={{ rotulo: mensagens.tentar, testID: 'tentar-sessao', acao: () => {
            setSessao({ tipo: 'verificando' });
            setTentativa((anterior) => anterior + 1);
          } }} />
        </Tela>
      );
    case 'verificando':
      // Como o esqueleto da web na primeira carga: a barra com "Sair", as barras e o mapa, e as abas só se havia trilhas.
      return (
        <NavegacaoContexto.Provider value={tinhaTrilhas ? { atual: 'planos', ocupado: true, planos: () => undefined, criar: () => undefined } : null}>
          <Tela pagina="verificando" acoes={<Botao rotulo={mensagens.sair} testID="sair" compacto variante="texto"
            acao={() => void (async () => {
              const token = await lerToken().catch(() => null);
              if (token) await criarClienteNativo(token).logout().catch(() => undefined);
              setSessao(await encerrarNoAparelho());
            })()} />}>
            <SkeletonTrilha />
          </Tela>
        </NavegacaoContexto.Provider>
      );
  }
  }
}

async function encerrarNoAparelho(erro?: string): Promise<Sessao> {
  limparAndamentosDaSessao();
  // Como a web ao sair ou com a sessão vencida: some a marca de "tinha trilhas" (o próximo esqueleto fica sem abas).
  await Promise.all([apagarTinhaTrilhas(), guardarRetornoDaTrilha(null)]);
  try {
    await apagarToken();
    return erro ? { tipo: 'entrada', erro } : { tipo: 'boasVindas' };
  } catch (falha) {
    return { tipo: 'entrada', erro: mensagemDeErro(falha) };
  }
}
