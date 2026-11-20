// Rode na worktree da API com o servidor local, o banco de testes e a mesma lista da equipe.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { banco } from '../src/servidor/banco/cliente.ts';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
const base = process.env.STUDOO_QA_ORIGEM;
const db = new URL(process.env.DATABASE_URL);
if (!base || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname) || !['127.0.0.1', 'localhost'].includes(db.hostname) || db.pathname !== '/studoo_local') throw Error('O roteiro precisa da API e do banco locais de teste.');
if (process.env.EMAIL !== 'falso' || process.env.IA !== 'falsa') throw Error('Use os provedores locais de teste.');
let chamadas = 0;
async function solicitar(path, sessao = null, method = 'GET', body, esperado = 200) {
  const headers = { origin: base };
  if (sessao) headers.cookie = sessao;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const mime = r.headers.get('content-type') || '';
  const data = mime.includes('json') ? await r.json() : mime.includes('image') ? await r.arrayBuffer() : await r.text();
  assert.equal(r.status, esperado, method+' '+path+' '+r.status+' '+(data?.codigo || ''));
  chamadas++;
  return { data, headers: r.headers };
}
const alunos = [];
async function pessoa(nome, equipe = false) {
  const id = randomUUID();
  const email = equipe ? process.env.STUDOO_EQUIPE_EMAILS : 'qa-'+id+'@example.test';
  if (!email || !email.endsWith('@example.test')) throw Error('A caixa exige um endereço sintético @example.test.');
  // Contas de teste da nossa execução. Não reutilizar uma conta existente com o mesmo endereço.
  await banco.usuario.create({ data: { id, email, fuso: 'UTC' } });
  const cookie = cookieSessao((await criarSessao(id, 'WEB')).token).split(';')[0];
  const u = { cookie, nome }; alunos.push(u);
  if (!equipe) u.perfilId = (await solicitar('/api/perfil',cookie,'PUT',{nome,cor:'verde'})).data.perfilId;
  return u;
}
async function publicar(u, assunto){
  const p=(await solicitar('/api/aprendizado/propostas',u.cookie,'POST',{objetivo:assunto})).data;
  const plano=(await solicitar('/api/aprendizado/planos',u.cookie,'POST',{token:p.token})).data;
  const { codigo }=(await solicitar('/api/aprendizado/planos/'+plano.id+'/compartilhar',u.cookie,'POST',{})).data;
  const conf=(await solicitar('/api/compartilhar/'+codigo,u.cookie,'PATCH',{visibilidade:'explorar',tema:'ciencias',legenda:'Uma trilha para estudar em grupo.'})).data;
  assert.equal(conf.moderacao,'pendente');
  return { codigo, id:plano.id };
}
async function decisao(e,tipo,alvo,acao,extra={}) {
  const det=(await solicitar('/api/equipe/moderacao?'+new URLSearchParams({tipo,alvo}),e.cookie)).data;
  assert.ok(det.texto);
  await solicitar('/api/equipe/moderacao',e.cookie,'POST',{tipo,alvo,acao,versao:det.versao,...extra});
}
const trilha = t => '/api/compartilhar/'+t.codigo;
const perfil = p => '/api/perfis/'+p.perfilId;
async function aparece(t, who=null) {
  const r=(await solicitar('/api/explorar',who?.cookie)).data;
  return [...r.novas,...r.emAlta].some(x=>x.codigo===t.codigo);
}
const relatar=async(quem,alvoTipo,alvo)=>solicitar('/api/denuncias',quem?.cookie,'POST',{alvoTipo,alvo,motivo:'ofensivo'});
const acompanhar=async(protocolo,who=null)=>(await solicitar('/api/suporte/protocolo',who?.cookie,'POST',{protocolo})).data;
const cfg=(await solicitar('/api/auth/config')).data;
assert.ok(cfg.compartilhar && cfg.comunidade && cfg.visitante && cfg.ia === 'falsa');
try {
  const e=await pessoa('Equipe',true), a=await pessoa('Ana do Laboratório'), b=await pessoa('Bia do Laboratório'), c=await pessoa('Caio do Laboratório'), d=await pessoa('Dora do Laboratório');
  const v={cookie:(await solicitar('/api/visitante',null,'POST',{})).headers.get('set-cookie').split(';')[0]};
  alunos.push(v);
  const t=await publicar(a,'Estudar o sistema solar'), tb=await publicar(b,'Estudar os oceanos');
  await solicitar(trilha(t),b.cookie,'GET',undefined,404); assert.equal(await aparece(t),false);
  await solicitar('/api/equipe/moderacao',null,'GET',undefined,401);
  await solicitar('/api/equipe/moderacao',b.cookie,'GET',undefined,404);
  const lista=(await solicitar('/api/equipe/moderacao',e.cookie)).data;
  assert.ok(lista.itens.some(i=>i.tipo==='perfil'&&i.alvo===a.perfilId));
  assert.ok(lista.itens.some(i=>i.tipo==='trilha'&&i.alvo===t.codigo));
  for(const [dono,publicacao] of [[a,t],[b,tb]]) {
    await decisao(e,'perfil',dono.perfilId,'aprovar'); await decisao(e,'trilha',publicacao.codigo,'aprovar');
  }
  assert.ok(await aparece(t,b)); await solicitar(trilha(t),b.cookie);
  console.log('S1/S7/S8 · publicação pendente, aprovação de perfil/trilha, caixa restrita e leitura pública.');
  const ruim=await solicitar(trilha(t),a.cookie,'PATCH',{visibilidade:'explorar',tema:'ciencias',legenda:'Compre seguidores agora'},422);
  assert.equal(ruim.data.codigo,'conteudo_recusado');
  await solicitar('/api/perfil',a.cookie,'PUT',{nome:'Compre seguidores',cor:'verde'},422);
  const imagem=(await sharp({create:{width:80,height:64,channels:3,background:'#466bb7'}}).png().toBuffer()).toString('base64');
  const novaFoto=(await solicitar('/api/perfil/foto',a.cookie,'PUT',{base64:imagem})).data;
  assert.equal(novaFoto.fotoModeracao,'pendente');
  const foto='/api/fotos/'+novaFoto.foto+'/128';
  assert.equal((await solicitar(perfil(a),b.cookie)).data.foto,null);
  await solicitar(foto,a.cookie);await solicitar(foto,b.cookie,'GET',undefined,404);
  await decisao(e,'foto',novaFoto.foto,'aprovar');await solicitar(foto,b.cookie);
  const conf=(await solicitar('/api/aprendizado/planos/'+t.id+'/capa',a.cookie,'PUT',{base64:imagem})).data;
  assert.equal(conf.capaModeracao,'pendente');
  const capa='/api/capas/'+conf.capa.slice(5)+'/480';
  assert.equal((await solicitar(trilha(t),b.cookie)).data.capa,undefined);
  await solicitar(capa,a.cookie);await solicitar(capa,null,'GET',undefined,404);
  await decisao(e,'capa',conf.capa.slice(5),'aprovar');await solicitar(capa,null);
  console.log('S2/S3 · texto recusado, foto e capa privadas até a decisão; bytes e metadados conferidos.');
  await solicitar(perfil(a)+'/seguir',b.cookie,'POST',{ativo:true});
  await solicitar(trilha(t)+'/valeu',b.cookie,'POST',{ativo:true});
  const bloqueio=(await solicitar('/api/bloqueios',b.cookie,'POST',{alvoTipo:'trilha',alvo:t.codigo})).data;
  assert.ok(!await aparece(t,b) && !await aparece(tb,a));assert.ok(await aparece(t));
  const listaB=(await solicitar('/api/bloqueios',b.cookie)).data.itens;
  assert.ok(listaB.some(i=>i.id===bloqueio.id&&i.perfilId===a.perfilId));
  await solicitar(perfil(a),b.cookie,'GET',undefined,404);await solicitar(perfil(b),a.cookie,'GET',undefined,404);
  await solicitar(trilha(t),b.cookie,'GET',undefined,404);await solicitar(foto,b.cookie,'GET',undefined,404);
  await solicitar(trilha(t)+'/adicionar',b.cookie,'POST',{},404);
  await solicitar(trilha(t)+'/valeu',b.cookie,'POST',{ativo:true},404);
  await solicitar(perfil(a)+'/seguir',b.cookie,'POST',{ativo:true},404);
  assert.ok(!(await solicitar('/api/explorar?seguindo=1',b.cookie)).data.novas.some(x=>x.codigo===t.codigo));
  assert.ok(!JSON.stringify((await solicitar('/api/perfil/novidades',a.cookie)).data).includes(b.nome));
  await solicitar('/api/bloqueios/'+bloqueio.id,b.cookie,'DELETE',undefined,204);assert.ok(await aparece(t,b));
  assert.equal((await solicitar(perfil(a),b.cookie)).data.seguir.seguindo,false);
  const bv=(await solicitar('/api/bloqueios',v.cookie,'POST',{alvoTipo:'perfil',alvo:a.perfilId})).data;
  await solicitar(perfil(a),v.cookie,'GET',undefined,404);await solicitar('/api/bloqueios/'+bv.id,v.cookie,'DELETE',undefined,204);
  console.log('S9–S11 · bloqueio bilateral, desfazer, visitante, links, curtidas, cópia, seguimento e novidades.');
  const urlAnon=(await solicitar('/t/'+t.codigo)).data;
  assert.ok(urlAnon.includes('/suporte?alvoTipo=trilha')); assert.ok((await solicitar('/p/'+a.perfilId)).data.includes('/suporte?alvoTipo=perfil'));
  const anon=await relatar(null,'trilha',t.codigo), anonCookie=anon.headers.get('set-cookie').split(';')[0];
  await solicitar(trilha(t),anonCookie,'GET',undefined,404);
  const rv=(await relatar(v,'trilha',t.codigo)).data;
  const rb=(await relatar(b,'trilha',t.codigo)).data;
  assert.equal((await acompanhar(rv.protocolo,v)).estado,'Recebido');
  assert.equal((await acompanhar(anon.data.protocolo)).estado,'Recebido');
  assert.equal(await aparece(t,b),false);assert.equal(await aparece(t,c),true);
  await relatar(c,'trilha',t.codigo);assert.ok(await aparece(t));
  await relatar(d,'trilha',t.codigo);assert.equal(await aparece(t),false);
  await solicitar(trilha(t),null,'GET',undefined,404);
  assert.equal((await solicitar('/api/perfil',a.cookie)).data.links.find(l=>l.codigo===t.codigo).moderacao,'pendente');
  const grupo=(await solicitar('/api/equipe/moderacao',e.cookie)).data.denuncias.find(g=>g.alvo===t.codigo);
  assert.equal(grupo.total,5);await decisao(e,'trilha',t.codigo,'manter');
  assert.ok(await aparece(t));assert.match((await acompanhar(rv.protocolo)).resposta,/manteve/);
  assert.equal((await acompanhar(anon.data.protocolo)).estado,'Respondido');assert.equal((await acompanhar(rb.protocolo,b)).estado,'Respondido');
  const rep=(await relatar(v,'perfil',a.perfilId)).data;await solicitar(perfil(a),v.cookie,'GET',undefined,404);
  await decisao(e,'perfil',a.perfilId,'remover');await solicitar(trilha(t),null,'GET',undefined,404);
  assert.match((await acompanhar(rep.protocolo)).resposta,/retirou/);await decisao(e,'perfil',a.perfilId,'aprovar');
  await decisao(e,'trilha',t.codigo,'remover');assert.equal(await aparece(t),false);
  assert.equal((await solicitar('/api/perfil',a.cookie)).data.links.find(l=>l.codigo===t.codigo).moderacao,'recusado');
  await decisao(e,'trilha',t.codigo,'aprovar');
  console.log('S4–S7/S12 · cinco relatos; só três contas retiram a publicação. Visitante e pessoa sem sessão consultaram os protocolos antes e depois da resposta.');
  const ajuda=(await solicitar('/api/suporte',null,'POST',{mensagem:'Pedido sintético para conferir o atendimento.'},201)).data;
  assert.equal((await acompanhar(ajuda.protocolo)).estado,'Recebido');
  const caixa=(await solicitar('/api/equipe/moderacao',e.cookie)).data;
  assert.ok(caixa.pedidos.some(p=>p.id===ajuda.protocolo));
  await solicitar('/api/equipe/moderacao',e.cookie,'POST',{tipo:'atendimento',acao:'responder',alvo:ajuda.protocolo,resposta:'Conferência local concluída.'});
  assert.equal((await acompanhar(ajuda.protocolo)).resposta,'Conferência local concluída.');
  assert.ok((await solicitar('/login')).data.includes('/suporte'));assert.ok((await solicitar('/recuperar')).data.includes('/suporte'));
  assert.ok((await solicitar('/privacidade')).data.includes('id="regras-da-comunidade"'));
  const pedidoVelho=(await solicitar('/api/equipe/moderacao?tipo=trilha&alvo='+t.codigo,e.cookie)).data;
  await solicitar('/api/aprendizado/planos/'+t.id+'/configuracoes',a.cookie,'PATCH',{titulo:'Os astros em revisão'});
  await solicitar(trilha(t),null,'GET',undefined,404);
  await solicitar('/api/equipe/moderacao',e.cookie,'POST',{tipo:'trilha',alvo:t.codigo,acao:'aprovar',versao:pedidoVelho.versao},400);
  await decisao(e,'trilha',t.codigo,'aprovar');assert.ok(await aparece(t));
  console.log('S13/S15 · suporte sem login respondido pelo operador e consultado pelo protocolo; regras públicas; edição exige decisão sobre a versão atual.');
  if (process.env.STUDOO_QA_PRESERVAR_PUBLICACAO === '1') {
    await writeFile('.studoo-local/publicacao-qa.json',JSON.stringify({codigo:t.codigo,perfil:a.perfilId,plano:t.id}),{mode:0o600});
    alunos.splice(alunos.indexOf(a),1);
  }
  console.log(chamadas+' respostas HTTP verificadas antes da limpeza.');
} finally {
  for(const aluno of alunos) await solicitar('/api/conta',aluno.cookie,'DELETE',{confirmacao:'EXCLUIR'},204);
  await banco.$disconnect();
}
