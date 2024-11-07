/*
 * Copyright (c) 2021 Rockchip Electronics Co., Ltd.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Change Logs:
 * Date           Author       Notes
 * 2021-04-22     Tony Xie     first implementation
 */

#ifndef __INTERRUPT_H__
#define __INTERRUPT_H__

#include <rthw.h>

#define GIC_ACK_INTID_MASK  0x000003ff

void rt_hw_interrupt_control(int vector, int priority, int route);
int rt_hw_interrupt_get_irq(void);
void rt_hw_interrupt_ack(int vector);

#endif
