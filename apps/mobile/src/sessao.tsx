import { ErroStudoo } from '@studoo/contratos';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Keyboard, Platform, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useTremor, useVaiVem } from './animacoes';
import { apagarToken, criarClienteNativo, guardarToken, lerToken, sessaoInvalida, type ClienteNativo } from './api-nativa';
import { entrarComGoogle } from './google-nativo';
import { RecuperarAcesso } from './recuperar';
import { Estudo } from './estudo';
import { Botao, BotaoIcone, Campo, EstadoMensagem, Skeleton, Tela, Titulo, estilos } from './interface';
import { mensagemDeErro, mensagens } from './mensagens';
import { Paisagem } from './mundo';
import { cores } from './tema';

const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Sessao =
  | { tipo: 'verificando' }
  | { tipo: 'entrada'; erro?: string }
  | { tipo: 'recuperar'; email: string }
  | { tipo: 'falha'; erro: string }
  | { tipo: 'ativa'; cliente: ClienteNativo };

export function AppMobile() {
  const [sessao, setSessao] = useState<Sessao>({ tipo: 'verificando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;

    async function restaurarSessao() {
      try {
        const token = await lerToken();
        if (!ativo) return;
        if (!token) {
          setSessao({ tipo: 'entrada' });
          return;
        }

        const cliente = criarClienteNativo(token);
        await cliente.sessao();
        if (ativo) setSessao({ tipo: 'ativa', cliente });
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
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ErroStudoo('falha');

    const cliente = criarClienteNativo(token);
    try {
      await guardarToken(token);
    } catch (erro) {
      await cliente.logout().catch(() => undefined);
      throw erro;
    }
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

  async function expirar() {
    setSessao({ tipo: 'verificando' });
    setSessao(await encerrarNoAparelho(mensagens.erros.nao_autenticado));
  }

  switch (sessao.tipo) {
    case 'ativa':
      return <Estudo cliente={sessao.cliente} sair={() => sair(sessao.cliente)} expirar={expirar} />;
    case 'entrada':
      return <Entrada erroInicial={sessao.erro} entrar={entrar}
        google={async () => { const token = await entrarComGoogle(); if (token) setSessao({ tipo: 'ativa', cliente: criarClienteNativo(token) }); }}
        recuperar={(email) => setSessao({ tipo: 'recuperar', email })} />;
    case 'recuperar':
      return <RecuperarAcesso emailInicial={sessao.email} voltar={() => setSessao({ tipo: 'entrada' })} />;
    case 'falha':
      return (
        <Tela pagina="falha" rodape={<Botao rotulo={mensagens.tentar} testID="tentar-sessao" acao={() => {
          setSessao({ tipo: 'verificando' });
          setTentativa((anterior) => anterior + 1);
        }} />}>
          <Titulo>{mensagens.entrada.titulo}</Titulo>
          <EstadoMensagem mensagem={sessao.erro} />
        </Tela>
      );
    case 'verificando':
      return <Tela pagina="verificando"><Skeleton /></Tela>;
  }
}

async function encerrarNoAparelho(erro?: string): Promise<Sessao> {
  try {
    await apagarToken();
    return { tipo: 'entrada', erro };
  } catch (falha) {
    return { tipo: 'entrada', erro: mensagemDeErro(falha) };
  }
}

/** O Stu na paisagem: sobe e desce devagar e acena de vez em quando. */
function StuAcenando({ largura, esquerda }: { largura: number; esquerda: number }) {
  const aceno = useVaiVem(2400);
  return (
    <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
      style={{ position: 'absolute', bottom: '7%', left: esquerda, width: largura, height: largura * 1.1, transformOrigin: 'bottom', transform: [
        { rotate: aceno.interpolate({ inputRange: [0, 0.8, 0.88, 0.94, 1], outputRange: ['0deg', '0deg', '-6deg', '5deg', '0deg'] }) },
      ] }} />
  );
}

function Entrada({ erroInicial, entrar, google, recuperar }: {
  google: () => Promise<void>;
  recuperar: (email: string) => void;
  erroInicial?: string;
  entrar: (email: string, senha: string) => Promise<void>;
}) {
  const [googleDisponivel, setGoogleDisponivel] = useState(false);
  const [configuracaoCarregada, setConfiguracaoCarregada] = useState(false);
  useEffect(() => { let ativo = true; void criarClienteNativo().configuracaoAcesso().then(c => { if (ativo) setGoogleDisponivel(c.google); }).catch(() => {}).finally(() => { if (ativo) setConfiguracaoCarregada(true); }); return () => { ativo = false; }; }, []);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(erroInicial);
  const [erroEmail, setErroEmail] = useState<string | undefined>();
  const [erroSenha, setErroSenha] = useState<string | undefined>();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  /** Conta os erros: a cada um, o formulário treme de novo, como na web. */
  const [erros, setErros] = useState(0);
  const tremor = useTremor(erros);
  const emEnvio = useRef(false);
  const campoEmail = useRef<ComponentRef<typeof TextInput>>(null);
  const campoSenha = useRef<ComponentRef<typeof TextInput>>(null);
  const podeEntrar = !ocupado;

  async function abrirGoogle() {
    if (emEnvio.current) return;
    emEnvio.current = true; setOcupado(true); setErro(undefined); Keyboard.dismiss();
    try { await google(); }
    catch (e) { setErro(mensagemDeErro(e)); }
    finally { emEnvio.current = false; setOcupado(false); }
  }

  async function enviar() {
    if (emEnvio.current || !podeEntrar) return;
    const emailInvalido = !formatoEmail.test(email.trim());
    const senhaVazia = !senha;
    setErroEmail(emailInvalido ? mensagens.entrada.emailInvalido : undefined);
    setErroSenha(senhaVazia ? mensagens.entrada.senhaVazia : undefined);
    if (emailInvalido || senhaVazia) {
      setErros(total => total + 1);
      (emailInvalido ? campoEmail : campoSenha).current?.focus();
      return;
    }
    Keyboard.dismiss();
    emEnvio.current = true;
    setOcupado(true);
    setErro(undefined);

    try {
      await entrar(email.trim(), senha);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setErros((total) => total + 1);
      if (falha instanceof ErroStudoo && falha.codigo === 'credenciais_invalidas') setSenha('');
    } finally {
      emEnvio.current = false;
      setOcupado(false);
    }
  }

  return (
    <Tela pagina="entrada"
      rodape={<Botao rotulo={ocupado ? mensagens.entrada.entrando : mensagens.entrada.entrar}
        testID="entrar" desativado={!podeEntrar} ocupado={ocupado} carregando={ocupado} acao={() => void enviar()} />}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Paisagem altura={140} compacta estilo={entradaEstilos.banner}>
          {(l) => <StuAcenando largura={72} esquerda={l / 2 - 36} />}
        </Paisagem>
      </View>
      <Titulo foco testID="titulo-entrada">{mensagens.entrada.titulo}</Titulo>
      <Text style={estilos.introducao}>{mensagens.entrada.texto}</Text>
      <Animated.View style={[entradaEstilos.formulario, { transform: [{ translateX: tremor }] }]}>
        <Botao rotulo={mensagens.acesso.google} testID="login-google" variante="secundario" desativado={!googleDisponivel || ocupado} acao={() => void abrirGoogle()} />
        {configuracaoCarregada && !googleDisponivel && <Text style={estilos.legenda}>{mensagens.acesso.googleIndisponivel}</Text>}
        <View style={entradaEstilos.divisor}><View style={entradaEstilos.linha} /><Text style={estilos.legenda}>{mensagens.acesso.ou}</Text><View style={entradaEstilos.linha} /></View>
        <Campo testID="login-email" rotulo={mensagens.entrada.email} value={email} campoRef={campoEmail} erro={erroEmail}
          onChangeText={(valor) => { setEmail(valor); setErro(undefined); setErroEmail(undefined); }}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" returnKeyType="next"
          textContentType={Platform.OS === 'ios' ? 'username' : undefined}
          autoComplete={Platform.OS === 'android' ? 'email' : undefined}
          editable={!ocupado} onSubmitEditing={() => campoSenha.current?.focus()} />
        <Campo testID="login-senha" rotulo={mensagens.entrada.senha} value={senha} campoRef={campoSenha} erro={erroSenha}
          onChangeText={(valor) => { setSenha(valor); setErro(undefined); setErroSenha(undefined); }} secureTextEntry={!mostrarSenha} returnKeyType="go"
          autoCapitalize="none" autoCorrect={false}
          textContentType={Platform.OS === 'ios' ? 'password' : undefined}
          autoComplete={Platform.OS === 'android' ? 'current-password' : undefined}
          editable={!ocupado} onSubmitEditing={() => void enviar()}
          acessorio={<BotaoIcone icone={mostrarSenha ? 'olhoFechado' : 'olho'} testID="alternar-senha" selecionado={mostrarSenha}
            rotulo={mensagens.entrada.mostrarSenha} desativado={ocupado}
            acao={() => setMostrarSenha((atual) => !atual)} />} />
      </Animated.View>
      <Botao rotulo={mensagens.acesso.esqueci} testID="esqueci-senha" variante="texto" desativado={ocupado} acao={() => recuperar(email)} />
      {erro && <EstadoMensagem mensagem={erro} />}
    </Tela>
  );
}

const entradaEstilos = StyleSheet.create({
  divisor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linha: { flex: 1, height: 1, backgroundColor: cores.gelo },
  banner: { marginBottom: 24, borderRadius: 24 },
  formulario: { gap: 20, marginTop: 28 },
});
