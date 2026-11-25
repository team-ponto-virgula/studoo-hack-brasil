import { ErroStudoo } from '@studoo/contratos';
import { normalizarEmailEntrada } from '@studoo/contratos/autenticacao';
import { useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type ViewStyle, type TextInputProps } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { criarClienteNativo } from './api-nativa';
import { appleDisponivelNoAparelho } from './apple-nativo';
import { googleNoAparelho } from './google-nativo';
import { LOGO_GOOGLE } from './marca-google';
import { Icone } from './icone';
import { RolagemDaTela, Tela } from './interface';
import { useMovimentoReduzido } from './movimento';
import { focarSemRolar } from './foco';
import { Stu } from './mascote';
import { mensagemDeErro, mensagens } from './mensagens';
import { abrirPaginaDoStudoo, enderecoDoStudoo } from './seguranca';
import { ouvirVoltar } from './voltar';

const cor = { texto: '#17213d', secundario: '#626b7e', azul: '#2854f4', borda: '#dce0e8', erro: '#b32735' };
const logo = require('../assets/marca/logo-com-sorriso.png');
const oculos = require('../assets/marca/abertura-oculos-hd.png');

/** Mesmas camadas originais da abertura; uma saudação breve, sem atrasar o acesso. */
export function LogoAcesso({ acontecimento = 'entrada' }: { acontecimento?: string }) {
  const reduzir = useMovimentoReduzido();
  const progresso = useRef(new Animated.Value(1)).current;
  const vistos = useRef(new Set<string>());
  useEffect(() => {
    if (reduzir === null) return;
    if (reduzir || vistos.current.has(acontecimento)) { vistos.current.add(acontecimento); progresso.stopAnimation(); progresso.setValue(1); return; }
    const estreia = vistos.current.size === 0;
    vistos.current.add(acontecimento);
    progresso.setValue(0);
    const animacao = Animated.timing(progresso, { toValue: 1, duration: estreia ? 780 : 440, easing: Easing.bezier(.22, 1, .36, 1), useNativeDriver: true });
    animacao.start();
    return () => { animacao.stop(); progresso.setValue(1); };
  }, [acontecimento, reduzir, progresso]);
  return <View accessible accessibilityRole="image" accessibilityLabel="Studoo" style={s.logo}>
    <View style={s.palavra} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Image source={logo} style={s.logoInteira} accessible={false} /></View>
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.oculos, { transform: [
      { translateY: progresso.interpolate({ inputRange: [0, .28, .58, 1], outputRange: [0, -4, -2, 0] }) },
      { rotate: progresso.interpolate({ inputRange: [0, .28, .58, 1], outputRange: ['0deg', '-7deg', '3deg', '0deg'] }) },
    ] }]}><Image source={oculos} style={s.imagemOculos} accessible={false} /></Animated.View>
  </View>;
}

export function AcessoTela({ children, pagina, voltar, ocupado = false, acontecimento }: { children: ReactNode; pagina: string; voltar?: () => void; ocupado?: boolean; acontecimento?: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return <Tela pagina={`acesso-${pagina}`} semCabecalho estiloConteudo={[s.conteudo, { paddingHorizontal: width < 375 ? 24 : 28 }]}>
    <View style={[s.pagina, { minHeight: Math.max(0, height - insets.top - insets.bottom - 56) }]}>
      <View style={s.cabecalho}><LogoAcesso acontecimento={acontecimento} />{voltar && <Pressable accessibilityRole="button" accessibilityLabel="Voltar" disabled={ocupado} testID="acesso-voltar" onPress={voltar} style={s.voltar}><Icone nome="setaVoltar" tamanho={22} cor={cor.secundario} /></Pressable>}</View>
      {children}
    </View>
  </Tela>;
}

/** Uma troca curta de conteúdo, sem espera para tocar, digitar ou receber foco. */
export function TransicaoAcesso({ children, chave, estilo }: { children: ReactNode; chave: string | number; estilo?: StyleProp<ViewStyle> }) {
  const reduzir = useMovimentoReduzido();
  const progresso = useRef(new Animated.Value(1)).current;
  const ultimo = useRef<string | number | undefined>(undefined);
  useEffect(() => {
    if (reduzir === null) return;
    if (reduzir || ultimo.current === chave) { ultimo.current = chave; progresso.stopAnimation(); progresso.setValue(1); return; }
    ultimo.current = chave; progresso.setValue(0);
    const animacao = Animated.timing(progresso, { toValue: 1, duration: 240, easing: Easing.bezier(.2, .7, .25, 1), useNativeDriver: true });
    animacao.start();
    return () => { animacao.stop(); progresso.setValue(1); };
  }, [chave, reduzir, progresso]);
  return <Animated.View style={[estilo, { opacity: progresso.interpolate({ inputRange: [0, 1], outputRange: [.35, 1] }), transform: [{ translateY: progresso.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>{children}</Animated.View>;
}

export function TituloAcesso({ children, testID, centro = false, foco = false }: { children: ReactNode; testID?: string; centro?: boolean; foco?: boolean }) {
  const { width } = useWindowDimensions();
  const ref = useRef<ComponentRef<typeof Text>>(null);
  useEffect(() => { if (foco) { const timer = setTimeout(() => focarSemRolar(ref.current), 80); return () => clearTimeout(timer); } }, [foco, children]);
  return <Text ref={ref} accessibilityRole="header" testID={testID} style={[s.titulo, width < 375 && { fontSize: 30, lineHeight: 36 }, centro && s.centro]}>{children}</Text>;
}

export function BotaoAcesso({ rotulo, acao, desativado = false, ocupado = false, testID, secundario = false, seta = false }: { rotulo: string; acao: () => void; desativado?: boolean; ocupado?: boolean; testID?: string; secundario?: boolean; seta?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: desativado || ocupado, busy: ocupado }} disabled={desativado || ocupado} testID={testID} onPress={acao}
    style={({ pressed }) => [s.botao, secundario && s.botaoSecundario, (desativado || ocupado) && { opacity: .65 }, pressed && { opacity: .9, transform: [{ scale: .99 }] }]}>
    {seta && <View style={{ width: 20 }} />}
    <Text style={[s.botaoTexto, secundario && { color: cor.texto }]}>{rotulo}</Text>
    {ocupado ? <ActivityIndicator size="small" color={secundario ? cor.azul : '#fff'} /> : seta ? <Icone nome="seta" tamanho={20} cor={secundario ? cor.azul : '#fff'} /> : null}
  </Pressable>;
}

export function LinkAcesso({ rotulo, acao, testID, desativado = false, discreto = false }: { rotulo: string; acao: () => void; testID?: string; desativado?: boolean; discreto?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: desativado }} disabled={desativado} testID={testID} onPress={acao} style={({ pressed }) => [s.link, pressed && { opacity: .65 }]}><Text style={[s.linkTexto, discreto && { color: cor.secundario, fontWeight: '500' }]}>{rotulo}</Text></Pressable>;
}

export function CampoAcesso({ rotulo, campoRef, erro, acessorio, rotuloOculto = false, ...props }: TextInputProps & { rotulo: string; campoRef?: Ref<ComponentRef<typeof TextInput>>; erro?: string; acessorio?: ReactNode; rotuloOculto?: boolean }) {
  const [focado, setFocado] = useState(false);
  const rolagem = useContext(RolagemDaTela);
  const caixa = useRef<ComponentRef<typeof View>>(null);
  const interno = useRef<ComponentRef<typeof TextInput> | null>(null);
  return <View ref={caixa} style={s.campo}>
    {!rotuloOculto && <Text accessible={false} style={s.rotulo} onPress={() => interno.current?.focus()}>{rotulo}</Text>}
    <View style={[s.caixaCampo, focado && { borderColor: cor.azul }, !!erro && { borderColor: cor.erro }]}>
      <TextInput {...props} ref={(no) => { interno.current = no; if (typeof campoRef === 'function') campoRef(no); else if (campoRef) (campoRef as { current: ComponentRef<typeof TextInput> | null }).current = no; }}
        accessibilityLabel={rotulo} accessibilityHint={[erro, props.accessibilityHint].filter(Boolean).join(' ') || undefined} aria-invalid={Boolean(erro)} placeholderTextColor="#687286"
        style={[s.entrada, !!acessorio && { paddingRight: 58 }, props.multiline && { minHeight: 120, textAlignVertical: 'top' }, props.style]}
        onFocus={(e) => { setFocado(true); rolagem?.focar(caixa.current); props.onFocus?.(e); }} onBlur={(e) => { setFocado(false); rolagem?.focar(null); props.onBlur?.(e); }} />
      {acessorio && <View style={s.acessorio}>{acessorio}</View>}
    </View>
    {erro && <Text accessibilityRole="alert" style={s.erro}>{erro}</Text>}
  </View>;
}

export function ErroAcesso({ mensagem }: { mensagem?: string }) {
  return mensagem ? <Text testID="acesso-erro" accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.erro}>{mensagem}</Text> : null;
}

export function RodapeAcesso() {
  return <View style={s.rodape}>
    {enderecoDoStudoo('/suporte') && <LinkAcesso rotulo="Ajuda" discreto acao={() => abrirPaginaDoStudoo('/suporte')} testID="login-ajuda" />}
    {enderecoDoStudoo('/privacidade') && <LinkAcesso rotulo="Privacidade" discreto acao={() => abrirPaginaDoStudoo('/privacidade')} testID="login-politica" />}
  </View>;
}

export function useConfigAcesso() {
  const [tentativa, setTentativa] = useState(0);
  const [config, setConfig] = useState({ google: false, apple: false, cadastro: false, recuperacao: false, visitante: false, carregada: false, erro: false });
  useEffect(() => {
    let ativo = true;
    void Promise.all([criarClienteNativo().configuracaoAcesso(), appleDisponivelNoAparelho().catch(() => false)])
      .then(([c, podeApple]) => { if (ativo) setConfig({ google: c.google && googleNoAparelho(), apple: c.apple === true && podeApple, cadastro: c.cadastro === true, recuperacao: c.recuperacao, visitante: c.visitante === true, carregada: true, erro: false }); })
      .catch(() => { if (ativo) setConfig((c) => ({ ...c, carregada: true, erro: true })); });
    return () => { ativo = false; };
  }, [tentativa]);
  return { ...config, tentar: () => setTentativa(t => t + 1) };
}

export function ProvedoresAcesso({ google, apple, config, ocupado, executar, divisor = true, prefixo = 'login' }: { google?: () => Promise<void>; apple?: () => Promise<void>; config: { google: boolean; apple: boolean }; ocupado: boolean; executar: (acao: () => Promise<void>) => void; divisor?: boolean; prefixo?: string }) {
  if (!(config.google && google) && !(config.apple && apple)) return null;
  return <View style={s.alternativas}>
    {divisor && <View style={s.divisor}><View style={s.linha} /><Text style={s.ou}>ou</Text><View style={s.linha} /></View>}
    {config.google && google && <Pressable accessibilityRole="button" accessibilityState={{ disabled: ocupado }} disabled={ocupado} onPress={() => executar(google)} testID={`${prefixo}-google`} style={({ pressed }) => [s.provedor, pressed && { backgroundColor: '#f7f8fc' }, ocupado && { opacity: .65 }]}>
      <Image source={LOGO_GOOGLE.fonte} style={{ width: 20, height: 20 }} accessible={false} /><Text style={s.provedorTexto}>{mensagens.acesso.google}</Text>
    </Pressable>}
    {config.apple && apple && <View testID={`${prefixo}-apple`} pointerEvents={ocupado ? 'none' : 'auto'} accessibilityState={{ disabled: ocupado }} style={ocupado ? { opacity: .65 } : undefined}>
      <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE} cornerRadius={12} style={{ width: '100%', height: 54 }} onPress={() => executar(apple)} />
    </View>}
  </View>;
}

export function EntradaMobile({ entrar, google, apple, criarConta, visitante, recuperar, erroInicial, voltar }: { entrar: (email: string, senha: string) => Promise<void>; google: () => Promise<void>; apple: () => Promise<void>; criarConta: (email: string) => void; visitante: () => Promise<void>; recuperar: (email: string) => void; erroInicial?: string; voltar?: () => void }) {
  const config = useConfigAcesso();
  const [etapa, setEtapa] = useState<'email' | 'senha'>('email');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [erro, setErro] = useState(erroInicial);
  const [erroEmail, setErroEmail] = useState<string>();
  const [erroSenha, setErroSenha] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const [avisoVisitante, setAvisoVisitante] = useState(false);
  const enviando = useRef(false);
  const focarSenhaAposEnvio = useRef(false);
  const campoEmail = useRef<ComponentRef<typeof TextInput>>(null);
  const campoSenha = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    if (!ocupado && focarSenhaAposEnvio.current) { focarSenhaAposEnvio.current = false; campoSenha.current?.focus(); }
  }, [ocupado]);
  function editar() { if (!enviando.current) { setEtapa('email'); setErro(undefined); setErroSenha(undefined); setMostrar(false); setTimeout(() => campoEmail.current?.focus(), 30); } }
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const assinatura = ouvirVoltar(() => { if (enviando.current) return true; if (etapa === 'senha') { editar(); return true; } if (voltar) { voltar(); return true; } return false; });
    return () => assinatura.remove();
  }, [etapa, voltar]);
  async function executar(acao: () => Promise<void>) {
    if (enviando.current) return;
    enviando.current = true; setOcupado(true); setErro(undefined); Keyboard.dismiss();
    try { await acao(); }
    catch (falha) {
      setErro(mensagemDeErro(falha));
      if (falha instanceof ErroStudoo && falha.codigo === 'credenciais_invalidas') { setSenha(''); focarSenhaAposEnvio.current = true; }
    } finally { enviando.current = false; setOcupado(false); }
  }
  function enviar() {
    if (enviando.current) return;
    const normalizado = normalizarEmailEntrada(email);
    if (!normalizado) { setErroEmail(mensagens.entrada.emailInvalido); campoEmail.current?.focus(); return; }
    setEmail(normalizado); setErroEmail(undefined);
    if (etapa === 'email') { setEtapa('senha'); setTimeout(() => campoSenha.current?.focus(), 30); return; }
    if (!senha) { setErroSenha(mensagens.entrada.senhaVazia); campoSenha.current?.focus(); return; }
    setErroSenha(undefined);
    void executar(() => entrar(normalizado, senha));
  }
  return <AcessoTela pagina="entrada" voltar={etapa === 'senha' ? editar : voltar} ocupado={ocupado} acontecimento={etapa}>
    <View style={s.boas}><TituloAcesso testID="titulo-entrada">{etapa === 'email' ? 'Olá de novo.' : 'Sua senha.'}</TituloAcesso><Text style={s.descricao}>{etapa === 'email' ? 'Entre para continuar aprendendo.' : 'Use a senha da sua conta Studoo.'}</Text></View>
    <TransicaoAcesso chave={etapa} estilo={s.formulario}>
      {etapa === 'email' ? <CampoAcesso rotulo="E-mail" testID="login-email" campoRef={campoEmail} value={email} erro={erroEmail} onChangeText={v => { setEmail(v); setErroEmail(undefined); setErro(undefined); }} placeholder="voce@exemplo.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="username" textContentType="username" maxLength={254} editable={!ocupado} returnKeyType="next" onSubmitEditing={enviar} /> : <>
        <View style={s.emailContexto}><Text style={s.emailTexto}>{email}</Text><LinkAcesso rotulo="Alterar" acao={editar} desativado={ocupado} testID="login-alterar-email" /></View>
        <View style={s.labelSenha}><Text style={s.rotulo}>Senha</Text>{config.recuperacao && <LinkAcesso rotulo="Esqueci minha senha" acao={() => recuperar(email)} desativado={ocupado} testID="esqueci-senha" />}</View>
        <CampoAcesso rotulo="Senha" rotuloOculto testID="login-senha" campoRef={campoSenha} value={senha} erro={erroSenha} onChangeText={v => { setSenha(v); setErroSenha(undefined); setErro(undefined); }} placeholder="Sua senha" secureTextEntry={!mostrar} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" maxLength={256} editable={!ocupado} returnKeyType="go" onSubmitEditing={enviar}
          onKeyPress={evento => { const e = evento.nativeEvent as unknown as { getModifierState?: (key: string) => boolean }; if (e.getModifierState) setCapsLock(e.getModifierState('CapsLock')); }}
          acessorio={<Pressable accessibilityRole="button" accessibilityLabel={mostrar ? 'Ocultar senha' : 'Mostrar senha'} accessibilityState={{ selected: mostrar, disabled: ocupado }} testID="mostrar-senha" disabled={ocupado} onPress={() => setMostrar(v => !v)} style={s.olho}><Icone nome={mostrar ? 'olhoFechado' : 'olho'} tamanho={22} cor={cor.secundario} /></Pressable>} />
        {capsLock && <Text accessibilityLiveRegion="polite" style={s.erro}>{mensagens.entrada.capsLock}</Text>}
      </>}
      <ErroAcesso mensagem={erro} />
      <BotaoAcesso rotulo={ocupado ? 'Entrando…' : etapa === 'email' ? 'Continuar' : 'Entrar'} acao={enviar} ocupado={ocupado} testID="login-entrar" seta />
    </TransicaoAcesso>
    {etapa === 'senha' ? <LinkAcesso rotulo="Outras formas de entrar" acao={editar} desativado={ocupado} discreto testID="login-outros-metodos" /> : <>
      <ProvedoresAcesso config={config} google={google} apple={apple} ocupado={ocupado} executar={acao => void executar(acao)} />
      <View style={s.outros}>
        {(config.cadastro || config.google || config.apple) && <View style={s.cadastroLinha}><Text style={s.outrosTexto}>Ainda não tem conta?</Text><LinkAcesso rotulo="Criar conta" acao={() => criarConta(email)} desativado={ocupado} testID="criar-conta" /></View>}
        {config.visitante && <><LinkAcesso rotulo="Experimentar sem conta" discreto acao={() => setAvisoVisitante(v => !v)} desativado={ocupado} testID="experimentar-sem-conta" />{avisoVisitante && <View style={s.avisoVisitante}><Text style={s.descricao}>Seu progresso fica por até 24 horas neste aparelho e não é transferido para uma conta.</Text><LinkAcesso rotulo="Começar como visitante" acao={() => void executar(visitante)} desativado={ocupado} testID="confirmar-visitante" /></View>}</>}
      </View>
    </>}
    <RodapeAcesso />
  </AcessoTela>;
}

const beneficios = [
  { titulo: 'Seu assunto vira\numa trilha.', descricao: 'Conte o que quer aprender ou traga um material. O Studoo organiza o caminho para você.', stu: 'stu-acolhida' as const },
  { titulo: 'Um erro abre\noutro caminho.', descricao: 'Errou uma resposta? Veja outra explicação e tente de novo.', stu: 'stu-feliz' as const },
  { titulo: 'Continue de\nonde parou.', descricao: 'Na sua conta, veja o que já aprendeu e encontre seu próximo passo quando voltar.', stu: 'stu-celebrando' as const },
];

export function BoasVindasMobile({ entrar, criarConta }: { entrar: () => void; criarConta: () => void }) {
  const [pagina, setPagina] = useState(0);
  const config = useConfigAcesso();
  const atual = beneficios[pagina];
  const podeCriar = config.cadastro || config.google || config.apple;
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const assinatura = ouvirVoltar(() => { if (pagina > 0) { setPagina(p => p - 1); return true; } return false; }, pagina > 0);
    return () => assinatura.remove();
  }, [pagina]);
  return <AcessoTela pagina="boas-vindas">
    <TransicaoAcesso chave={pagina} estilo={s.beneficio}>
      <View style={s.stu}><Stu nome={atual.stu} tamanho={150} /></View>
      <TituloAcesso testID="titulo-boas-vindas" centro foco>{atual.titulo}</TituloAcesso>
      <Text style={[s.descricao, s.descricaoBeneficio]}>{atual.descricao}</Text>
      <View style={s.exemplo}>
        <Text style={s.seloExemplo}>Exemplo</Text>
        {pagina === 0 ? <><View style={s.linhaExemplo}><Icone nome="livro" tamanho={20} cor={cor.secundario} /><Text style={s.exemploTexto}>Quero aprender SQL</Text></View><View style={s.linhaExemplo}><View style={{ transform: [{ rotate: '90deg' }] }}><Icone nome="seta" tamanho={20} cor={cor.azul} /></View><Text style={s.exemploResultado}>Sua trilha <Text style={s.exemploDetalhe}>· 5 lições</Text></Text></View></> : pagina === 1 ? <><Text style={[s.exemploTexto, { color: '#8f591b' }]}>↻  Ainda não foi dessa vez</Text><View style={s.linhaExemplo}><Text style={[s.exemploResultado, { flex: 1 }]}>Outro jeito de entender</Text><Icone nome="seta" tamanho={18} cor={cor.azul} /></View></> : <><View style={s.linhaExemplo}><Text style={[s.exemploTexto, { flex: 1 }]}>SQL para a prova</Text><Text style={s.exemploDetalhe}>1 de 5 lições</Text></View><View accessible accessibilityRole="progressbar" accessibilityLabel="Exemplo: 1 de 5 lições concluídas" accessibilityValue={{ min: 0, max: 5, now: 1 }} style={s.trilho}><View style={s.progresso} /></View><View style={s.linhaExemplo}><Text style={[s.exemploResultado, { flex: 1 }]}>Próximo: conectar tabelas</Text><Icone nome="seta" tamanho={18} cor={cor.azul} /></View></>}
      </View>
    </TransicaoAcesso>
    <View style={s.acoesBeneficio}>
      <View style={s.paginas}>{beneficios.map((b, i) => <Pressable key={b.titulo} accessibilityRole="button" accessibilityLabel={b.titulo.replace('\n', ' ')} accessibilityState={{ selected: i === pagina }} onPress={() => setPagina(i)} testID={`boas-vindas-pagina-${i + 1}`} style={s.pontoAlvo}><View style={[s.ponto, i === pagina && s.pontoAtual]} /></Pressable>)}</View>
      <BotaoAcesso rotulo={pagina < 2 ? 'Continuar' : podeCriar ? 'Criar minha conta' : 'Entrar no Studoo'} testID="boas-vindas-continuar" seta acao={() => pagina < 2 ? setPagina(p => p + 1) : podeCriar ? criarConta() : entrar()} />
      <LinkAcesso rotulo="Já tenho conta" discreto acao={entrar} testID="boas-vindas-entrar" />
    </View>
  </AcessoTela>;
}

export const acessoEstilos = StyleSheet.create({ descricao: { color: cor.secundario, fontFamily: 'Inter', fontSize: 15, lineHeight: 24 }, bloco: { gap: 14 }, espaco: { marginTop: 32 }, contexto: { flexDirection: 'row', alignItems: 'center', gap: 12 }, contextoTexto: { flex: 1, color: cor.secundario, fontFamily: 'Inter', fontSize: 14, lineHeight: 22 }, olho: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' } });

const s = StyleSheet.create({
  conteudo: { maxWidth: 430, paddingTop: 28, paddingBottom: 20, backgroundColor: '#fff' }, pagina: { width: '100%' },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }, voltar: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 144, height: 144 * 184 / 560 }, palavra: { position: 'absolute', left: 0, top: 0, width: 144 * 348 / 560, height: 144 * 184 / 560, overflow: 'hidden' }, logoInteira: { width: 144, height: 144 * 184 / 560 },
  oculos: { position: 'absolute', left: 144 * 348 / 560, top: 0, width: 144 * 212 / 560, height: 144 * 184 / 560 }, imagemOculos: { position: 'absolute', left: -144 * 348 / 560, top: 0, width: 144, height: 144 * 184 / 560 },
  titulo: { color: cor.texto, fontFamily: 'Inter', fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1 }, centro: { textAlign: 'center' },
  boas: { marginTop: 36, gap: 12 }, descricao: { color: cor.secundario, fontFamily: 'Inter', fontSize: 15, lineHeight: 24 }, formulario: { marginTop: 32, gap: 14 },
  campo: { gap: 10 }, rotulo: { color: cor.texto, fontFamily: 'Inter', fontSize: 14, lineHeight: 20, fontWeight: '600' }, caixaCampo: { borderWidth: 1, borderColor: '#8590a6', borderRadius: 12, backgroundColor: '#fafbfe' },
  entrada: { minHeight: 54, paddingVertical: 14, paddingHorizontal: 16, color: cor.texto, fontFamily: 'Inter', fontSize: 16, lineHeight: 24 }, acessorio: { position: 'absolute', right: 3, top: 0, bottom: 0, justifyContent: 'center' }, olho: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', minHeight: 56, paddingHorizontal: 18, paddingVertical: 16, backgroundColor: cor.azul, borderRadius: 12 }, botaoSecundario: { backgroundColor: '#fff', borderWidth: 1, borderColor: cor.borda }, botaoTexto: { flexShrink: 1, flexGrow: 1, textAlign: 'center', color: '#fff', fontFamily: 'Inter', fontSize: 16, lineHeight: 24, fontWeight: '600' },
  erro: { color: cor.erro, fontFamily: 'Inter', fontSize: 13, lineHeight: 20 }, link: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }, linkTexto: { color: cor.azul, fontFamily: 'Inter', fontWeight: '600', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  alternativas: { gap: 10 }, divisor: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10, marginBottom: 10 }, linha: { height: 1, flex: 1, backgroundColor: '#e8ebf1' }, ou: { color: '#70798a', fontFamily: 'Inter', fontSize: 13, lineHeight: 20 }, provedor: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, minHeight: 54, padding: 14, borderWidth: 1, borderColor: cor.borda, borderRadius: 12 }, provedorTexto: { color: cor.texto, fontFamily: 'Inter', fontSize: 15, lineHeight: 23, fontWeight: '500', flexShrink: 1 },
  outros: { marginTop: 22 }, cadastroLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 5 }, outrosTexto: { color: cor.secundario, fontFamily: 'Inter', fontSize: 14, lineHeight: 22 }, rodape: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 'auto', paddingTop: 28 }, emailContexto: { flexDirection: 'row', alignItems: 'center', gap: 12 }, emailTexto: { color: cor.secundario, fontFamily: 'Inter', fontSize: 14, lineHeight: 22, flex: 1 }, labelSenha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }, avisoVisitante: { padding: 14, borderRadius: 12, backgroundColor: '#f6f8fd', gap: 6 },
  beneficio: { alignItems: 'stretch', marginTop: 12 }, stu: { alignItems: 'center', marginBottom: 16 }, descricaoBeneficio: { fontSize: 16, lineHeight: 24, minHeight: 72, marginTop: 12, textAlign: 'center' }, exemplo: { padding: 16, minHeight: 122, borderRadius: 16, backgroundColor: '#f6f8fd', gap: 9, marginTop: 18 }, seloExemplo: { color: cor.secundario, fontFamily: 'Inter', fontSize: 11, lineHeight: 17 }, linhaExemplo: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, exemploTexto: { color: cor.texto, fontFamily: 'Inter', fontWeight: '500', fontSize: 14, lineHeight: 21 }, exemploResultado: { color: cor.azul, fontFamily: 'Inter', fontWeight: '500', fontSize: 14, lineHeight: 21 }, exemploDetalhe: { color: cor.secundario, fontFamily: 'Inter', fontSize: 13, lineHeight: 21, fontWeight: '400' }, trilho: { height: 6, borderRadius: 5, backgroundColor: '#dfe6f4', overflow: 'hidden' }, progresso: { height: 6, width: '20%', borderRadius: 5, backgroundColor: cor.azul }, acoesBeneficio: { marginTop: 'auto', paddingTop: 5 }, paginas: { flexDirection: 'row', justifyContent: 'center', minHeight: 44 }, pontoAlvo: { width: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, ponto: { width: 6, height: 6, borderRadius: 5, backgroundColor: '#a1adc2' }, pontoAtual: { width: 18, backgroundColor: cor.azul },
});
