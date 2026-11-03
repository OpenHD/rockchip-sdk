const PALETTE = [
  '#0078d4',
  '#1db954',
  '#ff6b4a',
  '#f1c40f',
  '#e91e63',
  '#9b59b6',
  '#00bcd4',
  '#ff7043',
  '#3dd6c6',
  '#5c6bc0',
  '#26a69a',
  '#ec407a',
];

export const APP_COLORS: Record<string, string> = {
  search: '#5c6bc0',
  files: '#f1c40f',
  chrome: '#4285F4',
  vscode: '#007ACC',
  hermes: '#7c4dff',
  paint: '#FF6E40',
  'control-panel': '#78909c',
  wordpad: '#4CAF50',
  'task-manager': '#2196F3',
  calendar: '#E91E63',
  defender: '#008a17',
  calculator: '#D32F2F',
  notepad: '#66bb6a',
  terminal: '#37474f',
  clock: '#60cdff',
  photos: '#ff6b6b',
  nexreproductor: '#1db954',
  'virtual-dj': '#ff6b4a',
  spotify: '#1db954',
  'nex-store': '#3dd6c6',
  browser: '#0078d4',
  cmd: '#37474f',
  settings: '#78909c',
  tetris: '#22d3ee',
  games: '#22d3ee',
};

function hashId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function colorForApp(id: string) {
  return APP_COLORS[id] || PALETTE[hashId(id) % PALETTE.length];
}
