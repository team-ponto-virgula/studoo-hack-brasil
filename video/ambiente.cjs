'use strict';
/*
 * As ferramentas que o filme usa e onde elas estão. Cada valor vem, nesta ordem, de uma variável de ambiente, do arquivo
 * ambiente.local.json (ao lado deste, fora do git) ou do padrão: os comandos `node` e `ffmpeg` do sistema, o navegador
 * que o Playwright e o Remotion baixarem, e o repositório do Studoo uma pasta acima.
 *
 *   node ambiente.cjs        mostra os valores em uso
 *   node ambiente.cjs --sh   imprime as atribuições para um script de shell (eval "$(node ambiente.cjs --sh)")
 */
const fs = require('fs');
const path = require('path');

let local = {};
try { local = JSON.parse(fs.readFileSync(path.join(__dirname, 'ambiente.local.json'), 'utf8')); } catch { /* sem arquivo local */ }
const valor = (nome, padrao) => process.env[nome] || local[nome] || padrao;

const ambiente = {
  /** A raiz do repositório do Studoo (o código de som do app e o banco local vêm de lá). */
  REPO: path.resolve(valor('STUDOO_REPO', path.join(__dirname, '..'))),
  NODE: valor('STUDOO_NODE', process.execPath),
  FFMPEG: valor('STUDOO_FFMPEG', 'ffmpeg'),
  /** Executável do Chrome sem janela. Vazio: o que o Playwright e o Remotion instalarem. */
  CHROME: valor('STUDOO_CHROME', ''),
  /** Pasta com bibliotecas do sistema que o Chrome precise e a máquina não tenha (vai para LD_LIBRARY_PATH). */
  CHROME_LIBS: valor('STUDOO_CHROME_LIBS', ''),
  /** O módulo do Playwright (um nome de pacote ou o caminho de uma instalação). */
  PLAYWRIGHT: valor('STUDOO_PLAYWRIGHT', 'playwright'),
  /** Onde o site e a prévia web do app estão rodando na hora de gravar. */
  WEB: valor('STUDOO_WEB', 'http://localhost:3100'),
  APP: valor('STUDOO_APP', 'http://localhost:8097'),
};
/** O ambiente dos processos do Chrome: acrescenta a pasta de bibliotecas, se houver. */
ambiente.envDoChrome = () => (ambiente.CHROME_LIBS
  ? { ...process.env, LD_LIBRARY_PATH: [ambiente.CHROME_LIBS, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') }
  : { ...process.env });

module.exports = ambiente;

if (require.main === module) {
  const nomes = ['REPO', 'NODE', 'FFMPEG', 'CHROME', 'CHROME_LIBS', 'PLAYWRIGHT', 'WEB', 'APP'];
  if (process.argv.includes('--sh')) for (const nome of nomes) console.log(`STUDOO_${nome}='${String(ambiente[nome]).replace(/'/g, "'\\''")}'`);
  else for (const nome of nomes) console.log(`${nome.padEnd(12)} ${ambiente[nome] || '(padrão)'}`);
}
