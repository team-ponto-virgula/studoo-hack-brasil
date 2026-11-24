/** Prévia complementar: habilita web em configuração efêmera sem mudar o app publicado. */
import { mkdtemp, writeFile, symlink, lstat, readlink, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const port = process.env.QA_APP_PORT || '8090';
if (!/^\d+$/.test(port)) throw new Error('QA_APP_PORT deve ser uma porta numérica.');
const app = fileURLToPath(new URL('../../apps/mobile/', import.meta.url));
for (const name of ['app.config.js', 'app.config.ts']) {
  if (await lstat(join(app, name)).catch(() => null)) throw new Error(`Há ${name} local; preserve-o e encerre a outra prévia antes de iniciar esta.`);
}
const temporary = await mkdtemp(join(tmpdir(), 'studoo-previa-'));
const configuration = join(temporary, 'app.config.cjs');
const link = join(app, 'app.config.js');
await writeFile(configuration, "module.exports=({config})=>({...config,platforms:[...new Set([...(config.platforms??[]),'web'])]});\n");
await symlink(configuration, link);
const cli = join(dirname(require.resolve('expo/package.json', {
  paths: [app]
})), 'bin/cli');
const child = spawn(process.execPath, [cli, 'start', '--web', '--port', port, '--host', 'localhost'], {
  cwd: app,
  stdio: 'inherit',
  env: {
    ...process.env,
    EXPO_NO_WEB_SETUP: '1'
  }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
async function cleanup() {
  if ((await readlink(link).catch(() => null)) === configuration) await unlink(link);
  await rm(temporary, {
    recursive: true,
    force: true
  });
}
child.once('error', async error => {
  await cleanup();
  console.error(error.message);
  process.exitCode = 1;
});
child.once('exit', async code => {
  await cleanup();
  process.exitCode = code ?? 0;
});
