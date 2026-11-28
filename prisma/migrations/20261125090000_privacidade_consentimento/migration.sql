-- Aceite do envio a IA de terceiros (App Review 5.1.2(i)). Colunas anuláveis: contas existentes ficam sem aceite e a
-- tela pede o aceite na primeira ação que usaria a IA.
ALTER TABLE "Usuario" ADD COLUMN "consentimentoIaEm" TIMESTAMPTZ(3);
ALTER TABLE "Usuario" ADD COLUMN "consentimentoIaVersao" TEXT;
