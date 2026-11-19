import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CATALOGO_EFEITOS, CATALOGO_FUNDOS, OPCOES_FUNDO_UI } from '../packages/contratos/src/catalogo-sons.ts';
import { MaquinaEstadoSom } from '../packages/contratos/src/som-estado.ts';

const RAIZ = path.resolve(import.meta.dirname, '..');
const WEB_SFX = path.join(RAIZ, 'public/sons/sfx');
const WEB_FUNDOS = path.join(RAIZ, 'public/sons/fundos');
const MOB_SFX = path.join(RAIZ, 'apps/mobile/assets/sons/sfx');
const MOB_FUNDOS = path.join(RAIZ, 'apps/mobile/assets/sons/fundos');

test('Catálogo e arquivos batem nas duas plataformas (sem sobras nem faltas, bytes idênticos)', () => {
  const sfxEsperados = Object.values(CATALOGO_EFEITOS).map((e) => e.arquivo).sort();
  const fundosEsperados = CATALOGO_FUNDOS.map((f) => f.arquivo).sort();

  assert.deepEqual(fs.readdirSync(WEB_SFX).sort(), sfxEsperados);
  assert.deepEqual(fs.readdirSync(MOB_SFX).sort(), sfxEsperados);
  assert.deepEqual(fs.readdirSync(WEB_FUNDOS).sort(), fundosEsperados);
  assert.deepEqual(fs.readdirSync(MOB_FUNDOS).sort(), fundosEsperados);

  for (const arq of sfxEsperados) {
    const a = fs.readFileSync(path.join(WEB_SFX, arq));
    const b = fs.readFileSync(path.join(MOB_SFX, arq));
    assert.equal(Buffer.compare(a, b), 0, `SFX ${arq} difere entre web e mobile`);
  }

  for (const arq of fundosEsperados) {
    const a = fs.readFileSync(path.join(WEB_FUNDOS, arq));
    const b = fs.readFileSync(path.join(MOB_FUNDOS, arq));
    assert.equal(Buffer.compare(a, b), 0, `Fundo ${arq} difere entre web e mobile`);
    assert.ok(a.length <= 1024 * 1024, `Fundo ${arq} excede 1 MB (${a.length} bytes)`);
  }

  assert.equal(OPCOES_FUNDO_UI[0].id, 'mudo');
  assert.equal(OPCOES_FUNDO_UI.length, 6);
});

test('Mesmos IDs de SFX e fundos declarados no mobile (FONTES_SFX e FONTES_FUNDOS) e na web', () => {
  const mobSrc = fs.readFileSync(path.join(RAIZ, 'apps/mobile/src/sons.ts'), 'utf8');
  const webSrc = fs.readFileSync(path.join(RAIZ, 'src/app/sons.ts'), 'utf8');

  for (const [id, def] of Object.entries(CATALOGO_EFEITOS)) {
    assert.match(mobSrc, new RegExp(`\\b${id}:\\s*require\\(['"]\\.\\./assets/sons/sfx/${def.arquivo}['"]\\)`), `Falta ${id} em FONTES_SFX`);
  }
  for (const def of CATALOGO_FUNDOS) {
    assert.match(mobSrc, new RegExp(`\\b${def.id}:\\s*require\\(['"]\\.\\./assets/sons/fundos/${def.arquivo}['"]\\)`), `Falta ${def.id} em FONTES_FUNDOS`);
    assert.match(webSrc, new RegExp(`'${def.id}'`), `Falta ${def.id} em src/app/sons.ts`);
  }
});

test('Todos os WAVs são PCM 16-bit mono em 44.100 Hz com início em até 5 ms', () => {
  for (const def of Object.values(CATALOGO_EFEITOS)) {
    const buf = fs.readFileSync(path.join(WEB_SFX, def.arquivo));
    assert.equal(buf.toString('ascii', 0, 4), 'RIFF', `${def.arquivo}: cabeçalho RIFF inválido`);
    assert.equal(buf.toString('ascii', 8, 12), 'WAVE', `${def.arquivo}: cabeçalho WAVE inválido`);
    assert.equal(buf.readUInt16LE(20), 1, `${def.arquivo}: não é PCM`);
    assert.equal(buf.readUInt16LE(22), 1, `${def.arquivo}: não é mono`);
    assert.equal(buf.readUInt32LE(24), 44100, `${def.arquivo}: taxa não é 44100 Hz`);
    assert.equal(buf.readUInt16LE(34), 16, `${def.arquivo}: não é 16 bits`);

    // Mede início real (> -40 dBFS => |sample| >= 328)
    let primeiroIndice = -1;
    for (let off = 44; off + 1 < buf.length; off += 2) {
      if (Math.abs(buf.readInt16LE(off)) >= 328) {
        primeiroIndice = (off - 44) / 2;
        break;
      }
    }
    assert.ok(primeiroIndice >= 0, `${def.arquivo}: sem sinal acima de -40 dBFS`);
    const inicioMs = (primeiroIndice / 44100) * 1000;
    assert.ok(inicioMs <= 5, `${def.arquivo}: início em ${inicioMs.toFixed(2)} ms (> 5 ms)`);
  }
});

test('Nenhum arquivo de servidor importa o toca-sons da web', () => {
  const pastasServidor = [path.join(RAIZ, 'src/servidor'), path.join(RAIZ, 'src/app/api')];
  const arquivos = [];
  function coletar(dir) {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, item.name);
      if (item.isDirectory()) coletar(p);
      else if (/\.(ts|tsx|js|mjs)$/.test(item.name)) arquivos.push(p);
    }
  }
  pastasServidor.forEach(coletar);
  for (const arq of arquivos) {
    const conteudo = fs.readFileSync(arq, 'utf8');
    assert.doesNotMatch(conteudo, /from\s+['"][^'"]*\/sons['"]/, `${arq} não pode importar o toca-sons da web`);
  }
});

test('MaquinaEstadoSom: posse do modo de áudio, bloqueio de SFX em gravação/voz e convivência do fundo', () => {
  const m = new MaquinaEstadoSom();
  m.definirFundo('foco_calmo');
  assert.equal(m.podeConfigurarModoAgora(), true);
  assert.equal(m.estadoFundo(), 'tocando');
  assert.equal(m.podeTocarEfeito('acerto'), true);

  // Gravação / voz ao vivo: nunca muda o modo, para o fundo e só permite os 2 bipes.
  m.entrarEmGravacaoOuVoz();
  assert.equal(m.podeConfigurarModoAgora(), false);
  assert.equal(m.estadoFundo(), 'parado');
  assert.equal(m.podeTocarEfeito('acerto'), false);
  assert.equal(m.podeTocarEfeito('toque_opcao'), false);
  assert.equal(m.podeTocarEfeito('gravacao_inicio'), true);
  assert.equal(m.podeTocarEfeito('gravacao_fim'), true);

  // Ao sair, devolve a posse para reaplicar o modo normal.
  assert.equal(m.sairDeGravacaoOuVoz(), true);
  assert.equal(m.podeConfigurarModoAgora(), true);
  assert.equal(m.estadoFundo(), 'tocando');

  // Fala / áudio de lição: atenua o fundo e cede a posse do modo até sairDeFala().
  m.entrarEmFala();
  assert.equal(m.podeConfigurarModoAgora(), false);
  assert.equal(m.estadoFundo(), 'atenuado');
  assert.equal(m.sairDeFala(), true);
  assert.equal(m.podeConfigurarModoAgora(), true);
  assert.equal(m.estadoFundo(), 'tocando');

  // Segundo plano para o fundo.
  m.definirSegundoPlano(true);
  assert.equal(m.estadoFundo(), 'parado');
  assert.equal(m.motivoPausa(true), 'segundo_plano');
  m.definirSegundoPlano(false);
  assert.equal(m.estadoFundo(), 'tocando');

  // Área não permitida (entrada, recuperação, /t, /p, logout) para o fundo.
  m.definirAreaPermitida(false);
  assert.equal(m.estadoFundo(), 'parado');
  assert.equal(m.motivoPausa(true), 'fora_do_app');
  m.definirAreaPermitida(true);
  assert.equal(m.motivoPausa(false), 'sem_gesto');
  assert.equal(m.motivoPausa(true), 'nenhum');
});

test('Spec 12: descrições curtas em OPCOES_FUNDO_UI e regra de não enfileirar antes do gesto na web', () => {
  const descricoes = Object.fromEntries(OPCOES_FUNDO_UI.map((o) => [o.id, o.descricao]));
  assert.deepEqual(descricoes, {
    mudo: 'Sem som de fundo',
    foco_calmo: 'Acordes suaves e quentes',
    chuva_suave: 'Chuva leve na janela',
    lofi_estudo: 'Batida lenta, sem melodia',
    biblioteca: 'Ambiente quieto, bom para ler',
    brisa_natural: 'Vento suave entre as folhas',
  });

  const webSrc = fs.readFileSync(path.join(RAIZ, 'src/app/sons.ts'), 'utf8');
  assert.match(webSrc, /if\s*\(!this\.desbloqueado\)\s*return;/);
  assert.match(webSrc, /preCarregarEssenciais\(\)/);
});
