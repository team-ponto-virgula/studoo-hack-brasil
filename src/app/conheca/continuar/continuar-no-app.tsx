'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ErroStudoo } from '@studoo/contratos';
import { textoErro } from '@/mensagens/pt-BR';
import { lerContinuacao } from '../continuacao';
import { prepararEntrada } from '../ilhas/visitante';

/** A sessão e o rascunho são abertos no domínio do app, que pode ler o cookie e o armazenamento do estudante. */
export function ContinuarNoApp({ ativo, comSessao }: { ativo: boolean; comSessao: boolean }) {
  const entrada = useRef<ReturnType<typeof lerContinuacao>>(null);
  const iniciada = useRef(false);
  const enviando = useRef(false);
  const [erro, setErro] = useState('');
  const continuar = useCallback(async () => {
    if (enviando.current || !entrada.current) return;
    enviando.current = true;
    setErro('');
    try {
      const destino = await prepararEntrada(ativo, comSessao, entrada.current.ideia);
      window.location.replace(destino);
    } catch (falha) {
      enviando.current = false;
      setErro(textoErro(falha instanceof ErroStudoo ? falha.codigo : 'rede'));
    }
  }, [ativo, comSessao]);
  useEffect(() => {
    if (iniciada.current) return;
    iniciada.current = true;
    entrada.current = lerContinuacao(window.location.hash);
    if (!entrada.current) {
      window.location.replace(comSessao ? '/' : '/login');
      return;
    }
    window.history.replaceState(window.history.state, '', window.location.pathname);
    void continuar();
  }, [comSessao, continuar]);

  return (
    <main className="cn-continuar">
      <img src="/marca/logo-com-sorriso.svg" alt="Studoo" width="144" height="48" />
      {erro ? <>
        <p role="alert">{erro}</p>
        <button className="botao botao--primario" onClick={continuar}>Tentar novamente</button>
        <a href="/login">Entrar com uma conta</a>
      </> : <p role="status">Abrindo o Studoo…</p>}
      <noscript><a href="/login">Ir para o app</a></noscript>
    </main>
  );
}
