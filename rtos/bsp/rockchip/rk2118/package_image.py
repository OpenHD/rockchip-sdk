#!/usr/bin/env python3

import sys
import os
import subprocess

xip = True

def get_vectors_section_address(elf_file):
    try:
        # 使用readelf命令获取ELF文件的section信息
        output = subprocess.check_output(['readelf', '-S', elf_file], universal_newlines=True)

        # 解析readelf命令的输出
        for line in output.split('\n'):
            if '.vectors' in line:
                # 提取.vectors section的起始地址
                address = line.split()[4]
                return int(address, 16)

        return None
    except FileNotFoundError:
        print(f"{elf_file} not found")
        return None
    except subprocess.CalledProcessError as e:
        print(f"readelf error: {e}")
        return None

def find_part_offset(file_path, search_string):
    with open(file_path, 'r') as file:
        lines = file.readlines()

        for i in range(len(lines)):
            if search_string in lines[i]:
                offset_line = lines[i-3]
                if offset_line.startswith('PartOffset='):
                    offset_value = offset_line.split('=')[1].strip()
                    return offset_value

    return None

def check_xip_addr(setting_file):
    search_list = ['File=../../Image/rtt0.img', 'File=../../Image/rtt1.img']
    for search_string in search_list:
        # 查找并打印PartOffset，如果没找到就找下一个
        part_offset = find_part_offset(setting_file, search_string)
        if part_offset is None :
            print(f"not found PartOffset for {search_string}")
            continue

        part_offset = 512 * int(part_offset, 16)
        part_offset += 0x11000000 + 0x800
        print(f"found {search_string} PartOffset: 0x{part_offset:x}")

        # 获取.vectors section的起始地址，如果不在XIP范围内，则忽略
        elf_file = search_string.split('/')[3].strip().replace('.img', '.elf')
        if os.path.exists(elf_file) :
            vectors_address = get_vectors_section_address(elf_file)
            if vectors_address is None:
                print(f"can not found .vectors section in {elf_file}")
                continue

            if vectors_address < 0x11000000 or vectors_address >= 0x20000000 :
                global xip
                xip = False
                print("vectors address is not in the XIP range, check ignore")
                continue

            if part_offset == vectors_address :
                print(f"{elf_file} part_offset==vectors_address")
            else:
                print(f"{elf_file} part_offset=0x{part_offset:x}, xip_address=0x{vectors_address:x}")

def package_fw(setting_file):
    search_list = ['File=../../Image/rtt0.img', 'File=../../Image/rtt1.img']
    for search_string in search_list:
        # 查找并打印PartOffset，如果没找到就找下一个
        part_offset = find_part_offset(setting_file, search_string)
        if part_offset is None :
            print(f"not found PartOffset for {search_string}")
            continue

        img_file = search_string.split('/')[3].strip()
        bin_file = search_string.split('/')[3].strip().replace('.img', '.bin')
        json_file = search_string.split('/')[3].strip().replace('.img', '.json')
        subprocess.call((f"cp {bin_file} ./Image/{img_file}"), shell=True)
        if xip :
            print("package xip image")
            subprocess.call((f"cp ./rkbin/tfm_s.bin ./Image/tfm_s.img"), shell=True)
            subprocess.call((f"../tools/resource_header_tool pack --json Image/config/xip_on/{json_file} ./Image/{img_file}"), shell=True)
            subprocess.call(("../tools/resource_header_tool pack --json Image/config/xip_on/tfm_s.json ./Image/tfm_s.img"), shell=True)
        else :
            print("package normal image")
            subprocess.call((f"cp ./rkbin/tfm_s_ddr.bin ./Image/tfm_s.img"), shell=True)
            subprocess.call((f"../tools/resource_header_tool pack --json Image/config/xip_off/{json_file} ./Image/{img_file}"), shell=True)
            subprocess.call(("../tools/resource_header_tool pack --json Image/config/xip_off/tfm_s.json ./Image/tfm_s.img"), shell=True)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: check_xip_addr.py <setting.ini>")
        sys.exit(1)

    setting_file = sys.argv[1]
    if os.path.exists(setting_file) :
        check_xip_addr(setting_file)
        package_fw(setting_file)
    print("check xip addr finish")
    sys.exit(0)
