'use client';

/*
 * Código Studoo na web (spec 10, etapa C1): o código do link (estilo "rosto" por padrão; os três estilos ficam no
 * gerador do contrato), com copiar link, compartilhar, baixar imagem e o modo apresentação (código grande em tela
 * cheia, para projetar). Tudo gerado no navegador a partir da função pura do contrato: nenhum serviço externo.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FUNDO_DA_COR, centroDoCodigo, enderecoFoto, inicialDoNome, svgCodigoDoLink, type CorPerfil, type EstiloCodigo } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Icone } from '../ui';
import { useDialogo } from './compartilhar';
import { tocaSons } from './sons';
import './codigo.css';

const k = mensagens.codigo;

/** O SVG do código (função pura do contrato): cor do perfil no miolo dos olhos, foto no centro quando houver. */
export function svgDoCodigo(texto: string, { cor, fotoHref, inicial, letraNoCentro = true, estilo = 'rosto', tamanho = 600 }: { cor?: CorPerfil | null; fotoHref?: string | null; inicial?: string | null; letraNoCentro?: boolean; estilo?: EstiloCodigo; tamanho?: number }) {
  return svgCodigoDoLink(texto, { mioloCor: FUNDO_DA_COR[cor ?? 'azul'], fotoHref, inicial, letraNoCentro, estilo, tamanho });
}

const dataUrlSvg = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rejeitar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => rejeitar(new Error('imagem'));
    img.src = src;
  });
}

/** A foto como data URL (um SVG desenhado no canvas não busca endereços de fora dele). */
async function fotoComoDataUrl(token: string): Promise<string> {
  const resposta = await fetch(enderecoFoto(token, 512));
  if (!resposta.ok) throw new Error('foto');
  const blob = await resposta.blob();
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result));
    leitor.onerror = () => rejeitar(new Error('foto'));
    leitor.readAsDataURL(blob);
  });
}

/** Quebra o título em até duas linhas que cabem na largura (com reticências na segunda, se precisar). */
function linhas(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const palavras = texto.split(/\s+/);
  const saida: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width <= largura || !atual) atual = tentativa;
    else { saida.push(atual); atual = palavra; }
  }
  if (atual) saida.push(atual);
  if (saida.length > 2) {
    let segunda = saida.slice(1).join(' ');
    while (ctx.measureText(`${segunda}…`).width > largura && segunda.length > 1) segunda = segunda.slice(0, -1);
    return [saida[0], `${segunda.trimEnd()}…`];
  }
  return saida;
}

/** A imagem para baixar e compartilhar: cartão 1080×1350 com o título, o código, a dica e a marca (PNG). */
export async function imagemDoCodigo({ texto, titulo, dica, cor, fotoToken, inicial, demonstracao = false }: { texto: string; titulo: string; dica: string; cor?: CorPerfil | null; fotoToken?: string | null; inicial?: string | null; demonstracao?: boolean }): Promise<Blob> {
  await document.fonts.ready;
  const fotoHref = fotoToken ? await fotoComoDataUrl(fotoToken) : null;
  const [codigo, logo] = await Promise.all([
    // A inicial vai sem a letra no SVG: um SVG desenhado como imagem não enxerga as fontes da página. A letra entra
    // depois, desenhada no próprio canvas com a Quicksand da marca.
    carregarImagem(dataUrlSvg(svgDoCodigo(texto, { cor, fotoHref, inicial: fotoHref ? null : inicial, letraNoCentro: false, tamanho: 1200 }))),
    carregarImagem('/marca/logo-com-sorriso.svg').catch(() => null),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#eef3ff';
  ctx.fillRect(0, 0, 1080, 1350);
  // Moldura sempre no azul da marca (como na folha); a cor da pessoa fica só no miolo dos olhos e no centro.
  const moldura = (x: number, y: number, l: number, r: number, corMoldura: string) => { ctx.fillStyle = corMoldura; ctx.beginPath(); ctx.roundRect(x, y, l, l, r); ctx.fill(); };
  // Conjunto 24 px acima e moldura de 800 (antes 840): sobram 72 px ou mais embaixo do logotipo.
  moldura(140, 250, 800, 132, '#3858d6');
  moldura(172, 282, 736, 100, '#ffffff');
  // O código entra recortado em cantos arredondados, concêntricos com a moldura: nenhum quadradinho nos cantos.
  const [cx0, cy0, lado] = [196, 306, 688];
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx0, cy0, lado, lado, 80);
  ctx.clip();
  ctx.drawImage(codigo, cx0, cy0, lado, lado);
  ctx.restore();
  const centro = !fotoHref && inicial ? centroDoCodigo(texto) : null;
  if (centro && inicial) {
    // A letra na cor do perfil, sobre o disco claro (como no código da folha).
    ctx.fillStyle = FUNDO_DA_COR[cor ?? 'azul'];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(centro.letra * lado)}px Quicksand, sans-serif`;
    ctx.fillText(inicial.slice(0, 1), cx0 + centro.cx * lado, cy0 + centro.cy * lado + centro.letra * lado * 0.04);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.fillStyle = '#1b2a5e';
  ctx.textAlign = 'center';
  ctx.font = '700 64px Quicksand, sans-serif';
  const titulos = linhas(ctx, titulo, 920);
  // Com o selo "Demonstração" sob o título, o título sobe um pouco.
  const topoTitulo = (titulos.length === 1 ? 166 : 118) - (demonstracao ? 24 : 0);
  titulos.forEach((linha, i) => ctx.fillText(linha, 540, topoTitulo + i * 76));
  if (demonstracao) {
    // O mesmo selo creme de borda tracejada de "Perfil de demonstração".
    ctx.font = '800 30px Nunito, sans-serif';
    const largura = ctx.measureText(mensagens.comunidade.demonstracao).width + 40;
    const y = topoTitulo + (titulos.length - 1) * 76 + 26;
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath(); ctx.roundRect(540 - largura / 2, y, largura, 46, 23); ctx.fill();
    ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = '#b7791f';
    ctx.beginPath(); ctx.roundRect(540 - largura / 2, y, largura, 46, 23); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#7a4a00';
    ctx.fillText(mensagens.comunidade.demonstracao, 540, y + 33);
  }
  ctx.fillStyle = '#1b2a5e';
  ctx.font = '700 36px Nunito, sans-serif';
  ctx.fillText(dica, 540, 1124, 960);
  if (logo) ctx.drawImage(logo, 400, 1170, 280, 92);
  return new Promise((resolver, rejeitar) => canvas.toBlob((blob) => (blob ? resolver(blob) : rejeitar(new Error('png'))), 'image/png'));
}

/** Modo apresentação: o código grande em tela cheia, com o título e "Aponte a câmera"; Esc ou Fechar sai. */
export function ModoApresentacao({ svg, titulo, rotulo, demonstracao = false, aoFechar: aoFecharFora }: { svg: string; titulo: string; rotulo: string; demonstracao?: boolean; aoFechar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const fecharRef = useRef(aoFecharFora);
  fecharRef.current = aoFecharFora;
  const aoFechar = () => fecharRef.current();
  useDialogo(caixa, aoFechar);
  useEffect(() => {
    const el = caixa.current;
    // O foco vai a "Fechar" (de novo depois de entrar em tela cheia, que pode mexer no foco).
    const focar = () => caixa.current?.querySelector<HTMLButtonElement>('button')?.focus();
    focar();
    requestAnimationFrame(focar);
    // Tela cheia quando o navegador deixa (no iPhone, a camada já ocupa a tela toda).
    el?.requestFullscreen?.().then(focar, focar);
    const saiu = () => { if (!document.fullscreenElement) aoFechar(); };
    document.addEventListener('fullscreenchange', saiu);
    return () => {
      document.removeEventListener('fullscreenchange', saiu);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
    // Só ao abrir e fechar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="apresentacao-codigo" role="dialog" aria-modal="true" aria-labelledby={tituloId} ref={caixa}>
      <button type="button" className="apresentacao-codigo__fechar" onClick={aoFechar}><Icone nome="fechar" />{k.fechar}</button>
      {/* Título, código e dica num bloco só, centrado; sem moldura (o código o maior possível) e com a marca embaixo. */}
      <div className="apresentacao-codigo__bloco">
        <h2 id={tituloId} className="apresentacao-codigo__titulo">{titulo}</h2>
        {demonstracao && <p className="selo-demo apresentacao-codigo__demo">{mensagens.comunidade.demonstracao}</p>}
        <span className="apresentacao-codigo__codigo" role="img" aria-label={rotulo} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="apresentacao-codigo__dica"><strong>{k.apresentacaoApontar}</strong> {k.apresentacaoAbrir}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="apresentacao-codigo__marca" src="/marca/logo-com-sorriso.svg" alt="Studoo" width={140} height={46} />
      </div>
    </div>
  );
}

/**
 * O painel do Código Studoo: o código, e as ações (copiar link e compartilhar quando `comLink`; baixar imagem,
 * compartilhar imagem quando o aparelho deixa, e apresentar). `fotoToken` põe a foto no centro.
 */
export function PainelCodigo({ url, titulo, dica, rotulo, cor, fotoToken, inicial, nomeArquivo, comLink = true, demonstracao = false, mostra }: {
  /** Trilha de demonstração: o selo vai também na imagem baixada e na apresentação. */
  demonstracao?: boolean;
  /** Uma linha sob o código dizendo o que quem abrir vai ver (folha do perfil). */
  mostra?: string;
  /** Perfil sem foto: a inicial na cor vai no centro (igual na folha, na imagem e na apresentação). */
  inicial?: string | null;
  url: string;
  titulo: string;
  dica: string;
  rotulo: string;
  cor?: CorPerfil | null;
  fotoToken?: string | null;
  nomeArquivo: string;
  comLink?: boolean;
}) {
  const [status, setStatus] = useState('');
  const [gerando, setGerando] = useState(false);
  const [apresentando, setApresentando] = useState(false);
  const [podeArquivo, setPodeArquivo] = useState(false);
  const fotoHref = fotoToken ? enderecoFoto(fotoToken, 512) : null;
  const centroInicial = fotoHref ? null : inicial ?? null;
  const svg = useMemo(() => svgDoCodigo(url, { cor, fotoHref, inicial: centroInicial }), [url, cor, fotoHref, centroInicial]);
  const avisar = (texto: string) => setStatus((anterior) => (anterior === texto ? `${texto} ` : texto));

  useEffect(() => {
    try {
      const teste = new File([new Uint8Array(1)], 'teste.png', { type: 'image/png' });
      setPodeArquivo(typeof navigator.canShare === 'function' && navigator.canShare({ files: [teste] }));
    } catch { setPodeArquivo(false); }
  }, []);

  async function copiar() {
    try { await navigator.clipboard.writeText(url); void tocaSons.tocarEfeito('link_copiado'); avisar(k.copiado); } catch { avisar(mensagens.compartilhar.copiarFalhou); }
  }
  async function compartilharLink() {
    if (typeof navigator.share !== 'function') return copiar();
    try { await navigator.share({ title: titulo, url }); } catch { /* fechou a folha */ }
  }
  async function gerar() {
    setGerando(true);
    avisar(k.gerando);
    try {
      return await imagemDoCodigo({ texto: url, titulo, dica, cor, fotoToken, inicial: centroInicial, demonstracao });
    } catch {
      avisar(k.falhou);
      return null;
    } finally {
      setGerando(false);
    }
  }
  async function baixar() {
    const blob = await gerar();
    if (!blob) return;
    const endereco = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = endereco;
    link.download = `${nomeArquivo}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(endereco), 4000);
    avisar(k.baixada);
  }
  async function compartilharImagem() {
    const blob = await gerar();
    if (!blob) return;
    try {
      await navigator.share({ files: [new File([blob], `${nomeArquivo}.png`, { type: 'image/png' })], title: titulo, text: url });
      setStatus('');
    } catch { /* fechou a folha */ }
  }

  return (
    <section className="painel-codigo" aria-label={k.titulo}>
      <span className="painel-codigo__codigo" role="img" aria-label={rotulo} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="painel-codigo__dica">{dica}</p>
      {mostra && <p className="painel-codigo__mostra">{mostra}</p>}
      <div className="painel-codigo__acoes" data-quatro={comLink || undefined}>
        {comLink && <Botao onClick={() => void compartilharLink()}><Icone nome="compartilhar" />{k.compartilhar}</Botao>}
        {comLink && <Botao variante="secundario" onClick={() => void copiar()}><Icone nome="copiar" />{k.copiar}</Botao>}
        <Botao variante="secundario" disabled={gerando} aria-busy={gerando || undefined} onClick={() => void baixar()}><Icone nome="imagem" />{k.baixar}</Botao>
        {podeArquivo && <Botao variante="secundario" disabled={gerando} onClick={() => void compartilharImagem()}><Icone nome="compartilhar" />{k.compartilharImagem}</Botao>}
        <Botao variante="secundario" aria-label={k.apresentarRotulo} onClick={() => setApresentando(true)}><Icone nome="telaCheia" />{k.apresentar}</Botao>
      </div>
      <p className="folha-status" role="status" aria-live="polite">{status}</p>
      {apresentando && <ModoApresentacao svg={svgDoCodigo(url, { cor, fotoHref, inicial: centroInicial, tamanho: 1200 })} titulo={titulo} rotulo={rotulo} demonstracao={demonstracao} aoFechar={() => setApresentando(false)} />}
    </section>
  );
}

/** "Compartilhar perfil": abre uma folha com o Código Studoo do perfil (foto no centro) e as ações. */
export function FolhaCompartilharPerfil({ perfilId, nome, cor, fotoToken, aoFechar }: { perfilId: string; nome: string; cor: CorPerfil; fotoToken: string | null; aoFechar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  useDialogo(caixa, aoFechar);
  useEffect(() => { caixa.current?.querySelector<HTMLElement>('h2')?.focus(); }, []);
  const url = `${window.location.origin}/p/${perfilId}`;
  return (
    <div className="folha-fundo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="folha folha--codigo" role="dialog" aria-modal="true" aria-labelledby={tituloId} ref={caixa}>
        <div className="folha-topo">
          <p className="folha-contexto">{nome}</p>
          <button type="button" className="folha-fechar" aria-label={mensagens.compartilhar.fechar} onClick={aoFechar}><Icone nome="fechar" /></button>
        </div>
        <h2 id={tituloId} tabIndex={-1} className="folha-titulo">{k.perfilTitulo}</h2>
        <PainelCodigo url={url} titulo={k.imagemPerfil(nome)} dica={k.dicaPerfil} rotulo={k.rotuloPerfil(nome)} cor={cor} fotoToken={fotoToken} inicial={inicialDoNome(nome)}
          mostra={mensagens.compartilhar.perfilMostra}
          nomeArquivo={`studoo-perfil-${nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`} />
      </div>
    </div>
  );
}
