/* SPDX-License-Identifier: BSD-3-Clause */
/*
 * Copyright (c) 2021 Rockchip Electronics Co., Ltd.
 */

#include "rtconfig.h"

MEMORY
{
    SRAM  (rxw) : ORIGIN = 0xfdcc0000, LENGTH = 64K
    DRAM  (rxw) : ORIGIN = RT_RUN_MEM_BASE, LENGTH = RT_RUN_MEM_SIZE
}

SECTIONS
{
    .text :
    {
        _stext = .;
        KEEP(*(.text.entrypoint))       /* The entry point */
        *(.vectors)
        *(.text)                        /* remaining code */
        *(.text.*)                      /* remaining code */

        *(.rodata)                      /* read-only data (constants) */
        *(.rodata*)
        *(.glue_7)
        *(.glue_7t)
        *(.gnu.linkonce.t*)

        *(COMMON)

        /* section information for finsh shell */
        . = ALIGN(16);
        __fsymtab_start = .;
        KEEP(*(FSymTab))
        __fsymtab_end = .;
        . = ALIGN(16);
        __vsymtab_start = .;
        KEEP(*(VSymTab))
        __vsymtab_end = .;
        . = ALIGN(16);

        /* section information for initial. */
        . = ALIGN(16);
        __rt_init_start = .;
        KEEP(*(SORT(.rti_fn*)))
        __rt_init_end = .;
        . = ALIGN(16);

        . = ALIGN(16);
        _etext = .;
    } > DRAM

    __exidx_start = .;
    .ARM.exidx   :
    {
        *(.ARM.exidx* .gnu.linkonce.armexidx.*)
    } > DRAM
    __exidx_end = .;

    __rodata_start = .;
    .rodata   :
    {
        *(.rodata) *(.rodata.*)
    } > DRAM
    __rodata_end = .;

    . = ALIGN(16);

    .data :
    {
        *(.data)
        *(.data.*)

        . = ALIGN(16);
        _gp = ABSOLUTE(.);     /* Base of small data */
    } > DRAM

    . = ALIGN(16);

    .ctors :
    {
        PROVIDE(__ctors_start__ = .);
        KEEP(*(SORT(.ctors.*)))
        KEEP(*(.ctors))
        PROVIDE(__ctors_end__ = .);
    } > DRAM

    .dtors :
    {
        PROVIDE(__dtors_start__ = .);
        KEEP(*(SORT(.dtors.*)))
        KEEP(*(.dtors))
        PROVIDE(__dtors_end__ = .);
    } > DRAM

    . = ALIGN(16);
    .bss (NOLOAD) :
    {
        PROVIDE(__bss_start = .);
        *(.bss)
        *(.bss.*)
        *(.dynbss)
        *(COMMON)
        . = ALIGN(16);
        PROVIDE(__bss_end = .);
    } > DRAM

    .heap :
    {
        . = ALIGN(16);
        PROVIDE(__heap_begin = .);
#ifdef RT_USING_UNCACHE_HEAP
        . = ORIGIN(DRAM) + LENGTH(DRAM) - RT_UNCACHE_HEAP_SIZE;
#else
        . = ORIGIN(DRAM) + LENGTH(DRAM);
#endif
        PROVIDE(__heap_end = .);
    } > DRAM
}
