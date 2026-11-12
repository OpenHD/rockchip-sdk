-- NEX MDM v13: alertas de equipo comprometido en firmware de fábrica.
--
-- CureBox (macch-ai/curebox) documentó que los TV box HiSilicon "bigfish" del incidente de CAPPI subían 40-100 Mbps
-- sin uso y traían de fábrica un shell root remoto (cmd_root, TCP/40000), ADB por red (TCP/5555), su con setuid y
-- apps que ejecutan o instalan a distancia. NEX TV (agente 3, FactoryRisk.kt) informa:
-- * upload_anomaly: más de 5 Mbps de subida sin contar a NEX durante 15 min (uno cada 6 h);
-- * factory_backdoor: las puertas de fábrica que encontró abiertas, cuando cambian.
-- Los dos van a la categoría 'tamper', así que llegan por Telegram/mail a las empresas que tienen activadas las alertas
-- de manipulación. El detalle (health.up_mbps, health.factory) ya viaja en health desde v12; no hay cambios de tablas.
-- Idempotente.

create or replace function public._mdm_event_meta(p_kind text, out category text, out severity text, out label text)
language sql
immutable
as $$
  select m.category, m.severity, m.label
    from (values
      ('lock_applied',        'lock_applied',   'info',     'Bloqueo aplicado en el equipo'),
      ('unlock_applied',      'unlock_applied', 'info',     'Desbloqueo aplicado en el equipo'),
      ('clock_rollback',      'tamper',         'critical', 'Reloj del equipo atrasado (posible intento de evitar el bloqueo)'),
      ('policy_tampered',     'tamper',         'critical', 'Política de navegación modificada fuera del agente'),
      ('agent_restarted',     'tamper',         'warning',  'El agente se reinició sin reiniciar el equipo'),
      ('image_not_hardened',  'tamper',         'critical', 'El equipo corre una imagen sin modo TV cerrado'),
      ('dns_filter_down',     'tamper',         'warning',  'Filtro DNS caído: solo queda el filtro de Chromium'),
      ('firewall_unavailable','tamper',         'warning',  'Firewall no disponible: el filtro DNS se puede esquivar'),
      ('reflashed',           'tamper',         'critical', 'Equipo reinstalado o reseteado: se volvió a vincular solo'),
      ('offline',             'offline',        'warning',  'Equipo sin conexión'),
      ('back_online',         'offline',        'info',     'Equipo de nuevo en línea'),
      ('piracy_attempt',      'piracy',         'warning',  'Intento de abrir un sitio pirata'),
      ('agent_started',       'info',           'info',     'Equipo encendido'),
      ('test',                'test',           'info',     'Aviso de prueba'),
      -- v12: NEX TV Android
      ('update_started',      'info',           'info',     'Actualización de NEX TV en curso'),
      ('update_installed',    'info',           'info',     'NEX TV actualizado'),
      ('update_failed',       'info',           'warning',  'Falló la actualización de NEX TV'),
      ('update_rejected',     'info',           'warning',  'Actualización de NEX TV rechazada (no pasó la verificación)'),
      ('app_installed',       'info',           'info',     'App del operador instalada'),
      ('app_install_failed',  'info',           'warning',  'No se pudo instalar una app del operador'),
      ('app_removed',         'info',           'info',     'App del operador desinstalada'),
      -- v13: firmas del incidente de CAPPI en firmware de fábrica (ver FactoryRisk.kt y macch-ai/curebox)
      ('upload_anomaly',      'tamper',         'critical', 'Subida alta sin uso: posible equipo infectado (botnet)'),
      ('factory_backdoor',    'tamper',         'warning',  'Puertas traseras de fábrica abiertas (shell root, ADB por red o apps de control remoto)')
    ) as m(kind, category, severity, label)
   where m.kind = p_kind;
$$;
