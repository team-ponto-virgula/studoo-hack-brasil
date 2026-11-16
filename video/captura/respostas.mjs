// Gera captura/respostas.json: para cada trilha pronta, o que tocar ou escrever em cada exercício (certo e errado).
// Uso (a partir do repositório, para o tsx resolver):  node --import tsx video/captura/respostas.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import ambiente from '../ambiente.cjs';

const { DEMOS } = await import(path.join(ambiente.REPO, 'src/servidor/ia/demos.ts'));
const { respostaCerta, respostaErrada } = await import(path.join(ambiente.REPO, 'src/dominio/aprendizado/plano.ts'));
const texto = (lista, id) => lista.find((item) => item.id === id)?.texto ?? null;
function exercicio(ex) {
  const base = { tipo: ex.tipo, enunciado: ex.enunciado, api: respostaCerta(ex), apiErrada: respostaErrada(ex), ...(ex.fala ? { fala: ex.fala.texto } : {}) };
  switch (ex.tipo) {
    case 'multipla_escolha': return { ...base, certa: texto(ex.opcoes, ex.gabarito[0]), erradas: ex.opcoes.filter(({ id }) => id !== ex.gabarito[0]).map(({ texto: t }) => t) };
    case 'lacuna': return { ...base, certa: ex.gabarito[0], trecho: ex.trecho ?? null };
    case 'ordenar': return { ...base, ordem: ex.gabarito.map((id) => texto(ex.itens, id)) };
    case 'associar': return { ...base, pares: ex.gabarito.map((par) => { const [e, d] = par.split('='); return [texto(ex.esquerda, e), texto(ex.direita, d)]; }) };
    case 'verdadeiro_falso': return { ...base, valor: ex.gabarito[0], justificativa: texto(ex.justificativas, ex.gabarito[1]) };
    case 'aberta': return { ...base, modelo: ex.modelo ?? null, criterios: ex.criterios ?? null };
    default: return base;
  }
}
const saida = {};
for (const demo of DEMOS) {
  saida[demo.chave] = {
    titulo: demo.plano.titulo,
    licoes: demo.plano.fluxos.flatMap((fluxo, f) => fluxo.licoes.map((licao, l) => ({
      fluxo: f, licao: l, titulo: licao.titulo, recurso: licao.recurso?.tipo ?? null, falas: licao.falas?.length ?? 0, passos: licao.passos?.length ?? 0,
      pratica: licao.pratica ? { minutos: licao.pratica.minutos, som: Boolean(licao.pratica.som) } : null,
      exemploTipo: licao.exemploTipo ?? 'exemplo',
      exercicios: [licao.exercicio, ...(licao.extras ?? [])].map(exercicio),
    }))),
  };
}
writeFileSync(path.join(import.meta.dirname, 'respostas.json'), JSON.stringify(saida, null, 1));
for (const [chave, demo] of Object.entries(saida)) {
  console.log(`\n== ${chave}: ${demo.titulo}`);
  for (const l of demo.licoes) console.log(`  ${l.fluxo}.${l.licao} ${l.titulo} | recurso ${l.recurso ?? '-'} | falas ${l.falas} | prática ${l.pratica ? l.pratica.minutos + 'min' + (l.pratica.som ? '+som' : '') : '-'} | ${l.exemploTipo} | ${l.exercicios.map((e) => e.tipo + (e.fala ? '(ouvir)' : '')).join(', ')}`);
}
