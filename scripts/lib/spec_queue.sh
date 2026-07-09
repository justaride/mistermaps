#!/bin/bash
#
# Ralph Wiggum Spec Queue Helpers
#
# Lightweight helpers for the root-level numbered specs.
#
# A spec is COMPLETE when it contains one of these start-of-line forms:
#   Status: COMPLETE
#   **Status**: COMPLETE
#   ## Status: COMPLETE

get_root_specs() {
    local specs_dir="${1:-specs}"

    [ -d "$specs_dir" ] || return 0
    find "$specs_dir" -maxdepth 1 -type f -name "*.md" | sort
}

is_root_spec_complete() {
    local spec_file="$1"

    [ -f "$spec_file" ] || return 1
    grep -Eq '^(#{1,3} )?(\*\*)?Status(\*\*)?:[[:space:]]+COMPLETE' "$spec_file"
}

get_incomplete_root_specs() {
    local specs_dir="${1:-specs}"
    local spec_file

    while IFS= read -r spec_file; do
        [ -n "$spec_file" ] || continue
        if ! is_root_spec_complete "$spec_file"; then
            printf '%s\n' "$spec_file"
        fi
    done < <(get_root_specs "$specs_dir")
}

count_root_specs() {
    local specs_dir="${1:-specs}"
    get_root_specs "$specs_dir" | wc -l | tr -d ' '
}

count_incomplete_root_specs() {
    local specs_dir="${1:-specs}"
    get_incomplete_root_specs "$specs_dir" | wc -l | tr -d ' '
}

get_first_incomplete_root_spec() {
    local specs_dir="${1:-specs}"
    get_incomplete_root_specs "$specs_dir" | head -n 1
}
