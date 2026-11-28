import { BackHandler } from 'react-native';

/**
 * O voltar do app, comum ao botão do Android e ao gesto de borda do iPhone (P17 da spec 07).
 *
 * Cada tela registra aqui a mesma função que antes ia direto ao `BackHandler`. O Android continua chamando essa função
 * pelo `BackHandler`, como sempre. No iPhone, o gesto da borda esquerda (`borda-voltar.ios.tsx`) chama a mesma lista na
 * mesma ordem do Android: a mais recente primeiro, até uma tratar (devolver `true`).
 */
type Ouvinte = () => boolean;
type Registro = { ouvinte: Ouvinte; gesto: boolean };

const registros: Registro[] = [];
const avisos = new Set<() => void>();
let travas = 0;

function avisar() {
  for (const aviso of avisos) aviso();
}

/**
 * Registra o voltar de uma tela. `gesto` diz se o gesto do iPhone começa enquanto esta tela está aberta: falso onde não há
 * para onde voltar (Minhas trilhas), e então o arrasto não faz nada; o Android, nesse caso, segue fechando o app.
 */
export function ouvirVoltar(ouvinte: Ouvinte, gesto = true): { remove: () => void } {
  const assinatura = BackHandler.addEventListener('hardwareBackPress', ouvinte);
  const registro: Registro = { ouvinte, gesto };
  registros.push(registro);
  avisar();
  return {
    remove() {
      assinatura.remove();
      const indice = registros.indexOf(registro);
      if (indice < 0) return;
      registros.splice(indice, 1);
      avisar();
    },
  };
}

/** O gesto do iPhone: chama os voltares do mais recente ao mais antigo até um tratar. Sem nenhum que trate, nada acontece. */
export function voltarPeloGesto(): boolean {
  for (let indice = registros.length - 1; indice >= 0; indice -= 1) {
    if (registros[indice].ouvinte()) return true;
  }
  return false;
}

/**
 * Desliga o gesto enquanto uma tela tem conteúdo que se arrasta na horizontal desde a borda (o carrossel da apresentação):
 * o arrasto fica com ele. Devolve a função que solta a trava (serve de limpeza de `useEffect`).
 */
export function travarGesto(): () => void {
  travas += 1;
  avisar();
  let solta = false;
  return () => {
    if (solta) return;
    solta = true;
    travas -= 1;
    avisar();
  };
}

/** Se o gesto pode começar agora: alguma tela com para onde voltar e nenhuma trava. */
export function gestoLigado(): boolean {
  return travas === 0 && registros.some((registro) => registro.gesto);
}

export function assinarGesto(aviso: () => void): () => void {
  avisos.add(aviso);
  return () => {
    avisos.delete(aviso);
  };
}
