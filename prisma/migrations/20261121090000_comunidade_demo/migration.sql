-- Comunidade (spec 10, etapa C1): perfis de demonstração rotulados. Só acrescenta: nada existente muda.
-- Criados pelo comando `npm run comunidade:demo` (com STUDOO_COMUNIDADE_DEMO=1), sem senha e sem login.
ALTER TABLE "Usuario" ADD COLUMN "perfilDemo" BOOLEAN NOT NULL DEFAULT false;
