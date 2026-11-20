-- Criar conta por e-mail (código de posse) e Iniciar sessão com a Apple (App Review 4.8). Tudo aditivo e anulável.
ALTER TABLE "Usuario" ADD COLUMN "appleSub" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "appleRenovacao" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "appleCliente" TEXT;
CREATE UNIQUE INDEX "Usuario_appleSub_key" ON "Usuario"("appleSub");

CREATE TABLE "VerificacaoCadastro" (
    "chave" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "VerificacaoCadastro_pkey" PRIMARY KEY ("chave")
);
CREATE INDEX "VerificacaoCadastro_expiraEm_idx" ON "VerificacaoCadastro"("expiraEm");

CREATE TABLE "NonceApple" (
    "nonceHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "NonceApple_pkey" PRIMARY KEY ("nonceHash")
);
CREATE INDEX "NonceApple_expiraEm_idx" ON "NonceApple"("expiraEm");
