#!/bin/bash -e

SITE="${1:-www.baidu.com}"
SITE_NAME="${2:-$SITE}"
EXTRA_MSG="$3"

if [ $(curl -I -s -m 1 -w "%{http_code}" -o /dev/null $SITE) -eq 200 ]; then
	exit 0
fi

echo -e "\e[35m"
echo -e "Your network is not able to access $SITE_NAME!"
echo -e "$EXTRA_MSG"
echo -e "\e[0m"
exit 1
