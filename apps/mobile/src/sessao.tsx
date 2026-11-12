import { ErroStudoo } from '@studoo/contratos';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Platform, StyleSheet, Text, View, type TextInput } from 'react-native';
import { apagarToken, criarClienteNativo, guardarToken, lerToken, sessaoInvalida, type ClienteNativo } from './api-nativa';
import { Estudo } from './estudo';
import { Botao, Campo, EstadoMensagem, Skeleton, Tela, Titulo, estilos } from './interface';
import { mensagemDeErro, mensagens } from './mensagens';
import { cores } from './tema';

type Sessao =
  | { tipo: 'verificando' }
  | { tipo: 'entrada'; erro?: string }
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
      return <Entrada erroInicial={sessao.erro} entrar={entrar} />;
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

function Entrada({ erroInicial, entrar }: {
  erroInicial?: string;
  entrar: (email: string, senha: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(erroInicial);
  const [ocupado, setOcupado] = useState(false);
  const emEnvio = useRef(false);
  const campoSenha = useRef<ComponentRef<typeof TextInput>>(null);
  const podeEntrar = !!email.trim() && !!senha && !ocupado;

  async function enviar() {
    if (emEnvio.current || !podeEntrar) return;
    Keyboard.dismiss();
    emEnvio.current = true;
    setOcupado(true);
    setErro(undefined);

    try {
      await entrar(email.trim(), senha);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      if (falha instanceof ErroStudoo && falha.codigo === 'credenciais_invalidas') setSenha('');
    } finally {
      emEnvio.current = false;
      setOcupado(false);
    }
  }

  return (
    <Tela pagina="entrada"
      rodape={<Botao rotulo={ocupado ? mensagens.entrada.entrando : mensagens.entrada.entrar}
        testID="entrar" desativado={!podeEntrar} ocupado={ocupado} acao={() => void enviar()} />}>
      <Titulo testID="titulo-entrada" foco>{mensagens.entrada.titulo}</Titulo>
      <Text style={estilos.introducao}>{mensagens.entrada.texto}</Text>
      <View style={entradaEstilos.formulario}>
        <Campo testID="login-email" rotulo={mensagens.entrada.email} value={email}
          onChangeText={(valor) => { setEmail(valor); setErro(undefined); }}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" returnKeyType="next"
          textContentType={Platform.OS === 'ios' ? 'username' : undefined}
          autoComplete={Platform.OS === 'android' ? 'email' : undefined}
          editable={!ocupado} onSubmitEditing={() => campoSenha.current?.focus()} />
        <Campo testID="login-senha" rotulo={mensagens.entrada.senha} value={senha} campoRef={campoSenha}
          onChangeText={(valor) => { setSenha(valor); setErro(undefined); }} secureTextEntry returnKeyType="go"
          textContentType={Platform.OS === 'ios' ? 'password' : undefined}
          autoComplete={Platform.OS === 'android' ? 'current-password' : undefined}
          editable={!ocupado} onSubmitEditing={() => void enviar()} />
      </View>
      {erro && <EstadoMensagem mensagem={erro} />}
    </Tela>
  );
}

const entradaEstilos = StyleSheet.create({
  formulario: { gap: 16, marginTop: 24 },
});
