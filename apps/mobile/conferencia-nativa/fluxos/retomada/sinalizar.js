const resposta = http.post(CONTROLE_RETOMADA + '/retomada/' + MARCO, { body: '' });
if (resposta.status !== 204) {
  throw new Error('Controle da retomada recusou ' + MARCO + ' (HTTP ' + resposta.status + ').');
}
