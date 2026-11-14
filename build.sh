#!/bin/bash
# Preserve the legacy SDK entry point, including its sourced-shell behavior.
_nex_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [ "$0" != "${BASH_SOURCE[0]}" ]; then
    if "$_nex_root/build.sh" "${@:-shell}"; then
        unset _nex_root
    else
        _nex_status=$?
        unset _nex_root
        return "$_nex_status"
    fi
else
    exec bash "$_nex_root/platform/dispatch.sh" "$@"
fi
