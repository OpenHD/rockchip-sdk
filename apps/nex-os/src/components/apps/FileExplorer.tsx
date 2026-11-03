import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Folder20Filled,
  Document20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  ArrowUp20Regular,
  Search20Regular,
  Grid28Regular,
  List20Regular,
  TextColumnTwoLeft20Regular,
  Add20Regular,
  Cut20Regular,
  Copy20Regular,
  ClipboardPaste20Regular,
  Delete20Regular,
  Rename20Regular,
  Share20Regular,
  ArrowSort20Regular,
  Home20Regular,
  Desktop20Regular,
  MusicNote220Regular,
  Image20Regular,
  Video20Regular,
  ArrowDownload20Regular,
  HardDrive20Regular,
  ChevronRight12Regular,
  DocumentPdf20Regular,
  TableSimple20Regular,
  Flash20Regular,
  Globe20Regular,
  Calculator20Regular,
  Apps20Regular,
  Settings20Regular,
  ShieldCheckmark20Regular,
  Code20Regular,
} from '@fluentui/react-icons';

import { useWindowManager } from '../../context/WindowManager';
import { useFileSystem, type FileItem } from '../../context/FileSystemContext';
import { useSettings } from '../../context/SettingsContext';
import ContextMenu from '../ContextMenu';
import {
  buildOpenTarget,
  getOpenTargetsForExt,
  resolveDefaultOpen,
} from '../../utils/fileAssociations';

const NEX_ICONS: Record<string, React.ReactNode> = {
  notepad:       <Document20Regular />,
  cmd:           <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold', fontSize: 14 }}>C:\</span>,
  terminal:      <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold', fontSize: 14 }}>C:\</span>,
  chrome:        <Globe20Regular />,
  'file-explorer': <Folder20Filled style={{ color: '#f0c040' }} />,
  paint:         <span style={{ fontSize: 16 }}>🎨</span>,
  calculator:    <Calculator20Regular />,
  taskmanager:   <Apps20Regular />,
  spotify:       <span style={{ fontSize: 16 }}>🎵</span>,
  settings:      <Settings20Regular />,
  wordpad:       <Document20Regular />,
  defender:      <ShieldCheckmark20Regular />,
  mediaplayer:   <span style={{ fontSize: 16 }}>▶️</span>,
  'devcpp-2026': <Code20Regular style={{ color: '#3b82f6' }} />,
};

const getFileIcon = (item: FileItem, small = false) => {
  const sz = small ? 16 : 20;
  if (item.type === 'drive') return <HardDrive20Regular style={{ color: '#7fa4f1', fontSize: sz }} />;
  if (item.type === 'folder') return <Folder20Filled style={{ color: '#f0c040', fontSize: sz }} />;
  if (item.ext === 'nex') return <Flash20Regular style={{ color: '#00ffff', fontSize: sz }} />;
  if ((item.ext === 'jpg' || item.ext === 'png') && item.imageUrl) {
    return <img src={item.imageUrl} alt={item.name}
      style={{ width: small ? 20 : 40, height: small ? 20 : 40, objectFit: 'cover', borderRadius: 3 }} />;
  }
  switch (item.ext) {
    case 'pdf': return <DocumentPdf20Regular style={{ color: '#d9534f', fontSize: sz }} />;
    case 'xlsx': return <TableSimple20Regular style={{ color: '#1a7a40', fontSize: sz }} />;
    case 'pptx': return <Document20Regular style={{ color: '#c0451a', fontSize: sz }} />;
    case 'txt': return <Document20Regular style={{ color: '#9aa0a6', fontSize: sz }} />;
    case 'jpg': case 'png': return <Image20Regular style={{ color: '#1a78c2', fontSize: sz }} />;
    case 'mp3': return <MusicNote220Regular style={{ color: '#7b68ee', fontSize: sz }} />;
    default: return <Document20Regular style={{ color: '#9aa0a6', fontSize: sz }} />;
  }
};

const FileExplorer: React.FC = () => {
  const { openWindow } = useWindowManager();
  const { files, createFolder, createFile, deleteItem, renameItem, copyItem, cutItem, pasteItem, clipboard } = useFileSystem();
  const { accentColor } = useSettings();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>('c-drive');
  const [history, setHistory] = useState<(string | null)[]>(['c-drive']);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'icons' | 'list' | 'details'>('icons');
  const [selected, setSelected] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: FileItem | null } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  useEffect(() => {
    if (renamingId) {
      const item = files.find(f => f.id === renamingId);
      if (item) setRenameInput(item.name);
    }
  }, [renamingId, files]);

  const currentFolderFiles = useMemo(() => files.filter(f => f.parentId === currentFolderId), [files, currentFolderId]);
  const currentPath = useMemo(() => {
    if (!currentFolderId) return 'Este equipo';
    const path: string[] = [];
    let curr = files.find(f => f.id === currentFolderId);
    while (curr) {
      path.unshift(curr.name);
      curr = files.find(f => f.id === curr?.parentId);
    }
    return path.join(' > ');
  }, [files, currentFolderId]);

  const canBack = historyIdx > 0;
  const canForward = historyIdx < history.length - 1;

  const navigate = (id: string | null) => {
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push(id);
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
    setCurrentFolderId(id);
    setSelected(null);
  };

  const goBack = () => { if (canBack) { setHistoryIdx(h => h - 1); setCurrentFolderId(history[historyIdx - 1]); setSelected(null); } };
  const goForward = () => { if (canForward) { setHistoryIdx(h => h + 1); setCurrentFolderId(history[historyIdx + 1]); setSelected(null); } };
  const goUp = () => {
    const curr = files.find(f => f.id === currentFolderId);
    if (curr?.parentId) navigate(curr.parentId);
    else if (currentFolderId !== null) navigate(null);
  };

  const openWithApp = (item: FileItem, appId: string) => {
    const target = buildOpenTarget(item, appId);
    openWindow(target.windowId, target.appId, target.title, target.icon, target.appProps);
  };

  const handleDoubleClick = (item: FileItem) => {
    if (item.type === 'folder' || item.type === 'drive') {
      navigate(item.id);
      return;
    }
    if (item.ext === 'nex' && item.nexPayload) {
      const payload = item.nexPayload;
      const appIcon = NEX_ICONS[payload.appId] || <Flash20Regular style={{ color: '#00ffff' }} />;
      openWindow(payload.appId, payload.appId, payload.title, appIcon);
      return;
    }
    const target = resolveDefaultOpen(item);
    if (target) {
      openWindow(target.windowId, target.appId, target.title, target.icon, target.appProps);
    }
  };

  const handleNewFolder = () => {
    if (currentFolderId) createFolder(currentFolderId, 'Nueva carpeta');
  };

  const handleNewFile = () => {
    if (currentFolderId) createFile(currentFolderId, 'Nuevo documento', 'txt');
  };

  return (
    <div className="fe-professional-root">
      {/* TOOLBAR MODERNA */}
      <div className="fe-ribbon-modern">
        <div className="fe-ribbon-left">
          <button className="fe-ribbon-btn-main" onClick={handleNewFolder}>
            <Add20Regular className="fe-icon-blue" />
            <span>Nuevo</span>
          </button>
          <div className="fe-ribbon-divider" />
          <button className={`fe-action-btn ${!selected ? 'disabled' : ''}`} onClick={() => selected && cutItem(selected)}>
            <Cut20Regular />
          </button>
          <button className={`fe-action-btn ${!selected ? 'disabled' : ''}`} onClick={() => selected && copyItem(selected)}>
            <Copy20Regular />
          </button>
          <button className={`fe-action-btn ${!clipboard || !currentFolderId ? 'disabled' : ''}`} onClick={() => currentFolderId && pasteItem(currentFolderId)}>
            <ClipboardPaste20Regular />
          </button>
          <div className="fe-ribbon-divider" />
          <button className={`fe-action-btn ${!selected ? 'disabled' : ''}`} onClick={() => selected && deleteItem(selected)}>
            <Delete20Regular />
          </button>
          <button className={`fe-action-btn ${!selected ? 'disabled' : ''}`} onClick={() => selected && setRenamingId(selected)}>
            <Rename20Regular />
          </button>
        </div>
        <div className="fe-ribbon-right">
          <div className="fe-view-switcher">
            <button className={viewMode === 'icons' ? 'active' : ''} onClick={() => setViewMode('icons')}><Grid28Regular /></button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}><List20Regular /></button>
            <button className={viewMode === 'details' ? 'active' : ''} onClick={() => setViewMode('details')}><TextColumnTwoLeft20Regular /></button>
          </div>
        </div>
      </div>

      {/* BARRA DE NAVEGACIÓN */}
      <div className="fe-nav-bar">
        <div className="fe-nav-controls">
          <button disabled={!canBack} onClick={goBack}><ChevronLeft20Regular /></button>
          <button disabled={!canForward} onClick={goForward}><ChevronRight20Regular /></button>
          <button onClick={goUp}><ArrowUp20Regular /></button>
        </div>
        <div className="fe-address-bar">
          <Home20Regular className="fe-address-icon" />
          <div className="fe-breadcrumbs">
            {currentPath.split(' > ').map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight12Regular className="bc-sep" />}
                <span className="bc-item">{crumb}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="fe-search-container">
          <Search20Regular className="fe-search-icon" />
          <input type="text" placeholder="Buscar..." />
        </div>
      </div>

      <div className="fe-content-area">
        {/* SIDEBAR */}
        <aside className="fe-sidebar-modern">
          <div className="sb-section">
            <div className="sb-item" onClick={() => navigate('c-drive')}>
              <HardDrive20Regular />
              <span>Este equipo (C:)</span>
            </div>
            <div className="sb-item" onClick={() => navigate('desktop')}>
              <Desktop20Regular />
              <span>Escritorio</span>
            </div>
            <div className="sb-item" onClick={() => navigate('documents')}>
              <Document20Regular />
              <span>Documentos</span>
            </div>
            <div className="sb-item" onClick={() => navigate('pictures')}>
              <Image20Regular />
              <span>Imágenes</span>
            </div>
          </div>
        </aside>

        {/* MAIN GRID */}
        <main className="fe-main-grid" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item: null }); }}>
          <div className="files-grid">
            {currentFolderFiles.map(file => (
              <div 
                key={file.id} 
                className={`file-item-modern ${selected === file.id ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); setSelected(file.id); }}
                onDoubleClick={() => handleDoubleClick(file)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelected(file.id); setContextMenu({ x: e.clientX, y: e.clientY, item: file }); }}
              >
                <div className="file-icon-box">{getFileIcon(file)}</div>
                {renamingId === file.id ? (
                  <input
                    autoFocus
                    className="file-rename-input"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        renameItem(file.id, renameInput);
                        setRenamingId(null);
                      }
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={() => {
                      renameItem(file.id, renameInput);
                      setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="file-name-modern">{file.name}</span>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>

      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          onClose={() => setContextMenu(null)}
          options={contextMenu.item ? [
            { label: 'Abrir', onClick: () => handleDoubleClick(contextMenu.item!) },
            ...(contextMenu.item.type === 'file'
              ? [{
                  label: 'Abrir con',
                  onClick: () => {},
                  submenu: getOpenTargetsForExt(contextMenu.item.ext).map((t) => ({
                    label: t.label,
                    icon: t.icon,
                    onClick: () => openWithApp(contextMenu.item!, t.appId),
                  })),
                }]
              : []),
            { label: 'Cortar', icon: <Cut20Regular />, onClick: () => cutItem(contextMenu.item!.id) },
            { label: 'Copiar', icon: <Copy20Regular />, onClick: () => copyItem(contextMenu.item!.id) },
            { label: 'Eliminar', icon: <Delete20Regular />, onClick: () => deleteItem(contextMenu.item!.id) },
            { label: 'Cambiar nombre', icon: <Rename20Regular />, onClick: () => setRenamingId(contextMenu.item!.id) },
          ] : [
            { label: 'Pegar', icon: <ClipboardPaste20Regular />, disabled: !clipboard, onClick: () => currentFolderId && pasteItem(currentFolderId) },
            { label: 'Nueva carpeta', icon: <Folder20Filled />, onClick: handleNewFolder },
            { label: 'Nuevo archivo', icon: <Document20Regular />, onClick: handleNewFile },
          ]}
        />
      )}

      <style>{`
        .fe-professional-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--mica-bg);
          color: var(--win-fg);
          font-family: var(--win-font);
        }

        .fe-ribbon-modern {
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .fe-ribbon-left { display: flex; align-items: center; gap: 8px; }
        .fe-ribbon-btn-main {
          background: var(--win-accent);
          color: black;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          font-size: 13px;
        }

        .fe-action-btn {
          background: transparent;
          border: none;
          color: white;
          padding: 6px;
          border-radius: 4px;
          display: flex;
          font-size: 18px;
        }
        .fe-action-btn:hover { background: var(--hover-bg); }
        .fe-action-btn.disabled { opacity: 0.3; pointer-events: none; }

        .fe-nav-bar {
          height: 42px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .fe-nav-controls { display: flex; gap: 4px; }
        .fe-nav-controls button {
          background: transparent;
          border: none;
          color: white;
          padding: 4px;
          border-radius: 4px;
        }
        .fe-nav-controls button:disabled { opacity: 0.3; }
        .fe-nav-controls button:hover:not(:disabled) { background: var(--hover-bg); }

        .fe-address-bar {
          flex: 1;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          height: 30px;
          display: flex;
          align-items: center;
          padding: 0 10px;
          gap: 8px;
        }

        .fe-breadcrumbs { display: flex; align-items: center; gap: 4px; font-size: 13px; opacity: 0.8; }
        .bc-item:hover { text-decoration: underline; cursor: pointer; }

        .fe-search-container {
          width: 240px;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          height: 30px;
          display: flex;
          align-items: center;
          padding: 0 10px;
          gap: 8px;
        }
        .fe-search-container input {
          background: transparent;
          border: none;
          color: white;
          outline: none;
          font-size: 12px;
          width: 100%;
        }

        .fe-content-area { display: flex; flex: 1; overflow: hidden; }

        .fe-sidebar-modern {
          width: 200px;
          border-right: 1px solid var(--border-color);
          padding: 12px 6px;
        }

        .sb-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          color: rgba(255,255,255,0.8);
        }
        .sb-item:hover { background: var(--hover-bg); }

        .fe-main-grid { flex: 1; padding: 20px; overflow-y: auto; }
        .files-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 16px;
        }

        .file-item-modern {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border-radius: 4px;
          transition: background 0.1s;
        }
        .file-item-modern:hover { background: var(--hover-bg); }
        .file-item-modern.selected { background: rgba(0,120,212,0.2); outline: 1px solid var(--win-accent); }

        .file-icon-box { font-size: 40px; }
        .file-name-modern { font-size: 12px; text-align: center; word-break: break-all; }
        .file-rename-input {
          background: #333;
          border: 1px solid var(--win-accent);
          color: white;
          font-size: 12px;
          text-align: center;
          width: 90%;
          outline: none;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default FileExplorer;
