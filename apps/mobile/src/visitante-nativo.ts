import { ErroStudoo } from '@studoo/contratos';
import { criarClienteNativo, guardarToken } from './api-nativa';

let emCurso: Promise<string> | null = null;

/**
 * "Experimentar sem conta" (rodada 4.3): pede ao servidor uma conta temporária de visitante (24 horas, canal do app,
 * `POST /api/mobile/visitante`) e guarda o token no SecureStore, pelo mesmo caminho do login por senha. Se guardar falhar,
 * a sessão recém-criada é encerrada no servidor. Dois toques seguidos usam o mesmo pedido. O limite (`limite_visitante`)
 * chega como erro com o código, para a entrada mostrar o texto que já existe.
 */
export function entrarComoVisitante(): Promise<string> {
  if (emCurso) return emCurso;
  emCurso = (async () => {
    const { token } = await criarClienteNativo().entrarVisitanteNativo();
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ErroStudoo('falha');
    try {
      await guardarToken(token);
    } catch (erro) {
      await criarClienteNativo(token).logout().catch(() => undefined);
      throw erro;
    }
    return token;
  })().finally(() => { emCurso = null; });
  return emCurso;
}
