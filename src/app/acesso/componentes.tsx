'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import google from '../../../packages/contratos/assets/google-g.png';
import google2x from '../../../packages/contratos/assets/google-g@2x.png';
import google3x from '../../../packages/contratos/assets/google-g@3x.png';
import { mensagens } from '../../mensagens/pt-BR';
import { SemMusica } from '../conheca/ilhas/sem-musica';
import './acesso.css';

/** A mesma arte da abertura, com saudação finita que não impede o uso do formulário. */
export function MarcaAcesso({ gesto = 0 }: { gesto?: number }) {
  const marca = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const elemento = marca.current;
    if (!elemento) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animacoes: Animation[] = [];
    let presente = true;
    let interagiu = false;
    const cancelar = () => animacoes.forEach(animacao => animacao.cancel());
    const interacao = () => { interagiu = true; };
    const preferencia = () => { if (reduzido.matches) cancelar(); };
    const visibilidade = () => { if (document.hidden) cancelar(); };
    const oculos = elemento.querySelector<HTMLElement>('.acesso__oculos');
    const preparar = async () => {
      await Promise.all(Array.from(elemento.querySelectorAll('img'), imagem => imagem.decode().catch(() => undefined)));
      if (!presente || reduzido.matches || document.hidden || !oculos?.animate || (gesto === 0 && interagiu)) return;
      animacoes.push(oculos.animate(gesto === 0 ? [
        { transform: 'translateY(0) rotate(0)' },
        { transform: 'translateY(-4px) rotate(-7deg)', offset: .28 },
        { transform: 'translateY(-2px) rotate(3deg)', offset: .58 },
        { transform: 'translateY(0) rotate(0)' },
      ] : [
        { transform: 'translateY(0) rotate(0)' },
        { transform: 'translateY(2px) rotate(5deg)', offset: .35 },
        { transform: 'translateY(0) rotate(0)' },
      ], { duration: gesto === 0 ? 780 : 440, easing: 'cubic-bezier(.22,1,.36,1)' }));
      if (gesto === 0) elemento.querySelectorAll<HTMLElement>('.acesso__reflexo').forEach((reflexo, indice) => {
        animacoes.push(reflexo.animate([
          { opacity: 0, transform: 'translateX(0) rotate(-24deg)' },
          { opacity: .8, offset: .4 },
          { opacity: 0, transform: 'translateX(520%) rotate(-24deg)' },
        ], { duration: 520, delay: 110 + indice * 45, easing: 'ease-out' }));
      });
    };
    document.addEventListener('pointerdown', interacao, { once: true, capture: true });
    document.addEventListener('keydown', interacao, { once: true, capture: true });
    void preparar();
    reduzido.addEventListener('change', preferencia);
    document.addEventListener('visibilitychange', visibilidade);
    return () => {
      presente = false; cancelar(); reduzido.removeEventListener('change', preferencia); document.removeEventListener('visibilitychange', visibilidade);
      document.removeEventListener('pointerdown', interacao, true); document.removeEventListener('keydown', interacao, true);
    };
  }, [gesto]);
  return <Link className="acesso__marca-link" href="/boas-vindas" aria-label="Studoo. Conheça o aplicativo">
    <span ref={marca} className="acesso__marca" role="img" aria-label="Studoo">
      <span className="acesso__palavra" aria-hidden="true"><img src="/marca/logo-com-sorriso.png" alt="" width={560} height={184} /></span>
      <span className="acesso__oculos" aria-hidden="true">
        <span className="acesso__lente acesso__lente--esquerda"><span className="acesso__reflexo" /></span>
        <span className="acesso__lente acesso__lente--direita"><span className="acesso__reflexo" /></span>
        <img src="/marca/abertura-oculos-hd.png" alt="" width={2240} height={736} />
      </span>
    </span>
  </Link>;
}

export function SetaAcesso() {
  return <svg className="acesso__seta" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

export function GoogleAcesso({ ocupado, iniciar }: { ocupado: boolean; iniciar: () => void }) {
  return <button className="acesso__provedor" type="button" disabled={ocupado} onClick={iniciar}>
    <img src={google.src} srcSet={`${google2x.src} 2x, ${google3x.src} 3x`} width={20} height={20} alt="" aria-hidden="true" />
    <span>{mensagens.acesso.google}</span>
  </button>;
}

export function EstruturaAcesso({ children, gesto = 0, variante = 'login', rodape = true, voltar, ocupado = false }: {
  children: ReactNode; gesto?: number; variante?: 'login' | 'cadastro' | 'boas-vindas'; rodape?: boolean; voltar?: () => void; ocupado?: boolean;
}) {
  return <main className={`acesso acesso--${variante}`} id="conteudo-principal" data-sem-musica="">
    <SemMusica />
    <div className="acesso__conteudo">
      <header className="acesso__cabecalho"><MarcaAcesso gesto={gesto} />
        {voltar && <button className="acesso__voltar" type="button" aria-label="Voltar" disabled={ocupado} onClick={voltar}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        </button>}
      </header>
      {children}
      {rodape && <footer className="acesso__rodape">
        <Link href="/suporte">Ajuda</Link><span aria-hidden="true">·</span>
        <a href="/privacidade" target="_blank" rel="noopener">Privacidade</a>
      </footer>}
    </div>
  </main>;
}
