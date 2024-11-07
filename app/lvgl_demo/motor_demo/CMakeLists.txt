cmake_minimum_required(VERSION 3.8)

project(motor_demo)

add_definitions(-g)

include_directories(
	${PROJECT_SOURCE_DIR}/
	)

link_directories(./)

if (LV_DRV_USE_SDL_GPU)
	add_definitions(-DUSE_SDL_GPU=1)
endif()
if (LV_DRV_USE_DRM)
	add_definitions(-DUSE_DRM=1 -DUSE_EVDEV=1)
endif()

aux_source_directory(. SRCS)

add_executable(${PROJECT_NAME} ${SRCS})

#target_link_libraries(${PROJECT_NAME}
#	lvgl pthread m lv_drivers freetype madht1505ba1 ethercat
#)

#This demo only provides ui display. For details about the prototype library, consult RK
target_link_libraries(${PROJECT_NAME}
	lvgl pthread m lv_drivers freetype
)

if (LV_DRV_USE_SDL_GPU)
	target_link_libraries(${PROJECT_NAME} SDL2)
endif()
if (LV_DRV_USE_DRM)
	target_link_libraries(${PROJECT_NAME} drm evdev)
endif()

install(TARGETS ${PROJECT_NAME} RUNTIME DESTINATION bin)
install(DIRECTORY res DESTINATION share)
