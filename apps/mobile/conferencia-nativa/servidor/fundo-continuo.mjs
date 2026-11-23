// A continuidade do fundo (o lofi_estudo) sobre as amostras "[som] fundo" do app: as voltas do laço (A/B), as pausas, os
// reinícios e as reduções de volume. Separado de linha-do-tempo-som.mjs para ser testado (tests/fundo-continuo.test.mjs).
const segundos = (ms) => `${(ms / 1000).toFixed(2)} s`;

// --- O lofi_estudo: começo, voltas do laço e o que fugiu do contínuo (pausa, reinício, redução), sobre as amostras dele.
export function analisarFundo(lista, efeitosDoApp = []) {
  const ordem = [...lista].sort((a, b) => a.t - b.t);
  const inicio = ordem.find((amostra) => amostra.tocando);
  if (!inicio) return null;
  const ocorrencias = [];
  const voltas = [];
  const ultima = { A: null, B: null };
  // A última amostra em que cada reprodutor ainda tocava. Na volta do laço, o que sai pausa e volta ao começo (seek) antes
  // de o outro entrar: a última amostra dele já mostra a posição reposicionada (26 ms na execução 44809026116) e não diz
  // que ele chegou ao fim da faixa. O fim se lê na última amostra tocando, antes da pausa.
  const ultimaTocando = { A: null, B: null };
  const noFim = (amostra) => Boolean(amostra && amostra.dur > 0 && amostra.pos >= amostra.dur - 3000);
  let ativo = inicio.jogador;
  const subidaAte = inicio.t + 1200;
  const naTroca = (t) => voltas.some((volta) => t >= volta.t - 500 && t <= volta.t + 1500);
  const segmentos = [];
  let segmento = [];
  for (const amostra of ordem.filter((item) => item.t >= inicio.t)) {
    const anterior = ultima[amostra.jogador];
    // A cauda da volta do laço: o reprodutor que acabou de sair ainda manda uma amostra "tocando" no fim da faixa, com o
    // volume descendo, depois de o outro entrar (execução 45053145066: B em 89,00 s com volume 0,096, 94 ms depois de A
    // entrar em 0,026 s). Não é ele entrando de novo: sem isto, a amostra virava um "reinício" com o que entrou em 0,03 s.
    if (amostra.jogador !== ativo && amostra.tocando && noFim(amostra) && voltas.at(-1)?.de === amostra.jogador && naTroca(amostra.t)) {
      ultima[amostra.jogador] = amostra;
      ultimaTocando[amostra.jogador] = amostra;
      continue;
    }
    if (amostra.jogador !== ativo && amostra.tocando) {
      const saindo = ultimaTocando[ativo] ?? ultima[ativo];
      // O outro reprodutor entrou: volta do laço se o que saía estava no fim da faixa; senão, a música recomeçou.
      if (noFim(saindo)) {
        voltas.push({ t: amostra.t, de: ativo, para: amostra.jogador });
      } else {
        ocorrencias.push({ t: amostra.t, tipo: 'reinício', texto: `o reprodutor ${amostra.jogador} entrou em ${segundos(amostra.pos)} com o ${ativo} longe do fim da faixa (${saindo ? segundos(saindo.pos) : '?'})` });
      }
      ativo = amostra.jogador;
      if (segmento.length) segmentos.push(segmento);
      segmento = [];
    } else if (amostra.jogador === ativo && !amostra.tocando) {
      // Parar no fim da faixa é a volta do laço começando (o outro entra logo depois), não pausa.
      if (!naTroca(amostra.t) && !noFim(ultimaTocando[ativo])) ocorrencias.push({ t: amostra.t, tipo: 'pausa', texto: `o reprodutor ${ativo} parou em ${segundos(amostra.pos)}` });
      if (segmento.length) segmentos.push(segmento);
      segmento = [];
    } else if (amostra.jogador === ativo && anterior?.tocando && amostra.pos < anterior.pos - 1000 && !(anterior.dur > 0 && anterior.pos >= anterior.dur - 3000)) {
      ocorrencias.push({ t: amostra.t, tipo: 'reinício', texto: `a posição voltou de ${segundos(anterior.pos)} para ${segundos(amostra.pos)}` });
      if (segmento.length) segmentos.push(segmento);
      segmento = [amostra];
    } else if (amostra.jogador === ativo) {
      segmento.push(amostra);
    }
    ultima[amostra.jogador] = amostra;
    if (amostra.tocando) ultimaTocando[amostra.jogador] = amostra;
  }
  if (segmento.length) segmentos.push(segmento);
  // Pausa sem "parado": a posição para enquanto o relógio anda. O registro chega pelo JavaScript, que pode atrasar uma
  // amostra (o relógio dela adianta), mas nunca a deixa à frente da posição: vale o piso de t - posição nas próximas seis.
  // Um degrau que cresce em amostras seguidas é uma pausa só; se o piso volta ao de antes, era atraso do registro.
  for (const trecho of segmentos) {
    const pisos = [];
    for (let i = 0; i + 3 <= trecho.length; i += 1) pisos.push(Math.min(...trecho.slice(i, i + 6).map((amostra) => amostra.t - amostra.pos)));
    let base = pisos[0];
    let aberta = null;
    pisos.forEach((piso, i) => {
      if (piso - base > 400) {
        aberta ??= { t: trecho[i].t, ms: 0, estavel: 0 };
        aberta.estavel = piso - base <= aberta.ms + 50 ? aberta.estavel + 1 : 0;
        aberta.ms = Math.max(aberta.ms, piso - base);
        if (aberta.estavel >= 2) {
          ocorrencias.push({ t: aberta.t, tipo: 'pausa', texto: `a posição do reprodutor ${trecho[i].jogador} parou ${aberta.ms} ms enquanto o relógio andava` });
          base = piso;
          aberta = null;
        }
      } else {
        aberta = null;
        base = Math.min(base, piso);
      }
    });
    if (aberta) ocorrencias.push({ t: aberta.t, tipo: 'pausa', texto: `a posição do reprodutor ${trecho[0].jogador} parou ${aberta.ms} ms enquanto o relógio andava (no fim das amostras)` });
  }
  // Volume: o de referência é o maior do reprodutor que toca depois da subida; abaixo dele (fora da subida e das voltas do
  // laço), é redução, no efeito se começou até 1 s depois do comando de um efeito.
  const tocandoAtivo = segmentos.flat().filter((amostra) => amostra.t > subidaAte && !naTroca(amostra.t));
  const referencia = tocandoAtivo.length ? Math.max(...tocandoAtivo.map((amostra) => amostra.vol)) : null;
  let reducao = null;
  const fecharReducao = () => {
    if (!reducao) return;
    const efeito = efeitosDoApp.find((evento) => reducao.t >= evento.t - 200 && reducao.t <= evento.t + 1000);
    const duracao = reducao.n > 1 ? `${reducao.n} amostras, ${segundos(reducao.ate - reducao.t)}` : '1 amostra';
    ocorrencias.push({ t: reducao.t, tipo: efeito ? 'redução no efeito' : 'redução fora de efeito',
      texto: `o volume do reprodutor foi a ${reducao.minimo.toFixed(3)} (referência ${referencia.toFixed(3)}; ${duracao})${efeito ? `, perto do comando de ${efeito.som}` : ''}` });
    reducao = null;
  };
  for (const amostra of tocandoAtivo) {
    if (referencia !== null && amostra.vol < referencia - 0.01) {
      reducao ??= { t: amostra.t, ate: amostra.t, minimo: amostra.vol, n: 0 };
      reducao.n += 1;
      reducao.ate = amostra.t;
      reducao.minimo = Math.min(reducao.minimo, amostra.vol);
    } else {
      fecharReducao();
    }
  }
  fecharReducao();
  ocorrencias.sort((a, b) => a.t - b.t);
  return { inicio, fim: ordem[ordem.length - 1], ocorrencias, voltas, referencia, ordem, subidaAte, naTroca };
}
