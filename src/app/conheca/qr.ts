import { FUNDO_DA_COR, svgCodigoDoLink } from '@studoo/contratos';

const guardados = new Map<string, string>();

/**
 * O QR da página (spec 18, 1.6): o Código Studoo (pontos arredondados, olhos e sorriso do Stu), desenhado no servidor a partir da
 * função pura do contrato (a mesma dos códigos de link). É SVG puro, sem <style> nem <script>, então passa na política de segurança do
 * site. Guarda os últimos desenhos: o endereço quase nunca muda.
 */
export function svgDoQr(endereco: string, tamanho = 272): string {
  const chave = `${tamanho}\n${endereco}`;
  const guardado = guardados.get(chave);
  if (guardado) return guardado;
  const svg = svgCodigoDoLink(endereco, { mioloCor: FUNDO_DA_COR.azul, estilo: 'rosto', tamanho, letraNoCentro: false });
  if (guardados.size >= 8) guardados.clear();
  guardados.set(chave, svg);
  return svg;
}
