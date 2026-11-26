import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

// Segurança da comunidade no app (spec 14, a parte que não é o bloqueio nem a denúncia dos cartões): Pessoas bloqueadas e
// Ajuda no Perfil, o suporte na entrada e na recuperação, a linha das regras e a recusa na folha de compartilhar, os estados
// de revisão e a mídia da própria pessoa com a sessão. Sem React Native e sem rede: confere o código e o contrato.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const s = mensagens.seguranca;
const ordem = (fonte, marcas) => marcas.map((marca) => { const i = fonte.indexOf(marca); assert.ok(i >= 0, `falta ${marca}`); return i; });

test('Perfil: Som, Privacidade e dados, Pessoas bloqueadas, Ajuda e Conta, nessa ordem; sem a parte social, sem a lista de bloqueios', async () => {
  const fonte = await ler('apps/mobile/src/perfil.tsx');
  const completo = fonte.slice(fonte.indexOf('export function TelaPerfil'), fonte.indexOf('function EditorPerfil'));
  const i = ordem(completo, ['{mensagens.som.titulo}', '{mensagens.privacidade.secaoTitulo}', '{mensagens.seguranca.bloqueadasTitulo}', '{mensagens.seguranca.ajudaTitulo}', '{p.conta}']);
  assert.deepEqual([...i].sort((a, b) => a - b), i);
  assert.match(completo, /\{comunidade && \(\s*<View style=\{perfilEstilos\.secao\}>\s*<TituloSecao>\{mensagens\.seguranca\.bloqueadasTitulo\}/);
  const semSocial = fonte.slice(fonte.indexOf('export function PerfilSemSocial'), fonte.indexOf('const perfilEstilos'));
  const j = ordem(semSocial, ['{mensagens.som.titulo}', '{mensagens.privacidade.secaoTitulo}', '{mensagens.seguranca.ajudaTitulo}', '{p.conta}']);
  assert.deepEqual([...j].sort((a, b) => a - b), j);
  assert.doesNotMatch(semSocial, /SecaoBloqueadas/);
});

test('Pessoas bloqueadas: a lista do GET /bloqueios, "Desbloquear" sem confirmação com o aviso, e a lista vazia', async () => {
  const fonte = await ler('apps/mobile/src/seguranca.tsx');
  const secao = fonte.slice(fonte.indexOf('export function SecaoBloqueadas'), fonte.indexOf('export function EstadoDaPublicacao'));
  assert.match(secao, /cliente\.bloqueados\(\)/);
  assert.match(secao, /await cliente\.desbloquear\(id\);[\s\S]{0,120}avisar\(s\.desbloqueada/);
  assert.doesNotMatch(secao, /CartaoConfirmacao/, 'o desbloqueio não pede confirmação');
  assert.match(secao, /\{s\.bloqueadasVazia\}/);
  assert.match(secao, /nomeAcessivel=\{s\.desbloquearRotulo\(item\.nome\)\}/);
  assert.equal(s.bloqueadasVazia, 'Ninguém bloqueado.');
});

test('Ajuda e suporte: as três páginas do Studoo no navegador do sistema, na origem configurada e sem /api', async () => {
  const fonte = await ler('apps/mobile/src/seguranca.tsx');
  assert.match(fonte, /new URL\(caminho, origemConfigurada\(\)\)/);
  assert.match(fonte, /WebBrowser\.openBrowserAsync\(url\)/);
  const ajuda = fonte.slice(fonte.indexOf('export function SecaoAjuda'), fonte.indexOf('export function SecaoBloqueadas'));
  for (const par of ['s.falarComSuporte, caminho: s.rotas.suporte', 's.regras, caminho: s.rotas.regras', 's.politica, caminho: s.rotas.politica']) assert.ok(ajuda.includes(par), par);
  assert.deepEqual(s.rotas, { suporte: '/suporte', regras: '/privacidade#regras-da-comunidade', politica: '/privacidade' });
  assert.doesNotMatch(JSON.stringify(s.rotas), /\/api/);
});

test('Entrada: ajuda e privacidade no rodapé; recuperação mantém suporte e todos os alvos são acessíveis', async () => {
  const acesso = await ler('apps/mobile/src/acesso-mobile.tsx');
  const rodape = acesso.slice(acesso.indexOf('export function RodapeAcesso'), acesso.indexOf('export function useConfigAcesso'));
  assert.match(rodape, /enderecoDoStudoo\('\/suporte'\) && <LinkAcesso rotulo="Ajuda"[^>]*acao=\{\(\) => abrirPaginaDoStudoo\('\/suporte'\)\} testID="login-ajuda"/);
  assert.match(rodape, /enderecoDoStudoo\('\/privacidade'\) && <LinkAcesso rotulo="Privacidade"[^>]*acao=\{\(\) => abrirPaginaDoStudoo\('\/privacidade'\)\} testID="login-politica"/);
  const entrada = acesso.slice(acesso.indexOf('export function EntradaMobile'), acesso.indexOf('const beneficios'));
  assert.ok(entrada.indexOf('testID="login-entrar"') < entrada.indexOf('<RodapeAcesso />'), 'links públicos ficam depois das ações de acesso');
  assert.match(entrada, /config\.recuperacao && <LinkAcesso rotulo="Esqueci minha senha"/);
  assert.match(acesso, /link: \{ minHeight: 44,/);
  const recuperar = await ler('apps/mobile/src/recuperar.tsx');
  assert.match(recuperar, /<BotaoPrecisaDeAjuda desativado=\{ocupado\} testID="recuperar-ajuda" \/>/);
  const seg = await ler('apps/mobile/src/seguranca.tsx');
  assert.match(seg, /export function BotaoPrecisaDeAjuda[\s\S]{0,400}minHeight: 44|ajudaEntrada: \{ minHeight: 44/);
  assert.equal(s.precisaDeAjuda, 'Precisa de ajuda? Fale com o suporte');
});

test('Folha de compartilhar: a linha das regras fora de "Só com o link", "Enviada para revisão" quando pendente e a recusa com o link das regras', async () => {
  const fonte = await ler('apps/mobile/src/social.tsx');
  assert.match(fonte, /\{escolhido !== 'link' && <LinhaDasRegras \/>\}/);
  assert.match(fonte, /if \(codigo === 'conteudo_recusado'\) setRecusado\(true\); else setErro\(textoDoErro\(codigo\)\);/);
  assert.match(fonte, /\{recusado && <RecusaDoConteudo \/>\}/);
  assert.equal((fonte.match(/novo\.moderacao === 'pendente' \? seg\.enviadaParaRevisao/g) ?? []).length, 3, 'Explorar, perfil e link criado');
  assert.equal((fonte.match(/if \(novo\.moderacao === 'pendente'\) avisar\(seg\.enviadaParaRevisao\)/g) ?? []).length, 2);
  const seg = await ler('apps/mobile/src/seguranca.tsx');
  assert.match(seg, /\{`\$\{s\.recusadaNaHora\} `\}\s*<Text accessibilityRole="link" onPress=\{\(\) => abrirPaginaDoStudoo\(s\.rotas\.regras\)\}/);
  assert.equal(s.regrasAoPublicar.antes + s.regrasAoPublicar.link + s.regrasAoPublicar.depois, 'Ao publicar, você concorda com as Regras da comunidade.');
});

test('Revisão: selo e texto no link e nas configurações, foto e capa em revisão, e o aviso de envio para revisão', async () => {
  const seg = await ler('apps/mobile/src/seguranca.tsx');
  const estado = seg.slice(seg.indexOf('export function EstadoDaPublicacao'), seg.indexOf('export function AvisoMidiaEmRevisao'));
  assert.match(estado, /if \(moderacao !== 'pendente' && moderacao !== 'recusado'\) return null;/);
  assert.match(estado, /recusada \? s\.seloNaoPublicada : s\.seloEmRevisao/);
  assert.match(estado, /recusada \? s\.naoPublicada : s\.emRevisao/);
  assert.match(estado, /\{recusada && \([\s\S]{0,200}s\.falarComSuporte/);
  assert.match(seg, /tipo === 'foto' \? s\.fotoEmRevisao : s\.capaEmRevisao/);
  const perfil = await ler('apps/mobile/src/perfil.tsx');
  assert.match(perfil, /<EstadoDaPublicacao moderacao=\{link\.moderacao\}/);
  assert.equal((perfil.match(/<AvisoMidiaEmRevisao tipo="foto"/g) ?? []).length, 2, 'cabeçalho e editor');
  assert.match(perfil, /novo\.fotoModeracao === 'pendente' \? mensagens\.seguranca\.enviadaParaRevisao : p\.fotoSalva/);
  const conf = await ler('apps/mobile/src/configuracoes.tsx');
  assert.match(conf, /<AvisoMidiaEmRevisao tipo="capa" moderacao=\{conf\.capaModeracao\} \/>/);
  assert.match(conf, /\{comp && <EstadoDaPublicacao moderacao=\{comp\.moderacao\}/);
  assert.match(conf, /novo\.capaModeracao === 'pendente' \? mensagens\.seguranca\.enviadaParaRevisao : k\.capaSalva/);
  assert.equal(s.emRevisao, 'Em revisão pela equipe do Studoo. Por enquanto, só você vê.');
});

test('Mídia da própria pessoa: o token só para o host da API e só nas imagens da dona; a trilha fora do ar com o título da spec', async () => {
  const api = await ler('apps/mobile/src/api-nativa.ts');
  assert.match(api, /if \(tokenEmMemoria && new URL\(uri\)\.origin === origemConfigurada\(\)\.origin\) return \{ uri, headers: \{ Authorization: `Bearer \$\{tokenEmMemoria\}` \} \};/);
  assert.match(api, /export async function apagarToken\(\) \{\s*const chave = chaveDoToken\(\);\s*tokenEmMemoria = null;/);
  const social = await ler('apps/mobile/src/social.tsx');
  assert.match(social, /source=\{daDona \? fonteDaMidiaDaDona\(endereco\) : \{ uri: endereco \}\}/);
  const perfil = await ler('apps/mobile/src/perfil.tsx');
  assert.match(perfil, /<CabecalhoPerfil daDona /);
  assert.match(perfil, /<Avatar daDona nome=\{nomeNormal\}/);
  const comunidade = await ler('apps/mobile/src/comunidade.tsx');
  assert.doesNotMatch(comunidade, /daDona/, 'cartões e perfis de outras pessoas vão sem o token');
  const conf = await ler('apps/mobile/src/configuracoes.tsx');
  // Recebida continua recebida mesmo sem o nome de quem compartilhou (banca P0-3): só a trilha própria (null) é da dona.
  assert.match(conf, /daDona=\{recebidaDe == null\}/);
  assert.match(comunidade, /<Indisponivel titulo=\{mensagens\.seguranca\.trilhaIndisponivel\}/);
  assert.equal(s.trilhaIndisponivel, 'Esta trilha não está disponível agora.');
});

test('"No Explorar" só para o que está aprovado: em revisão, o destino "depois da aprovação" em tom neutro; recusada, sem chip de lugar', async () => {
  assert.equal(s.destinoDepoisDaAprovacao('No Explorar'), 'No Explorar, depois da aprovação');
  const perfil = await ler('apps/mobile/src/perfil.tsx');
  assert.match(perfil, /link\.moderacao === 'recusado' \? null\s*: comunidade && link\.visibilidade && link\.moderacao === 'pendente' \? <SeloVisibilidade nivel=\{link\.visibilidade\} tema=\{link\.tema\} emRevisao \/>/);
  const social = await ler('apps/mobile/src/social.tsx');
  assert.match(social, /const explorar = nivel === 'explorar' && !emRevisao;/, 'o verde de publicada nunca aparece em revisão');
  assert.match(social, /emRevisao \? seg\.destinoDepoisDaAprovacao\(cm\.niveis\[nivel\]\.titulo\) : cm\.niveis\[nivel\]\.titulo/);
  const conf = await ler('apps/mobile/src/configuracoes.tsx');
  assert.match(conf, /!comp \|\| comp\.moderacao === 'recusado' \? k\.soVoce/);
  assert.match(conf, /comp\.moderacao === 'pendente'\s*\? mensagens\.seguranca\.destinoDepoisDaAprovacao\(/);
});

test('em revisão ou não publicada, sem "Copiar link" nem compartilhar o link; a folha troca "Link pronto" pelo aviso da revisão', async () => {
  const perfil = await ler('apps/mobile/src/perfil.tsx');
  assert.match(perfil, /\{link\.moderacao !== 'pendente' && link\.moderacao !== 'recusado' && \(\s*<Botao rotulo=\{m\.copiar\}/);
  assert.match(perfil, /<BotaoParar rotulo=\{m\.parar\}/, '"Parar de compartilhar" continua');
  const social = await ler('apps/mobile/src/social.tsx');
  assert.match(social, /const linkForaDoAr = link\?\.moderacao === 'pendente' \|\| link\?\.moderacao === 'recusado';/);
  assert.match(social, /const estadoForaDoAr = link\?\.moderacao === 'pendente' \? seg\.seloEmRevisao : seg\.seloNaoPublicada;/);
  assert.match(social, /etapa === 'pronto' \? \(linkForaDoAr \? estadoForaDoAr : m\.linkPronto\)/, 'o título é o estado da trilha, como a web');
  assert.match(social, /\{linkForaDoAr \? \(\s*<Text testID="folha-em-revisao"[^>]*>\s*\{link\.moderacao === 'pendente' \? seg\.enviadaParaRevisao : seg\.naoPublicada\}/);
});
