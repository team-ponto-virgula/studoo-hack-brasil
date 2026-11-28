import { rotaPublica } from '@/servidor/acesso/http';
import { retornarGoogle } from '@/servidor/acesso/google';
/** Endereço de retorno do Google cadastrado no Google Cloud. O /retorno antigo responde pela mesma função. */
export async function GET(request: Request) { return rotaPublica(request, () => retornarGoogle(request)); }
