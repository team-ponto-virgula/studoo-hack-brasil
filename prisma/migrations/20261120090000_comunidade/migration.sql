-- Comunidade (spec 10, etapa B): publicar no Explorar, Em alta, Valeu e Denunciar. Só acrescenta: nada existente muda.

-- Link publicado no Explorar (também aparece no perfil), com tema e legenda; "oculta" com 3 denúncias de contas distintas.
ALTER TABLE "LinkTrilha" ADD COLUMN "noExplorar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LinkTrilha" ADD COLUMN "tema" TEXT;
ALTER TABLE "LinkTrilha" ADD COLUMN "legenda" TEXT;
ALTER TABLE "LinkTrilha" ADD COLUMN "publicadaEm" TIMESTAMPTZ(3);
ALTER TABLE "LinkTrilha" ADD COLUMN "oculta" BOOLEAN NOT NULL DEFAULT false;
-- "Novas" do Explorar por cursor (publicadaEm, codigo).
CREATE INDEX "LinkTrilha_noExplorar_oculta_publicadaEm_codigo_idx" ON "LinkTrilha"("noExplorar", "oculta", "publicadaEm" DESC, "codigo" DESC);

-- Adição e valeu com data, um por conta por trilha (o Em alta soma os dos últimos 7 dias).
CREATE TABLE "EventoTrilha" (
    "codigo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoTrilha_pkey" PRIMARY KEY ("codigo","usuarioId","tipo")
);
CREATE INDEX "EventoTrilha_tipo_criadoEm_idx" ON "EventoTrilha"("tipo", "criadoEm");
CREATE INDEX "EventoTrilha_usuarioId_tipo_idx" ON "EventoTrilha"("usuarioId", "tipo");
ALTER TABLE "EventoTrilha" ADD CONSTRAINT "EventoTrilha_codigo_fkey" FOREIGN KEY ("codigo") REFERENCES "LinkTrilha"("codigo") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoTrilha" ADD CONSTRAINT "EventoTrilha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Denúncia de trilha ou perfil, uma por conta por alvo. Sem painel: banco e uma linha no log.
CREATE TABLE "Denuncia" (
    "id" TEXT NOT NULL,
    "alvoTipo" TEXT NOT NULL,
    "alvo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Denuncia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Denuncia_alvoTipo_alvo_usuarioId_key" ON "Denuncia"("alvoTipo", "alvo", "usuarioId");
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
