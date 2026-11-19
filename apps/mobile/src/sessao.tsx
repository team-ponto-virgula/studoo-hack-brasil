import { ErroStudoo } from '@studoo/contratos';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Animated, Keyboard, LayoutAnimation, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type TextInput } from 'react-native';
import { useTremor } from './animacoes';
import { apagarToken, criarClienteNativo, guardarToken, lerToken, sessaoInvalida, type ClienteNativo } from './api-nativa';
import { entrarComGoogle } from './google-nativo';
import { entrarComoVisitante } from './visitante-nativo';
import { Apresentacao } from './apresentacao';
import { RecuperarAcesso } from './recuperar';
import { Estudo } from './estudo';
import { Botao, BotaoIcone, Campo, EstadoErro, Tela, Titulo, estilos, useMovimentoReduzido } from './interface';
import { ESPERA_DA_MEDIDA_MS, ESTADO_INICIAL_DA_ENTRADA, ILUSTRACAO_MAXIMA, MARGEM_DA_ILUSTRACAO, proximoEstadoDaEntrada, type EstadoDaEntrada } from './entrada-medidas';
import { SkeletonTrilha } from './caminho';
import { NavegacaoContexto } from './navegacao';
import { apagarTinhaTrilhas, lerTinhaTrilhas } from './preferencias';
import { mensagemDeErro, mensagens } from './mensagens';
import { Paisagem } from './mundo';
import { Stu } from './mascote';
import { cores, fontes } from './tema';

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
  const [tinhaTrilhas, setTinhaTrilhas] = useState(false);
  useEffect(() => {
    void lerTinhaTrilhas().then(setTinhaTrilhas);
  }, []);

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
        visitante={async () => { const token = await entrarComoVisitante(); setSessao({ tipo: 'ativa', cliente: criarClienteNativo(token) }); }}
        recuperar={(email) => setSessao({ tipo: 'recuperar', email })} />;
    case 'recuperar':
      return <RecuperarAcesso emailInicial={sessao.email} voltar={() => setSessao({ tipo: 'entrada' })} />;
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

async function encerrarNoAparelho(erro?: string): Promise<Sessao> {
  // Como a web ao sair ou com a sessão vencida: some a marca de "tinha trilhas" (o próximo esqueleto fica sem abas).
  await apagarTinhaTrilhas();
  try {
    await apagarToken();
    return { tipo: 'entrada', erro };
  } catch (falha) {
    return { tipo: 'entrada', erro: mensagemDeErro(falha) };
  }
}

/**
 * O Stu na paisagem (spec 13): `stu-acolhida` com a sombra de contato, acenando em laço (emenda E1); para quando um campo
 * recebe foco (a parte de cima recolhe) e com movimento reduzido fica a imagem parada.
 */
function StuAcenando({ largura, esquerda, pausado }: { largura: number; esquerda: number; pausado: boolean }) {
  return (
    <View style={{ position: 'absolute', bottom: '7%', left: esquerda }}>
      <Stu nome="stu-acolhida" tamanho={largura} animado="laco" pausado={pausado} sombra />
    </View>
  );
}


/**
 * A parte de cima da entrada: a ilustração na altura que sobra (recortada de cima, com as colinas e o Stu embaixo), o
 * título e a descrição. Com o teclado aberto ou o foco no formulário, recolhe (fica montada, sem altura e escondida do
 * leitor de tela), para E-mail, Senha e "Entrar" ficarem juntos na tela.
 */
function TopoDaEntrada({ ilustracao, nivel, recolher, respiro }: { ilustracao: number; nivel: number; recolher: boolean; respiro: number }) {
  // A conta de hoje, com o teto de 76 da spec 13 (A2).
  const stu = Math.max(28, Math.min(76, Math.round((ilustracao - 14) / 1.1)));
  return (
    <View testID="entrada-topo" style={recolher ? entradaEstilos.recolhido : respiro > 0 ? { marginTop: respiro } : null}
      importantForAccessibility={recolher ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={recolher}>
      {ilustracao > 0 && (
        <View testID="entrada-ilustracao" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          style={[entradaEstilos.banner, { height: ilustracao }]}>
          <View style={{ marginTop: ilustracao - ILUSTRACAO_MAXIMA }}>
            <Paisagem altura={ILUSTRACAO_MAXIMA} compacta estilo={entradaEstilos.paisagem}>
              {(l) => <StuAcenando largura={stu} esquerda={l / 2 - stu / 2} pausado={recolher} />}
            </Paisagem>
          </View>
        </View>
      )}
      <Titulo foco testID="titulo-entrada" estilo={nivel >= 2 ? entradaEstilos.tituloCompacto : undefined}>{mensagens.entrada.titulo}</Titulo>
      {/* Nível 3 (só em tela muito baixa): a descrição é a última a ceder e sai; o título e "Ver como funciona" ficam. */}
      {nivel < 3 && <Text testID="entrada-descricao" style={[estilos.introducao, nivel >= 2 && entradaEstilos.textoCompacto]}>{mensagens.entrada.texto}</Text>}
    </View>
  );
}

function Entrada({ erroInicial, entrar, google, visitante, recuperar }: {
  google: () => Promise<void>;
  /** "Experimentar sem conta" (rodada 4.3): só aparece quando o servidor oferece o visitante. */
  visitante: () => Promise<void>;
  recuperar: (email: string) => void;
  erroInicial?: string;
  entrar: (email: string, senha: string) => Promise<void>;
}) {
  // Como na web (rodada 4A): o Google e o "Esqueci minha senha" só aparecem quando o servidor os oferece; nada apagado.
  const [googleDisponivel, setGoogleDisponivel] = useState(false);
  const [recuperacaoDisponivel, setRecuperacaoDisponivel] = useState(false);
  const [visitanteDisponivel, setVisitanteDisponivel] = useState(false);
  const [experimentando, setExperimentando] = useState(false);
  /** "Ver como funciona" (rodada 4.4 da web): a apresentação sem sessão, aberta da própria entrada. */
  const [vendoApresentacao, setVendoApresentacao] = useState(false);
  const linkComoFunciona = useRef<ComponentRef<typeof Pressable>>(null);
  const devolverFoco = useRef(false);
  // Ao fechar a apresentação, o foco do leitor de tela volta ao link (depois de a entrada montar de novo).
  useEffect(() => {
    if (vendoApresentacao || !devolverFoco.current) return;
    devolverFoco.current = false;
    const espera = setTimeout(() => {
      if (linkComoFunciona.current) AccessibilityInfo.sendAccessibilityEvent(linkComoFunciona.current, 'focus');
      // Na prévia web, o foco do teclado também volta para o link.
      (linkComoFunciona.current as unknown as { focus?: () => void } | null)?.focus?.();
    }, 150);
    return () => clearTimeout(espera);
  }, [vendoApresentacao]);
  const [configuracaoCarregada, setConfiguracaoCarregada] = useState(false);
  useEffect(() => {
    let ativo = true;
    void criarClienteNativo().configuracaoAcesso()
      .then((c) => { if (ativo) { setGoogleDisponivel(c.google); setRecuperacaoDisponivel(c.recuperacao); setVisitanteDisponivel(c.visitante === true); } })
      .catch(() => {})
      .finally(() => { if (ativo) setConfiguracaoCarregada(true); });
    return () => { ativo = false; };
  }, []);
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

  // Entrada sem rolar (regra do dono, spec 04): tudo cabe de uma vez. Cede, nesta ordem: a ilustração (da altura que
  // sobra até 140; abaixo de 44, sai), os espaços (nível 1), o tamanho do título e da descrição (nível 2) e a descrição
  // (nível 3).
  const reduzirMovimento = useMovimentoReduzido();
  const janela = useWindowDimensions();
  const [medidas, setMedidas] = useState({ visivel: 0, conteudo: 0 });
  // Nível, ilustração e respiro (entrada-medidas.ts): o respiro é o que sobra quando a ilustração sai (abaixo de 44 pt) ou
  // já está no máximo (140), metade acima do título e metade acima do formulário, em vez de um vão só embaixo.
  const [{ nivel, ilustracao, respiro }, setEstado] = useState<EstadoDaEntrada>(ESTADO_INICIAL_DA_ENTRADA);
  const [tecladoAberto, setTecladoAberto] = useState(false);
  const [focoNoFormulario, setFocoNoFormulario] = useState(false);
  const recolher = tecladoAberto || focoNoFormulario;
  const animarTroca = () => {
    if (Platform.OS === 'ios' && reduzirMovimento === false) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };
  useEffect(() => {
    const abriu = Keyboard.addListener('keyboardDidShow', () => { animarTroca(); setTecladoAberto(true); });
    const fechou = Keyboard.addListener('keyboardDidHide', () => { animarTroca(); setTecladoAberto(false); });
    return () => { abriu.remove(); fechou.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Tela mais alta (outro aparelho, janela que cresceu): recomeça do nível 0.
  useEffect(() => { setEstado(ESTADO_INICIAL_DA_ENTRADA); }, [janela.height]);
  useEffect(() => {
    if (recolher || !medidas.visivel || !medidas.conteudo) return;
    // Decide só com as medidas paradas (a primeira passada de layout ainda mexe): sem isso, uma medida de passagem subia o
    // nível sem precisar, e o nível não volta sozinho.
    const espera = setTimeout(() => setEstado((atual) => proximoEstadoDaEntrada(medidas.visivel, medidas.conteudo, atual)), ESPERA_DA_MEDIDA_MS);
    return () => clearTimeout(espera);
  }, [medidas, recolher, nivel, ilustracao, respiro]);

  async function abrirGoogle() {
    if (emEnvio.current) return;
    emEnvio.current = true; setOcupado(true); setErro(undefined); Keyboard.dismiss();
    try { await google(); }
    catch (e) { setErro(mensagemDeErro(e)); }
    finally { emEnvio.current = false; setOcupado(false); }
  }

  /** Entra como visitante: o mesmo bloqueio do login (um envio por vez) e o erro no cartão, com o tremor. */
  async function experimentar() {
    if (emEnvio.current) return;
    emEnvio.current = true; setOcupado(true); setExperimentando(true); setErro(undefined); Keyboard.dismiss();
    try { await visitante(); }
    catch (e) { setErro(mensagemDeErro(e)); setErros((total) => total + 1); }
    finally { emEnvio.current = false; setOcupado(false); setExperimentando(false); }
  }

  if (vendoApresentacao) {
    return (
      <Apresentacao primeiraVez={false} semSessao
        rotuloFinalUltimo={visitanteDisponivel ? mensagens.acesso.experimentar : undefined}
        concluir={(_area, concluiuFinal) => {
          // Com o visitante ligado, o último passo já entra como visitante; senão ("Entendi", "Pular", voltar), volta à entrada.
          if (concluiuFinal && visitanteDisponivel) {
            setVendoApresentacao(false);
            void experimentar();
            return;
          }
          devolverFoco.current = true;
          setVendoApresentacao(false);
        }} />
    );
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
    <Tela pagina="entrada" estiloRodapeConteudo={entradaEstilos.rodape} estiloConteudo={[entradaEstilos.conteudo, nivel >= 1 && entradaEstilos.conteudoCompacto]}
      aoMedir={(visivel) => setMedidas((atual) => (atual.visivel === visivel ? atual : { ...atual, visivel }))}
      aoMedirNatural={(conteudo) => setMedidas((atual) => (atual.conteudo === conteudo ? atual : { ...atual, conteudo }))}
      // Como na web: com o visitante oferecido, "Experimentar sem conta" é a ação principal e "Entrar" fica secundário.
      rodape={<Botao rotulo={ocupado && !experimentando ? mensagens.entrada.entrando : mensagens.entrada.entrar}
        variante={configuracaoCarregada && visitanteDisponivel ? 'secundario' : 'primario'}
        testID="entrar" desativado={!podeEntrar} ocupado={ocupado && !experimentando} carregando={ocupado && !experimentando} acao={() => void enviar()} />}>
      <TopoDaEntrada ilustracao={ilustracao} nivel={nivel} recolher={recolher} respiro={respiro} />
      {/* Como na web 4.4: "Ver como funciona" abre a apresentação sem sessão, em quatro passos. */}
      <Pressable ref={linkComoFunciona} testID="ver-como-funciona" accessibilityRole="button" disabled={ocupado} hitSlop={8}
        onPress={() => setVendoApresentacao(true)} style={({ pressed }) => [entradaEstilos.link, pressed && { opacity: 0.7 }]}>
        <Text style={entradaEstilos.linkTexto}>{mensagens.acesso.verComoFunciona}</Text>
      </Pressable>
      <Animated.View style={[entradaEstilos.formulario, nivel >= 1 && entradaEstilos.formularioCompacto, !recolher && respiro > 0 && { marginTop: (nivel >= 1 ? 16 : 28) + respiro },
        { transform: [{ translateX: tremor }] }]}>
        {/* Rodada 4.3: a conta temporária, só quando /api/auth/config devolve visitante: true. */}
        {configuracaoCarregada && visitanteDisponivel && (
          <View testID="acesso-visitante" style={entradaEstilos.visitante}>
            <Botao rotulo={mensagens.acesso.experimentar} testID="experimentar-sem-conta" desativado={ocupado} ocupado={experimentando}
              carregando={experimentando} acao={() => void experimentar()} />
            <Text testID="aviso-visitante" style={estilos.legenda}>{mensagens.acesso.experimentarAvisoApp}</Text>
          </View>
        )}
        {configuracaoCarregada && googleDisponivel && (
          <Botao rotulo={mensagens.acesso.google} testID="login-google" variante="secundario" desativado={ocupado} acao={() => void abrirGoogle()} />
        )}
        {configuracaoCarregada && (visitanteDisponivel || googleDisponivel) && (
          <View style={entradaEstilos.divisor}><View style={entradaEstilos.linha} /><Text style={estilos.legenda}>{mensagens.acesso.ou}</Text><View style={entradaEstilos.linha} /></View>
        )}
        <Campo testID="login-email" rotulo={mensagens.entrada.email} value={email} campoRef={campoEmail} erro={erroEmail}
          onChangeText={(valor) => { setEmail(valor); setErro(undefined); setErroEmail(undefined); }}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" returnKeyType="next"
          textContentType={Platform.OS === 'ios' ? 'username' : undefined}
          autoComplete={Platform.OS === 'android' ? 'email' : undefined}
          onFocus={() => { animarTroca(); setFocoNoFormulario(true); }} onBlur={() => { animarTroca(); setFocoNoFormulario(false); }}
          editable={!ocupado} onSubmitEditing={() => campoSenha.current?.focus()} />
        <Campo testID="login-senha" rotulo={mensagens.entrada.senha} value={senha} campoRef={campoSenha} erro={erroSenha}
          onChangeText={(valor) => { setSenha(valor); setErro(undefined); setErroSenha(undefined); }} secureTextEntry={!mostrarSenha} returnKeyType="go"
          autoCapitalize="none" autoCorrect={false}
          textContentType={Platform.OS === 'ios' ? 'password' : undefined}
          autoComplete={Platform.OS === 'android' ? 'current-password' : undefined}
          onFocus={() => { animarTroca(); setFocoNoFormulario(true); }} onBlur={() => { animarTroca(); setFocoNoFormulario(false); }}
          editable={!ocupado} onSubmitEditing={() => void enviar()}
          acessorio={<BotaoIcone icone={mostrarSenha ? 'olhoFechado' : 'olho'} testID="alternar-senha" selecionado={mostrarSenha}
            rotulo={mensagens.entrada.mostrarSenha} desativado={ocupado}
            acao={() => setMostrarSenha((atual) => !atual)} />} />
        {/* Como na web, o link e o erro ficam dentro do formulário (vão de 20, e tremem com ele). O link é .acesso-link: 44 de
            altura, texto no centro e sem sublinhado até 767 px; não é um botão com borda. */}
        {configuracaoCarregada && recuperacaoDisponivel && (
          <Pressable testID="esqueci-senha" accessibilityRole="link" disabled={ocupado} accessibilityState={{ disabled: ocupado }}
            hitSlop={{ top: 2, bottom: 2 }} onPress={() => recuperar(email)}
            style={({ pressed }) => [entradaEstilos.linkCentro, pressed && { opacity: 0.7 }]}>
            <Text style={entradaEstilos.linkTexto}>{mensagens.acesso.esqueci}</Text>
          </Pressable>
        )}
        {erro && <EstadoErro mensagem={erro} estilo={entradaEstilos.erro} />}
      </Animated.View>
    </Tela>
  );
}

const entradaEstilos = StyleSheet.create({
  divisor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linha: { flex: 1, height: 1, backgroundColor: cores.gelo },
  // A ilustração recortada: a caixa tem a altura que sobra e mostra a parte de baixo da paisagem de 140.
  banner: { overflow: 'hidden', borderRadius: 24, marginBottom: MARGEM_DA_ILUSTRACAO },
  paisagem: { borderRadius: 0 },
  recolhido: { height: 0, overflow: 'hidden', opacity: 0 },
  formulario: { gap: 20, marginTop: 28 },
  // Nível 1 (não coube nem sem a ilustração): espaços menores.
  conteudoCompacto: { paddingTop: 16 },
  formularioCompacto: { gap: 12, marginTop: 16 },
  // Nível 2: título de 26/32 (até duas linhas) e descrição de 15/22.
  tituloCompacto: { fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  textoCompacto: { fontSize: 15, lineHeight: 22 },
  // .entrada-conteudo deixa 96 embaixo e o rodapé fixo cobre 76: sobram 20 entre o último item e o rodapé.
  conteudo: { paddingBottom: 20 },
  visitante: { gap: 8, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: cores.gelo, backgroundColor: '#F8FAFF' },
  // Como .acesso-link da web no celular: 44 px de altura logo abaixo da introdução, sem sublinhado (globals.css, até 767 px).
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  // O "Esqueci minha senha" é item da grade do formulário: ocupa a largura toda, com o texto no centro.
  linkCentro: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  // .estado-erro não tem margem própria: o vão de 20 do formulário já separa o cartão do link.
  erro: { marginTop: 0 },
  linkTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  // A web deixa 24 px nas laterais do "Entrar" (342 px em 390).
  rodape: { paddingHorizontal: 24 },
});
