import type { Metadata } from 'next';
import { mensagens } from '../mensagens/pt-BR';
import { Stu } from '../ui';
import { PaginaPublica } from './publico';
import './compartilhar.css';

const n = mensagens.naoEncontrada;

export const metadata: Metadata = { title: `${n.titulo} · Studoo`, robots: { index: false, follow: false } };

/** Endereço que não existe: a página 404 própria, em português, com o Stu e a volta para o início. */
export default function PaginaNaoEncontrada() {
  return (
    <PaginaPublica>
      <section className="pagina-publica__vazio pagina-publica__vazio--centro">
        <Stu />
        <h1>{n.titulo}</h1>
        <p className="folha-texto">{n.texto}</p>
        <a className="botao botao--primario" href="/">{n.voltar}</a>
      </section>
    </PaginaPublica>
  );
}
