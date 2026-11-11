import { Feather } from "@expo/vector-icons";
import { Redirect, Stack, Tabs } from "expo-router";
import { useDemo, type Role } from "../lib/demo";
import { fonts, useColors } from "../lib/theme";
import type { IconName } from "./ui";

// The bottom tabs for an area (same five tabs as the clickthrough).
export function AreaTabs({ tabs }: { tabs: { name: string; title: string; icon: IconName; badge?: number }[] }) {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
        tabBarBadgeStyle: { backgroundColor: c.primary, color: c.onPrimary, fontFamily: fonts.bodyBold, fontSize: 11 },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      {tabs.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, tabBarBadge: t.badge || undefined, tabBarIcon: ({ color, size }) => <Feather name={t.icon} color={color as string} size={size - 2} /> }} />
      ))}
    </Tabs>
  );
}

// An area's screens. Sends you back to sign-in if you haven't picked who you are.
export function AreaStack({ role }: { role: Role }) {
  const c = useColors();
  const { role: current } = useDemo();
  if (current !== role) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
