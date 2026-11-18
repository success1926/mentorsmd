import { useColorScheme } from "react-native";

// The MentorsMD website's colors (app/globals.css, Iris), light and dark.
// Same tokens as the app clickthrough mockup.
const light = {
  primary: "#5536D6",
  deep: "#3F24B0",
  button: "#BFB0FF",
  tint: "#F1EDFF",
  tintSoft: "#F6F3FF",
  avatar: "#DDD5FF",
  pinkSoft: "#FCE4EC",
  blue: "#E4EEFF",
  blueInk: "#25407A",
  ink: "#1B1834",
  muted: "#5D5973",
  faint: "#6E6A83",
  line: "#E7E3EF",
  wash: "#F7F5FB",
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  onPrimary: "#FFFFFF",
  link: "#5536D6",
  okBg: "#DDF3E6",
  okFg: "#17613A",
  warnBg: "#FFF1D6",
  warnFg: "#7A4D00",
  dangerBg: "#FDE8E8",
  danger: "#B42318",
  scrim: "rgba(27,24,52,0.45)",
  video: "#14112A",
  videoTile: "#2B2650",
};

const dark: typeof light = {
  primary: "#9C86FF",
  deep: "#B9A9FF",
  button: "#5B45C9",
  tint: "#231D44",
  tintSoft: "#1D1838",
  avatar: "#2F2760",
  pinkSoft: "#3A2030",
  blue: "#1C2642",
  blueInk: "#A9C0F2",
  ink: "#EEEBFA",
  muted: "#B3AECB",
  faint: "#9A95B4",
  line: "#2E2948",
  wash: "#1A1630",
  bg: "#110E22",
  surface: "#16122B",
  onPrimary: "#110E22",
  link: "#B4A4FF",
  okBg: "#15332A",
  okFg: "#8FDDB0",
  warnBg: "#3A2C10",
  warnFg: "#F3CF85",
  dangerBg: "#3D1A1A",
  danger: "#F49A90",
  scrim: "rgba(0,0,0,0.6)",
  video: "#14112A",
  videoTile: "#2B2650",
};

export type Colors = typeof light;

export const fonts = {
  display: "Newsreader_300Light",
  displayRegular: "Newsreader_400Regular",
  body: "HankenGrotesk_400Regular",
  bodyMedium: "HankenGrotesk_500Medium",
  bodySemi: "HankenGrotesk_600SemiBold",
  bodyBold: "HankenGrotesk_700Bold",
  mono: "IBMPlexMono_700Bold",
};

// Follows the phone's light/dark setting.
export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}
