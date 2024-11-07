#! /bin/bash

export LC_ALL=C.UTF-8
export LANG=C.UTF-8

usage() {
	echo "usage: ./mkimage.sh [partition_setting]"
}

CUR_DIR=$(pwd)
TOOLS=$CUR_DIR/../tools
IMAGE=$(pwd)/Image

../tools/boot_merger ./Image/rk2118_ddr.ini
../tools/boot_merger ./Image/rk2118_no_ddr.ini
rm $IMAGE/rk2118_db_loader.bin

rm -rf $IMAGE/rtt*.img $IMAGE/Firmware*

if [ ! -n "$1" ] ;then
    ./package_image.py board/common/setting.ini
    if [ ! $? -eq 0 ] ;then
        echo "mkimage fail"
        exit
    fi
    $TOOLS/firmware_merger/firmware_merger -p board/common/setting.ini $IMAGE/
else
    ./package_image.py $1
    if [ ! $? -eq 0 ] ;then
        echo "mkimage fail"
        exit
    fi 
    $TOOLS/firmware_merger/firmware_merger -p $1 $IMAGE/
fi
