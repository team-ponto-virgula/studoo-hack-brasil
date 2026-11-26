'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BENEFICIOS_ONBOARDING } from '@studoo/contratos/onboarding-visual';
import { EstruturaAcesso, SetaAcesso } from '../acesso/componentes';
import { CenaStuOnboarding, estiloVisualOnboarding } from '../onboarding/visual';
import './boas-vindas.css';

const quadros = BENEFICIOS_ONBOARDING;

export function BoasVindas({ cadastroDisponivel }: { cadastroDisponivel: boolean }) {
  const [quadro, setQuadro] = useState(0);
  const titulo = useRef<HTMLHeadingElement>(null);
  const mudou = useRef(false);
  useEffect(() => { if (mudou.current) titulo.current?.focus({ preventScroll: true }); }, [quadro]);
  function mostrar(proximo: number) {
    if (proximo === quadro || proximo < 0 || proximo >= quadros.length) return;
    mudou.current = true; setQuadro(proximo);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const atual = quadros[quadro];
  return <EstruturaAcesso variante="boas-vindas" rodape={false} voltar={quadro > 0 ? () => mostrar(quadro - 1) : undefined}>
    <section className="boas-vindas" aria-labelledby="boas-vindas-titulo" style={estiloVisualOnboarding}>
      <div key={quadro} className="boas-vindas__quadro acesso__entrada-etapa">
        <h1 id="boas-vindas-titulo" ref={titulo} tabIndex={-1} className="acesso__titulo">{atual.titulo.split('\n')[0]}<br /><span>{atual.titulo.split('\n')[1]}</span></h1>
        <p className="boas-vindas__descricao">{atual.descricao}</p>
        <CenaStuOnboarding nome={atual.stu}>
        <figure className="boas-vindas__exemplo">
          <figcaption>Exemplo</figcaption>
          {quadro === 0 && <>
            <div className="boas-vindas__linha"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5c2-1.5 5.5-1.5 8 0 2.5-1.5 6-1.5 8 0v14c-2-1.5-5.5-1.5-8 0-2.5-1.5-6-1.5-8 0zM12 5.5v14" /></svg><span>Quero aprender SQL</span></div>
            <div className="boas-vindas__linha boas-vindas__linha--azul"><span aria-hidden="true">↓</span><span>Sua trilha <span className="boas-vindas__detalhe">· 5 lições</span></span></div>
          </>}
          {quadro === 1 && <>
            <div className="boas-vindas__linha boas-vindas__linha--erro"><span aria-hidden="true">↻</span><span>Ainda não foi dessa vez</span></div>
            <div className="boas-vindas__linha boas-vindas__linha--azul"><span>Outro jeito de entender</span><SetaAcesso /></div>
          </>}
          {quadro === 2 && <>
            <div className="boas-vindas__linha"><span>SQL para a prova</span><span className="boas-vindas__detalhe">1 de 5 lições</span></div>
            <progress max={5} value={1} aria-label="Exemplo: 1 de 5 lições concluídas">1 de 5 lições</progress>
            <div className="boas-vindas__linha boas-vindas__linha--azul"><span>Próximo: conectar tabelas</span><SetaAcesso /></div>
          </>}
        </figure>
        </CenaStuOnboarding>
      </div>
      <div className="boas-vindas__acoes">
        <nav className="boas-vindas__paginacao" aria-label="Conheça o Studoo">
          {quadros.map((item, indice) => <button key={item.rotulo} type="button" onClick={() => mostrar(indice)} aria-label={item.rotulo} aria-current={quadro === indice ? 'step' : undefined}><span /></button>)}
        </nav>
        {quadro < quadros.length - 1
          ? <button className="acesso__principal" type="button" onClick={() => mostrar(quadro + 1)}><span>Continuar</span><SetaAcesso /></button>
          : <Link className="acesso__principal" href={cadastroDisponivel ? '/cadastro' : '/login'}><span>{cadastroDisponivel ? 'Criar minha conta' : 'Entrar'}</span><SetaAcesso /></Link>}
        <Link className="acesso__outros-metodos boas-vindas__entrar" href="/login">Já tenho conta</Link>
      </div>
    </section>
  </EstruturaAcesso>;
}
