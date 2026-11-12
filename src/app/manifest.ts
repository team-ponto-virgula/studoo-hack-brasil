import type { MetadataRoute } from 'next';
import { mensagens } from '../mensagens/pt-BR';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    start_url: '/',
    scope: '/',
    name: mensagens.nome,
    short_name: mensagens.nome,
    description: mensagens.descricao,
    lang: 'pt-BR',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    icons: [
      { src: '/marca/icone-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/marca/icone-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
