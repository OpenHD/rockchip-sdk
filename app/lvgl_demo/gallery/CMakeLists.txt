cmake_minimum_required(VERSION 3.8)

project(gallery)

include(FindPkgConfig)
find_package(PkgConfig)

include_directories(
	${PROJECT_SOURCE_DIR}/./
	)

aux_source_directory(. SRCS)
aux_source_directory(pics SRCS)
aux_source_directory(anims SRCS)

add_executable(${PROJECT_NAME} ${SRCS})

target_link_libraries(${PROJECT_NAME}
	lvgl pthread m lv_drivers freetype
)

if (LV_DRV_USE_OPENGL)
	add_definitions(-DUSE_OPENGL=1)
	pkg_check_modules(PKG_GL glesv2)
	target_link_libraries(${PROJECT_NAME} ${PKG_GL_LIBRARIES})
endif()
if (LV_DRV_USE_SDL_GPU)
	target_link_libraries(${PROJECT_NAME} SDL2)
endif()
if (LV_DRV_USE_DRM)
	target_link_libraries(${PROJECT_NAME} drm evdev)
endif()

install(TARGETS ${PROJECT_NAME} RUNTIME DESTINATION bin)

