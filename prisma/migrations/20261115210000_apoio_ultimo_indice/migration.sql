-- De qual exercício veio o último erro: o reforço é desse exercício (duas escolhas erradas com a mesma letra, em
-- exercícios diferentes, não se confundem mais).
ALTER TABLE "ApoioLicao" ADD COLUMN "ultimoIndice" INTEGER;
