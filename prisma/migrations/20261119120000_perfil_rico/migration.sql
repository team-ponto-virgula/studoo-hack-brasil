-- Perfil rico (spec 10, etapa A). Só acrescenta: nada existente muda.

-- Resumo (até 160 caracteres) e interesses (até 5 temas da lista fixa) do perfil.
ALTER TABLE "Usuario" ADD COLUMN "perfilResumo" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "perfilInteresses" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Foto do perfil: 512 e 128 px em WebP (sem EXIF). O token aleatório é o endereço público e muda a cada troca.
CREATE TABLE "FotoPerfil" (
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "grande" BYTEA NOT NULL,
    "pequena" BYTEA NOT NULL,
    "criadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotoPerfil_pkey" PRIMARY KEY ("usuarioId")
);
CREATE UNIQUE INDEX "FotoPerfil_token_key" ON "FotoPerfil"("token");
ALTER TABLE "FotoPerfil" ADD CONSTRAINT "FotoPerfil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
