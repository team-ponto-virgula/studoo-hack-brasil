'use client';

import marcaGoogle from '../../packages/contratos/assets/google-g.png';
import marcaGoogle2x from '../../packages/contratos/assets/google-g@2x.png';
import marcaGoogle3x from '../../packages/contratos/assets/google-g@3x.png';
import { mensagens } from '../mensagens/pt-BR';
import { Botao } from '../ui';

/** A autorização usa a navegação principal do Studoo, inclusive quando começa no cadastro. */
export function BotaoGoogle({ ocupado = false }: { ocupado?: boolean }) {
  return (
    <Botao variante="secundario" className="botao-google" disabled={ocupado}
      onClick={() => window.location.assign('/api/auth/google/iniciar')}>
      <img src={marcaGoogle.src} srcSet={`${marcaGoogle2x.src} 2x, ${marcaGoogle3x.src} 3x`}
        width={20} height={20} alt="" aria-hidden="true" />
      {mensagens.acesso.google}
    </Botao>
  );
}
