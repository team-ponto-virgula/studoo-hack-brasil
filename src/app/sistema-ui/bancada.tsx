'use client';

import { useRef, useState } from 'react';
import { Botao, Logo, Skeleton, Stu } from '../../ui/componentes';
import { CabecalhoSecao, CartaoStudoo, EstadoTrilha, ProgressoStudoo } from '../../ui/jornada';
import { DialogoConfirmar } from '../compartilhar';
import '../compartilhar.css';
import './bancada.css';

/** Mostra as implementações usadas nas telas; nenhuma ação altera dados do produto. */
export function BancadaJornada() {
  const [objetivo, setObjetivo] = useState('Quero aprender SQL para a prova');
  const [erro, setErro] = useState(false);
  const [dialogo, setDialogo] = useState(false);
  const [mensagem, setMensagem] = useState('Esta bancada usa apenas exemplos locais.');
  const abrirDialogo = useRef<HTMLButtonElement>(null);
  function fechar() {
    setDialogo(false);
    requestAnimationFrame(() => abrirDialogo.current?.focus());
  }
  return <main className="bancada-jornada">
    <header className="bancada-jornada__marca"><Logo /><span>Jornada Azul · componentes reais</span></header>
    <section className="bancada-jornada__abertura">
      <div><p className="jornada-contexto">Sistema de interface do Studoo</p><h1>Um caminho claro.<br />Uma identidade nossa.</h1><p>O mesmo vocabulário visual do primeiro pedido à próxima lição. O Stu, a marca e a intro continuam como estão.</p></div>
      <Stu expressao="stu-acolhida" tamanho={112} />
    </section>
    <p className="bancada-jornada__aviso">Bancada de desenvolvimento: estados locais para revisão. Não envia email, não publica trilhas e não salva progresso.</p>
    <div className="bancada-jornada__grade">
      <section aria-labelledby="bancada-acoes"><CabecalhoSecao titulo="Ações com hierarquia" contexto="01 · Decidir" tituloId="bancada-acoes" descricao="Uma ação principal por etapa; as saídas continuam fáceis de encontrar." />
        <CartaoStudoo><Botao onClick={() => setMensagem('Ação principal acionada no exemplo.')}>Continuar minha trilha</Botao><Botao variante="secundario" onClick={() => setMensagem('Alternativa acionada no exemplo.')}>Ajustar meu pedido</Botao><Botao variante="texto" onClick={() => setMensagem('Saída acionada no exemplo.')}>Voltar para minhas trilhas</Botao><Botao disabled>Aceitar a trilha</Botao><Botao disabled aria-busy="true">Salvando seu progresso…</Botao></CartaoStudoo>
      </section>
      <section aria-labelledby="bancada-campos"><CabecalhoSecao titulo="Campos que orientam" contexto="02 · Construir" tituloId="bancada-campos" descricao="O rótulo permanece visível; dica e erro ficam junto da entrada." />
        <CartaoStudoo><div className="campo"><label htmlFor="bancada-objetivo">O que você quer aprender?</label><textarea id="bancada-objetivo" value={objetivo} rows={3} onChange={e => { setObjetivo(e.target.value); setErro(false); }} aria-invalid={erro || undefined} aria-describedby={erro ? 'bancada-erro' : 'bancada-dica'} /><small id="bancada-dica">Conte o assunto e para que você quer aprender.</small>{erro && <p className="bancada-jornada__erro" id="bancada-erro" role="alert">Escreva seu objetivo antes de montar a trilha.</p>}</div><Botao variante="secundario" onClick={() => { setObjetivo(''); setErro(true); }}>Ver estado de erro</Botao></CartaoStudoo>
      </section>
      <section aria-labelledby="bancada-retomada"><CabecalhoSecao titulo="Seu próximo passo" contexto="03 · Continuar" tituloId="bancada-retomada" descricao="O progresso tem contagem concreta e indica onde retomar." />
        <CartaoStudoo tom="destaque"><EstadoTrilha estado="atual" /><h3>SQL para a prova</h3><p>INNER JOIN · Encontre correspondências.</p><ProgressoStudoo concluidas={1} total={5} /><Botao onClick={() => setMensagem('Exemplo de retomada. Abra o app para continuar sua trilha real.')}>Retomar INNER JOIN</Botao></CartaoStudoo>
      </section>
      <section aria-labelledby="bancada-estados"><CabecalhoSecao titulo="Estados com significado" contexto="04 · Entender" tituloId="bancada-estados" descricao="Palavras e ícones acompanham a cor em cada estado do caminho." />
        <CartaoStudoo><EstadoTrilha estado="concluida" /><EstadoTrilha estado="atual" /><EstadoTrilha estado="disponivel" /><EstadoTrilha estado="bloqueada" /><ProgressoStudoo concluidas={0} total={5} /><ProgressoStudoo concluidas={5} total={5} /></CartaoStudoo>
      </section>
      <section aria-labelledby="bancada-retorno"><CabecalhoSecao titulo="Feedback perto da ação" contexto="05 · Aprender" tituloId="bancada-retorno" descricao="Acerto confirma o entendimento; erro dá um próximo passo possível." />
        <CartaoStudoo tom="sucesso"><h3>Isso aí!</h3><p>O operador inclui os valores iguais ao limite.</p><Botao variante="sucesso" onClick={() => setMensagem('Continuação acionada no exemplo de acerto.')}>Continuar</Botao></CartaoStudoo>
        <CartaoStudoo tom="alerta"><h3>Vamos tentar de outro jeito?</h3><p>Releia o limite pedido e compare os dois operadores.</p><Botao variante="alerta" onClick={() => setMensagem('Nova tentativa acionada no exemplo.')}>Tentar de novo</Botao></CartaoStudoo>
      </section>
      <section aria-labelledby="bancada-confianca"><CabecalhoSecao titulo="Espera e confirmação" contexto="06 · Confiar" tituloId="bancada-confianca" descricao="Carregamento tem nome; ações que perdem algo pedem uma decisão clara." />
        <CartaoStudoo><Skeleton texto="Carregando suas trilhas…" /><Botao ref={abrirDialogo} variante="secundario" onClick={() => setDialogo(true)}>Ver confirmação de recomeço</Botao><p>O diálogo é o mesmo componente utilizado pelo produto.</p></CartaoStudoo>
      </section>
    </div>
    <p role="status" aria-live="polite" className="bancada-jornada__status">{mensagem}</p>
    {dialogo && <DialogoConfirmar titulo="Recomeçar esta tentativa?" texto="Este é um exemplo local. Nenhuma lição ou trilha será alterada." confirmar="Recomeçar" cancelar="Continuar de onde parei" destrutivo={false} aoCancelar={fechar} aoConfirmar={() => { setMensagem('Confirmação exercitada; nenhum dado do produto foi alterado.'); fechar(); }} />}
  </main>;
}
