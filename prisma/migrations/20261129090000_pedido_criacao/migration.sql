-- Retomada da criação de trilhas (spec 04, Retomada da criação): só uma tabela nova, sem mexer nas existentes.
CREATE TABLE "PedidoCriacao" (
  "usuarioId" TEXT NOT NULL,
  "id" TEXT NOT NULL,
  "estado" TEXT NOT NULL,
  "etapa" TEXT,
  "tentativas" INTEGER NOT NULL DEFAULT 1,
  "iniciadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validoAte" TIMESTAMPTZ(3),
  "propostaExpiraEm" TIMESTAMPTZ(3) NOT NULL,
  "concluidoEm" TIMESTAMPTZ(3),
  "duracaoMs" INTEGER,
  "codigo" TEXT,
  "causa" TEXT,
  "motivo" TEXT,
  "aguardarAte" TIMESTAMPTZ(3),
  CONSTRAINT "PedidoCriacao_pkey" PRIMARY KEY ("usuarioId", "id"),
  CONSTRAINT "PedidoCriacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PedidoCriacao_atualizadoEm_idx" ON "PedidoCriacao"("atualizadoEm");
