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

/*
 * O aviso de privacidade da voz ao vivo já visto (como `studoo.vozAoVivo.avisoVisto` da web: "1"). O toque em "Conversar
 * com o Stu" decide na hora, sem esperar o armazenamento, para a conversa nascer dentro do toque (áudio e microfone do
 * navegador); por isso a leitura é feita antes, quando a opção aparece, e fica na memória.
 */
const chaveAvisoVoz = 'studoo.vozAoVivo.avisoVisto';
let avisoVozVistoNaMemoria: boolean | null = null;

export async function lerAvisoVozVisto() {
  if (avisoVozVistoNaMemoria !== null) return avisoVozVistoNaMemoria;
  try {
    avisoVozVistoNaMemoria = (await SecureStore.getItemAsync(chaveAvisoVoz)) === '1';
  } catch {
    avisoVozVistoNaMemoria = false;
  }
  return avisoVozVistoNaMemoria;
}

/** O que já se sabe agora, sem esperar: sem leitura feita, conta como não visto (o aviso aparece). */
export function avisoVozVistoAgora() {
  return avisoVozVistoNaMemoria === true;
}

export async function marcarAvisoVozVisto() {
  avisoVozVistoNaMemoria = true;
  try {
    await SecureStore.setItemAsync(chaveAvisoVoz, '1');
  } catch {
    // Sem armazenamento, o aviso volta a aparecer na próxima abertura do app; nada mais depende disso.
  }
}

/**
 * Se a pessoa já viu o aviso que explica a curtida (spec 10, revisão de 19/11: o aviso só na primeira curtida naquele
 * aparelho; `studoo.gestoExplicado` no localStorage da web, no SecureStore do app).
 */
const chaveGestoExplicado = 'studoo.gestoExplicado';
let gestoExplicadoNaMemoria = false;

export async function gestoJaExplicado() {
  if (gestoExplicadoNaMemoria) return true;
  try {
    gestoExplicadoNaMemoria = (await SecureStore.getItemAsync(chaveGestoExplicado)) === '1';
  } catch {
    // Sem o armazenamento, vale o que ficou na memória.
  }
  return gestoExplicadoNaMemoria;
}

export async function marcarGestoExplicado() {
  gestoExplicadoNaMemoria = true;
  try {
    await SecureStore.setItemAsync(chaveGestoExplicado, '1');
  } catch {
    // Sem o armazenamento, vale só enquanto o app está aberto.
  }
}

/**
 * A conta foi excluída: some o que este aparelho guardava dela (a marca de trilhas, o aviso da voz e o da curtida já
 * vistos). A apresentação e o som são do aparelho e ficam.
 */
export async function apagarPreferenciasDaConta() {
  tinhaTrilhasNaMemoria = null;
  avisoVozVistoNaMemoria = null;
  gestoExplicadoNaMemoria = false;
  await Promise.all([chaveTinhaTrilhas, chaveAvisoVoz, chaveGestoExplicado].map((chave) => SecureStore.deleteItemAsync(chave).catch(() => undefined)));
}
