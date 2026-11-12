-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "fuso" TEXT NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "TentativaLogin" (
    "chave" TEXT NOT NULL,
    "falhas" INTEGER NOT NULL,
    "janelaInicio" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TentativaLogin_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "PlanoAprendizado" (
    "usuarioId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanoAprendizado_pkey" PRIMARY KEY ("usuarioId","id")
);

-- CreateTable
CREATE TABLE "Fluxo" (
    "usuarioId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "Fluxo_pkey" PRIMARY KEY ("usuarioId","id")
);

-- CreateTable
CREATE TABLE "Licao" (
    "usuarioId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "fluxoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "conteudo" JSONB NOT NULL,

    CONSTRAINT "Licao_pkey" PRIMARY KEY ("usuarioId","id")
);

-- CreateTable
CREATE TABLE "RegistroEstudo" (
    "usuarioId" TEXT NOT NULL,
    "licaoId" TEXT NOT NULL,
    "concluidoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroEstudo_pkey" PRIMARY KEY ("usuarioId","licaoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Fluxo_usuarioId_planoId_ordem_key" ON "Fluxo"("usuarioId", "planoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "Licao_usuarioId_fluxoId_ordem_key" ON "Licao"("usuarioId", "fluxoId", "ordem");

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoAprendizado" ADD CONSTRAINT "PlanoAprendizado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fluxo" ADD CONSTRAINT "Fluxo_usuarioId_planoId_fkey" FOREIGN KEY ("usuarioId", "planoId") REFERENCES "PlanoAprendizado"("usuarioId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licao" ADD CONSTRAINT "Licao_usuarioId_fluxoId_fkey" FOREIGN KEY ("usuarioId", "fluxoId") REFERENCES "Fluxo"("usuarioId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroEstudo" ADD CONSTRAINT "RegistroEstudo_usuarioId_licaoId_fkey" FOREIGN KEY ("usuarioId", "licaoId") REFERENCES "Licao"("usuarioId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

