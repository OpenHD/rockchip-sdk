/*
 * Copyright (c) 2021 Rockchip Electronics Co., Ltd.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Change Logs:
 * Date           Author       Notes
 * 2021-04-12     Steven Liu   first implementation
 */

#ifndef _HAL_CONF_H_
#define _HAL_CONF_H_

#include "rtconfig.h"

/* HAL CPU config */
#define SOC_RK3568
#define HAL_AP_CORE
#define SYS_TIMER TIMER5 /* System timer designation (RK TIMER) */

/* RT-Thread Tick Timer */
#define TICK_TIMER TIMER4
#define TICK_IRQn  TIMER4_IRQn

#define HAL_CACHE_ECC_MODULE_ENABLED
#define HAL_CPU_TOPOLOGY_MODULE_ENABLED

#ifdef RT_USING_CRU
#define HAL_CRU_MODULE_ENABLED
#endif

#define HAL_GIC_MODULE_ENABLED

#ifdef HAL_GIC_MODULE_ENABLED
#define HAL_GIC_AMP_FEATURE_ENABLED
#endif

#ifdef RT_USING_GMAC
#define HAL_GMAC_MODULE_ENABLED
#endif

#ifdef RT_USING_PIN
#define HAL_GPIO_MODULE_ENABLED
#define HAL_PINCTRL_MODULE_ENABLED
#endif

#define HAL_TIMER_MODULE_ENABLED

#ifdef RT_USING_UART
#define HAL_UART_MODULE_ENABLED
#endif

#ifdef RT_USING_CAN
#define HAL_CANFD_MODULE_ENABLED
#endif

#endif
