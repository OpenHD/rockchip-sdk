/*
 * Copyright (c) 2021 Rockchip Electronics Co., Ltd.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Change Logs:
 * Date           Author       Notes
 * 2021-04-12     Steven Liu   first implementation
 */

#ifndef __BOARD_BASE_H__
#define __BOARD_BASE_H__

#include "rtconfig.h"
#include <stdint.h>
#include "hal_base.h"

#include "spinlock_id.h"

#ifdef RT_USING_RPMSG_LITE
#include "rpmsg_base.h"
#endif

#define MAX_HANDLERS        NUM_INTERRUPTS
#define __REG32(x) (*((volatile unsigned int*)((rt_uint32_t)x)))

#ifndef PLL_INPUT_OSC_RATE
#define PLL_INPUT_OSC_RATE  24000000
#endif

extern uint32_t __bss_start[];
extern uint32_t __bss_end[];

extern uint32_t __heap_begin[];
extern uint32_t __heap_end[];

#define RT_HW_HEAP_BEGIN    (void*)&__heap_begin
#define RT_HW_HEAP_END      (void*)&__heap_end

#ifdef RT_USING_UNCACHE_HEAP
#define RT_RUN_UNCACHE_MEM_BASE  (RT_RUN_MEM_BASE + RT_RUN_MEM_SIZE - RT_UNCACHE_HEAP_SIZE)
#endif

void rt_hw_board_init(void);

#endif
