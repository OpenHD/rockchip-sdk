/*
 * Copyright (c) 2023 Rockchip, Inc. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

#include <lvgl/lvgl.h>
#include <lvgl/lv_conf.h>

#include "main.h"
#include "hal_sdl.h"
#include "hal_drm.h"
#include "home_ui.h"
#include "ui_resource.h"

#if ROCKIT_EN
#include "rk_defines.h"
#include "rk_mpi_sys.h"
#endif

#include "wifibt.h"

lv_ft_info_t ttf_main_s;
lv_ft_info_t ttf_main_m;
lv_ft_info_t ttf_main_l;

lv_style_t style_txt_s;
lv_style_t style_txt_m;
lv_style_t style_txt_l;

lv_dir_t scr_dir;
lv_coord_t scr_w;
lv_coord_t scr_h;

static int g_indev_rotation = 0;
static int g_disp_rotation = LV_DISP_ROT_NONE;

static int quit = 0;

extern void rk_demo_init(void);

static void sigterm_handler(int sig)
{
    fprintf(stderr, "signal %d\n", sig);
    quit = 1;
}

int app_disp_rotation(void)
{
    return g_disp_rotation;
}

static void check_scr(void)
{
    scr_w = LV_HOR_RES;
    scr_h = LV_VER_RES;

    if (scr_w >= scr_h)
        scr_dir = LV_DIR_HOR;
    else
        scr_dir = LV_DIR_VER;

    printf("%s %dx%d\n", __func__, scr_w, scr_h);
}

static void lvgl_init(void)
{
    lv_init();

#if USE_SDL_GPU
    hal_sdl_init(0, 0, g_disp_rotation);
#else
    hal_drm_init(0, 0, g_disp_rotation);
    lv_port_indev_init(g_indev_rotation);
#endif
    lv_port_fs_init();

    check_scr();
}

static void font_init(void)
{
    lv_freetype_init(64, 1, 0);

    if (scr_dir == LV_DIR_HOR)
    {
        ttf_main_s.weight = ALIGN(RK_PCT_W(2), 2);
        ttf_main_m.weight = ALIGN(RK_PCT_W(3), 2);
        ttf_main_l.weight = ALIGN(RK_PCT_W(9), 2);
    }
    else
    {
        ttf_main_s.weight = ALIGN(RK_PCT_H(2), 2);
        ttf_main_m.weight = ALIGN(RK_PCT_H(3), 2);
        ttf_main_l.weight = ALIGN(RK_PCT_H(9), 2);
    }

    printf("%s s %d m %d l %d\n", __func__,
           ttf_main_s.weight, ttf_main_m.weight, ttf_main_l.weight);

    ttf_main_s.name = MAIN_FONT;
    ttf_main_s.style = FT_FONT_STYLE_NORMAL;
    lv_ft_font_init(&ttf_main_s);

    ttf_main_m.name = MAIN_FONT;
    ttf_main_m.style = FT_FONT_STYLE_NORMAL;
    lv_ft_font_init(&ttf_main_m);

    ttf_main_l.name = MAIN_FONT;
    ttf_main_l.style = FT_FONT_STYLE_NORMAL;
    lv_ft_font_init(&ttf_main_l);
}

static void style_init(void)
{
    lv_style_init(&style_txt_s);
    lv_style_set_text_font(&style_txt_s, ttf_main_s.font);
    lv_style_set_text_color(&style_txt_s, lv_color_black());

    lv_style_init(&style_txt_m);
    lv_style_set_text_font(&style_txt_m, ttf_main_m.font);
    lv_style_set_text_color(&style_txt_m, lv_color_black());

    lv_style_init(&style_txt_l);
    lv_style_set_text_font(&style_txt_l, ttf_main_l.font);
    lv_style_set_text_color(&style_txt_l, lv_color_black());
}

void app_init(void)
{
    font_init();
    style_init();
}

int main(int argc, char **argv)
{
#define FPS     0
#if FPS
    float maxfps = 0.0, minfps = 1000.0;
    float fps;
    float fps0 = 0, fps1 = 0;
    uint32_t st, et;
    uint32_t st0 = 0, et0;
#endif
    signal(SIGINT, sigterm_handler);

#if ROCKIT_EN
    RK_MPI_SYS_Init();
#endif
#if WIFIBT_EN
    run_wifibt_server();
#endif

    lvgl_init();

    app_init();

    rk_demo_init();

    while (!quit)
    {
#if FPS
        st = clock_ms();
#endif
        lv_task_handler();
#if FPS
        et = clock_ms();
        fps = 1000 / (et - st);
        if (fps != 0.0 && fps < minfps)
        {
            minfps = fps;
            printf("Update minfps %f\n", minfps);
        }
        if (fps < 60 && fps > maxfps)
        {
            maxfps = fps;
            printf("Update maxfps %f\n", maxfps);
        }
        if (fps > 0.0 && fps < 60)
        {
            fps0 = (fps0 + fps) / 2;
            fps1 = (fps0 + fps1) / 2;
        }
        et0 = clock_ms();
        if ((et0 - st0) > 1000)
        {
            printf("avg:%f\n", fps1);
            st0 = et0;
        }
#endif
        usleep(100);
    }

#if ROCKIT_EN
    RK_MPI_SYS_Exit();
#endif

    return 0;
}
