import { rotaPublica } from '@/servidor/acesso/http';
import { retornarGoogle } from '@/servidor/acesso/google';
export async function GET(request: Request) { return rotaPublica(request, () => retornarGoogle(request)); }
