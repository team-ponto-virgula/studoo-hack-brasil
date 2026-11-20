import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

// Postar no perfil no app (spec 10, "Postar no perfil", 20/11): a seção, a folha com as chaves, o atalho do "•••", a
// confirmação ao tirar do Explorar, sem nome e visitante. Sem React Native e sem rede: confere o código e o contrato.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const t = mensagens.perfil.postar;

test('contrato: os 18 textos da seção 6, sem prazo nem promessa', () => {
  assert.deepEqual(Object.keys(t).sort(), ['aviso', 'avisoTirada', 'botao', 'confirmarAcao', 'confirmarTexto', 'confirmarTitulo', 'editarPerfil', 'erro', 'estadoPerfil',
    'estadoPerfilExplorar', 'menuPostar', 'menuTirar', 'salvando', 'semNome', 'semTrilhas', 'texto', 'titulo', 'vazio'].sort());
  assert.equal(t.botao, 'Postar trilha no perfil');
  assert.equal(t.confirmarTitulo, 'Tirar do perfil e do Explorar?');
  assert.equal(t.confirmarTexto, 'A trilha sai do seu perfil e do Explorar. Quem tem o link continua abrindo.');
});

test('estado da linha: fora, em revisão, no perfil, no perfil e no Explorar, não publicada', async () => {
  const fonte = await ler('apps/mobile/src/postar-perfil.tsx');
  assert.match(fonte, /const nivel = link\.visibilidade \?\? \(link\.noPerfil \? 'perfil' : 'link'\);\s*if \(nivel === 'link'\) return 'fora';\s*if \(link\.moderacao === 'recusado'\) return 'recusada';\s*if \(link\.moderacao === 'pendente'\) return 'revisao';\s*return nivel === 'explorar' \? 'perfilExplorar' : 'perfil';/);
  for (const marca of ['t.estadoPerfil', 't.estadoPerfilExplorar', 'seg.seloEmRevisao', 'seg.seloNaoPublicada', 'seg.falarComSuporte', 't.salvando']) assert.ok(fonte.includes(marca), marca);
});

test('ligar cria o link quando falta e põe no perfil; desligar volta para o link; Explorar pede a confirmação azul', async () => {
  const fonte = await ler('apps/mobile/src/postar-perfil.tsx');
  assert.match(fonte, /const comLink = link \?\? \(await cliente\.criarLink\(planoId\)\);/);
  assert.match(fonte, /await cliente\.definirVisibilidade\(comLink\.codigo, 'perfil'\);/);
  assert.match(fonte, /await cliente\.definirVisibilidade\(link\.codigo, 'link'\);/);
  assert.match(fonte, /avisar\(t\.avisoTirada, \{ icone: 'check', acao: \{ rotulo: seg\.desfazer,/);
  assert.match(fonte, /if \(link\.visibilidade === 'explorar'\) \{\s*const feito = await new Promise<boolean>/);
  const confirmacao = fonte.slice(fonte.indexOf('<CartaoConfirmacao testID="postar-confirmacao"'), fonte.indexOf('/>', fonte.indexOf('<CartaoConfirmacao testID="postar-confirmacao"')));
  assert.match(confirmacao, /mensagem=\{t\.confirmarTitulo\} texto=\{t\.confirmarTexto\} confirmarRotulo=\{t\.confirmarAcao\}/);
  assert.doesNotMatch(confirmacao, /destrutivo/, 'não é destrutiva: a ação é a primária azul');
  assert.match(fonte, /novo\.moderacao === 'pendente' \? seg\.enviadaParaRevisao : t\.aviso/);
  assert.match(fonte, /codigoDaFalha\(falha\) === 'limite_compartilhar' \? mensagemDeErro\(falha\) : t\.erro/);
});

test('a folha: título, texto, regras, sem nome com "Editar perfil", sem trilhas com "Nova trilha", sem as recebidas', async () => {
  const fonte = await ler('apps/mobile/src/postar-perfil.tsx');
  const folha = fonte.slice(fonte.indexOf('export function FolhaPostarNoPerfil'), fonte.indexOf('function LinhaDaTrilha'));
  const i = ['{t.titulo}', '{t.texto}', '<LinhaDasRegras />', '{t.semNome}', '{t.semTrilhas}'].map((m) => folha.indexOf(m));
  assert.ok(i.every((x) => x > 0) && i.every((x, k) => k === 0 || x > i[k - 1]), `ordem: ${i}`);
  assert.match(folha, /planos\.filter\(\(plano\) => !plano\.recebida\)/);
  assert.match(folha, /rotulo=\{mensagens\.planos\.novo\}/);
  assert.match(folha, /<Chave|LinhaDaTrilha/);
  assert.doesNotMatch(folha, /copiar|Copiar link/i, 'a folha não oferece copiar o link');
});

test('Perfil: o botão ao lado do título ou embaixo do estado vazio; visitante sem botão; a folha ligada ao Perfil', async () => {
  const fonte = await ler('apps/mobile/src/perfil.tsx');
  assert.match(fonte, /\{comunidade && perfil\.links\.length > 0 && \(\s*<Botao rotulo=\{p\.postar\.botao\} testID="postar-abrir"/);
  assert.match(fonte, /perfil\.links\.length === 0 && comunidade \? \(\s*<View testID="postar-vazio"[^>]*>\s*<Text style=\{estilos\.texto\}>\{p\.postar\.vazio\}<\/Text>\s*<Botao rotulo=\{p\.postar\.botao\}/);
  assert.match(fonte, /\{!perfil\.visitante && \(\s*<View style=\{perfilEstilos\.secao\}>\s*\{\/\*[^*]*\*\/\}\s*<View style=\{perfilEstilos\.secaoCabeca\}>/, 'a seção (e o botão) só para quem não é visitante');
  assert.match(fonte, /\{postando && perfil && !perfil\.visitante && \(\s*<FolhaPostarNoPerfil/);
  assert.match(fonte, /editarPerfil=\{\(\) => \{ setPostando\(false\); abrirEditor\(\); \}\}/);
});

test('atalho do "•••": logo depois de Compartilhar; primeira vez ou sem nome abre a folha; mesmas ações', async () => {
  const fonte = await ler('apps/mobile/src/estudo.tsx');
  const menu = fonte.slice(fonte.indexOf('function MenuDoCartao'), fonte.indexOf('return (', fonte.indexOf('function MenuDoCartao')));
  const ordem = ['mensagens.compartilhar.entrada', 'mensagens.perfil.postar.menuTirar', 'mensagens.configuracoes.entrada', 'mensagens.planos.apagar'].map((m) => menu.indexOf(m));
  assert.ok(ordem.every((x) => x > 0) && ordem.every((x, k) => k === 0 || x > ordem[k - 1]), `ordem: ${ordem}`);
  assert.match(menu, /postar\.noPerfil \? mensagens\.perfil\.postar\.menuTirar : mensagens\.perfil\.postar\.menuPostar/);
  assert.match(fonte, /if \(!atual\.nome\?\.trim\(\) \|\| !atual\.links\.some\(\(item\) => item\.noPerfil\)\) \{ setFolhaPostar\(true\); return; \}/);
  assert.match(fonte, /await acoesDePostar\.ligar\(plano\.id, link\);/);
  assert.match(fonte, /await acoesDePostar\.desligar\(plano\.id, link\);/);
  assert.match(fonte, /abrirFolha && comunidade && !plano\.recebida && !perfil\?\.visitante/);
  assert.equal((fonte.match(/postar=\{postarDe\(/g) ?? []).length, 2, 'destaque e demais cartões');
});

test('achados da prévia a 390: aviso por cima da folha, chave só com o trilho, lista que não recarrega com um aviso', async () => {
  const folha = await ler('apps/mobile/src/postar-perfil.tsx');
  // A folha é um Modal: no aparelho ela cobre a faixa que a Tela desenha; "Desfazer" precisa estar por cima, onde se toca.
  assert.match(folha, /<AvisoSobreAFolha baixo=\{16 \+ insets\.bottom\} \/>\s*<\/View>\s*\{confirmacao\}\s*<\/Modal>/);
  assert.match(folha, /aoMudar=\{aoMudar\} semTexto \/>/, 'a linha já mostra o título: a chave não repete o texto');
  assert.match(folha, /capa: \{ width: 56, height: 40, flexShrink: 0,/);
  const social = await ler('apps/mobile/src/social.tsx');
  assert.match(social, /\{!semTexto && <Text style=\{socialEstilos\.chaveTexto\}>\{rotulo\}<\/Text>\}/);
  const interfaceApp = await ler('apps/mobile/src/interface.tsx');
  assert.match(interfaceApp, /export function AvisoSobreAFolha\(\{ baixo \}: \{ baixo: number \}\) \{\s*const \{ aviso \} = useContext\(AvisoDoApp\);\s*return aviso \? <FaixaDoAviso key=\{aviso\.vez\} aviso=\{aviso\} baixo=\{baixo\} \/> : null;/);
  // `expirar` muda a cada desenho da raiz (um aviso basta): fora das dependências, a lista não recarrega nem reabre a trilha.
  const estudo = await ler('apps/mobile/src/estudo.tsx');
  assert.match(estudo, /\}, \[cliente, tentativa\]\);/);
  assert.doesNotMatch(estudo, /\[cliente, expirar, tentativa\]/);
  assert.match(estudo, /await expirarAtual\.current\(\);/);
});
