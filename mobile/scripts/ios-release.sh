#!/bin/zsh
# MentorsMD iPhone build + upload to App Store Connect, signed in to Apple with
# the MentorsMD App Store Connect API key (no Apple ID sign-in, no 2-factor).
#
# Your ~/.zshrc sets the AdmitMD key for every terminal. This script swaps in the
# MentorsMD key for this one run only, so the two apps never mix.
#
# Needs ~/.appstoreconnect/mentorsmd.env with:
#   MENTORSMD_ASC_KEY_ID=XXXXXXXXXX
#   MENTORSMD_ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#   MENTORSMD_APPLE_TEAM_ID=XXXXXXXXXX
# and the key file ~/.appstoreconnect/mentorsmd/AuthKey_<KEY_ID>.p8
#
# Usage (from mobile/):
#   ./scripts/ios-release.sh            build + send to App Store Connect (TestFlight)
#   ./scripts/ios-release.sh simulator  build a simulator copy only (no upload)
set -euo pipefail
cd "$(dirname "$0")/.."

CONF="$HOME/.appstoreconnect/mentorsmd.env"
[[ -f "$CONF" ]] || { echo "Missing $CONF (see the top of this script)."; exit 1; }
source "$CONF"
: "${MENTORSMD_ASC_KEY_ID:?missing in $CONF}" "${MENTORSMD_ASC_ISSUER_ID:?missing in $CONF}" "${MENTORSMD_APPLE_TEAM_ID:?missing in $CONF}"

KEY="$HOME/.appstoreconnect/mentorsmd/AuthKey_${MENTORSMD_ASC_KEY_ID}.p8"
[[ -f "$KEY" ]] || { echo "Missing key file $KEY"; exit 1; }

export EXPO_ASC_API_KEY_PATH="$KEY"
export EXPO_ASC_KEY_ID="$MENTORSMD_ASC_KEY_ID"
export EXPO_ASC_ISSUER_ID="$MENTORSMD_ASC_ISSUER_ID"
export EXPO_APPLE_TEAM_ID="$MENTORSMD_APPLE_TEAM_ID"
export EXPO_APPLE_TEAM_TYPE="COMPANY_OR_ORGANIZATION"
# MentorsMD needs Apple Pay + App Attest turned on for com.mentorsmd.app, so let
# EAS set those up on Apple's side (the AdmitMD setting turns this off).
unset EXPO_NO_CAPABILITY_SYNC

if [[ "${1:-}" == "set-app-id" ]]; then
  [[ "${2:-}" =~ ^[0-9]{9,12}$ ]] || { echo "Give the Apple ID number from App Store Connect > App Information."; exit 1; }
  sed -i '' -E "s/\"ascAppId\": \"[^\"]*\"/\"ascAppId\": \"$2\"/" eas.json
  grep ascAppId eas.json; exit 0
fi

if [[ "${1:-}" == "simulator" ]]; then
  exec npx -y eas-cli@latest build --platform ios --profile simulator --non-interactive
fi

if grep -q "REPLACE-AFTER-CREATING" eas.json; then
  echo "eas.json still has no App Store Connect app id. Run: ./scripts/ios-release.sh set-app-id 1234567890"; exit 1
fi
exec npx -y eas-cli@latest build --platform ios --profile production --auto-submit
