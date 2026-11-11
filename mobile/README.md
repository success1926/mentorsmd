# MentorsMD phone app (preview)

An Expo app with every screen from the MentorsMD App Clickthrough (Nov 11, 2026): student, mentor and admin areas, plus visitor browsing.

- **Sample data:** sign-in isn't connected yet. Signed-in screens use invented people and numbers (`src/lib/sample.ts`), and taps change them in memory only (reloading starts over). Nothing is charged or sent.
- **Live data:** Find a mentor ("Live on mentorsmd.com", or Visitor on the sign-in screen) and mentor profiles read the real mentors from the website's public routes `/api/mentors` and `/api/mentors/[id]` (`src/lib/live.ts`). Read-only. Buying or messaging a real mentor opens their page on the website.

## Try it in Expo Go

```bash
cd mobile
npm install
npx expo start --tunnel
```

Scan the QR code with the iPhone camera (Expo Go installed). Shake the phone or press `r` in the terminal to reload.

`EXPO_PUBLIC_SITE_URL` in `mobile/.env.local` points the live screens at another site (default `https://www.mentorsmd.com`).

The website's `tsconfig.json` excludes `mobile/`, so the website build ignores this folder.
