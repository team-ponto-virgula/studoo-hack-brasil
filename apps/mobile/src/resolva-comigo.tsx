import { useEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { falarFormula, formulaLinear, lerFormula, type EscolhaNoSuaVez, type LicaoDetalhe, type OpcaoDoSuaVez, type PassoDaResolucao } from '@studoo/contratos';
import { useAparecer } from './animacoes';
import { DesenhoDoVisual, OPCOES_DA_FORMULA } from './desenho';
import { focarSemRolar } from './foco';
import { Icone } from './icone';
import { Botao } from './interface';
import { Stu } from './mascote';
import { mensagens } from './mensagens';
import { Opcao, letras } from './opcao';
import {
  acaoDoRodape, aplicarResposta, avancar, comecarResolva, contextoDoPasso, formulaDeContexto, formulaDoMetodo, indiceDoSuaVez,
  noSuaVez, resolucaoUtil, respostaValida, tentarDeNovo, visualDoPasso, voltar, type EstadoResolva,
} from './resolva-comigo-regras';
import { tocaSons } from './sons';
import { TextoComFormulas } from './texto-com-formulas';
import { cores, fontes } from './tema';

/*
 * "Resolva comigo" (spec 15, seção 4): a forma da etapa Exemplo quando a lição traz `resolucao` (não é etapa nova). Os passos
 * vêm um a um, os feitos ficam compactos em cima, o rodapé preso leva ao próximo, e o "Sua vez" pergunta ao servidor; antes da
 * escolha, o app não tem a resposta. Sem rede no "Sua vez", o exemplo segue em texto, sem travar a pessoa.
 */

const t = mensagens.resolvaComigo;

/** A fórmula em texto linear (linha compacta, opção do "Sua vez") e o texto falado dela; `null` quando não se lê. */
function formulaEmTexto(latex: string | undefined): { texto: string; falado: string } | null {
  if (!latex) return null;
  const lida = lerFormula(latex);
  return lida.ok ? { texto: formulaLinear(lida.arvore), falado: falarFormula(lida.arvore) } : null;
}

/** A opção do "Sua vez" como texto com fórmula em linha: a fórmula da opção vai marcada (`$…$`) e o motor a desenha. */
function textoDaOpcao(opcao: OpcaoDoSuaVez): string {
  if (opcao.texto) return opcao.texto;
  return opcao.formula && formulaEmTexto(opcao.formula) ? `$${opcao.formula}$` : '';
}

function FormulaEmBloco({ latex, testID }: { latex: string | undefined; testID?: string }) {
  if (!latex) return null;
  return <DesenhoDoVisual visual={{ tipo: 'formula', latex }} contexto={{ tipo: 'enunciado' }} opcoes={OPCOES_DA_FORMULA} testID={testID} entrada={false} />;
}

function Indicador({ atual, total }: { atual: number; total: number }) {
  return (
    <View style={estilos.indicador}>
      <Text testID="resolva-indicador" accessibilityLiveRegion="polite" style={estilos.indicadorTexto}>{t.passo(atual + 1, total)}</Text>
      <View style={estilos.tracos} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {Array.from({ length: total }, (_, posicao) => (
          <View key={posicao} style={[estilos.traco, posicao <= atual && { backgroundColor: cores.acao }, posicao === atual && { width: 34 }]} />
        ))}
      </View>
    </View>
  );
}

/** Um passo feito, numa linha: o visto, o nome e a fórmula reduzida. Tocar reabre o passo ali mesmo. */
function LinhaFeita({ passo, numero }: { passo: PassoDaResolucao; numero: number }) {
  const [aberto, setAberto] = useState(false);
  const formula = formulaEmTexto(passo.formula);
  return (
    <View style={estilos.feito}>
      <Pressable testID={`resolva-feito-${numero}`} accessibilityRole="button" accessibilityState={{ expanded: aberto }} aria-expanded={aberto}
        accessibilityLabel={`${passo.nome}${formula ? `: ${formula.falado}` : ''}`} onPress={() => setAberto((atual) => !atual)} style={estilos.feitoLinha}>
        <Icone nome="check" tamanho={16} cor={cores.sucesso} />
        <Text style={estilos.feitoNome} numberOfLines={1}>{passo.nome}</Text>
        {formula && !aberto && <Text style={estilos.feitoFormula} numberOfLines={1}>{formula.texto}</Text>}
      </Pressable>
      {aberto && (
        <View style={{ gap: 8, paddingTop: 6 }}>
          <TextoComFormulas texto={passo.texto} estilo={estilos.feitoTexto} />
          <FormulaEmBloco latex={passo.formula} />
        </View>
      )}
    </View>
  );
}

/** O "Sua vez": a pergunta e as três opções; depois da correção, o porquê (e, no acerto ou na segunda errada, a revelação). */
function SuaVez({ passo, estado, ocupado, escolher }: {
  passo: PassoDaResolucao; estado: EstadoResolva; ocupado: boolean; escolher: (opcao: number) => void;
}) {
  const tentativa = passo.tentativa;
  if (!tentativa) return null;
  const { resposta, corrigida, revelado } = estado;
  const retornoDa = (opcao: number): 'certa' | 'errada' | null => {
    if (!resposta || corrigida === null) return null;
    if (opcao === corrigida) return resposta.correta ? 'certa' : 'errada';
    if (revelado && resposta.certa === opcao) return 'certa';
    return null;
  };
  const travado = ocupado || revelado || (resposta !== null && estado.escolha === corrigida);
  return (
    <View style={{ gap: 12 }}>
      {!revelado && <FormulaEmBloco latex={formulaDeContexto(estado)} testID="resolva-formula-contexto" />}
      <View style={estilos.seloSuaVez}><Text style={estilos.seloSuaVezTexto}>{t.suaVez.toUpperCase()}</Text></View>
      <TextoComFormulas testID="resolva-pergunta" texto={tentativa.pergunta} estilo={estilos.pergunta} />
      <View accessibilityRole="radiogroup" accessibilityLabel={tentativa.pergunta} style={{ gap: 10 }}>
        {tentativa.opcoes.map((opcao, numero) => (
          <Opcao key={numero} id={`suavez-${numero}`} letra={letras[numero]} texto={textoDaOpcao(opcao)}
            selecionada={estado.escolha === numero} retorno={retornoDa(numero)} desativada={travado}
            apagada={revelado && retornoDa(numero) === null} acao={() => escolher(numero)} />
        ))}
      </View>
      {resposta && !resposta.correta && (
        <View testID="resolva-porque" accessibilityLiveRegion="polite" style={estilos.porqueErrado}>
          <TextoComFormulas texto={resposta.porque} estilo={estilos.porqueErradoTexto} />
        </View>
      )}
      {resposta && revelado && (
        <View testID="resolva-isso" accessibilityLiveRegion="polite" style={estilos.isso}>
          {resposta.correta && <Text style={estilos.issoTitulo}>{t.isso}</Text>}
          <TextoComFormulas texto={(resposta.correta ? resposta.porque : resposta.porqueDaCerta) ?? ''} estilo={estilos.issoTexto} />
          <FormulaEmBloco latex={passo.formula} testID="resolva-formula-revelada" />
        </View>
      )}
    </View>
  );
}

/** O cartão do passo atual: o Stu, a frase e a fórmula (ou o "Sua vez"). Entra subindo 8 em 200 ms (na hora, sem movimento). */
function CartaoDoPasso({ passo, estado, ultimo, ocupado, escolher, referenciaDaFrase }: {
  passo: PassoDaResolucao; estado: EstadoResolva; ultimo: boolean; ocupado: boolean; escolher: (opcao: number) => void;
  referenciaDaFrase: RefObject<ComponentRef<typeof Text> | null>;
}) {
  const aparecer = useAparecer(0, 200);
  return (
    <Animated.View testID="resolva-passo" style={[estilos.cartao,
      { opacity: aparecer, transform: [{ translateY: aparecer.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      <View style={estilos.cartaoTopo}>
        <Stu nome={ultimo ? 'stu-animado' : 'stu-concentrado'} tamanho={40} />
        <TextoComFormulas referencia={referenciaDaFrase} testID="resolva-frase" accessible texto={passo.texto} estilo={estilos.frase} />
      </View>
      {passo.tentativa ? <SuaVez passo={passo} estado={estado} ocupado={ocupado} escolher={escolher} />
        : <FormulaEmBloco latex={passo.formula} testID="resolva-formula" />}
    </Animated.View>
  );
}

function CartaoMetodo({ passos, formula }: { passos: PassoDaResolucao[]; formula: string | undefined }) {
  return (
    <View testID="resolva-metodo" style={estilos.metodo}>
      <Text accessibilityRole="header" style={estilos.metodoTitulo}>{t.metodo}</Text>
      {passos.map((passo, numero) => (
        <Text key={numero} style={estilos.metodoLinha}>{`${numero + 1}. ${passo.nome}`}</Text>
      ))}
      <FormulaEmBloco latex={formula} testID="resolva-metodo-formula" />
    </View>
  );
}

/**
 * O "Resolva comigo" da etapa Exemplo: o corpo e o rodapé, para a lição montar no lugar do exemplo em texto. `ativo` é falso
 * sem resolução ou quando o "Sua vez" ficou sem rede (aí a lição mostra o exemplo em texto, como antes).
 */
export function useResolvaComigo({ licao, responder, aoTerminar, visivel }: {
  licao: LicaoDetalhe;
  responder?: (escolha: EscolhaNoSuaVez) => Promise<unknown>;
  aoTerminar: () => void;
  /** A etapa Exemplo está na tela (o anúncio e o foco do passo só valem nela). */
  visivel: boolean;
}): { ativo: boolean; corpo: ReactNode; rodape: ReactNode; metodo: ReactNode } {
  const resolucao = resolucaoUtil(licao.resolucao) ? licao.resolucao : undefined;
  const [estado, setEstado] = useState<EstadoResolva | null>(() => (resolucao ? comecarResolva(resolucao) : null));
  const [ocupado, setOcupado] = useState(false);
  const frase = useRef<ComponentRef<typeof Text> | null>(null);
  const primeiro = useRef(true);

  // A cada passo novo, o foco vai para a frase do passo e a região educada anuncia "Passo n de N" (spec 15, leitor de tela).
  useEffect(() => {
    if (!estado || !visivel) return;
    if (primeiro.current) { primeiro.current = false; return; }
    AccessibilityInfo.announceForAccessibility(t.passo(estado.atual + 1, estado.total));
    const espera = setTimeout(() => focarSemRolar(frase.current), 250);
    return () => clearTimeout(espera);
  }, [estado?.atual, visivel]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!resolucao || !estado || estado.emTexto || !responder) return { ativo: false, corpo: null, rodape: null, metodo: null };

  const passo = estado.passos[estado.atual];
  const ultimo = estado.revelado && estado.atual === estado.total - 1;
  const visual = visualDoPasso(resolucao, estado);

  function escolher(opcao: number) {
    void tocaSons.tocarEfeito('toque_opcao');
    setEstado((atual) => (atual ? { ...atual, escolha: opcao } : atual));
  }

  async function verificar() {
    if (!estado || estado.escolha === null || ocupado || !responder) return;
    setOcupado(true);
    try {
      const corpo = await responder({ opcao: estado.escolha, tentativa: estado.tentativa });
      if (!respostaValida(corpo)) throw new Error('resposta');
      void tocaSons.tocarEfeito(corpo.correta ? 'acerto' : 'erro');
      setEstado((atual) => (atual ? aplicarResposta(atual, corpo) : atual));
    } catch {
      // Sem rede (ou uma resposta que não serve): o exemplo segue em texto, e a lição continua.
      setEstado((atual) => (atual ? { ...atual, emTexto: true } : atual));
    } finally {
      setOcupado(false);
    }
  }

  const acao = acaoDoRodape(estado);
  const rodape = acao === 'verificar'
    ? <Botao testID="resolva-verificar" peso="900" rotulo={t.verificar} desativado={ocupado || estado.escolha === null} carregando={ocupado} ocupado={ocupado}
        acao={() => void verificar()} />
    : acao === 'tentar'
      ? <Botao testID="resolva-tentar" peso="900" rotulo={t.tentarDeNovo} acao={() => setEstado((atual) => (atual ? tentarDeNovo(atual) : atual))} />
      : acao === 'agora'
        ? <Botao testID="resolva-agora" peso="900" rotulo={t.agora} icone="seta" acao={aoTerminar} />
        : <Botao testID="resolva-proximo" peso="900" rotulo={t.proximo} icone="seta" acao={() => setEstado((atual) => (atual ? avancar(atual) : atual))} />;

  const corpo = (
    <View testID="resolva-comigo" style={{ gap: 14 }}>
      <TextoComFormulas testID="resolva-problema" accessibilityRole="header" texto={resolucao.problema} estilo={estilos.problema} />
      {/* O desenho de cima troca no mesmo lugar quando o passo mexe nele; o procurado só vira resposta no último passo. */}
      {visual && <DesenhoDoVisual visual={visual} contexto={contextoDoPasso(estado)} testID="resolva-visual" entrada={false} />}
      <Indicador atual={estado.atual} total={estado.total} />
      {estado.passos.slice(0, estado.atual).map((feito, numero) => <LinhaFeita key={numero} passo={feito} numero={numero + 1} />)}
      {passo && <CartaoDoPasso key={estado.atual} passo={passo} estado={estado} ultimo={ultimo} ocupado={ocupado} escolher={escolher} referenciaDaFrase={frase} />}
      {estado.atual > 0 && (
        <Botao testID="resolva-voltar" variante="texto" rotulo={t.voltar} desativado={ocupado} acao={() => setEstado((atual) => (atual ? voltar(atual) : atual))} />
      )}
      {ultimo && <CartaoMetodo passos={estado.passos} formula={formulaDoMetodo(licao.visuais)} />}
    </View>
  );
  // No exercício, "Rever a explicação" abre também "O método" (depois que a pessoa viu a resolução inteira).
  const metodo = estado.revelado && estado.passos.length === estado.total ? <CartaoMetodo passos={estado.passos} formula={formulaDoMetodo(licao.visuais)} /> : null;
  return { ativo: true, corpo, rodape, metodo };
}

/** Para os testes: o passo do "Sua vez" e se o app está nele. */
export const regrasDoResolva = { indiceDoSuaVez, noSuaVez };

const estilos = StyleSheet.create({
  problema: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 17, lineHeight: 23 },
  indicador: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  indicadorTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  tracos: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  traco: { width: 18, height: 6, borderRadius: 3, backgroundColor: cores.gelo },
  feito: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#F4F7FF' },
  feitoLinha: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
  feitoNome: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20, flexShrink: 0, maxWidth: '55%' },
  feitoFormula: { flex: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20, textAlign: 'right' },
  feitoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 21 },
  cartao: { gap: 12, padding: 16, borderRadius: 20, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  cartaoTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  frase: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 22 },
  seloSuaVez: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FFF1CC' },
  seloSuaVezTexto: { color: '#8A5A00', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 18, letterSpacing: 0.6 },
  pergunta: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 22 },
  porqueErrado: { padding: 12, borderRadius: 14, backgroundColor: '#FFF6EA' },
  porqueErradoTexto: { color: '#7A4A00', fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 21 },
  isso: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: cores.sucessoFundo },
  issoTitulo: { color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 16, lineHeight: 22 },
  issoTexto: { color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 21 },
  metodo: { gap: 6, padding: 16, borderRadius: 20, borderWidth: 2, borderColor: '#FFE3A3', backgroundColor: '#FFFAF0' },
  metodoTitulo: { color: '#8A5A00', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 16, lineHeight: 22 },
  metodoLinha: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 21 },
});
