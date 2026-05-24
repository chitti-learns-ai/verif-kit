#!/usr/bin/env bash
# Verif-Kit setup (bash): create the per-module verification dir and seed the
# ticking checklists from templates. Usage:
#   ./vk-setup-verification.sh --module price-calculator --feature 001-checkout --json
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
[ -z "$MODULE" ] || [ -z "$FEATURE" ] && { echo '{"error":"--module and --feature required"}'; exit 1; }

ROOT="$(vk_repo_root)"
VDIR="$(vk_verification_dir "$ROOT" "$FEATURE")"
mkdir -p "$VDIR"

TPL=""
for c in .specify/templates .verif-kit/templates verif-kit/templates; do
  if [ -d "$ROOT/$c" ]; then TPL="$ROOT/$c"; break; fi
done

copy_if_absent() { # $1 template name  $2 dest
  local src="$TPL/$1" dest="$2"
  [ -e "$dest" ] && return 0
  [ -n "$TPL" ] && [ -f "$src" ] && sed "s/\[MODULE\]/$MODULE/g" "$src" > "$dest"
}
copy_if_absent verification-tasks-template.md "$VDIR/$MODULE.verification-tasks.md"
copy_if_absent vplan-template.md "$VDIR/$MODULE.vplan.md"
copy_if_absent verification-contract-template.md "$VDIR/$MODULE.contract.md"

printf '{"created":true,"templatesFrom":"%s","verificationDir":"%s"}\n' "$TPL" "$VDIR"
