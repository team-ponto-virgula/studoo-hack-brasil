import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

// Segurança da comunidade no app (spec 14, parte de bloqueio e denúncia): onde as ações entram e com quais textos. Sem React
// Native e sem rede: confere o código e o contrato.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const s = mensagens.seguranca;

test('contrato: textos do bloqueio, da denúncia com protocolo e das rotas do suporte', () => {
  assert.equal(s.bloquear('Ana'), 'Bloquear Ana');
  assert.equal(s.bloquearTitulo('Ana'), 'Bloquear Ana?');
  assert.equal(s.denunciaEnviada('ABC123'), 'Denúncia enviada (protocolo ABC123). Obrigado por avisar.');
  assert.equal(s.rotaDenunciaSemSessao('trilha', 'a b'), '/suporte?alvoTipo=trilha&alvo=a%20b');
  assert.equal(s.rotas.regras, '/privacidade#regras-da-comunidade');
  assert.doesNotMatch(JSON.stringify(s), /dias|horas|prazo/i, 'nenhum texto promete prazo');
});

test('app: "Bloquear <nome>" logo abaixo de "Denunciar" no cartão, na prévia recebida e no perfil de outra pessoa; nunca no próprio', async () => {
  const fonte = await ler('apps/mobile/src/comunidade.tsx');
  const menu = fonte.slice(fonte.indexOf('export function MenuCartao'), fonte.indexOf('type PedidoBloqueio'));
  assert.ok(menu.indexOf('c.denunciar') < menu.indexOf('s.bloquear(nomeDono)'), 'Bloquear depois de Denunciar');
  assert.match(fonte, /\{!sua && <MenuCartao [\s\S]{0,200}?aoBloquear=\{\(\) => acoes\.bloquear\(cartao\)\} nomeDono=\{cartao\.dono\.nome\}/);
  assert.match(fonte, /\{trilha\.situacao !== 'sua' && \(\s*<MenuCartao titulo=\{trilha\.titulo\} testID="previa-mais"/);
  assert.match(fonte, /testID="bloquear-perfil"\s*acao=\{\(\) => pedirBloqueio\(\{ alvoTipo: 'perfil', alvo: perfilId/);
});

test('app: confirmação do Studoo, aviso "Pessoa bloqueada." com Desfazer e Explorar recarregado', async () => {
  const fonte = await ler('apps/mobile/src/comunidade.tsx');
  assert.match(fonte, /<CartaoConfirmacao testID="bloquear" mensagem=\{s\.bloquearTitulo\(pedido\.nome\)\} texto=\{s\.bloquearTexto\} confirmarRotulo=\{s\.bloquearAcao\}\s*cancelarRotulo=\{s\.cancelar\} destrutivo/);
  assert.match(fonte, /avisar\(s\.bloqueada, \{ acao: \{ rotulo: s\.desfazer, aoTocar: \(\) => void desfazer\(r\.id, alvo\) \} \}\)/);
  assert.match(fonte, /await cliente\.desbloquear\(chave\);\s*avisar\(s\.desbloqueada\);/);
  assert.match(fonte, /aoBloquear: \(\) => setRecarga\(\(n\) => n \+ 1\)/, 'o Explorar recarrega depois de bloquear');
  const estudo = await ler('apps/mobile/src/estudo.tsx');
  assert.match(estudo, /<AvisoDoApp\.Provider value=\{avisoDoApp\}><ProvedorBloqueio cliente=\{cliente\}>/, 'a confirmação mora na raiz do Estudo');
  assert.equal((estudo.match(/irAoExplorar=\{\(\) => abrir\(\{ tipo: 'explorar' \}\)\}/g) ?? []).length, 2, 'perfil e prévia voltam ao Explorar');
});

test('app: denúncia com protocolo, ação Bloquear no aviso e o conteúdo some para quem denunciou', async () => {
  const fonte = await ler('apps/mobile/src/comunidade.tsx');
  assert.match(fonte, /aoEnviar\(r\.protocolo\)/);
  assert.match(fonte, /avisar\(protocolo \? s\.denunciaEnviada\(protocolo\) : c\.denuncia\.enviada, bloquear \? \{ acao: \{ rotulo: s\.bloquearAcao, aoTocar: bloquear \} \} : undefined\)/);
  assert.match(fonte, /removerCartao\?\.\(cartao\.codigo\);\s*avisarDenuncia\(/);
  assert.equal((fonte.match(/avisarDenuncia\(avisar, protocolo,/g) ?? []).length, 3, 'cartão, perfil e prévia');
});

test('app: perfil de quem você bloqueou (404 nos dois sentidos) mostra "Você bloqueou esta pessoa." e Desbloquear', async () => {
  const fonte = await ler('apps/mobile/src/comunidade.tsx');
  assert.match(fonte, /if \(codigo === 'nao_encontrado'\) \{\s*const meu = await cliente\.bloqueados\(\)/);
  assert.match(fonte, /<View testID="perfil-bloqueado"[^>]*>\s*<Titulo foco>\{s\.perfilBloqueado\}<\/Titulo>\s*<Botao rotulo=\{s\.desbloquear\} testID="perfil-desbloquear"/);
});
