import { codigoAceito, normalizarEmailEntrada, senhaAceita } from '@studoo/contratos/autenticacao';
import { CAMINHO_POLITICA } from '@studoo/contratos/privacidade';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { criarClienteNativo, origemConfigurada } from './api-nativa';
import { appleDisponivelNoAparelho } from './apple-nativo';
import { googleNoAparelho } from './google-nativo';
import { LOGO_GOOGLE } from './marca-google';
import { Icone } from './icone';
import { Botao, BotaoIcone, Campo, EstadoErro, Tela, Titulo, estilos } from './interface';
import { mensagemDeErro, mensagens } from './mensagens';
import { abrirNoNavegador } from './social';
import { cores, fontes } from './tema';
import { ouvirVoltar } from './voltar';

const m = mensagens.cadastro;

/** A política pública do Studoo (web, sem login) na origem do piloto; null sem origem configurada. */
export function enderecoDaPoliticaPublica() {
  try {
    return new URL(CAMINHO_POLITICA, origemConfigurada()).toString();
  } catch {
    return null;
  }
}

/**
 * Criar conta (igual à web, /cadastro): e-mail → código de 6 dígitos (prova que o e-mail é da pessoa) + senha → entra
 * na hora com a sessão do app. Mesmo desenho da recuperação de senha. Pedir código responde sempre "enviado" (o
 * servidor não revela quais e-mails já têm conta). Erros nos campos e do servidor no cartão de erro, sem janelas nativas.
 */
export function CriarConta({ emailInicial, voltar, criar, google, apple }: {
  emailInicial: string;
  voltar: () => void;
  /** "Continuar com Google" no topo do primeiro passo, antes do e-mail, quando o servidor e o build o oferecem (spec 06). */
  google?: () => Promise<void>;
  /** "Continuar com a Apple" acima do Google, como na entrada (App Review 4.8): só no iPhone, com `apple: true`. */
  apple?: () => Promise<void>;
  /** Cria a conta e entra (guarda a sessão no aparelho). */
  criar: (email: string, codigo: string, senha: string) => Promise<void>;
}) {
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(0);
  const emCurso = useRef(false);
  const politica = enderecoDaPoliticaPublica();
  // Os provedores, como na entrada: só o que o servidor oferece (e o aparelho permite) aparece; nada apagado.
  const [provedores, setProvedores] = useState({ google: false, apple: false });
  useEffect(() => {
    let ativo = true;
    void Promise.all([criarClienteNativo().configuracaoAcesso(), appleDisponivelNoAparelho()])
      .then(([c, appleNoAparelho]) => { if (ativo) setProvedores({ google: Boolean(google) && c.google && googleNoAparelho(), apple: Boolean(apple) && c.apple === true && appleNoAparelho }); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [Boolean(google), Boolean(apple)]); // as funções nascem de novo a cada desenho da raiz; só a presença conta
  const comProvedor = etapa === 'email' && (provedores.google || provedores.apple);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const evento = ouvirVoltar(() => { if (!emCurso.current) voltar(); return true; });
    return () => evento.remove();
  }, [voltar]);
  useEffect(() => {
    if (!espera) return;
    const timer = setTimeout(() => setEspera((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [espera]);

  async function executar(acao: () => Promise<void>) {
    if (emCurso.current) return;
    emCurso.current = true; setOcupado(true); setErro(undefined); Keyboard.dismiss();
    try { await acao(); } catch (e) { setErro(mensagemDeErro(e)); }
    finally { emCurso.current = false; setOcupado(false); }
  }
  function enviar() {
    const normalizado = normalizarEmailEntrada(email);
    if (!normalizado) { setErro(m.emailInvalido); return; }
    void executar(async () => {
      await criarClienteNativo().pedirCodigoCadastro(normalizado, true);
      setEtapa('codigo'); setEspera(60);
    });
  }
  function concluir() {
    const normalizado = normalizarEmailEntrada(email);
    if (!normalizado) { setErro(m.emailInvalido); return; }
    if (!codigoAceito(codigo)) { setErro(m.codigoInvalido); return; }
    if (!senhaAceita(senha)) { setErro(m.senhaInvalida); return; }
    if (senha !== confirmacao) { setErro(m.senhasDiferentes); return; }
    void executar(async () => {
      await criar(normalizado, codigo, senha);
    });
  }

  return <Tela pagina={`cadastro-${etapa}`} acoes={<Botao variante="texto" compacto rotulo={mensagens.voltar} desativado={ocupado} acao={voltar} />}
    rodape={<Botao rotulo={etapa === 'email' ? ocupado ? m.enviando : m.enviar : ocupado ? m.criando : m.criar}
      testID="cadastro-enviar" ocupado={ocupado} carregando={ocupado} acao={etapa === 'email' ? enviar : concluir} />}>
    <View style={visual.simbolo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Icone nome="cadeado" tamanho={28} cor={cores.acao} /></View>
    <Titulo key={etapa} foco testID="titulo-cadastro">{m.titulo}</Titulo>
    {/* Spec 06 (4e944df): com o Google, a instrução desce para logo acima do campo, depois do divisor. */}
    {!comProvedor && <Text testID="cadastro-instrucao" style={estilos.introducao}>{etapa === 'email' ? m.instrucao : m.validade}</Text>}
    <View style={{ gap: 20, marginTop: 24 }}>
      {/* Spec 06: no primeiro passo, os provedores no topo, na ordem da entrada (Apple, Google), e o "ou" antes do e-mail. */}
      {comProvedor && provedores.apple && apple && (
        <View testID="cadastro-apple" pointerEvents={ocupado ? 'none' : 'auto'} style={ocupado ? { opacity: 0.5 } : null} accessibilityState={{ disabled: ocupado }}>
          <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={16} style={visual.apple}
            onPress={() => void executar(apple)} />
        </View>
      )}
      {comProvedor && provedores.google && google && (
        <Botao rotulo={mensagens.acesso.google} testID="cadastro-google" variante="secundario" imagemAntes={LOGO_GOOGLE} desativado={ocupado}
          acao={() => void executar(google)} />
      )}
      {comProvedor && (
        <View style={visual.divisor}><View style={visual.linha} /><Text style={estilos.legenda}>{m.ou}</Text><View style={visual.linha} /></View>
      )}
      {comProvedor && <Text testID="cadastro-instrucao" style={[estilos.introducao, { marginTop: 0 }]}>{m.instrucao}</Text>}
      <Campo rotulo={m.email} testID="cadastro-email" value={email} onChangeText={(v) => { setEmail(v); setErro(undefined); }}
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" maxLength={254}
        editable={!ocupado && etapa === 'email'} returnKeyType="send" onSubmitEditing={etapa === 'email' ? enviar : undefined} />
      {etapa === 'codigo' && <>
        <Text testID="cadastro-enviado" accessibilityLiveRegion="polite" style={[estilos.texto, visual.aviso]}>{m.enviado}</Text>
        <Campo rotulo={m.codigo} testID="cadastro-codigo" value={codigo} onChangeText={(v) => { setCodigo(v.replace(/\D/g, '')); setErro(undefined); }}
          keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} editable={!ocupado} />
        <Campo rotulo={m.senha} testID="cadastro-senha" value={senha} onChangeText={(v) => { setSenha(v); setErro(undefined); }} secureTextEntry={!mostrar}
          autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" maxLength={256} editable={!ocupado}
          acessorio={<BotaoIcone icone={mostrar ? 'olhoFechado' : 'olho'} rotulo={mensagens.entrada.mostrarSenha} selecionado={mostrar} desativado={ocupado} acao={() => setMostrar((v) => !v)} />} />
        <Text style={estilos.legenda}>{m.dicaSenha}</Text>
        <Campo rotulo={m.confirmarSenha} testID="cadastro-confirmacao" value={confirmacao} onChangeText={(v) => { setConfirmacao(v); setErro(undefined); }}
          secureTextEntry={!mostrar} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" maxLength={256}
          editable={!ocupado} returnKeyType="go" onSubmitEditing={concluir} />
        <Botao variante="texto" testID="cadastro-reenviar" rotulo={espera ? m.aguarde(espera) : m.reenviar} desativado={ocupado || espera > 0} acao={enviar} />
        <Botao variante="texto" testID="cadastro-trocar-email" rotulo={m.trocarEmail} desativado={ocupado}
          acao={() => { setEtapa('email'); setCodigo(''); setErro(undefined); }} />
      </>}
      {erro && <EstadoErro mensagem={erro} foco />}
      {politica && (
        <Pressable testID="cadastro-politica" accessibilityRole="link" hitSlop={{ top: 2, bottom: 2 }} onPress={() => abrirNoNavegador(politica)}
          style={({ pressed }) => [visual.link, pressed && { opacity: 0.7 }]}>
          <Text style={visual.linkTexto}>{m.politica}</Text>
        </Pressable>
      )}
      <Pressable testID="cadastro-ja-tenho-conta" accessibilityRole="link" disabled={ocupado} hitSlop={{ top: 2, bottom: 2 }} onPress={voltar}
        style={({ pressed }) => [visual.link, pressed && { opacity: 0.7 }]}>
        <Text style={visual.linkTexto}>{mensagens.acesso.jaTenhoConta}</Text>
      </Pressable>
    </View>
  </Tela>;
}

const visual = StyleSheet.create({
  divisor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linha: { flex: 1, height: 1, backgroundColor: cores.gelo },
  apple: { width: '100%', height: 52 },
  simbolo: { width: 56, height: 56, borderRadius: 18, backgroundColor: cores.nevoa, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  aviso: { padding: 16, borderRadius: 16, backgroundColor: cores.nevoa },
  // Como .acesso-link da web: 44 de altura, texto no centro.
  link: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  linkTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24, textAlign: 'center' },
});
