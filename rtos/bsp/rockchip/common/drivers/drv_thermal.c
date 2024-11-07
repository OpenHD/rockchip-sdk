/**
  * Copyright (c) 2024 Fuzhou Rockchip Electronics Co., Ltd
  *
  * SPDX-License-Identifier: Apache-2.0
  ******************************************************************************
  * @file    drv_thermal.c
  * @version V0.1
  * @brief   thermal interface
  *
  * Change Logs:
  * Date           Author          Notes
  * 2024-03-11     Ye.Zhang        first implementation
  *
  ******************************************************************************
  */

#include <rthw.h>
#include <rtthread.h>

#if defined(RT_USING_TSADC)

#include "hal_base.h"
#include "drv_thermal.h"

static bool is_init = false;
extern const struct tsadc_init g_tsadc_init;

void tsadc_dev_init(const struct tsadc_init *p_tsadc_init)
{
    is_init = true;
    for (int i = 0; i < p_tsadc_init->chn_num; i++)
    {
        HAL_TSADC_Enable_AUTO(p_tsadc_init->chn_id[i], p_tsadc_init->polarity, p_tsadc_init->mode);
    }
    rt_kprintf("tsadc init\n");
}

int tsadc_get_temp(int chn)
{
    return HAL_TSADC_GetTemperature_AUTO(chn);
}

int tsadc_default_init(void)
{
    if (!is_init)
    {
        for (int i = 0; i < g_tsadc_init.chn_num; i++)
        {
            HAL_TSADC_Enable_AUTO(g_tsadc_init.chn_id[i], g_tsadc_init.polarity, g_tsadc_init.mode);
        }
        rt_kprintf("tsadc default init\n");
    }

    return RT_EOK;
}

void get_temp(int argc, char **argv)
{
    int chn = 0;

    if (1 == argc)
    {
        for (int i = 0; i < g_tsadc_init.chn_num; i++)
        {
            rt_kprintf("channel %d: %d\n", i, tsadc_get_temp(g_tsadc_init.chn_id[i]));
        }
    }
    else
    {
        chn = atoi(argv[1]);
        rt_kprintf("channel %d: %d\n", chn, tsadc_get_temp(chn));
    }
}
#ifdef RT_USING_FINSH
#include <finsh.h>
MSH_CMD_EXPORT(get_temp, get current temp.e.g: get_temp <channel>);
#endif

INIT_BOARD_EXPORT(tsadc_default_init);
#endif
