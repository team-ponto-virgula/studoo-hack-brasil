import mammoth from 'mammoth';
import Papa from 'papaparse';
import { unzipSync } from 'fflate';
import { LIMITES_ESTUDIO, type PaginaMaterial } from '@studoo/contratos';
import { FalhaApi } from '../acesso/http';

/** Somente texto: DOCX não é convertido em HTML e não recebe caminho de acesso ao disco. */
export async function lerDocx(bytes: Buffer): Promise<PaginaMaterial[]> {
  try {
    let entradas = 0;
    let expandido = 0;
    const documento = unzipSync(new Uint8Array(bytes), {
      filter: (entrada) => {
        entradas += 1;
        expandido += entrada.originalSize;
        if (
          entradas > 1500 ||
          expandido > 20 * 1024 * 1024 ||
          /(^|\/)\.\.(\/|$)|^\//.test(entrada.name)
        )
          throw new Error('arquivo');
        // Só descompacta o XML principal nesta inspeção. A soma inclui todas as entradas.
        return entrada.name === 'word/document.xml';
      },
    });
    if (!documento['word/document.xml']) throw new Error('formato');
    const xml = new TextDecoder().decode(documento['word/document.xml']);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('xml');
    const resultado = await mammoth.extractRawText({ buffer: bytes });
    const paragrafos = resultado.value
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!paragrafos.length || resultado.value.length > LIMITES_ESTUDIO.texto)
      throw new Error('tamanho');
    const paginas: PaginaMaterial[] = [];
    let grupo: string[] = [];
    let inicio = 1;
    const fechar = (fim: number) => {
      if (!grupo.length) return;
      paginas.push({
        numero: paginas.length + 1,
        rotulo:
          inicio === fim
            ? `Parágrafo ${inicio}`
            : `Parágrafos ${inicio}–${fim}`,
        texto: grupo.join('\n\n'),
      });
      grupo = [];
      inicio = fim + 1;
    };
    paragrafos.forEach((p, i) => {
      if (grupo.length && grupo.join('\n\n').length + p.length > 4000)
        fechar(i);
      grupo.push(p);
    });
    fechar(paragrafos.length);
    if (paginas.length > LIMITES_ESTUDIO.paginas) throw new Error('tamanho');
    return paginas;
  } catch {
    throw new FalhaApi('material_invalido');
  }
}

/** Valores continuam strings: zeros à esquerda, datas e fórmulas não são executados nem convertidos. */
export function lerCsv(bytes: Buffer): PaginaMaterial[] {
  try {
    const texto = new TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, '');
    if (
      texto.length > LIMITES_ESTUDIO.texto ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(texto)
    )
      throw new Error('texto');
    const csv = Papa.parse<string[]>(texto, {
      dynamicTyping: false,
      skipEmptyLines: 'greedy',
      delimitersToGuess: [',', ';', '\t', '|'],
    });
    if (
      csv.errors.some((e) => e.code !== 'UndetectableDelimiter') ||
      !csv.data.length ||
      csv.data.length > LIMITES_ESTUDIO.csvLinhas ||
      csv.data.some(
        (l) =>
          l.length > LIMITES_ESTUDIO.csvColunas ||
          l.some((c) => c.length > 2000),
      )
    )
      throw new Error('tabela');
    const paginas: PaginaMaterial[] = [];
    for (let i = 0; i < csv.data.length; i += 40) {
      const tabela = csv.data.slice(i, i + 40);
      paginas.push({
        numero: paginas.length + 1,
        rotulo: `Linhas ${i + 1}–${i + tabela.length}`,
        tabela,
        texto: tabela
          .map((linha, j) => `Linha ${i + j + 1}: ${JSON.stringify(linha)}`)
          .join('\n'),
      });
    }
    return paginas;
  } catch {
    throw new FalhaApi('material_invalido');
  }
}
