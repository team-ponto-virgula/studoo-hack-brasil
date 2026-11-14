CREATE TABLE "MaterialEstudo" (
 "usuarioId" TEXT NOT NULL, "id" TEXT NOT NULL, "nome" TEXT NOT NULL,
 "paginas" JSONB NOT NULL, "leitura" TEXT NOT NULL, "rascunho" JSONB,
 "expiraEm" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "MaterialEstudo_pkey" PRIMARY KEY ("usuarioId", "id"),
 CONSTRAINT "MaterialEstudo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MaterialEstudo_expiraEm_idx" ON "MaterialEstudo"("expiraEm");
CREATE TABLE "ApoioLicao" (
 "usuarioId" TEXT NOT NULL, "licaoId" TEXT NOT NULL, "erros" INTEGER NOT NULL DEFAULT 0,
 "ultimaResposta" TEXT, "reforco" JSONB, "reforcoConcluido" BOOLEAN NOT NULL DEFAULT false,
 "ensino" JSONB, "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "ApoioLicao_pkey" PRIMARY KEY ("usuarioId", "licaoId"),
 CONSTRAINT "ApoioLicao_licao_fkey" FOREIGN KEY ("usuarioId", "licaoId") REFERENCES "Licao"("usuarioId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
