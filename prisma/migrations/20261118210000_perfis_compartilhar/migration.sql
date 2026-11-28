-- Perfis leves e compartilhar trilha (spec 09). Só acrescenta: nada existente muda.

-- Perfil: nome e cor do avatar, e o id público (aleatório, 96 bits) da página /p/<id>.
ALTER TABLE "Usuario" ADD COLUMN "perfilNome" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "perfilCor" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "perfilId" TEXT;
CREATE UNIQUE INDEX "Usuario_perfilId_key" ON "Usuario"("perfilId");

-- Trilha recebida por link: de quem veio (nome e id público no momento da cópia) e o código do link de origem.
-- Nenhuma chave para registros de quem compartilhou: a cópia é autossuficiente.
ALTER TABLE "PlanoAprendizado" ADD COLUMN "origemNome" TEXT;
ALTER TABLE "PlanoAprendizado" ADD COLUMN "origemPerfilId" TEXT;
ALTER TABLE "PlanoAprendizado" ADD COLUMN "origemCodigo" TEXT;
-- O mesmo link adicionado duas vezes pela mesma pessoa não duplica a trilha.
CREATE UNIQUE INDEX "PlanoAprendizado_usuarioId_origemCodigo_key" ON "PlanoAprendizado"("usuarioId", "origemCodigo");

-- Link de compartilhamento: um por trilha. Encerrar apaga a linha; apagar a trilha apaga o link (cascata).
CREATE TABLE "LinkTrilha" (
    "codigo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "noPerfil" BOOLEAN NOT NULL DEFAULT false,
    "adicoes" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LinkTrilha_pkey" PRIMARY KEY ("codigo")
);
CREATE UNIQUE INDEX "LinkTrilha_usuarioId_planoId_key" ON "LinkTrilha"("usuarioId", "planoId");
CREATE INDEX "LinkTrilha_usuarioId_noPerfil_idx" ON "LinkTrilha"("usuarioId", "noPerfil");
ALTER TABLE "LinkTrilha" ADD CONSTRAINT "LinkTrilha_usuarioId_planoId_fkey" FOREIGN KEY ("usuarioId", "planoId") REFERENCES "PlanoAprendizado"("usuarioId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
