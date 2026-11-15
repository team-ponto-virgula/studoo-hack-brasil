-- O resumo de cada lição concluída (tempo e exercícios de primeira), para o fim da trilha mostrar o total.
ALTER TABLE "RegistroEstudo" ADD COLUMN "segundos" INTEGER;
ALTER TABLE "RegistroEstudo" ADD COLUMN "acertosDePrimeira" INTEGER;
ALTER TABLE "RegistroEstudo" ADD COLUMN "exercicios" INTEGER;
