# NEX - OS Installer

CLI propio en Python 3 estándar, sin dependencias pip ni instalación global.
Se ejecuta desde cualquier directorio con la ruta al archivo `nex` del repo.
Sin argumentos abre el asistente ASCII si hay terminal; en scripts muestra ayuda.
El asistente permite diagnóstico y planificación. La compilación se solicita
explícitamente mediante `build`; no se ejecuta por elegir un elemento del menú.

```sh
./nex
./nex targets
./nex --help
./nex doctor --soc hi3798mv300h --board juw7.820.00218613
./nex install --soc hi3798mv300h --board juw7.820.00218613 --dry-run
```

HiSilicon devuelve error por componentes faltantes. No detecta físicamente
hardware ni identifica dispositivos USB. La variante sigue siendo probable.

Para Rockchip, copiar un `chip:defconfig` exacto del catálogo; solo un perfil
verificado para el dispositivo físico es adecuado. Ejemplo de sintaxis:

```sh
./nex doctor --soc rockchip --profile '<chip>:<defconfig>'
./nex build --soc rockchip --profile '<chip>:<defconfig>' --with-ui
./nex install --soc rockchip --profile '<chip>:<defconfig>' --dry-run
```

`build` exige host Linux x86_64 y comprueba comandos básicos; el SDK revisará
sus dependencias adicionales. Con `--with-ui` prepara el overlay web existente,
selecciona el perfil y ejecuta el build; ante un fallo detiene la secuencia.
`--stage kernel` o `--stage rootfs` permite compilar esas etapas. Los directorios
y artefactos Rockchip conservan los destinos del SDK. No hay garantía de
compatibilidad física por el mero hecho de que un perfil exista.

`plan` y `install --dry-run` son de solo lectura. Indican si update.img existe,
pero no afirman procedencia, correspondencia con el perfil o integridad.
**La instalación física está deshabilitada para todas las plataformas en esta
fase**, incluso con una imagen presente. `install` sin `--dry-run` devuelve 1.
No se llama a rkflash.sh, upgrade_tool, sudo ni comandos de escritura.

Códigos: 0 éxito de consulta/plan o build; 1 requisitos pendientes/bloqueo;
2 argumentos inválidos/error de ejecución; 130 cancelación. Los builds propagan
el código del subproceso. No guarda una selección global ni cambia el target
para posteriores invocaciones de build.sh.

Validaciones sin hardware:

```sh
python3 -m unittest discover -s tests -p 'test_nex_cli.py'
bash tests/platform-dispatch.sh
```

La interfaz usa ANSI en terminales: logo cian, marco violeta, éxitos verdes,
avisos amarillos y bloqueos/errores rojos. Los prompts son violetas.
Al redirigir la salida o usar `TERM=dumb`, se omiten los colores. Para
apagarlos manualmente: `NO_COLOR=1 ./nex`. No requiere librerías adicionales.
