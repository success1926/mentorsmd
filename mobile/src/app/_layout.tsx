import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold } from "@expo-google-fonts/hanken-grotesk";
import { IBMPlexMono_700Bold } from "@expo-google-fonts/ibm-plex-mono";
import { Newsreader_300Light, Newsreader_400Regular } from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Overlays } from "../components/ui";
import { DemoProvider, OverlayProvider } from "../lib/demo";
import { useColors } from "../lib/theme";

export default function RootLayout() {
  const c = useColors();
  const [loaded] = useFonts({
    Newsreader_300Light, Newsreader_400Regular,
    HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold,
    IBMPlexMono_700Bold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return (
    <SafeAreaProvider>
      <DemoProvider>
        <OverlayProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
            <Stack.Screen name="call/[id]" options={{ presentation: "fullScreenModal", animation: "fade" }} />
          </Stack>
          <Overlays />
        </OverlayProvider>
      </DemoProvider>
    </SafeAreaProvider>
  );
}
