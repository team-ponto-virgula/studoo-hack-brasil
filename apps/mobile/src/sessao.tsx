import { ErroStudoo } from '@studoo/contratos';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, BackHandler, Keyboard, Platform, StyleSheet, Text, View, useWindowDimensions, type TextInput } from 'react-native';
import { estiloDeEntrada, useAparecer, useTremor, useVaiVem } from './animacoes';
import { apagarToken, criarClienteNativo, guardarToken, lerToken, sessaoInvalida, type ClienteNativo } from './api-nativa';
import { entrarComGoogle } from './google-nativo';
import { RecuperarAcesso } from './recuperar';
import { Estudo } from './estudo';
import { Icone } from './icone';
import { Botao, BotaoIcone, Campo, EstadoMensagem, Skeleton, Tela, Titulo, estilos } from './interface';
import { mensagemDeErro, mensagens } from './mensagens';
import { Desenho, Paisagem } from './mundo';
import { cores, fontes } from './tema';

const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Sessao =
  | { tipo: 'verificando' }
  | { tipo: 'boas-vindas' }
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
          setSessao({ tipo: 'boas-vindas' });
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
    case 'boas-vindas':
      return <BoasVindas entrar={() => setSessao({ tipo: 'entrada' })} />;
    case 'entrada':
      return <Entrada erroInicial={sessao.erro} entrar={entrar}
        google={async () => { const token = await entrarComGoogle(); if (token) setSessao({ tipo: 'ativa', cliente: criarClienteNativo(token) }); }}
        recuperar={(email) => setSessao({ tipo: 'recuperar', email })}
        voltar={() => setSessao({ tipo: 'boas-vindas' })} />;
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

/**
 * Boas-vindas: a paisagem do mundo com o Stu, a promessa do Studoo e três destaques (qualquer assunto, a trilha montada
 * pela IA e o progresso salvo), como o painel da entrada na web.
 */
function BoasVindas({ entrar }: { entrar: () => void }) {
  const { width } = useWindowDimensions();
  const largura = Math.min(width, 620) - 40;
  const arte = useAparecer(0, 420);
  const titulo = useAparecer(140, 420);
  const texto = useAparecer(220, 420);

  return (
    <Tela pagina="boas-vindas" rodape={<Botao rotulo={mensagens.boasVindas.entrar} testID="entrar-no-piloto" icone="seta" acao={entrar} />}>
      <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={estiloDeEntrada(arte, 14, 0.97)}>
        <Paisagem altura={Math.round(largura * 0.7)} estilo={entradaEstilos.arte}>
          {(l) => <StuAcenando largura={l * 0.3} esquerda={l * 0.35} />}
        </Paisagem>
      </Animated.View>
      <Animated.View style={estiloDeEntrada(titulo, 10, 1)}>
        <Titulo testID="boas-vindas">{mensagens.boasVindas.titulo}</Titulo>
      </Animated.View>
      <Animated.View style={estiloDeEntrada(texto, 10, 1)}>
        <Text style={estilos.introducao}>{mensagens.boasVindas.texto}</Text>
      </Animated.View>
      <View style={entradaEstilos.destaques}>
        {mensagens.boasVindas.destaques.map((destaque, indice) => <Destaque key={destaque} texto={destaque} indice={indice} />)}
      </View>
    </Tela>
  );
}

/** Destaque das boas-vindas: entra em sequência, com o ícone que aparece com um pulinho. */
function Destaque({ texto, indice }: { texto: string; indice: number }) {
  const entrada = useAparecer(320 + indice * 90, 420, true);
  return (
    <Animated.View style={[entradaEstilos.destaque, estiloDeEntrada(entrada, 12, 0.94)]}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
        style={[entradaEstilos.destaqueIcone, entradaEstilos[`destaque${indice}` as 'destaque0']]}>
        {indice === 0 && <Desenho nome="temaPopulares" largura={22} />}
        {indice === 1 && <Icone nome="livro" tamanho={20} cor={cores.fundo} />}
        {indice === 2 && <Icone nome="check" tamanho={20} cor={cores.fundo} />}
      </View>
      <Text style={entradaEstilos.destaqueTexto}>{texto}</Text>
    </Animated.View>
  );
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

function Entrada({ erroInicial, entrar, voltar, google, recuperar }: {
  google: () => Promise<void>;
  recuperar: (email: string) => void;
  erroInicial?: string;
  entrar: (email: string, senha: string) => Promise<void>;
  voltar: () => void;
}) {
  const [googleDisponivel, setGoogleDisponivel] = useState(false);
  useEffect(() => { let ativo = true; void criarClienteNativo().configuracaoAcesso().then(c => { if (ativo) setGoogleDisponivel(c.google); }).catch(() => {}); return () => { ativo = false; }; }, []);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(erroInicial);
  const [erroEmail, setErroEmail] = useState<string | undefined>();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  /** Conta os erros: a cada um, o formulário treme de novo, como na web. */
  const [erros, setErros] = useState(0);
  const tremor = useTremor(erros);
  const emEnvio = useRef(false);
  const campoEmail = useRef<ComponentRef<typeof TextInput>>(null);
  const campoSenha = useRef<ComponentRef<typeof TextInput>>(null);
  const podeEntrar = !!email.trim() && !!senha && !ocupado;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!emEnvio.current) voltar();
      return true;
    });
    return () => assinatura.remove();
  }, [voltar]);

  async function abrirGoogle() {
    if (emEnvio.current) return;
    emEnvio.current = true; setOcupado(true); setErro(undefined); Keyboard.dismiss();
    try { await google(); }
    catch (e) { setErro(mensagemDeErro(e)); }
    finally { emEnvio.current = false; setOcupado(false); }
  }

  async function enviar() {
    if (emEnvio.current || !podeEntrar) return;
    // O e-mail é conferido no aparelho, como na web: o erro fica no campo, que recebe o foco.
    if (!formatoEmail.test(email.trim())) {
      setErroEmail(mensagens.entrada.emailInvalido);
      setErros((total) => total + 1);
      campoEmail.current?.focus();
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
      acoes={<Botao rotulo={mensagens.voltar} testID="voltar-boas-vindas" variante="texto" compacto desativado={ocupado} acao={voltar} />}
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
        {!googleDisponivel && <Text style={estilos.legenda}>{mensagens.acesso.googleIndisponivel}</Text>}
        <Text style={estilos.legenda}>{mensagens.acesso.ou}</Text>
        <Campo testID="login-email" rotulo={mensagens.entrada.email} value={email} campoRef={campoEmail} erro={erroEmail}
          onChangeText={(valor) => { setEmail(valor); setErro(undefined); setErroEmail(undefined); }}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" returnKeyType="next"
          textContentType={Platform.OS === 'ios' ? 'username' : undefined}
          autoComplete={Platform.OS === 'android' ? 'email' : undefined}
          editable={!ocupado} onSubmitEditing={() => campoSenha.current?.focus()} />
        <Campo testID="login-senha" rotulo={mensagens.entrada.senha} value={senha} campoRef={campoSenha}
          onChangeText={(valor) => { setSenha(valor); setErro(undefined); }} secureTextEntry={!mostrarSenha} returnKeyType="go"
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
  arte: { marginBottom: 24, borderRadius: 28 },
  banner: { marginBottom: 24, borderRadius: 24 },
  formulario: { gap: 20, marginTop: 28 },
  destaques: { gap: 12, marginTop: 24 },
  destaque: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  destaqueIcone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3 },
  destaque0: { backgroundColor: '#FFF3D1', borderBottomColor: '#FFE3A3' },
  destaque1: { backgroundColor: cores.acao, borderBottomColor: cores.acaoEscura },
  destaque2: { backgroundColor: cores.sucessoClaro, borderBottomColor: cores.sucesso },
  destaqueTexto: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 22 },
});
