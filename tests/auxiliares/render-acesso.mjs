import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registerHooks } from 'node:module';
import { DOMParser } from '@xmldom/xmldom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';

// Node não carrega folhas nem imagens. O render usa os componentes reais, mantendo os
// caminhos de imagem; não substitui transporte, estado, ações ou regras de autenticação.
const recursos = registerHooks({
  load(url, contexto, proximo) {
    if (/\.css(?:\?|$)/.test(url)) return { format: 'module', source: 'export default {};', shortCircuit: true };
    if (/\.(png|webp|svg)(?:\?|$)/.test(url)) {
      const caminho = new URL(url).pathname;
      return { format: 'module', source: `export default ${JSON.stringify({ src: caminho, width: 20, height: 20 })};`, shortCircuit: true };
    }
    return proximo(url, contexto);
  },
});
const [{ Entrada }, { Cadastro }, { BoasVindas }] = await Promise.all([
  import('../../src/app/login/entrada.tsx'),
  import('../../src/app/cadastro/cadastro.tsx'),
  import('../../src/app/boas-vindas/tela.tsx'),
]);
recursos.deregister();

const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };

function renderizar(componente, props) {
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(componente, props)));
  return new DOMParser({ errorHandler: { warning() {}, error(mensagem) { throw new Error(mensagem); }, fatalError(mensagem) { throw new Error(mensagem); } } }).parseFromString(`<html><body>${html}</body></html>`, 'text/html');
}

export const renderizarEntrada = (config = { google: true, cadastro: true, visitante: true, recuperacao: true }) => renderizar(Entrada, { configInicial: config, sessaoVerificada: true });
export const renderizarCadastro = (flags = { googleDisponivel: true, emailDisponivel: true }) => renderizar(Cadastro, flags);
export const renderizarBoasVindas = () => renderizar(BoasVindas, { cadastroDisponivel: true });
export const elementos = (documento, nome) => Array.from(documento.getElementsByTagName(nome));
export const porId = (documento, id) => elementos(documento, '*').find(elemento => elemento.getAttribute('id') === id);
export const visivel = (elemento) => {
  for (let atual = elemento; atual && atual.nodeType === 1; atual = atual.parentNode) if (atual.hasAttribute('hidden')) return false;
  return true;
};
