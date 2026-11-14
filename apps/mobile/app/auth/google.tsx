import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { concluirGoogle, retornoGoogle } from '../../src/google-nativo';
import { Botao, EstadoMensagem, Skeleton, Tela, Titulo } from '../../src/interface';
import { mensagemDeErro, mensagens } from '../../src/mensagens';

/** Retorno também funciona se o sistema recriar o processo do app durante o login. */
export default function RetornoGoogle() {
  const { codigo, erro } = useLocalSearchParams<{ codigo?: string; erro?: string }>();
  const router = useRouter();
  const [falha, setFalha] = useState<string>();
  useEffect(() => {
    let ativo = true;
    const url = new URL(retornoGoogle());
    if (typeof codigo === 'string') url.searchParams.set('codigo', codigo);
    if (typeof erro === 'string') url.searchParams.set('erro', erro);
    void concluirGoogle(url.toString()).then(() => { if (ativo) router.replace('/'); })
      .catch(e => { if (ativo) setFalha(mensagemDeErro(e)); });
    return () => { ativo = false; };
  }, [codigo, erro, router]);
  return <Tela pagina="retorno-google" rodape={falha && <Botao rotulo={mensagens.acesso.entrar} acao={() => router.replace('/')} />}>
    <Titulo>{mensagens.acesso.google}</Titulo>
    {falha ? <EstadoMensagem mensagem={falha} /> : <Skeleton />}
  </Tela>;
}
