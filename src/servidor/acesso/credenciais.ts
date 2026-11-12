import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derivarChave = promisify(scrypt);
const tamanhoChave = 64;
const salFicticio = randomBytes(16);
const hashFicticio = `${salFicticio.toString("hex")}.${scryptSync(randomBytes(32), salFicticio, tamanhoChave).toString("hex")}`;

export function normalizarEmail(email: unknown): string | null {
  if (typeof email !== "string" || email.length > 254) return null;
  const normalizado = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado) ? normalizado : null;
}

export function senhaValida(senha: unknown): senha is string {
  return typeof senha === "string" && senha.length >= 8 && senha.length <= 256;
}

export async function criarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = (await derivarChave(senha, sal, tamanhoChave)) as Buffer;
  return `${sal.toString("hex")}.${hash.toString("hex")}`;
}

export async function verificarSenha(senha: unknown, hashSalvo?: string): Promise<boolean> {
  const [sal, hash] = (hashSalvo ?? hashFicticio).split(".");
  const candidata = senhaValida(senha) ? senha : "credencial-invalida";
  const calculado = (await derivarChave(candidata, Buffer.from(sal, "hex"), tamanhoChave)) as Buffer;
  const esperado = Buffer.from(hash, "hex");
  const corresponde = calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
  return hashSalvo !== undefined && senhaValida(senha) && corresponde;
}
