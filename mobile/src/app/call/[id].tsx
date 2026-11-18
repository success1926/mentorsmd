import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Btn, Loading, Note, Screen, T } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { useColors } from "../../lib/theme";

// A video call. The website makes a private Daily room and a personal
// meeting token for the student or mentor on the booking (app/api/calls/
// [id]/join), from 10 minutes before the start until 30 minutes after the
// end. The call itself runs in Daily's page, inside the app.
export default function Call() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ url: string }>(`/api/calls/${encodeURIComponent(id)}/join`, { method: "POST", body: {} })
      .then((r) => setUrl(r.url))
      .catch((e) => setError(errorText(e)));
  }, [id]);

  if (error)
    return (
      <Screen edges={["top", "bottom"]}>
        <T>Can’t Join Yet</T>
        <Note>{error}</Note>
        <Btn kind="line" label="Back" onPress={() => router.back()} />
      </Screen>
    );
  if (!url) return <Screen><Loading label="Opening the call…" /></Screen>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.video }} edges={["top", "bottom"]}>
      <WebView
        source={{ uri: url }}
        style={{ flex: 1, backgroundColor: c.video }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        javaScriptEnabled
        domStorageEnabled
        // Daily's "Leave" goes to its left-call page: close the call screen.
        onNavigationStateChange={(s) => { if (/left-meeting|\/left/i.test(s.url)) router.back(); }}
      />
      <View style={{ padding: 12 }}>
        <Btn kind="red" label="Leave call" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}
