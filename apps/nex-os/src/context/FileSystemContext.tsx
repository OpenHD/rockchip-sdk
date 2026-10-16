import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { genId } from '../utils/id';
import { createNexFs, type NexFs } from '../runtime/fs';
import type { VfsBridge } from '../runtime/fs/vfsBridge';

export interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'drive';
  ext?: string;
  size?: string;
  modified: string;
  imageUrl?: string;
  capacity?: string;
  used?: string;
  parentId: string | null;
  content?: string;
  /** For .nex executables: which app to open and optional args */
  nexPayload?: { appId: string; title: string; args?: string[] };
  /** Special folder types for visual distinctions */
  folderType?: 'node_modules' | 'program_files' | 'normal';
}

interface FileSystemContextType {
  files: FileItem[];
  createFolder: (parentId: string, name: string) => void;
  createFile: (parentId: string, name: string, ext: string) => string;
  updateFileContent: (id: string, content: string) => void;
  deleteItem: (id: string) => void;
  renameItem: (id: string, newName: string) => void;
  copyItem: (id: string) => void;
  cutItem: (id: string) => void;
  /** Returns the pasted item id (new copy or moved), or null if clipboard empty. */
  pasteItem: (targetParentId: string) => string | null;
  clipboard: { id: string; type: 'copy' | 'cut' } | null;
  /** Path-based FS (IndexedDB blobs + VFS metadata). */
  nexFs: NexFs;
  setFiles: React.Dispatch<React.SetStateAction<FileItem[]>>;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

const INITIAL_FILES: FileItem[] = [
  { id: 'c-drive', name: 'Disco local (C:)', type: 'drive', capacity: '512', used: '245', modified: '10/01/2026', parentId: null },
  { id: 'desktop', name: 'Escritorio', type: 'folder', modified: '26/03/2026', parentId: 'c-drive' },
  { id: 'documents', name: 'Documentos', type: 'folder', modified: '25/03/2026', parentId: 'c-drive' },
  { id: 'downloads', name: 'Descargas', type: 'folder', modified: '24/03/2026', parentId: 'c-drive' },
  { id: 'pictures', name: 'Imágenes', type: 'folder', modified: '20/03/2026', parentId: 'c-drive' },
  { id: 'projects', name: 'Proyectos', type: 'folder', modified: '26/03/2026', parentId: 'documents' },
  { id: 'readme', name: 'README.txt', type: 'file', ext: 'txt', size: '2 KB', modified: '25/03/2026', parentId: 'documents', content: 'Bienvenido a NEX OS.\n\nUsá la Terminal: npm init, git init, y editá archivos en Explorer / NexCode.\n' },
  { id: 'wallpaper', name: 'wallpaper.jpg', type: 'file', ext: 'jpg', size: '4.2 MB', modified: '01/03/2026', imageUrl: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800', parentId: 'pictures' },
  { id: 'program-files', name: 'Program Files', type: 'folder', folderType: 'program_files', modified: '10/01/2026', parentId: 'c-drive' },
  { id: 'pf-nex', name: 'NEX', type: 'folder', folderType: 'program_files', modified: '10/01/2026', parentId: 'program-files' },
  { id: 'nex-notepad', name: 'notepad', type: 'file', ext: 'nex', size: '12 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'notepad', title: 'Notepad' } },
  { id: 'nex-cmd', name: 'cmd', type: 'file', ext: 'nex', size: '28 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'cmd', title: 'Terminal' } },
  { id: 'nex-browser', name: 'browser', type: 'file', ext: 'nex', size: '54 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'chrome', title: 'Navegador' } },
  { id: 'nex-code', name: 'vscode', type: 'file', ext: 'nex', size: '89 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'vscode', title: 'Visual Studio Code' } },
  { id: 'nex-explorer', name: 'explorer', type: 'file', ext: 'nex', size: '36 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'file-explorer', title: 'Explorador de archivos' } },
  { id: 'nex-paint', name: 'paint', type: 'file', ext: 'nex', size: '41 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'paint', title: 'Paint' } },
  { id: 'nex-calc', name: 'calc', type: 'file', ext: 'nex', size: '8 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'calculator', title: 'Calculadora' } },
  { id: 'nex-taskmanager', name: 'taskmanager', type: 'file', ext: 'nex', size: '22 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'taskmanager', title: 'Administrador de tareas' } },
  { id: 'nex-nexreproductor', name: 'nexreproductor', type: 'file', ext: 'nex', size: '67 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'nexreproductor', title: 'NexReproductor' } },
  { id: 'nex-settings', name: 'settings', type: 'file', ext: 'nex', size: '18 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'settings', title: 'Configuración' } },
  { id: 'nex-wordpad', name: 'wordpad', type: 'file', ext: 'nex', size: '31 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'wordpad', title: 'WordPad' } },
  { id: 'nex-defender', name: 'defender', type: 'file', ext: 'nex', size: '44 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'defender', title: 'Seguridad de Windows' } },
  { id: 'nex-mediaplayer', name: 'mediaplayer', type: 'file', ext: 'nex', size: '29 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'mediaplayer', title: 'Reproductor multimedia' } },
  { id: 'nex-spotify', name: 'spotify', type: 'file', ext: 'nex', size: '35 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'spotify', title: 'Spotify' } },
  { id: 'nex-devcpp', name: 'devcpp', type: 'file', ext: 'nex', size: '73 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'devcpp-2026', title: 'Dev-C++ 2026' } },
  { id: 'nex-terminal', name: 'terminal', type: 'file', ext: 'nex', size: '28 KB', modified: '10/01/2026', parentId: 'pf-nex', nexPayload: { appId: 'terminal', title: 'Terminal' } },
];

export const FileSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<FileItem[]>(() => {
    const saved = localStorage.getItem('win11_fs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as FileItem[];
        const hasSpotify = parsed.some((f) => f.name === 'spotify' && f.ext === 'nex');
        return hasSpotify ? parsed : INITIAL_FILES;
      } catch {
        return INITIAL_FILES;
      }
    }
    return INITIAL_FILES;
  });

  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => {
    // Strip large inline content from persistence once blobs exist — keep metadata lean
    const lean = files.map((f) => {
      if (f.content && f.content.length > 2000) {
        const { content: _c, ...rest } = f;
        return rest as FileItem;
      }
      return f;
    });
    localStorage.setItem('win11_fs', JSON.stringify(lean));
  }, [files]);

  const bridge: VfsBridge = useMemo(
    () => ({
      getFiles: () => filesRef.current,
      setFiles: (updater) => {
        setFiles((prev) => updater(prev));
      },
    }),
    [],
  );

  const nexFs = useMemo(() => createNexFs(bridge), [bridge]);

  const createFolder = useCallback((parentId: string, name: string) => {
    const newFolder: FileItem = {
      id: genId(),
      name,
      type: 'folder',
      modified: new Date().toLocaleDateString('es-ES'),
      parentId,
      folderType: name === 'node_modules' ? 'node_modules' : 'normal',
    };
    setFiles((prev) => [...prev, newFolder]);
  }, []);

  const createFile = useCallback((parentId: string, name: string, ext: string) => {
    const id = genId();
    const newFile: FileItem = {
      id,
      name,
      type: 'file',
      ext,
      size: '0 KB',
      modified: new Date().toLocaleDateString('es-ES'),
      parentId,
      content: '',
    };
    setFiles((prev) => [...prev, newFile]);
    return id;
  }, []);

  const updateFileContent = useCallback(
    (id: string, content: string) => {
      const path = nexFs.pathOfId(id);
      if (path) void nexFs.writeFile(path, content);
      else {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  content,
                  size: `${Math.max(1, Math.round(content.length / 1024))} KB`,
                  modified: new Date().toLocaleDateString('es-ES'),
                }
              : f,
          ),
        );
      }
    },
    [nexFs],
  );

  const deleteItem = useCallback((id: string) => {
    setFiles((prev) => {
      const getIdsToDelete = (targetId: string): string[] => {
        const children = prev.filter((f) => f.parentId === targetId);
        return [targetId, ...children.flatMap((child) => getIdsToDelete(child.id))];
      };
      const idsToDelete = getIdsToDelete(id);
      return prev.filter((f) => !idsToDelete.includes(f.id));
    });
  }, []);

  const renameItem = useCallback((id: string, newName: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));
  }, []);

  const [clipboard, setClipboard] = useState<{ id: string; type: 'copy' | 'cut' } | null>(null);
  const copyItem = useCallback((id: string) => setClipboard({ id, type: 'copy' }), []);
  const cutItem = useCallback((id: string) => setClipboard({ id, type: 'cut' }), []);

  const pasteItem = useCallback(
    (targetParentId: string): string | null => {
      if (!clipboard) return null;
      let resultId: string | null = null;
      setFiles((prev) => {
        const item = prev.find((f) => f.id === clipboard.id);
        if (!item) return prev;
        if (clipboard.type === 'copy') {
          resultId = genId();
          const newItem: FileItem = {
            ...item,
            id: resultId,
            name: `${item.name} - Copia`,
            parentId: targetParentId,
            modified: new Date().toLocaleDateString('es-ES'),
          };
          return [...prev, newItem];
        }
        resultId = clipboard.id;
        setClipboard(null);
        return prev.map((f) => (f.id === clipboard.id ? { ...f, parentId: targetParentId } : f));
      });
      return resultId;
    },
    [clipboard],
  );

  const value = useMemo(
    () => ({
      files,
      createFolder,
      createFile,
      updateFileContent,
      deleteItem,
      renameItem,
      copyItem,
      cutItem,
      pasteItem,
      clipboard,
      nexFs,
      setFiles,
    }),
    [
      files,
      createFolder,
      createFile,
      updateFileContent,
      deleteItem,
      renameItem,
      copyItem,
      cutItem,
      pasteItem,
      clipboard,
      nexFs,
    ],
  );

  return <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>;
};

export const useFileSystem = () => {
  const context = useContext(FileSystemContext);
  if (!context) throw new Error('useFileSystem must be used within a FileSystemProvider');
  return context;
};

export const useNexFs = (): NexFs => useFileSystem().nexFs;
