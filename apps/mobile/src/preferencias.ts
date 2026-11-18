import * as SecureStore from 'expo-secure-store';

/*
 * Preferências do aparelho que não são da conta, como a apresentação já vista (a web guarda o mesmo no navegador).
 * Ficam no SecureStore, que o app já usa para a sessão; se o armazenamento falhar, valem só enquanto o app está aberto.
 */

const chaveApresentacao = 'studoo.apresentacao';
let apresentacaoVistaNaMemoria = false;

export async function apresentacaoVista() {
  if (apresentacaoVistaNaMemoria) return true;
  try {
    return (await SecureStore.getItemAsync(chaveApresentacao)) === 'vista';
  } catch {
    return false;
  }
}

export async function marcarApresentacaoVista() {
  apresentacaoVistaNaMemoria = true;
  try {
    await SecureStore.setItemAsync(chaveApresentacao, 'vista');
  } catch {
    // Sem armazenamento, a apresentação volta a aparecer na próxima abertura do app; nada mais depende disso.
  }
}

/*
 * Se a conta tinha trilhas na última vez (como `studoo.tinhaTrilhas` da web: "1" ou "0", apagada ao sair). O esqueleto da
 * primeira carga só mostra as abas quando sabe que havia trilhas; sem essa informação, fica sem abas.
 */
const chaveTinhaTrilhas = 'studoo.tinhaTrilhas';
let tinhaTrilhasNaMemoria: boolean | null = null;

export async function lerTinhaTrilhas() {
  if (tinhaTrilhasNaMemoria !== null) return tinhaTrilhasNaMemoria;
  try {
    tinhaTrilhasNaMemoria = (await SecureStore.getItemAsync(chaveTinhaTrilhas)) === '1';
  } catch {
    tinhaTrilhasNaMemoria = false;
  }
  return tinhaTrilhasNaMemoria;
}

export async function guardarTinhaTrilhas(tem: boolean) {
  if (tinhaTrilhasNaMemoria === tem) return;
  tinhaTrilhasNaMemoria = tem;
  try {
    await SecureStore.setItemAsync(chaveTinhaTrilhas, tem ? '1' : '0');
  } catch {
    // Sem armazenamento, o esqueleto da próxima abertura fica sem abas; nada mais depende disso.
  }
}

export async function apagarTinhaTrilhas() {
  tinhaTrilhasNaMemoria = null;
  try {
    await SecureStore.deleteItemAsync(chaveTinhaTrilhas);
  } catch {
    // Idem: sem armazenamento, não há o que apagar.
  }
}
