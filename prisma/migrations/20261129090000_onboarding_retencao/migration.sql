ALTER TABLE "Usuario" ADD COLUMN "metaLicoesDia" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_metaLicoesDia_check" CHECK ("metaLicoesDia" BETWEEN 1 AND 3);
ALTER TABLE "Sessao" ADD COLUMN "onboardingInicial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CodigoGoogleMobile" ADD COLUMN "onboardingInicial" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "OnboardingConta" (
  "usuarioId" TEXT NOT NULL,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "etapa" TEXT NOT NULL DEFAULT 'preparacao',
  "objetivo" TEXT,
  "planoId" TEXT,
  "iniciadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,
  "adiadoEm" TIMESTAMPTZ(3),
  "concluidoEm" TIMESTAMPTZ(3),
  CONSTRAINT "OnboardingConta_pkey" PRIMARY KEY ("usuarioId"),
  CONSTRAINT "OnboardingConta_etapa_check" CHECK ("etapa" IN ('preparacao', 'trilha', 'licao', 'concluido')),
  CONSTRAINT "OnboardingConta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
