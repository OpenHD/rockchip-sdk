#!/bin/bash -e

# Hooks

usage_hook()
{
	echo -e "shell                             \tsetup a shell for developing"
}

PRE_BUILD_CMDS="shell"
pre_build_hook()
{
	warning "Doing this is dangerous and for developing only."
	# No error handling in develop shell.
	set +e; trap ERR
	/bin/bash
	warning "Exit from $BASH_SOURCE shell."
}

source "${RK_BUILD_HELPER:-$(dirname "$(realpath "$0")")/../build-hooks/build-helper}"

pre_build_hook
