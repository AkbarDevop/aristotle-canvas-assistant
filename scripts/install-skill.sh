#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKILL_SOURCE="${REPO_ROOT}/skills/aristotle"

usage() {
  cat <<'EOF'
Install the Aristotle skill into Codex and/or Claude Code.

Usage:
  bash scripts/install-skill.sh            # install into both Codex and Claude Code
  bash scripts/install-skill.sh all        # same as above
  bash scripts/install-skill.sh codex      # install only into ~/.codex/skills
  bash scripts/install-skill.sh claude     # install only into ~/.claude/skills

This installer creates symlinks back to the repo so the skill stays in sync.
EOF
}

if [[ ! -d "${SKILL_SOURCE}" ]]; then
  echo "Aristotle skill directory not found at ${SKILL_SOURCE}" >&2
  exit 1
fi

MODE="${1:-all}"

install_target() {
  local skills_dir="$1"
  local product_name="$2"
  local target_path="${skills_dir}/aristotle"

  mkdir -p "${skills_dir}"

  if [[ -e "${target_path}" && ! -L "${target_path}" ]]; then
    echo "Refusing to overwrite existing non-symlink path: ${target_path}" >&2
    exit 1
  fi

  rm -f "${target_path}"
  ln -s "${SKILL_SOURCE}" "${target_path}"
  echo "installed aristotle for ${product_name}: ${target_path}"
}

case "${MODE}" in
  all)
    install_target "${HOME}/.codex/skills" "codex"
    install_target "${HOME}/.claude/skills" "claude code"
    ;;
  codex)
    install_target "${HOME}/.codex/skills" "codex"
    ;;
  claude)
    install_target "${HOME}/.claude/skills" "claude code"
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown install target: ${MODE}" >&2
    echo "" >&2
    usage >&2
    exit 1
    ;;
esac

cat <<'EOF'

try it with prompts like:
- use $aristotle to check what matters in my next 7 days
- use $aristotle to prep me for ece 3510
- use $aristotle to sync canvas and publish my next task
EOF
