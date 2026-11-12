import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./gerado/client";

function criarCliente() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL ausente.");
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const instancia = globalThis as typeof globalThis & { bancoStudoo?: PrismaClient };

export const banco = instancia.bancoStudoo ?? criarCliente();

if (process.env.NODE_ENV !== "production") {
  instancia.bancoStudoo = banco;
}
