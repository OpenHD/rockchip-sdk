import { useEffect, useState } from 'react';

const MOBILE_BP = 768;

function readIsMobile(breakpoint: number) {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
}

/** Phone / small-device shell: narrow viewport or landscape phone. */
export function computeIsPhone() {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = w <= MOBILE_BP;
  const phoneLandscape = coarse && Math.min(w, h) <= 500;
  return narrow || phoneLandscape;
}

export function useIsMobile(breakpoint = MOBILE_BP) {
  const [isMobile, setIsMobile] = useState(() => readIsMobile(breakpoint));

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}

export function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() => computeIsPhone());

  useEffect(() => {
    const update = () => setIsPhone(computeIsPhone());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const coarse = window.matchMedia('(pointer: coarse)');
    coarse.addEventListener('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      coarse.removeEventListener('change', update);
    };
  }, []);

  return isPhone;
}

/** Marks <html>/<body> so global CSS can switch to the phone OS chrome. */
export function useNexPhoneShell() {
  const isPhone = useIsPhone();

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.toggle('nex-phone', isPhone);
    body.classList.toggle('nex-phone', isPhone);
    return () => {
      root.classList.remove('nex-phone');
      body.classList.remove('nex-phone');
    };
  }, [isPhone]);

  return isPhone;
}

export function useIsStandalonePwa() {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
  }, []);

  return standalone;
}

/** Bloquea scroll del body cuando el menú lateral está abierto en móvil. */
export function useMobileScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

/** Botón atrás del celular cierra el menú lateral. */
export function useSidebarBackClose(sidebarOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!sidebarOpen) return;

    window.history.pushState({ nexMusicMenu: true }, '');
    const onPopState = () => onClose();

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [sidebarOpen, onClose]);
}

export function closeSidebarWithHistory(onClose: () => void) {
  onClose();
  if (window.history.state?.nexMusicMenu) {
    window.history.back();
  }
}

export function exitMobileApp(onFallback?: () => void) {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.close();

  // window.close() no hace nada en pestañas normales
  onFallback?.();
}
