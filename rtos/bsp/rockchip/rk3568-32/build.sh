#!/bin/bash

export LC_ALL=C.UTF-8
export LANG=C.UTF-8

usage() {
	echo "usage: ./build.sh"
}

CUR_DIR=$(pwd)
IMAGE=$(pwd)/Image

scons -c
rm -rf $CUR_DIR/gcc_arm.ld $IMAGE/amp.img $IMAGE/rtthread.bin
scons -j24
./mkimage.sh

