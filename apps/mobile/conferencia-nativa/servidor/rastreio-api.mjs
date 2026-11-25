import { channel } from 'node:diagnostics_channel';

export const CABECALHO_RASTREIO = 'x-studoo-conferencia-id';
export const CAMINHOS_RASTREADOS = new Set([
  '/api/auth/config',
  '/api/privacidade',
  '/api/mobile/sessao',
  '/api/sessao',
  '/api/aprendizado/planos',
  '/api/aprendizado/diagnostico',
]);

export function registrarRede(camada, etapa, dados) {
  console.log(JSON.stringify({ hora: new Date().toISOString(), camada, etapa, ...dados }));
}

// Carregado antes do Next apenas na conferência. O mesmo identificador sai do proxy e chega ao servidor HTTP da API.
if (process.env.CONFERENCIA_RASTREAR_ORIGEM_API === '1') {
  channel('http.server.request.start').subscribe(({ request, response }) => {
    const id = request.headers[CABECALHO_RASTREIO];
    const caminho = (request.url ?? '/').split('?', 1)[0];
    if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id) || !CAMINHOS_RASTREADOS.has(caminho)) return;

    const dados = { id, metodo: request.method, caminho };
    registrarRede('api', 'pedido_recebido', dados);
    response.once('finish', () => registrarRede('api', 'resposta_entregue_ao_socket', { ...dados, status: response.statusCode }));
    response.once('close', () => {
      if (!response.writableFinished) registrarRede('api', 'conexao_encerrada_antes_da_resposta', dados);
    });
  });
}
