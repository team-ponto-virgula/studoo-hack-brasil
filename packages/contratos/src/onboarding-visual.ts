/** Ritmo visual compartilhado do primeiro estudo. Não altera o contrato HTTP. */
export const VISUAL_ONBOARDING = {
  cores: {
    tinta: '#17213d', secundario: '#626b7e', azul: '#2854f4',
    superficie: '#f5f7ff', borda: '#e2e8f7', azulSuave: '#edf1ff',
    azulLinha: '#cdd8ff', branco: '#ffffff',
  },
  raio: { campo: 16, cartao: 20, botao: 16 },
  cena: { altura: 184, stu: 176, baseLargura: 248, baseAltura: 136 },
  vitoria: { altura: 140, stu: 136 },
  titulo: { tamanho: 32, linha: 38, peso: '700' as const, entreletra: -1.1 },
  descricao: { tamanho: 15, linha: 23 },
} as const;

export const PRIMEIRA_VITORIA_VISUAL = {
  titulo: 'Primeira lição concluída!', descricao: 'Seu progresso está salvo.',
} as const;

export const BENEFICIOS_ONBOARDING = [
  { titulo: 'Seu assunto vira\numa trilha.', rotulo: 'Seu assunto vira uma trilha',
    descricao: 'Conte o que quer aprender ou traga um material. O Studoo organiza o caminho para você.', stu: 'stu-acolhida' },
  { titulo: 'Um erro abre\noutro caminho.', rotulo: 'Um erro abre outro caminho',
    descricao: 'Errou uma resposta? Veja outra explicação e tente de novo.', stu: 'stu-feliz' },
  { titulo: 'Continue de\nonde parou.', rotulo: 'Continue de onde parou',
    descricao: 'Na sua conta, veja o que já aprendeu e encontre seu próximo passo quando voltar.', stu: 'stu-celebrando' },
] as const;

export const METAS_VISUAIS_ONBOARDING = [
  { valor: 1 as const, titulo: 'Leve', descricao: '1 lição por dia' },
  { valor: 2 as const, titulo: 'Constante', descricao: '2 lições por dia' },
  { valor: 3 as const, titulo: 'Intenso', descricao: '3 lições por dia' },
] as const;
