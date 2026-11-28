// Escrito por scripts/otimizar-stu-landing.mjs. Não editar à mão: rode o script de novo.
export interface StuDaPagina {
  /** Largura e altura do menor arquivo: reservam o lugar antes de carregar (a proporção é a mesma em todos). */
  largura: number;
  altura: number;
  /** WebP em mais de uma largura; o navegador escolhe pelo `sizes` do lugar e pela densidade da tela. */
  fontes: readonly { src: string; largura: number }[];
}

export const STU_DA_PAGINA = {
  'stu-acolhida': { largura: 320, altura: 312, fontes: [{ src: '/landing/stu-acolhida-320w.904faff4.webp', largura: 320 }, { src: '/landing/stu-acolhida-480w.87e2d169.webp', largura: 480 }, { src: '/landing/stu-acolhida-720w.bd1ec811.webp', largura: 720 }] },
  'stu-celebrando': { largura: 320, altura: 283, fontes: [{ src: '/landing/stu-celebrando-320w.ee820e8c.webp', largura: 320 }, { src: '/landing/stu-celebrando-480w.4bbb7a64.webp', largura: 480 }, { src: '/landing/stu-celebrando-720w.c5e2b76f.webp', largura: 720 }] },
  'stu-estudando': { largura: 240, altura: 194, fontes: [{ src: '/landing/stu-estudando-240w.2a892842.webp', largura: 240 }, { src: '/landing/stu-estudando-400w.13840358.webp', largura: 400 }] },
  'stu-curioso': { largura: 200, altura: 200, fontes: [{ src: '/landing/stu-curioso-200w.bd3670e6.webp', largura: 200 }, { src: '/landing/stu-curioso-400w.55c1629f.webp', largura: 400 }] },
  'stu-concentrado': { largura: 200, altura: 200, fontes: [{ src: '/landing/stu-concentrado-200w.5b294480.webp', largura: 200 }, { src: '/landing/stu-concentrado-400w.92a30af3.webp', largura: 400 }] },
  'stu-animado': { largura: 200, altura: 200, fontes: [{ src: '/landing/stu-animado-200w.a6a1d569.webp', largura: 200 }, { src: '/landing/stu-animado-400w.d2675d02.webp', largura: 400 }] },
  'stu-encorajador': { largura: 200, altura: 200, fontes: [{ src: '/landing/stu-encorajador-200w.86d89b82.webp', largura: 200 }, { src: '/landing/stu-encorajador-400w.aab35c0c.webp', largura: 400 }] },
  'stu-tres-quartos': { largura: 160, altura: 160, fontes: [{ src: '/landing/stu-tres-quartos-160w.66004d4e.webp', largura: 160 }, { src: '/landing/stu-tres-quartos-320w.1367d749.webp', largura: 320 }] },
  'stu-perfil': { largura: 96, altura: 96, fontes: [{ src: '/landing/stu-perfil-96w.7854ce6b.webp', largura: 96 }, { src: '/landing/stu-perfil-192w.94b2de8f.webp', largura: 192 }] },
} as const satisfies Record<string, StuDaPagina>;

export type NomeDoStuDaPagina = keyof typeof STU_DA_PAGINA;
