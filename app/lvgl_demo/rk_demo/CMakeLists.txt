cmake_minimum_required(VERSION 3.8)

project(rk_demo)

add_definitions(-DMULTIMEDIA_EN=${RK_DEMO_MULTIMEDIA_EN})

include_directories(
	${PROJECT_SOURCE_DIR}/
	${PROJECT_SOURCE_DIR}/home
	${PROJECT_SOURCE_DIR}/furniture_control
	${PROJECT_SOURCE_DIR}/setting
	${PROJECT_SOURCE_DIR}/smart_home
	${PROJECT_SOURCE_DIR}/include
	${PROJECT_SOURCE_DIR}/intercom_homepage
	${PROJECT_SOURCE_DIR}/intercom_homepage/video_monitor
	${PROJECT_SOURCE_DIR}/intercom_homepage/intercom_call
	${PROJECT_SOURCE_DIR}/rockit
	${PROJECT_SOURCE_DIR}/wifibt
	${CMAKE_SYSROOT}/usr/include/rkadk/
	)

aux_source_directory(. SRCS)
aux_source_directory(./home SRCS)
aux_source_directory(./furniture_control SRCS)
aux_source_directory(./setting SRCS)
aux_source_directory(./smart_home SRCS)
aux_source_directory(./intercom_homepage SRCS)
aux_source_directory(./intercom_homepage/video_monitor SRCS)
aux_source_directory(./intercom_homepage/intercom_call SRCS)
aux_source_directory(./layout SRCS)
aux_source_directory(./wifibt SRCS)

if (RK_DEMO_MULTIMEDIA_EN)
	aux_source_directory(./rockit SRCS)
endif()

add_executable(${PROJECT_NAME} ${SRCS})

target_link_libraries(${PROJECT_NAME}
	lvgl pthread m lv_drivers freetype rkwifibt
)
if (RK_DEMO_MULTIMEDIA_EN)
	target_link_libraries(${PROJECT_NAME} rockit rkadk)
endif()

if (LV_DRV_USE_SDL_GPU)
	target_link_libraries(${PROJECT_NAME} SDL2)
endif()
if (LV_DRV_USE_DRM)
	target_link_libraries(${PROJECT_NAME} drm evdev)
endif()

install(TARGETS ${PROJECT_NAME} RUNTIME DESTINATION bin)
install(DIRECTORY resource DESTINATION share)
install(PROGRAMS S00-lv_demo S99-lv_demo-end DESTINATION /etc/init.d)
install(FILES asound.conf DESTINATION /etc)
