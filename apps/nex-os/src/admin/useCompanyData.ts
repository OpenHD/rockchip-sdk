import { useCallback, useEffect, useState } from 'react';
import { db, DEVICE_COLUMNS, run, type Device, type DeviceEvent } from './api';
import { healthScore, type HealthInputs, type HealthScore } from './health';

const POLL_MS = 20_000;

/** Equipos, eventos (7 días) y salud de una empresa, compartidos entre Resumen, Equipos y el detalle. */
export function useCompanyData(companyId: string) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [health, setHealth] = useState<ReadonlyMap<string, HealthScore>>(new Map());
  const [healthInputs, setHealthInputs] = useState<ReadonlyMap<string, HealthInputs>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    Promise.all([
      run<Device[]>(db().from('mdm_devices').select(DEVICE_COLUMNS).eq('company_id', companyId).order('name')),
      run<DeviceEvent[]>(
        db()
          .from('mdm_device_events')
          .select('id, device_id, kind, category, severity, details, created_at')
          .eq('company_id', companyId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(300),
      ),
      // La salud es un extra: si falla, el listado de equipos sigue andando y el puntaje sale solo de lo que informa el equipo.
      run<HealthInputs[]>(db().rpc('mdm_device_health_inputs', { p_company: companyId })).catch(() => [] as HealthInputs[]),
    ]).then(
      ([d, e, inputs]) => {
        if (cancelled) return;
        const byDevice = new Map((inputs ?? []).map((i) => [i.device_id, i]));
        const now = Date.now();
        setDevices(d);
        setEvents(e);
        setHealthInputs(byDevice);
        setHealth(new Map(d.map((dev) => [dev.id, healthScore(dev, byDevice.get(dev.id), now)])));
        setError(null);
        setLoadedAt(now);
      },
      (err: Error) => !cancelled && setError(err.message),
    );
    const timer = setTimeout(() => setTick((t) => t + 1), POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companyId, tick]);

  return { devices, events, health, healthInputs, error, loadedAt, reload };
}

export type CompanyData = ReturnType<typeof useCompanyData>;
