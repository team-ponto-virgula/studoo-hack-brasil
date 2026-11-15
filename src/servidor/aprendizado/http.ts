import { FalhaApi, lerJson } from "@/servidor/acesso/http";

export async function lerCampoTexto(request: Request, campo: string): Promise<string> {
  const corpo = await lerJson(request);
  if (typeof corpo !== "object" || corpo === null || !Object.hasOwn(corpo, campo)) {
    throw new FalhaApi("invalido");
  }

  const texto: unknown = Reflect.get(corpo, campo);
  if (typeof texto !== "string") {
    throw new FalhaApi("invalido");
  }

  return texto;
}

/** Corpo JSON como objeto (para rotas com mais de um campo). */
export async function lerObjeto(request: Request): Promise<Record<string, unknown>> {
  const corpo = await lerJson(request);
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    throw new FalhaApi("invalido");
  }
  return corpo as Record<string, unknown>;
}
