# Aprender qualquer assunto

O Studoo ensina qualquer assunto, não só programação. A lição tem formatos e recursos para idiomas, música, culinária, história, ciências e habilidades práticas, na web e no app, com os mesmos dados e a mesma sequência.

## Formatos de exercício

| Formato | A pessoa | Resposta enviada | Correção |
| --- | --- | --- | --- |
| `lacuna` | escreve uma palavra, número ou símbolo | o texto | tolera maiúsculas, acentos, aspas, pontuação nas pontas e artigo; um deslize de digitação em palavras de 5 letras ou mais (dois a partir de 9), com aviso. Números e símbolos (`>=`) seguem exatos. Com `exata`, a grafia é a lição (idioma) e não há tolerância a deslize. Com a IA configurada, uma resposta errada passa por um desempate (sinônimo, número por extenso). |
| `multipla_escolha` | escolhe uma opção | o id | exata |
| `ordenar` | toca nos itens na ordem certa (chegam embaralhados, sempre do mesmo jeito) | `a,b,c` | exata; o retorno diz quais posições já estão certas |
| `associar` | liga cada item da esquerda ao par da direita (a direita chega embaralhada) | `e1=d2,e2=d1` | exata; o retorno diz quais pares estão certos |
| `verdadeiro_falso` | julga a afirmação e escolhe a justificativa | `falso:j2` | os dois precisam estar certos; acertar só o valor gera um aviso |
| `aberta` | explica com as próprias palavras (mínimo de caracteres) | o texto | com a IA, critério por critério; no modo demonstração, confere as ideias-chave (grupos de palavras-chave sem acento, pelo começo da palavra) e avisa que a correção é simulada. Mostra os critérios e uma resposta modelo. |

O trecho de um exercício tem um tipo (`trechoTipo`): `codigo` (o único em fonte monoespaçada), `frase`, `citacao`, `formula` ou `passos`. Lições salvas antes dos tipos recebem um tipo inferido (código só quando parece código). As lacunas (`___`) aparecem como um espaço sublinhado.

## Recursos

- **Falas**: frases para ouvir e repetir, com idioma BCP 47 e tradução. A web usa a voz do navegador e o app, a do aparelho (`expo-speech`). Um exercício pode ter uma fala sem trecho (escuta); o texto aparece quando a pessoa pede.
- **Acorde**: diagrama desenhado pelo app (SVG na web, Views no app) e o som sintetizado na hora (Karplus-Strong, `sintetizarAcorde` em `packages/contratos/src/som.ts`), o mesmo WAV nas duas plataformas. Com `batida`, um segundo botão toca o ritmo (`sintetizarBatida`: para baixo em cada tempo, com acento no primeiro, e para cima, mais leve, entre eles). Na web, o som sai de um `blob:`, liberado pela CSP (`media-src 'self' blob:`, em `src/proxy.ts`); se o aparelho não tocar, aparece um aviso no lugar do silêncio.
- **Linha do tempo**: marcos com data ou tempo, para história, processos e tempos de preparo.
- **Barra de fração**: um inteiro dividido em partes iguais (até 12), com algumas pintadas e um rótulo (como “2/4 = 1/2”).
- **Imagem**: a foto do material enviado. O servidor guarda uma miniatura da foto e a lição mostra a página de onde veio a explicação. O material de demonstração (frações) tem uma ilustração gerada no servidor.
- **Prática**: tarefa, minutos do cronômetro (1 a 30), passos para conferir e uma dica.
- **Para consultar**: o acorde e a barra de fração ficam à vista também no exercício (a linha do tempo, não: entregaria a ordem), e a prática mostra o recurso, os passos e as frases da lição.

## Conteúdo

- **IA da OpenAI**: o esquema estrito da lição pede `exemploTipo`, `passos`, `recurso`, `falas`, `pratica` e de 1 a 3 `exercicios` nos seis formatos. O normalizador refaz ids, monta o gabarito de ordenar e associar a partir da ordem do modelo e descarta o opcional que não fecha, mantendo a lição válida. O formato antigo (um `exercicio`) continua aceito.
- **Modo demonstração** (IA falsa): trilhas prontas com conteúdo de verdade para violão, inglês para viagem, culinária básica, história do Brasil, frações e fotografia com o celular (`src/servidor/ia/demos.ts`), além de SQL. Todas as ideias populares da tela inicial têm trilha pronta (um teste garante). Outros assuntos recebem a trilha genérica, que também usa os formatos novos.

## Quando a pessoa erra

O exercício errado ganha um reforço pelo Stu (o cartão só aparece depois de um erro, e **Ver outro exemplo** já pede o reforço). Com a IA, a explicação e o exemplo são novos. No modo demonstração (e como reserva), o reforço é uma pergunta mais simples sobre o mesmo ponto, com a explicação específica do erro (`src/dominio/aprendizado/reforco.ts`): só duas opções na escolha, a resposta certa contra a escrita na lacuna, só o valor no verdadeiro ou falso, qual item vem primeiro no ordenar, o par que ficou errado no associar e qual ideia a resposta aberta precisa trazer.

## Limites

- A voz depende do navegador ou do aparelho; sem voz, o texto continua disponível.
- O app passou a usar `expo-speech`: gere um novo development build antes de testar no Android.
- Sem chave da OpenAI, a resposta aberta tem só a correção de ideias-chave, identificada como simulada.
- A miniatura da foto vale para imagens enviadas; páginas de PDF não viram imagem.
