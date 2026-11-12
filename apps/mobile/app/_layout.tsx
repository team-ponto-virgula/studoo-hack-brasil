import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { cores, fontes } from '../src/tema';

export default function Layout() {
  const [carregadas, erro] = useFonts({
    [fontes.titulo]: require('../assets/fontes/Quicksand.ttf'),
    [fontes.corpo]: require('../assets/fontes/Nunito.ttf'),
  });

  if (!carregadas && !erro) return <View style={estilos.inicio} />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: estilos.inicio }} />
    </>
  );
}

const estilos = StyleSheet.create({
  inicio: { flex: 1, backgroundColor: cores.fundo },
});
