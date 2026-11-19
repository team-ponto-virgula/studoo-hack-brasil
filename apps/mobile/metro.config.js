// Configuração do Metro: a padrão do Expo, mais o X-Forwarded-Proto de um valor só no servidor de desenvolvimento
// (o Expo Go de iPhone, pelo túnel, manda "http, https" e o Metro respondia 500; ver metro-cabecalhos.js).
const { getDefaultConfig } = require('expo/metro-config');
const { comProtocoloUnico } = require('./metro-cabecalhos');

module.exports = comProtocoloUnico(getDefaultConfig(__dirname));
