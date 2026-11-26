ALTER TABLE "OnboardingConta" ADD COLUMN "modo" TEXT NOT NULL DEFAULT 'assunto';
ALTER TABLE "OnboardingConta" ADD CONSTRAINT "OnboardingConta_modo_check" CHECK ("modo" IN ('assunto', 'material'));
