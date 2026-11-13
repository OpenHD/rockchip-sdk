/**
 * Datos de la Guía técnica que se pueden filtrar con el buscador: problemas frecuentes, preguntas y glosario.
 * Texto plano, sin datos sensibles: el PIN técnico, las claves y las direcciones internas nunca van acá.
 */

/** Versión de NEX TV que describe la guía y nombre del kit publicado en /downloads/. */
export const GUIDE_VERSION = '2.1.1';
export const KIT_PATH = `/downloads/kit-instalacion-${GUIDE_VERSION}.zip`;

/** Minúsculas y sin tildes, para que "vinculacion" encuentre "vinculación". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Todas las palabras de la búsqueda tienen que aparecer en el texto (en cualquier orden). */
export function matches(text: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(text);
  return words.every((w) => hay.includes(w));
}

export interface Problem {
  /** Dónde aparece: agrupa la tabla. */
  area: 'Instalación' | 'Vinculación' | 'En la casa del cliente' | 'Panel';
  symptom: string;
  cause: string;
  fix: string;
}

export const PROBLEMS: Problem[] = [
  {
    area: 'Instalación',
    symptom: 'El script dice "No responde por ADB".',
    cause: 'El box y la computadora no están en la misma red, la IP o el puerto están mal, o la Depuración USB está apagada.',
    fix: 'Revisá la IP en los ajustes de red del box. Probá el puerto 3222 y después el 5555. Si el ADB quedó apagado por una instalación anterior, abrilo desde Acceso técnico (ver "Volver a entrar").',
  },
  {
    area: 'Instalación',
    symptom: '"adb devices" muestra el equipo como "unauthorized".',
    cause: 'El box está esperando que aceptes la conexión.',
    fix: 'Mirá la TV: aparece un cartel para permitir la depuración. Aceptalo con el control y volvé a correr el paso.',
  },
  {
    area: 'Instalación',
    symptom: 'install-system se detiene con "Firmware cerrado (ro.debuggable=0)".',
    cause: 'Ese firmware no deja escribir en el sistema. No es el firmware de prueba para el que está hecho el kit.',
    fix: 'No insistas con ese paso. Avisale a NEX el modelo y la compilación del box: hay que ver si se puede instalar sin el paso de sistema o si lo tiene que integrar el proveedor.',
  },
  {
    area: 'Instalación',
    symptom: 'blindar-box dice que lo que escucha en el puerto 40000 es "un programa compartido del sistema" o que "ningún servicio de init lo arranca".',
    cause: 'La puerta trasera de ese firmware está armada distinto a la del TX6698 conocido. El script no toca nada que no pueda identificar con seguridad.',
    fix: 'No se cambió nada en el box. No lo entregues: necesita la reparación completa del firmware. Mandale a NEX la salida completa del script.',
  },
  {
    area: 'Instalación',
    symptom: 'blindar-box avisa "sin adb root, su se deja como está".',
    cause: 'El firmware no permite que el técnico tenga root por ADB. Si se le sacara el root a su, nadie podría volver a instalar NEX en ese equipo.',
    fix: 'El puerto 40000 igual queda cerrado. El panel va a seguir mostrando root en el equipo como dato. Avisale a NEX qué modelo y firmware es.',
  },
  {
    area: 'Instalación',
    symptom: 'install-system o grabar-logo dicen "su no da root" en un box que ya pasó por blindar-box.',
    cause: 'Es lo esperado: el blindaje le sacó el root a su para que ninguna app lo use.',
    fix: 'install-system entra solo con el root del técnico por ADB. grabar-logo no: si hace falta el logo, primero ./restaurar-blindaje.sh, grabá el logo y volvé a blindar.',
  },
  {
    area: 'Instalación',
    symptom: 'install-system o grabar-logo dicen "su no da root en este equipo".',
    cause: 'El firmware no trae acceso de administrador (root).',
    fix: 'Igual que el caso anterior: sin root no se puede copiar NEX al sistema ni grabar el logo. Consultá a NEX antes de seguir.',
  },
  {
    area: 'Instalación',
    symptom: '"Falló la copia al sistema: el equipo NO se reinicia".',
    cause: 'No se pudo escribir en la partición del sistema (sin espacio, o protegida contra escritura).',
    fix: 'El equipo queda como estaba. Copiá el error completo que muestra la pantalla y mandáselo a NEX. No reinicies ni repitas a ciegas.',
  },
  {
    area: 'Instalación',
    symptom: '"El equipo no volvió en 5 minutos" después de reiniciar.',
    cause: 'El box tarda en arrancar, cambió de IP al reiniciar o no arranca.',
    fix: 'Mirá la TV. Si arrancó, revisá si cambió la IP y corré de nuevo el paso 1 (no hace daño repetirlo). Si se queda en el logo más de 10 minutos, hay que regrabar el firmware original con HiTool.',
  },
  {
    area: 'Instalación',
    symptom: 'La verificación marca "falta el permiso…" o "NEX no es app privilegiada".',
    cause: 'El firmware no le dio a NEX los permisos de app de sistema.',
    fix: 'No sigas con los pasos siguientes. Sin esos permisos NEX no se actualiza sola ni instala las apps del operador. Mandale a NEX la salida completa.',
  },
  {
    area: 'Instalación',
    symptom: 'install-box dice "No se pudo instalar (¿APK firmado con otra clave?)".',
    cause: 'El box ya tiene una versión de NEX TV firmada con otra clave (una versión de prueba) o el APK no es el oficial.',
    fix: 'Usá solo el nex-tv.apk del kit o el que se descarga de este panel. Si el box tenía una versión de prueba, consultá a NEX cómo quitarla.',
  },
  {
    area: 'Instalación',
    symptom: 'install-box termina con "ADB queda ABIERTO: hay verificaciones que fallaron".',
    cause: 'Alguna comprobación dio ✗ (por ejemplo, quedó una app de publicidad activa o la zona horaria no se aplicó).',
    fix: 'Leé qué línea tiene la ✗ y volvé a correr el paso 4 (install-box): se puede repetir las veces que haga falta. Si la misma línea falla dos veces, mandale la salida a NEX. El ADB queda abierto a propósito para que puedas corregir.',
  },
  {
    area: 'Instalación',
    symptom: 'install-box avisa "hay cuentas cargadas: quitarlas y volver a correr el script".',
    cause: 'El firmware permite que NEX sea dueño del equipo, pero Android lo rechaza si hay una cuenta de Google iniciada.',
    fix: 'Quitá las cuentas (o hacé un reset de fábrica sin iniciar sesión en Google) y corré el paso 4 (install-box) otra vez. La cuenta se puede volver a cargar después.',
  },
  {
    area: 'Instalación',
    symptom: 'grabar-logo dice "La imagen no mide lo mismo que la partición" o "no tiene un logo de HiSilicon".',
    cause: 'El logo del kit es para el TX6698. Ese box es otro modelo o trae otra distribución de memoria.',
    fix: 'No se grabó nada, el equipo está intacto. Salteá el paso del logo (es opcional) y avisale a NEX el modelo.',
  },
  {
    area: 'Instalación',
    symptom: 'grabar-logo dice "La partición no quedó igual a la imagen".',
    cause: 'La grabación se cortó o falló.',
    fix: 'No apagues el box. El script te muestra el comando para volver a grabar la copia de respaldo que guardó en la carpeta del kit: correlo tal cual. Si vuelve a fallar, avisale a NEX antes de reiniciar.',
  },
  {
    area: 'Instalación',
    symptom: 'En Windows: "command not found" o "Permission denied" al correr un script.',
    cause: 'Estás en PowerShell en vez de Ubuntu (WSL), o no entraste a la carpeta del kit.',
    fix: 'Abrí Ubuntu desde el menú Inicio, entrá a la carpeta con "cd ~/kit-instalacion-2.1.1" y corré el comando empezando con "./".',
  },
  {
    area: 'Vinculación',
    symptom: 'El panel dice "Código inválido o vencido".',
    cause: 'El código dura 15 minutos y la TV lo cambia sola. O hay una letra mal escrita.',
    fix: 'Mirá de nuevo la TV y cargá el código que muestra ahora. Con el celular es más rápido: escaneá el QR con el panel ya abierto.',
  },
  {
    area: 'Vinculación',
    symptom: 'La TV queda en "Iniciando" o no muestra ningún código.',
    cause: 'El box no tiene internet o tiene mal la fecha y la hora.',
    fix: 'Conectalo por cable o entrá a la red Wi-Fi desde la pantalla de NEX. Esperá un minuto. Si sigue igual, reiniciá el box.',
  },
  {
    area: 'Vinculación',
    symptom: 'Después de un reset de fábrica el box vuelve a pedir que lo vinculen.',
    cause: 'El reset borra los datos de NEX (la vinculación), pero NEX sigue instalada porque está en el sistema.',
    fix: 'Es lo esperado. Vinculalo de nuevo desde Equipos → Vincular equipo. Mientras no esté vinculado solo se puede usar NEX.',
  },
  {
    area: 'En la casa del cliente',
    symptom: 'No puedo entrar por ADB a un box ya instalado.',
    cause: 'El último paso de la instalación apaga el ADB a propósito, para que nadie entre por la red.',
    fix: 'En la TV: Ajustes → Acceso técnico → PIN → Abrir Ajustes de Android → Opciones de desarrollador → Depuración USB. Ver "Volver a entrar".',
  },
  {
    area: 'En la casa del cliente',
    symptom: 'El PIN técnico no funciona.',
    cause: 'Se está usando el PIN de otra versión o está mal cargado.',
    fix: 'El PIN es el que te pasó NEX para esta versión. No lo pruebes muchas veces ni lo compartas con el cliente: pedíselo de nuevo a NEX.',
  },
  {
    area: 'En la casa del cliente',
    symptom: 'No aparecen las "Opciones de desarrollador" en los Ajustes de Android.',
    cause: 'Vienen ocultas hasta que se activan la primera vez.',
    fix: 'Preferencias del dispositivo → Información → apretá OK 7 veces sobre "Compilación". Volvé atrás: ahora aparecen.',
  },
  {
    area: 'En la casa del cliente',
    symptom: 'Los Ajustes de Android se cierran solos y vuelve NEX.',
    cause: 'El acceso técnico dura 10 minutos. Después la protección vuelve a cerrar todo.',
    fix: 'Entrá de nuevo con el PIN. Tené a mano lo que vas a cambiar para hacerlo dentro de los 10 minutos.',
  },
  {
    area: 'En la casa del cliente',
    symptom: 'El cliente no puede instalar una app: el mosaico "Instalar" abre la Play Store y pide iniciar sesión.',
    cause: 'La Play Store necesita una cuenta de Google en el equipo.',
    fix: 'Que el cliente inicie sesión con su cuenta de Google y toque Instalar en la ficha. Es un paso que Android exige y NEX no puede saltear.',
  },
  {
    area: 'En la casa del cliente',
    symptom: 'Una app del operador (subida como APK) no aparece en la TV.',
    cause: 'El box está sin conexión, sin espacio, o la descarga falló. NEX reintenta cada 6 horas.',
    fix: 'Abrí el equipo en el panel → Historial: si dice "No se pudo instalar una app del operador", revisá conexión y almacenamiento (pestaña Salud y red).',
  },
  {
    area: 'En la casa del cliente',
    symptom: 'El cliente pagó pero la TV sigue bloqueada.',
    cause: 'El pago no está registrado en el panel, o el box no tiene internet para enterarse.',
    fix: 'Registrá el pago en el equipo (Servicio → Registrar pago). Si el box no tiene conexión, generá un Código de desbloqueo y dictáselo al cliente.',
  },
  {
    area: 'En la casa del cliente',
    symptom: 'El código de desbloqueo no es aceptado.',
    cause: 'El código vale solo ese día y para ese equipo. O el box tiene mal la fecha.',
    fix: 'Generá uno nuevo desde el detalle de ese equipo (fijate que sea el equipo correcto). Después de 5 intentos fallidos hay que esperar unos minutos.',
  },
  {
    area: 'En la casa del cliente',
    symptom: 'La TV no encuentra la red Wi-Fi del cliente.',
    cause: 'La red es oculta, está en un canal que el box no ve, o el router está lejos.',
    fix: 'Ajustes → Red Wi-Fi → "Buscar de nuevo". Si es oculta, usá "Otra red" y escribí el nombre igual que en el módem, respetando mayúsculas. Si la señal es débil, usá cable.',
  },
  {
    area: 'En la casa del cliente',
    symptom: 'Sigue apareciendo publicidad o apps raras después de instalar NEX.',
    cause: 'El firmware trae alguna app de publicidad que no está en la lista que NEX desactiva.',
    fix: 'Anotá el nombre de la app o sacale una foto a la pantalla y mandásela a NEX. Mirá también la sección "Equipo posiblemente infectado".',
  },
  {
    area: 'Panel',
    symptom: 'Bloqueé un equipo y la TV sigue funcionando.',
    cause: 'El cambio tarda hasta 1 minuto en llegar. Si el box está sin conexión, le llega cuando vuelve.',
    fix: 'Esperá un minuto y mirá el estado en el detalle: pasa de "Pendiente de aplicar" a "Bloqueo confirmado". Si figura sin conexión, revisá la red del cliente.',
  },
  {
    area: 'Panel',
    symptom: '"Diagnosticar red" no devuelve resultado.',
    cause: 'El equipo está sin conexión o apagado. O ya se pidieron 6 diagnósticos en la última hora.',
    fix: 'Verificá que figure "En línea". Si no responde, el problema ya es de conexión: revisá router y ONU en el domicilio.',
  },
  {
    area: 'Panel',
    symptom: 'Un equipo figura con salud en rojo.',
    cause: 'Algo le está restando puntos: sin conexión, calor, poco espacio, Wi-Fi débil, reinicios o una alerta de seguridad.',
    fix: 'Abrí el equipo → Salud y red → "Qué le baja el puntaje". Empezá por el motivo que más resta. Ver la tabla de la sección Salud.',
  },
  {
    area: 'Panel',
    symptom: 'Una zona figura "En caída".',
    cause: 'La mitad o más de los equipos de esa zona (mínimo 3) llevan más de 3 minutos sin reportarse.',
    fix: 'Casi siempre es un corte del nodo, la OLT o la energía en esa zona, no un problema de cada box. Revisá la red antes de mandar técnicos casa por casa.',
  },
  {
    area: 'Panel',
    symptom: 'Envié un comunicado con un error.',
    cause: 'Los comunicados enviados no se pueden editar.',
    fix: 'Cancelalo desde Comunicados y mandá uno nuevo corregido.',
  },
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Cuánto tarda instalar un box?',
    a: 'Entre 5 y 10 minutos con todo preparado: unos 2 minutos el paso de sistema (incluye un reinicio), menos de 1 minuto el logo, 1 minuto la instalación final y 1 minuto la vinculación.',
  },
  {
    q: '¿Puedo repetir un paso si algo salió mal?',
    a: 'Sí. Los scripts se pueden volver a correr sin riesgo: revisan el equipo antes de tocar nada y, si ya estaba hecho, lo dejan igual. Lo único que no podés repetir sin abrir de nuevo el ADB es el paso 4 (install-box), porque al terminar bien lo apaga.',
  },
  {
    q: '¿Puedo probar antes sin cambiar nada?',
    a: 'Sí. Agregá --dry-run al final de cualquiera de los tres comandos: muestra qué haría sin tocar el equipo.',
  },
  {
    q: '¿Qué pasa si el cliente resetea el box de fábrica?',
    a: 'NEX sigue instalada porque está en el sistema. El box vuelve a la pantalla de vinculación y al arrancar se protege solo otra vez (desactiva la publicidad de fábrica y el otro inicio). Hasta que lo vincules de nuevo solo se puede usar NEX. El reset con el botón físico no se puede impedir.',
  },
  {
    q: '¿Hace falta resetear el box antes de instalar?',
    a: 'En el TX6698 no es obligatorio. Es recomendable en un box usado, para entregarlo limpio. Sí es obligatorio quitar las cuentas de Google cuando el script avisa "hay cuentas cargadas".',
  },
  {
    q: '¿El cliente puede usar la Play Store?',
    a: 'Sí. La Play Store queda libre: lo que instala aparece solo en el inicio de NEX. Lo que no se puede es instalar archivos APK sueltos (por ejemplo apps de TV pirata), salvo los que sube tu empresa desde el panel.',
  },
  {
    q: '¿Por qué Netflix o Disney+ no aparecen como apps web?',
    a: 'En los TV box Android cada servicio se usa con su app Android (desde la Play Store o como app del operador). Las apps web del catálogo son para los equipos NEX-OS con Linux.',
  },
  {
    q: '¿Se puede bloquear un equipo que está sin internet?',
    a: 'La orden queda pendiente y se aplica cuando el box se conecta. Además, tu empresa puede configurar en Marca y cobro que un equipo que pasa muchos días sin conectarse se bloquee solo.',
  },
  {
    q: '¿El bloqueo deja al cliente sin Wi-Fi?',
    a: 'No. La red nunca se bloquea: el box necesita internet para enterarse del pago y desbloquearse. En la pantalla de bloqueo el cliente puede cambiar la red Wi-Fi.',
  },
  {
    q: '¿Quién publica las actualizaciones de NEX TV?',
    a: 'NEX. Los box las descargan e instalan solos, sin que el cliente haga nada. Vos solo tenés que verificar la versión si un equipo se comporta raro.',
  },
  {
    q: '¿Sirve el kit para otro modelo de box?',
    a: 'El kit 2.1.1 es para el TX6698 (HiSilicon, Android 9). Los scripts revisan el equipo y se detienen si algo no coincide, pero no lo uses en otro modelo sin consultarlo con NEX: el paso de sistema y el del logo escriben en la memoria del box.',
  },
  {
    q: '¿Qué hago si el box no arranca más?',
    a: 'Se regraba el firmware original con HiTool desde una PC con Windows. Por eso hay que tener siempre a mano el firmware original del modelo. Después de regrabar, se instala NEX de nuevo desde el paso 1.',
  },
  {
    q: '¿Puedo darle el PIN técnico al cliente?',
    a: 'No. El PIN abre los Ajustes de Android y permite volver a encender el ADB. Es el mismo para todos los equipos de una versión: si se filtra, avisale a NEX.',
  },
  {
    q: '¿Dónde veo qué hizo cada persona en el panel?',
    a: 'En Auditoría (grupo Acceso). Cada bloqueo, pago, código de desbloqueo y comunicado queda registrado con quién y cuándo.',
  },
];

export const GLOSSARY: { term: string; def: string }[] = [
  { term: 'ADB', def: 'Conexión de servicio de Android. Permite que una computadora le dé órdenes al box por la red o por USB. Se enciende con "Depuración USB".' },
  { term: 'APK', def: 'Archivo instalador de una app Android. NEX TV se instala con nex-tv.apk.' },
  { term: 'Kit de instalación', def: 'Carpeta con los tres scripts, el APK y el logo. Se descarga de esta guía.' },
  { term: 'Script', def: 'Archivo con una lista de órdenes que la computadora ejecuta sola. En el kit terminan en .sh.' },
  { term: 'Firmware', def: 'El sistema que trae grabado el box (Android y todo lo de fábrica).' },
  { term: 'HiTool', def: 'Programa de HiSilicon para Windows que regraba el firmware completo de un box. Se usa para recuperar un equipo que no arranca.' },
  { term: 'Root / su', def: 'Acceso de administrador total al sistema del box. El kit lo necesita para copiar NEX al sistema. En manos de otro es un riesgo.' },
  { term: 'App de sistema', def: 'App que vive en la parte del box que un reset de fábrica no borra. Así queda NEX después del paso 1.' },
  { term: 'Guard (protección de NEX)', def: 'Servicio de NEX que vuelve al inicio si alguien abre algo no permitido (Ajustes de Android, otro inicio).' },
  { term: 'Dueño del equipo (Device Owner)', def: 'Modo de Android en el que NEX administra el box por completo. Solo algunos firmwares lo permiten. Si no, protege Guard.' },
  { term: 'Vincular', def: 'Asociar un box a tu empresa con el código o el QR que muestra la TV. Desde ahí aparece en Equipos.' },
  { term: 'Sincronizar (sync)', def: 'El box consulta al servidor de NEX más o menos una vez por minuto: informa cómo está y recibe los cambios.' },
  { term: 'OTA', def: 'Actualización que llega por internet y se instala sola.' },
  { term: 'Restringido', def: 'Estado intermedio: el cliente ve el menú y la pantalla de pago, pero no puede abrir las apps.' },
  { term: 'Código de desbloqueo', def: 'Número de 8 dígitos que el panel genera para un equipo. Sirve ese día y desbloquea sin internet por un tiempo limitado.' },
  { term: 'Zona', def: 'Grupo de equipos por localidad, nodo u OLT. Sirve para mandar comunicados a una parte y para detectar caídas masivas.' },
  { term: 'Gateway / router / ONU', def: 'El equipo de la casa que conecta el box con internet. El diagnóstico mide ese primer tramo por separado.' },
  { term: 'dBm (señal Wi-Fi)', def: 'Medida de la señal. Más cerca de cero es mejor: -50 es excelente, -70 es débil, -80 o menos es muy débil.' },
  { term: 'Puertas de fábrica', def: 'Accesos remotos que algunos box traen abiertos de fábrica (un puerto de control o ADB por red) y apps del fabricante que reciben órdenes a distancia. Son la vía por la que se infectan.' },
  { term: '2FA', def: 'Verificación en dos pasos del panel: además de la contraseña pide un código del celular.' },
];
