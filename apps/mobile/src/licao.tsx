import { ApoioDaLicao } from './estudio-adaptativo';
import type { ClienteEstudio } from '@studoo/contratos';
import {
  etapasDaLicao,
  exerciciosDaLicao,
  respostaCompleta,
  type AutoAvaliacao,
  type Avaliacao,
  type EtapaAula,
  type ExercicioPublico,
  type LicaoDetalhe,
} from '@studoo/contratos';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAparecer, usePulinho, useTremor } from './animacoes';
import {
  Associar,
  CampoAberta,
  CorrecaoAberta,
  Escuta,
  EtapaPratica,
  Falas,
  Ordenar,
  Passos,
  RecursoDaLicao,
  Trecho,
  VerdadeiroFalso,
  pararVoz,
} from './aula-formatos';
import { Confete } from './festa';
import { Icone } from './icone';
import { Botao, BotaoIcone, Campo, EstadoMensagem, Tela, Titulo, estilos, useBalanco, useMovimentoReduzido } from './interface';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';
import type { NomeIcone } from './trilha';

/** O que a pessoa fez na lição, para o resumo da conclusão. */
export type ResumoLicao = { segundos: number; tentativas: number; dePrimeira: boolean; etapas: number; pratica?: AutoAvaliacao };

const t = mensagens.licao;
const iconesDaEtapa: Record<EtapaAula['tipo'], NomeIcone> = { conceito: 'livro', exemplo: 'lampada', exercicio: 'alvo', pratica: 'relogio' };
const coresDaEtapa: Record<EtapaAula['tipo'], { texto: string; fundo: string }> = {
  conceito: { texto: cores.acao, fundo: '#E7ECFF' },
  exemplo: { texto: '#8A5A00', fundo: '#FFF1CC' },
  exercicio: { texto: cores.sucesso, fundo: '#E3F6EA' },
  pratica: { texto: '#6B3FA0', fundo: '#F1E8FB' },
};
const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Título do acerto: varia entre as lições, sem sorteio (a mesma lição tem sempre o mesmo), como na web. */
function tituloDoAcerto(id: string) {
  let soma = 0;
  for (const caractere of id) soma = (soma * 31 + caractere.charCodeAt(0)) >>> 0;
  return t.certas[soma % t.certas.length];
}

/** Linhas extras do retorno: o aviso da correção e, no ordenar e no associar, quantos já estão certos. */
function extrasDoRetorno(avaliacao: Avaliacao, exercicio: ExercicioPublico | null): string[] {
  const linhas = avaliacao.observacao ? [avaliacao.observacao] : [];
  if (!avaliacao.correta && avaliacao.certos && exercicio?.tipo === 'ordenar') linhas.push(t.ordenar.certos(avaliacao.certos.length, exercicio.itens.length));
  if (!avaliacao.correta && avaliacao.certos && exercicio?.tipo === 'associar') linhas.push(t.associar.certos(avaliacao.certos.length, exercicio.esquerda.length));
  return linhas;
}

/**
 * Aula por etapas, como na web (spec 02), com o número de etapas de cada lição: conceito, exemplo (ou demonstração, com
 * recurso, passos e frases para ouvir), de um a três exercícios de formatos variados e, quando a lição pede, a prática no
 * mundo real com cronômetro. Depois da resposta, o rodapé vira o painel de retorno, verde no acerto (com confete) ou
 * âmbar no erro (o exercício treme); dá para tentar de novo ou continuar. Continuar segue para a próxima etapa; na última,
 * registra a conclusão (se a confirmação expirar, a aula volta ao último exercício). O título de cada etapa e o do retorno
 * recebem o foco do leitor de tela.
 */
export function Licao({ cliente, licao, erro, pendente, voltar, avaliar, concluir }: {
  cliente: ClienteEstudio;
  licao: LicaoDetalhe;
  erro: string | null;
  pendente: string | null;
  voltar: () => void;
  avaliar: (resposta: string, indice: number) => Promise<Avaliacao | null>;
  concluir: (comprovante: string, resumo: ResumoLicao, pratica?: AutoAvaliacao) => Promise<boolean>;
}) {
  const etapas = useMemo(() => etapasDaLicao(licao), [licao]);
  const exercicios = useMemo(() => exerciciosDaLicao(licao), [licao]);
  const [passo, setPasso] = useState(0);
  const [respostas, setRespostas] = useState<string[]>(() => exercicios.map(() => ''));
  const [avaliacoes, setAvaliacoes] = useState<(Avaliacao | null)[]>(() => exercicios.map(() => null));
  const [primeiras, setPrimeiras] = useState<(boolean | null)[]>(() => exercicios.map(() => null));
  const [tentativas, setTentativas] = useState(0);
  const [comprovante, setComprovante] = useState<string | null>(null);
  const [autoAvaliacao, setAutoAvaliacao] = useState<AutoAvaliacao | null>(null);
  const [errosSeguidos, setErrosSeguidos] = useState(0);
  const [inicio] = useState(() => Date.now());
  const tituloEtapa = useRef<ComponentRef<typeof Text>>(null);
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const apoioPosicao = useRef(0);
  const reduzir = useMovimentoReduzido();
  const tremor = useTremor(errosSeguidos);

  const etapa = etapas[passo];
  const indice = etapa.tipo === 'exercicio' ? etapa.indice : -1;
  const exercicio = indice >= 0 ? exercicios[indice] : null;
  const resposta = indice >= 0 ? respostas[indice] : '';
  const avaliacao = indice >= 0 ? avaliacoes[indice] : null;
  const ocupado = pendente !== null;
  const total = etapas.length;
  const ultima = passo === total - 1;
  const andamento = t.posicao(passo + 1, total);
  const retorno = avaliacao ? (avaliacao.correta ? 'certa' : 'errada') : null;
  let nomeEtapa: string = t.conceito;
  if (etapa.tipo === 'exemplo') nomeEtapa = licao.exemploTipo === 'demonstracao' ? t.demonstracao : t.exemplo;
  else if (etapa.tipo === 'pratica') nomeEtapa = t.pratica.etapa;
  else if (etapa.tipo === 'exercicio') nomeEtapa = exercicios.length > 1 ? t.exercicioDe(indice + 1, exercicios.length) : t.exercicio;

  useEffect(() => {
    // Cada etapa começa do topo, como uma tela nova; a voz de uma etapa não continua na outra.
    rolagem.current?.scrollTo({ y: 0, animated: false });
    pararVoz();
    if (passo === 0) return;
    const espera = setTimeout(() => {
      if (tituloEtapa.current) AccessibilityInfo.sendAccessibilityEvent(tituloEtapa.current, 'focus');
    }, 120);
    return () => clearTimeout(espera);
  }, [passo]);

  useEffect(() => () => pararVoz(), []);

  function mudarResposta(valor: string) {
    setRespostas((atuais) => atuais.map((atual, posicao) => (posicao === indice ? valor : atual)));
  }

  async function enviar() {
    if (ocupado || !exercicio || avaliacao || !respostaCompleta(exercicio, resposta)) return;
    const resultado = await avaliar(resposta, indice);
    if (!resultado) return;
    setTentativas((soma) => soma + 1);
    setPrimeiras((atuais) => atuais.map((atual, posicao) => (posicao === indice ? atual ?? resultado.correta : atual)));
    if (!resultado.correta) setErrosSeguidos((soma) => soma + 1);
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === indice ? resultado : atual)));
    setComprovante(resultado.comprovante);
  }

  function tentarDeNovo() {
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === indice ? null : atual)));
    mudarResposta('');
  }

  async function avancar() {
    if (ocupado) return;
    if (!ultima) {
      setPasso((atual) => atual + 1);
      return;
    }
    if (!comprovante) return;
    const resumo: ResumoLicao = {
      segundos: Math.max(1, Math.round((Date.now() - inicio) / 1000)),
      tentativas,
      dePrimeira: primeiras.every((primeira) => primeira === true),
      etapas: total,
      ...(autoAvaliacao ? { pratica: autoAvaliacao } : {}),
    };
    if (await concluir(comprovante, resumo, autoAvaliacao ?? undefined)) return;
    const ultimoExercicio = etapas.findLastIndex((item) => item.tipo === 'exercicio');
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === exercicios.length - 1 ? null : atual)));
    setPasso(ultimoExercicio);
  }

  const topo = (
    <View style={licaoEstilos.topo}>
      <BotaoIcone icone="fechar" rotulo={t.voltar} testID="voltar-plano" desativado={ocupado} acao={voltar} />
      <View style={licaoEstilos.andamento} accessible accessibilityRole="progressbar" accessibilityLabel={andamento}
        accessibilityValue={{ min: 0, max: total, now: passo + 1 }}>
        <BarraDaAula fracao={(passo + 1) / total} certa={avaliacao?.correta === true} />
        <Text style={licaoEstilos.posicao}>{andamento}</Text>
      </View>
    </View>
  );

  let rodape: ReactNode;
  if (avaliacao) {
    rodape = (
      <PainelRetorno avaliacao={avaliacao} titulo={avaliacao.correta ? tituloDoAcerto(`${licao.id}-${indice}`) : t.errada}
        extras={extrasDoRetorno(avaliacao, exercicio)} ocupado={ocupado} concluindo={pendente === 'concluir'} tentarDeNovo={tentarDeNovo}
        verReforco={() => rolagem.current?.scrollTo({ y: apoioPosicao.current, animated: reduzir === false })}
        continuar={() => void avancar()} />
    );
  } else if (exercicio) {
    rodape = <Botao testID="enviar-resposta" rotulo={pendente === 'avaliar' ? t.avaliando : t.avaliar}
      desativado={ocupado || !respostaCompleta(exercicio, resposta)} ocupado={pendente === 'avaliar'} carregando={pendente === 'avaliar'}
      acao={() => void enviar()} />;
  } else if (etapa.tipo === 'pratica') {
    rodape = (
      <View style={{ gap: 8 }}>
        {!autoAvaliacao && <Text style={[estilos.legenda, { textAlign: 'center' }]}>{t.pratica.escolha}</Text>}
        <Botao testID="concluir-pratica" rotulo={pendente === 'concluir' ? t.concluindo : t.pratica.concluir} variante="sucesso"
          desativado={ocupado || !autoAvaliacao} ocupado={pendente === 'concluir'} carregando={pendente === 'concluir'} acao={() => void avancar()} />
      </View>
    );
  } else {
    rodape = <Botao testID="avancar-licao" rotulo={t.seguir} icone="seta" desativado={ocupado} acao={() => setPasso((atual) => atual + 1)} />;
  }

  function campoDoExercicio(atual: ExercicioPublico): ReactNode {
    const respondido = avaliacao !== null;
    switch (atual.tipo) {
      case 'lacuna':
        return (
          <Campo testID="resposta-licao" rotulo={t.resposta} value={resposta} onChangeText={mudarResposta}
            editable={!ocupado && !respondido} autoCorrect={false} autoCapitalize="none" returnKeyType="send"
            onSubmitEditing={() => void enviar()}
            style={[licaoEstilos.respostaCampo, retorno === 'certa' && licaoEstilos.respostaCerta, retorno === 'errada' && licaoEstilos.respostaErrada]} />
        );
      case 'multipla_escolha':
        return (
          <View accessibilityRole="radiogroup" accessibilityLabel={t.resposta} style={licaoEstilos.opcoes}>
            <Text style={estilos.rotulo}>{t.resposta}</Text>
            {atual.opcoes.map((opcao, posicao) => (
              <Opcao key={opcao.id} id={opcao.id} letra={letras[posicao] ?? String(posicao + 1)} texto={opcao.texto}
                selecionada={opcao.id === resposta} retorno={opcao.id === resposta ? retorno : null}
                desativada={ocupado || respondido} apagada={respondido && opcao.id !== resposta}
                acao={() => mudarResposta(opcao.id)} />
            ))}
          </View>
        );
      case 'ordenar':
        return <Ordenar itens={atual.itens} valor={resposta} mudar={mudarResposta} desativado={ocupado || respondido} certos={avaliacao?.certos} />;
      case 'associar':
        return <Associar esquerda={atual.esquerda} direita={atual.direita} valor={resposta} mudar={mudarResposta}
          desativado={ocupado || respondido} certos={avaliacao?.certos} />;
      case 'verdadeiro_falso':
        return (
          <VerdadeiroFalso afirmacao={atual.afirmacao} valor={resposta} mudar={mudarResposta} desativado={ocupado || respondido} retorno={retorno}
            justificativas={(escolhida, salvar) => (
              <View accessibilityRole="radiogroup" accessibilityLabel={t.verdadeiroFalso.porque} style={licaoEstilos.opcoes}>
                {atual.justificativas.map((opcao, posicao) => (
                  <Opcao key={opcao.id} id={`justificativa-${opcao.id}`} letra={letras[posicao] ?? String(posicao + 1)} texto={opcao.texto}
                    selecionada={opcao.id === escolhida} retorno={opcao.id === escolhida ? retorno : null}
                    desativada={ocupado || respondido} apagada={respondido && opcao.id !== escolhida} acao={() => salvar(opcao.id)} />
                ))}
              </View>
            )} />
        );
      case 'aberta':
        return <CampoAberta valor={resposta} mudar={mudarResposta} minimo={atual.minimo} desativado={ocupado || respondido} retorno={retorno} />;
    }
  }

  return (
    <Tela pagina={`licao-${licao.id}`} topo={topo} rodape={rodape} rolagem={rolagem}
      estiloRodape={retorno === 'certa' ? licaoEstilos.rodapeCerto : retorno === 'errada' ? licaoEstilos.rodapeErrado : undefined}>
      <EntradaDaEtapa key={passo}>
        <View style={licaoEstilos.etapa}>
          <View style={[licaoEstilos.etapaIcone, { backgroundColor: coresDaEtapa[etapa.tipo].fundo }]}>
            <Icone nome={iconesDaEtapa[etapa.tipo]} tamanho={18} cor={coresDaEtapa[etapa.tipo].texto} />
          </View>
          <Text style={[licaoEstilos.etapaTexto, { color: coresDaEtapa[etapa.tipo].texto }]}>{nomeEtapa.toLocaleUpperCase('pt-BR')}</Text>
        </View>
        <Titulo testID="titulo-licao" foco={passo === 0}>{licao.titulo}</Titulo>
        {etapa.tipo === 'conceito' && (
          <>
            {licao.concluida && (
              <View style={licaoEstilos.revisao}>
                <Icone nome="check" tamanho={18} cor={cores.sucesso} />
                <Text style={licaoEstilos.revisaoTexto}>{mensagens.trilha.revisitando}</Text>
              </View>
            )}
            <Text style={estilos.introducao}>{licao.objetivo}</Text>
            <ExplicacaoDoStu>
              <Text accessibilityRole="header" style={licaoEstilos.balaoTitulo}>{t.conceito}</Text>
              <Text style={estilos.texto}>{licao.conceito}</Text>
              <Text style={estilos.legenda}>{t.origem} · {licao.origem}</Text>
            </ExplicacaoDoStu>
          </>
        )}
        {etapa.tipo === 'exemplo' && (
          <View style={[licaoEstilos.quadro, licaoEstilos.quadroExemplo]}>
            <Text ref={tituloEtapa} accessible accessibilityRole="header" style={estilos.subtitulo}>
              {licao.exemploTipo === 'demonstracao' ? t.demonstracao : t.exemplo}
            </Text>
            <Text style={estilos.texto}>{licao.exemplo}</Text>
            {licao.recurso && <RecursoDaLicao recurso={licao.recurso} />}
            {licao.passos && <Passos passos={licao.passos} titulo={t.recursos.passos} />}
            {licao.falas && <Falas falas={licao.falas} />}
          </View>
        )}
        {exercicio && (
          <Animated.View style={[licaoEstilos.quadro, { transform: [{ translateX: tremor }] }]}>
            <Text ref={tituloEtapa} accessible accessibilityRole="header" style={estilos.subtitulo}>
              {exercicios.length > 1 ? t.exercicioDe(indice + 1, exercicios.length) : t.exercicio}
            </Text>
            <Text style={estilos.texto}>{exercicio.enunciado}</Text>
            {exercicio.contexto && <Text style={estilos.texto}>{exercicio.contexto}</Text>}
            {exercicio.trecho && <Trecho texto={exercicio.trecho} tipo={exercicio.trechoTipo} fala={exercicio.fala} />}
            {!exercicio.trecho && exercicio.fala && <Escuta fala={exercicio.fala} />}
            {campoDoExercicio(exercicio)}
            {exercicio.tipo === 'aberta' && avaliacao && <CorrecaoAberta avaliacao={avaliacao} />}
          </Animated.View>
        )}
        {etapa.tipo === 'pratica' && licao.pratica && (
          <View style={[licaoEstilos.quadro, licaoEstilos.quadroPratica]}>
            <Text ref={tituloEtapa} accessible accessibilityRole="header" style={estilos.subtitulo}>{t.pratica.titulo}</Text>
            <EtapaPratica pratica={licao.pratica} escolha={autoAvaliacao} escolher={setAutoAvaliacao} />
          </View>
        )}
        {erro && <EstadoMensagem mensagem={erro} />}
      </EntradaDaEtapa>
      {exercicio && <View onLayout={(evento) => { apoioPosicao.current = evento.nativeEvent.layout.y; }}><ApoioDaLicao cliente={cliente} licao={licao} avaliacao={avaliacao} /></View>}
    </Tela>
  );
}

/** Cada etapa entra deslizando da direita, como na web; com movimento reduzido, já aparece pronta. */
function EntradaDaEtapa({ children }: { children: ReactNode }) {
  const entrada = useAparecer(0, 380);
  return (
    <Animated.View style={{
      opacity: entrada, transform: [{ translateX: entrada.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
}

/** Barra de andamento grossa, com brilho na faixa cheia, que avança com uma mola curta; verde depois do acerto. */
function BarraDaAula({ fracao, certa }: { fracao: number; certa: boolean }) {
  const reduzir = useMovimentoReduzido();
  const [largura] = useState(() => new Animated.Value(fracao));

  useEffect(() => {
    if (reduzir !== false) {
      largura.setValue(fracao);
      return;
    }
    const animacao = Animated.spring(largura, { toValue: fracao, friction: 7, tension: 70, useNativeDriver: false });
    animacao.start();
    return () => animacao.stop();
  }, [fracao, reduzir, largura]);

  return (
    <View style={licaoEstilos.trilha}>
      <Animated.View style={[licaoEstilos.preenchimento, certa && licaoEstilos.preenchimentoCerto, {
        width: largura.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }]}>
        <View style={licaoEstilos.brilho} />
      </Animated.View>
    </View>
  );
}

/** O Stu explica o conceito num balão; ele sobe e desce devagar. */
function ExplicacaoDoStu({ children }: { children: ReactNode }) {
  const balanco = useBalanco(5, 1600);
  const balao = useAparecer(120, 420, true);
  return (
    <View style={licaoEstilos.explicacao}>
      <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
        importantForAccessibility="no" style={[licaoEstilos.stu, { transform: [{ translateY: balanco }] }]} />
      <Animated.View style={[licaoEstilos.balao, {
        opacity: balao, transform: [{ scale: balao.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
      }]}>
        <View style={licaoEstilos.balaoSeta} />
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * Painel de retorno no rodapé: sobe com a cor do resultado; o ícone entra com um giro e, no acerto, solta confete.
 * No erro, "Tentar de novo" volta ao exercício e Continuar segue, como na web.
 */
function PainelRetorno({ avaliacao, titulo, extras, ocupado, concluindo, tentarDeNovo, continuar, verReforco }: {
  avaliacao: Avaliacao;
  titulo: string;
  /** Linhas a mais: o aviso da correção e quantos itens já estão certos. */
  extras: string[];
  ocupado: boolean;
  concluindo: boolean;
  tentarDeNovo: () => void;
  verReforco: () => void;
  continuar: () => void;
}) {
  const certa = avaliacao.correta;
  const subida = useAparecer(0, 320, true);
  const icone = useAparecer(80, 460, true);
  const area = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    if (area.current) AccessibilityInfo.sendAccessibilityEvent(area.current, 'focus');
  }, []);

  return (
    <Animated.View style={{ gap: 14, opacity: subida, transform: [{ translateY: subida.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      <View ref={area} testID="feedback-licao" accessible accessibilityRole="alert"
        accessibilityLabel={`${titulo} ${certa ? mensagens.licao.correta : mensagens.licao.incorreta}. ${avaliacao.feedback} ${extras.join(' ')}`}
        style={licaoEstilos.retorno}>
        <Animated.View style={[licaoEstilos.retornoIcone, !certa && licaoEstilos.retornoIconeErrado, {
          transform: [
            { scale: icone.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            { rotate: icone.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) },
          ],
        }]}>
          <Icone nome={certa ? 'check' : 'fechar'} tamanho={28} cor={cores.fundo} />
          {certa && <Confete quantidade={14} />}
        </Animated.View>
        <View style={licaoEstilos.retornoTextos}>
          <Text style={[licaoEstilos.retornoTitulo, !certa && licaoEstilos.retornoTituloErrado]}>{titulo}</Text>
          <Text style={estilos.texto}>{avaliacao.feedback}</Text>
          {extras.map((linha) => <Text key={linha} style={licaoEstilos.retornoExtra}>{linha}</Text>)}
        </View>
      </View>
      {!certa && <Botao variante="texto" rotulo={mensagens.estudio.verPonte} desativado={ocupado} acao={verReforco} />}
      <View style={licaoEstilos.retornoAcoes}>
        {!certa && (
          <View style={licaoEstilos.metade}>
            <Botao testID="tentar-de-novo" rotulo={mensagens.licao.tentarDeNovo} desativado={ocupado} acao={tentarDeNovo} />
          </View>
        )}
        <View style={licaoEstilos.metade}>
          <Botao testID="continuar-licao" rotulo={concluindo ? mensagens.licao.concluindo : mensagens.licao.continuar}
            variante={certa ? 'sucesso' : 'texto'} desativado={ocupado} ocupado={concluindo} carregando={concluindo} acao={continuar} />
        </View>
      </View>
    </Animated.View>
  );
}

/** Opção do exercício: cartão com relevo e a letra; depois da resposta, a escolhida fica verde (pula) ou âmbar. */
function Opcao({ id, letra, texto, selecionada, retorno, desativada, apagada, acao }: {
  id: string;
  letra: string;
  texto: string;
  selecionada: boolean;
  retorno: 'certa' | 'errada' | null;
  desativada: boolean;
  apagada: boolean;
  acao: () => void;
}) {
  const [focada, setFocada] = useState(false);
  const pulo = usePulinho(retorno === 'certa', 1.04);
  let estado = null;
  if (retorno === 'certa') estado = licaoEstilos.opcaoCerta;
  else if (retorno === 'errada') estado = licaoEstilos.opcaoErrada;
  else if (selecionada) estado = licaoEstilos.opcaoSelecionada;

  return (
    <Animated.View style={{ transform: [{ scale: pulo }], opacity: apagada ? 0.55 : 1 }}>
      <Pressable testID={`opcao-${id}`} accessibilityRole="radio" accessibilityState={{ checked: selecionada, disabled: desativada }}
        accessibilityLabel={texto} disabled={desativada} onPress={acao} onFocus={() => setFocada(true)} onBlur={() => setFocada(false)}
        style={({ pressed }) => [licaoEstilos.opcao, estado, pressed && licaoEstilos.opcaoAfundada, focada && estilos.foco]}>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          style={[licaoEstilos.letra, selecionada && licaoEstilos.letraSelecionada, retorno === 'certa' && licaoEstilos.letraCerta,
            retorno === 'errada' && licaoEstilos.letraErrada]}>
          <Text style={[licaoEstilos.letraTexto, (selecionada || retorno) && { color: cores.fundo }]}>{letra}</Text>
        </View>
        <Text style={[estilos.texto, licaoEstilos.opcaoTexto]}>{texto}</Text>
      </Pressable>
    </Animated.View>
  );
}

const licaoEstilos = StyleSheet.create({
  topo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  andamento: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  trilha: { flex: 1, height: 18, borderRadius: 9, backgroundColor: cores.gelo, overflow: 'hidden' },
  preenchimento: { height: '100%', minWidth: 18, borderRadius: 9, backgroundColor: cores.acao, overflow: 'hidden' },
  preenchimentoCerto: { backgroundColor: cores.sucessoClaro },
  brilho: { position: 'absolute', top: 4, left: 10, right: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.34)' },
  posicao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  etapa: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  etapaIcone: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  etapaTexto: { fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18, letterSpacing: 0.6 },
  revisao: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  revisaoTexto: { flex: 1, color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  explicacao: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 20 },
  stu: { width: 58, height: 64, marginTop: 6 },
  balao: { flex: 1, gap: 10, padding: 16, borderRadius: 22, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo },
  balaoSeta: { position: 'absolute', top: 24, left: -10, width: 16, height: 16, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: cores.gelo,
    borderBottomLeftRadius: 3, backgroundColor: cores.fundo, transform: [{ rotate: '45deg' }] },
  balaoTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 19, lineHeight: 24 },
  quadro: { marginTop: 20, gap: 12, padding: 18, borderRadius: 24, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo },
  quadroExemplo: { borderColor: '#FFE3A3', backgroundColor: '#FFFAF0' },
  quadroPratica: { borderColor: '#E2D1F5', backgroundColor: '#FBF8FF' },
  respostaCampo: { minHeight: 58, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  respostaCerta: { borderColor: cores.sucessoClaro, color: cores.sucesso, backgroundColor: '#EEFAF3' },
  respostaErrada: { borderColor: '#E3A24A', backgroundColor: '#FFF6EA' },
  opcoes: { gap: 10 },
  opcao: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 2, borderBottomWidth: 5,
    borderColor: cores.gelo, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: cores.fundo },
  opcaoAfundada: { borderBottomWidth: 2, marginTop: 3 },
  opcaoSelecionada: { borderColor: '#9FB1F0', backgroundColor: '#EEF2FF' },
  opcaoCerta: { borderColor: cores.sucessoClaro, borderBottomColor: '#9AD8B5', backgroundColor: '#EEFAF3' },
  opcaoErrada: { borderColor: '#E3A24A', borderBottomColor: '#F2CF96', backgroundColor: '#FFF6EA' },
  opcaoTexto: { flex: 1, fontWeight: '700' },
  letra: { width: 30, height: 30, borderRadius: 9, borderWidth: 2, borderColor: cores.gelo, alignItems: 'center', justifyContent: 'center' },
  letraSelecionada: { borderColor: cores.acao, backgroundColor: cores.acao },
  letraCerta: { borderColor: cores.sucessoClaro, backgroundColor: cores.sucessoClaro },
  letraErrada: { borderColor: '#E3A24A', backgroundColor: '#E3A24A' },
  letraTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 18 },
  rodapeCerto: { borderTopColor: 'transparent', backgroundColor: '#E3F6EA' },
  rodapeErrado: { borderTopColor: 'transparent', backgroundColor: '#FFF1E0' },
  retorno: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  retornoIcone: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4,
    borderColor: cores.sucesso, backgroundColor: cores.sucessoClaro },
  retornoIconeErrado: { borderColor: '#B4650D', backgroundColor: '#E58A1F' },
  retornoTextos: { flex: 1, minWidth: 0, gap: 2 },
  retornoTitulo: { color: cores.sucesso, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 28 },
  retornoTituloErrado: { color: '#8A4B00' },
  retornoExtra: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  retornoAcoes: { flexDirection: 'row', gap: 10 },
  metade: { flex: 1, minWidth: 0 },
});
