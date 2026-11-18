import { banco } from '../src/servidor/banco/cliente';
import { limparExpirados } from '../src/servidor/estudio/limpeza';

// Agendar a cada hora no mesmo ambiente do servidor. Não imprime texto ou IDs de pessoas.
try {
  const resultado = await limparExpirados();
  console.log(JSON.stringify(resultado));
} finally {
  await banco.$disconnect();
}
