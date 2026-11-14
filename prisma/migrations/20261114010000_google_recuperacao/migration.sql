ALTER TABLE "Usuario" ALTER COLUMN "senhaHash" DROP NOT NULL;
ALTER TABLE "Usuario" ADD COLUMN "googleSub" TEXT;
CREATE UNIQUE INDEX "Usuario_googleSub_key" ON "Usuario"("googleSub");
CREATE TABLE "AutorizacaoGoogle" (
  "estadoHash" TEXT PRIMARY KEY, "navegadorHash" TEXT NOT NULL,
  "nonce" TEXT NOT NULL, "verificador" TEXT NOT NULL, "desafioMobile" TEXT,
  "expiraEm" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "AutorizacaoGoogle_expiraEm_idx" ON "AutorizacaoGoogle"("expiraEm");
CREATE TABLE "CodigoGoogleMobile" (
  "codigoHash" TEXT PRIMARY KEY, "usuarioId" TEXT NOT NULL,
  "desafio" TEXT NOT NULL, "expiraEm" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CodigoGoogleMobile_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CodigoGoogleMobile_expiraEm_idx" ON "CodigoGoogleMobile"("expiraEm");
CREATE TABLE "RecuperacaoSenha" (
  "usuarioId" TEXT PRIMARY KEY, "codigoHash" TEXT NOT NULL,
  "expiraEm" TIMESTAMPTZ(3) NOT NULL, "tentativas" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RecuperacaoSenha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
