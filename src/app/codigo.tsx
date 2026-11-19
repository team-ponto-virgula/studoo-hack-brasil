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
export async function imagemDoCodigo({ texto, titulo, dica, cor, fotoToken, inicial }: { texto: string; titulo: string; dica: string; cor?: CorPerfil | null; fotoToken?: string | null; inicial?: string | null }): Promise<Blob> {
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
  // Moldura do ícone do app em volta do código (como no cartão "rosto" da etapa 1).
  const moldura = (x: number, y: number, l: number, r: number, cor: string) => { ctx.fillStyle = cor; ctx.beginPath(); ctx.roundRect(x, y, l, l, r); ctx.fill(); };
  moldura(120, 270, 840, 140, FUNDO_DA_COR[cor ?? 'azul']);
  moldura(154, 304, 772, 106, '#ffffff');
  // O código entra recortado em cantos arredondados, concêntricos com a moldura: nenhum quadradinho nos cantos.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(180, 330, 720, 720, 84);
  ctx.clip();
  ctx.drawImage(codigo, 180, 330, 720, 720);
  ctx.restore();
  const centro = !fotoHref && inicial ? centroDoCodigo(texto) : null;
  if (centro && inicial) {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(centro.letra * 720)}px Quicksand, sans-serif`;
    ctx.fillText(inicial.slice(0, 1), 180 + centro.cx * 720, 330 + centro.cy * 720 + centro.letra * 720 * 0.04);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.fillStyle = '#1b2a5e';
  ctx.textAlign = 'center';
  ctx.font = '700 64px Quicksand, sans-serif';
  const titulos = linhas(ctx, titulo, 920);
  titulos.forEach((linha, i) => ctx.fillText(linha, 540, (titulos.length === 1 ? 190 : 140) + i * 76));
  ctx.font = '700 36px Nunito, sans-serif';
  ctx.fillText(dica, 540, 1172, 960);
  if (logo) ctx.drawImage(logo, 400, 1222, 280, 92);
  return new Promise((resolver, rejeitar) => canvas.toBlob((blob) => (blob ? resolver(blob) : rejeitar(new Error('png'))), 'image/png'));
}

/** Modo apresentação: o código grande em tela cheia, com o título e "Aponte a câmera"; Esc ou Fechar sai. */
export function ModoApresentacao({ svg, titulo, rotulo, aoFechar: aoFecharFora }: { svg: string; titulo: string; rotulo: string; aoFechar: () => void }) {
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
      <h2 id={tituloId} className="apresentacao-codigo__titulo">{titulo}</h2>
      <span className="apresentacao-codigo__codigo" role="img" aria-label={rotulo} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="apresentacao-codigo__dica"><strong>{k.apresentacaoApontar}</strong> {k.apresentacaoAbrir}</p>
    </div>
  );
}

/**
 * O painel do Código Studoo: o código, e as ações (copiar link e compartilhar quando `comLink`; baixar imagem,
 * compartilhar imagem quando o aparelho deixa, e apresentar). `fotoToken` põe a foto no centro.
 */
export function PainelCodigo({ url, titulo, dica, rotulo, cor, fotoToken, inicial, nomeArquivo, comLink = true }: {
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
    try { await navigator.clipboard.writeText(url); avisar(k.copiado); } catch { avisar(mensagens.compartilhar.copiarFalhou); }
  }
  async function compartilharLink() {
    if (typeof navigator.share !== 'function') return copiar();
    try { await navigator.share({ title: titulo, url }); } catch { /* fechou a folha */ }
  }
  async function gerar() {
    setGerando(true);
    avisar(k.gerando);
    try {
      return await imagemDoCodigo({ texto: url, titulo, dica, cor, fotoToken, inicial: centroInicial });
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
      <div className="painel-codigo__acoes">
        {comLink && <Botao variante="secundario" onClick={() => void copiar()}><Icone nome="copiar" />{k.copiar}</Botao>}
        {comLink && <Botao variante="secundario" onClick={() => void compartilharLink()}><Icone nome="compartilhar" />{k.compartilhar}</Botao>}
        <Botao variante="secundario" disabled={gerando} aria-busy={gerando || undefined} onClick={() => void baixar()}><Icone nome="imagem" />{k.baixar}</Botao>
        {podeArquivo && <Botao variante="secundario" disabled={gerando} onClick={() => void compartilharImagem()}><Icone nome="compartilhar" />{k.compartilharImagem}</Botao>}
        <Botao variante="secundario" aria-label={k.apresentarRotulo} onClick={() => setApresentando(true)}><Icone nome="olho" />{k.apresentar}</Botao>
      </div>
      <p className="folha-status" role="status" aria-live="polite">{status}</p>
      {apresentando && <ModoApresentacao svg={svgDoCodigo(url, { cor, fotoHref, inicial: centroInicial, tamanho: 1200 })} titulo={titulo} rotulo={rotulo} aoFechar={() => setApresentando(false)} />}
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
          nomeArquivo={`studoo-perfil-${nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`} />
      </div>
    </div>
  );
}
