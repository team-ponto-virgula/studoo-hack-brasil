'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { abertura, criarControleAbertura, permiteAbertura, type FaseAbertura, type MotivoDaAbertura } from '@studoo/contratos/abertura';
import './abertura.css';

const medidas = {
  '--abertura-largura': `${abertura.largura}px`,
  '--abertura-altura': `${abertura.altura}px`,
  '--abertura-fundo': abertura.fundo,
  '--abertura-acomodacao': `${abertura.acomodacaoMs}ms`,
  '--abertura-saida': `${abertura.saidaMs}ms`,
  '--abertura-limite': `${abertura.limiteMs}ms`,
  '--abertura-escala': String(abertura.escalaMaxima),
  '--abertura-subida': `${-abertura.deslocamentoMaximo}px`,
  '--abertura-curva': `cubic-bezier(${abertura.curva.join(',')})`,
} as CSSProperties;

/**
 * Assinatura breve da marca na abertura do documento. Os filhos continuam montados durante todas as fases;
 * sessão, rotas e fontes se preparam em paralelo. O CSS também libera a página se o JavaScript não iniciar.
 */
export function Abertura({ children, permitidaInicial }: { children: ReactNode; permitidaInicial: boolean }) {
  const caminho = usePathname() ?? '';
  const primeiroCaminho = useRef(caminho);
  const [fase, definirFase] = useState<FaseAbertura>(() => permitidaInicial && permiteAbertura(caminho) ? 'visivel' : 'concluida');
  const [motivo, definirMotivo] = useState<MotivoDaAbertura | undefined>();
  const [marcaPronta, definirMarcaPronta] = useState(false);
  const marca = useRef<HTMLImageElement>(null);
  const camada = useRef<HTMLDivElement>(null);
  const controle = useRef<ReturnType<typeof criarControleAbertura> | null>(null);
  const faseEfetiva = caminho === primeiroCaminho.current ? fase : 'concluida';

  useLayoutEffect(() => {
    if (caminho !== primeiroCaminho.current) {
      definirFase('concluida');
      definirMotivo('contexto');
      return;
    }
    if (faseEfetiva === 'concluida') return;
    // Retornos com erro, OAuth e links com fragmento não esperam a marca. A checagem precede prontidão ou animação.
    if (!permiteAbertura(caminho, window.location.search, window.location.hash)
      || document.documentElement.dataset.aberturaDispensada === 'true'
      || document.hidden
      || (document.activeElement !== document.body && document.activeElement !== document.documentElement)) {
      definirFase('concluida');
      definirMotivo('contexto');
      return;
    }
    let media: MediaQueryList;
    try {
      media = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (!media || typeof media.addEventListener !== 'function' || typeof media.removeEventListener !== 'function') {
        throw new Error('Preferência de movimento indisponível');
      }
    } catch {
      definirFase('concluida');
      definirMotivo('falha');
      return;
    }
    // A regra CSS faz a mesma dispensa antes da hidratação, inclusive sem JavaScript.
    const estiloCamada = camada.current && getComputedStyle(camada.current);
    if (media.matches || !estiloCamada || estiloCamada.visibility === 'hidden' || estiloCamada.display === 'none') {
      definirFase('concluida');
      definirMotivo(media.matches ? 'preferencia' : 'limite');
      return;
    }
    let vivo = true;
    let primeiraMoldura: number | undefined;
    let segundaMoldura: number | undefined;
    let agendouProntidao = false;
    let fontesProntas = !document.fonts || document.fonts.status === 'loaded';
    const fonteDaAplicacaoFalhou = () => document.fonts && Array.from(document.fonts).some(
      (fonte) => /^(?:['"])?(?:Nunito|Quicksand)(?:['"])?$/i.test(fonte.family.trim()) && fonte.status === 'error',
    );
    let consumirCliqueAte = 0;
    let limparInteracoesDepois: number | undefined;
    const atual = criarControleAbertura((proxima, causa) => {
      if (!vivo) return;
      definirFase(proxima);
      definirMotivo(causa);
      if (proxima === 'concluida') {
        retirarSinais();
        const restante = consumirCliqueAte - performance.now();
        if (restante > 0) limparInteracoesDepois = window.setTimeout(retirarInteracoes, restante);
        else retirarInteracoes();
      }
    });
    controle.current = atual;
    const pular = (causa: Exclude<MotivoDaAbertura, 'pronto'>) => atual.pular(causa);
    const conferirProntidao = () => {
      const imagem = marca.current;
      if (!vivo || atual.fase() !== 'visivel') return;
      if (fonteDaAplicacaoFalhou()) { pular('falha'); return; }
      if (imagem?.complete && !imagem.naturalWidth) { pular('falha'); return; }
      if (agendouProntidao || !fontesProntas || !imagem?.complete) return;
      definirMarcaPronta(true);
      agendouProntidao = true;
      // Uma tela local pintada basta. Nenhuma consulta de sessão, IA ou rede participa deste sinal.
      primeiraMoldura = requestAnimationFrame(() => {
        segundaMoldura = requestAnimationFrame(() => atual.pronto(!media.matches));
      });
    };
    const imagemCarregada = () => {
      if (vivo) definirMarcaPronta(true);
      conferirProntidao();
    };
    const imagemFalhou = () => pular('falha');
    const fonteFalhou = () => { if (fonteDaAplicacaoFalhou()) pular('falha'); };
    const preferenciaMudou = () => { if (media.matches) pular('preferencia'); };
    const contextoMudou = () => { if (document.hidden) pular('contexto'); };
    const focoMudou = () => { if (atual.fase() !== 'concluida') pular('interacao'); };
    const enderecoMudou = () => pular('contexto');
    const interacao = (evento: Event) => {
      const agora = performance.now();
      // Na dissolução a interface já está visível. O gesto pertence a ela e segue sem ser consumido.
      if (atual.fase() === 'saindo') {
        flushSync(() => pular('interacao'));
        return;
      }
      // O toque consumido na marca não deve gerar um click tardio nem liberar áudio no fundo da página.
      if (atual.fase() === 'concluida') {
        if (evento.type === 'pointerdown') {
          consumirCliqueAte = 0;
          window.clearTimeout(limparInteracoesDepois);
          retirarInteracoes();
          return;
        }
        if (agora >= consumirCliqueAte || !['click', 'touchend', 'pointerup'].includes(evento.type)) return;
        evento.preventDefault();
        evento.stopImmediatePropagation();
        if (evento.type === 'click') {
          consumirCliqueAte = 0;
          window.clearTimeout(limparInteracoesDepois);
          retirarInteracoes();
        }
        return;
      }
      // O fallback CSS pode ter liberado a página antes de um bundle lento hidratar. Nesse caso o gesto já é do app.
      const estiloAtual = camada.current && getComputedStyle(camada.current);
      if (!estiloAtual || estiloAtual.visibility === 'hidden' || estiloAtual.display === 'none') {
        flushSync(() => pular('limite'));
        return;
      }
      if (evento.type === 'pointerdown' || evento.type === 'touchstart') consumirCliqueAte = agora + 700;
      const teclado = evento instanceof KeyboardEvent ? evento : null;
      // Tab continua o percurso normal depois da revelação síncrona; a intro não recebe nem devolve foco.
      if (teclado?.key !== 'Tab' && !teclado?.ctrlKey && !teclado?.metaKey && !teclado?.altKey) evento.preventDefault();
      evento.stopImmediatePropagation();
      flushSync(() => pular('interacao'));
    };
    function retirarInteracoes() {
      for (const tipo of ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'click', 'keydown']) {
        window.removeEventListener(tipo, interacao, true);
      }
    }
    const imagem = marca.current;
    function retirarSinais() {
      if (primeiraMoldura !== undefined) cancelAnimationFrame(primeiraMoldura);
      if (segundaMoldura !== undefined) cancelAnimationFrame(segundaMoldura);
      imagem?.removeEventListener('load', imagemCarregada);
      imagem?.removeEventListener('error', imagemFalhou);
      document.fonts?.removeEventListener('loadingerror', fonteFalhou);
      media.removeEventListener('change', preferenciaMudou);
      document.removeEventListener('visibilitychange', contextoMudou);
      document.removeEventListener('focusin', focoMudou);
      window.removeEventListener('hashchange', enderecoMudou);
      window.removeEventListener('popstate', enderecoMudou);
    }
    imagem?.addEventListener('load', imagemCarregada);
    imagem?.addEventListener('error', imagemFalhou);
    document.fonts?.addEventListener('loadingerror', fonteFalhou);
    media.addEventListener('change', preferenciaMudou);
    document.addEventListener('visibilitychange', contextoMudou);
    document.addEventListener('focusin', focoMudou);
    window.addEventListener('hashchange', enderecoMudou);
    window.addEventListener('popstate', enderecoMudou);
    for (const tipo of ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'click', 'keydown']) {
      window.addEventListener(tipo, interacao, { capture: true, passive: false });
    }
    if (document.fonts && !fontesProntas) {
      void document.fonts.ready.then(() => {
        if (!vivo) return;
        if (fonteDaAplicacaoFalhou()) { pular('falha'); return; }
        fontesProntas = true;
        conferirProntidao();
      }).catch(() => { if (vivo) pular('falha'); });
    }
    if (imagem?.complete && imagem.naturalWidth > 0) definirMarcaPronta(true);
    conferirProntidao();
    return () => {
      vivo = false;
      atual.destruir();
      if (controle.current === atual) controle.current = null;
      retirarSinais();
      window.clearTimeout(limparInteracoesDepois);
      retirarInteracoes();
    };
    // O ciclo nasce uma vez para a rota inicial. Alterar a fase não reinicia timers ou ouvintes de eventos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminho]);

  return (
    <div className="abertura-raiz" style={medidas} data-abertura-fase={faseEfetiva} data-abertura-motivo={motivo}>
      <div className="abertura-conteudo">{children}</div>
      {faseEfetiva !== 'concluida' && <div ref={camada} className="abertura-camada" aria-hidden="true" data-testid="abertura-studoo">
        {/* A marca é o mesmo raster do launch nativo, sem a flutuação dos cabeçalhos do produto. */}
        <img ref={marca} className="abertura-marca" src="/marca/logo-com-sorriso.png" alt="" aria-hidden="true"
          width={abertura.largura} height={abertura.altura} fetchPriority="high" draggable={false}
          data-testid="abertura-marca" data-pronta={marcaPronta ? 'true' : 'false'} />
      </div>}
    </div>
  );
}
