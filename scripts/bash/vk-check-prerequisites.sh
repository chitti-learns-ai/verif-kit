#!/usr/bin/env bash
# Verif-Kit "where are we?" oracle (bash). Emits one JSON answer reconstructing
# verification state from disk. Usage:
#   ./vk-check-prerequisites.sh --module price-calculator --feature 001-checkout --json
set -uo pipefail
source "$(dirname "$0")/vk-common.sh"

MODULE=""; FEATURE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --module) MODULE="${2:-}"; shift 2;;
    --feature) FEATURE="${2:-}"; shift 2;;
    --json) shift;;
    *) shift;;
  esac
done

ROOT="$(vk_repo_root)"
if [ -f "$ROOT/verif-kit.config.json" ]; then CFG=true; else CFG=false; fi
if [ -z "$FEATURE" ] && [ -d "$ROOT/specs" ]; then FEATURE="$(ls -1 "$ROOT/specs" 2>/dev/null | head -n1)"; fi

VDIR="$(vk_verification_dir "$ROOT" "$FEATURE")"
CONTRACT="$VDIR/$MODULE.contract.md"; VPLAN="$VDIR/$MODULE.vplan.md"; VTASKS="$VDIR/$MODULE.verification-tasks.md"
[ -f "$CONTRACT" ] && CE=true || CE=false
[ -f "$VPLAN" ] && VE=true || VE=false
[ -f "$VTASKS" ] && TE=true || TE=false
CT="$(vk_cover_total "$VPLAN")"; CC="$(vk_cover_closed "$VPLAN")"
FOT="$(vk_first_open_task "$VTASKS")"

printf '{"repoRoot":"%s","configFound":%s,"feature":"%s","module":"%s","contractExists":%s,"vplanExists":%s,"verificationTasksExists":%s,"coverPointsTotal":%s,"coverPointsClosed":%s,"firstOpenTask":"%s"}\n' \
  "$ROOT" "$CFG" "$FEATURE" "$MODULE" "$CE" "$VE" "$TE" "${CT:-0}" "${CC:-0}" "$FOT"
