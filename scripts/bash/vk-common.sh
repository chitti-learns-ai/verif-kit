#!/usr/bin/env bash
# Verif-Kit shared bash library (POSIX-parity with vk-common.ps1). Source it.
# Core resolvers avoid a jq dependency; full config-path templating (reading
# verif-kit.config.json paths) is left to jq-enabled callers.

vk_repo_root() {
  local dir; dir="$(pwd)"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/verif-kit.config.json" ] || [ -d "$dir/.verif-kit" ] || [ -d "$dir/.git" ]; then
      echo "$dir"; return 0
    fi
    dir="$(dirname "$dir")"
  done
  pwd
}

vk_verification_dir() { # $1 root  $2 feature
  echo "$1/specs/$2/verification"
}

vk_cover_total() { # $1 vplan path
  if [ -f "$1" ]; then grep -cE '^[[:space:]]*-[[:space:]]*\[[ xX]\][[:space:]]*V[0-9]' "$1" || true; else echo 0; fi
}
vk_cover_closed() {
  if [ -f "$1" ]; then grep -cE '^[[:space:]]*-[[:space:]]*\[[xX]\][[:space:]]*V[0-9]' "$1" || true; else echo 0; fi
}
vk_first_open_task() { # $1 verification-tasks path
  if [ -f "$1" ]; then
    grep -oE '^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*VT[0-9].*$' "$1" | head -n1 | sed -E 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//' || true
  fi
}
