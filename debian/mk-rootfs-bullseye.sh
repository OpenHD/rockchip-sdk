#!/bin/bash -e

# Directory contains the target rootfs
TARGET_ROOTFS_DIR="binary"

case "${ARCH:-$1}" in
	arm|arm32|armhf)
		ARCH=armhf
		;;
	*)
		ARCH=arm64
		;;
esac

echo -e "\033[36m Building for $ARCH \033[0m"

if [ ! $VERSION ]; then
	VERSION="release"
fi

echo -e "\033[36m Building for $VERSION \033[0m"

if [ ! -e linaro-bullseye-alip-*.tar.gz ]; then
	echo "\033[36m Run mk-base-debian.sh first \033[0m"
	exit -1
fi

echo -e "\033[36m Extract image \033[0m"
sudo tar -xpf linaro-bullseye-alip-*.tar.gz

# packages folder
sudo mkdir -p $TARGET_ROOTFS_DIR/packages
sudo cp -rpf packages/$ARCH/* $TARGET_ROOTFS_DIR/packages

# overlay folder
sudo cp -rpf overlay/* $TARGET_ROOTFS_DIR/

# overlay-firmware folder
sudo cp -rpf overlay-firmware/* $TARGET_ROOTFS_DIR/

# overlay-debug folder
# adb, video, camera  test file
if [ "$VERSION" == "debug" ]; then
	sudo cp -rpf overlay-debug/* $TARGET_ROOTFS_DIR/
fi

echo -e "\033[36m Change root.....................\033[0m"

ID=$(stat --format %u $TARGET_ROOTFS_DIR)

cat << EOF | sudo chroot $TARGET_ROOTFS_DIR

# Fixup owners
if [ "$ID" -ne 0 ]; then
       find / -user $ID -exec chown -h 0:0 {} \;
fi
for u in \$(ls /home/); do
	chown -h -R \$u:\$u /home/\$u
done

echo "nameserver 8.8.8.8" >> /etc/resolv.conf
echo "nameserver 127.0.0.53" >> /etc/resolv.conf
echo "nameserver 114.114.114.114" >> /etc/resolv.conf

echo "deb http://mirrors.ustc.edu.cn/debian/ bullseye-backports main contrib" >> /etc/apt/sources.list
echo "deb-src http://mirrors.ustc.edu.cn/debian/ bullseye-backports main contrib" >> /etc/apt/sources.list

apt-get update
apt-get upgrade -y

export APT_INSTALL="apt-get install -fy --allow-downgrades"

# enter root username without password
sed -i "s~\(^ExecStart=.*\)~# \1\nExecStart=-/bin/sh -c '/bin/bash -l </dev/%I >/dev/%I 2>\&1'~" /usr/lib/systemd/system/serial-getty@.service

#---------------power management --------------
\${APT_INSTALL} pm-utils triggerhappy bsdmainutils
cp /etc/Powermanager/triggerhappy.service  /lib/systemd/system/triggerhappy.service
sed -i "s/#HandlePowerKey=.*/HandlePowerKey=ignore/" /etc/systemd/logind.conf

#---------------Rga--------------
\${APT_INSTALL} /packages/rga2/*.deb

echo -e "\033[36m Setup Video.................... \033[0m"
\${APT_INSTALL} gstreamer1.0-plugins-bad gstreamer1.0-plugins-base gstreamer1.0-plugins-ugly gstreamer1.0-tools gstreamer1.0-alsa \
gstreamer1.0-plugins-base-apps

\${APT_INSTALL} /packages/mpp/*
\${APT_INSTALL} /packages/gst-rkmpp/*.deb
\${APT_INSTALL} /packages/gstreamer/*.deb
\${APT_INSTALL} /packages/gst-plugins-base1.0/*.deb
\${APT_INSTALL} /packages/gst-plugins-bad1.0/*.deb
\${APT_INSTALL} /packages/gst-plugins-good1.0/*.deb

#---------Camera---------
echo -e "\033[36m Install camera.................... \033[0m"
\${APT_INSTALL} cheese v4l-utils
\${APT_INSTALL} /packages/libv4l/*.deb
\${APT_INSTALL} /packages/cheese/*.deb

#---------Xserver---------
echo -e "\033[36m Install Xserver.................... \033[0m"
\${APT_INSTALL} /packages/xserver/*.deb

apt-mark hold xserver-common xserver-xorg-core xserver-xorg-legacy

#---------Wayland/Weston---------
echo -e "\033[36m Install Wayland/Weston.................... \033[0m"
\${APT_INSTALL} /packages/weston/*.deb
\${APT_INSTALL} /packages/wayland/*.deb

#---------------Openbox--------------
echo -e "\033[36m Install openbox.................... \033[0m"
#\${APT_INSTALL} /packages/openbox/*.deb

#---------update chromium-----
\${APT_INSTALL} /packages/chromium/*.deb

#------------------libdrm------------
echo -e "\033[36m Install libdrm.................... \033[0m"
\${APT_INSTALL} /packages/libdrm/*.deb

#------------------libdrm-cursor------------
echo -e "\033[36m Install libdrm-cursor.................... \033[0m"
\${APT_INSTALL} /packages/libdrm-cursor/*.deb

#------------------blueman------------
echo -e "\033[36m Install blueman.................... \033[0m"
\${APT_INSTALL} blueman
echo exit 101 > /usr/sbin/policy-rc.d
chmod +x /usr/sbin/policy-rc.d
\${APT_INSTALL} blueman
rm -f /usr/sbin/policy-rc.d

#------------------blueman------------
echo -e "\033[36m Install blueman.................... \033[0m"
\${APT_INSTALL} /packages/blueman/*.deb

#------------------rkwifibt------------
echo -e "\033[36m Install rkwifibt.................... \033[0m"
\${APT_INSTALL} /packages/rkwifibt/*.deb
ln -s /system/etc/firmware /vendor/etc/

if [ "$VERSION" == "debug" ]; then
#------------------glmark2------------
echo -e "\033[36m Install glmark2.................... \033[0m"
\${APT_INSTALL} /packages/glmark2/*.deb
fi

if [ -e "/usr/lib/aarch64-linux-gnu" ] ;
then
#------------------rknpu2------------
echo -e "\033[36m move rknpu2.................... \033[0m"
mv /packages/rknpu2/rknpu2.tar  /
fi

#------------------rktoolkit------------
echo -e "\033[36m Install rktoolkit.................... \033[0m"
\${APT_INSTALL} /packages/rktoolkit/*.deb

echo -e "\033[36m Install Chinese fonts.................... \033[0m"
# Uncomment zh_CN.UTF-8 for inclusion in generation
sed -i 's/^# *\(zh_CN.UTF-8\)/\1/' /etc/locale.gen
echo "LANG=zh_CN.UTF-8" >> /etc/default/locale

# Generate locale
locale-gen

\${APT_INSTALL} ttf-wqy-zenhei fonts-aenigma
\${APT_INSTALL} xfonts-intl-chinese

#------------------pipewire------------
echo -e "\033[36m Install pipewire.................... \033[0m"
\${APT_INSTALL} pipewire pipewire-pulse pipewire-alsa libspa-0.2-bluetooth
\${APT_INSTALL} /packages/wireplumber/*.deb
find /usr/lib/systemd/ -name "wireplumber*.service" | xargs sed -i "/Environment/s/$/ DISPLAY=:0/"

# HACK debian11.3 to fix bug
#\${APT_INSTALL} fontconfig --reinstall

#\${APT_INSTALL} xfce4
#ln -sf /usr/bin/startxfce4 /etc/alternatives/x-session-manager

# HACK to disable the kernel logo on bootup
#sed -i "/exit 0/i \ echo 3 > /sys/class/graphics/fb0/blank" /etc/rc.local

cp /packages/libmali/libmali-*-x11*.deb /
cp -rf /packages/rkisp/*.deb /
cp -rf /packages/rkaiq/*.deb /
cp -rf /usr/lib/firmware/rockchip/ /

# reduce 500M size for rootfs
rm -rf /usr/lib/firmware
mkdir -p /usr/lib/firmware/
mv /rockchip /usr/lib/firmware/

# mark package to hold
apt list --installed | grep -v oldstable | cut -d/ -f1 | xargs apt-mark hold

#---------------Custom Script--------------
systemctl mask systemd-networkd-wait-online.service
systemctl mask NetworkManager-wait-online.service
rm /lib/systemd/system/wpa_supplicant@.service

rm -rf /var/lib/apt/lists/*
rm -rf /var/cache/
rm -rf /packages/

EOF
