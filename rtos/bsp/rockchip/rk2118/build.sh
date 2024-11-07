#!/bin/bash

usage () {
    echo "Usage: $0 <board name> [cpu0|cpu1|dual]"
    echo "build cpu0          :  $0 adsp_demo"
    echo "                  or"
    echo "                       $0 adsp_demo cpu0"
    echo "build cpu1          :  $0 adsp_demo cpu1"
    echo "build cpu0 and cpu1 :  $0 adsp_demo dual"
}

#0: build cpu0
#1: build cpu1
#2: build cpu0 and cpu1
build_type=0

# Check argument
if [ "$#" -lt 1 ]; then
    usage
    exit 1
fi

if [ "$#" -eq 2 ]; then
    if [ "$2" == "dual" ]; then
        build_type=2
    elif [ "$2" == "cpu0" ]; then
	build_type=0
    elif [ "$2" == "cpu1" ]; then
	build_type=1
    else
        usage
        exit 1
    fi
fi

if [ ! -d "board/$1" ]; then
    echo "cannot found board $1"
    exit 1
fi

BOARD_NAME=$1
if [ "$BOARD_NAME" == "evb" ]; then
    export RTT_BUILD_XIP=Y
else
    export RTT_BUILD_XIP=Y
fi
DEFCONFIG_PATH0="board/${BOARD_NAME}/defconfig"
SETTING_INI_PATH0="board/${BOARD_NAME}/setting.ini"
DEFCONFIG_PATH1="board/${BOARD_NAME}/cpu1_defconfig"
SETTING_INI_PATH1="board/${BOARD_NAME}/dual_cpu_setting.ini"
separator_srt="--------------------------------"

for i in 0 1; do
    if  [ "$build_type" != 2 ] && [ "$build_type" != $i ]; then
	continue
    fi

    echo "$separator_srt scons -c $separator_srt"
    scons -c

    echo "$separator_srt start build cpu$i rtt $separator_srt"

    # Copy the configuration file
    if [ "$i" -eq 0 ]; then
        echo "$separator_srt copy $DEFCONFIG_PATH0 $separator_srt"
        cp $DEFCONFIG_PATH0 .config
	if [ $? -ne 0 ]; then
	    exit 1
	fi
    else
	echo "$separator_srt copy $DEFCONFIG_PATH1 $separator_srt"
	cp $DEFCONFIG_PATH1 .config
	if [ $? -ne 0 ]; then
	    exit 1
	fi
    fi

    # scons --useconfig=.config
    echo "$separator_srt scons --useconfig=.config $separator_srt"
    scons --useconfig=.config

    # scons --menuconfig
    echo "$separator_srt scons --menuconfig $separator_srt"
    scons --menuconfig

    # Build the project
    echo "$separator_srt scons $separator_srt"
    scons -j$(nproc)
    if [ "$?" -gt 0 ]; then
	exit 1
    fi
done

CPU0_FW_NAME="rtt0.bin"
CPU1_FW_NAME="rtt1.bin"

# Generate the image
if [ "$build_type" != 0 ]; then
    SETTING_INI_PATH=$SETTING_INI_PATH1
else
    SETTING_INI_PATH=$SETTING_INI_PATH0
fi

if [ ! -f "$SETTING_INI_PATH" ]; then
    echo "-------------------------------- ./mkimage.sh board/common/setting.ini --------------------------------"
    ./mkimage.sh
else
    echo "-------------------------------- ./mkimage.sh $SETTING_INI_PATH --------------------------------"
    ./mkimage.sh $SETTING_INI_PATH
fi

