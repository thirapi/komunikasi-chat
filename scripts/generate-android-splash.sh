#!/usr/bin/env bash
# Regenerate the native splash screens from the brand mark.
#
# The committed splash.png files shipped with Capacitor are the Capacitor logo
# on white. Everything else in the app is dark, so the launch screen was the one
# place still showing stock branding.
#
# Run after changing public/icons/logo-mark-white.png:
#
#   bash scripts/generate-android-splash.sh
#
# Capacitor resolves androidSplashResourceName ("splash") through
# getIdentifier(..., "drawable", ...), so the filename must stay splash.png and
# must live in a drawable-* folder — not mipmap.
set -euo pipefail

cd "$(dirname "$0")/.."

MARK="public/icons/logo-mark-white.png"
RES="android/app/src/main/res"
BG="#0a0a0a"

[ -f "$MARK" ] || { echo "missing $MARK"; exit 1; }

# The mark is 878x1024, so scale on height and let the logo sit at ~28% of the
# canvas' shorter side. Capacitor renders with CENTER_CROP, which crops the
# longer axis, so the mark has to stay well inside the smaller dimension or a
# round mask cuts its edges.
place_mark() {
    local out="$1" w="$2" h="$3"
    local short mark_h
    short=$(( w < h ? w : h ))
    mark_h=$(( short * 28 / 100 ))
    convert -size "${w}x${h}" "xc:${BG}" \
        \( "$MARK" -resize "x${mark_h}" \) \
        -gravity center -composite \
        -strip "$out"
}

# Canvas sizes match what Android requests per density bucket and orientation.
# Keeping the existing dimensions means the diff stays limited to pixels.
declare -a TARGETS=(
    "drawable-port-mdpi 320 480"
    "drawable-port-hdpi 480 800"
    "drawable-port-xhdpi 720 1280"
    "drawable-port-xxhdpi 960 1600"
    "drawable-port-xxxhdpi 1280 1920"
    "drawable-land-mdpi 480 320"
    "drawable-land-hdpi 800 480"
    "drawable-land-xhdpi 1280 720"
    "drawable-land-xxhdpi 1600 960"
    "drawable-land-xxxhdpi 1920 1280"
)

mkdir -p "$RES/drawable"
# Fallback for devices with no density-specific match. Same aspect as mdpi land.
place_mark "$RES/drawable/splash.png" 480 320

for entry in "${TARGETS[@]}"; do
    # shellcheck disable=SC2086
    set -- $entry
    dir="$RES/$1" w="$2" h="$3"
    mkdir -p "$dir"
    place_mark "$dir/splash.png" "$w" "$h"
    printf '%-28s %sx%s\n' "$1" "$w" "$h"
done

echo "splash screens regenerated ($BG background, $(basename "$MARK") mark)"
