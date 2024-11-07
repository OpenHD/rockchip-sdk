/*
 * Copyright (c) 2021 Rockchip Electronics Co., Ltd.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Change Logs:
 * Date           Author       Notes
 * 2021-04-22     Tony Xie     first implementation
 */

#include <rtthread.h>
#include "interrupt.h"
#include "board.h"

/* exception and interrupt handler table */
struct rt_irq_desc isr_table[MAX_HANDLERS];

/* Those varibles will be accessed in ISR, so we need to share them. */
rt_uint32_t rt_interrupt_from_thread        = 0;
rt_uint32_t rt_interrupt_to_thread          = 0;
rt_uint32_t rt_thread_switch_interrupt_flag = 0;

const unsigned int VECTOR_BASE = 0x00;
extern void rt_cpu_vector_set_base(unsigned int addr);
extern int system_vectors;

void rt_hw_vector_init(void)
{
    rt_cpu_vector_set_base((unsigned int)&system_vectors);
}

/**
 * This function will initialize hardware interrupt
 */
void rt_hw_interrupt_init(void)
{
    /* initialize vector table */
    rt_hw_vector_init();

    /* initialize exceptions table */
    rt_memset(isr_table, 0x00, sizeof(isr_table));
}

/**
 * This function will mask a interrupt.
 * @param vector the interrupt number
 */
void rt_hw_interrupt_mask(int vector)
{
    HAL_GIC_Disable(vector);
}

/**
 * This function will un-mask a interrupt.
 * @param vector the interrupt number
 */
void rt_hw_interrupt_umask(int vector)
{
    HAL_GIC_Enable(vector);
}

/**
 * This function returns the active interrupt number.
 * @param none
 */
int rt_hw_interrupt_get_irq(void)
{
    return HAL_GIC_GetActiveIRQ() & GIC_ACK_INTID_MASK;
}

/**
 * This function acknowledges the interrupt.
 * @param vector the interrupt number
 */
void rt_hw_interrupt_ack(int vector)
{
    HAL_GIC_EndOfInterrupt(vector);
}

/**
 * This function config priority and route information.
 * @param priority the irq priority
 * @param route not support
 */
void rt_hw_interrupt_control(int vector, int priority, int route)
{
    HAL_GIC_SetPriority(vector, priority);
}


/**
 * This function will install a interrupt service routine to a interrupt.
 * @param vector the interrupt number
 * @param new_handler the interrupt service routine to be installed
 * @param old_handler the old interrupt service routine
 */
rt_isr_handler_t rt_hw_interrupt_install(int vector, rt_isr_handler_t handler,
        void *param, const char *name)
{
    rt_isr_handler_t old_handler = RT_NULL;

    if (vector < MAX_HANDLERS)
    {
        old_handler = isr_table[vector].handler;

        if (handler != RT_NULL)
        {
#ifdef RT_USING_INTERRUPT_INFO
            rt_strncpy(isr_table[vector].name, name, RT_NAME_MAX);
#endif /* RT_USING_INTERRUPT_INFO */
            isr_table[vector].handler = handler;
            isr_table[vector].param = param;
        }
    }

    return old_handler;
}
