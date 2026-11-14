import { useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform, Text, View } from 'react-native';
import { criarClienteNativo } from './api-nativa';
import { Botao, BotaoIcone, Campo, EstadoMensagem, Tela, Titulo, estilos } from './interface';
import { mensagemDeErro, mensagens } from './mensagens';

const m = mensagens.acesso;
export function RecuperarAcesso({ emailInicial, voltar }: { emailInicial: string; voltar: () => void }) {
  const [etapa, setEtapa] = useState<'email' | 'codigo' | 'pronto'>('email');
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [espera, setEspera] = useState(0);
  const emCurso = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const evento = BackHandler.addEventListener('hardwareBackPress', () => { if (!emCurso.current) voltar(); return true; });
    return () => evento.remove();
  }, [voltar]);
  useEffect(() => {
    if (!espera) return;
    const timer = setTimeout(() => setEspera(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [espera]);
  function emailValido() { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }
  async function executar(acao: () => Promise<void>) {
    if (emCurso.current) return;
    emCurso.current = true; setOcupado(true); setErro(undefined); Keyboard.dismiss();
    try { await acao(); } catch (e) { setErro(mensagemDeErro(e)); }
    finally { emCurso.current = false; setOcupado(false); }
  }
  function enviar() {
    if (!emailValido()) { setErro(m.emailInvalido); return; }
    void executar(async () => {
      await criarClienteNativo().recuperarSenha(email.trim(), true);
      setEtapa('codigo'); setEnviado(true); setEspera(60);
    });
  }
  function salvar() {
    if (!emailValido()) { setErro(m.emailInvalido); return; }
    if (!/^\d{6}$/.test(codigo)) { setErro(m.codigoInvalido); return; }
    if (senha.length < 8 || senha.length > 256) { setErro(m.senhaInvalida); return; }
    if (senha !== confirmacao) { setErro(m.senhasDiferentes); return; }
    void executar(async () => {
      await criarClienteNativo().redefinirSenha(email.trim(), codigo, senha, true);
      setSenha(''); setConfirmacao(''); setCodigo(''); setEtapa('pronto');
    });
  }
  return <Tela pagina={`recuperar-${etapa}`} acoes={<Botao variante="texto" compacto rotulo={mensagens.voltar} desativado={ocupado} acao={voltar} />}
    rodape={<Botao rotulo={etapa === 'pronto' ? m.entrar : etapa === 'email' ? m.enviar : m.salvar}
      testID="recuperar-enviar" ocupado={ocupado} carregando={ocupado} acao={etapa === 'pronto' ? voltar : etapa === 'email' ? enviar : salvar} />}>
    <Titulo foco>{etapa === 'pronto' ? m.sucesso : m.recuperar}</Titulo>
    <Text style={estilos.introducao}>{etapa === 'pronto' ? m.sucessoTexto : etapa === 'email' ? m.instrucao : m.validade}</Text>
    {etapa !== 'pronto' && <View style={{ gap: 20, marginTop: 24 }}>
      <Campo rotulo={m.email} testID="recuperar-email" value={email} onChangeText={v => { setEmail(v); setEnviado(false); }}
        autoCapitalize="none" keyboardType="email-address" autoComplete="email" maxLength={254} editable={!ocupado} />
      {enviado && <Text accessibilityLiveRegion="polite" style={estilos.texto}>{m.enviado}</Text>}
      {etapa === 'codigo' && <>
        <Campo rotulo={m.codigo} testID="recuperar-codigo" value={codigo} onChangeText={v => setCodigo(v.replace(/\D/g, ''))}
          keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} editable={!ocupado} />
        <Campo rotulo={m.novaSenha} testID="recuperar-senha" value={senha} onChangeText={setSenha} secureTextEntry={!mostrar}
          autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={256} editable={!ocupado}
          acessorio={<BotaoIcone icone={mostrar ? 'olhoFechado' : 'olho'} rotulo={mensagens.entrada.mostrarSenha} selecionado={mostrar} acao={() => setMostrar(v => !v)} />} />
        <Text style={estilos.legenda}>{m.dicaSenha}</Text>
        <Campo rotulo={m.confirmarSenha} testID="recuperar-confirmacao" value={confirmacao} onChangeText={setConfirmacao}
          secureTextEntry={!mostrar} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={256} editable={!ocupado} />
      </>}
      {etapa === 'email' ? <Botao variante="texto" rotulo={m.tenhoCodigo} desativado={ocupado} acao={() => { setEtapa('codigo'); setErro(undefined); }} />
        : <Botao variante="texto" rotulo={espera ? m.aguarde(espera) : m.reenviar} desativado={ocupado || espera > 0} acao={enviar} />}
    </View>}
    {erro && <EstadoMensagem mensagem={erro} foco />}
  </Tela>;
}
