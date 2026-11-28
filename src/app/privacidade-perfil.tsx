'use client';

/*
 * "Privacidade e dados" no Perfil (revisão Apple): o aceite de IA de terceiros (ver quem recebe, parar ou permitir) e, na seção
 * "Conta", depois de "Sair", "Excluir conta" (5.1.1(v)), que apaga no ato depois de a pessoa digitar EXCLUIR numa folha do
 * Studoo. A política de privacidade do Studoo mora só em "Ajuda" (spec 16, item 19). O app tem o mesmo, com os mesmos textos
 * (`mensagens.privacidade`).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { CONFIRMACAO_EXCLUSAO, confirmacaoExclusaoValida, type EstadoPrivacidade } from '@studoo/contratos/privacidade';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao } from '../ui';
import { ListaProvedores, gravarAceiteIa } from './aceite-ia';
import { codigoDoErro, dataCurta, useDialogo } from './compartilhar';
import './privacidade.css';

const t = mensagens.privacidade;

/** Apaga o que o Studoo guardou neste navegador (rascunhos, preferências) depois de excluir a conta. */
function limparNavegador() {
  for (const armazenamento of [localStorage, sessionStorage]) {
    try {
      for (const chave of Object.keys(armazenamento)) if (chave.startsWith('studoo')) armazenamento.removeItem(chave);
    } catch { /* Sem armazenamento local. */ }
  }
}

function FolhaExcluir({ visitante, aoCancelar }: { visitante: boolean; aoCancelar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const tituloId = useId();
  const textoId = useId();
  const campoId = useId();
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useDialogo(caixa, () => { if (!ocupado) aoCancelar(); });
  useEffect(() => { campo.current?.focus(); }, []);
  const valido = confirmacaoExclusaoValida(texto);

  async function excluir() {
    if (!valido) { setErro(textoErro('confirmacao_invalida')); return; }
    setOcupado(true);
    setErro(null);
    try {
      await cliente.excluirConta();
      limparNavegador();
      window.location.replace('/login?conta=excluida');
    } catch (falha) {
      setErro(textoErro(codigoDoErro(falha)));
      setOcupado(false);
    }
  }

  return (
    <div className="folha-fundo folha-fundo--centro" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) aoCancelar(); }}>
      <div className="folha folha--confirmar" role="alertdialog" aria-modal="true" aria-labelledby={tituloId} aria-describedby={textoId} ref={caixa}>
        <h2 id={tituloId} className="folha-titulo">{t.excluirTitulo}</h2>
        <p id={textoId} className="folha-texto">{visitante ? t.excluirVisitante : t.excluirTexto}</p>
        <form className="campo" onSubmit={(e) => { e.preventDefault(); void excluir(); }}>
          <label htmlFor={campoId}>{t.excluirDigite}</label>
          <input id={campoId} ref={campo} value={texto} autoComplete="off" autoCapitalize="characters" spellCheck={false}
            placeholder={CONFIRMACAO_EXCLUSAO} disabled={ocupado} aria-invalid={erro ? true : undefined}
            onChange={(e) => { setTexto(e.target.value); setErro(null); }} />
          {erro && <p className="campo-erro" role="alert">{erro}</p>}
        </form>
        <div className="folha-acoes folha-acoes--par">
          <Botao variante="secundario" disabled={ocupado} onClick={aoCancelar}>{t.excluirCancelar}</Botao>
          <Botao variante="secundario" className="modal-confirmar--destrutivo" disabled={ocupado || !valido} onClick={() => void excluir()}>
            {ocupado ? t.excluindo : t.excluirConfirmar}
          </Botao>
        </div>
      </div>
    </div>
  );
}

export function SecaoPrivacidade({ visitante }: { visitante: boolean }) {
  const [estado, setEstado] = useState<EstadoPrivacidade | null>(null);
  const [verQuem, setVerQuem] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let vivo = true;
    cliente.privacidade().then((novo) => { if (vivo) setEstado(novo); }).catch(() => undefined);
    return () => { vivo = false; };
  }, []);

  async function mudarAceite(permitir: boolean) {
    if (!estado) return;
    setOcupado(true);
    setAviso('');
    try {
      const novo = permitir ? await gravarAceiteIa(estado.consentimentoIa.versao) : await cliente.revogarIa();
      setEstado(novo);
      setAviso(permitir ? t.permitido : t.revogado);
    } catch (falha) {
      setAviso(textoErro(falha instanceof Error && !('codigo' in falha) ? falha.message : codigoDoErro(falha)));
    } finally {
      setOcupado(false);
    }
  }

  const ia = estado?.consentimentoIa;
  return (
    <section className="perfil-secao" aria-labelledby="perfil-privacidade">
      <h2 id="perfil-privacidade" className="perfil-secao__titulo">{t.secaoTitulo}</h2>
      {ia && (
        <p className="folha-texto">
          {!ia.necessario ? t.iaSimulada : ia.aceitoEm ? t.iaPermitida(dataCurta(ia.aceitoEm)) : t.iaNaoPermitida}
        </p>
      )}
      {estado && ia?.necessario && verQuem && <ListaProvedores estado={estado} semPoliticaDoStudoo />}
      <div className="privacidade-acoes">
        {ia?.necessario && (
          <Botao variante="secundario" aria-expanded={verQuem} onClick={() => setVerQuem((v) => !v)}>{t.verQuem}</Botao>
        )}
        {ia?.necessario && (ia.aceitoEm
          ? <Botao variante="secundario" disabled={ocupado} onClick={() => void mudarAceite(false)}>{t.revogar}</Botao>
          : <Botao variante="secundario" disabled={ocupado} onClick={() => void mudarAceite(true)}>{t.permitirAgora}</Botao>)}
      </div>
      <p className="folha-status" role="status" aria-live="polite">{aviso}</p>
    </section>
  );
}

/**
 * "Excluir conta" (spec 16, item 20): o botão secundário de 44 px, com borda e texto #C23B4E (ação destrutiva de baixa ênfase), logo depois de "Sair" na seção "Conta" do Perfil. A folha
 * que pede a confirmação ("EXCLUIR") abre por cima. Antes era um texto vermelho solto no fim de "Privacidade e dados".
 */
export function BotaoExcluirConta({ visitante }: { visitante: boolean }) {
  const [excluindo, setExcluindo] = useState(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  function cancelar() {
    setExcluindo(false);
    window.requestAnimationFrame(() => gatilho.current?.focus());
  }
  return (
    <>
      <Botao ref={gatilho} variante="secundario" className="privacidade-excluir" onClick={() => setExcluindo(true)}>{t.excluir}</Botao>
      {excluindo && <FolhaExcluir visitante={visitante} aoCancelar={cancelar} />}
    </>
  );
}
