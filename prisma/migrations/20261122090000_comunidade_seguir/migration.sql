-- Comunidade (spec 10, etapa C2): seguir perfis. Só acrescenta: nada existente muda.
-- Quem segue quem, com data (as Novidades contam os novos seguidores da semana). Sem lista pública de seguidores.
CREATE TABLE "Seguir" (
    "seguidorId" TEXT NOT NULL,
    "seguidoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Seguir_pkey" PRIMARY KEY ("seguidorId","seguidoId")
);
CREATE INDEX "Seguir_seguidoId_criadoEm_idx" ON "Seguir"("seguidoId", "criadoEm");
ALTER TABLE "Seguir" ADD CONSTRAINT "Seguir_seguidorId_fkey" FOREIGN KEY ("seguidorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Seguir" ADD CONSTRAINT "Seguir_seguidoId_fkey" FOREIGN KEY ("seguidoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
