import { rotaPublica } from '@/servidor/acesso/http';
import { iniciarGoogle } from '@/servidor/acesso/google';
export async function GET(request: Request) { return rotaPublica(request, () => iniciarGoogle(request)); }
