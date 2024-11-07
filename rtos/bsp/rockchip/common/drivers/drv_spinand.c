/**
  * Copyright (c) 2020-2023 Rockchip Electronics Co., Ltd
  *
  * SPDX-License-Identifier: Apache-2.0
  ******************************************************************************
  * @file    drv_spinand.c
  * @version V2.0
  * @brief   spi nand interface
  *
  * Change Logs:
  * Date           Author          Notes
  * 2020-06-16     Dingqiang Lin   the first version
  * 2023-11-06     Dingqiang Lin   Support Dhara
  *
  ******************************************************************************
  */

/** @addtogroup RKBSP_Driver_Reference
 *  @{
 */

/** @addtogroup SPINAND
 *  @{
 */

/** @defgroup SPINAND_How_To_Use How To Use
 *  @{

    SPI_NAND is a framework protocol layer based on SPI Nand flash. It needs to be combined
 with the corresponding driver layer to complete the transmission of the protocol.

 @} */

#include <rtthread.h>

#ifdef RT_USING_SPINAND
#include <rthw.h>
#include <rtdevice.h>
#include <drivers/mtd_nand.h>
#include <dfs_fs.h>

#include "board.h"
#include "hal_bsp.h"
#include "drv_clock.h"
#include "drv_fspi.h"
#include "hal_base.h"
#include "mini_ftl.h"
#include "drv_flash_partition.h"

#ifdef RT_USING_DHARA
#include "map.h"
#endif


/********************* Private MACRO Definition ******************************/
/** @defgroup SPINAND_Private_Macro Private Macro
 *  @{
 */
// #define SPINAND_DEBUG
#ifdef SPINAND_DEBUG
#define spinand_dbg(...)     rt_kprintf(__VA_ARGS__)
#else
#define spinand_dbg(...)
#endif

// #define DHARA_DEBUG
#ifdef DHARA_DEBUG
#define dhara_dbg(...)       rt_kprintf(__VA_ARGS__)
#define dhara_abort(...)     abort(__VA_ARGS__)
#else
#define dhara_dbg(...)
#define dhara_abort(...)
#endif

// #define DHARA_RANDOM_TEST

#define MTD_TO_SPINAND(mtd) ((struct SPI_NAND *)(mtd->priv))

/** @} */  // SPINAND_Private_Macro

/********************* Private Structure Definition **************************/
/** @defgroup SPINAND_Private_Structure Private Structure
 *  @{
 */

#define DHARA_DEFAULT_OFFSET (0x2000000) /* 32MB */
#define RK_PARTITION_MAX_PARTITION 16
#define RK_SPINAND_RESERVED_BBT_BLOCKS 4 /* 4 blks for bad block table extention */

static struct rt_mutex spinand_lock;

rt_err_t spinand_read(rt_mtd_nand_t mtd, rt_off_t page,
                      rt_uint8_t *data, rt_uint32_t data_len,
                      rt_uint8_t *spare, rt_uint32_t spare_len)
{
    struct SPI_NAND *spinand = MTD_TO_SPINAND(mtd);
    int ret;

    if (spare || spare_len)
    {
        rt_kprintf("%s oob is not supported\n", __func__);
        return -RT_EINVAL;
    }

    if (!data || data_len != mtd->page_size)
    {
        rt_kprintf("%s data param input invalid, %p %d\n", __func__, data, data_len);
        return -RT_EINVAL;
    }

    spinand_dbg("%s addr= %lx len= %x\n", __func__, (uint32_t)page, data_len);
    rt_mutex_take(&spinand_lock, RT_WAITING_FOREVER);
    ret = HAL_SPINAND_ReadPageRaw(spinand, page, data, false);
    if (ret < 0)
        return 0;

    if (ret == SPINAND_ECC_ERROR)
    {
        rt_kprintf("%s addr %lx ret= %d\n", __func__, page, ret);
        ret = -RT_ERROR;
    }
    rt_mutex_release(&spinand_lock);

    return ret;
}

rt_err_t spinand_write(rt_mtd_nand_t mtd, rt_off_t page,
                       const rt_uint8_t *data, rt_uint32_t data_len,
                       const rt_uint8_t *spare, rt_uint32_t spare_len)
{
    struct SPI_NAND *spinand = MTD_TO_SPINAND(mtd);
    int ret;

    if (spare && spare_len)
    {
        rt_kprintf("%s oob is not supported\n", __func__);
        return -RT_EINVAL;
    }

    if (!data || data_len != mtd->page_size)
    {
        rt_kprintf("%s data param input invalid, %p %d\n", __func__, data, data_len);
        return -RT_EINVAL;
    }

    spinand_dbg("%s addr= %lx len= %x\n", __func__, (uint32_t)page, data_len);
    rt_mutex_take(&spinand_lock, RT_WAITING_FOREVER);
    ret = HAL_SPINAND_ProgPageRaw(spinand, page, (uint32_t *)data, false);
    rt_mutex_release(&spinand_lock);

    return ret;
}

rt_err_t spinand_erase(rt_mtd_nand_t mtd, rt_uint32_t block)
{
    struct SPI_NAND *spinand = MTD_TO_SPINAND(mtd);
    int ret;

    spinand_dbg("%s addr= %lx\n", __func__, block);
    rt_mutex_take(&spinand_lock, RT_WAITING_FOREVER);
    ret = HAL_SPINAND_EraseBlock(spinand, block * mtd->pages_per_block);
    rt_mutex_release(&spinand_lock);

    return ret;
}

rt_err_t spinand_isbad(rt_mtd_nand_t mtd, rt_uint32_t block)
{
    struct SPI_NAND *spinand = MTD_TO_SPINAND(mtd);
    int32_t ret = RT_EOK;

    rt_mutex_take(&spinand_lock, RT_WAITING_FOREVER);
    ret = HAL_SPINAND_IsBad(spinand, block * spinand->pagePerBlk);
    rt_mutex_release(&spinand_lock);

    spinand_dbg("%s blk= %lx %d\n", __func__, block, ret);

    return ret;
}

rt_err_t spinand_markbad(rt_mtd_nand_t mtd, rt_uint32_t block)
{
    struct SPI_NAND *spinand = MTD_TO_SPINAND(mtd);
    int32_t ret = RT_EOK;

    spinand_dbg("%s blk= %lx\n", __func__, block);
    rt_mutex_take(&spinand_lock, RT_WAITING_FOREVER);
    ret = HAL_SPINAND_MarkBad(spinand, block * spinand->pagePerBlk);
    rt_mutex_release(&spinand_lock);

    return ret;
}

static const struct rt_mtd_nand_driver_ops ops =
{
    NULL,
    spinand_read,
    spinand_write,
    NULL,
    spinand_erase,
    spinand_isbad,
    spinand_markbad,
};

#if defined(RT_USING_SPINAND_FSPI_HOST)
static HAL_Status fspi_xfer(struct SPI_NAND_HOST *spi, struct HAL_SPI_MEM_OP *op)
{
    struct rt_fspi_device *fspi_device = (struct rt_fspi_device *)spi->userdata;

    return rt_fspi_xfer(fspi_device, op);
}

static int rockchip_sfc_delay_lines_tuning(struct SPI_NAND *spinand, struct rt_fspi_device *fspi_device)
{
    uint8_t id_temp[SPINAND_MAX_ID_LEN];
    uint16_t cell_max = (uint16_t)rt_fspi_get_max_dll_cells(fspi_device);
    uint16_t right, left = 0;
    uint16_t step = HAL_FSPI_DLL_TRANING_STEP;
    bool dll_valid = false;
    uint32_t final;

    HAL_SPINAND_Init(spinand);
    for (right = 0; right <= cell_max; right += step)
    {
        int ret;

        ret = rt_fspi_set_delay_lines(fspi_device, right);
        if (ret)
        {
            dll_valid = false;
            break;
        }
        ret = HAL_SPINAND_ReadID(spinand, id_temp);
        if (ret)
        {
            dll_valid = false;
            break;
        }

        spinand_dbg("dll read flash id:%x %x %x\n",
                    id_temp[0], id_temp[1], id_temp[2]);

        ret = HAL_SPINAND_IsFlashSupported(id_temp);
        if (dll_valid && !ret)
        {
            right -= step;

            break;
        }
        if (!dll_valid && ret)
            left = right;

        if (ret)
            dll_valid = true;

        /* Add cell_max to loop */
        if (right == cell_max)
            break;
        if (right + step > cell_max)
            right = cell_max - step;
    }

    if (dll_valid && (right - left) >= HAL_FSPI_DLL_TRANING_VALID_WINDOW)
    {
        if (left == 0 && right < cell_max)
            final = left + (right - left) * 2 / 5;
        else
            final = left + (right - left) / 2;
    }
    else
    {
        final = 0;
    }

    if (final)
    {
        spinand_dbg("spinand %d %d %d dll training success in %dMHz max_cells=%u\n",
                    left, right, final, spinand->spi->speed, cell_max);
        return rt_fspi_set_delay_lines(fspi_device, final);
    }
    else
    {
        rt_kprintf("spinand %d %d dll training failed in %dMHz, reduce the frequency\n",
                   left, right, spinand->spi->speed);
        rt_fspi_dll_disable(fspi_device);
        return -1;
    }
}

RT_WEAK struct rt_fspi_device g_fspi_spinand =
{
#ifdef RT_USING_SPINAND_FSPI_CS1
    .host_id = 0,
    .dev_type = DEV_SPINAND,
    .chip_select = 1,
#else
#ifdef CONFIG_RT_USING_SNOR
    .host_id = 1,
#else
    .host_id = 0,
#endif
    .dev_type = DEV_SPINAND,
    .chip_select = 0,
#endif
};

static uint32_t spinand_adapt(struct SPI_NAND *spinand)
{
    struct rt_fspi_device *fspi_device = &g_fspi_spinand;
    uint32_t ret;
    int dll_result = 0;

    spinand_dbg("spinand_adapt in\n");
    ret = rt_hw_fspi_device_register(fspi_device);
    if (ret)
    {
        return ret;
    }

    /* Designated host to SPI_NAND */
    if (RT_SPINAND_SPEED > 0 && RT_SPINAND_SPEED <= SPINAND_SPEED_MAX)
    {
        spinand->spi->speed = RT_SPINAND_SPEED;
    }
    else
    {
        spinand->spi->speed = SPINAND_SPEED_DEFAULT;
    }
    spinand->spi->speed = rt_fspi_set_speed(fspi_device, spinand->spi->speed);

#ifdef RT_USING_SPINAND_FSPI_HOST_CS1_GPIO
    if (!fspi_device->cs_gpio.gpio)
    {
        rt_kprintf("it's needed to redefine g_fspi_spinand with cs_gpio in iomux.c!\n");
        return -RT_ERROR;
    }
#endif

    spinand->spi->userdata = (void *)fspi_device;
    spinand->spi->mode = HAL_SPI_MODE_3 | HAL_SPI_RX_QUAD;
    spinand->spi->xfer = fspi_xfer;
    spinand_dbg("%s fspi initial\n", __func__);
    rt_fspi_controller_init(fspi_device);

    if (spinand->spi->speed > HAL_FSPI_SPEED_THRESHOLD)
    {
        dll_result = rockchip_sfc_delay_lines_tuning(spinand, fspi_device);
    }
    else
    {
        rt_fspi_dll_disable(fspi_device);
    }

    /* Init SPI_NAND abstract */
    spinand_dbg("%s spinand initial\n", __func__);
    ret = HAL_SPINAND_Init(spinand);
    if (ret)
    {
        uint8_t idByte[5];

        HAL_SPINAND_ReadID(spinand, idByte);
        rt_kprintf("SPI Nand ID: %x %x %x\n", idByte[0], idByte[1], idByte[2]);
    }

    if (dll_result)
    {
        rt_fspi_set_speed(fspi_device, HAL_FSPI_SPEED_THRESHOLD);
        rt_kprintf("%s dll turning failed %d\n", __func__, dll_result);
    }

    return ret;
}
#elif defined(RT_USING_SPINAND_SFC_HOST)
static uint32_t spinand_adapt(struct SPI_NAND *spinand)
{
    struct HAL_SFC_HOST *host = (struct HAL_SFC_HOST *)rt_calloc(1, sizeof(*host));

    RT_ASSERT(host);

    /* Designated host to SPINAND */
    host->instance = SFC;
    HAL_SFC_Init(host);
    spinand->spi->userdata = (void *)host;
    spinand->spi->mode = HAL_SPI_MODE_3;
    spinand->spi->mode |= (HAL_SPI_TX_QUAD | HAL_SPI_RX_QUAD);
    spinand->spi->xfer = HAL_SFC_SPINandSpiXfer;

    /* Init SPI Nand abstract */
    if (HAL_SPINAND_Init(spinand))
    {
        rt_free(host);
        return -RT_ERROR;
    }
    else
    {
        return RT_EOK;
    }
}
#elif defined(RT_USING_SPINAND_SPI_HOST)
static HAL_Status SPI_Xfer(struct SPI_NAND_HOST *spi, struct HAL_SPI_MEM_OP *op)
{
    struct rt_spi_device *spi_device = (struct rt_spi_device *)spi->userdata;
    struct rt_spi_configuration cfg;
    uint32_t pos = 0;
    const uint8_t *tx_buf = NULL;
    uint8_t *rx_buf = NULL;
    uint8_t op_buf[HAL_SPI_OP_LEN_MAX];
    int32_t op_len;
    int32_t i, ret;

    if (op->data.nbytes)
    {
        if (op->data.dir == HAL_SPI_MEM_DATA_IN)
            rx_buf = op->data.buf.in;
        else
            tx_buf = op->data.buf.out;
    }

//    rt_kprintf("%s %x %lx\n", __func__, op->cmd.opcode, op->data.nbytes);
    op_len = sizeof(op->cmd.opcode) + op->addr.nbytes + op->dummy.nbytes;
    op_buf[pos++] = op->cmd.opcode;

    if (op->addr.nbytes)
    {
        for (i = 0; i < op->addr.nbytes; i++)
            op_buf[pos + i] = op->addr.val >> (8 * (op->addr.nbytes - i - 1));
        pos += op->addr.nbytes;
    }

    if (op->dummy.nbytes)
        memset(&op_buf[pos], 0xff, op->dummy.nbytes);

    cfg.data_width = 8;
    cfg.mode = spi->mode | RT_SPI_MSB;
    cfg.max_hz = spi->speed;
    rt_spi_configure(spi_device, &cfg);

    if (tx_buf)
    {
        ret = rt_spi_send_then_send(spi_device, op_buf, op_len, tx_buf, op->data.nbytes);
        if (ret)
            ret = HAL_ERROR;
    }
    else if (rx_buf)
    {
        ret = rt_spi_send_then_recv(spi_device, op_buf, op_len, rx_buf, op->data.nbytes);
        if (ret)
            ret = HAL_ERROR;
    }
    else
    {
        ret = rt_spi_send(spi_device, op_buf, op_len);
        if (ret != op_len)
            ret = HAL_ERROR;
        else
            ret = HAL_OK;
    }

//    rt_kprintf("%s finished %d\n", __func__, ret);

    return ret;
}

static uint32_t spinand_adapt(struct SPI_NAND *spinand)
{
    struct rt_spi_device *spi_device = NULL;

#if defined(RT_SPINAND_SPI_DEVICE_NAME)
    spi_device = (struct rt_spi_device *)rt_device_find(RT_SPINAND_SPI_DEVICE_NAME);
#endif
    if (!spi_device)
    {
        rt_kprintf("%s can not find %s\n", __func__, RT_SPINAND_SPI_DEVICE_NAME);

        return RT_EINVAL;
    }

    /* Designated host to SPI Nand */
    spinand->spi->userdata = (void *)spi_device;
    spinand->spi->mode = HAL_SPI_MODE_3;
    spinand->spi->xfer = SPI_Xfer;
    if (RT_SPINAND_SPEED > 0 && RT_SPINAND_SPEED <= HAL_SPI_MASTER_MAX_SCLK_OUT)
    {
        spinand->spi->speed = RT_SPINAND_SPEED;
    }
    else
    {
        spinand->spi->speed = HAL_SPI_MASTER_MAX_SCLK_OUT;
    }

    /* Init SPI Nand abstract */
    return HAL_SPINAND_Init(spinand);
}
#else
static uint32_t spinand_adapt(struct SPI_NAND *spinandF)
{
    return RT_EINVAL;
}
#endif

/** @} */  // SPINAND_Private_Function

/********************* Public Function Definition ****************************/

/** @defgroup SPINAND_Public_Functions Public Functions
 *  @{
 */

#ifdef RT_USING_DHARA
static int p_count;
static int e_count;
static int r_count;

int dhara_nand_is_bad(const struct dhara_nand *n, dhara_block_t bno)
{
    struct SPI_NAND *spinand = (struct SPI_NAND *)n->priv_data;
    int ret;

    if (bno >= n->num_blocks)
    {
        rt_kprintf("NAND_is_bad called on invalid block: %ld\n", bno);
    }

    if (n->blocks[bno].bbm == NAND_BBT_BLOCK_STATUS_UNKNOWN)
    {
        ret = HAL_SPINAND_IsBad(spinand, (bno + n->start_blocks) * spinand->pagePerBlk);
        dhara_dbg("NAND_is_bad blk=0x%x ret=%d\n", bno + n->start_blocks, ret);
        if (ret)
        {
            dhara_dbg("NAND_is_bad blk 0x%x is bad block, ret=%d\n", bno, ret);
            n->blocks[bno].bbm = NAND_BBT_BLOCK_WORN;
        }
        else
        {
            n->blocks[bno].bbm = NAND_BBT_BLOCK_GOOD;
        }
    }

    return n->blocks[bno].bbm == NAND_BBT_BLOCK_GOOD ? false : true;
}

void dhara_nand_mark_bad(const struct dhara_nand *n, dhara_block_t bno)
{
    struct SPI_NAND *spinand = (struct SPI_NAND *)n->priv_data;
    int ret;

    if (bno >= n->num_blocks)
    {
        rt_kprintf("NAND_mark_bad called on invalid block: %ld\n", bno);
    }

    n->blocks[bno].bbm = NAND_BBT_BLOCK_WORN;

    ret = HAL_SPINAND_MarkBad(spinand, bno + n->start_blocks);
    dhara_dbg("NAND_mark_bad blk=0x%x, ret=%d\n", bno + n->start_blocks, ret);
    if (ret)
    {
        rt_kprintf("NAND_mark_bad blk 0x%x failed, ret=%d\n", bno, ret);
    }
}

int dhara_nand_erase(const struct dhara_nand *n, dhara_block_t bno, dhara_error_t *err)
{
    struct SPI_NAND *spinand = (struct SPI_NAND *)n->priv_data;
    int ret;

    if (bno >= n->num_blocks)
    {
        rt_kprintf("NAND_erase called on invalid block: %ld\n", bno);
        dhara_abort();

        return -RT_EINVAL;
    }

    if (n->blocks[bno].bbm == NAND_BBT_BLOCK_WORN)
    {
        rt_kprintf("NAND_erase called on block which is marked bad: %ld\n", bno);
        dhara_abort();

        return -RT_EINVAL;
    }

    n->blocks[bno].next_page = 0;

    ret = HAL_SPINAND_EraseBlock(spinand, (bno + n->start_blocks) << n->log2_ppb);
    dhara_dbg("NAND_erase blk=0x%x, ret=%d\n", bno + n->start_blocks, ret);
    if (ret)
    {
        rt_kprintf("NAND_erase blk 0x%x failed, ret=%d\n", bno, ret);
    }
    e_count++;

    return ret;
}

int dhara_nand_prog(const struct dhara_nand *n, dhara_page_t p,
                    const uint8_t *data, dhara_error_t *err)
{
    struct SPI_NAND *spinand = (struct SPI_NAND *)n->priv_data;
    const int bno = p >> n->log2_ppb;
    const uint16_t pno = p & ((n->page_per_block) - 1);
    uint32_t meta[SPINAND_META_WORDS_MAX] = { DHARA_NAND_META_MAGIC, 0, 0, 0 };
    int ret;

    if ((bno < 0) || (bno >= n->num_blocks))
    {
        rt_kprintf("NAND_prog called on invalid block: %ld\n", bno);
        dhara_abort();

        return -RT_EINVAL;
    }

    if (n->blocks[bno].bbm == NAND_BBT_BLOCK_WORN)
    {
        rt_kprintf("NAND_prog called on block which is marked bad: %d\n", bno);
        dhara_abort();

        return -RT_EINVAL;
    }

    if (pno < n->blocks[bno].next_page)
    {
        rt_kprintf("NAND_prog out-of-order page programming. Block %d, page %d (expected %d)\n",
                   bno, pno, n->blocks[bno].next_page);
        dhara_abort();

        return -RT_EINVAL;
    }

    n->blocks[bno].next_page = pno + 1;

    ret = HAL_SPINAND_ProgPage(spinand, p + n->start_blocks * n->page_per_block, data, meta);
    dhara_dbg("NAND_prog page=0x%x, ret=%d\n", p + n->start_blocks * n->page_per_block, ret);
    if (ret != HAL_OK)
    {
        rt_kprintf("NAND_prog page 0x%x failed, ret=%d\n", p, ret);
        dhara_set_error(err, DHARA_E_BAD_BLOCK);
    }
    p_count++;

    return ret;
}

int dhara_nand_is_free(const struct dhara_nand *n, dhara_page_t p)
{
    struct SPI_NAND *spinand = (struct SPI_NAND *)n->priv_data;
    const int bno = p >> n->log2_ppb;
    const uint16_t pno = p & ((n->page_per_block) - 1);
    int ret, i;

    if ((bno < 0) || (bno >= n->num_blocks))
    {
        rt_kprintf("NAND_is_free called on invalid block: %d\n", bno);
        dhara_abort();

        return -RT_EINVAL;
    }

    if (n->blocks[bno].next_page == 0)
    {
        ret = HAL_SPINAND_ReadPageAnyWhere(spinand, p + n->start_blocks * n->page_per_block, n->copy_buf, 0, n->page_size);
        if (ret)
        {
            return false;
        }
        dhara_dbg("NAND_is_free page=0x%x, ret=%d\n", p + n->start_blocks * n->page_per_block, ret);
        for (i = 0; i < n->page_size / 4; i++)
        {
            if (((uint32_t *)n->copy_buf)[i] != 0xFFFFFFFF)
            {
                return false;
            }
        }
        return true;
    }

    return (int)(n->blocks[bno].next_page <= pno);
}

int dhara_nand_read(const struct dhara_nand *n, dhara_page_t p,
                    size_t offset, size_t length,
                    uint8_t *data, dhara_error_t *err)
{
    struct SPI_NAND *spinand = (struct SPI_NAND *)n->priv_data;
    const int bno = p >> n->log2_ppb;
    int ret;

    if ((bno < 0) || (bno >= n->num_blocks))
    {
        rt_kprintf("NAND_read called on invalid block: %d\n", bno);
        dhara_abort();

        return -RT_EINVAL;
    }

    if (offset + length > n->page_size)
    {
        rt_kprintf("NAND_read called on invalid range: offset = %ld, length = %ld\n", offset, length);
        dhara_abort();

        return -RT_EINVAL;
    }

    ret = HAL_SPINAND_ReadPageAnyWhere(spinand, p + n->start_blocks * n->page_per_block, data, offset, length);
    dhara_dbg("NAND_read page=0x%x offset=0x%x length=%x\n", p + n->start_blocks * n->page_per_block, offset, length);
    if (ret == SPINAND_ECC_ERROR)
    {
        rt_kprintf("NAND_read page 0x%x failed, ret=%d\n", p, ret);
        dhara_set_error(err, DHARA_E_ECC);
    }
    else
    {
        dhara_set_error(err, DHARA_E_NONE);
    }
    r_count++;

    return ret;
}

int dhara_nand_copy(const struct dhara_nand *n,
                    dhara_page_t src, dhara_page_t dst,
                    dhara_error_t *err)
{
    if ((dhara_nand_read(n, src, 0, n->page_size, n->copy_buf, err) < 0) ||
            (dhara_nand_prog(n, dst, n->copy_buf, err) < 0))
        return -1;

    return 0;
}

static rt_err_t part_blk_init(rt_device_t dev)
{
    return RT_EOK;
}

static rt_err_t part_blk_open(rt_device_t dev, rt_uint16_t oflag)
{
    return RT_EOK;
}

static rt_err_t part_blk_close(rt_device_t dev)
{
    return RT_EOK;
}

static rt_err_t part_blk_control(rt_device_t dev, int cmd, void *args)
{
    struct rt_flash_partition *blk_part = DEV_2_PART(dev);
    struct dhara_device *dhara_dev = (struct dhara_device *)dev->user_data;

    dhara_dbg("%s %ld\n", __func__, blk_part->size);

    RT_ASSERT(dev != RT_NULL);
    switch (cmd)
    {
    case RT_DEVICE_CTRL_BLK_GETGEOME:
    {
        struct rt_device_blk_geometry *geometry;

        geometry = (struct rt_device_blk_geometry *)args;
        if (geometry == RT_NULL)
            return -RT_ERROR;
        geometry->bytes_per_sector  = dhara_dev->sector_size;
        geometry->sector_count      = blk_part->size / geometry->bytes_per_sector;
        geometry->block_size        = geometry->bytes_per_sector;
        dhara_dbg("%s sector=%x count=%x\n", __func__, geometry->bytes_per_sector, geometry->sector_count);
        break;
    }
    default:
        break;
    }

    return RT_EOK;
}

static rt_size_t part_blk_read(rt_device_t dev, rt_off_t sec, void *buffer, rt_size_t nsec)
{
    struct rt_flash_partition *blk_part = DEV_2_PART(dev);
    struct dhara_device *dhara_dev = (struct dhara_device *)dev->user_data;
    rt_size_t   read_count = 0;
    rt_uint8_t *ptr = (rt_uint8_t *)buffer;
    rt_size_t ret;
    dhara_error_t err;

    RT_ASSERT(dev != RT_NULL);
    RT_ASSERT(nsec != 0);

    dhara_dbg("%s sec = %08x,nsec = %08x %lx %lx\n", __func__, sec, nsec, blk_part->offset, blk_part->size);
    if (!(blk_part->mask_flags & PART_FLAG_RDONLY))
    {
        rt_kprintf("ERROR: partition %s is unreadable, mask_flags = %04x\n", blk_part->name, blk_part->mask_flags);
        return 0;
    }

    while (read_count < nsec)
    {
        if (((sec + 1) * dhara_dev->sector_size) > (blk_part->offset + blk_part->size))
        {
            rt_kprintf("ERROR: read overrun!\n");
            return read_count;
        }

        /* It'a BLOCK device */
        rt_mutex_take(&spinand_lock, RT_WAITING_FOREVER);
        ret = dhara_map_read(&dhara_dev->map, sec, ptr, &err);
        rt_mutex_release(&spinand_lock);
        if (ret)
            return read_count;
        sec++;
        ptr += dhara_dev->sector_size;
        read_count++;
    }

    return nsec;
}

static rt_size_t part_blk_write(rt_device_t dev, rt_off_t sec, const void *buffer, rt_size_t nsec)
{
    struct rt_flash_partition *blk_part = DEV_2_PART(dev);
    struct dhara_device *dhara_dev = (struct dhara_device *)dev->user_data;
    rt_size_t   write_count = 0;
    rt_uint8_t *ptr = (rt_uint8_t *)buffer;
    rt_size_t ret;
    dhara_error_t err;

    RT_ASSERT(dev != RT_NULL);
    RT_ASSERT(nsec != 0);

    dhara_dbg("%s sec = %08x,nsec = %08x %lx %lx\n", __func__, sec, nsec, blk_part->offset, blk_part->size);

    if (!(blk_part->mask_flags & PART_FLAG_WRONLY))
    {
        rt_kprintf("ERROR: partition %s is unwriteable, mask_flags = %04x\n", blk_part->name, blk_part->mask_flags);
        return 0;
    }

    while (write_count < nsec)
    {
        if (((sec + 1) * dhara_dev->sector_size) > (blk_part->offset + blk_part->size))
        {
            rt_kprintf("ERROR: write overrun!\n");
            return write_count;
        }
        /* It'a BLOCK device */
        rt_mutex_take(&spinand_lock, RT_WAITING_FOREVER);
        ret = dhara_map_write(&dhara_dev->map, sec, ptr, &err);
        if (ret)
        {
            rt_mutex_release(&spinand_lock);
            return write_count;
        }
        ret = dhara_map_sync(&dhara_dev->map, NULL);
        rt_mutex_release(&spinand_lock);
        if (ret)
            return write_count;
        sec++;
        ptr += dhara_dev->sector_size;
        write_count++;
    }

    return write_count;
}

#ifdef RT_USING_DEVICE_OPS
const static struct rt_device_ops part_blk_ops =
{
    part_blk_init,
    part_blk_open,
    part_blk_close,
    part_blk_read,
    part_blk_write,
    part_blk_control,
};
#endif

/* Register a partition as block partition */
static rt_err_t part_blk_register(struct dhara_device *dev, struct rt_flash_partition *blk_part)
{
    if (dev == RT_NULL)
        return -RT_EIO;

    if (blk_part == RT_NULL)
        return -RT_EINVAL;

    dhara_dbg("blk part name: %s\n", blk_part->name);
    /* blk dev setting */
    blk_part->blk.type      = RT_Device_Class_Block;
#ifdef RT_USING_DEVICE_OPS
    blk_part->blk.ops       = &part_blk_ops;
#else
    blk_part->blk.init      = part_blk_init;
    blk_part->blk.open      = part_blk_open;
    blk_part->blk.read      = part_blk_read;
    blk_part->blk.write     = part_blk_write;
    blk_part->blk.close     = part_blk_close;
    blk_part->blk.control   = part_blk_control;
#endif
    blk_part->blk.user_data = dev;  /* spinad blk dev for operation */
    /* register device */
    return rt_device_register(&blk_part->blk, blk_part->name, blk_part->mask_flags | RT_DEVICE_FLAG_STANDALONE);
}

static struct rt_flash_partition default_part =
{
    .name = "root",
    .offset = 0,
    .size = 48400 * 2048, /* 128MB maximum */
    .type = 0x8,
    .mask_flags = PART_FLAG_BLK | PART_FLAG_RDWR,
};

#ifdef DHARA_RANDOM_TEST
static uint8_t buf[2048];
static int recheck = 0;
#define NUM_SECTORS     2464
#define MAX_SECTORS     2464
static dhara_sector_t sector_list[NUM_SECTORS];

void seq_gen(unsigned int seed, uint8_t *buf, size_t length)
{
    size_t i;

    srand(seed);
    for (i = 0; i < length; i++)
        buf[i] = rand();
}

void seq_assert(unsigned int seed, const uint8_t *buf, size_t length)
{
    size_t i;

    srand(seed);
    for (i = 0; i < length; i++)
    {
        const uint8_t expect = rand();

        if (buf[i] != expect)
        {
            rt_kprintf("seq_assert: mismatch at %ld in sequence %d: 0x%02x (expected 0x%02x)\n", i, seed, buf[i], expect);
            abort();
        }
    }
}

static void mt_write(struct dhara_map *m, dhara_sector_t s, int seed)
{
    dhara_error_t err;

    seq_gen(seed, buf, sizeof(buf));
    if (dhara_map_write(m, s, buf, &err) < 0)
    {
        rt_kprintf("map_write %d\n", err);
        abort();
    }
}

static void mt_assert(struct dhara_map *m, dhara_sector_t s, int seed, bool unknown)
{
    dhara_error_t err = DHARA_E_NOT_FOUND;

    if (dhara_map_read(m, s, buf, &err) < 0)
    {
        rt_kprintf("map_read %d\n", err);
        abort();
    }

    if (err != DHARA_E_NOT_FOUND)
    {
        seq_assert(seed, buf, sizeof(buf));
        if (unknown)
            recheck++;
    }
}

static void shuffle(int seed)
{
    int i;

    srand(seed);
    for (i = 0; i < NUM_SECTORS; i++)
        sector_list[i] = rand() % MAX_SECTORS;

    for (i = NUM_SECTORS - 1; i > 0; i--)
    {
        const int j = rand() % i;
        const int tmp = sector_list[i];

        sector_list[i] = sector_list[j];
        sector_list[j] = tmp;
    }
}

static int dhara_rand_test(struct dhara_map *m, int seed)
{
    int i, loop = 0;
    int a, b, c, d;
    int gap = 0x200;
    int i_cur = 0;
    uint32_t start_time, end_time, cost_time, size;

    shuffle(seed);
    while (1)
    {
        loop++;
        for (i_cur = 0; i_cur < NUM_SECTORS; i_cur += gap)
        {
            for (i = i_cur; i < i_cur + gap; i++)
            {
                const dhara_sector_t s = sector_list[i];
                mt_write(m, s, s);
                mt_assert(m, s, s, false);
                if (!(i & 0x2FF))
                {
                    rt_kprintf("%s loop=%d s=%d recheck=%d p=%d r=%d\n", __func__, loop, s, recheck, m->prog_total, m->read_total);
                }
            }

            a = m->prog_total;
            b = p_count;
            c = e_count;
            d = r_count;
            start_time = HAL_GetTick();
            for (i = i_cur; i < i_cur + gap; i++)
            {
                const dhara_sector_t s = sector_list[i];

                mt_write(m, s, s);
            }
            end_time = HAL_GetTick();
            cost_time = (end_time - start_time);
            size = 2048 * gap;

            a = m->prog_total - a;
            b = p_count - b;
            c = e_count - c;
            d = r_count - d;
            rt_kprintf("======= prog: p-P/E/R = %d-%d/%d/%d, speed %dKB/s\n", a, b, c, d, size / cost_time);

            a = m->read_total;
            b = p_count;
            c = e_count;
            d = r_count;
            start_time = HAL_GetTick();
            for (i = i_cur; i < i_cur + gap; i++)
            {
                const dhara_sector_t s = sector_list[i];

                mt_assert(m, s, s, false);
            }
            end_time = HAL_GetTick();
            cost_time = (end_time - start_time);
            size = 2048 * gap;

            a = m->read_total - a;
            b = p_count - b;
            c = e_count - c;
            d = r_count - d;
            rt_kprintf("======= read: r-P/E/R = %d-%d/%d/%d, speed %dKB/s\n", a, b, c, d, size / cost_time);
        }
    }

    return 0;
}
#endif

static int dhara_register(struct dhara_device *dhara_dev)
{
    const size_t page_size = dhara_dev->nand.page_size;
    uint8_t *page_buf;
    struct dhara_map *map;
    int ret;

    dhara_dev->nand.copy_buf = rt_calloc(1, dhara_dev->nand.page_size);
    RT_ASSERT(dhara_dev->nand.copy_buf);
    dhara_dev->nand.blocks = rt_calloc(dhara_dev->nand.num_blocks, sizeof(struct block_status));
    RT_ASSERT(dhara_dev->nand.blocks);
    page_buf = rt_malloc(page_size);
    RT_ASSERT(page_buf);

    map = &dhara_dev->map;

    dhara_dbg("dhara init\n");
    dhara_map_init(map, &dhara_dev->nand, page_buf, GC_RATIO);
    dhara_dbg("dhara resume\n");
    dhara_map_resume(map, NULL);
    dhara_dbg("dhara sync\n");

    ret = dhara_map_sync(map, NULL);
    if (ret)
    {
        rt_kprintf("dhara sync failed, ret=%d\n", ret);
        goto exit;
    }
    dhara_dev->sector_size = dhara_dev->nand.page_size;
    dhara_dev->capacity = dhara_map_capacity(map);
    rt_kprintf("  log2_page_size: %d\n", dhara_dev->nand.log2_page_size);
    rt_kprintf("  log2_ppb: %d\n", dhara_dev->nand.log2_ppb);
    rt_kprintf("  num_blocks: %d\n", dhara_dev->nand.num_blocks);
    rt_kprintf("  sector_size: %d\n", dhara_dev->sector_size);
    rt_kprintf("  page_per_block: %d\n", dhara_dev->nand.page_per_block);
    rt_kprintf("  capacity(sec): %d\n", dhara_dev->capacity);
    rt_kprintf("  capacity(MB): %d\n", dhara_dev->capacity * dhara_dev->sector_size / 1024 / 1024);
    rt_kprintf("  start_blocks: %d\n", dhara_dev->nand.start_blocks);
    rt_kprintf("  num_blocks: %d\n", dhara_dev->nand.num_blocks);
    rt_kprintf("  use count: %d\n", dhara_map_size(map));
#ifdef DHARA_RANDOM_TEST
    dhara_rand_test(map, dhara_map_size(map));
#endif

    /* Register partitions */
    default_part.size = dhara_dev->capacity * dhara_dev->sector_size;
    ret = part_blk_register(dhara_dev, &default_part);

exit:
    if (ret)
    {
        rt_free(dhara_dev->nand.copy_buf);
        rt_free(dhara_dev->nand.blocks);
        rt_free(page_buf);
    }

    return ret;
}
#endif /* #ifdef RT_USING_DHARA */

/**
 * @brief  Init SPI_NAND framwork and apply to use.
 * @attention The SPI_NAND will be enabled when board initialization, do not
 *      dynamically switch SPINAND unless specifically required.
 */
int rt_hw_spinand_init(void)
{
    struct rt_mtd_nand_device *mtd_dev;
    struct SPI_NAND *spinand;
    struct SPI_NAND_HOST *spi;
    struct dfs_partition part;
    int32_t ret, i;
    uint32_t block_size;
    uint32_t block_reserved;
#ifdef RT_USING_DHARA
    struct dhara_device *dhara_dev;
    uint32_t root_part_offset = DHARA_DEFAULT_OFFSET;
    uint32_t root_part_size = 0xFFFFFFFF;
#endif

    /* Initial spinand */
    mtd_dev = (struct rt_mtd_nand_device *)rt_calloc(1, sizeof(*mtd_dev));
    RT_ASSERT(mtd_dev);
    spinand = (struct SPI_NAND *)rt_calloc(1, sizeof(*spinand));
    RT_ASSERT(spinand);
    spi = (struct SPI_NAND_HOST *)rt_calloc(1, sizeof(*spi));
    RT_ASSERT(spi);
    spinand->spi = spi;

    ret = spinand_adapt(spinand);
    if (ret)
    {
        rt_kprintf("SPI Nand init adapt error, ret= %ld\n", ret);
        goto err_init;
    }
    if (rt_mutex_init(&(spinand_lock), "spinandLock", RT_IPC_FLAG_FIFO) != RT_EOK)
    {
        rt_kprintf("Init mutex error\n");
        RT_ASSERT(0);
    }

    /* Register mtd spinand */
    mtd_dev->page_size       = spinand->secPerPage * SPINAND_SECTOR_SIZE;
    mtd_dev->oob_size        = spinand->secPerPage * 16;
    mtd_dev->oob_free        = spinand->secPerPage * 2;
    mtd_dev->plane_num       = spinand->planePerDie;
    mtd_dev->pages_per_block = spinand->pagePerBlk;
    mtd_dev->block_total     = spinand->blkPerPlane * spinand->planePerDie;
    mtd_dev->block_start     = 0;
    mtd_dev->block_end       = mtd_dev->block_total;
    mtd_dev->ops             = &ops;
    mtd_dev->priv            = spinand;
    block_size               = mtd_dev->pages_per_block * mtd_dev->page_size;

    spinand_dbg("page_size %lx\n", mtd_dev->page_size);
    spinand_dbg("oob_size %lx\n", mtd_dev->oob_size);
    spinand_dbg("oob_free %lx\n", mtd_dev->oob_free);
    spinand_dbg("plane_num %lx\n", mtd_dev->plane_num);
    spinand_dbg("pages_per_block %lx\n", mtd_dev->pages_per_block);
    spinand_dbg("block_total %lx\n", mtd_dev->block_total);
    spinand_dbg("block_start %lx\n", mtd_dev->block_start);
    spinand_dbg("block_end %lx\n", mtd_dev->block_end);

    ret = rt_mtd_nand_register_device("spinand0", mtd_dev);
    if (ret < 0)
    {
        rt_kprintf("rt_mtd_register failed, ret=%d\n", ret);
        goto err_init;
    }

    /* Register mini ftl, and parse the partition */
    block_reserved = RK_SPINAND_RESERVED_BBT_BLOCKS + 1;
    i = mtd_dev->block_total - block_reserved;
    for (; i >= 0; i--)
    {
        ret = HAL_SPINAND_IsBad(spinand, i * mtd_dev->pages_per_block);
        rt_kprintf("Scan block in the tail, blk[%d]=%d\n", i, ret);
        if (!ret)
        {
            block_reserved = mtd_dev->block_total - i;
            break;
        }
    }

    spinand->pageBuf = rt_calloc(1, 2 * spinand->secPerPage * SPINAND_SECTOR_SIZE);
    RT_ASSERT(spinand->pageBuf);
    ret = HAL_SPINAND_ReadPageRaw(spinand, 0, spinand->pageBuf, RT_FALSE);
    if (ret >= 0)
    {
        ret = HAL_SPINAND_ReadPageRaw(spinand, 1, (uint8_t *)(spinand->pageBuf) +
                                      spinand->secPerPage * SPINAND_SECTOR_SIZE, RT_FALSE);
    }
    if (ret >= 0)
    {
        for (i = 0; i < RK_PARTITION_MAX_PARTITION; i++)
        {
            ret = dfs_filesystem_get_partition(&part, (uint8_t *)(spinand->pageBuf), 8, i);
            if (ret == RT_EOK)
            {
                dhara_dbg("part%d type=%x off=%x size=%x\n", i, part.type, part.offset, part.size);
#ifdef RT_USING_DHARA
                root_part_offset = part.offset;
                root_part_size = part.size;
#endif
#ifdef RT_USING_MINI_FTL
                if (part.size == 0xFFFFFFFF)
                {
                    mini_ftl_map_table_init(mtd_dev, part.offset * 512, 0xFFFFFFFF);
                }
                else
                {
                    mini_ftl_map_table_init(mtd_dev, part.offset * 512, part.size * 512);
                }
#endif
            }
            else
            {
                ret = 0;
                break;
            }
        }
        ret = rk_partition_init((struct rk_partition_info *)spinand->pageBuf,
                                (mtd_dev->block_total - block_reserved) * block_size);
        if (ret)
        {
            rt_kprintf("rk_partition register failed, ret=%d\n", ret);
        }
    }

    /* Register DHARA FTL, reserved blocks in the tail */
#ifdef RT_USING_DHARA
    dhara_dev = (struct dhara_device *)rt_calloc(1, sizeof(*dhara_dev));
    RT_ASSERT(dhara_dev);

    dhara_dev->nand.start_blocks = root_part_offset * 512 / block_size;
    dhara_dev->nand.num_blocks = mtd_dev->block_total - dhara_dev->nand.start_blocks - block_reserved;
    if (root_part_size && root_part_size != 0xFFFFFFFF)
    {
        root_part_size = root_part_size * 512 / block_size;
        if (root_part_size < (dhara_dev->nand.num_blocks))
        {
            dhara_dev->nand.num_blocks = root_part_size;
        }
    }
#if defined(RT_ROOT_PART_OFFSET) && defined(RT_ROOT_PART_SIZE)
    dhara_dev->nand.start_blocks = RT_ROOT_PART_OFFSET * 512 / block_size;
    dhara_dev->nand.num_blocks = RT_ROOT_PART_SIZE * 512 / block_size;
#endif

    dhara_dev->nand.log2_page_size = __rt_ffs(mtd_dev->page_size) - 1;
    dhara_dev->nand.log2_ppb = __rt_ffs(mtd_dev->pages_per_block) - 1;
    dhara_dev->nand.page_size = mtd_dev->page_size;
    dhara_dev->nand.page_per_block = mtd_dev->pages_per_block;
    dhara_dev->nand.priv_data = spinand;
    ret = dhara_register(dhara_dev);
    if (ret < 0)
    {
        rt_free(spinand->pageBuf);
        rt_free(dhara_dev);
    }
#endif

err_init:
    if (ret < 0)
    {
        rt_kprintf("%s failed, ret=%d\n", __func__, ret);
        rt_free(spinand->spi);
        rt_free(spinand);
        rt_free(mtd_dev);
    }

    return ret;
}
INIT_DEVICE_EXPORT(rt_hw_spinand_init);

/** @} */  // SPINAND_Public_Function

#endif

/** @} */  // SPINAND

/** @} */  // RKBSP_Common_Driver
