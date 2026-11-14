import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useMovimentoReduzido } from './interface';

/*
 * Animações do app, iguais às da web em intenção: aparecer com um pulinho, tremer no erro, pular na comemoração e contar
 * números. Com movimento reduzido, tudo começa (e fica) no estado final, com a mesma informação.
 */

/** Valor de 0 a 1 que anima uma vez ao montar, depois de `atraso`. Com `mola`, passa um pouco do ponto e volta. */
export function useAparecer(atraso = 0, duracao = 360, mola = false) {
  const reduzir = useMovimentoReduzido();
  const [valor] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduzir === null) return;
    if (reduzir) {
      valor.setValue(1);
      return;
    }
    const animacao = Animated.timing(valor, {
      toValue: 1, duration: duracao, delay: atraso, easing: mola ? Easing.out(Easing.back(1.7)) : Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animacao.start();
    return () => animacao.stop();
  }, [reduzir, valor, atraso, duracao, mola]);

  return valor;
}

/** Estilo de entrada pronto: aparece subindo (ou caindo, com `deslocamento` negativo) e crescendo um pouco. */
export function estiloDeEntrada(valor: Animated.Value, deslocamento = 10, escala = 0.96) {
  return {
    opacity: valor.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateY: valor.interpolate({ inputRange: [0, 1], outputRange: [deslocamento, 0] }) },
      { scale: valor.interpolate({ inputRange: [0, 1], outputRange: [escala, 1] }) },
    ],
  };
}

/** Tremor horizontal, como o da web no erro: roda de novo a cada mudança de `gatilho` (que começa em 0, sem tremer). */
export function useTremor(gatilho: number) {
  const reduzir = useMovimentoReduzido();
  const [valor] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!gatilho || reduzir !== false) { valor.setValue(0); return; }
    const passo = (destino: number, duracao: number) =>
      Animated.timing(valor, { toValue: destino, duration: duracao, easing: Easing.linear, useNativeDriver: true });
    const sequencia = Animated.sequence([passo(-8, 50), passo(8, 70), passo(-8, 70), passo(6, 60), passo(-4, 50), passo(0, 40)]);
    sequencia.start();
    return () => { sequencia.stop(); valor.setValue(0); };
  }, [gatilho, reduzir, valor]);

  return valor;
}

/** Pulinho de escala (cresce e volta) a cada mudança de `gatilho`, como o ícone da área escolhida. */
export function usePulinho(gatilho: unknown, intensidade = 1.25) {
  const reduzir = useMovimentoReduzido();
  const [valor] = useState(() => new Animated.Value(1));
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    // Só pula quando o gatilho liga (escolher, acertar); desligar não pula.
    if (!gatilho || reduzir !== false) { valor.setValue(1); return; }
    const sequencia = Animated.sequence([
      Animated.timing(valor, { toValue: intensidade, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(valor, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
    ]);
    sequencia.start();
    return () => { sequencia.stop(); valor.setValue(1); };
  }, [gatilho, reduzir, valor, intensidade]);

  return valor;
}

/** Número que conta de zero até `alvo` em `duracao`; com movimento reduzido, já começa no alvo. */
export function useContagem(alvo: number, duracao = 900, atraso = 600) {
  const reduzir = useMovimentoReduzido();
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    if (reduzir === null) return;
    if (reduzir) {
      setAtual(alvo);
      return;
    }
    let quadro = 0;
    let comeco = 0;
    const espera = setTimeout(() => {
      function passo(agora: number) {
        if (!comeco) comeco = agora;
        const fracao = Math.min(1, (agora - comeco) / duracao);
        setAtual(Math.round(alvo * (1 - (1 - fracao) ** 3)));
        if (fracao < 1) quadro = requestAnimationFrame(passo);
      }
      quadro = requestAnimationFrame(passo);
    }, atraso);
    return () => {
      clearTimeout(espera);
      cancelAnimationFrame(quadro);
    };
  }, [alvo, duracao, atraso, reduzir]);

  return atual;
}

/** Laço contínuo de 0 a 1 (ida e volta), compartilhável por vários elementos, como as árvores que balançam. */
export function useVaiVem(duracao: number, ativo = true) {
  const reduzir = useMovimentoReduzido();
  const [valor] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    if (!ativo || reduzir !== false) {
      valor.setValue(0.5);
      return;
    }
    const movimento = { duration: duracao, easing: Easing.inOut(Easing.sin), isInteraction: false, useNativeDriver: true };
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(valor, { ...movimento, toValue: 1 }),
      Animated.timing(valor, { ...movimento, toValue: 0 }),
    ]));
    ciclo.start();
    return () => {
      ciclo.stop();
      valor.setValue(0.5);
    };
  }, [duracao, ativo, reduzir, valor]);

  return valor;
}
