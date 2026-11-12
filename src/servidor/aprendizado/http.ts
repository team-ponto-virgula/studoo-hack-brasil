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
