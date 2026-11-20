import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import pg from 'pg';

test('o acervo antigo entra inteiro em revisão, com novos endereços para a mesma mídia e denúncias preservadas', async () => {
  const conn = new URL(process.env.DATABASE_URL);
  assert.ok(['127.0.0.1','localhost'].includes(conn.hostname) && conn.pathname === '/studoo_local', 'Use o banco de teste local.');
  const db = new pg.Client({connectionString:conn.href});
  const schema = 'qa_moderacao_' + randomUUID().replaceAll('-','');
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query('CREATE SCHEMA "'+schema+'"');
    await db.query('SET LOCAL search_path TO "'+schema+'", pg_catalog');
    const pasta = new URL('../prisma/migrations/',import.meta.url);
    const nome = '20261127090000_moderacao_comunidade';
    for(const m of (await readdir(pasta)).filter(m=>/^\d/.test(m) && m < nome).sort()) {
      await db.query(await readFile(new URL(m+'/migration.sql',pasta),'utf8'));
    }
    await db.query(`INSERT INTO "Usuario" (id,email,fuso,"perfilNome","perfilId") VALUES ('a','ana@example.test','UTC','Ana','perfil-sintetico');
      INSERT INTO "PlanoAprendizado" ("usuarioId",id,titulo,objetivo,origem,capa) VALUES ('a','p','Título anterior','Objetivo','Estudo','foto:capa-antiga');
      INSERT INTO "LinkTrilha" (codigo,"usuarioId","planoId","noPerfil","noExplorar",adicoes) VALUES ('codigo-sintetico','a','p',true,true,8);
      INSERT INTO "FotoPerfil" ("usuarioId",token,grande,pequena) VALUES ('a','foto-antiga',decode('abab','hex'),decode('ab','hex'));
      INSERT INTO "CapaFoto" ("usuarioId","planoId",token,grande,pequena) VALUES ('a','p','capa-antiga',decode('cdcd','hex'),decode('cd','hex'));
      INSERT INTO "Denuncia" (id,"alvoTipo",alvo,"usuarioId",motivo) VALUES ('relato','trilha','codigo-sintetico','a','spam');`);
    // A transação externa permite desfazer inclusive as tabelas de teste.
    const migracao = await readFile(new URL(nome+'/migration.sql',pasta),'utf8');
    await db.query(migracao.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, ''));
    const {rows:[r]}=await db.query(`SELECT u."perfilModeracao", l.moderacao, l.adicoes, l.codigo, f.moderacao AS foto,c.moderacao AS capa,
       f.token AS tf, c.token AS tc, p.capa AS ref, encode(f.grande,'hex') AS bytes_foto, encode(c.grande,'hex') AS bytes_capa,d.estado,d."contaVerificada"
       FROM "Usuario" u JOIN "LinkTrilha" l ON l."usuarioId"=u.id JOIN "FotoPerfil" f ON f."usuarioId"=u.id
       JOIN "CapaFoto" c ON c."usuarioId"=u.id JOIN "PlanoAprendizado" p ON p.id=c."planoId" JOIN "Denuncia" d ON d.alvo=l.codigo`);
    assert.deepEqual([r.perfilModeracao,r.moderacao,r.foto,r.capa],Array(4).fill('pendente'));
    assert.deepEqual([r.adicoes,r.codigo,r.bytes_foto,r.bytes_capa,r.estado,r.contaVerificada],[8,'codigo-sintetico','abab','cdcd','aberto',true]);
    assert.match(r.tf,/^[A-Za-z0-9_-]{16}$/);assert.match(r.tc,/^[A-Za-z0-9_-]{16}$/);assert.equal(r.ref,'foto:'+r.tc);
  } finally { await db.query('ROLLBACK'); await db.end(); }
});
