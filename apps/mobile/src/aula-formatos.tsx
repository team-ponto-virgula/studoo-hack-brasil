import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import {
  AUTOAVALIACOES,
  codificarResposta,
  linhasDePassos,
  partesDaLacuna,
  semAspas,
  sintetizarAcorde,
  sintetizarBatida,
  type AutoAvaliacao,
  type Avaliacao,
  type Fala,
  type Opcao,
  type Pratica,
  type Recurso,
  type TipoTrecho,
} from '@studoo/contratos';
import { Icone } from './icone';
import { Botao, estilos } from './interface';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';

/*
 * Formatos da aula no app, com os mesmos dados e a mesma sequência da web (src/app/aula.tsx), adaptados ao toque:
 * trechos com o visual do conteúdo, frases para ouvir (voz do aparelho), acorde com diagrama e som sintetizado, linha
 * do tempo, foto do material, ordenar, associar, verdadeiro ou falso, resposta aberta e a prática com cronômetro.
 */

const t = mensagens.licao;

/**
 * Lê a fala em voz alta com a voz do aparelho, no idioma dela. `aoTerminar` avisa quando a voz acaba (ou é
 * interrompida), com uma reserva pelo tamanho da frase, como na web.
 */
function falar(fala: Fala, devagar: boolean, aoTerminar?: () => void) {
  let reserva: ReturnType<typeof setTimeout> | undefined;
  const fim = () => {
    if (reserva) clearTimeout(reserva);
    aoTerminar?.();
  };
  try {
    void Speech.stop();
    if (aoTerminar) reserva = setTimeout(aoTerminar, Math.max(1500, (fala.texto.length * 90) / (devagar ? 0.6 : 0.95)));
    Speech.speak(fala.texto, { language: fala.idioma, rate: devagar ? 0.6 : 0.95, onDone: fim, onStopped: fim, onError: fim });
  } catch {
    fim();
    AccessibilityInfo.announceForAccessibility(t.audio.semVoz);
  }
}

/** O que está tocando agora (normal ou devagar), para o chip mostrar "Tocando…". */
function useTocando(fala: Fala) {
  const [tocando, setTocando] = useState<'normal' | 'devagar' | null>(null);
  const tocar = (devagar: boolean) => {
    setTocando(devagar ? 'devagar' : 'normal');
    falar(fala, devagar, () => setTocando(null));
  };
  return [tocando, tocar] as const;
}

/** Para a voz (ao sair da aula ou da etapa). */
export function pararVoz() {
  try {
    void Speech.stop();
  } catch {
    // Sem voz no aparelho: nada para parar.
  }
}

/**
 * Toca o acorde: o WAV sintetizado (o mesmo da web) vai para um arquivo temporário e toca com o expo-audio. Na prévia
 * web do app, toca direto como Blob.
 */
async function tocarSom(som: 'acorde' | 'batida', casas: number[]) {
  const bytes = som === 'acorde' ? sintetizarAcorde(casas) : sintetizarBatida(casas);
  if (Platform.OS === 'web') {
    const Reprodutor = (globalThis as unknown as { Audio: new (url: string) => { play: () => Promise<void> } }).Audio;
    await new Reprodutor(URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/wav' }))).play();
    return;
  }
  const arquivo = new File(Paths.cache, `${som}-${casas.map((casa) => casa + 1).join('')}.wav`);
  if (!arquivo.exists) {
    arquivo.create({ overwrite: true });
    await arquivo.write(bytes);
  }
  await setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  const reprodutor = createAudioPlayer({ uri: arquivo.uri });
  reprodutor.play();
  setTimeout(() => reprodutor.remove(), som === 'acorde' ? 4000 : 10_000);
}

/** Chip de ação pequeno, com relevo: ouvir, devagar, mostrar o texto. */
function Chip({ rotulo, acao, icone, destaque = false, grande = false, nomeAcessivel }: {
  rotulo: string;
  acao: () => void;
  icone?: 'som';
  destaque?: boolean;
  grande?: boolean;
  nomeAcessivel?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={nomeAcessivel ?? rotulo} onPress={acao}
      style={({ pressed }) => [formatos.chip, destaque && formatos.chipDestaque, grande && formatos.chipGrande, pressed && formatos.chipAfundado]}>
      {icone && <Icone nome={icone} tamanho={grande ? 22 : 18} cor={destaque ? cores.acaoEscura : cores.textoSecundario} />}
      <Text style={[formatos.chipTexto, destaque && { color: cores.acaoEscura }, grande && { fontSize: 16 }]}>{rotulo}</Text>
    </Pressable>
  );
}

export function BotoesOuvir({ fala }: { fala: Fala }) {
  const [tocando, tocar] = useTocando(fala);
  return (
    <View style={formatos.ouvir}>
      <Chip rotulo={tocando === 'normal' ? t.audio.tocando : t.audio.ouvir} icone="som" destaque nomeAcessivel={t.audio.ouvirFrase(fala.texto)}
        acao={() => tocar(false)} />
      <Chip rotulo={tocando === 'devagar' ? t.audio.tocando : t.audio.devagar} nomeAcessivel={t.audio.ouvirDevagar(fala.texto)} acao={() => tocar(true)} />
    </View>
  );
}

/** Exercício de escuta: o áudio primeiro; o texto aparece quando a pessoa pede. */
export function Escuta({ fala }: { fala: Fala }) {
  const [mostrar, setMostrar] = useState(false);
  const [tocando, tocar] = useTocando(fala);
  return (
    <View style={formatos.escuta}>
      <View style={formatos.rotuloLinha}>
        <Icone nome="som" tamanho={16} cor={cores.acaoEscura} />
        <Text style={[formatos.rotuloCaixa, { color: cores.acaoEscura }]}>{t.audio.escuta.toLocaleUpperCase('pt-BR')}</Text>
      </View>
      <View style={formatos.ouvir}>
        <Chip rotulo={tocando === 'normal' ? t.audio.tocando : t.audio.ouvirExercicio} icone="som" destaque grande acao={() => tocar(false)} />
        <Chip rotulo={tocando === 'devagar' ? t.audio.tocando : t.audio.devagar} grande acao={() => tocar(true)} />
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: mostrar }} onPress={() => setMostrar((atual) => !atual)}>
        <Text style={formatos.link}>{mostrar ? t.audio.esconderTexto : t.audio.mostrarTexto}</Text>
      </Pressable>
      {mostrar && <Text selectable style={formatos.fraseGrande}>{fala.texto}</Text>}
    </View>
  );
}

/** Ouça e repita: cada frase com a tradução e os botões de ouvir. */
export function Falas({ falas }: { falas: Fala[] }) {
  return (
    <View style={formatos.secao}>
      <Text accessibilityRole="header" style={formatos.rotuloCaixa}>{t.audio.falasTitulo.toLocaleUpperCase('pt-BR')}</Text>
      {falas.map((fala, posicao) => (
        <View key={posicao} style={formatos.fala}>
          <Text selectable style={formatos.falaTexto}>{fala.texto}</Text>
          {fala.traducao && <Text style={estilos.legenda}>{fala.traducao}</Text>}
          <BotoesOuvir fala={fala} />
        </View>
      ))}
    </View>
  );
}

/** Texto com as lacunas destacadas (um espaço sublinhado). */
function ComLacunas({ texto, estilo }: { texto: string; estilo?: object }) {
  const partes = partesDaLacuna(texto);
  return (
    <Text selectable style={estilo}>
      {partes.map((parte, posicao) => (
        <Text key={posicao}>
          {parte}
          {posicao < partes.length - 1 && <Text accessibilityLabel="lacuna" style={formatos.lacuna}>{'   '}</Text>}
        </Text>
      ))}
    </Text>
  );
}

/** Trecho no visual do conteúdo: só o código usa fonte monoespaçada. */
export function Trecho({ texto, tipo = 'frase', fala }: { texto: string; tipo?: TipoTrecho; fala?: Fala }) {
  switch (tipo) {
    case 'codigo':
      return <ComLacunas texto={texto} estilo={formatos.codigo} />;
    case 'citacao':
      return (
        <View style={formatos.citacao}>
          <Text style={formatos.aspas} importantForAccessibility="no" accessibilityElementsHidden>“</Text>
          <ComLacunas texto={semAspas(texto)} estilo={formatos.citacaoTexto} />
        </View>
      );
    case 'formula':
      return <View style={formatos.formula}><ComLacunas texto={texto} estilo={formatos.formulaTexto} /></View>;
    case 'passos':
      return <Passos passos={linhasDePassos(texto)} />;
    default:
      return (
        <View style={formatos.frase}>
          <ComLacunas texto={texto} estilo={formatos.fraseTexto} />
          {fala && <BotoesOuvir fala={fala} />}
        </View>
      );
  }
}

/** Passo a passo numerado (demonstração e trechos em passos). */
export function Passos({ passos, titulo }: { passos: string[]; titulo?: string }) {
  return (
    <View style={formatos.secao}>
      {titulo && <Text accessibilityRole="header" style={formatos.rotuloCaixa}>{titulo.toLocaleUpperCase('pt-BR')}</Text>}
      {passos.map((passo, posicao) => (
        <View key={posicao} style={formatos.passo}>
          <View style={formatos.passoNumero} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Text style={formatos.passoNumeroTexto}>{posicao + 1}</Text>
          </View>
          <Text style={[estilos.texto, formatos.passoTexto]}>{passo}</Text>
        </View>
      ))}
    </View>
  );
}

/** Recurso do exemplo: acorde (diagrama e som), linha do tempo ou a foto do material. */
export function RecursoDaLicao({ recurso }: { recurso: Recurso }) {
  if (recurso.tipo === 'acorde') return <DiagramaAcorde recurso={recurso} />;
  if (recurso.tipo === 'fracao') {
    const descricao = t.recursos.fracaoDescricao(recurso.numerador, recurso.denominador);
    return (
      <View style={formatos.fracao}>
        <View style={formatos.fracaoBarra} accessible accessibilityRole="image" accessibilityLabel={`${recurso.numerador}/${recurso.denominador}: ${descricao}`}>
          {Array.from({ length: recurso.denominador }, (_, posicao) => (
            <View key={posicao} style={[formatos.fracaoParte, posicao < recurso.numerador && formatos.fracaoCheia]} />
          ))}
        </View>
        <View style={formatos.fracaoLegenda}>
          <Text style={formatos.fracaoRotulo}>{recurso.rotulo ?? `${recurso.numerador}/${recurso.denominador}`}</Text>
          <Text style={estilos.legenda}>{descricao}</Text>
        </View>
      </View>
    );
  }
  if (recurso.tipo === 'linha_do_tempo') {
    return (
      <View style={formatos.secao}>
        <Text accessibilityRole="header" style={formatos.rotuloCaixa}>{t.recursos.linhaDoTempo.toLocaleUpperCase('pt-BR')}</Text>
        <View style={formatos.linhaTempo}>
          <View style={formatos.linhaTempoTrilho} />
          {recurso.eventos.map((evento, posicao) => (
            <View key={posicao} style={formatos.linhaTempoEvento} accessible accessibilityLabel={`${evento.quando}: ${evento.texto}`}>
              <View style={formatos.linhaTempoPonto} />
              <Text style={formatos.linhaTempoQuando}>{evento.quando}</Text>
              <Text style={[estilos.texto, { fontWeight: '700' }]}>{evento.texto}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={formatos.secao}>
      <Image source={{ uri: recurso.src }} accessibilityLabel={`${recurso.fonte ?? t.recursos.doMaterial}: ${recurso.descricao}`} resizeMode="contain" style={formatos.imagem} />
      <Text style={estilos.legenda}><Text style={{ fontWeight: '800' }}>{recurso.fonte ?? t.recursos.doMaterial}</Text> · {recurso.descricao}</Text>
    </View>
  );
}

/** Diagrama do acorde com Views (o app não usa SVG) e o botão de ouvir o acorde. */
/**
 * O braço de um acorde (cordas, trastes, X e O, dedos numerados). `escala` encolhe o desenho por inteiro, para dois
 * acordes caberem lado a lado.
 */
function BracoDoAcorde({ nome, casas, dedos, escala = 1 }: { nome: string; casas: number[]; dedos?: number[]; escala?: number }) {
  const tocadas = casas.filter((casa) => casa > 0);
  const base = Math.max(0, ...tocadas) > 4 ? Math.min(...tocadas) : 1;
  const x = (corda: number) => 22 + corda * 26;
  const y = (casa: number) => 40 + (casa - base + 0.5) * 30;
  const descricao = casas
    .map((casa, corda) => t.recursos.corda(6 - corda, casa, t.recursos.dedos[dedos?.[corda] ?? 0] ?? ''))
    .join('; ');
  // As medidas do desenho (as de formatos.acordeDesenho), em números: o StyleSheet não garante ler de volta.
  const largura = 176;
  const altura = 182;
  return (
    <View style={{ width: largura * escala, height: altura * escala }} accessible accessibilityRole="image"
      accessibilityLabel={`${t.recursos.acorde(nome)}: ${descricao}.`}>
      <View style={[formatos.acordeDesenho, escala !== 1 && {
        transform: [{ translateX: (-largura * (1 - escala)) / 2 }, { translateY: (-altura * (1 - escala)) / 2 }, { scale: escala }],
      }]}>
        {base === 1
          ? <View style={[formatos.pestana, { left: x(0) - 3, width: x(5) - x(0) + 6 }]} />
          : <Text style={[formatos.acordeBase, { top: y(base) - 9 }]}>{base}</Text>}
        {[0, 1, 2, 3, 4].map((traste) => <View key={traste} style={[formatos.traste, { top: 40 + traste * 30, left: x(0), width: x(5) - x(0) }]} />)}
        {[0, 1, 2, 3, 4, 5].map((corda) => (
          <View key={corda} style={[formatos.cordaVertical, { left: x(corda) - (3.4 - corda * 0.4) / 2, width: 3.4 - corda * 0.4 }]} />
        ))}
        {casas.map((casa, corda) => (casa <= 0 ? (
          <Text key={corda} style={[formatos.marcaCorda, { left: x(corda) - 8, color: casa < 0 ? cores.erro : cores.sucesso }]}>{casa < 0 ? 'X' : 'O'}</Text>
        ) : (
          <View key={corda} style={[formatos.dedo, { left: x(corda) - 11, top: y(casa) - 11 }]}>
            {Boolean(dedos?.[corda]) && <Text style={formatos.dedoTexto}>{dedos?.[corda]}</Text>}
          </View>
        )))}
      </View>
    </View>
  );
}

/** Diagrama do acorde com o som; com `anterior`, os dois acordes da troca lado a lado (Am → C), como na web. */
function DiagramaAcorde({ recurso }: { recurso: Extract<Recurso, { tipo: 'acorde' }> }) {
  type Som = 'acorde' | 'batida' | 'anterior';
  const [tocando, setTocando] = useState<Som | null>(null);
  const [semSom, setSemSom] = useState(false);
  const { anterior } = recurso;

  function tocar(som: Som) {
    setTocando(som);
    setSemSom(false);
    const casas = som === 'anterior' && anterior ? anterior.casas : recurso.casas;
    tocarSom(som === 'batida' ? 'batida' : 'acorde', casas)
      .catch(() => {
        setSemSom(true);
        AccessibilityInfo.announceForAccessibility(t.recursos.semSom);
      })
      .finally(() => setTimeout(() => setTocando(null), som === 'batida' ? 8000 : 2600));
  }

  return (
    <View style={formatos.acorde}>
      {anterior ? (
        <View style={formatos.comparacao}>
          <View style={formatos.lado}>
            <BracoDoAcorde {...anterior} escala={0.72} />
            <Text style={formatos.ladoNome}>{anterior.nome}</Text>
          </View>
          <Icone nome="seta" tamanho={20} cor={cores.textoSecundario} />
          <View style={formatos.lado}>
            <BracoDoAcorde nome={recurso.nome} casas={recurso.casas} dedos={recurso.dedos} escala={0.72} />
            <Text style={formatos.ladoNome}>{recurso.nome}</Text>
          </View>
        </View>
      ) : <BracoDoAcorde nome={recurso.nome} casas={recurso.casas} dedos={recurso.dedos} />}
      <View style={formatos.acordeLegenda}>
        <Text style={formatos.acordeNome}>{anterior ? t.recursos.troca(anterior.nome, recurso.nome) : t.recursos.acorde(recurso.nome)}</Text>
        <Text style={estilos.legenda}>{t.recursos.legendaAcorde}</Text>
        {anterior && (
          <Botao rotulo={tocando === 'anterior' ? t.recursos.tocando : t.recursos.ouvirNome(anterior.nome)} variante="secundario" compacto
            desativado={tocando !== null} acao={() => tocar('anterior')} />
        )}
        <Botao rotulo={tocando === 'acorde' ? t.recursos.tocando : anterior ? t.recursos.ouvirNome(recurso.nome) : t.recursos.ouvirAcorde}
          variante="secundario" compacto desativado={tocando !== null} acao={() => tocar('acorde')} />
        {recurso.batida && (
          <Botao rotulo={tocando === 'batida' ? t.recursos.tocando : t.recursos.ouvirBatida} variante="secundario" compacto
            desativado={tocando !== null} acao={() => tocar('batida')} />
        )}
        {semSom && <Text style={[estilos.legenda, { color: cores.alerta, fontWeight: '700' }]}>{t.recursos.semSom}</Text>}
      </View>
    </View>
  );
}

/** Ordenar tocando: cada toque coloca o item na próxima posição; tocar num item colocado tira ele da ordem. */
export function Ordenar({ itens, valor, mudar, desativado, certos }: {
  itens: Opcao[];
  valor: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  certos?: string[];
}) {
  const ordem = valor.split(',').filter((id) => itens.some((item) => item.id === id));
  const restantes = itens.filter((item) => !ordem.includes(item.id));
  const texto = (id: string) => itens.find((item) => item.id === id)?.texto ?? '';
  return (
    <View style={formatos.secao}>
      <Text style={formatos.instrucao}>{t.ordenar.instrucao}</Text>
      <Text style={formatos.rotuloCaixa}>{t.ordenar.suaOrdem.toLocaleUpperCase('pt-BR')}</Text>
      <View style={formatos.ordemCaixa}>
        {ordem.length === 0 && <Text style={[estilos.legenda, { textAlign: 'center' }]}>{t.ordenar.vazio}</Text>}
        {ordem.map((id, posicao) => {
          const estado = certos ? (certos.includes(id) ? 'certo' : 'errado') : null;
          return (
            <Pressable key={id} accessibilityRole="button" accessibilityLabel={t.ordenar.tirar(texto(id), posicao + 1)} disabled={desativado}
              onPress={() => mudar(codificarResposta.ordem(ordem.filter((item) => item !== id)))}
              style={({ pressed }) => [formatos.cartao, formatos.cartaoEscolhido, estado === 'certo' && formatos.cartaoCerto,
                estado === 'errado' && formatos.cartaoErrado, pressed && formatos.cartaoAfundado]}>
              <View style={[formatos.posicao, estado === 'certo' && { backgroundColor: cores.sucessoClaro }, estado === 'errado' && { backgroundColor: '#E3A24A' }]}>
                <Text style={formatos.posicaoTexto}>{t.ordenar.posicao(posicao + 1)}</Text>
              </View>
              <Text style={[estilos.texto, formatos.cartaoTexto]}>{texto(id)}</Text>
            </Pressable>
          );
        })}
      </View>
      {restantes.length > 0 && <View style={formatos.disponiveis} accessibilityRole="none" accessibilityLabel={t.ordenar.disponiveis}>
        {restantes.map((item) => (
          <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={t.ordenar.colocar(item.texto)} disabled={desativado}
            onPress={() => mudar(codificarResposta.ordem([...ordem, item.id]))}
            style={({ pressed }) => [formatos.cartao, pressed && formatos.cartaoAfundado]}>
            <Text style={[estilos.texto, formatos.cartaoTexto]}>{item.texto}</Text>
          </Pressable>
        ))}
      </View>}
      {ordem.length > 0 && !desativado && (
        <Pressable accessibilityRole="button" onPress={() => mudar('')}><Text style={formatos.link}>{t.ordenar.recomecar}</Text></Pressable>
      )}
    </View>
  );
}

const coresDosPares = [cores.acao, '#C25A8A', '#1F8A8A', '#B7791F', '#6B3FA0', '#5E6A85'];

/** Associar tocando: um item da esquerda e depois o par na direita; cada par ganha um número e uma cor. */
export function Associar({ esquerda, direita, valor, mudar, desativado, certos }: {
  esquerda: Opcao[];
  direita: Opcao[];
  valor: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  certos?: string[];
}) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const pares = valor.split(',').filter(Boolean).map((par) => par.split('=') as [string, string]);
  const numero = (id: string) => pares.findIndex(([item, outro]) => item === id || outro === id) + 1;
  const texto = (lista: Opcao[], id: string) => lista.find((item) => item.id === id)?.texto ?? '';
  const salvar = (novos: [string, string][]) => mudar(codificarResposta.pares(novos));

  function tocarEsquerda(id: string) {
    if (pares.some(([item]) => item === id)) {
      salvar(pares.filter(([item]) => item !== id));
      setEscolhida(null);
      return;
    }
    setEscolhida((atual) => {
      const nova = atual === id ? null : id;
      if (nova) AccessibilityInfo.announceForAccessibility(t.associar.escolhido(texto(esquerda, nova)));
      return nova;
    });
  }

  function tocarDireita(id: string) {
    if (!escolhida) {
      if (pares.some(([, item]) => item === id)) salvar(pares.filter(([, item]) => item !== id));
      return;
    }
    salvar([...pares.filter(([item, outro]) => item !== escolhida && outro !== id), [escolhida, id]]);
    setEscolhida(null);
  }

  function cartao(item: Opcao, lado: 'esquerda' | 'direita') {
    const par = lado === 'esquerda' ? pares.find(([id]) => id === item.id) : pares.find(([, id]) => id === item.id);
    const indice = par ? numero(item.id) : 0;
    const cor = coresDosPares[(indice - 1) % coresDosPares.length];
    const chave = par ? par[0] : null;
    const estado = certos && chave ? (certos.includes(chave) ? 'certo' : 'errado') : null;
    let rotulo = item.texto;
    if (lado === 'direita' && escolhida) rotulo = t.associar.ligar(texto(esquerda, escolhida), item.texto);
    else if (par) rotulo = t.associar.desfazer(texto(esquerda, par[0]), texto(direita, par[1]));
    return (
      <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={rotulo} disabled={desativado}
        accessibilityState={{ selected: escolhida === item.id }}
        onPress={() => (lado === 'esquerda' ? tocarEsquerda(item.id) : tocarDireita(item.id))}
        style={({ pressed }) => [formatos.cartao, formatos.cartaoPar, par && { borderColor: cor, borderBottomColor: cor },
          escolhida === item.id && formatos.cartaoEscolhido, estado === 'certo' && formatos.cartaoCerto,
          estado === 'errado' && formatos.cartaoErrado, pressed && formatos.cartaoAfundado]}>
        {par && (
          <View style={[formatos.numeroPar, { backgroundColor: estado === 'certo' ? cores.sucessoClaro : estado === 'errado' ? '#E3A24A' : cor }]}>
            <Text style={formatos.posicaoTexto}>{indice}</Text>
          </View>
        )}
        <Text style={[estilos.texto, formatos.cartaoTexto, { fontSize: 15 }]}>{item.texto}</Text>
      </Pressable>
    );
  }

  return (
    <View style={formatos.secao}>
      <Text style={formatos.instrucao} accessibilityLiveRegion="polite">
        {escolhida ? t.associar.escolhido(texto(esquerda, escolhida)) : t.associar.instrucao}
      </Text>
      <View style={formatos.colunas}>
        <View style={formatos.coluna} accessibilityLabel={t.associar.esquerda}>{esquerda.map((item) => cartao(item, 'esquerda'))}</View>
        <View style={formatos.coluna} accessibilityLabel={t.associar.direita}>{direita.map((item) => cartao(item, 'direita'))}</View>
      </View>
      {pares.length > 0 && !desativado && (
        <Pressable accessibilityRole="button" onPress={() => { mudar(''); setEscolhida(null); }}><Text style={formatos.link}>{t.associar.recomecar}</Text></Pressable>
      )}
    </View>
  );
}

/** Verdadeiro ou falso com justificativa: a afirmação em destaque, os dois valores e o porquê (com `Opcao` da aula). */
export function VerdadeiroFalso({ afirmacao, valor, mudar, desativado, retorno, justificativas }: {
  /** Cor do valor depois da correção (a do porquê vem da aula, em `justificativas`). */
  afirmacao: string;
  valor: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  retorno: 'certa' | 'errada' | null;
  /** As justificativas desenhadas pela aula (o mesmo cartão das opções de escolha). */
  justificativas: (escolha: string, salvar: (justificativa: string) => void) => ReactNode;
}) {
  const [escolha = '', justificativa = ''] = valor.split(':');
  return (
    <View style={formatos.secao}>
      <View style={formatos.afirmacao}><Text style={formatos.afirmacaoTexto}>{afirmacao}</Text></View>
      <Text style={formatos.rotuloCaixa}>{t.verdadeiroFalso.valor.toLocaleUpperCase('pt-BR')}</Text>
      <View style={formatos.valores} accessibilityRole="radiogroup" accessibilityLabel={t.verdadeiroFalso.valor}>
        {(['verdadeiro', 'falso'] as const).map((opcao) => {
          const marcada = escolha === opcao;
          return (
            <Pressable key={opcao} accessibilityRole="radio" accessibilityState={{ checked: marcada, disabled: desativado }} disabled={desativado}
              testID={`vf-${opcao}`} onPress={() => mudar(`${opcao}:${justificativa}`)}
              style={({ pressed }) => [formatos.valor, marcada && formatos.cartaoEscolhido, marcada && retorno === 'certa' && formatos.cartaoCerto,
                marcada && retorno === 'errada' && formatos.cartaoErrado, desativado && !marcada && { opacity: 0.55 }, pressed && formatos.cartaoAfundado]}>
              <Icone nome={opcao === 'verdadeiro' ? 'check' : 'fechar'} tamanho={20} cor={marcada ? cores.acaoEscura : cores.textoSecundario} />
              <Text style={formatos.valorTexto}>{opcao === 'verdadeiro' ? t.verdadeiroFalso.verdadeiro : t.verdadeiroFalso.falso}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={formatos.rotuloCaixa}>{t.verdadeiroFalso.porque.toLocaleUpperCase('pt-BR')}</Text>
      {justificativas(justificativa, (nova) => mudar(`${escolha}:${nova}`))}
    </View>
  );
}

/** Resposta aberta: área de texto com o contador do mínimo. */
export function CampoAberta({ valor, mudar, minimo, desativado, retorno }: {
  valor: string;
  mudar: (valor: string) => void;
  minimo: number;
  desativado: boolean;
  retorno: 'certa' | 'errada' | null;
}) {
  const usados = valor.trim().length;
  return (
    <View style={formatos.secao}>
      <Text style={estilos.rotulo}>{t.aberta.rotulo}</Text>
      <TextInput testID="resposta-aberta" multiline value={valor} onChangeText={mudar} editable={!desativado} maxLength={1000}
        accessibilityLabel={t.aberta.rotulo} accessibilityHint={t.aberta.dica} textAlignVertical="top"
        style={[formatos.aberta, retorno === 'certa' && formatos.cartaoCerto, retorno === 'errada' && formatos.cartaoErrado]} />
      <Text style={estilos.legenda}>{t.aberta.dica}</Text>
      <Text style={[formatos.contador, usados >= minimo && { color: cores.sucesso }]}>{t.aberta.contador(usados, minimo)}</Text>
    </View>
  );
}

/** Depois da resposta aberta: o que a correção procurou, uma boa resposta e o aviso do modo demonstração. */
export function CorrecaoAberta({ avaliacao }: { avaliacao: Avaliacao }) {
  return (
    <View style={formatos.correcao}>
      {avaliacao.criterios && (
        <>
          <Text accessibilityRole="header" style={formatos.rotuloCaixa}>{t.aberta.criterios.toLocaleUpperCase('pt-BR')}</Text>
          {avaliacao.criterios.map((criterio, posicao) => (
            <View key={posicao} style={formatos.criterio} accessible
              accessibilityLabel={`${criterio.atendido ? t.aberta.atendido : t.aberta.faltou}: ${criterio.texto}`}>
              <View style={[formatos.criterioIcone, criterio.atendido && { backgroundColor: cores.sucessoClaro }]}>
                <Icone nome={criterio.atendido ? 'check' : 'fechar'} tamanho={14} cor={cores.fundo} />
              </View>
              <Text style={[estilos.texto, { flex: 1, fontWeight: '700' }]}>{criterio.texto}</Text>
            </View>
          ))}
        </>
      )}
      {avaliacao.modelo && (
        <View style={formatos.modelo}>
          <Text style={formatos.rotuloCaixa}>{t.aberta.modelo.toLocaleUpperCase('pt-BR')}</Text>
          <Text style={estilos.texto}>{avaliacao.modelo}</Text>
        </View>
      )}
      {avaliacao.simulado && <Text style={estilos.legenda}>{t.aberta.simulada}</Text>}
    </View>
  );
}

function formatarTempo(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * Prática no mundo real: a tarefa, a lista para conferir, a dica e o cronômetro; na volta, a pessoa conta como foi e o
 * Stu responde. A lição só conclui depois dessa resposta (o botão de concluir fica no rodapé da aula).
 */
export function EtapaPratica({ pratica, escolha, escolher, consulta }: {
  /** O que a lição mostrou no exemplo (recurso, passos, frases), para consultar enquanto pratica. */
  consulta?: ReactNode;
  pratica: Pratica;
  escolha: AutoAvaliacao | null;
  escolher: (valor: AutoAvaliacao) => void;
}) {
  const total = pratica.minutos * 60;
  const [restante, setRestante] = useState(total);
  const [rodando, setRodando] = useState(false);
  const [feitos, setFeitos] = useState<number[]>([]);
  const acabou = restante === 0;
  const avisado = useRef(false);

  useEffect(() => {
    if (!rodando) return;
    const intervalo = setInterval(() => {
      setRestante((atual) => {
        if (atual > 1) return atual - 1;
        setRodando(false);
        return 0;
      });
    }, 1000);
    return () => clearInterval(intervalo);
  }, [rodando]);

  useEffect(() => {
    if (acabou && !avisado.current) {
      avisado.current = true;
      AccessibilityInfo.announceForAccessibility(t.pratica.acabou);
    }
  }, [acabou]);

  let rotuloPrincipal: string = t.pratica.comecar;
  if (rodando) rotuloPrincipal = t.pratica.pausar;
  else if (restante < total) rotuloPrincipal = t.pratica.retomar;
  const andamento = 1 - restante / total;

  return (
    <View style={formatos.secao}>
      <Text style={estilos.legenda}>{t.pratica.subtitulo}</Text>
      <Text style={formatos.tarefa}>{pratica.tarefa}</Text>
      {pratica.passos && (
        <View style={{ gap: 8 }} accessibilityLabel={t.pratica.passos}>
          {pratica.passos.map((passo, posicao) => {
            const feito = feitos.includes(posicao);
            return (
              <Pressable key={posicao} accessibilityRole="checkbox" accessibilityState={{ checked: feito }}
                onPress={() => setFeitos((atuais) => (feito ? atuais.filter((item) => item !== posicao) : [...atuais, posicao]))}
                style={formatos.conferir}>
                <View style={[formatos.caixinha, feito && formatos.caixinhaMarcada]}>{feito && <Icone nome="check" tamanho={14} cor={cores.fundo} />}</View>
                <Text style={[estilos.texto, { flex: 1, fontWeight: '700' }, feito && { color: cores.textoSecundario, textDecorationLine: 'line-through' }]}>{passo}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {pratica.dica && (
        <View style={formatos.dica}>
          <Icone nome="lampada" tamanho={20} cor="#8A5A00" />
          <Text style={[estilos.texto, { flex: 1 }]}><Text style={{ fontWeight: '800' }}>{t.pratica.dica}: </Text>{pratica.dica}</Text>
        </View>
      )}
      <View style={formatos.cronometro}>
        <View style={formatos.mostrador} accessible accessibilityRole="timer"
          accessibilityLabel={`${t.pratica.cronometro}: ${t.pratica.restante(formatarTempo(restante))}`}>
          <View style={formatos.mostradorTrilho}>
            <View style={[formatos.mostradorCheio, { width: `${Math.round(andamento * 100)}%` }]} />
          </View>
          <Text style={[formatos.tempo, acabou && { color: cores.sucesso }]}>{formatarTempo(restante)}</Text>
        </View>
        <View style={formatos.cronometroAcoes}>
          {!acabou && (
            <View style={{ flex: 1 }}>
              <Botao testID="cronometro" rotulo={rotuloPrincipal} variante={rodando ? 'secundario' : 'primario'} compacto acao={() => setRodando((atual) => !atual)} />
            </View>
          )}
          {restante < total && (
            <View style={{ flex: 1 }}>
              <Botao rotulo={t.pratica.recomecar} variante="texto" compacto acao={() => { setRodando(false); setRestante(total); }} />
            </View>
          )}
        </View>
      </View>
      {/* A consulta (recurso, passos, frases) vem depois do cronômetro: a ação principal fica perto da tarefa. */}
      {consulta}
      {/* "Como foi?" espera o cronômetro começar: a prática pede praticar. */}
      <Text accessibilityRole="header" style={formatos.comoFoi}>
        {acabou ? t.pratica.acabou : restante < total || escolha ? t.pratica.comoFoi : t.pratica.comeceAntes}
      </Text>
      <View style={formatos.opcoesComoFoi} accessibilityRole="radiogroup" accessibilityLabel={t.pratica.comoFoi}>
        {AUTOAVALIACOES.map((valor) => {
          const marcada = escolha === valor;
          const travada = restante === total && !escolha;
          return (
            <Pressable key={valor} testID={`como-foi-${valor}`} accessibilityRole="radio" accessibilityState={{ checked: marcada, disabled: travada }}
              disabled={travada} onPress={() => escolher(valor)}
              style={({ pressed }) => [formatos.valor, { flex: 1 }, travada && { opacity: 0.55 }, marcada && valor === 'consegui' && formatos.cartaoCerto,
                marcada && valor === 'quase' && formatos.cartaoQuase, marcada && valor === 'ainda_nao' && formatos.cartaoEscolhido,
                pressed && formatos.cartaoAfundado]}>
              <Text style={[formatos.valorTexto, { fontSize: 15, textAlign: 'center' }]}>{t.pratica.opcoes[valor]}</Text>
            </Pressable>
          );
        })}
      </View>
      {escolha && (
        <View style={formatos.resposta} accessibilityLiveRegion="polite">
          <Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false} importantForAccessibility="no" style={formatos.stu} />
          <View style={formatos.respostaBalao}><Text style={[estilos.texto, { fontWeight: '700' }]}>{t.pratica.respostas[escolha]}</Text></View>
        </View>
      )}
    </View>
  );
}

const formatos = StyleSheet.create({
  secao: { gap: 10 },
  rotuloLinha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rotuloCaixa: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 16, letterSpacing: 0.8 },
  instrucao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 21 },
  link: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 22, textDecorationLine: 'underline' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 2,
    borderBottomWidth: 4, borderColor: cores.gelo, backgroundColor: cores.fundo },
  chipDestaque: { borderColor: '#B9C6F3' },
  chipGrande: { minHeight: 50, paddingHorizontal: 18 },
  chipAfundado: { borderBottomWidth: 2, marginTop: 2 },
  chipTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 18 },
  ouvir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  escuta: { gap: 12, padding: 14, borderRadius: 16, backgroundColor: cores.ceu },
  fraseGrande: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 19, lineHeight: 26 },
  fala: { gap: 6, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: '#FFE3A3', backgroundColor: cores.fundo },
  falaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 18, lineHeight: 24 },
  lacuna: { textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  codigo: { padding: 14, borderRadius: 14, color: cores.fundo, backgroundColor: cores.texto, fontFamily: 'monospace', fontSize: 15, lineHeight: 22 },
  citacao: { paddingVertical: 14, paddingRight: 14, paddingLeft: 44, borderLeftWidth: 5, borderLeftColor: '#C9A24A', borderRadius: 14,
    backgroundColor: '#FBF6EA' },
  aspas: { position: 'absolute', top: -2, left: 10, color: '#C9A24A', fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontSize: 48, lineHeight: 56 },
  citacaoTexto: { color: '#4D3A12', fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontStyle: 'italic', fontSize: 20, lineHeight: 28 },
  formula: { padding: 16, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: cores.gelo, backgroundColor: cores.fundo },
  formulaTexto: { color: cores.texto, fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontSize: 20, lineHeight: 28, textAlign: 'center' },
  frase: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: cores.ceu },
  fraseTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 19, lineHeight: 27 },
  passo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  passoNumero: { width: 30, height: 30, borderRadius: 15, borderBottomWidth: 3, borderColor: '#9A6A08', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#C88A12' },
  passoNumeroTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 14, lineHeight: 18 },
  passoTexto: { flex: 1, fontWeight: '700' },
  linhaTempo: { paddingLeft: 26, gap: 14 },
  linhaTempoTrilho: { position: 'absolute', left: 8, top: 8, bottom: 8, width: 4, borderRadius: 2, backgroundColor: '#FFE3A3' },
  linhaTempoEvento: { gap: 2 },
  linhaTempoPonto: { position: 'absolute', left: -25, top: 4, width: 18, height: 18, borderRadius: 9, borderWidth: 4, borderColor: '#FFFAF0',
    backgroundColor: '#C88A12' },
  linhaTempoQuando: { color: '#8A5A00', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 17, lineHeight: 22 },
  fracao: { gap: 10, padding: 14, borderRadius: 20, borderWidth: 2, borderColor: '#FFE3A3', backgroundColor: cores.fundo },
  fracaoBarra: { flexDirection: 'row', gap: 6, height: 60, padding: 8, borderRadius: 16, backgroundColor: '#F2DFC3' },
  fracaoParte: { flex: 1, borderWidth: 3, borderColor: '#5C3A1A', borderRadius: 10, backgroundColor: cores.fundo },
  fracaoCheia: { backgroundColor: '#8B5A2B' },
  fracaoLegenda: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 },
  fracaoRotulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 24, lineHeight: 30 },
  imagem: { width: '100%', aspectRatio: 16 / 10, borderRadius: 16, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  acorde: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, borderWidth: 2,
    borderColor: '#FFE3A3', backgroundColor: cores.fundo },
  acordeDesenho: { width: 176, height: 182 },
  comparacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%' },
  lado: { alignItems: 'center', gap: 2 },
  ladoNome: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 17 },
  pestana: { position: 'absolute', top: 36, height: 7, borderRadius: 3.5, backgroundColor: cores.texto },
  acordeBase: { position: 'absolute', left: 0, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13 },
  traste: { position: 'absolute', height: 2.5, backgroundColor: '#C9B48A' },
  cordaVertical: { position: 'absolute', top: 40, height: 120, backgroundColor: '#6B5A3C' },
  marcaCorda: { position: 'absolute', top: 10, width: 16, textAlign: 'center', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 15 },
  dedo: { position: 'absolute', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.acao },
  dedoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 16 },
  acordeLegenda: { flex: 1, minWidth: 150, gap: 8 },
  acordeNome: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 24, lineHeight: 30 },
  ordemCaixa: { gap: 8, minHeight: 64, padding: 10, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: cores.gelo, justifyContent: 'center' },
  disponiveis: { gap: 10 },
  cartao: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo },
  cartaoPar: { paddingHorizontal: 10, gap: 8 },
  cartaoTexto: { flex: 1, fontWeight: '700' },
  cartaoEscolhido: { borderColor: '#9FB1F0', backgroundColor: '#EEF2FF' },
  cartaoCerto: { borderColor: cores.sucessoClaro, borderBottomColor: '#9AD8B5', backgroundColor: '#EEFAF3' },
  cartaoErrado: { borderColor: '#E3A24A', borderBottomColor: '#F2CF96', backgroundColor: '#FFF6EA' },
  cartaoQuase: { borderColor: '#E0A92E', borderBottomColor: '#F2CF96', backgroundColor: '#FFF6D9' },
  cartaoAfundado: { borderBottomWidth: 2, marginTop: 3 },
  posicao: { minWidth: 34, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: cores.acao },
  posicaoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 17 },
  numeroPar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  colunas: { flexDirection: 'row', gap: 8 },
  coluna: { flex: 1, gap: 8 },
  afirmacao: { padding: 14, borderLeftWidth: 5, borderLeftColor: cores.acao, borderRadius: 14, backgroundColor: cores.ceu },
  afirmacaoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 18, lineHeight: 25 },
  valores: { flexDirection: 'row', gap: 10 },
  valor: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 2,
    borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo, paddingHorizontal: 6 },
  valorTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 17, lineHeight: 22 },
  aberta: { minHeight: 140, padding: 14, borderRadius: 14, borderWidth: 2, borderColor: cores.bordaCampo, color: cores.texto,
    backgroundColor: cores.fundo, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 24 },
  contador: { alignSelf: 'flex-end', color: cores.alerta, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18 },
  correcao: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: cores.nevoa },
  criterio: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  criterioIcone: { width: 22, height: 22, borderRadius: 11, marginTop: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3A24A' },
  modelo: { gap: 4, padding: 12, borderLeftWidth: 4, borderLeftColor: cores.sucessoClaro, borderRadius: 12, backgroundColor: cores.fundo },
  tarefa: { padding: 14, borderRadius: 14, backgroundColor: cores.fundo, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800',
    fontSize: 18, lineHeight: 26 },
  conferir: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  caixinha: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#B9A3D8', alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.fundo },
  caixinhaMarcada: { borderColor: '#6B3FA0', backgroundColor: '#6B3FA0' },
  dica: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#FFF6D9' },
  cronometro: { gap: 12, padding: 16, borderRadius: 20, backgroundColor: cores.fundo, alignItems: 'center' },
  mostrador: { alignSelf: 'stretch', alignItems: 'center', gap: 10 },
  mostradorTrilho: { alignSelf: 'stretch', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: '#ECE3F8' },
  mostradorCheio: { height: '100%', borderRadius: 6, backgroundColor: '#6B3FA0' },
  tempo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 48, lineHeight: 56, fontVariant: ['tabular-nums'] },
  cronometroAcoes: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  comoFoi: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 19, lineHeight: 24, marginTop: 4 },
  opcoesComoFoi: { flexDirection: 'row', gap: 8 },
  resposta: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stu: { width: 48, height: 54 },
  respostaBalao: { flex: 1, padding: 12, borderRadius: 18, borderWidth: 2, borderBottomWidth: 4, borderColor: cores.gelo, backgroundColor: cores.fundo },
});
