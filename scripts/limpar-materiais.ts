import { banco } from '../src/servidor/banco/cliente';
// Agendar a cada hora no mesmo ambiente do servidor. Não imprime texto ou IDs de pessoas.
try {
  const resultado = await banco.materialEstudo.deleteMany({
    where: { expiraEm: { lte: new Date() } },
  });
  console.log(JSON.stringify({ materiaisExpiradosRemovidos: resultado.count }));
} finally {
  await banco.$disconnect();
}
