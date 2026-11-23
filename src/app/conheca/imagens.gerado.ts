// Escrito por scripts/otimizar-capturas-landing.mjs. Não editar à mão: rode o script de novo com as capturas nativas.
import type { CapturaOtimizada } from './imagens';

export const CAPTURAS = {
  'heroi-1': { plataforma: 'iphone', provisoria: true, src1x: '/landing/heroi-1-1x.9b9b6078.webp', src2x: '/landing/heroi-1-2x.909aef1e.webp', largura: 320, altura: 696, origem: "iPhone, simulador iPhone 17 Pro (iOS 26.5), Expo Go com o JS do build 4, rodada 45124218880 (teste/final-wk4)" },
  'heroi-2': { plataforma: 'android', provisoria: true, src1x: '/landing/heroi-2-1x.50659a37.webp', src2x: '/landing/heroi-2-2x.a6205d94.webp', largura: 320, altura: 693, origem: "Android, emulador Pixel 6 (Android 15), build de debug do projeto, rodada 45118526529 (teste/final-wk3)" },
  'heroi-3': { plataforma: 'iphone', provisoria: true, src1x: '/landing/heroi-3-1x.0a0418eb.webp', src2x: '/landing/heroi-3-2x.b001af9a.webp', largura: 320, altura: 696, origem: "iPhone, simulador iPhone 17 Pro (iOS 26.5), Expo Go com o JS do build 4, rodada 45137054494 (teste/final-n2)" },
  'momento-1': { plataforma: 'iphone', provisoria: true, src1x: '/landing/momento-1-1x.0a0418eb.webp', src2x: '/landing/momento-1-2x.b001af9a.webp', largura: 320, altura: 696, origem: "PROVISÓRIA (a lição com \"Fonte do seu material\" ainda não chegou do Mobile & QA): usa a lição com o acerto do iPhone, rodada 45137054494 (teste/final-n2)" },
  'momento-2': { plataforma: 'iphone', provisoria: false, src1x: '/landing/momento-2-1x.5872deca.webp', src2x: '/landing/momento-2-2x.36f8019f.webp', largura: 320, altura: 696, origem: "iPhone, simulador iPhone 17 Pro (iOS 26.5), Expo Go com o JS do build 4, rodada 45137054494 (teste/final-n2)" },
  'momento-3': { plataforma: 'android', provisoria: false, src1x: '/landing/momento-3-1x.834b2b57.webp', src2x: '/landing/momento-3-2x.d93b1d1a.webp', largura: 320, altura: 693, origem: "Android, emulador Pixel 6 (Android 15), build de debug do projeto, rodada 45137054494 (teste/final-n2)" },
  'momento-4': { plataforma: 'iphone', provisoria: false, src1x: '/landing/momento-4-1x.435a485f.webp', src2x: '/landing/momento-4-2x.c84e5845.webp', largura: 320, altura: 696, origem: "iPhone, simulador iPhone 17 Pro (iOS 26.5), Expo Go com o JS do build 4, rodada 45124218880 (teste/final-wk4)" },
  'janela-4': { plataforma: 'web', provisoria: false, src1x: '/landing/janela-4-1x.7b2c14b7.webp', src2x: '/landing/janela-4-2x.8a957a40.webp', largura: 440, altura: 294, origem: "Web, Chromium em 1024 × 684 a 2×, servidor de ensaio da worktree web-landing (IA falsa): a trilha \"Inglês para viagem\" (a mesma da captura do iPhone) com 2 de 7 lições feitas, conta de visitante nova, mapa no alto" },
} as const satisfies Record<string, CapturaOtimizada>;

export type IdDaCaptura = keyof typeof CAPTURAS;
