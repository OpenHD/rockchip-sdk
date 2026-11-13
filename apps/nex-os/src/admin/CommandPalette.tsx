import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, Ban, CircleCheck, CornerDownLeft, CreditCard, Filter as FilterIcon, KeyRound, Lock, LockOpen, Search, Tv, X, type LucideIcon } from 'lucide-react';
import { deviceStatus, isOnline, type Company, type Device } from './api';
import { STATUS_META } from './deviceMeta';
import { useLayer } from './layer';
import { searchPalette, type DeviceAction, type PaletteEntry, type PaletteResult } from './search';
import { Badge, StatusDot } from './ui';

const DEVICE_ACTION_META: Record<DeviceAction, { icon: LucideIcon; label: (name: string) => string }> = {
  pay: { icon: CreditCard, label: (n) => `Registrar pago a ${n}` },
  lock: { icon: Lock, label: (n) => `Bloquear ${n}` },
  unlock: { icon: LockOpen, label: (n) => `Desbloquear ${n}` },
  restrict: { icon: Ban, label: (n) => `Restringir ${n}` },
  unrestrict: { icon: CircleCheck, label: (n) => `Quitar la restricción a ${n}` },
  code: { icon: KeyRound, label: (n) => `Código de desbloqueo para ${n}` },
};

export interface PaletteEntryView extends PaletteEntry {
  icon: LucideIcon;
}

const GROUP_LABEL: Record<string, string> = {
  device: 'Equipos',
  recent: 'Abiertos hace poco',
  'device-action': 'Acciones rápidas',
  action: 'Acciones',
  filter: 'Ver equipos',
  section: 'Ir a',
};

const deviceName = (d: Pick<Device, 'id' | 'name'>) => d.name ?? `Equipo ${d.id.slice(0, 8)}`;

/**
 * Buscador global (Ctrl/⌘ K o "/"): encuentra un equipo por nombre, n.º de cliente o ID, ofrece las acciones más comunes
 * sobre ese equipo y lleva a cualquier sección. Todo con teclado: flechas para moverse, Enter para elegir, Esc para cerrar.
 */
export default function CommandPalette({ company, devices, actions, sections, filters, recents, onRun, onClose }: {
  company: Company;
  /** null mientras cargan los equipos. */
  devices: readonly Device[] | null;
  actions: readonly PaletteEntryView[];
  sections: readonly PaletteEntryView[];
  filters: readonly PaletteEntryView[];
  recents: readonly string[];
  onRun: (result: PaletteResult) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  useLayer(ref, onClose);

  const byId = useMemo(() => new Map((devices ?? []).map((d) => [d.id, d])), [devices]);
  const icons = useMemo(() => new Map([...actions, ...sections, ...filters].map((e) => [e.id, e.icon])), [actions, sections, filters]);
  const results = useMemo(
    () => searchPalette(query, { devices: devices ?? [], actions, sections, filters, recents }),
    [query, devices, actions, sections, filters, recents],
  );
  const current = Math.min(active, Math.max(0, results.length - 1));
  const optionId = (i: number) => `${listId}-o${i}`;

  useEffect(() => {
    document.getElementById(`${listId}-o${current}`)?.scrollIntoView({ block: 'nearest' });
  }, [current, listId]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length) setActive((current + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
    } else if (e.key === 'Enter' && results[current]) {
      e.preventDefault();
      onRun(results[current]);
    }
  };

  const groupOf = (r: PaletteResult) => (r.kind === 'entry' ? r.group : r.kind === 'device' && !query.trim() ? 'recent' : r.kind);

  return (
    <div className="fixed inset-0 z-50 flex animate-[nexFade_.12s_ease-out] items-start justify-center bg-scrim sm:px-4 sm:pt-[12vh]" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        data-palette
        aria-label="Buscar equipos y acciones"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[100dvh] w-full max-w-xl animate-[nexIn_.14s_ease-out] flex-col overflow-hidden border-line bg-overlay shadow-pop outline-none border-b sm:max-h-[70vh] sm:rounded-2xl sm:border"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-line pl-4 pr-2">
          <Search className="h-4 w-4 shrink-0 text-fg-4" aria-hidden />
          <input
            autoFocus
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results.length ? optionId(current) : undefined}
            aria-autocomplete="list"
            aria-label="Buscar un equipo, una acción o una sección"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Nombre, n.º de cliente o qué querés hacer…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-fg-4"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <button type="button" aria-label="Cerrar el buscador" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-fg-3 transition hover:bg-fill-2 hover:text-fg">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div id={listId} role="listbox" aria-label="Resultados" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm leading-relaxed text-fg-3">
              {devices === null ? 'Cargando los equipos…' : <>Nada coincide con «{query.trim()}».<br />Probá con el nombre del cliente, el n.º de cliente o las primeras letras del ID.</>}
            </p>
          )}
          {results.map((r, i) => {
            const group = groupOf(r);
            const header = i === 0 || groupOf(results[i - 1]) !== group;
            const selected = i === current;
            const device = r.kind === 'entry' ? undefined : byId.get(r.device.id);
            const Icon = r.kind === 'entry' ? icons.get(r.entry.id) ?? ArrowRight : r.kind === 'device-action' ? DEVICE_ACTION_META[r.action].icon : Tv;
            const status = r.kind === 'device' && device ? STATUS_META[deviceStatus(device, company)] : null;
            return (
              <div key={r.key} role="presentation">
                {header && <div role="presentation" className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-4">{GROUP_LABEL[group]}</div>}
                <div
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => !selected && setActive(i)}
                  onClick={() => onRun(r)}
                  className={`flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 ${selected ? 'bg-accent-soft' : ''}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-accent-soft text-accent' : 'bg-fill-2 text-fg-3'}`}>
                    {r.kind === 'entry' && r.group === 'filter' ? <FilterIcon className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">
                      {r.kind === 'entry' ? r.entry.label : r.kind === 'device' ? deviceName(r.device) : DEVICE_ACTION_META[r.action].label(deviceName(r.device))}
                    </span>
                    {r.kind === 'device' && (
                      <span className="flex items-center gap-1.5 truncate text-xs text-fg-4">
                        {device && <StatusDot online={isOnline(device)} />}
                        <span className="truncate font-mono">{[r.device.external_ref, r.device.id.slice(0, 8)].filter(Boolean).join(' · ')}</span>
                      </span>
                    )}
                  </span>
                  {status && <span className="shrink-0"><Badge tone={status.tone} icon={status.icon}>{status.label}</Badge></span>}
                  {selected && <CornerDownLeft className="hidden h-3.5 w-3.5 shrink-0 text-fg-4 sm:block" aria-hidden />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden shrink-0 items-center gap-4 border-t border-line bg-fill px-4 py-2 text-xs text-fg-4 sm:flex" aria-hidden>
          <span><kbd className="nx-kbd">↑</kbd> <kbd className="nx-kbd">↓</kbd> moverse</span>
          <span><kbd className="nx-kbd">Enter</kbd> elegir</span>
          <span><kbd className="nx-kbd">Esc</kbd> cerrar</span>
          <span className="ml-auto">Probá «pago pérez» o «bloquear 123»</span>
        </div>
      </div>
    </div>
  );
}
