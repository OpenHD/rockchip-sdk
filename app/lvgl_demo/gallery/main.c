/*
 * Copyright (c) 2021 Rockchip, Inc. All Rights Reserved.
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

static int g_indev_rotation = 0;
static int g_disp_rotation = LV_DISP_ROT_NONE;

static int quit = 0;

extern void gallery(void);

static void sigterm_handler(int sig)
{
    fprintf(stderr, "signal %d\n", sig);
    quit = 1;
}

int app_disp_rotation(void)
{
    return g_disp_rotation;
}

static void lvgl_init(void)
{
    lv_init();

#ifdef USE_SDL_GPU
    hal_sdl_init(0, 0, g_disp_rotation);
#else
    hal_drm_init(0, 0, g_disp_rotation);
    lv_port_indev_init(g_indev_rotation);
#endif
    lv_port_fs_init();
}

int main(int argc, char **argv)
{
    signal(SIGINT, sigterm_handler);
    lvgl_init();

    gallery();

    while (!quit)
    {
        lv_task_handler();
        usleep(100);
    }

    return 0;
}

