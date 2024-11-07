#!/bin/bash -e
### BEGIN INIT INFO
# Provides:          rockchip
# Required-Start:
# Required-Stop:
# Default-Start:
# Default-Stop:
# Short-Description:
# Description:       Setup rockchip platform environment
### END INIT INFO

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

install_packages() {
    case $1 in
        rk3288)
		MALI=midgard-t76x-r18p0-r0p0
		ISP=rkisp
		# 3288w
		cat /sys/devices/platform/*gpu/gpuinfo | grep -q r1p0 && \
		MALI=midgard-t76x-r18p0-r1p0
		sed -i "s/always/none/g" /etc/X11/xorg.conf.d/20-modesetting.conf
		[ -e /usr/lib/arm-linux-gnueabihf/ ] && apt install -fy --allow-downgrades /camera_engine_$ISP*.deb
		;;
        rk3399|rk3399pro)
		MALI=midgard-t86x-r18p0
		ISP=rkisp
		sed -i "s/always/none/g" /etc/X11/xorg.conf.d/20-modesetting.conf
		[ -e /usr/lib/aarch64-linux-gnu/ ] && apt install -fy --allow-downgrades /camera_engine_$ISP*.deb
		;;
        rk3328|rk3528)
		MALI=utgard-450
		ISP=rkisp
		sed -i "s/always/none/g" /etc/X11/xorg.conf.d/20-modesetting.conf
		;;
        rk3326|px30)
		MALI=bifrost-g31-g13p0
		ISP=rkisp
		sed -i "s/always/none/g" /etc/X11/xorg.conf.d/20-modesetting.conf
		[ -e /usr/lib/aarch64-linux-gnu/ ] && apt install -fy --allow-downgrades /camera_engine_$ISP*.deb
		;;
        rk3128|rk3036)
		MALI=utgard-400
		ISP=rkisp
		sed -i "s/always/none/g" /etc/X11/xorg.conf.d/20-modesetting.conf
		[ -e /usr/lib/arm-linux-gnueabihf/ ] && apt install -fy --allow-downgrades /camera_engine_$ISP*.deb
		;;
        rk3568|rk3566)
		MALI=bifrost-g52-g13p0
		ISP=rkaiq_rk3568
		[ -e /usr/lib/aarch64-linux-gnu/ ] && tar xvf /rknpu2.tar -C /
		[ -e /usr/lib/aarch64-linux-gnu/ ] && apt install -fy --allow-downgrades /camera_engine_$ISP*.deb
		;;
        rk3562)
		MALI=bifrost-g52-g13p0
		ISP=rkaiq_rk3562
		[ -e /usr/lib/aarch64-linux-gnu/ ] && tar xvf /rknpu2.tar -C /
		[ -e /usr/lib/aarch64-linux-gnu/ ] && apt install -fy --allow-downgrades /camera_engine_$ISP*.deb
		;;
        rk3576)
		MALI=bifrost-g52-g13p0
		ISP=rkaiq_rk3576
		[ -e /usr/lib/aarch64-linux-gnu/ ] && tar xvf /rknpu2.tar -C /
		[ -e /usr/lib/aarch64-linux-gnu/ ] && apt install -fy --allow-downgrades /camera_engine_$ISP*.deb
		;;
        rk3588|rk3588s)
		ISP=rkaiq_rk3588
		MALI=valhall-g610-g13p0
		[ -e /usr/lib/aarch64-linux-gnu/ ] && tar xvf /rknpu2.tar -C /
		[ -e /usr/lib/aarch64-linux-gnu/ ] && apt install -fy --allow-downgrades /camera_engine_$ISP*.deb
		;;
        *)
        echo "This chip does not support gpu acceleration or not input!!!"
		;;
    esac
    apt install -fy --allow-downgrades /libmali-*$MALI*-x11*.deb
}

# Upgrade NPU FW
update_npu_fw() {
    /usr/bin/npu-image.sh
    sleep 1
    /usr/bin/npu_transfer_proxy &
}


compatible=$(cat /proc/device-tree/compatible)
chipname=""
case "$compatible" in
    *rk3288*)  chipname="rk3288" ;;
    *rk3328*)  chipname="rk3328" ;;
    *rk3399pro*)
        chipname="rk3399pro"
        update_npu_fw
        ;;
    *rk3399*)  chipname="rk3399" ;;
    *rk3326*)  chipname="rk3326" ;;
    *px30*)    chipname="px30" ;;
    *rk3128*)  chipname="rk3128" ;;
    *rk3528*)  chipname="rk3528" ;;
    *rk3562*)  chipname="rk3562" ;;
    *rk3566*)  chipname="rk3566" ;;
    *rk3568*)  chipname="rk3568" ;;
    *rk3576*)  chipname="rk3576" ;;
    *rk3588*)  chipname="rk3588" ;;
    *rk3036*)  chipname="rk3036" ;;
    *rk3308*)  chipname="rk3208" ;;
    *rv1126*)  chipname="rv1126" ;;
    *rv1109*)  chipname="rv1109" ;;
    *)
        echo "Please check if the SoC is supported on Rockchip Linux!"
        exit 1
        ;;
esac
compatible="${compatible#rockchip,}"
boardname="${compatible%%rockchip,*}"

# first boot configure
if [ ! -e "/usr/local/first_boot_flag" ]; then
    echo "It's the first time booting. The rootfs will be configured."

    # Force rootfs synced
    mount -o remount,sync /

    install_packages "$chipname" || exit 1

    setcap CAP_SYS_ADMIN+ep /usr/bin/gst-launch-1.0

    if [ -e "/dev/rfkill" ]; then
        rm /dev/rfkill
    fi

    rm -rf /*.deb /*.tar

    touch /usr/local/first_boot_flag

    # In order to achieve better compatibility, various applications will being
    # installed during the first system startup. This can result in slow boot times,
    # slow read/write speeds, and issues such as PipeWire audio being silent.
    sync
    shutdown -r now
fi

# support power management
if [ -e "/usr/sbin/pm-suspend" ] && [ -e /etc/Powermanager ]; then
    if [ "$chipname" == "rk3399pro" ]; then
        mv /etc/Powermanager/01npu /usr/lib/pm-utils/sleep.d/
        mv /etc/Powermanager/02npu /lib/systemd/system-sleep/
        service input-event-daemon restart
    fi
    rm -rf /etc/Powermanager
fi

# Create dummy video node for chromium V4L2 VDA/VEA with rkmpp plugin
echo dec > /dev/video-dec0
echo enc > /dev/video-enc0
chmod 660 /dev/video-*
chown root:video /dev/video-*

# The chromium using fixed pathes for libv4l2.so
ln -rsf /usr/lib/*/libv4l2.so /usr/lib/
if [ -e /usr/lib/aarch64-linux-gnu/ ]; then
    ln -Tsf lib /usr/lib64
fi

# sync system time
hwclock --systohc

# read mac-address from efuse
# if [ "$BOARDNAME" == "rk3288-miniarm" ]; then
#     MAC=`xxd -s 16 -l 6 -g 1 /sys/bus/nvmem/devices/rockchip-efuse0/nvmem | awk '{print $2$3$4$5$6$7 }'`
#     ifconfig eth0 hw ether $MAC
# fi
