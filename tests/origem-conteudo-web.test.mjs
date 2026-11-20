import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { origemDoConteudo, ORIGEM_GERADA } from '../src/dominio/aprendizado/plano.ts';

test('a leitura de planos antigos remove o provedor e mantém a referência ao próprio material', () => {
  for (const origem of ['IA da DeepSeek (deepseek-flash)', 'IA da OpenAI (gpt-4.1)', 'gpt-4o']) {
    assert.equal(origemDoConteudo(origem), ORIGEM_GERADA);
  }
  for (const origem of ['Página 2 do seu material', 'Modo demonstração: oratória']) {
    assert.equal(origemDoConteudo(origem), origem);
  }
});

test('lição, proposta, prévias, perfis e imagens públicas omitem créditos técnicos', () => {
  const telas = ['aula.tsx', 'previa-trilha.tsx', 'compartilhar.tsx', 'p/[id]/page.tsx', 't/[codigo]/page.tsx'];
  const arquivos = telas.map(nome => 'src/app/' + nome);
  for (const item of readdirSync('src/servidor/og', { withFileTypes: true })) {
    if (item.isFile()) arquivos.push('src/servidor/og/' + item.name);
  }
  for (const nome of arquivos) {
    const fonte = readFileSync(nome, 'utf8');
    assert.doesNotMatch(fonte, /origemLegivel|DeepSeek|OpenAI|gpt-[\w.-]+/i, nome);
  }
});
