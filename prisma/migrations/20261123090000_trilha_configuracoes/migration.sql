-- Configurações da trilha (lote 4): descrição, tema e capa da galeria. Só acrescenta colunas anuláveis.
ALTER TABLE "PlanoAprendizado" ADD COLUMN "descricao" TEXT;
ALTER TABLE "PlanoAprendizado" ADD COLUMN "tema" TEXT;
ALTER TABLE "PlanoAprendizado" ADD COLUMN "capa" TEXT;
