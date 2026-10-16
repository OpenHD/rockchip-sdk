/** Built-in .nex app registry (filename → app). */
export interface NexExecutable {
  appId: string;
  title: string;
  args?: string[];
  icon?: string;
}

export const NEX_EXECUTABLE_REGISTRY: Record<string, NexExecutable> = {
  'notepad.nex': { appId: 'notepad', title: 'Notepad' },
  'cmd.nex': { appId: 'cmd', title: 'Terminal' },
  'terminal.nex': { appId: 'terminal', title: 'Terminal' },
  'browser.nex': { appId: 'chrome', title: 'Navegador' },
  'chrome.nex': { appId: 'chrome', title: 'Google Chrome' },
  'vscode.nex': { appId: 'vscode', title: 'Visual Studio Code' },
  'explorer.nex': { appId: 'file-explorer', title: 'Explorador de archivos' },
  'paint.nex': { appId: 'paint', title: 'Paint' },
  'calc.nex': { appId: 'calculator', title: 'Calculadora' },
  'taskmanager.nex': { appId: 'taskmanager', title: 'Administrador de tareas' },
  'spotify.nex': { appId: 'spotify', title: 'Spotify' },
  'wordpad.nex': { appId: 'wordpad', title: 'WordPad' },
  'defender.nex': { appId: 'defender', title: 'Seguridad de Windows' },
  'settings.nex': { appId: 'settings', title: 'Configuración' },
  'mediaplayer.nex': { appId: 'mediaplayer', title: 'Reproductor multimedia' },
  'devcpp.nex': { appId: 'devcpp-2026', title: 'Dev-C++ 2026' },
  'tetris.nex': { appId: 'tetris', title: 'Tetris' },
  'games.nex': { appId: 'games', title: 'Games' },
};
