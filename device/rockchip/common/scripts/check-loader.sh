#!/bin/bash -e

RK_SCRIPTS_DIR="${RK_SCRIPTS_DIR:-$(dirname "$(realpath "$0")")}"

# Lots scripts in u-boot require python2
"$RK_SCRIPTS_DIR/check-package.sh" python2
