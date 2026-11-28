# MentorsMD phone app

The MentorsMD app for iPhone and Android (Expo SDK 58, expo-router). It works against the real website (mentorsmd.com) through its JSON routes; there is no sample data.

- **Visitors** browse mentors (`/api/mentors`), use the guided match and compare, and open profiles.
- **Students and mentors** sign in with their MentorsMD account (email and password, then the 2-step code when it's on). Team (admin) accounts use the website. Sign-in tokens are kept in the phone's secure storage (`src/lib/auth.tsx`, `src/lib/api.ts`).
- **Students:** packages and hours left, booking and moving calls, messages, disputes, receipts, credit, settings.
- **Mentors:** home, students and packages (log written work, suggest more hours, mark complete), calendar and availability, messages, rates and bundles, payouts, settings.
- **Payments:** Stripe's payment sheet (card, Apple Pay, Google Pay) after any MentorsMD credit (`runCheckout` in `src/components/shared.tsx`; the website's `/api/app/checkout`).
- **Calls** open in an in-app video view (`src/app/call/[id].tsx`).
- **Proof it's the real app:** sign-ins carry Apple App Attest on iPhone, or a Google Play Integrity token on Android, when the website asks for one (`src/lib/attest.ts`; checked by the website's `lib/appAttest.ts` and `lib/playIntegrity.ts`).

Shared rules live in one file each and copy the website's file of the same name: `src/lib/orders.ts` (hours, finishing, call windows), `src/lib/statusLabels.ts` (status words and colours), `src/lib/fee.ts` (the 30% fee) and `src/lib/format.ts` (dates, money, names). Change both together.

## Running it

The app uses native modules (Stripe, App Attest, Play Integrity), so it needs a development build rather than Expo Go. Install one made with the `development` profile in `eas.json`, then:

```bash
cd mobile
npm install
npx expo start --dev-client
```

`EXPO_PUBLIC_SITE_URL` (in `mobile/.env.local`, or a profile's `env` in `eas.json`) points the app at another site; the default is `https://www.mentorsmd.com`. Check types with `npm run typecheck`.

## Builds and release

Build profiles in `eas.json`: `development` and `preview` (internal installs), `production` (www.mentorsmd.com; the build number goes up by itself), `simulator` (an iPhone simulator copy) and `android-test` (an installable Android APK).

iPhone releases go through `scripts/ios-release.sh`, run from `mobile/`. It signs in to Apple with the MentorsMD App Store Connect API key kept in `~/.appstoreconnect/` (see the top of the script), builds the `production` profile on EAS and sends it to App Store Connect for TestFlight. `./scripts/ios-release.sh simulator` builds a simulator copy only. Apple Pay and App Attest are switched on by hand for `com.mentorsmd.app` on Apple's developer site.

### Over-the-air updates

Store builds made from the `production` profile listen on the `production` update channel (`expo-updates`, `updates.url` in `app.json`). An app change that's only JavaScript (screens, wording, colours) can reach phones without a new store build:

```
npx eas update --channel production --platform ios --environment production --message "what changed"
```

Phones pick it up the next time the app is opened, then show it on the open after that. `runtimeVersion` uses the `fingerprint` policy: an update only goes to builds whose native parts match it. If a change adds or upgrades a native package (anything that changes `ios/` after `expo prebuild`), the fingerprint changes and it needs a new store build instead. `npx expo-updates fingerprint:generate --platform ios` shows the current fingerprint to compare with the build's.

Store builds made before expo-updates was added (TestFlight build 4 and earlier) can't receive updates.

The website's `tsconfig.json` excludes `mobile/`, so the website build ignores this folder.
