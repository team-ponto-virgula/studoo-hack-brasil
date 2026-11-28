import type { Metadata } from 'next';
import { VERSAO_CONSENTIMENTO_IA } from '@studoo/contratos/privacidade';
import { provedoresConfiguradosIa } from '@/servidor/privacidade/consentimento';
import { VoltarDaPagina } from '../comunidade';
import { PaginaPublica, usuarioDaPagina } from '../publico';
import '../privacidade.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Política de privacidade · Studoo',
  description: 'Quais dados o Studoo guarda, quem recebe e como excluir sua conta.',
};

/**
 * Política pública (sem login), aberta pela web, pelo login e pelo Perfil, e pelo app no navegador do sistema
 * (App Review 5.1.1(i)). Diz o que o Studoo guarda e o que vai a cada provedor; o que cada provedor faz com os dados é
 * dito pela política dele (link), sem afirmar retenção que não controlamos.
 * O contato vem de `STUDOO_CONTATO_PRIVACIDADE` (e-mail ou endereço), configurado no servidor.
 */
export default async function PaginaPrivacidade() {
  const provedores = provedoresConfiguradosIa();
  const contato = process.env.STUDOO_CONTATO_PRIVACIDADE?.trim();
  const contatoHref = contato && (contato.includes('@') && !contato.includes('://') ? `mailto:${contato}` : contato);
  const logado = Boolean(await usuarioDaPagina());

  return (
    <PaginaPublica>
      <div className="politica">
        <VoltarDaPagina destino={logado ? '/?tela=perfil' : '/login'} />
        <h1>Política de privacidade do Studoo</h1>
      <p className="politica__data">Versão de {VERSAO_CONSENTIMENTO_IA}. Vale para o site e para o app.</p>

      <h2>Em resumo</h2>
      <p>
        O Studoo monta trilhas de estudo com lições curtas. Guardamos só o que precisamos para isso funcionar. Para gerar
        trilhas, ler materiais, ouvir sua voz e comentar respostas, usamos serviços de IA de outras empresas, e só
        enviamos seus dados a eles depois que você permite, dentro do app. Você pode parar de permitir e excluir sua conta
        a qualquer momento em Perfil, Privacidade e dados.
      </p>

      <h2>O que o Studoo guarda</h2>
      <table>
        <thead><tr><th>Dado</th><th>Para quê</th><th>Por quanto tempo</th></tr></thead>
        <tbody>
          <tr><td>E-mail e senha (guardada só como hash), ou a identificação da conta Google</td><td>Entrar na conta e recuperar o acesso</td><td>Até você excluir a conta</td></tr>
          <tr><td>Identificador da conta Apple, e-mail compartilhado (que pode ser um endereço privado da Apple) e autorização de acesso</td><td>Reconhecer sua conta quando você voltar e revogar o acesso na Apple. Guardamos o token de renovação cifrado. O nome recebido da Apple não é guardado.</td><td>O identificador fica até a exclusão da conta. O token é removido quando recebemos a revogação ou quando você exclui a conta.</td></tr>
          <tr><td>Verificação por código no e-mail</td><td>Confirmar que o endereço é seu no cadastro ou na troca de senha</td><td>O código vale por 15 minutos e só pode ser usado uma vez.</td></tr>
          <tr><td>Sessões de login (web e app)</td><td>Manter você conectado</td><td>Até você sair, a sessão vencer ou a conta ser excluída</td></tr>
          <tr><td>Datas com lições concluídas</td><td>Mostrar seus dias de estudo, sem guardar respostas nesse indicador</td><td>Até você excluir a conta</td></tr>
          <tr><td>Fuso horário</td><td>Contar seus dias de estudo</td><td>Até você excluir a conta</td></tr>
          <tr><td>O que você pede para aprender, trilhas, lições, respostas, progresso e tempo de estudo</td><td>Montar e acompanhar seus estudos</td><td>Até você apagar a trilha ou excluir a conta</td></tr>
          <tr><td>Diagnóstico opcional da trilha</td><td>Adaptar o começo e o escopo do estudo</td><td>A sessão de perguntas vale por 30 minutos. O resumo permanece com a trilha salva.</td></tr>
          <tr><td>Materiais enviados (texto lido de fotos, PDFs, DOCX ou CSV)</td><td>Verificar a segurança e montar uma trilha a partir do material</td><td>24 horas, ou até você excluir</td></tr>
          <tr><td>Gravação da sua explicação por voz</td><td>Transformar a fala em texto</td><td>Não é guardada: só o texto resultante, quando você o envia</td></tr>
          <tr><td>Perfil público opcional: nome, cor, foto, resumo e interesses</td><td>Mostrar quem compartilhou uma trilha</td><td>Até você mudar ou excluir a conta</td></tr>
          <tr><td>Links compartilhados, publicações no Explorar, quem você segue, "valeus" e bloqueios</td><td>Compartilhar trilhas e moderar a comunidade</td><td>Até você parar de compartilhar ou excluir a conta</td></tr>
          <tr><td>Registro do seu aceite do uso de IA (data e versão)</td><td>Saber se podemos enviar dados à IA</td><td>Até você parar de permitir ou excluir a conta</td></tr>
        </tbody>
      </table>
      <p>
        Visitantes (sem conta) recebem uma sessão temporária com os mesmos cuidados, inclusive o pedido de permissão
        para a IA e a exclusão. Não usamos seus dados para publicidade, não vendemos dados e não rastreamos você em
        outros sites ou apps.
      </p>

      <h2>Quem recebe seus dados</h2>
      <p>
        Enviamos à OpenAI o necessário para cada função depois que você permite o uso de IA. A permissão inclui a
        verificação de segurança antes de gerar uma trilha ou mostrar conteúdo de um material.
      </p>
      {provedores.length === 0 ? <p>A IA está em modo de demonstração. Nenhum provedor de IA recebe seus dados nesta configuração.</p> : <ul>
        {provedores.map((provedor) => (
          <li key={provedor.id}>
            <strong>{provedor.nome}</strong>: {provedor.usos.join('; ')}.{' '}
            O que a {provedor.nome} faz com esses dados, inclusive por quanto tempo os guarda, está na{' '}
            <a href={provedor.politica} target="_blank" rel="noopener noreferrer">política de privacidade da {provedor.nome}</a>.
          </li>
        ))}
      </ul>}
      <p>
        {provedores.length > 0 && 'Os provedores de IA listados tratam dados fora do Brasil. '}
        Sem a permissão, nada vai para esses serviços: as respostas são corrigidas no próprio Studoo e as funções que
        dependem da IA pedem a permissão antes. No cadastro e na recuperação, o serviço de e-mail recebe o endereço e a
        mensagem com o código ou o aviso sobre uma conta existente. Se escolher entrar com Google ou Apple, o provedor
        participa da autenticação. Com a Apple, você pode ocultar seu e-mail.
      </p>

      <h2>Comunidade</h2>
      <p>Ao compartilhar, você escolhe quem pode descobrir a trilha pelo link, pelo perfil ou pelo Explorar. Quem recebe vê o nome do perfil, os dados públicos da trilha e as imagens aprovadas. Seu e-mail, suas respostas e seu progresso são privados.</p>
      <p>O Studoo verifica o texto localmente. A equipe revisa as publicações, fotos e capas antes de exibi-las a outras pessoas. Você pode denunciar um perfil ou uma trilha pelo menu ou pelo link público. O protocolo permite consultar a decisão em <a href="/suporte">Suporte</a>. Três denúncias de contas diferentes retiram uma trilha de circulação até a análise.</p>
      <p>Bloquear alguém encerra o vínculo de seguir, impede interações entre os dois e oculta as publicações enquanto cada pessoa usa sua sessão. Você pode desfazer em Perfil, Pessoas bloqueadas. Links públicos também podem ser vistos sem entrar.</p>
      <h2 id="regras-da-comunidade">Regras da comunidade</h2>
      <p>Publique conteúdo que ajude outras pessoas a estudar. São proibidos spam, propaganda, ofensas, ódio, assédio, ameaças, conteúdo sexual e divulgação de dados pessoais de terceiros. Respeite os direitos autorais. As mesmas regras valem para textos e trilhas gerados por IA. A equipe pode retirar conteúdo que viole essas regras.</p>
      <p>O suporte guarda sua mensagem, o protocolo e a resposta. As denúncias e decisões ficam na caixa restrita da equipe para acompanhar os casos. Na exclusão da conta, o registro da denúncia perde o vínculo com sua conta. Guarde o protocolo com você: quem o possui pode consultar a resposta.</p>

      <h2>Seus direitos e a exclusão da conta</h2>
      <p>
        Você pode ver e corrigir seus dados no app, parar de permitir o uso de IA e excluir sua conta em Perfil,
        Privacidade e dados, Excluir conta. A exclusão é imediata e apaga a conta, as trilhas, o progresso, os materiais,
        a foto, o perfil, os links e o que você segue. Cópias de trilhas que outras pessoas já adicionaram continuam com
        elas, sem o seu nome. Se você entrou com a Apple, o Studoo também solicita a revogação da autorização na Apple. Pedidos já enviados aos serviços de IA seguem a política de cada um.
      </p>

      <h2>Contato</h2>
      {contato && contatoHref
        ? <p>Dúvidas ou pedidos sobre seus dados: <a href={contatoHref}>{contato}</a>.</p>
        : <p>Para dúvidas ou pedidos sobre seus dados, <a href="/suporte">fale com o suporte do Studoo</a>.</p>}
      </div>
    </PaginaPublica>
  );
}
