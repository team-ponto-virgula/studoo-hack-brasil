import type { Metadata } from 'next';
import { provedoresDaIa, VERSAO_CONSENTIMENTO_IA } from '@studoo/contratos/privacidade';
import { provedorIaAtivo } from '@/servidor/ia/gerador';
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
export default function PaginaPrivacidade() {
  const ia = provedorIaAtivo();
  // A política descreve todos os provedores que o Studoo pode usar, não só o ligado agora.
  const provedores = provedoresDaIa(ia === 'falsa' ? 'deepseek' : ia, true);
  const contato = process.env.STUDOO_CONTATO_PRIVACIDADE?.trim();
  const contatoHref = contato && (contato.includes('@') && !contato.includes('://') ? `mailto:${contato}` : contato);

  return (
    <main className="politica">
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
          <tr><td>Sessões de login (web e app)</td><td>Manter você conectado</td><td>Até você sair, a sessão vencer ou a conta ser excluída</td></tr>
          <tr><td>Fuso horário</td><td>Contar seus dias de estudo</td><td>Até você excluir a conta</td></tr>
          <tr><td>O que você pede para aprender, trilhas, lições, respostas, progresso e tempo de estudo</td><td>Montar e acompanhar seus estudos</td><td>Até você apagar a trilha ou excluir a conta</td></tr>
          <tr><td>Materiais enviados (texto lido de fotos, PDFs, DOCX ou CSV)</td><td>Montar uma trilha a partir do material</td><td>24 horas, ou até você excluir</td></tr>
          <tr><td>Gravação da sua explicação por voz</td><td>Transformar a fala em texto</td><td>Não é guardada: só o texto resultante, quando você o envia</td></tr>
          <tr><td>Perfil público opcional: nome, cor, foto, resumo e interesses</td><td>Mostrar quem compartilhou uma trilha</td><td>Até você mudar ou excluir a conta</td></tr>
          <tr><td>Links compartilhados, publicações no Explorar, quem você segue, "valeus" e denúncias</td><td>Compartilhar trilhas e moderar a comunidade</td><td>Até você parar de compartilhar ou excluir a conta</td></tr>
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
        Só depois que você permite o uso de IA, e só o necessário para cada função. Qual serviço é usado depende da
        configuração do servidor; a tela de permissão mostra quais estão ligados agora.
      </p>
      <ul>
        {provedores.map((provedor) => (
          <li key={provedor.id}>
            <strong>{provedor.nome}</strong>: {provedor.usos.join('; ')}.{' '}
            O que a {provedor.nome} faz com esses dados, inclusive por quanto tempo os guarda, está na{' '}
            <a href={provedor.politica} target="_blank" rel="noopener noreferrer">política de privacidade da {provedor.nome}</a>.
          </li>
        ))}
      </ul>
      <p>
        Esses serviços ficam fora do Brasil (a DeepSeek, na China; a OpenAI, nos Estados Unidos), e os dados enviados a
        eles são tratados lá. Sem a permissão, nada vai para esses serviços: as respostas são corrigidas no próprio Studoo e as funções que
        dependem da IA pedem a permissão antes. Também usamos um serviço de e-mail para enviar o código de recuperação de
        senha (só o seu e-mail e o código) e, se você escolher, o login com Google.
      </p>

      <h2>Conteúdo da comunidade</h2>
      <p>
        Trilhas publicadas no Explorar e perfis públicos podem ser denunciados por quem tem conta. Uma trilha denunciada
        por três contas diferentes sai do Explorar na hora, até ser revista pela equipe.
      </p>

      <h2>Seus direitos e a exclusão da conta</h2>
      <p>
        Você pode ver e corrigir seus dados no app, parar de permitir o uso de IA e excluir sua conta em Perfil,
        Privacidade e dados, Excluir conta. A exclusão é imediata e apaga a conta, as trilhas, o progresso, os materiais,
        a foto, o perfil, os links e o que você segue. Cópias de trilhas que outras pessoas já adicionaram continuam com
        elas, sem o seu nome. Pedidos já enviados aos serviços de IA seguem a política de cada um.
      </p>

      <h2>Contato</h2>
      {contato && contatoHref
        ? <p>Dúvidas ou pedidos sobre seus dados: <a href={contatoHref}>{contato}</a>.</p>
        : <p>Dúvidas ou pedidos sobre seus dados: use a exclusão da conta no app ou fale com a equipe do Studoo pelos canais do piloto.</p>}
    </main>
  );
}
