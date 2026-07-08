#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit) — Política de Documentação Viva do CINESAFE.
# Injeta um lembrete para CONSULTAR a documentação em docs/ ANTES de alterar código-fonte
# e ATUALIZAR a doc correspondente DEPOIS. Nunca bloqueia (sempre exit 0).
# Silencioso ao editar a própria documentação, markdown ou config do Claude.

input="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0

file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.filePath // empty' 2>/dev/null)"
[ -z "$file" ] && exit 0

# Não lembrar ao mexer na própria documentação / markdown / config.
case "$file" in
  */docs/*|*.md|*/.claude/*) exit 0 ;;
esac

# Lembrar apenas para código-fonte relevante do app.
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.css|*.rules) ;;
  *) exit 0 ;;
esac

msg="📖 Política CINESAFE — Documentação Viva. ANTES de alterar este arquivo, consulte a doc \
relevante em docs/ (features/, reference/, 03-data-model.md, 04-security.md). DEPOIS de \
alterar, ATUALIZE a doc correspondente e, se for uma decisão de arquitetura, registre um ADR \
em docs/decisions/. Meta: manter o sistema 100% documentado. Convenções em AGENTS.md."

jq -n --arg c "$msg" \
  '{hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: $c}}' 2>/dev/null

exit 0
