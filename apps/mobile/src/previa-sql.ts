import {
  criarClienteStudoo,
  type CodigoErro,
  type PropostaPlano,
  type TransporteStudoo,
} from '@studoo/contratos';

const propostaSql: PropostaPlano = {
  token: 'previa-sintetica',
  titulo: 'SQL para a prova',
  objetivo: 'Praticar filtros e junções em consultas.',
  origem: 'Conhecimento geral de SQL',
  fluxos: [
    {
      titulo: 'Consultas',
      licoes: [
        { titulo: 'Filtrar com WHERE incluindo o valor no limite' },
        { titulo: 'Combinar condições com AND' },
      ],
    },
    {
      titulo: 'Junções',
      licoes: [
        { titulo: 'Relacionar tabelas com INNER JOIN' },
        { titulo: 'Incluir linhas sem par com LEFT JOIN' },
      ],
    },
  ],
};

function respostaJson(corpo: PropostaPlano | { codigo: CodigoErro }, status: number) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => corpo,
  };
}

const transporteSintetico: TransporteStudoo = async (recurso, opcoes) => {
  if (recurso !== '/api/aprendizado/propostas' || opcoes.method !== 'POST') {
    return respostaJson({ codigo: 'nao_encontrado' }, 404);
  }

  let objetivo: unknown;
  try {
    const corpo = typeof opcoes.body === 'string' ? JSON.parse(opcoes.body) : null;
    objetivo = corpo?.objetivo;
  } catch {
    return respostaJson({ codigo: 'invalido' }, 400);
  }

  const texto = typeof objetivo === 'string' ? objetivo.trim() : '';
  if (!texto || texto.length > 1000) return respostaJson({ codigo: 'invalido' }, 400);
  if (!/\b(?:sql|postgres(?:ql)?|mysql|sqlite|select|where|join)\b/i.test(texto)) {
    return respostaJson({ codigo: 'objetivo_fora_do_piloto' }, 422);
  }

  return respostaJson(propostaSql, 200);
};

export const clienteDaPrevia = criarClienteStudoo(transporteSintetico);
