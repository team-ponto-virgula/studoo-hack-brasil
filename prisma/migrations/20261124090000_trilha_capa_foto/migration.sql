-- Capa da trilha com foto (lote 4): tabela nova, só acrescenta.
CREATE TABLE "CapaFoto" (
    "usuarioId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "grande" BYTEA NOT NULL,
    "pequena" BYTEA NOT NULL,
    "criadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapaFoto_pkey" PRIMARY KEY ("usuarioId","planoId")
);

CREATE UNIQUE INDEX "CapaFoto_token_key" ON "CapaFoto"("token");

ALTER TABLE "CapaFoto" ADD CONSTRAINT "CapaFoto_usuarioId_planoId_fkey" FOREIGN KEY ("usuarioId", "planoId") REFERENCES "PlanoAprendizado"("usuarioId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
