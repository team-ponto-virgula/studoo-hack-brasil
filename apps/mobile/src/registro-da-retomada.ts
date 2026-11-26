// Marcadores da prova nativa, sem dados da conta ou da trilha.
export function registrarToqueDaRetomada(etapa: string) {
  if (process.env.EXPO_PUBLIC_STUDOO_REGISTRO_RETOMADA === '1') {
    console.info(`[retomada-app] ${etapa} ${Date.now()}`);
  }
}
