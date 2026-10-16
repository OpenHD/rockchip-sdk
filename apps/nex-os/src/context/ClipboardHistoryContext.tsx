import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type ClipboardItem = {
  id: string;
  kind: 'text' | 'image';
  text?: string;
  imageUrl?: string;
  createdAt: number;
};

type ClipboardHistoryContextType = {
  items: ClipboardItem[];
  isOpen: boolean;
  openHistory: () => void;
  closeHistory: () => void;
  toggleHistory: () => void;
  pushText: (text: string) => void;
  pushImage: (dataUrl: string) => void;
  pasteItem: (id: string) => Promise<void>;
  clearHistory: () => void;
};

const KEY = 'win11_clipboard_history';
const MAX = 25;

const ClipboardHistoryContext = createContext<ClipboardHistoryContextType | undefined>(undefined);

function loadItems(): ClipboardItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClipboardItem[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export const ClipboardHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ClipboardItem[]>(() => loadItems());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  }, [items]);

  const pushText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setItems((prev) => {
      if (prev[0]?.kind === 'text' && prev[0].text === trimmed) return prev;
      const item: ClipboardItem = {
        id: crypto.randomUUID(),
        kind: 'text',
        text: trimmed,
        createdAt: Date.now(),
      };
      return [item, ...prev.filter((i) => !(i.kind === 'text' && i.text === trimmed))].slice(0, MAX);
    });
  }, []);

  const pushImage = useCallback((dataUrl: string) => {
    if (!dataUrl.startsWith('data:image')) return;
    const item: ClipboardItem = {
      id: crypto.randomUUID(),
      kind: 'image',
      imageUrl: dataUrl,
      createdAt: Date.now(),
    };
    setItems((prev) => [item, ...prev].slice(0, MAX));
  }, []);

  // Capture system copy events inside NEX OS
  useEffect(() => {
    const onCopy = () => {
      const sel = window.getSelection()?.toString();
      if (sel) pushText(sel);
    };
    const onCut = () => {
      const sel = window.getSelection()?.toString();
      if (sel) pushText(sel);
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
    };
  }, [pushText]);

  // Ctrl+Alt+V — Win+V lo captura Windows; no tocar Ctrl+V (pegar)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && !e.metaKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setIsOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pasteItem = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    try {
      if (item.kind === 'text' && item.text) {
        await navigator.clipboard.writeText(item.text);
        // Try to insert into focused editable
        const el = document.activeElement as HTMLElement | null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
          document.execCommand('insertText', false, item.text);
        }
      } else if (item.kind === 'image' && item.imageUrl) {
        const blob = await (await fetch(item.imageUrl)).blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
      }
    } catch {
      /* clipboard permissions */
    }
    setIsOpen(false);
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      isOpen,
      openHistory: () => setIsOpen(true),
      closeHistory: () => setIsOpen(false),
      toggleHistory: () => setIsOpen((o) => !o),
      pushText,
      pushImage,
      pasteItem,
      clearHistory: () => setItems([]),
    }),
    [items, isOpen, pushText, pushImage, pasteItem],
  );

  return (
    <ClipboardHistoryContext.Provider value={value}>
      {children}
    </ClipboardHistoryContext.Provider>
  );
};

export const useClipboardHistory = () => {
  const ctx = useContext(ClipboardHistoryContext);
  if (!ctx) throw new Error('useClipboardHistory must be used within ClipboardHistoryProvider');
  return ctx;
};
