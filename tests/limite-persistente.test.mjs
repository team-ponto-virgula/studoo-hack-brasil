import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { consumirGeracaoPersistente, reiniciarLimiteDeGeracoes } from "../src/servidor/ia/limite.ts";

test("consumirGeracaoPersistente persiste no banco mesmo após reiniciarLimiteDeGeracoes", async () => {
  const limAntes = process.env.STUDOO_LIMITE_GERACOES;
  const janAntes = process.env.STUDOO_JANELA_GERACOES_MIN;
  process.env.STUDOO_LIMITE_GERACOES = "2";
  process.env.STUDOO_JANELA_GERACOES_MIN = "10";
  const usuarioId = `u-limite-${randomUUID()}`;
  try {
    assert.equal(await consumirGeracaoPersistente(usuarioId), true);
    assert.equal(await consumirGeracaoPersistente(usuarioId), true);
    // Limpa estado em memória para simular reinício do processo.
    reiniciarLimiteDeGeracoes();
    assert.equal(await consumirGeracaoPersistente(usuarioId), false);
  } finally {
    if (limAntes === undefined) delete process.env.STUDOO_LIMITE_GERACOES;
    else process.env.STUDOO_LIMITE_GERACOES = limAntes;
    if (janAntes === undefined) delete process.env.STUDOO_JANELA_GERACOES_MIN;
    else process.env.STUDOO_JANELA_GERACOES_MIN = janAntes;
  }
});
