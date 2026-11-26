import { chaveDaCriacaoPendente, comCriacaoPendente, lerCriacoesPendentes, semCriacaoPendente, textoDasCriacoesPendentes, type CriacaoPendente } from '@studoo/contratos';
import * as SecureStore from 'expo-secure-store';
import { FalhaMobile, origemConfigurada } from './api-nativa';

// A escrita que vem antes do POST e a saída da conta usam a mesma fila.
let fila: Promise<unknown> = Promise.resolve();

function emOrdem<T>(operacao: () => Promise<T>): Promise<T> {
  const feita = fila.then(operacao);
  fila = feita.catch(() => undefined);
  return feita;
}

const ambiente = () => origemConfigurada().host.replace(/[^a-z0-9._-]/gi, '_');
const chaveDaConta = () => `studoo.criacao.conta.${ambiente()}`;
const chaveDosPedidos = (conta: string) => `${chaveDaCriacaoPendente(conta)}.${ambiente()}`;
const opcaoDoCofre = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const contaValida = (conta: string) => /^[\w.-]+$/.test(conta);

async function ler(conta: string): Promise<CriacaoPendente[]> {
  return lerCriacoesPendentes(await SecureStore.getItemAsync(chaveDosPedidos(conta)));
}

function escrever(conta: string, pedidos: readonly CriacaoPendente[]) {
  const chave = chaveDosPedidos(conta);
  return pedidos.length
    ? SecureStore.setItemAsync(chave, textoDasCriacoesPendentes(pedidos), opcaoDoCofre)
    : SecureStore.deleteItemAsync(chave);
}

export function abrirCriacoesNoAparelho(conta: string): Promise<CriacaoPendente[]> {
  return emOrdem(async () => {
    if (!contaValida(conta)) throw new FalhaMobile('armazenamento');
    const chave = chaveDaConta();
    const anterior = await SecureStore.getItemAsync(chave);
    if (anterior !== conta) {
      if (anterior && contaValida(anterior)) await SecureStore.deleteItemAsync(chaveDosPedidos(anterior));
      await SecureStore.setItemAsync(chave, conta, opcaoDoCofre);
    }
    return ler(conta);
  });
}

/** Se o pedido já estava guardado, volta com ele para consulta. Só um toque ganha o direito ao primeiro POST. */
export function guardarCriacaoNoAparelho(conta: string, pedido: CriacaoPendente, reenvio = false) {
  return emOrdem(async () => {
    if (await SecureStore.getItemAsync(chaveDaConta()) !== conta) throw new FalhaMobile('armazenamento');
    const pedidos = await ler(conta);
    const anterior = pedidos.find(item => item.pedidoId === pedido.pedidoId);
    if (anterior && !reenvio) return { pedido: anterior, enviar: false };
    if (reenvio && !anterior) return { pedido, enviar: false };
    await escrever(conta, comCriacaoPendente(pedidos, pedido));
    return { pedido, enviar: true };
  });
}

export function esquecerCriacaoNoAparelho(conta: string, pedidoId: string) {
  return emOrdem(async () => {
    if (await SecureStore.getItemAsync(chaveDaConta()) !== conta) return;
    const pedidos = await ler(conta);
    await escrever(conta, semCriacaoPendente(pedidos, pedidoId));
  });
}

/** Logout ou troca de conta. Uma gravação atrasada da conta antiga perde a autorização de escrever. */
export function apagarCriacoesNoAparelho() {
  return emOrdem(async () => {
    const chave = chaveDaConta();
    const conta = await SecureStore.getItemAsync(chave);
    await SecureStore.deleteItemAsync(chave);
    if (conta && contaValida(conta)) await SecureStore.deleteItemAsync(chaveDosPedidos(conta));
  });
}
