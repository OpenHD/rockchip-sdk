import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

/** Botón dentro del aviso (ej. "Deshacer"). Al tocarlo el aviso se cierra. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastApi {
  show: (message: string, tone?: ToastTone, action?: ToastAction) => void;
}

export const ToastContext = createContext<ToastApi>({ show: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
