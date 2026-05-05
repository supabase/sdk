#!/usr/bin/env bash
# install-skills.sh — installs Supabase SDK skills for Claude Code
#
# Usage:
#   ./scripts/install-skills.sh           # install all skills
#   ./scripts/install-skills.sh sdk-spec  # install a specific skill
#
# Skills are installed to ~/.claude/skills/, which Claude Code loads
# automatically. Existing skills are backed up before overwriting.

set -euo pipefail

SKILLS_SRC="$(cd "$(dirname "$0")/../skills" && pwd)"
SKILLS_DEST="${HOME}/.claude/skills"
BACKUP_DIR="${HOME}/.claude/skills-backup/$(date +%Y%m%d-%H%M%S)"

# ── helpers ────────────────────────────────────────────────────────────────

green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
red() { printf '\033[0;31m%s\033[0m\n' "$*"; }

install_skill() {
  local skill_name="$1"
  local src="${SKILLS_SRC}/${skill_name}"
  local dest="${SKILLS_DEST}/${skill_name}"

  if [[ ! -d "$src" ]]; then
    red "skill not found: ${skill_name} (looked in ${src})"
    return 1
  fi

  # back up existing installation
  if [[ -d "$dest" ]]; then
    mkdir -p "$BACKUP_DIR"
    cp -r "$dest" "${BACKUP_DIR}/${skill_name}"
    yellow "  backed up existing ${skill_name} to ${BACKUP_DIR}/${skill_name}"
  fi

  mkdir -p "$dest"
  cp -r "${src}/." "${dest}/"
  green "  installed ${skill_name} → ${dest}"
}

# ── main ───────────────────────────────────────────────────────────────────

mkdir -p "$SKILLS_DEST"

if [[ $# -gt 0 ]]; then
  # install specific skills named as arguments
  for skill in "$@"; do
    echo "Installing skill: ${skill}"
    install_skill "$skill"
  done
else
  # install all skills found in the skills/ directory
  skills=()
  while IFS= read -r -d '' dir; do
    skills+=("$(basename "$dir")")
  done < <(find "$SKILLS_SRC" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

  if [[ ${#skills[@]} -eq 0 ]]; then
    yellow "No skills found in ${SKILLS_SRC}"
    exit 0
  fi

  echo "Installing ${#skills[@]} skill(s) from supabase/sdk:"
  for skill in "${skills[@]}"; do
    install_skill "$skill"
  done
fi

echo ""
green "Done. Restart Claude Code (or open a new session) for skills to take effect."
