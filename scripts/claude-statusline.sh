#!/usr/bin/env bash
set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0
input="$(cat)"
[ -n "$input" ] || exit 0

parsed="$(
  printf '%s' "$input" | jq -r '
    def member($object; $key):
      if ($object | type) == "object" then $object[$key] else null end;
    def clean:
      if type == "string"
      then gsub("[[:cntrl:]]"; "") | gsub("[[:space:]]+"; " ") | sub("^ "; "") | sub(" $"; "")
      else ""
      end;
    def bounded($value; $min; $max):
      if ($value | type) != "number" then null
      elif ($value | isfinite) | not then null
      elif $value < $min or $value > $max then null
      else $value
      end;
    def context:
      (member(.; "context_window")) as $window
      | bounded(member($window; "remaining_percentage"); 0; 100) as $value
      | if $value == null then "" else "ctx \(($value | floor) | tostring)%" end;
    def fast:
      member(.; "fast_mode") as $value
      | if ($value | type) == "boolean"
        then "Fast:" + (if $value then "on" else "off" end)
        else ""
        end;
    def cache:
      member(.; "prompt_cache") as $prompt_cache
      | if ($prompt_cache | type) != "object" then ""
        elif member($prompt_cache; "caching_observed") == false then "cache unreported"
        else
          member($prompt_cache; "warm") as $warm
          | if ($warm | type) != "boolean" then ""
            else
              bounded(member($prompt_cache; "hit_ratio"); 0; 1) as $ratio
              | "cache " + (if $warm then "warm" else "cold" end)
                + (if $ratio == null then "" else " " + (($ratio * 100 | round) | tostring) + "%" end)
            end
          end;
    def model:
      [(member(member(.; "model"); "display_name") | clean),
       (member(member(.; "effort"); "level") | clean)]
      | map(select(length > 0))
      | join(" ");
    def version:
      member(.; "version") | clean
      | if length == 0 then "" elif startswith("v") then . else "v" + . end;
    [model, fast, context, cache,
     (member(member(.; "workspace"); "current_dir") | clean), version]
    | map(gsub("\u001f"; ""))
    | join("\u001f")
  ' 2>/dev/null
)" || exit 0

IFS="$(printf '\037')" read -r model fast context cache cwd version <<<"$parsed"
branch=""
if [ -n "$cwd" ] && [ -d "$cwd" ]; then
  branch="$(git -C "$cwd" --no-optional-locks branch --show-current 2>/dev/null || true)"
fi

parts=()
[ -n "$model" ] && parts+=("$model")
[ -n "$fast" ] && parts+=("$fast")
[ -n "$context" ] && parts+=("$context")
[ -n "$cache" ] && parts+=("$cache")
[ -n "$branch" ] && parts+=("$branch")
[ -n "$version" ] && parts+=("$version")

if [ "${#parts[@]}" -gt 0 ]; then
  output="${parts[0]}"
  for part in "${parts[@]:1}"; do
    output+=" | $part"
  done
  printf '%s\n' "$output"
fi
