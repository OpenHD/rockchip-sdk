import { useCallback, useEffect, useState } from 'react';
import { db, DEVICE_COLUMNS, run, type Device, type DeviceEvent } from './api';

const POLL_MS = 20_000;

/** Equipos y eventos (7 días) de una empresa, compartidos entre Resumen, Equipos y el detalle. */
export function useCompanyData(companyId: string) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
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
    ]).then(
      ([d, e]) => {
        if (cancelled) return;
        setDevices(d);
        setEvents(e);
        setError(null);
        setLoadedAt(Date.now());
      },
      (err: Error) => !cancelled && setError(err.message),
    );
    const timer = setTimeout(() => setTick((t) => t + 1), POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companyId, tick]);

  return { devices, events, error, loadedAt, reload };
}

export type CompanyData = ReturnType<typeof useCompanyData>;
