import type { PlanoDetalhe } from '@studoo/contratos';
import { mensagens } from './mensagens';

/*
 * Regras da trilha, iguais às da web (src/app/estudo.tsx, src/app/geracao-ao-vivo.ts e src/ui/caminho.tsx).
 * Ficam aqui, sem nada de tela, para comparar as duas versões com facilidade.
 */

export type EstadoNo = 'concluida' | 'atual' | 'bloqueada' | 'previa';
/** Lição no caminho; `trecho` é a posição do fluxo e só serve para desenhar o marco entre um trecho e outro. */
export type NoCaminho = { id: string; titulo: string; estado: EstadoNo; trecho: number; ponte?: { concluida: boolean } };
export type NomeIcone = 'check' | 'livro' | 'revisao' | 'cadeado' | 'bandeira' | 'trofeu' | 'fechar' | 'olho' | 'olhoFechado' | 'seta'
  | 'lampada' | 'relogio' | 'alvo';

/**
 * Próxima lição do caminho: a do primeiro trecho que ainda tem lição pendente.
 * Como cada trecho aponta a sua primeira lição não concluída, é a primeira pendente na ordem da trilha.
 */
export function proximaDoCaminho(plano: PlanoDetalhe) {
  return plano.fluxos.find((fluxo) => fluxo.proximaLicaoId)?.proximaLicaoId ?? null;
}

/** Lição que a conclusão liberou no caminho, para o nó animar quando a pessoa volta à trilha. */
export function liberadasEntre(antes: PlanoDetalhe, depois: PlanoDetalhe) {
  const proxima = proximaDoCaminho(depois);
  return proxima && proxima !== proximaDoCaminho(antes) ? [proxima] : [];
}

/**
 * Achata os trechos num caminho único, na ordem da trilha. Só a próxima lição fica disponível (atual);
 * as pendentes depois dela ficam bloqueadas e as concluídas podem ser refeitas.
 */
export function montarTrilha(plano: PlanoDetalhe) {
  const atual = proximaDoCaminho(plano);
  const nos = plano.fluxos.flatMap((fluxo, trecho) => fluxo.licoes.map((licao): NoCaminho => {
    let estado: EstadoNo = 'bloqueada';
    if (licao.concluida) estado = 'concluida';
    else if (licao.id === atual) estado = 'atual';
    return { id: licao.id, titulo: licao.titulo, estado, trecho, ponte: licao.ponte };
  }));
  const indice = nos.findIndex((no) => no.estado === 'atual');
  const proximo = indice >= 0 ? { no: nos[indice], posicao: posicaoDoNo(indice, nos.length) } : null;
  return { nos, proximo };
}

/** Frase curta do Stu no começo do caminho, conforme o progresso. */
export function falaDoStu(nos: readonly NoCaminho[]) {
  if (!nos.some((no) => no.estado === 'atual')) return mensagens.trilha.stuFim;
  if (!nos.some((no) => no.estado === 'concluida')) return mensagens.trilha.stuInicio;
  return mensagens.trilha.stuMeio;
}

/** O que falta para liberar um nó: as lições pendentes antes dele, a começar pela atual. */
export function explicar(nos: readonly NoCaminho[], indice: number) {
  if (nos[indice].estado === 'concluida') return mensagens.trilha.concluidaTexto;
  const pendentes = nos.slice(0, indice).filter((anterior) => anterior.estado !== 'concluida');
  const comeco = pendentes.find((anterior) => anterior.estado === 'atual') ?? pendentes[0];
  if (!comeco) return mensagens.trilha.bloqueadaSemPasso;
  return pendentes.length === 1
    ? mensagens.trilha.bloqueadaUma(comeco.titulo)
    : mensagens.trilha.bloqueadaVarias(pendentes.length, comeco.titulo);
}

/**
 * Ícone do nó: concluída mostra o visto e bloqueada o cadeado; a atual e a prévia mostram o tipo da lição.
 * O contrato ainda não tem o tipo da lição, então a revisão é reconhecida pelo título ("Revisão…").
 */
export function iconeDoNo(no: NoCaminho): NomeIcone {
  if (no.estado === 'concluida') return 'check';
  if (no.estado === 'bloqueada') return 'cadeado';
  return no.titulo.trim().toLocaleLowerCase('pt-BR').startsWith('revis') ? 'revisao' : 'livro';
}

/**
 * Posição do nó no caminho. Enquanto a trilha ainda está sendo montada, o total muda a cada lição que chega,
 * então a posição mostra só o número ("Lição 3"); com a trilha completa, mostra também o total ("Lição 3 de 9").
 */
/**
 * Posição horizontal do nó, em % da largura do caminho: a mesma serpentina da web (src/ui/caminho.tsx), deslocada meio
 * passo para nenhum nó ficar exatamente no centro.
 */
export function posicaoX(indice: number) {
  return Math.round((50 + 23 * Math.sin(((indice + 0.5) * Math.PI) / 4)) * 10) / 10;
}

export function posicaoDoNo(indice: number, total: number, montando = false) {
  return montando ? mensagens.trilha.posicaoParcial(indice + 1) : mensagens.trilha.posicao(indice + 1, total);
}

/** Nome que o leitor de tela lê no nó: título, posição e estado; o atual começa pela ação. */
export function nomeDoNo(no: NoCaminho, posicao: string) {
  if (no.estado === 'atual') return mensagens.trilha.nomeNoAtual(no.titulo, posicao);
  return mensagens.trilha.nomeNo(no.titulo, posicao, mensagens.trilha.estados[no.estado].toLocaleLowerCase('pt-BR'));
}

/** O pedido aparece sob o título só quando acrescenta algo: num objetivo curto, o título pode ser o próprio pedido. */
export function repeteTitulo(titulo: string | null, objetivo: string) {
  const comparavel = (texto: string) => texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  return titulo !== null && comparavel(titulo) === comparavel(objetivo);
}
