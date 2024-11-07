/*
 * Copyright (c) 2006-2021, RT-Thread Development Team
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Change Logs:
 * Date           Author       Notes
 * 2013-07-20     Bernard      first version
 */

#include <rtthread.h>
#include <rthw.h>
#include <board.h>

#include "armv7.h"
#include "interrupt.h"

#ifdef RT_USING_FINSH
extern long list_thread(void);
#endif

extern uint32_t stack_start[];
extern uint32_t stack_top[];
extern uint32_t _stext[];
extern uint32_t _etext[];

#define B_INST_A1_MASK      (0xa << 24)
#define INST_SET_MASK       (0x01000020U)

rt_bool_t is_valid_inst(uint32_t *inst)
{
    if (inst > _stext && inst < _etext)
    {
        if ((*inst & B_INST_A1_MASK) == B_INST_A1_MASK)
            return RT_TRUE;
    }

    return RT_FALSE;
}

rt_err_t rt_find_stack_info(uint32_t *fp, uint32_t **stack_s, uint32_t **stack_e)
{
    struct rt_object_information *info;
    struct rt_list_node *list;
    struct rt_thread *thread;
    struct rt_list_node *node;
    uint32_t *start, *end;

    info = rt_object_get_information(RT_Object_Class_Thread);
    list = &info->object_list;

    for (node = list->next; node != list; node = node->next)
    {
        thread = rt_list_entry(node, struct rt_thread, list);
        start = (uint32_t *)thread->stack_addr;
        end = (uint32_t *)((uint32_t)thread->stack_addr + thread->stack_size);
        if (fp > start && fp < end)
        {
            *stack_s = start;
            *stack_e = end;
            rt_kprintf("exception in task: %s, stack[%p, %p]\n", thread->name, start, end);
            return RT_EOK;
        }
    }

    if (fp > stack_start && fp < stack_top)
    {
        *stack_s = stack_start;
        *stack_e = stack_top;
        return RT_EOK;
    }

    return RT_ERROR;
}

void rt_dump_hex(uint32_t *start, uint32_t *end)
{
    uint32_t i, count, *addr;

    count = (end - start) / 4;
    for (i = 0; i < count; i++)
    {
        addr = start + i * 4;
        rt_kprintf("0x%08x: 0x%08x 0x%08x 0x%08x 0x%08x\n", addr,
                   addr[0], addr[1], addr[2], addr[3]);
    }
}

void rt_hw_dump_backtrace(struct rt_hw_exp_stack *regs, uint32_t max_depth)
{
    uint32_t *stack_s, *stack_e;
    uint32_t *tmp, *pc, *sp;
    uint32_t count = 0;

    sp = (uint32_t *)regs->sp;

    if (rt_find_stack_info(sp, &stack_s, &stack_e))
    {
        rt_kprintf("illegal sp: %p\n", sp);
        return;
    }

    rt_dump_hex(sp, stack_e);

    if ((regs->cpsr & INST_SET_MASK) == 0x20)
        pc = (uint32_t *)(regs->pc - 2);
    else
        pc = (uint32_t *)(regs->pc - 4);
    rt_kprintf("stack frame %u -- pc = 0x%08x \n", count++, pc);

    while (sp < stack_e && *sp != 0xdeadbeef)
    {
        tmp = *((uint32_t **)(sp));
        if (is_valid_inst(tmp))
        {
            rt_kprintf("stack frame %u -- lr = 0x%08x \n", count++, tmp);

            if (count == max_depth)
            {
                break;
            }
        }
        sp++;
    }
}

typedef rt_err_t (*exc_hook)(struct rt_hw_exp_stack *regs);

static exc_hook g_exc_hook = RT_NULL;

void rt_hw_exception_install(rt_err_t (*exception_handle)(void *context))
{
    g_exc_hook = (exc_hook)exception_handle;
}

/**
 * this function will show registers of CPU
 *
 * @param regs the registers point
 */
void rt_hw_show_register(struct rt_hw_exp_stack *regs)
{
    rt_kprintf("Execption:\n");
    rt_kprintf("r00:0x%08x r01:0x%08x r02:0x%08x r03:0x%08x\n", regs->r0, regs->r1, regs->r2, regs->r3);
    rt_kprintf("r04:0x%08x r05:0x%08x r06:0x%08x r07:0x%08x\n", regs->r4, regs->r5, regs->r6, regs->r7);
    rt_kprintf("r08:0x%08x r09:0x%08x r10:0x%08x\n", regs->r8, regs->r9, regs->r10);
    rt_kprintf("fp :0x%08x ip :0x%08x\n", regs->fp, regs->ip);
    rt_kprintf("sp :0x%08x lr :0x%08x pc :0x%08x\n", regs->sp, regs->lr, regs->pc);
    rt_kprintf("cpsr:0x%08x\n", regs->cpsr);
}

/**
 * When comes across an instruction which it cannot handle,
 * it takes the undefined instruction trap.
 *
 * @param regs system registers
 *
 * @note never invoke this function in application
 */
void rt_hw_trap_undef(struct rt_hw_exp_stack *regs)
{
#ifdef RT_USING_FPU
    {
        uint32_t val;
        uint32_t addr;

        if (regs->cpsr & (1 << 5))
        {
            /* thumb mode */
            addr = regs->pc - 2;
        }
        else
        {
            addr = regs->pc - 4;
        }
        asm volatile("vmrs %0, fpexc" : "=r"(val)::"memory");

        if (!(val & 0x40000000))
        {
            /* float ins */
            val = (1U << 30);

            asm volatile("vmsr fpexc, %0"::"r"(val):"memory");
            regs->pc = addr;
            return;
        }
    }
#endif
    rt_kprintf("undefined instruction:\n");
    rt_hw_show_register(regs);
    rt_hw_dump_backtrace(regs, 10);
    if (g_exc_hook)
        g_exc_hook(regs);
#ifdef RT_USING_FINSH
    list_thread();
#endif
    rt_hw_cpu_shutdown();
}

/**
 * The software interrupt instruction (SWI) is used for entering
 * Supervisor mode, usually to request a particular supervisor
 * function.
 *
 * @param regs system registers
 *
 * @note never invoke this function in application
 */
void rt_hw_trap_swi(struct rt_hw_exp_stack *regs)
{
    rt_kprintf("software interrupt:\n");
    rt_hw_show_register(regs);
    rt_hw_dump_backtrace(regs, 10);
    if (g_exc_hook)
        g_exc_hook(regs);
#ifdef RT_USING_FINSH
    list_thread();
#endif
    rt_hw_cpu_shutdown();
}

/**
 * An abort indicates that the current memory access cannot be completed,
 * which occurs during an instruction prefetch.
 *
 * @param regs system registers
 *
 * @note never invoke this function in application
 */
void rt_hw_trap_pabt(struct rt_hw_exp_stack *regs)
{
    rt_kprintf("prefetch abort:\n");
    rt_hw_show_register(regs);
    rt_hw_dump_backtrace(regs, 10);
    if (g_exc_hook)
        g_exc_hook(regs);
#ifdef RT_USING_FINSH
    list_thread();
#endif
    rt_hw_cpu_shutdown();
}

/**
 * An abort indicates that the current memory access cannot be completed,
 * which occurs during a data access.
 *
 * @param regs system registers
 *
 * @note never invoke this function in application
 */
void rt_hw_trap_dabt(struct rt_hw_exp_stack *regs)
{
    rt_kprintf("data abort:");
    rt_hw_show_register(regs);
    rt_hw_dump_backtrace(regs, 10);
    if (g_exc_hook)
        g_exc_hook(regs);
#ifdef RT_USING_FINSH
    list_thread();
#endif
    rt_hw_cpu_shutdown();
}

/**
 * Normally, system will never reach here
 *
 * @param regs system registers
 *
 * @note never invoke this function in application
 */
void rt_hw_trap_resv(struct rt_hw_exp_stack *regs)
{
    rt_kprintf("reserved trap:\n");
    rt_hw_show_register(regs);
    rt_hw_dump_backtrace(regs, 10);
    if (g_exc_hook)
        g_exc_hook(regs);
#ifdef RT_USING_FINSH
    list_thread();
#endif
    rt_hw_cpu_shutdown();
}

void rt_hw_trap_irq(void)
{
    void *param;
    int ir;
    rt_isr_handler_t isr_func;
    extern struct rt_irq_desc isr_table[];

    ir = rt_hw_interrupt_get_irq();

    if (ir == 1023)
    {
        /* Spurious interrupt */
        return;
    }

    /* get interrupt service routine */
    isr_func = isr_table[ir].handler;
#ifdef RT_USING_INTERRUPT_INFO
    isr_table[ir].counter++;
#endif
    if (isr_func)
    {
        /* Interrupt for myself. */
        param = isr_table[ir].param;
        /* turn to interrupt service routine */
        isr_func(ir, param);
    }

    /* end of interrupt */
    rt_hw_interrupt_ack(ir);
}

void rt_hw_trap_fiq(void)
{
    void *param;
    int ir;
    rt_isr_handler_t isr_func;
    extern struct rt_irq_desc isr_table[];

    ir = rt_hw_interrupt_get_irq();

    /* get interrupt service routine */
    isr_func = isr_table[ir].handler;
    param = isr_table[ir].param;

    /* turn to interrupt service routine */
    isr_func(ir, param);

    /* end of interrupt */
    rt_hw_interrupt_ack(ir);
}

