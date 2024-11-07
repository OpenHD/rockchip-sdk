#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "main.h"
#include "wifibt.h"

#define log(fmt, ...)    printf("[WIFIBT] "fmt, ##__VA_ARGS__)

int run_wifibt_server(void)
{
    int ret;

    ret = run_wifi_server();
    if (ret != 0)
        log("run_wifi_server failed\n");
    ret = run_bt_server();
    if (ret != 0)
        log("run_bt_server failed\n");

    return ret;
}

