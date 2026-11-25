import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { jornadaAzul as j } from '../packages/contratos/src/jornada-azul.ts';

const nomes = { textoSecundario: 'texto2', acaoEscura: 'acao-escura', sucessoClaro: 'sucesso-claro', bordaCampo: 'borda-campo' };
const hifenizar = (nome) => nomes[nome] ?? nome.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`);
const cores = Object.entries(j.cores).map(([nome, cor]) => `  --${hifenizar(nome)}: ${cor};`);
const medidas = [
  `  --raio-campo: ${j.raios.campo}px;`, `  --raio-bloco: ${j.raios.bloco}px;`,
  `  --jornada-pagina: ${j.espacos.pagina}px;`, `  --jornada-grupo: ${j.espacos.grupo}px;`,
  `  --jornada-acao: ${j.medidas.acao}px;`, `  --jornada-alvo: ${j.medidas.alvo}px;`,
  `  --jornada-degrau: ${j.medidas.degrau}px;`, `  --jornada-micro: ${j.motion.micro}ms;`,
];
const css = `/* Gerado por scripts/gerar-tokens-interface.mjs. Edite jornada-azul.ts. */\n:root {\n${[...cores, ...medidas].join('\n')}\n}\n`;
const destino = fileURLToPath(new URL('../src/ui/jornada-tokens.css', import.meta.url));
if (process.argv.includes('--check')) {
  if (await readFile(destino, 'utf8') !== css) {
    console.error('Tokens CSS divergiram da Jornada Azul compartilhada. Execute node scripts/gerar-tokens-interface.mjs.');
    process.exitCode = 1;
  } else console.log('Tokens web e mobile têm a mesma fonte.');
} else {
  await writeFile(destino, css);
  console.log('Tokens CSS da Jornada Azul gerados.');
}
