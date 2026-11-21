/*
 * Os dados das lições de geometria analítica da demonstração: as três lições das fixtures de teste (`tests/fixtures/matematica`), no
 * formato que a IA devolve (a figura, a resolução em passos e o exercício com figura). `demo-geometria.ts` as passa pela mesma
 * normalização das lições geradas. Não edite à mão sem revisar a conta: a resolução é conferida pelo servidor.
 */

type Bruto = Record<string, unknown> & { exercicio: Record<string, unknown> };

export const LICAO_ABSCISSAS: Bruto = {
  "titulo": "Abscissas e o baricentro",
  "objetivo": "Achar a abscissa que falta de um vértice a partir da abscissa do baricentro.",
  "conceito": "A abscissa do baricentro é a média das abscissas dos três vértices: $x_G = (x_A + x_B + x_C) / 3$. Conhecendo duas abscissas e a do baricentro, a terceira sai por conta.",
  "exemplo": "Com $x_A = 2$, $x_B = 6$ e $x_G = 5$: $3 · 5 = 2 + 6 + x_C$, então $x_C = 15 − 2 − 6 = 7$.",
  "visuais": [
    {
      "tipo": "formula",
      "latex": "x_G = \\frac{x_A + x_B + x_C}{3}",
      "alt": "Fórmula do baricentro"
    },
    {
      "tipo": "reta_numerica",
      "de": 0,
      "ate": 8,
      "pontos": [
        {
          "id": "A",
          "papel": "dado",
          "valor": 3
        },
        {
          "id": "B",
          "papel": "dado",
          "valor": 5
        },
        {
          "id": "C",
          "papel": "procurado",
          "valor": 4
        },
        {
          "id": "G",
          "papel": "especial",
          "derivado": {
            "tipo": "baricentro",
            "de": [
              "A",
              "B",
              "C"
            ]
          }
        }
      ],
      "alt": "Reta numérica com A em 3, B em 5 e o baricentro G em 4; C é o ponto procurado."
    }
  ],
  "exercicio": {
    "tipo": "multipla_escolha",
    "enunciado": "Três vértices têm abscissas $x_A = 3$, $x_B = 5$ e $x_C$. A abscissa do baricentro é 4. Qual é $x_C$?",
    "opcoes": [
      {
        "id": "a",
        "texto": "2"
      },
      {
        "id": "b",
        "texto": "6"
      },
      {
        "id": "c",
        "texto": "4"
      }
    ],
    "gabarito": [
      "c"
    ],
    "feedbackCorreto": "Isso! $3 · 4 = 3 + 5 + x_C$, então $x_C = 12 − 8 = 4$.",
    "feedbackIncorreto": "Multiplique a abscissa do baricentro por 3 e subtraia as outras duas: $x_C = 3 · 4 − 3 − 5$.",
    "visual": {
      "tipo": "reta_numerica",
      "de": 0,
      "ate": 8,
      "pontos": [
        {
          "id": "A",
          "papel": "dado",
          "valor": 3
        },
        {
          "id": "B",
          "papel": "dado",
          "valor": 5
        },
        {
          "id": "C",
          "papel": "procurado",
          "valor": 4
        },
        {
          "id": "G",
          "papel": "especial",
          "derivado": {
            "tipo": "baricentro",
            "de": [
              "A",
              "B",
              "C"
            ]
          }
        }
      ],
      "alt": "Reta numérica com A em 3, B em 5 e o baricentro G em 4; C é o ponto procurado."
    }
  },
  "resolucao": {
    "problema": "Na reta, A tem abscissa 2, B tem abscissa 6 e o baricentro G tem abscissa 5. Qual é a abscissa de C?",
    "visual": {
      "tipo": "reta_numerica",
      "de": 0,
      "ate": 9,
      "pontos": [
        {
          "id": "A",
          "papel": "dado",
          "valor": 2
        },
        {
          "id": "B",
          "papel": "dado",
          "valor": 6
        },
        {
          "id": "C",
          "papel": "procurado",
          "valor": 7
        },
        {
          "id": "G",
          "papel": "especial",
          "derivado": {
            "tipo": "baricentro",
            "de": [
              "A",
              "B",
              "C"
            ]
          }
        }
      ],
      "alt": "Reta numérica com A em 2, B em 6 e o baricentro G em 5; C é o ponto procurado."
    },
    "passos": [
      {
        "nome": "A fórmula",
        "texto": "A abscissa do baricentro é a média das abscissas dos vértices.",
        "formula": "x_G = \\foco{\\frac{x_A + x_B + x_C}{3}}"
      },
      {
        "nome": "Troque os valores",
        "texto": "Coloque $x_G = 5$, $x_A = 2$ e $x_B = 6$ na fórmula.",
        "formula": "5 = \\frac{2 + 6 + \\procurado{x_C}}{3}"
      },
      {
        "nome": "Multiplique por 3",
        "texto": "Multiplique os dois lados por 3 para tirar o denominador.",
        "formula": "\\foco{15} = 2 + 6 + x_C",
        "tentativa": {
          "pergunta": "Quanto dá 3 × 5?",
          "opcoes": [
            {
              "texto": "15",
              "correta": true,
              "porque": "Multiplicar os dois lados por 3 leva 5 a 3 × 5 = 15."
            },
            {
              "texto": "8",
              "correta": false,
              "porque": "8 é a soma de $x_A$ e $x_B$, e não o resultado de multiplicar por 3."
            },
            {
              "texto": "5",
              "correta": false,
              "porque": "O 5 é a abscissa do baricentro: falta multiplicar por 3."
            }
          ]
        }
      },
      {
        "nome": "A abscissa de C",
        "texto": "Isole $x_C$: $15 − 2 − 6 = 7$.",
        "formula": "x_C = 15 - 2 - 6 = \\resposta{7}",
        "visual": {
          "tipo": "reta_numerica",
          "pontos": [
            {
              "id": "A",
              "papel": "dado",
              "valor": 2
            },
            {
              "id": "B",
              "papel": "dado",
              "valor": 6
            },
            {
              "id": "C",
              "papel": "resposta",
              "valor": 7
            },
            {
              "id": "G",
              "papel": "especial",
              "derivado": {
                "tipo": "baricentro",
                "de": [
                  "A",
                  "B",
                  "C"
                ]
              }
            }
          ],
          "alt": "Reta numérica com A em 2, B em 6, C em 7 e o baricentro G em 5."
        }
      }
    ]
  }
};

export const LICAO_BARICENTRO: Bruto = {
  "titulo": "Baricentro: achando o terceiro vértice",
  "objetivo": "Achar o vértice que falta de um triângulo a partir do baricentro.",
  "conceito": "O baricentro G é o ponto onde as três medianas do triângulo se cruzam. Cada coordenada dele é a média das coordenadas dos vértices: $x_G = (x_A + x_B + x_C) / 3$ e $y_G = (y_A + y_B + y_C) / 3$.",
  "exemplo": "Com A(2, 1), B(−1, 5) e G(1, 2): $3 · 1 = 2 + (−1) + x_C$, então $x_C = 2$; e $3 · 2 = 1 + 5 + y_C$, então $y_C = 0$. Logo C = (2, 0).",
  "visuais": [
    {
      "tipo": "formula",
      "latex": "x_G = \\frac{x_A + x_B + x_C}{3}",
      "alt": "Fórmula do baricentro"
    },
    {
      "tipo": "plano",
      "x": [
        -3,
        6
      ],
      "y": [
        -1,
        8
      ],
      "pontos": [
        {
          "id": "A",
          "papel": "dado",
          "x": 1,
          "y": 2
        },
        {
          "id": "B",
          "papel": "dado",
          "x": -2,
          "y": 7
        },
        {
          "id": "C",
          "papel": "procurado",
          "x": 4,
          "y": 0
        },
        {
          "id": "G",
          "papel": "especial",
          "derivado": {
            "tipo": "baricentro",
            "de": [
              "A",
              "B",
              "C"
            ]
          }
        }
      ],
      "poligonos": [
        {
          "pontos": [
            "A",
            "B",
            "C"
          ]
        }
      ],
      "alt": "Triângulo ABC no plano, com A (1, 2), B (−2, 7) e o baricentro G (1, 3); C é o vértice procurado."
    }
  ],
  "exercicio": {
    "tipo": "multipla_escolha",
    "enunciado": "Os vértices A(1, 2) e B(−2, 7) e o baricentro G(1, 3) são dados. Qual é o terceiro vértice, C?",
    "opcoes": [
      {
        "id": "a",
        "texto": "C(4, 0)"
      },
      {
        "id": "b",
        "texto": "C(0, 4)"
      },
      {
        "id": "c",
        "texto": "C(2, 6)"
      }
    ],
    "gabarito": [
      "a"
    ],
    "feedbackCorreto": "Isso! De $3 · 1 = 1 + (−2) + x_C$ sai $x_C = 4$, e de $3 · 3 = 2 + 7 + y_C$ sai $y_C = 0$.",
    "feedbackIncorreto": "Multiplique por 3 a coordenada do baricentro e subtraia as dos outros dois vértices: $x_C = 3 · 1 − 1 − (−2)$ e $y_C = 3 · 3 − 2 − 7$.",
    "visual": {
      "tipo": "plano",
      "x": [
        -3,
        6
      ],
      "y": [
        -1,
        8
      ],
      "pontos": [
        {
          "id": "A",
          "papel": "dado",
          "x": 1,
          "y": 2
        },
        {
          "id": "B",
          "papel": "dado",
          "x": -2,
          "y": 7
        },
        {
          "id": "C",
          "papel": "procurado",
          "x": 4,
          "y": 0
        },
        {
          "id": "G",
          "papel": "especial",
          "derivado": {
            "tipo": "baricentro",
            "de": [
              "A",
              "B",
              "C"
            ]
          }
        }
      ],
      "poligonos": [
        {
          "pontos": [
            "A",
            "B",
            "C"
          ]
        }
      ],
      "alt": "Triângulo ABC no plano, com A (1, 2), B (−2, 7) e o baricentro G (1, 3); C é o vértice procurado."
    }
  },
  "resolucao": {
    "problema": "Os vértices A(2, 1) e B(−1, 5) e o baricentro G(1, 2) são dados. Ache o vértice C.",
    "visual": {
      "tipo": "plano",
      "x": [
        -3,
        5
      ],
      "y": [
        -1,
        7
      ],
      "pontos": [
        {
          "id": "A",
          "papel": "dado",
          "x": 2,
          "y": 1
        },
        {
          "id": "B",
          "papel": "dado",
          "x": -1,
          "y": 5
        },
        {
          "id": "C",
          "papel": "procurado",
          "x": 2,
          "y": 0
        },
        {
          "id": "G",
          "papel": "especial",
          "derivado": {
            "tipo": "baricentro",
            "de": [
              "A",
              "B",
              "C"
            ]
          }
        }
      ],
      "poligonos": [
        {
          "pontos": [
            "A",
            "B",
            "C"
          ]
        }
      ],
      "alt": "Triângulo ABC com A (2, 1), B (−1, 5) e o baricentro G (1, 2); C é o vértice procurado."
    },
    "passos": [
      {
        "nome": "A fórmula",
        "texto": "A abscissa do baricentro é a média das abscissas dos vértices.",
        "formula": "x_G = \\foco{\\frac{x_A + x_B + x_C}{3}}"
      },
      {
        "nome": "Troque os valores",
        "texto": "Coloque $x_G = 1$, $x_A = 2$ e $x_B = −1$ na fórmula.",
        "formula": "1 = \\frac{2 + (-1) + \\procurado{x_C}}{3}"
      },
      {
        "nome": "Isole x_C",
        "texto": "Multiplique os dois lados por 3 e passe os outros termos para o outro lado.",
        "formula": "x_C = 3 \\times 1 - 2 - (-1) = \\foco{2}"
      },
      {
        "nome": "O mesmo para y_C",
        "texto": "Repita o método na ordenada, com $y_G = 2$, $y_A = 1$ e $y_B = 5$.",
        "formula": "y_C = 3 \\times 2 - 1 - 5",
        "tentativa": {
          "pergunta": "Quanto vale y_C?",
          "opcoes": [
            {
              "formula": "y_C = 6 - 1 - 5",
              "correta": true,
              "porque": "Multiplica-se y_G por 3 e subtraem-se y_A e y_B: 6 − 1 − 5 = 0."
            },
            {
              "formula": "y_C = 6 + 1 + 5",
              "correta": false,
              "porque": "Os outros vértices se subtraem: a soma das três ordenadas é 3 · y_G."
            },
            {
              "formula": "y_C = 2 - 1 - 5",
              "correta": false,
              "porque": "Falta multiplicar y_G por 3 antes de subtrair."
            }
          ]
        }
      },
      {
        "nome": "O vértice C",
        "texto": "Então C = (2, 0), e o baricentro confere: G = (1, 2).",
        "formula": "C = \\resposta{(2, 0)}",
        "visual": {
          "tipo": "plano",
          "pontos": [
            {
              "id": "A",
              "papel": "dado",
              "x": 2,
              "y": 1
            },
            {
              "id": "B",
              "papel": "dado",
              "x": -1,
              "y": 5
            },
            {
              "id": "C",
              "papel": "resposta",
              "x": 2,
              "y": 0
            },
            {
              "id": "G",
              "papel": "especial",
              "derivado": {
                "tipo": "baricentro",
                "de": [
                  "A",
                  "B",
                  "C"
                ]
              }
            }
          ],
          "poligonos": [
            {
              "pontos": [
                "A",
                "B",
                "C"
              ]
            }
          ],
          "alt": "Triângulo ABC com A (2, 1), B (−1, 5), C (2, 0) e o baricentro G (1, 2) dentro dele."
        }
      }
    ]
  }
};

export const LICAO_COLINEARIDADE: Bruto = {
  "titulo": "Pontos colineares e o determinante",
  "objetivo": "Decidir quando três pontos estão alinhados usando o determinante das coordenadas.",
  "conceito": "Três pontos estão alinhados (são colineares) quando o determinante das suas coordenadas, com uma coluna de 1, é zero: $\\begin{vmatrix} x_A & y_A & 1 \\\\ x_B & y_B & 1 \\\\ x_C & y_C & 1 \\end{vmatrix} = 0$.",
  "exemplo": "Com A(0, 1), B(1, 3) e C($k$, 5): o determinante é $0 · (3 − 5) − 1 · (1 − k) + 1 · (5 − 3k) = 4 − 2k$. Igualando a zero, $k = 2$.",
  "visuais": [
    {
      "tipo": "formula",
      "latex": "\\begin{vmatrix} x_A & y_A & 1 \\\\ x_B & y_B & 1 \\\\ x_C & y_C & 1 \\end{vmatrix} = 0",
      "alt": "Condição de alinhamento"
    },
    {
      "tipo": "plano",
      "x": [
        -3,
        4
      ],
      "y": [
        -3,
        7
      ],
      "pontos": [
        {
          "id": "A",
          "papel": "dado",
          "x": -1,
          "y": -1
        },
        {
          "id": "B",
          "papel": "dado",
          "x": 2,
          "y": 5
        },
        {
          "id": "C",
          "papel": "procurado",
          "x": 0,
          "y": 1
        }
      ],
      "segmentos": [
        {
          "de": "A",
          "ate": "B"
        }
      ],
      "alt": "Os pontos A (−1, −1) e B (2, 5) no plano; C tem ordenada 1 e abscissa k, desconhecida."
    }
  ],
  "exercicio": {
    "tipo": "multipla_escolha",
    "enunciado": "Para que valor de $k$ os pontos A(−1, −1), B(2, 5) e C($k$, 1) são colineares?",
    "opcoes": [
      {
        "id": "a",
        "texto": "$k = 0$"
      },
      {
        "id": "b",
        "texto": "$k = 6$"
      },
      {
        "id": "c",
        "texto": "$k = −6$"
      }
    ],
    "gabarito": [
      "a"
    ],
    "feedbackCorreto": "Isso! O determinante vale $−6k$, e $−6k = 0$ só para $k = 0$: C(0, 1) está na reta $y = 2x + 1$, que passa por A e B.",
    "feedbackIncorreto": "Monte o determinante com as coordenadas e uma coluna de 1; igualado a zero, ele dá $−6k = 0$.",
    "visual": {
      "tipo": "plano",
      "x": [
        -3,
        4
      ],
      "y": [
        -3,
        7
      ],
      "pontos": [
        {
          "id": "A",
          "papel": "dado",
          "x": -1,
          "y": -1
        },
        {
          "id": "B",
          "papel": "dado",
          "x": 2,
          "y": 5
        },
        {
          "id": "C",
          "papel": "procurado",
          "x": 0,
          "y": 1
        }
      ],
      "segmentos": [
        {
          "de": "A",
          "ate": "B"
        }
      ],
      "alt": "Os pontos A (−1, −1) e B (2, 5) no plano; C tem ordenada 1 e abscissa k, desconhecida."
    }
  },
  "resolucao": {
    "problema": "Para que valor de $k$ os pontos A(0, 1), B(1, 3) e C($k$, 5) são colineares?",
    "visual": {
      "tipo": "plano",
      "x": [
        -2,
        4
      ],
      "y": [
        -1,
        7
      ],
      "pontos": [
        {
          "id": "A",
          "papel": "dado",
          "x": 0,
          "y": 1
        },
        {
          "id": "B",
          "papel": "dado",
          "x": 1,
          "y": 3
        },
        {
          "id": "C",
          "papel": "procurado",
          "x": 2,
          "y": 5
        }
      ],
      "segmentos": [
        {
          "de": "A",
          "ate": "B"
        }
      ],
      "alt": "Os pontos A (0, 1) e B (1, 3) no plano; C tem ordenada 5 e abscissa k, desconhecida."
    },
    "passos": [
      {
        "nome": "A condição",
        "texto": "Três pontos estão alinhados quando o determinante das coordenadas é zero.",
        "formula": "\\foco{\\begin{vmatrix} x_A & y_A & 1 \\\\ x_B & y_B & 1 \\\\ x_C & y_C & 1 \\end{vmatrix}} = 0"
      },
      {
        "nome": "Troque os valores",
        "texto": "Coloque as coordenadas de A, B e C no determinante.",
        "formula": "\\begin{vmatrix} 0 & 1 & 1 \\\\ 1 & 3 & 1 \\\\ \\procurado{k} & 5 & 1 \\end{vmatrix} = 0"
      },
      {
        "nome": "Calcule o determinante",
        "texto": "Desenvolva pela primeira linha: $0 · (3 − 5) − 1 · (1 − k) + 1 · (5 − 3k)$.",
        "formula": "-1 + k + 5 - 3k = \\foco{4 - 2k}"
      },
      {
        "nome": "Isole k",
        "texto": "Iguale a zero: $4 − 2k = 0$.",
        "formula": "4 - 2k = 0",
        "tentativa": {
          "pergunta": "Quanto vale k?",
          "opcoes": [
            {
              "formula": "k = \\frac{4}{2}",
              "correta": true,
              "porque": "De 4 − 2k = 0 sai 2k = 4, e k = 4 ÷ 2 = 2."
            },
            {
              "formula": "k = -\\frac{4}{2}",
              "correta": false,
              "porque": "O sinal não muda: 4 passa somando para o outro lado, e 2k = 4."
            },
            {
              "formula": "k = 4 \\times 2",
              "correta": false,
              "porque": "Para isolar k, divide-se por 2; multiplicar dá o valor errado."
            }
          ]
        }
      },
      {
        "nome": "O valor de k",
        "texto": "Então $k = 2$, e C = (2, 5) fica na reta de A e B.",
        "formula": "k = \\resposta{2}",
        "visual": {
          "tipo": "plano",
          "pontos": [
            {
              "id": "A",
              "papel": "dado",
              "x": 0,
              "y": 1
            },
            {
              "id": "B",
              "papel": "dado",
              "x": 1,
              "y": 3
            },
            {
              "id": "C",
              "papel": "resposta",
              "x": 2,
              "y": 5
            }
          ],
          "segmentos": [
            {
              "de": "A",
              "ate": "B"
            },
            {
              "de": "B",
              "ate": "C"
            }
          ],
          "alt": "Os pontos A (0, 1), B (1, 3) e C (2, 5) alinhados sobre a mesma reta."
        }
      }
    ]
  }
};
