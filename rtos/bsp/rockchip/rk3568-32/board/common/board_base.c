/*
 * Copyright (c) 2021 Rockchip Electronics Co., Ltd.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Change Logs:
 * Date           Author       Notes
 * 2021-04-12     Steven Liu   first implementation
 */

#include <rthw.h>
#include <rtthread.h>

#include "board.h"
#include "cp15.h"
#include "mmu.h"
#include "hal_base.h"
#include "hal_bsp.h"
#include "drv_heap.h"

struct mem_desc platform_mem_desc[] =
{
#ifdef RT_USING_UNCACHE_HEAP
    {RT_RUN_MEM_BASE, RT_RUN_UNCACHE_MEM_BASE - 1, RT_RUN_MEM_BASE, NORMAL_MEM}, /* CACHED */
    {RT_RUN_UNCACHE_MEM_BASE, RT_RUN_MEM_BASE + RT_RUN_MEM_SIZE - 1, RT_RUN_UNCACHE_MEM_BASE, UNCACHED_MEM}, /* UNCACHED */
#else
    {RT_RUN_MEM_BASE, RT_RUN_MEM_BASE + RT_RUN_MEM_SIZE - 1, RT_RUN_MEM_BASE, NORMAL_MEM},
#endif
    {0xFC000000, 0xFE8B0000 - 1, 0xFC000000, DEVICE_MEM} /* DEVICE */
};

const rt_uint32_t platform_mem_desc_size = sizeof(platform_mem_desc) / sizeof(platform_mem_desc[0]);

#ifdef RT_USING_PIN
#include "iomux.h"
#endif

#ifdef RT_USING_UART
#include "drv_uart.h"
#endif

#if defined(RT_USING_UART2)
RT_WEAK const struct uart_board g_uart2_board =
{
    .baud_rate = UART_BR_1500000,
    .dev_flag = ROCKCHIP_UART_SUPPORT_FLAG_DEFAULT,
    .bufer_size = RT_SERIAL_RB_BUFSZ,
    .name = "uart2",
};
#endif /* RT_USING_UART2 */

#if defined(RT_USING_UART4)
RT_WEAK const struct uart_board g_uart4_board =
{
    .baud_rate = UART_BR_1500000,
    .dev_flag = ROCKCHIP_UART_SUPPORT_FLAG_DEFAULT,
    .bufer_size = RT_SERIAL_RB_BUFSZ,
    .name = "uart4",
};
#endif /* RT_USING_UART4 */

extern void SysTick_Handler(void);
RT_WEAK void tick_isr(int vector, void *param)
{
    /* enter interrupt */
    rt_interrupt_enter();

    HAL_IncTick();
    rt_tick_increase();
    HAL_TIMER_ClrInt(TICK_TIMER);

    /* leave interrupt */
    rt_interrupt_leave();
}

void idle_wfi(void)
{
    asm volatile("wfi");
}

static struct GIC_AMP_IRQ_INIT_CFG irqsConfig[] =
{
    GIC_AMP_IRQ_CFG(0, 0),
};

static struct GIC_IRQ_AMP_CTRL irqConfig =
{
    .cpuAff = CPU_GET_AFFINITY(0, 0),
    .defPrio = 0xd0,
    .defRouteAff = CPU_GET_AFFINITY(0, 0),
    .irqsCfg = &irqsConfig[0],
};

/**
 *  Initialize the Hardware related stuffs. Called from rtthread_startup()
 *  after interrupt disabled.
 */
void rt_hw_board_init(void)
{
    /* HAL_Init */
    HAL_Init();

    /* hal bsp init */
    BSP_Init();
    HAL_GIC_Init(&irqConfig);
    /* initialize hardware interrupt */
    rt_hw_interrupt_init();

    /* tick init */
    HAL_SetTickFreq(1000 / RT_TICK_PER_SECOND);
    rt_hw_interrupt_install(TICK_IRQn, tick_isr, RT_NULL, "tick");
    rt_hw_interrupt_umask(TICK_IRQn);

    HAL_TIMER_Init(TICK_TIMER, TIMER_FREE_RUNNING);
    HAL_TIMER_SetCount(TICK_TIMER, (PLL_INPUT_OSC_RATE / RT_TICK_PER_SECOND) - 1);
    HAL_TIMER_Start_IT(TICK_TIMER);

    /* initialize uart */
#ifdef RT_USING_UART
    rt_hw_usart_init();
#endif

#ifdef RT_USING_CONSOLE
    rt_console_set_device(RT_CONSOLE_DEVICE_NAME);
#endif

#ifdef RT_USING_PIN
    rt_hw_iomux_config();
#endif

#ifdef RT_USING_HEAP
    /* initialize memory system */
    rt_system_heap_init(RT_HW_HEAP_BEGIN, RT_HW_HEAP_END);
#endif

#ifdef RT_USING_UNCACHE_HEAP
#if (RT_RUN_UNCACHE_MEM_BASE % 0x1000 || RT_UNCACHE_HEAP_SIZE % 0x1000)
#error "Uncache heap base and size should be at least 4K align!";
#endif
    rt_uncache_heap_init((void *)RT_RUN_UNCACHE_MEM_BASE, (void *)(RT_RUN_MEM_BASE + RT_RUN_MEM_SIZE));
#endif

    rt_thread_idle_sethook(idle_wfi);

#ifdef RT_USING_COMPONENTS_INIT
    rt_components_board_init();
#endif
}

