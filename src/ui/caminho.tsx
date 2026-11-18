'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { MotivoRever } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Stu } from './componentes';
import { Confete } from './festa';
import { Desenho, Fronteira, coresDaRegiao } from './mundo';
import { desenhosQueBalancam, enfeitesDaLinha, regiaoDoTrecho, type NomeDesenho } from './mundo-desenhos';
import './caminho.css';

export type EstadoNo = 'concluida' | 'atual' | 'bloqueada' | 'previa';
/** Lição no caminho; `trecho` é a posição do fluxo e só serve para desenhar o marco e a região do mundo. */
/**
 * `andamento`: a lição atual foi começada e tem o andamento guardado (o balão diz Continuar, não Começar).
 * `rever`: por que vale rever a lição concluída (`motivoParaRever`); o mapa marca "Vale rever" e o balão diz o motivo.
 */
/** `resumo`: na prévia, o que a lição ensina (o balão do toque mostra). */
export type NoCaminho = { id: string; titulo: string; estado: EstadoNo; trecho: number; ponte?: { concluida: boolean }; andamento?: boolean; rever?: MotivoRever; resumo?: string };

/** O título sem quebra no meio de uma palavra com hífen (“check-" numa linha e “in” na outra). */
function semQuebrarHifen(texto: string): ReactNode {
  const partes = texto.split(/(\S*\p{L}-\p{L}\S*)/u);
  return partes.length === 1 ? texto : partes.map((parte, indice) => (indice % 2 ? <span key={indice} className="sem-quebra">{parte}</span> : parte));
}

/** Os selos embaixo do nó: reforço pendente; se concluído, a marca da ponte feita vem primeiro e "Vale rever" segue junto quando houver. */
function selosDoNo(no: NoCaminho): { icone: NomeIcone; texto: string }[] {
  if (no.ponte && !no.ponte.concluida) return [{ icone: 'revisao', texto: mensagens.estudio.ponteMapa }];
  const selos: { icone: NomeIcone; texto: string }[] = [];
  if (no.ponte) selos.push({ icone: 'check', texto: mensagens.estudio.ponteMapaFeita });
  if (no.rever && no.estado === 'concluida') selos.push({ icone: 'revisao', texto: mensagens.trilha.valeRever });
  return selos;
}

export type NomeIcone = 'check' | 'livro' | 'revisao' | 'cadeado' | 'bandeira' | 'trofeu' | 'fechar' | 'olho' | 'olhoFechado' | 'seta'
  | 'lampada' | 'relogio' | 'alvo' | 'som' | 'pessoa' | 'compartilhar' | 'copiar' | 'camera' | 'imagem' | 'lapis' | 'lixeira' | 'bussola' | 'valeu' | 'mais' | 'bandeirinha';

const desenhos: Record<NomeIcone, ReactNode> = {
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  livro: <path d="M12 6.5C10.3 5.3 8 4.8 4.5 5v12.5c3.5-.2 5.8.3 7.5 1.5 1.7-1.2 4-1.7 7.5-1.5V5c-3.5-.2-5.8.3-7.5 1.5zM12 6.5V19" />,
  // Repetir: arco de três quartos com uma seta, o mesmo desenho do app.
  revisao: <path d="M6.7 6.7A7.5 7.5 0 1 1 6.7 17.3M10.6 15.5H5.8v4.7" />,
  cadeado: <><rect x="5.5" y="10.5" width="13" height="9" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  // Bandeira cheia (pano preenchido), legível mesmo pequena; a mesma do app.
  bandeira: <><path d="M6 20V4.5" /><path d="M6 5h10.5l-2 3.5 2 3.5H6z" fill="currentColor" /></>,
  trofeu: <path d="M8 4.5h8V10a4 4 0 0 1-8 0V4.5zM8 6.5H5.5a2.5 2.5 0 0 0 2.5 3.5M16 6.5h2.5a2.5 2.5 0 0 1-2.5 3.5M12 14v3.5M8.5 20h7" />,
  fechar: <path d="M7 7l10 10M17 7L7 17" />,
  olho: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  olhoFechado: <path d="M4 4l16 16M9.9 5.8A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3 3.7M6.4 7.4A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  seta: <path d="M5 12h14M13 6l6 6-6 6" />,
  lampada: <path d="M9.5 18h5M10.5 21h3M12 3.5a5.5 5.5 0 0 0-3.2 10c.7.5 1.2 1.3 1.2 2.2v.3h4v-.3c0-.9.5-1.7 1.2-2.2A5.5 5.5 0 0 0 12 3.5z" />,
  relogio: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  alvo: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" /></>,
  // Alto-falante com duas ondas: ouvir uma frase, um áudio ou um acorde.
  som: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18.3 6.3a8 8 0 0 1 0 11.4" /></>,
  pessoa: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.8 20c.9-3.8 3.7-5.8 7.2-5.8s6.3 2 7.2 5.8" /></>,
  // Três pontos ligados: compartilhar.
  compartilhar: <><circle cx="17.5" cy="5.5" r="2.5" /><circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="18.5" r="2.5" /><path d="M8.7 10.8l6.6-4M8.7 13.2l6.6 4" /></>,
  copiar: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></>,
  camera: <><path d="M4 8.5A2 2 0 0 1 6 6.5h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></>,
  imagem: <><rect x="4" y="4.5" width="16" height="15" rx="3" /><circle cx="9" cy="9.5" r="1.6" /><path d="M4.5 17l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5" /></>,
  lapis: <path d="M14.5 5.5l4 4M5 19l1-4.5L15.5 5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L9.5 18z" />,
  lixeira: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v5M13.5 10.5v5" />,
  bussola: <><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  // Valeu: coração com a curva de um sorriso (agradecer, não "curtir" uma pessoa).
  valeu: <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z" />,
  mais: <><circle cx="6" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18" cy="12" r="1.3" fill="currentColor" /></>,
  bandeirinha: <><path d="M6 20.5V4" /><path d="M6 4.5h11l-2.5 4 2.5 4H6" /></>,
};

export function Icone({ nome }: { nome: NomeIcone }) {
  return (
    <svg className="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {desenhos[nome]}
    </svg>
  );
}

/**
 * Ícone do nó: concluída mostra o visto; as outras mostram o tipo da lição (a bloqueada ganha o cadeado como selo).
 * O contrato ainda não tem o tipo da lição, então a revisão é reconhecida pelo título ("Revisão…").
 */
function iconeDoNo(no: NoCaminho): NomeIcone {
  if (no.estado === 'concluida') return 'check';
  return no.titulo.trim().toLocaleLowerCase('pt-BR').startsWith('revis') ? 'revisao' : 'livro';
}

/**
 * Posição horizontal do nó, em % da coluna do caminho: uma serpentina suave (como as trilhas dos apps de idiomas),
 * deslocada meio passo para nenhum nó ficar exatamente no centro (o rótulo ao lado sempre tem espaço).
 */
export function posicaoX(indice: number) {
  return Math.round((50 + 23 * Math.sin(((indice + 0.5) * Math.PI) / 4)) * 10) / 10;
}

/** Curva da ligação: do centro de um nó ao centro do próximo (ou da chegada, no meio). */
function tracado(de: number, ate: number) {
  return `M${de} 0C${de} 55 ${ate} 45 ${ate} 100`;
}

/** Lições de cada trecho e quantas já foram concluídas, para as faixas de "Parte". */
function resumoDosTrechos(nos: readonly NoCaminho[]) {
  const resumo = new Map<number, { total: number; feitas: number; previa: boolean }>();
  for (const no of nos) {
    const atual = resumo.get(no.trecho) ?? { total: 0, feitas: 0, previa: false };
    atual.total += 1;
    if (no.estado === 'concluida') atual.feitas += 1;
    if (no.estado === 'previa') atual.previa = true;
    resumo.set(no.trecho, atual);
  }
  return resumo;
}

/** Faixa que abre cada parte da trilha: número, andamento e, quando vencida, o dourado. Sem nome de assunto. */
function FaixaParte({ numero, resumo, trecho }: { numero: number; trecho: number; resumo?: { total: number; feitas: number; previa: boolean } }) {
  if (!resumo) return null;
  const vencida = !resumo.previa && resumo.feitas === resumo.total;
  const texto = resumo.previa
    ? mensagens.trilha.parteLicoes(resumo.total)
    : vencida ? mensagens.trilha.parteVencida : mensagens.trilha.parteProgresso(resumo.feitas, resumo.total);
  return (
    <span className="caminho-parte" data-vencida={vencida || undefined} aria-hidden="true" style={coresDaRegiao(trecho)}>
      <span className="caminho-parte__selo"><Icone nome={vencida ? 'trofeu' : 'bandeira'} /></span>
      <span className="caminho-parte__texto">
        <span className="caminho-parte__numero">{mensagens.trilha.parte(numero)}</span>
        <span className="caminho-parte__andamento">{texto}</span>
      </span>
    </span>
  );
}

/** O que falta para liberar um nó: as lições pendentes antes dele, a começar pela atual. */
function explicar(nos: readonly NoCaminho[], indice: number) {
  // Na prévia, a lição ainda não existe: o balão diz como abri-la (antes, o toque não fazia nada).
  if (nos[indice].estado === 'previa') {
    const { resumo } = nos[indice];
    return resumo ? mensagens.licao.audio.previaResumo(resumo) : mensagens.licao.audio.previaAbre;
  }
  if (nos[indice].estado === 'concluida') {
    const motivo = nos[indice].rever;
    if (motivo) return mensagens.trilha.concluidaRever(motivo);
    return nos[indice].ponte ? mensagens.trilha.concluidaComReforco : mensagens.trilha.concluidaTexto;
  }
  const pendentes = nos.slice(0, indice).filter((anterior) => anterior.estado !== 'concluida');
  const comeco = pendentes.find((anterior) => anterior.estado === 'atual') ?? pendentes[0];
  if (!comeco) return mensagens.trilha.bloqueadaSemPasso;
  return pendentes.length === 1
    ? mensagens.trilha.bloqueadaUma(comeco.titulo)
    : mensagens.trilha.bloqueadaVarias(pendentes.length, comeco.titulo);
}

function classeDoEnfeite(nome: NomeDesenho, base: string) {
  return desenhosQueBalancam.has(nome) ? `${base} caminho-enfeite--balanca` : base;
}

/** Um trecho está vencido quando todas as suas lições estão concluídas: o marco que o fecha fica dourado. */
function trechoVencido(nos: readonly NoCaminho[], trecho: number) {
  return nos.every((no) => no.trecho !== trecho || no.estado === 'concluida');
}

/**
 * Caminho único e contínuo de lições, na ordem de aprendizado, com nós que alternam de lado, sobre um mundo ilustrado:
 * cada trecho da trilha é uma região (campos, floresta, montanhas…), com enfeites nas bordas e uma fronteira ondulada.
 * Não agrupa por assunto: entre um trecho e outro aparece só o marco, sem nome, sobre a fronteira.
 * O leitor de tela ouve o marco como "Marco 1", "Marco 2"…, logo depois do último nó do trecho; o cenário fica de fora.
 * O nó atual abre a lição; concluído ou bloqueado abre um balão que explica o estado.
 * O Stu acompanha a pessoa: fica ao lado do nó atual (e, com tudo concluído, ao lado do troféu); a frase `stu` vai numa
 * placa no alto do mapa. Sem nó atual (a prévia da geração), o Stu abre o mapa com a frase num balão e, enquanto a IA
 * monta a trilha, as `dicas` se revezam embaixo dela.
 * Com `chegada`, o caminho termina no topo, com o troféu, que fica dourado quando todas as lições estão concluídas.
 * Com `montando`, a trilha ainda está sendo gerada: cada nó novo cai no lugar e o cenário brota junto, a posição não tem
 * total e um nó em esqueleto marca onde a próxima lição vai aparecer. A tela acompanha esse nó enquanto a pessoa está
 * olhando o fim do caminho. Quando a montagem termina, o troféu entra com confete.
 * Ao abrir, os nós entram em sequência. Com `recemConcluida`, o nó da lição que a pessoa acabou de concluir comemora,
 * a linha até o próximo se desenha e só então o próximo nó se abre.
 */
export function Caminho({ nos, stu, dicas = [], chegada = true, montando = false, ocupado = false, abrindo = null, liberadas = [],
  rolarPara = null, recemConcluida = null, aoAbrir }: {
  nos: readonly NoCaminho[];
  stu?: string;
  dicas?: readonly string[];
  recemConcluida?: string | null;
  chegada?: boolean;
  montando?: boolean;
  ocupado?: boolean;
  abrindo?: string | null;
  liberadas?: readonly string[];
  rolarPara?: string | null;
  aoAbrir?: (no: NoCaminho) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState('');
  // A entrada em sequência só acontece numa trilha que já abre pronta, não quando a geração termina.
  const [entrada] = useState(() => !montando);
  const [dica, setDica] = useState(0);
  const [festaNaChegada, setFestaNaChegada] = useState(false);
  const [trofeuTocado, setTrofeuTocado] = useState(0);
  const botoes = useRef(new Map<string, HTMLButtonElement>());
  const balao = useRef<HTMLDivElement>(null);
  const vindo = useRef<HTMLLIElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const estavaMontando = useRef(montando);
  const base = useId();
  const primeiraLiberada = liberadas[0] ?? null;
  const total = nos.length;
  const comChegada = chegada && total > 0;
  const trechos = Array.from(new Set(nos.map((no) => no.trecho)));
  const tudoFeito = total > 0 && nos.every((no) => no.estado === 'concluida');
  const primeiroTrecho = nos[0]?.trecho ?? 0;
  const ultimoTrecho = nos[total - 1]?.trecho ?? 0;
  const guiaNoCaminho = !montando && nos.some((no) => no.estado === 'atual');
  const stuNaChegada = !montando && tudoFeito;
  const comRecem = recemConcluida !== null && nos.some((no) => no.id === recemConcluida);
  const resumoTrechos = resumoDosTrechos(nos);

  // Enquanto a IA monta a trilha, uma dica nova a cada poucos segundos.
  useEffect(() => {
    if (!montando || dicas.length < 2) return;
    const intervalo = window.setInterval(() => setDica((atual) => (atual + 1) % dicas.length), 3600);
    return () => window.clearInterval(intervalo);
  }, [montando, dicas.length]);

  useEffect(() => {
    if (!primeiraLiberada) return;
    const titulo = nos.find((no) => no.id === primeiraLiberada)?.titulo;
    if (!titulo) return;
    const espera = window.setTimeout(() => setAnuncio(mensagens.trilha.liberada(titulo)), 900);
    return () => window.clearTimeout(espera);
  }, [primeiraLiberada, nos]);

  useEffect(() => {
    if (!rolarPara) return;
    const quadro = window.requestAnimationFrame(() => {
      const item = botoes.current.get(rolarPara)?.closest('li');
      if (!item) return;
      const caixa = item.getBoundingClientRect();
      // Considera o cartão fixo da próxima lição e a navegação de baixo, que cobrem o pé da tela.
      // Rola só o necessário: o nó para logo acima do cartão fixo, e o topo da trilha tende a continuar à vista.
      if (caixa.top < 0 || caixa.bottom > window.innerHeight - 240) item.scrollIntoView({ block: 'end' });
      // Se a rolagem parou no meio do céu (a placa cortada no alto), segue até a faixa da Parte 1 ficar no topo,
      // desde que o nó continue bem à vista.
      const inicio = item.closest('.caminho')?.querySelector('.caminho-inicio');
      const faixa = inicio?.querySelector('.caminho-parte');
      const botao = botoes.current.get(rolarPara);
      if (!inicio || !faixa || !botao) return;
      const ceu = inicio.getBoundingClientRect();
      // Desconta a barra do plano presa no topo (celular), se houver.
      const barra = document.querySelector('.trilha-topo');
      const coberto = barra && getComputedStyle(barra).position === 'sticky' ? barra.getBoundingClientRect().height : 0;
      const resto = faixa.getBoundingClientRect().top - 12 - coberto;
      if (ceu.top < 0 && resto > 0 && botao.getBoundingClientRect().top - resto > 72) window.scrollBy(0, resto);
    });
    return () => window.cancelAnimationFrame(quadro);
  }, [rolarPara]);

  useEffect(() => {
    if (ocupado) setAberto(null);
  }, [ocupado]);

  // Com o nó atual (e o balão "Começar") à vista, o cartão fixo da próxima lição sai de cena: uma ação só por vez.
  const idAtual = nos.find((no) => no.estado === 'atual')?.id ?? null;
  useEffect(() => {
    const raiz = document.documentElement;
    const lente = idAtual ? botoes.current.get(idAtual) : undefined;
    if (!lente || typeof IntersectionObserver === 'undefined') return;
    // Basta o balão ou a lente aparecer acima do pé da tela (onde o cartão flutua) para o cartão sair: com a lente só
    // metade à vista, o cartão cobria o nó e o balão "Começar".
    const alvos = [lente, lente.querySelector<HTMLElement>('.caminho-no__etiqueta')].filter((alvo): alvo is HTMLElement => alvo !== null);
    const vistos = new Set<Element>();
    const observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        if (entrada.isIntersecting) vistos.add(entrada.target);
        else vistos.delete(entrada.target);
      }
      raiz.toggleAttribute('data-atual-visivel', vistos.size > 0);
    }, { rootMargin: '-40px 0px -170px 0px', threshold: 0 });
    alvos.forEach((alvo) => observador.observe(alvo));
    return () => {
      observador.disconnect();
      raiz.removeAttribute('data-atual-visivel');
    };
  }, [idAtual]);

  // Enquanto a trilha é montada, o nó em esqueleto fica à vista se a pessoa estava vendo o último nó que chegou.
  useEffect(() => {
    const item = vindo.current;
    const anterior = item?.previousElementSibling;
    if (!montando || !item || !anterior) return;
    const limite = window.innerHeight - (Number.parseFloat(getComputedStyle(item).scrollMarginBottom) || 0);
    const caixaAnterior = anterior.getBoundingClientRect();
    if (caixaAnterior.top > limite || caixaAnterior.bottom < 0) return;
    if (item.getBoundingClientRect().bottom <= limite) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    item.scrollIntoView({ block: 'nearest', behavior: reduzido ? 'auto' : 'smooth' });
  }, [montando, total]);

  // Quando a montagem termina, a chegada entra no lugar do esqueleto e fica à vista pela mesma regra: só se a pessoa
  // estava vendo o fim do caminho.
  useEffect(() => {
    const acabouDeMontar = estavaMontando.current && !montando;
    estavaMontando.current = montando;
    if (acabouDeMontar) setFestaNaChegada(true);
    const item = fim.current;
    const ultimo = item?.previousElementSibling?.lastElementChild;
    if (!acabouDeMontar || !item || !ultimo) return;
    const limite = window.innerHeight - (Number.parseFloat(getComputedStyle(item).scrollMarginBottom) || 0);
    const caixaUltimo = ultimo.getBoundingClientRect();
    if (caixaUltimo.top > limite || caixaUltimo.bottom < 0) return;
    if (item.getBoundingClientRect().bottom <= limite) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    item.scrollIntoView({ block: 'nearest', behavior: reduzido ? 'auto' : 'smooth' });
  }, [montando]);

  useEffect(() => {
    if (!aberto) return;
    const id = aberto;
    balao.current?.focus({ preventScroll: true });
    balao.current?.scrollIntoView({ block: 'nearest' });

    function aoTocarFora(evento: PointerEvent) {
      const item = botoes.current.get(id)?.closest('li');
      if (item && evento.target instanceof Node && !item.contains(evento.target)) setAberto(null);
    }

    document.addEventListener('pointerdown', aoTocarFora);
    return () => document.removeEventListener('pointerdown', aoTocarFora);
  }, [aberto]);

  function tocar(no: NoCaminho) {
    if (no.estado === 'atual') {
      setAberto(null);
      aoAbrir?.(no);
      return;
    }
    setAberto((atual) => atual === no.id ? null : no.id);
  }

  /** Do balão de um nó bloqueado até a lição atual: fecha o balão, centraliza o nó atual e põe o foco nele. */
  function irParaAtual() {
    const atual = nos.find((item) => item.estado === 'atual');
    setAberto(null);
    if (!atual) return;
    const botao = botoes.current.get(atual.id);
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    botao?.closest('li')?.scrollIntoView({ block: 'center', behavior: reduzido ? 'auto' : 'smooth' });
    botao?.focus({ preventScroll: true });
  }

  function fechar() {
    const id = aberto;
    setAberto(null);
    if (id) botoes.current.get(id)?.focus();
  }

  function guardarBotao(id: string, elemento: HTMLButtonElement | null) {
    if (elemento) botoes.current.set(id, elemento);
    else botoes.current.delete(id);
  }

  return (
    <div className="caminho" data-montando={montando || undefined} data-comeco-atual={nos[0]?.estado === 'atual' || undefined} data-entrada={(entrada && !comRecem) || undefined}
      data-recem={comRecem || undefined}>
      <div className="caminho-inicio" style={coresDaRegiao(primeiroTrecho)} data-regiao={regiaoDoTrecho(primeiroTrecho).id}>
        <span className="caminho-inicio__ceu" aria-hidden="true">
          <Desenho nome="nuvem" className="caminho-inicio__nuvem caminho-inicio__nuvem--1" />
          <Desenho nome="nuvem" className="caminho-inicio__nuvem caminho-inicio__nuvem--2" />
          <Desenho nome="sol" className="caminho-inicio__sol" />
        </span>
        <svg className="caminho-inicio__colinas" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d="M0 30C50 6 96 4 148 22S236 52 292 30 368 8 400 18V64H0Z" fill="var(--relevo)" />
          <path d="M0 44C44 28 90 26 140 38S228 60 286 44 364 26 400 34V64H0Z" fill="var(--chao)" />
        </svg>
        {stu && (guiaNoCaminho || stuNaChegada) && (
          <div className="caminho-inicio__conteudo caminho-inicio__conteudo--placa">
            <p className="caminho-placa">{stu}</p>
          </div>
        )}
        {stu && !guiaNoCaminho && !stuNaChegada && (
          <div className="caminho-inicio__conteudo">
            <p className="caminho-inicio__fala">
              <span>{stu}{montando && <span className="caminho-digitando" aria-hidden="true"><span /><span /><span /></span>}</span>
              {montando && dicas.length > 0 && <span className="caminho-inicio__dica" key={dica}>{dicas[dica]}</span>}
            </p>
            <Stu />
          </div>
        )}
        {total > 0 && <FaixaParte numero={1} trecho={primeiroTrecho} resumo={resumoTrechos.get(primeiroTrecho)} />}
      </div>
      <ol className="caminho-nos" role="list" aria-label={mensagens.trilha.licoes}>
        {nos.map((no, indice) => {
          const seguinte = nos[indice + 1];
          const fimDoTrecho = seguinte !== undefined && seguinte.trecho !== no.trecho;
          const vaiAteChegada = seguinte === undefined && comChegada;
          const vaiAteVindo = seguinte === undefined && montando;
          const ligado = seguinte !== undefined || vaiAteChegada || vaiAteVindo;
          const x = posicaoX(indice);
          const xSeguinte = seguinte !== undefined || vaiAteVindo ? posicaoX(indice + 1) : 50;
          // Lado para onde o nó pende: o rótulo e o cenário vão para o lado livre, o Stu fica do lado do nó.
          const lado = x >= 50 ? 'direita' : 'esquerda';
          // Só a prévia mostra o título ao lado; as outras mostram um título curto embaixo (o atual, em destaque).
          // Prévia e trilha mostram o título do mesmo jeito: curto, embaixo do nó.
          const comRotulo = false;
          const atual = no.estado === 'atual';
          const estaAberto = aberto === no.id;
          const liberada = liberadas.includes(no.id);
          const idBalao = `${base}-balao-${indice}`;
          const posicao = montando ? mensagens.trilha.posicaoParcial(indice + 1) : mensagens.trilha.posicao(indice + 1, total);
          const estado = mensagens.trilha.estados[no.estado];
          const selos = selosDoNo(no);
          const selosTexto = selos.map((selo) => selo.texto).join('. ');
          const nomeBase = atual
            ? (no.andamento ? mensagens.trilha.nomeNoContinuar(no.titulo, posicao) : mensagens.trilha.nomeNoAtual(no.titulo, posicao))
            : (selos.length > 0
              ? `${no.titulo}. ${selosTexto}. ${posicao}, ${estado.toLocaleLowerCase('pt-BR')}.`
              : mensagens.trilha.nomeNo(no.titulo, posicao, estado.toLocaleLowerCase('pt-BR')));
          const nome = atual && selos.length > 0 ? `${nomeBase} ${selosTexto}.` : nomeBase;
          let linha = no.estado === 'previa' ? posicao : estado;
          if (abrindo === no.id) linha = mensagens.trilha.abrindo;
          const enfeites = enfeitesDaLinha(no.trecho, indice);
          const lateral = enfeitesDaLinha(no.trecho, indice + 2);
          const marcoVencido = fimDoTrecho && trechoVencido(nos, no.trecho);
          const numeroMarco = trechos.indexOf(no.trecho) + 1;
          const recem = no.id === recemConcluida;
          const desenhar = recem && no.estado === 'concluida' && ligado;

          const conteudo = (
            <>
              <span className="caminho-no__lente" aria-hidden="true">
                <Icone nome={iconeDoNo(no)} />
                {liberada && <span className="caminho-no__cadeado"><Icone nome="cadeado" /></span>}
                {recem && <Confete quantidade={12} />}
                {/* Um balão só no nó atual: a ação e o nome da lição juntos (\u200B evita colar palavras no axe). */}
                {atual && <span className="caminho-no__etiqueta"><span className="caminho-no__etiqueta-acao">{no.andamento ? mensagens.trilha.continuarNo : mensagens.trilha.comecar}{'\u200B'}</span><span className="caminho-no__etiqueta-titulo">{semQuebrarHifen(no.titulo)}</span></span>}
                {no.estado === 'bloqueada' && <span className="caminho-no__selo"><Icone nome="cadeado" /></span>}
              </span>
              {/* O nome de cada lição fica à vista embaixo do nó (o atual já mostra o nome no balão "Começar"): dá para achar uma lição para rever sem tocar uma por uma. */}
              {(!atual || no.estado === 'previa') && <span className="caminho-no__texto" aria-hidden="true">
                <span className="caminho-no__titulo">{semQuebrarHifen(no.titulo)}{selos.length > 0 ? '\u200B' : ''}</span>
                {comRotulo && !atual && <span className="caminho-no__estado">{linha}</span>}
                {/* O reforço e o "vale rever" são selos com ícone (a marca da ponte feita vem antes do "Vale rever"). */}
                {selos.map((selo, sIdx) => (
                  <span key={selo.texto} className="caminho-ponte" data-rever={selo.texto === mensagens.trilha.valeRever || undefined}><Icone nome={selo.icone} />{selo.texto}{sIdx < selos.length - 1 ? '\u200B' : ''}</span>
                ))}
              </span>}
            </>
          );

          return (
            <li key={no.id} className="caminho-no" data-estado={no.estado} data-lado={lado} data-revisao={iconeDoNo(no) === 'revisao' || undefined}
              style={{ ...coresDaRegiao(no.trecho), '--ordem': indice, '--x': x } as CSSProperties}
              data-ligado={ligado || undefined} data-fim-trecho={fimDoTrecho || undefined} data-rotulo={comRotulo || undefined} data-discreto={!comRotulo || undefined} data-liberada={liberada || undefined}
              data-aberto={estaAberto || undefined} data-recem={recem || undefined}
              onKeyDown={(evento) => {
                if (evento.key !== 'Escape' || !estaAberto) return;
                evento.stopPropagation();
                fechar();
              }}
              onBlur={(evento) => {
                const destino = evento.relatedTarget;
                if (estaAberto && destino instanceof Node && !evento.currentTarget.contains(destino)) setAberto(null);
              }}>
              <span className="caminho-terreno" aria-hidden="true">
                {atual && guiaNoCaminho
                  ? <span className="caminho-guia"><Stu /></span>
                  : !comRotulo && <Desenho nome={enfeites.grande} className={classeDoEnfeite(enfeites.grande, 'caminho-enfeite caminho-enfeite--grande')} />}
                <Desenho nome={enfeites.miudo} className={classeDoEnfeite(enfeites.miudo, 'caminho-enfeite caminho-enfeite--miudo')} />
                <Desenho nome={lateral.grande} className={classeDoEnfeite(lateral.grande, 'caminho-enfeite caminho-enfeite--lateral')} />
                <Desenho nome={lateral.miudo} className={classeDoEnfeite(lateral.miudo, 'caminho-enfeite caminho-enfeite--lateral-miudo')} />
              </span>
              {fimDoTrecho && <Fronteira trechoSeguinte={seguinte.trecho} />}
              {ligado && (
                <span className="caminho-ligacao" data-feita={(no.estado === 'concluida' && !desenhar) || undefined} aria-hidden="true">
                  <svg className="caminho-conector" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
                    <path className="caminho-conector__estrada" d={tracado(x, xSeguinte)} />
                    <path className="caminho-conector__linha" d={tracado(x, xSeguinte)} />
                  </svg>
                  {desenhar && (
                    <span className="caminho-ligacao__desenho">
                      <svg className="caminho-conector" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
                        <path className="caminho-conector__linha caminho-conector__linha--feita" d={tracado(x, xSeguinte)} />
                      </svg>
                    </span>
                  )}
                </span>
              )}
              {no.estado === 'previa' ? (
                <button type="button" className="caminho-no__alvo" aria-label={nome} aria-haspopup="dialog" aria-expanded={estaAberto}
                  aria-controls={estaAberto ? idBalao : undefined} onClick={() => tocar(no)}>
                  {conteudo}
                </button>
              ) : (
                <button type="button" className="caminho-no__alvo" ref={(elemento) => guardarBotao(no.id, elemento)}
                  aria-label={nome} aria-haspopup={atual ? undefined : 'dialog'} aria-expanded={atual ? undefined : estaAberto}
                  aria-controls={estaAberto ? idBalao : undefined} disabled={ocupado} onClick={() => tocar(no)}>
                  {conteudo}
                </button>
              )}
              {estaAberto && (
                <>
                  <span className="caminho-balao__seta" aria-hidden="true" />
                  <div className="caminho-balao" id={idBalao} ref={balao} role="dialog" tabIndex={-1} data-estado={no.estado}
                    aria-labelledby={`${idBalao}-titulo`} aria-describedby={`${idBalao}-texto`}>
                    <div className="caminho-balao__topo">
                      <p className="caminho-balao__titulo" id={`${idBalao}-titulo`}>{no.titulo}</p>
                      <button type="button" className="caminho-balao__fechar" aria-label={mensagens.trilha.fechar} onClick={fechar}>
                        <Icone nome="fechar" />
                      </button>
                    </div>
                    <p className="caminho-balao__texto" id={`${idBalao}-texto`}>{explicar(nos, indice)}</p>
                    {no.estado === 'concluida' && aoAbrir && (
                      <Botao variante="secundario" onClick={() => {
                        setAberto(null);
                        aoAbrir(no);
                      }}>{mensagens.trilha.refazer}</Botao>
                    )}
                    {no.estado === 'bloqueada' && nos.some((item) => item.estado === 'atual') && (
                      <Botao variante="secundario" onClick={irParaAtual}>{mensagens.trilha.irParaAtual}<Icone nome="seta" /></Botao>
                    )}
                  </div>
                </>
              )}
              {/* A faixa da próxima parte vem depois do nó na leitura: quem usa leitor de tela ouve a lição antes da parte seguinte. */}
              {fimDoTrecho && (
                <span className="caminho-marco" data-vencido={marcoVencido || undefined}>
                  <FaixaParte numero={numeroMarco + 1} trecho={seguinte.trecho} resumo={resumoTrechos.get(seguinte.trecho)} />
                </span>
              )}
              {fimDoTrecho && (
                <span className="somente-leitor">
                  {marcoVencido ? mensagens.trilha.marcoVencido(numeroMarco) : mensagens.trilha.marco(numeroMarco)}
                </span>
              )}
            </li>
          );
        })}
        {montando && (
          <li className="caminho-no caminho-no--vindo" data-lado={posicaoX(total) >= 50 ? 'direita' : 'esquerda'} data-rotulo ref={vindo}
            style={{ ...coresDaRegiao(ultimoTrecho), '--x': posicaoX(total) } as CSSProperties} aria-hidden="true">
            <div className="caminho-no__alvo">
              <span className="caminho-no__lente" />
              <span className="caminho-no__texto"><span /><span /></span>
            </div>
          </li>
        )}
      </ol>
      {comChegada && (
        <div className="caminho-chegada" data-feita={tudoFeito || undefined} ref={fim} style={coresDaRegiao(ultimoTrecho)}
          data-festa={festaNaChegada || (comRecem && tudoFeito) || undefined}>
          <span className="caminho-chegada__cenario" aria-hidden="true">
            <span className="caminho-chegada__colina" />
            <Desenho nome="bandeira" className="caminho-chegada__bandeira caminho-chegada__bandeira--1" />
            <Desenho nome="bandeira" className="caminho-chegada__bandeira caminho-chegada__bandeira--2" />
            {/* Estrelas também antes da conquista: o troféu já parece um prêmio desejável. */}
            {(
              <>
                <Desenho nome="estrela" className="caminho-chegada__brilho caminho-chegada__brilho--1" />
                <Desenho nome="estrela" className="caminho-chegada__brilho caminho-chegada__brilho--2" />
                <Desenho nome="estrela" className="caminho-chegada__brilho caminho-chegada__brilho--3" />
              </>
            )}
          </span>
          {stuNaChegada && <span className="caminho-chegada__stu" aria-hidden="true"><Stu /></span>}
          <button type="button" className="caminho-chegada__lente" aria-label={mensagens.trilha.trofeu} disabled={montando}
            data-tocado={trofeuTocado ? (trofeuTocado % 2 ? 'a' : 'b') : undefined}
            onClick={() => {
              setTrofeuTocado((anterior) => anterior + 1);
              const faltam = nos.filter((no) => no.estado !== 'concluida').length;
              setAnuncio(tudoFeito ? mensagens.trilha.trofeuConquistado : mensagens.trilha.trofeuProgresso(total - faltam, total));
            }}>
            <Icone nome="trofeu" />
            {(festaNaChegada || (comRecem && tudoFeito)) && <Confete quantidade={18} />}
            {trofeuTocado > 0 && (
              <span key={trofeuTocado} className="caminho-chegada__bolha" aria-hidden="true">
                {tudoFeito ? mensagens.trilha.trofeuConquistado : mensagens.trilha.trofeuProgresso(nos.filter((no) => no.estado === 'concluida').length, total)}
              </span>
            )}
            {trofeuTocado > 0 && tudoFeito && <Confete key={`t${trofeuTocado}`} quantidade={14} />}
          </button>
          <p className="caminho-chegada__texto">{tudoFeito ? mensagens.trilha.chegadaFeita : mensagens.trilha.chegada}</p>
          {!tudoFeito && !montando && <p className="caminho-chegada__meta">{mensagens.trilha.chegadaMeta(total)}</p>}
        </div>
      )}
      <p className="somente-leitor" role="status">{anuncio}</p>
    </div>
  );
}

/** Esqueleto da trilha: a faixa do topo e o mapa com a forma do caminho, nas cores dos campos. */
export function SkeletonTrilha() {
  return (
    <div className="skeleton-trilha" role="status">
      <p className="somente-leitor">{mensagens.trilha.carregando}</p>
      <div className="skeleton-trilha__cabecalho" aria-hidden="true">
        <span /><span /><span />
      </div>
      <div className="skeleton-trilha__caminho" style={coresDaRegiao(0) as CSSProperties} aria-hidden="true">
        <span className="skeleton-trilha__no" data-lado="esquerda" />
        <span className="skeleton-trilha__no" data-lado="direita" />
        <span className="skeleton-trilha__no" data-lado="esquerda" />
        <span className="skeleton-trilha__no" data-lado="direita" />
      </div>
    </div>
  );
}
