/*
 * Copyright (c) 2006-2018, RT-Thread Development Team
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Change Logs:
 * Date           Author       Notes
 * 2018-12-10     Cliff      first implementation
 *
 */

#include <rthw.h>
#include <rtthread.h>

#include "board.h"
#include "drv_clock.h"
#include "drv_uart.h"
#include "drv_cache.h"
#include "hal_base.h"
#include "hal_bsp.h"
#include "iomux.h"

extern const struct clk_init clk_inits[];

#if defined(RT_USING_UART0)
const struct uart_board g_uart0_board =
{
    .baud_rate = UART_BR_1500000,
    .dev_flag = ROCKCHIP_UART_SUPPORT_FLAG_DEFAULT,
    .bufer_size = RT_SERIAL_RB_BUFSZ,
    .name = "uart0",
};
#endif /* RT_USING_UART0 */

/**
 * This function will initial Pisces board.
 */
void rt_hw_board_init()
{
    /* mpu init */
    mpu_init();

    /* HAL_Init */
    HAL_Init();

    /* hal bsp init */
    BSP_Init();

    /* Initialize cmbacktrace early to ensure that rt_assert_hook can take effect as soon as possible. */
#ifdef RT_USING_CMBACKTRACE
    rt_cm_backtrace_init();
#endif

    /* System tick init */
    rt_hw_interrupt_install(SysTick_IRQn, systick_isr, RT_NULL, "tick");
    HAL_SetTickFreq(1000 / RT_TICK_PER_SECOND);
    HAL_SYSTICK_Init();

    rt_memory_heap_init();

    /* Initial usart deriver, and set console device */
    rt_hw_usart_init();

    clk_init(clk_inits, true);

#ifdef RT_USING_CONSOLE
    rt_console_set_device(RT_CONSOLE_DEVICE_NAME);
#endif

    /* Call components board initial (use INIT_BOARD_EXPORT()) */
#ifdef RT_USING_COMPONENTS_INIT
    rt_components_board_init();
#endif
}