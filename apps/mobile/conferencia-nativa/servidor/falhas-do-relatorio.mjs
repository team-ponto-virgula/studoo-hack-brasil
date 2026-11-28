// Lê o relatório JUnit do Maestro e escreve uma linha por fluxo que falhou, com o motivo, para o sumário da execução.
// Uso: node falhas-do-relatorio.mjs relatorio.xml
import { readFileSync } from 'node:fs';

const desescapar = (texto) => texto
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#10;/g, ' ').replace(/&amp;/g, '&');

const xml = readFileSync(process.argv[2], 'utf8');
for (const [, atributos, corpo] of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
  const falha = corpo?.match(/<(?:failure|error)\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:failure|error)>)/);
  if (!falha) continue;
  const nome = atributos.match(/\bname="([^"]*)"/)?.[1] ?? 'fluxo sem nome';
  const motivo = (falha[1] ?? falha[0].match(/\bmessage="([^"]*)"/)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/\s+/g, ' ').trim();
  console.log(`- \`${desescapar(nome)}\`: ${desescapar(motivo).slice(0, 300) || 'sem motivo no relatório'}`);
}
