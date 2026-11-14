import {
  LIMITES_ESTUDIO,
  type ArquivoEstudo,
  type PaginaMaterial,
} from '@studoo/contratos';
import sharp from 'sharp';
import { lerDocx, lerCsv } from './documentos';
import { FalhaApi } from '../acesso/http';
import { objeto, lista, texto, pedirJson } from './ia';

export function validarArquivo(entrada: unknown): {
  arquivo: ArquivoEstudo;
  bytes: Buffer;
} {
  if (!entrada || typeof entrada !== 'object')
    throw new FalhaApi('material_invalido');
  const a = entrada as ArquivoEstudo;
  if (
    typeof a.nome !== 'string' ||
    !a.nome.trim() ||
    a.nome.length > 160 ||
    /[\x00-\x1f/\\]/.test(a.nome) ||
    typeof a.tipo !== 'string' ||
    typeof a.base64 !== 'string' ||
    a.base64.length > Math.ceil(LIMITES_ESTUDIO.arquivoBytes / 3) * 4
  )
    throw new FalhaApi('material_invalido');
  const bytes = Buffer.from(a.base64, 'base64');
  // Comparação canônica evita regex com grupos repetidos, que estoura a pilha em arquivos grandes.
  if (
    !bytes.length ||
    bytes.length > LIMITES_ESTUDIO.arquivoBytes ||
    bytes.toString('base64') !== a.base64
  )
    throw new FalhaApi('material_invalido');
  return { arquivo: a, bytes };
}
export function paginasValidas(
  paginas: unknown,
  totalMaximo: number = LIMITES_ESTUDIO.paginas,
): paginas is PaginaMaterial[] {
  return (
    Array.isArray(paginas) &&
    paginas.length > 0 &&
    paginas.length <= totalMaximo &&
    paginas.every(
      (p, i) =>
        p &&
        p.numero === i + 1 &&
        typeof p.texto === 'string' &&
        p.texto.length <= 12000 &&
        (p.rotulo === undefined ||
          (typeof p.rotulo === 'string' && p.rotulo.length <= 100)) &&
        (p.tabela === undefined ||
          (Array.isArray(p.tabela) &&
            p.tabela.length <= 40 &&
            p.tabela.every(
              (l: unknown) =>
                Array.isArray(l) &&
                l.length <= LIMITES_ESTUDIO.csvColunas &&
                l.every((c) => typeof c === 'string' && c.length <= 2000),
            ))),
    ) &&
    paginas.reduce((t, p) => t + p.texto.length, 0) <= LIMITES_ESTUDIO.texto &&
    paginas.some((p) => p.texto.trim().length >= 30)
  );
}
export async function lerMaterial(entrada: unknown) {
  const { arquivo, bytes } = validarArquivo(entrada);
  const extensao = arquivo.nome.toLowerCase().split('.').pop();
  const docx =
    extensao === 'docx' &&
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
      'application/zip',
      '',
    ].includes(arquivo.tipo);
  const csv =
    extensao === 'csv' &&
    [
      'text/csv',
      'application/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/octet-stream',
      '',
    ].includes(arquivo.tipo);
  if (docx || csv) {
    const paginas = docx ? await lerDocx(bytes) : lerCsv(bytes);
    if (!paginasValidas(paginas)) throw new FalhaApi('material_invalido');
    return { paginas, leitura: 'texto' as const };
  }
  let paginas: PaginaMaterial[] = [];
  let anexo: unknown;
  let total = 1;
  if (
    arquivo.tipo === 'application/pdf' &&
    bytes.subarray(0, 5).toString() === '%PDF-'
  ) {
    // Limite de páginas antes de enviar ao provedor; JS embutido não é executado.
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const tarefa = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: false,
      disableFontFace: true,
    });
    try {
      const pdf = await tarefa.promise;
      total = pdf.numPages;
      if (total > LIMITES_ESTUDIO.paginas)
        throw new FalhaApi('material_invalido');
      for (let i = 1; i <= total; i++) {
        const pagina = await pdf.getPage(i);
        const content = await pagina.getTextContent();
        const text = content.items
          .map((x) => ('str' in x ? x.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        paginas.push({ numero: i, texto: text });
      }
    } catch (erro) {
      throw erro instanceof FalhaApi ? erro : new FalhaApi('material_ilegivel');
    } finally {
      await tarefa.destroy();
    }
    if (
      paginas.some((p) => p.texto.length > 12000) ||
      paginas.reduce((t, p) => t + p.texto.length, 0) > LIMITES_ESTUDIO.texto
    )
      throw new FalhaApi('material_invalido');
    if (
      paginasValidas(paginas) &&
      paginas.every((p) => p.texto.trim().length >= 30)
    )
      return { paginas, leitura: 'texto' as const };
    anexo = {
      type: 'input_file',
      filename: 'material.pdf',
      file_data: `data:application/pdf;base64,${arquivo.base64}`,
    };
  } else if (['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.tipo)) {
    try {
      const imagem = sharp(bytes, { limitInputPixels: 20_000_000 });
      const meta = await imagem.metadata();
      if (
        meta.format !==
        { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' }[
          arquivo.tipo
        ]
      )
        throw new Error();
      const normalizada = await imagem
        .rotate()
        .resize({
          width: 1800,
          height: 1800,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
      anexo = {
        type: 'input_image',
        image_url: `data:image/jpeg;base64,${normalizada.toString('base64')}`,
      };
    } catch {
      throw new FalhaApi('material_invalido');
    }
  } else throw new FalhaApi('material_invalido');
  const resultado = await pedirJson(
    'leitura_material',
    objeto({ paginas: lista(objeto({ numero: { type: 'integer' }, texto })) }),
    `Transcreva fielmente o texto legível de cada página, sem interpretar, resumir ou completar. Preserve números e equações. Há ${total} página(s), numeradas de 1 a ${total}. Texto ilegível deve ficar vazio. Máximo 24000 caracteres no total.`,
    {},
    [anexo],
  );
  paginas = (resultado as { paginas?: PaginaMaterial[] })?.paginas ?? [];
  if (!paginasValidas(paginas, total) || paginas.length !== total)
    throw new FalhaApi('material_ilegivel');
  return { paginas, leitura: 'ocr' as const };
}
