CREATE TYPE "CanalSessao" AS ENUM ('WEB', 'MOBILE');

ALTER TABLE "Sessao" ADD COLUMN "canal" "CanalSessao" NOT NULL DEFAULT 'WEB';
