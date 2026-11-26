import { ErroStudoo } from '@studoo/contratos';
import { codigoAceito, normalizarEmailEntrada, senhaAceita } from '@studoo/contratos/autenticacao';
import { CAMINHO_POLITICA } from '@studoo/contratos/privacidade';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { criarClienteNativo, origemConfigurada } from './api-nativa';
import { AcessoTela, BotaoAcesso, CampoAcesso, ErroAcesso, LinkAcesso, ProvedoresAcesso, RodapeAcesso, TituloAcesso, acessoEstilos, useConfigAcesso } from './acesso-mobile';
import { Icone } from './icone';
import { mensagemDeErro, mensagens } from './mensagens';
import { abrirNoNavegador } from './social';
import { ouvirVoltar } from './voltar';

const m = mensagens.cadastro;

/** A política pública continua disponível antes de criar uma conta. */
export function enderecoDaPoliticaPublica() {
  try { return new URL(CAMINHO_POLITICA, origemConfigurada()).toString(); }
  catch { return null; }
}

/** Três passos reais. O código só é confirmado pelo servidor junto da criação final. */
export function CriarConta({ emailInicial, voltar, criar, google, apple }: {
  emailInicial: string;
  voltar: () => void;
  google?: () => Promise<void>;
  apple?: () => Promise<void>;
  criar: (email: string, codigo: string, senha: string) => Promise<void>;
}) {
  const config = useConfigAcesso();
  const [etapa, setEtapa] = useState<'email' | 'codigo' | 'senha'>('email');
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string>();
  const [erroCampo, setErroCampo] = useState<{ email?: string; codigo?: string; senha?: string; confirmacao?: string }>({});
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(0);
  const emCurso = useRef(false);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const codigoRef = useRef<ComponentRef<typeof TextInput>>(null);
  const senhaRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmacaoRef = useRef<ComponentRef<typeof TextInput>>(null);
  const politica = enderecoDaPoliticaPublica();
  const temProvedores = Boolean((config.google && google) || (config.apple && apple));

  function editarEmail() {
    if (emCurso.current) return;
    setEtapa('email'); setCodigo(''); setSenha(''); setConfirmacao(''); setMostrar(false); setErro(undefined); setErroCampo({});
    setTimeout(() => emailRef.current?.focus(), 30);
  }
  function retornar() {
    if (emCurso.current) return;
    if (etapa === 'senha') { setEtapa('codigo'); setErro(undefined); setErroCampo({}); }
    else if (etapa === 'codigo') editarEmail();
    else voltar();
  }
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const evento = ouvirVoltar(() => { retornar(); return true; });
    return () => evento.remove();
  }, [etapa, voltar]);
  useEffect(() => {
    if (etapa === 'email') return;
    const timer = setTimeout(() => (etapa === 'codigo' ? codigoRef : senhaRef).current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [etapa]);
  useEffect(() => {
    if (!espera) return;
    const timer = setTimeout(() => setEspera(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [espera]);

  async function executar(acao: () => Promise<void>, aoFalhar?: (erro: unknown) => void) {
    if (emCurso.current) return;
    emCurso.current = true; setOcupado(true); setErro(undefined); setErroCampo({}); Keyboard.dismiss();
    try { await acao(); }
    catch (falha) { setErro(mensagemDeErro(falha)); aoFalhar?.(falha); }
    finally { emCurso.current = false; setOcupado(false); }
  }
  function enviar() {
    if (emCurso.current || !config.cadastro) return;
    const normalizado = normalizarEmailEntrada(email);
    if (!normalizado) { setErroCampo({ email: m.emailInvalido }); emailRef.current?.focus(); return; }
    void executar(async () => {
      await criarClienteNativo().pedirCodigoCadastro(normalizado, true);
      setEmail(normalizado); setCodigo(''); setEtapa('codigo'); setEspera(60);
    });
  }
  function continuarCodigo() {
    if (emCurso.current) return;
    if (!codigoAceito(codigo)) { setErroCampo({ codigo: m.codigoInvalido }); codigoRef.current?.focus(); return; }
    setErroCampo({}); setErro(undefined); setEtapa('senha');
  }
  function concluir() {
    if (emCurso.current || !config.cadastro) return;
    const normalizado = normalizarEmailEntrada(email);
    if (!normalizado) { setEtapa('email'); setErroCampo({ email: m.emailInvalido }); return; }
    if (!codigoAceito(codigo)) { setEtapa('codigo'); setErroCampo({ codigo: m.codigoInvalido }); return; }
    if (!senhaAceita(senha)) { setErroCampo({ senha: m.senhaInvalida }); senhaRef.current?.focus(); return; }
    if (senha !== confirmacao) { setErroCampo({ confirmacao: m.senhasDiferentes }); confirmacaoRef.current?.focus(); return; }
    void executar(() => criar(normalizado, codigo, senha), falha => {
      if (falha instanceof ErroStudoo && falha.codigo === 'codigo_invalido') {
        setEtapa('codigo'); setErroCampo({ codigo: mensagemDeErro(falha) });
      }
    });
  }
  const titulo = etapa === 'email' ? 'Vamos começar.' : etapa === 'codigo' ? 'Confira seu e-mail.' : 'Proteja sua conta.';
  const descricao = etapa === 'email' ? 'Crie sua conta e prepare seu primeiro estudo.' : etapa === 'codigo' ? m.enviado : 'Escolha uma senha para voltar quando quiser.';
  return <AcessoTela pagina={`cadastro-${etapa}`} voltar={retornar} ocupado={ocupado} acontecimento={etapa}>
    <View style={s.cabeca}><TituloAcesso testID="titulo-cadastro">{titulo}</TituloAcesso><Text testID="cadastro-instrucao" style={acessoEstilos.descricao}>{descricao}</Text></View>
    <View style={s.formulario}>
      {config.cadastro ? <>
        {etapa !== 'email' && <View style={acessoEstilos.contexto}><Text style={acessoEstilos.contextoTexto}>{email}</Text><LinkAcesso rotulo="Alterar" testID="cadastro-alterar-email" acao={editarEmail} desativado={ocupado} /></View>}
        {etapa === 'email' && <CampoAcesso rotulo="E-mail" testID="cadastro-email" campoRef={emailRef} value={email} erro={erroCampo.email} placeholder="voce@exemplo.com" onChangeText={v => { setEmail(v); setErroCampo({}); setErro(undefined); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" maxLength={254} editable={!ocupado} returnKeyType="send" onSubmitEditing={enviar} />}
        {etapa === 'codigo' && <>
          <CampoAcesso rotulo={m.codigo} testID="cadastro-codigo" campoRef={codigoRef} value={codigo} erro={erroCampo.codigo} placeholder="000000" onChangeText={v => { setCodigo(v.replace(/\D/g, '')); setErroCampo({}); setErro(undefined); }} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} editable={!ocupado} returnKeyType="next" onSubmitEditing={continuarCodigo} />
          <Text style={s.dica}>{m.validade}</Text>
        </>}
        {etapa === 'senha' && <>
          <CampoAcesso rotulo={m.senha} testID="cadastro-senha" campoRef={senhaRef} value={senha} erro={erroCampo.senha} onChangeText={v => { setSenha(v); setErroCampo({}); setErro(undefined); }} secureTextEntry={!mostrar} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" maxLength={256} editable={!ocupado} returnKeyType="next" onSubmitEditing={() => confirmacaoRef.current?.focus()}
            acessorio={<Pressable accessibilityRole="button" accessibilityLabel={mostrar ? 'Ocultar senha' : 'Mostrar senha'} accessibilityState={{ selected: mostrar, disabled: ocupado }} testID="cadastro-mostrar-senha" disabled={ocupado} onPress={() => setMostrar(v => !v)} style={acessoEstilos.olho}><Icone nome={mostrar ? 'olhoFechado' : 'olho'} tamanho={22} cor="#626b7e" /></Pressable>} />
          <Text style={s.dica}>{m.dicaSenha}</Text>
          <CampoAcesso rotulo={m.confirmarSenha} testID="cadastro-confirmacao" campoRef={confirmacaoRef} value={confirmacao} erro={erroCampo.confirmacao} onChangeText={v => { setConfirmacao(v); setErroCampo({}); setErro(undefined); }} secureTextEntry={!mostrar} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" maxLength={256} editable={!ocupado} returnKeyType="go" onSubmitEditing={concluir} />
        </>}
        <ErroAcesso mensagem={erro} />
        <BotaoAcesso rotulo={etapa === 'email' ? ocupado ? m.enviando : m.enviar : etapa === 'codigo' ? 'Continuar' : ocupado ? m.criando : m.criar} testID="cadastro-enviar" ocupado={ocupado} seta acao={etapa === 'email' ? enviar : etapa === 'codigo' ? continuarCodigo : concluir} />
        {etapa === 'codigo' && <LinkAcesso rotulo={espera ? m.aguarde(espera) : m.reenviar} testID="cadastro-reenviar" discreto desativado={ocupado || espera > 0} acao={enviar} />}
      </> : !config.carregada ? <Text accessibilityLiveRegion="polite" style={acessoEstilos.descricao}>Verificando formas de criar sua conta…</Text> : config.erro ? <><ErroAcesso mensagem="Não foi possível verificar as formas de criar sua conta." /><BotaoAcesso rotulo="Tentar novamente" acao={config.tentar} secundario testID="cadastro-tentar-config" /></> : !temProvedores ? <Text style={acessoEstilos.descricao}>A criação de contas está indisponível neste momento. Se já tem uma conta, você pode entrar.</Text> : null}
    </View>
    {etapa === 'email' && <ProvedoresAcesso config={config} google={google} apple={apple} ocupado={ocupado} executar={acao => void executar(acao)} divisor={config.cadastro} prefixo="cadastro" />}
    {!config.cadastro && <ErroAcesso mensagem={erro} />}
    <View style={s.links}>
      {politica && <LinkAcesso rotulo={m.politica} testID="cadastro-politica" discreto desativado={ocupado} acao={() => abrirNoNavegador(politica)} />}
      <LinkAcesso rotulo="Já tenho conta" testID="cadastro-ja-tenho-conta" desativado={ocupado} acao={voltar} />
    </View>
    <RodapeAcesso />
  </AcessoTela>;
}

const s = StyleSheet.create({
  cabeca: { marginTop: 36, gap: 12 }, formulario: { marginTop: 32, gap: 14 }, links: { marginTop: 20, gap: 4 }, dica: { color: '#626b7e', fontFamily: 'Inter', fontSize: 13, lineHeight: 20 },
});
