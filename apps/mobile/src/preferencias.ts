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
