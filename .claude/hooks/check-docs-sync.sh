#!/usr/bin/env bash
# Stop hook — Política de Documentação Viva do CINESAFE.
# Se código-fonte foi alterado no working tree mas a documentação (docs/ ou *.md) NÃO,
# bloqueia UMA vez pedindo para atualizar a doc. Respeita stop_hook_active (não faz loop).
# Falha de forma segura (exit 0 / libera) se algo der errado.

input="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0

# Evita loop: se já estamos continuando por causa deste próprio hook, libera.
active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)"
[ "$active" = "true" ] && exit 0

root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -z "$root" ] && exit 0
cd "$root" || exit 0

# Arquivos alterados: staged + unstaged + untracked. Remove o prefixo de status (XY ).
changed="$(git status --porcelain=v1 --untracked-files=all 2>/dev/null | sed 's/^...//')"
[ -z "$changed" ] && exit 0

src_changed=0
docs_changed=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  # Renomeações "antigo -> novo": considera o destino.
  case "$f" in *" -> "*) f="${f##* -> }" ;; esac
  # Tira aspas que o git adiciona a caminhos com espaço/acentos.
  f="${f%\"}"; f="${f#\"}"
  case "$f" in
    docs/*|*.md)
      docs_changed=1 ;;
    pages/*|components/*|services/*|hooks/*|context/*|utils/*|*.ts|*.tsx|*.jsx|*.js|*.css|*.rules)
      src_changed=1 ;;
  esac
done <<EOF
$changed
EOF

if [ "$src_changed" = "1" ] && [ "$docs_changed" = "0" ]; then
  reason="⚠️ Documentação Viva (CINESAFE): há alterações de código-fonte sem a atualização \
correspondente na documentação. Antes de finalizar, atualize a doc afetada em docs/ \
(features/, reference/, 03-data-model.md, 04-security.md) e, se for decisão de arquitetura, \
adicione um ADR em docs/decisions/. Objetivo: manter o sistema 100% documentado. \
(Este aviso ocorre uma única vez por rodada.)"
  jq -n --arg r "$reason" '{decision: "block", reason: $r}' 2>/dev/null
  exit 0
fi

exit 0
