// Cabeçalhos do servidor de desenvolvimento (Metro) atrás de túnel ou proxy.
//
// O Expo Go de iPhone pede o pacote com dois valores em X-Forwarded-Proto ("http" do app e "https" do túnel, chegando como
// "http, https"). O Metro monta a base da URL com o cabeçalho inteiro (`new URL(req.url, reqProtocol + "://" + reqHost)`
// em metro/src/Server.js), o analisador recusa ("http, https://…" não é URL) e o pedido cai em 500: no aparelho, "Failed to
// load all assets". Aqui o cabeçalho fica com um valor só antes de o Metro ler. Só o servidor de desenvolvimento passa por
// aqui: o export (o pacote do app, de Android, iOS e web) não muda.

/**
 * Um valor só para X-Forwarded-Proto: sem vírgula, fica como veio; com vários valores, "https" se algum for "https" (o túnel
 * termina o TLS do lado de fora), senão o primeiro.
 */
function protocoloUnico(valor) {
  if (typeof valor !== 'string' || !valor.includes(',')) return valor;
  const valores = valor.split(',').map((parte) => parte.trim()).filter(Boolean);
  return valores.includes('https') ? 'https' : valores[0];
}

/** A configuração do Metro com o protocolo de um valor só, sem perder um enhanceMiddleware que já exista. */
function comProtocoloUnico(config) {
  const anterior = config.server && config.server.enhanceMiddleware;
  return {
    ...config,
    server: {
      ...config.server,
      enhanceMiddleware: (middleware, servidor) => {
        const seguinte = anterior ? anterior(middleware, servidor) : middleware;
        return (req, res, next) => {
          const proto = req.headers['x-forwarded-proto'];
          const unico = protocoloUnico(proto);
          if (unico !== proto) req.headers['x-forwarded-proto'] = unico;
          return seguinte(req, res, next);
        };
      },
    },
  };
}

module.exports = { protocoloUnico, comProtocoloUnico };
