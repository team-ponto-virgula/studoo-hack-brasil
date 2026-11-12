import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./gerado/client";

function criarCliente() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL ausente.");
  }

  // O adaptador Prisma interpreta timestamps do PostgreSQL em UTC.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, options: "-c TimeZone=UTC" }) });
}

const instancia = globalThis as typeof globalThis & { bancoStudoo?: PrismaClient };

export const banco = instancia.bancoStudoo ?? criarCliente();

if (process.env.NODE_ENV !== "production") {
  instancia.bancoStudoo = banco;
}
