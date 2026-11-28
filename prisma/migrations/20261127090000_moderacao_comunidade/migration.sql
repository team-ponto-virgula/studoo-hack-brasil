BEGIN;
-- CreateEnum
CREATE TYPE "EstadoModeracao" AS ENUM ('pendente', 'aprovado', 'recusado');

-- DropForeignKey
ALTER TABLE "Denuncia" DROP CONSTRAINT "Denuncia_usuarioId_fkey";

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "comunidadeSuspensa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "perfilModeracao" "EstadoModeracao" NOT NULL DEFAULT 'pendente',
ADD COLUMN     "perfilRevisao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "FotoPerfil" ADD COLUMN     "moderacao" "EstadoModeracao" NOT NULL DEFAULT 'pendente';

-- AlterTable
ALTER TABLE "LinkTrilha" ADD COLUMN     "moderacao" "EstadoModeracao" NOT NULL DEFAULT 'pendente',
ADD COLUMN     "revisao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Denuncia" ADD COLUMN     "contaVerificada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'aberto',
ADD COLUMN     "resposta" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CapaFoto" ADD COLUMN     "moderacao" "EstadoModeracao" NOT NULL DEFAULT 'pendente';

-- CreateTable
CREATE TABLE "Bloqueio" (
    "id" TEXT NOT NULL,
    "deId" TEXT NOT NULL,
    "paraId" TEXT NOT NULL,

    CONSTRAINT "Bloqueio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atendimento" (
    "id" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'aberto',
    "resposta" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoModeracao" (
    "id" TEXT NOT NULL,
    "operadorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "alvo" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoModeracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bloqueio_paraId_idx" ON "Bloqueio"("paraId");

-- CreateIndex
CREATE UNIQUE INDEX "Bloqueio_deId_paraId_key" ON "Bloqueio"("deId", "paraId");

-- CreateIndex
CREATE INDEX "Atendimento_estado_criadoEm_idx" ON "Atendimento"("estado", "criadoEm");

-- CreateIndex
CREATE INDEX "DecisaoModeracao_tipo_alvo_idx" ON "DecisaoModeracao"("tipo", "alvo");

-- CreateIndex
CREATE INDEX "Denuncia_estado_criadoEm_idx" ON "Denuncia"("estado", "criadoEm");

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_deId_fkey" FOREIGN KEY ("deId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_paraId_fkey" FOREIGN KEY ("paraId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Denúncias anteriores só podiam ser abertas por contas permanentes.
UPDATE "Denuncia" SET "contaVerificada" = true WHERE "usuarioId" IS NOT NULL;

-- Novo endereço para mídias que antes eram servidas com cache público imutável.
UPDATE "FotoPerfil" SET token = translate(left(encode(uuid_send(gen_random_uuid()), 'base64'),16), '+/', '-_');
WITH antigas AS (SELECT "usuarioId","planoId",token FROM "CapaFoto"),
novas AS (UPDATE "CapaFoto" SET token = translate(left(encode(uuid_send(gen_random_uuid()), 'base64'),16), '+/', '-_')
          RETURNING "usuarioId","planoId",token)
UPDATE "PlanoAprendizado" p SET capa = 'foto:' || novas.token FROM antigas JOIN novas USING ("usuarioId","planoId")
WHERE p."usuarioId"=novas."usuarioId" AND p.id=novas."planoId" AND p.capa='foto:' || antigas.token;

-- A revisão pertence à versão do conteúdo. Qualquer caminho de escrita invalida a decisão antiga.
CREATE FUNCTION studoo_rever_perfil() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."perfilModeracao" := 'pendente';
  NEW."perfilRevisao" := OLD."perfilRevisao" + 1;
  RETURN NEW;
END $$;
CREATE TRIGGER rever_perfil BEFORE UPDATE OF "perfilNome","perfilResumo" ON "Usuario"
FOR EACH ROW WHEN ((OLD."perfilNome",OLD."perfilResumo") IS DISTINCT FROM (NEW."perfilNome",NEW."perfilResumo"))
EXECUTE FUNCTION studoo_rever_perfil();
CREATE FUNCTION studoo_rever_legenda() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.moderacao := 'pendente'; NEW.revisao := OLD.revisao + 1; RETURN NEW;
END $$;
CREATE TRIGGER rever_legenda BEFORE UPDATE OF legenda ON "LinkTrilha"
FOR EACH ROW WHEN (OLD.legenda IS DISTINCT FROM NEW.legenda) EXECUTE FUNCTION studoo_rever_legenda();
CREATE FUNCTION studoo_rever_plano() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE "LinkTrilha" SET moderacao='pendente', revisao=revisao+1 WHERE "usuarioId"=NEW."usuarioId" AND "planoId"=NEW.id;
 RETURN NULL;
END $$;
CREATE TRIGGER rever_plano AFTER UPDATE OF titulo,descricao,origem ON "PlanoAprendizado"
FOR EACH ROW WHEN ((OLD.titulo,OLD.descricao,OLD.origem) IS DISTINCT FROM (NEW.titulo,NEW.descricao,NEW.origem)) EXECUTE FUNCTION studoo_rever_plano();
CREATE FUNCTION studoo_rever_parte() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN
   UPDATE "LinkTrilha" SET moderacao='pendente', revisao=revisao+1 WHERE "usuarioId"=OLD."usuarioId" AND "planoId"=OLD."planoId";
 END IF;
 IF TG_OP <> 'DELETE' THEN
   UPDATE "LinkTrilha" SET moderacao='pendente', revisao=revisao+1 WHERE "usuarioId"=NEW."usuarioId" AND "planoId"=NEW."planoId";
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER rever_parte AFTER INSERT OR UPDATE OR DELETE ON "Fluxo" FOR EACH ROW EXECUTE FUNCTION studoo_rever_parte();
CREATE FUNCTION studoo_rever_licao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN
   UPDATE "LinkTrilha" l SET moderacao='pendente', revisao=revisao+1 FROM "Fluxo" f
   WHERE f.id=OLD."fluxoId" AND f."usuarioId"=OLD."usuarioId" AND l."planoId"=f."planoId" AND l."usuarioId"=f."usuarioId";
 END IF;
 IF TG_OP <> 'DELETE' THEN
   UPDATE "LinkTrilha" l SET moderacao='pendente', revisao=revisao+1 FROM "Fluxo" f
   WHERE f.id=NEW."fluxoId" AND f."usuarioId"=NEW."usuarioId" AND l."planoId"=f."planoId" AND l."usuarioId"=f."usuarioId";
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER rever_licao AFTER INSERT OR UPDATE OR DELETE ON "Licao" FOR EACH ROW EXECUTE FUNCTION studoo_rever_licao();
COMMIT;
