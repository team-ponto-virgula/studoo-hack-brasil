import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { banco } from '../src/servidor/banco/cliente';
import { assinatura } from '../src/servidor/acesso/seguranca';
import { zerarContaDemo } from '../src/servidor/estudio/demo-zerar';
import { consumirGeracaoPersistente } from '../src/servidor/ia/limite';

test('zerarContaDemo apaga só dados da conta alvo, é idempotente e preserva outras contas', async () => {
  const sufixo = randomUUID().slice(0, 8);
  const emailDemo = `demo-${sufixo}@example.test`;
  const emailOutra = `outra-${sufixo}@example.test`;
  const demoId = randomUUID();
  const outraId = randomUUID();

  try {
    await banco.usuario.createMany({
      data: [
        { id: demoId, email: emailDemo, senhaHash: null, fuso: 'America/Sao_Paulo' },
        { id: outraId, email: emailOutra, senhaHash: null, fuso: 'America/Sao_Paulo' },
      ],
    });

    for (const uid of [demoId, outraId]) {
      const planoId = randomUUID();
      const fluxoId = randomUUID();
      const licaoId = randomUUID();
      await banco.planoAprendizado.create({
        data: { id: planoId, usuarioId: uid, titulo: `Trilha ${uid}`, objetivo: 'Aprender frações', origem: 'falsa' },
      });
      await banco.fluxo.create({
        data: { id: fluxoId, planoId, usuarioId: uid, titulo: 'Parte 1', ordem: 0 },
      });
      await banco.licao.create({
        data: {
          id: licaoId, fluxoId, usuarioId: uid, titulo: 'Lição 1', ordem: 0,
          conteudo: { versao: 1, explicacao: 'x', exemplo: 'y', exercicios: [] },
        },
      });
      await banco.apoioLicao.create({
        data: { usuarioId: uid, licaoId, erros: 1 },
      });
      await banco.materialEstudo.create({
        data: {
          id: randomUUID(), usuarioId: uid, nome: 'doc.txt', paginas: [{ numero: 1, texto: 'Texto de estudo' }],
          leitura: 'texto', expiraEm: new Date(Date.now() + 3600_000),
        },
      });
      await banco.sessao.create({
        data: {
          tokenHash: randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''),
          usuarioId: uid, canal: 'WEB', expiraEm: new Date(Date.now() + 3600_000),
        },
      });
      assert.equal(await consumirGeracaoPersistente(uid), true);
    }

    const chaveDemoCota = assinatura(`ia:geracao:${demoId}`);
    const chaveOutraCota = assinatura(`ia:geracao:${outraId}`);

    // Sem confirmar, apenas simula e não apaga nada.
    const sim = await zerarContaDemo(emailDemo);
    assert.equal(sim.encontrada, true);
    assert.equal(sim.confirmado, false);
    assert.equal(sim.planosRemovidos, 1);
    assert.equal(sim.materiaisRemovidos, 1);
    assert.equal(sim.apoiosRemovidos, 1);
    assert.equal(sim.sessoesRemovidas, 1);
    assert.equal(sim.cotasRemovidas, 1);
    assert.equal(await banco.planoAprendizado.count({ where: { usuarioId: demoId } }), 1);
    assert.equal(await banco.tentativaLogin.count({ where: { chave: chaveDemoCota } }), 1);

    // Com confirmar: true, apaga apenas os dados e a cota da conta alvo.
    const r1 = await zerarContaDemo(emailDemo, { confirmar: true });
    assert.equal(r1.encontrada, true);
    assert.equal(r1.confirmado, true);
    assert.equal(r1.planosRemovidos, 1);
    assert.equal(r1.materiaisRemovidos, 1);
    assert.equal(r1.apoiosRemovidos, 1);
    assert.equal(r1.sessoesRemovidas, 1);
    assert.equal(r1.cotasRemovidas, 1);

    // Usuário demo continua existindo, mas sem dados; outra conta intacta.
    assert.ok(await banco.usuario.findUnique({ where: { id: demoId } }));
    assert.equal(await banco.planoAprendizado.count({ where: { usuarioId: demoId } }), 0);
    assert.equal(await banco.tentativaLogin.count({ where: { chave: chaveDemoCota } }), 0);
    assert.equal(await banco.planoAprendizado.count({ where: { usuarioId: outraId } }), 1);
    assert.equal(await banco.materialEstudo.count({ where: { usuarioId: outraId } }), 1);
    assert.equal(await banco.apoioLicao.count({ where: { usuarioId: outraId } }), 1);
    assert.equal(await banco.sessao.count({ where: { usuarioId: outraId } }), 1);
    assert.equal(await banco.tentativaLogin.count({ where: { chave: chaveOutraCota } }), 1);

    // Idempotente na segunda execução.
    const r2 = await zerarContaDemo(emailDemo, { confirmar: true });
    assert.equal(r2.encontrada, true);
    assert.equal(r2.confirmado, true);
    assert.equal(r2.planosRemovidos, 0);
    assert.equal(r2.materiaisRemovidos, 0);
    assert.equal(r2.apoiosRemovidos, 0);
    assert.equal(r2.sessoesRemovidas, 0);
    assert.equal(r2.cotasRemovidas, 0);
    assert.equal(await banco.planoAprendizado.count({ where: { usuarioId: outraId } }), 1);
  } finally {
    await zerarContaDemo(emailDemo, { confirmar: true }).catch(() => undefined);
    await zerarContaDemo(emailOutra, { confirmar: true }).catch(() => undefined);
    await banco.usuario.deleteMany({ where: { id: { in: [demoId, outraId] } } });
    await banco.$disconnect();
  }
});
