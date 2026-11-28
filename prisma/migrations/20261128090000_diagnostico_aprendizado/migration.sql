ALTER TABLE "PlanoAprendizado" ADD COLUMN "diagnostico" JSONB;

CREATE TABLE "DiagnosticoAprendizado" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "objetivo" TEXT NOT NULL,
  "passo" INTEGER NOT NULL DEFAULT 1,
  "revisao" INTEGER NOT NULL DEFAULT 0,
  "estado" JSONB NOT NULL,
  "expiraEm" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "DiagnosticoAprendizado_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DiagnosticoAprendizado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DiagnosticoAprendizado_expiraEm_idx" ON "DiagnosticoAprendizado"("expiraEm");

CREATE TABLE "DiaDeEstudo" (
  "usuarioId" TEXT NOT NULL,
  "dia" TEXT NOT NULL,
  CONSTRAINT "DiaDeEstudo_pkey" PRIMARY KEY ("usuarioId", "dia"),
  CONSTRAINT "DiaDeEstudo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "DiaDeEstudo" ("usuarioId", "dia")
SELECT DISTINCT r."usuarioId", to_char(r."concluidoEm" AT TIME ZONE COALESCE(z.name, 'UTC'), 'YYYY-MM-DD')
FROM "RegistroEstudo" r
JOIN "Usuario" u ON u.id = r."usuarioId"
LEFT JOIN pg_timezone_names z ON z.name = u.fuso;
