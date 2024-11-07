/**
  * Copyright (c) 2020 Fuzhou Rockchip Electronics Co., Ltd
  *
  * SPDX-License-Identifier: Apache-2.0
  ******************************************************************************
  * @file    mini_ftl.c
  * @version V1.0
  * @brief   spi nand special mini ftl
  *
  * Change Logs:
  * Date           Author          Notes
  * 2020-07-23     Dingqiang Lin   the first version
  *
  ******************************************************************************
  */

#include <rtthread.h>

#ifdef RT_USING_SPINAND
#include <rthw.h>
#include <rtdevice.h>
#include <drivers/mtd_nand.h>

#include "hal_base.h"
#include "mini_ftl.h"

/********************* Private MACRO Definition ******************************/
// #define FTL_DEBUG
#ifdef FTL_DEBUG
#define ftl_dbg(...)     rt_kprintf(__VA_ARGS__)
#else
#define ftl_dbg(...)
#endif

#ifndef EUCLEAN
#define EUCLEAN                         117
#endif

#define MTD_BLK_TABLE_BLOCK_UNKNOWN (-2)
#define MTD_BLK_TABLE_BLOCK_SHIFT   (-1)

/********************* Private Variable Definition **************************/
static int16_t *mtd_map_blk_table;

/********************* Private Function Definition ****************************/

static rt_uint32_t get_map_address(rt_mtd_nand_t mtd, rt_uint32_t off)
{
    rt_uint32_t offset = off;
    rt_uint32_t erasesize_shift = __rt_ffs(mtd->page_size * mtd->pages_per_block) - 1;
    size_t block_offset = offset & (mtd->page_size * mtd->pages_per_block - 1);

    RT_ASSERT(mtd_map_blk_table &&
              mtd_map_blk_table[(uint64_t)offset >> erasesize_shift] != MTD_BLK_TABLE_BLOCK_UNKNOWN &&
              mtd_map_blk_table[(uint64_t)offset >> erasesize_shift] != 0xffff);

    return (rt_uint32_t)(((uint32_t)mtd_map_blk_table[(uint64_t)offset >> erasesize_shift] <<
                          erasesize_shift) + block_offset);
}

static __attribute__((unused)) void flash_erase_all_block(rt_mtd_nand_t mtd)
{
    uint32_t blk;

    for (blk = 0; blk < mtd->block_end; blk++)
    {
        rt_kprintf("erase blk %d\n", blk);
        rt_mtd_nand_erase_block(mtd, blk);
    }

}

/********************* Public Function Definition ****************************/
/**
 * @brief SPI Nand establish a partition based bad block table.
 * @param mtd: mtd info.
 * @param start: start address in byte.
 * @param size: size address in byte.
 * @retval rt_err_t.
 */
rt_err_t mini_ftl_map_table_init(rt_mtd_nand_t mtd, rt_uint32_t start, rt_uint32_t size)
{
    rt_uint32_t blk_total = mtd->block_total, blk_cnt, bad_blk = 0;
    rt_uint32_t block_start, block_end, block_size;
    int i, j;

    if (!mtd)
    {
        return -RT_ERROR;
    }
    else
    {
        block_size = mtd->pages_per_block * mtd->page_size;
        block_start = start / block_size;
        block_end = size == 0xFFFFFFFF ? blk_total : block_start + (size + block_size - 1) / block_size;
        ftl_dbg("map table [%d,%d]\n", block_start, block_end);

        if (!mtd_map_blk_table)
        {
            mtd_map_blk_table = (int16_t *)rt_malloc(blk_total * sizeof(int16_t));
            for (i = 0; i < blk_total; i++)
                mtd_map_blk_table[i] = MTD_BLK_TABLE_BLOCK_UNKNOWN;
        }

        blk_cnt = block_end - block_start;

        if (block_start >= blk_total)
        {
            rt_kprintf("map table blk begin[%d] overflow\n", block_start);
            return -RT_EINVAL;
        }
        if (block_end > blk_total)
            blk_cnt = blk_total - block_start;

        if (mtd_map_blk_table[block_start] != MTD_BLK_TABLE_BLOCK_UNKNOWN)
            return 0;

        j = 0;
        /* should not across blk_cnt */

        for (i = 0; i < blk_cnt; i++)
        {
            if (j >= blk_cnt)
                mtd_map_blk_table[block_start + i] = MTD_BLK_TABLE_BLOCK_SHIFT;
            for (; j < blk_cnt; j++)
            {
                if (!rt_mtd_nand_check_block(mtd, (block_start + j)))
                {
                    ftl_dbg("Good blk:%d\n", block_start + j);
                    mtd_map_blk_table[block_start + i] = block_start + j;
                    j++;
                    if (j == blk_cnt)
                        j++;
                    break;
                }
                else
                {
                    rt_kprintf("Bad blk:%d\n", block_start + j);
                    bad_blk++;
                }
            }
        }

        return bad_blk;
    }
}

/**
 * @brief SPI Nand mini ftl page read.
 * @param mtd: mtd info.
 * @param data: data buffer.
 * @param from: source data address in byte.
 * @param length: data length in byte.
 * @retval -RT_EIO: hardware or devices error;
 *         -RT_ERROR: ECC fail;
 *         RT_EOK.
 */
rt_err_t mini_ftl_read(rt_mtd_nand_t mtd, rt_uint8_t *data, rt_uint32_t from, rt_uint32_t length)
{
    int32_t ret = RT_EOK;
    bool ecc_failed = false;
    rt_uint32_t readl_addr;

    if (from % mtd->page_size || length % mtd->page_size)
    {
        return -RT_EINVAL;
    }

    while (length)
    {
        readl_addr = get_map_address(mtd, from) >> (__rt_ffs(mtd->page_size) - 1);
        ret = rt_mtd_nand_read(mtd, readl_addr, data, mtd->page_size, NULL, 0);
        if (ret < 0)
            break;

        ret = 0;
        data += mtd->page_size;
        length -= mtd->page_size;
        from += mtd->page_size;
    }
    if (ret)
        return -RT_EIO;

    if (ecc_failed)
        return -RT_ERROR;

    return RT_EOK;
}

/**
 * @brief SPI Nand mini ftl page write.
 * @param mtd: mtd info.
 * @param data: data buffer.
 * @param to: target data address in byte.
 * @param length: data length in byte.
 * @retval -RT_EIO: hardware or devices error;
 *         -RT_ERROR: ECC fail;
 *         RT_EOK.
 */
rt_err_t mini_ftl_write(rt_mtd_nand_t mtd, const rt_uint8_t *data, rt_uint32_t to, rt_uint32_t length)
{
    int32_t ret = RT_EOK;
    rt_uint32_t readl_addr;

    if (to % mtd->page_size || length % mtd->page_size)
    {
        return -RT_EINVAL;
    }

    while (length)
    {
        readl_addr = get_map_address(mtd, to) >> (__rt_ffs(mtd->page_size) - 1);
        ret = rt_mtd_nand_write(mtd, readl_addr, data, mtd->page_size, NULL, 0);
        if (ret != 0)
        {
            ftl_dbg("%s addr %lx ret= %d\n", __func__, to, ret);
            break;
        }

        data += mtd->page_size;
        length -= mtd->page_size;
        to += mtd->page_size;
    }

    if (ret)
        return -RT_EIO;

    return 0;
}

/**
 * @brief SPI Nand mini ftl block erase.
 * @param mtd: mtd info.
 * @param addr: target data address in byte.
 * @param len: data length in byte.
 * @retval -RT_EIO: hardware or devices error;
 *         -RT_ERROR: ECC fail;
 *         RT_EOK.
 */
rt_err_t mini_ftl_erase(rt_mtd_nand_t mtd, rt_uint32_t addr, size_t len)
{
    int32_t ret = RT_EOK;
    size_t length;
    rt_uint32_t block_size = mtd->page_size * mtd->pages_per_block;
    rt_uint32_t readl_addr;

    length = len;

    if (length % block_size || addr % block_size)
    {
        ret = -RT_EINVAL;
        goto out;
    }

    while (length)
    {
        readl_addr = get_map_address(mtd, addr) >> (__rt_ffs(mtd->page_size * mtd->pages_per_block) - 1);
        ret = rt_mtd_nand_erase_block(mtd, readl_addr);
        if (ret)
        {
            rt_kprintf("%s fail addr 0x%lx ret=%d\n",
                       __func__, addr, ret);

            ret = -RT_EIO;
            goto out;
        }

        addr += block_size;
        length -= block_size;
    }

out:

    return ret;
}

#endif