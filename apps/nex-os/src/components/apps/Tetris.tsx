import React, { useEffect, useReducer, useRef, useState } from 'react';
import { useIsPhone } from '../../hooks/useMobileAppShell';

type Tet = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
type Cell = { r: number; c: number };

const COLS = 10;
const ROWS = 20;
const BEST_KEY = 'nex_tetris_best';

const COLORS: Record<Tet, string> = {
  I: '#22d3ee',
  O: '#facc15',
  T: '#c084fc',
  S: '#4ade80',
  Z: '#f87171',
  J: '#60a5fa',
  L: '#fb923c',
};

const SHAPES: Record<Tet, Cell[][]> = {
  I: [
    [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }],
    [{ r: 0, c: 2 }, { r: 1, c: 2 }, { r: 2, c: 2 }, { r: 3, c: 2 }],
    [{ r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }, { r: 2, c: 3 }],
    [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 3, c: 1 }],
  ],
  O: [
    [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
    [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
    [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
    [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
  ],
  T: [
    [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
    [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }],
    [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }],
    [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
  ],
  S: [
    [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
    [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 2 }],
    [{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 0 }, { r: 2, c: 1 }],
    [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
  ],
  Z: [
    [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
    [{ r: 0, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }],
    [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 2, c: 2 }],
    [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 0 }],
  ],
  J: [
    [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
    [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
    [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 2 }],
    [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 0 }, { r: 2, c: 1 }],
  ],
  L: [
    [{ r: 0, c: 2 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
    [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 2, c: 2 }],
    [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 0 }],
    [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
  ],
};

const BAG: Tet[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const KICKS: Cell[] = [
  { r: 0, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
  { r: -1, c: 0 },
  { r: 0, c: -2 },
  { r: 0, c: 2 },
  { r: 1, c: 0 },
];

type Piece = { type: Tet; rot: number; r: number; c: number };
type Board = (Tet | null)[][];

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Tet | null>(COLS).fill(null));
}

function shuffleBag(): Tet[] {
  const bag = [...BAG];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function cellsOf(p: Piece): Cell[] {
  return SHAPES[p.type][p.rot].map((d) => ({ r: p.r + d.r, c: p.c + d.c }));
}

function collides(board: Board, p: Piece): boolean {
  return cellsOf(p).some(({ r, c }) => r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c]);
}

function merge(board: Board, p: Piece): Board {
  const next = board.map((row) => row.slice());
  for (const { r, c } of cellsOf(p)) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) next[r][c] = p.type;
  }
  return next;
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter((row) => row.some((c) => c == null));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(Array<Tet | null>(COLS).fill(null));
  return { board: kept, cleared };
}

function ghostOf(board: Board, p: Piece): Piece {
  let g = { ...p };
  while (!collides(board, { ...g, r: g.r + 1 })) g = { ...g, r: g.r + 1 };
  return g;
}

function spawn(type: Tet): Piece {
  return { type, rot: 0, r: 0, c: 3 };
}

function lineScore(n: number, level: number) {
  const base = [0, 100, 300, 500, 800][n] ?? 0;
  return base * level;
}

function gravityMs(level: number) {
  return Math.max(90, 800 - (level - 1) * 70);
}

type Game = {
  board: Board;
  piece: Piece | null;
  queue: Tet[];
  hold: Tet | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  over: boolean;
  paused: boolean;
};

type Action =
  | { type: 'tick' }
  | { type: 'move'; dc: number; dr: number }
  | { type: 'rotate'; dir: number }
  | { type: 'drop' }
  | { type: 'hold' }
  | { type: 'pause' }
  | { type: 'restart' };

function cloneGame(game: Game): Game {
  return {
    ...game,
    board: game.board.map((row) => row.slice()),
    piece: game.piece ? { ...game.piece } : null,
    queue: [...game.queue],
  };
}

function refill(game: Game) {
  if (game.queue.length < 7) game.queue.push(...shuffleBag());
}

function lockPiece(game: Game) {
  if (!game.piece) return;
  game.board = merge(game.board, game.piece);
  const { board, cleared } = clearLines(game.board);
  game.board = board;
  if (cleared) {
    game.lines += cleared;
    game.score += lineScore(cleared, game.level);
    game.level = Math.floor(game.lines / 10) + 1;
  }
  refill(game);
  const next = spawn(game.queue.shift()!);
  if (collides(game.board, next)) {
    game.over = true;
    game.piece = next;
    return;
  }
  game.piece = next;
  game.canHold = true;
}

function freshGame(): Game {
  const queue = [...shuffleBag(), ...shuffleBag()];
  const type = queue.shift()!;
  return {
    board: emptyBoard(),
    piece: spawn(type),
    queue,
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    paused: false,
  };
}

function reduce(state: Game, action: Action): Game {
  if (action.type === 'restart') return freshGame();
  const game = cloneGame(state);
  if (action.type === 'pause') {
    if (!game.over) game.paused = !game.paused;
    return game;
  }
  if (!game.piece || game.over || game.paused) return state;

  if (action.type === 'move') {
    const next = { ...game.piece, r: game.piece.r + action.dr, c: game.piece.c + action.dc };
    if (!collides(game.board, next)) {
      game.piece = next;
      if (action.dr > 0) game.score += 1;
      return game;
    }
    if (action.dr > 0) lockPiece(game);
    return game;
  }

  if (action.type === 'rotate') {
    const rot = (game.piece.rot + action.dir + 4) % 4;
    for (const k of KICKS) {
      const next = { ...game.piece, rot, r: game.piece.r + k.r, c: game.piece.c + k.c };
      if (!collides(game.board, next)) {
        game.piece = next;
        return game;
      }
    }
    return state;
  }

  if (action.type === 'drop') {
    let dist = 0;
    while (!collides(game.board, { ...game.piece, r: game.piece.r + 1 })) {
      game.piece = { ...game.piece, r: game.piece.r + 1 };
      dist += 1;
    }
    game.score += dist * 2;
    lockPiece(game);
    return game;
  }

  if (action.type === 'hold') {
    if (!game.canHold) return state;
    const current = game.piece.type;
    if (game.hold) game.piece = spawn(game.hold);
    else {
      refill(game);
      game.piece = spawn(game.queue.shift()!);
    }
    game.hold = current;
    game.canHold = false;
    if (collides(game.board, game.piece)) game.over = true;
    return game;
  }

  if (action.type === 'tick') {
    const next = { ...game.piece, r: game.piece.r + 1 };
    if (!collides(game.board, next)) {
      game.piece = next;
      return game;
    }
    lockPiece(game);
    return game;
  }

  return state;
}

function Mini({ type }: { type: Tet | null }) {
  const cells = type ? SHAPES[type][0] : [];
  return (
    <div className="nx-tet-mini">
      {Array.from({ length: 16 }, (_, i) => {
        const r = Math.floor(i / 4);
        const c = i % 4;
        const on = cells.some((d) => d.r === r && d.c === c);
        return (
          <i
            key={i}
            style={{ background: on && type ? COLORS[type] : 'transparent' }}
          />
        );
      })}
    </div>
  );
}

const Tetris: React.FC = () => {
  const isPhone = useIsPhone();
  const [game, dispatch] = useReducer(reduce, undefined, freshGame);
  const rootRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const [best] = useState(() => Number(localStorage.getItem(BEST_KEY) || 0));
  const shownBest = Math.max(best, game.score);

  useEffect(() => {
    if (game.over && game.score > best) {
      localStorage.setItem(BEST_KEY, String(game.score));
    }
  }, [game.over, game.score, best]);

  useEffect(() => {
    if (game.over || game.paused) return;
    const id = window.setInterval(() => dispatch({ type: 'tick' }), gravityMs(game.level));
    return () => window.clearInterval(id);
  }, [game.level, game.over, game.paused]);

  useEffect(() => {
    rootRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Spacebar'].includes(k)) e.preventDefault();
      if (k === 'ArrowLeft') dispatch({ type: 'move', dc: -1, dr: 0 });
      else if (k === 'ArrowRight') dispatch({ type: 'move', dc: 1, dr: 0 });
      else if (k === 'ArrowDown') dispatch({ type: 'move', dc: 0, dr: 1 });
      else if (k === 'ArrowUp' || k === 'x' || k === 'X') dispatch({ type: 'rotate', dir: 1 });
      else if (k === 'z' || k === 'Z') dispatch({ type: 'rotate', dir: -1 });
      else if (k === ' ' || k === 'Spacebar') dispatch({ type: 'drop' });
      else if (k === 'c' || k === 'C' || k === 'Shift') dispatch({ type: 'hold' });
      else if (k === 'p' || k === 'P' || k === 'Escape') dispatch({ type: 'pause' });
      else if (k === 'r' || k === 'R') dispatch({ type: 'restart' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const ghost = game.piece ? ghostOf(game.board, game.piece) : null;
  const live = new Set<string>();
  const ghostSet = new Set<string>();
  if (game.piece) for (const c of cellsOf(game.piece)) live.add(`${c.r},${c.c}`);
  if (ghost) for (const c of cellsOf(ghost)) ghostSet.add(`${c.r},${c.c}`);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18 && dt < 280) {
      dispatch({ type: 'rotate', dir: 1 });
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 24) dispatch({ type: 'move', dc: 1, dr: 0 });
      else if (dx < -24) dispatch({ type: 'move', dc: -1, dr: 0 });
    } else if (dy > 40) {
      if (dy > 90 && dt < 280) dispatch({ type: 'drop' });
      else dispatch({ type: 'move', dc: 0, dr: 1 });
    }
  };

  return (
    <div
      className={`nx-tet ${isPhone ? 'is-phone' : ''}`}
      ref={rootRef}
      tabIndex={0}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="nx-tet-bar">
        <div>
          <small>Puntos</small>
          <strong>{game.score}</strong>
        </div>
        <div>
          <small>Mejor</small>
          <strong>{shownBest}</strong>
        </div>
        <div>
          <small>Líneas</small>
          <strong>{game.lines}</strong>
        </div>
        <div>
          <small>Nivel</small>
          <strong>{game.level}</strong>
        </div>
        <button type="button" onClick={() => dispatch({ type: 'pause' })} disabled={game.over}>
          {game.paused ? 'Seguir' : 'Pausa'}
        </button>
      </header>

      <div className="nx-tet-play">
        <div className="nx-tet-side">
          <span>Hold</span>
          <Mini type={game.hold} />
        </div>

        <div className="nx-tet-board" aria-label="Tablero Tetris">
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const r = Math.floor(i / COLS);
            const c = i % COLS;
            const locked = game.board[r][c];
            const isLive = live.has(`${r},${c}`);
            const isGhost = !isLive && ghostSet.has(`${r},${c}`);
            const type = isLive ? game.piece?.type : locked;
            return (
              <i
                key={i}
                className={isGhost ? 'ghost' : type ? 'on' : ''}
                style={type ? { background: COLORS[type], boxShadow: `0 0 8px ${COLORS[type]}66` } : undefined}
              />
            );
          })}
          {(game.over || game.paused) && (
            <div className="nx-tet-overlay">
              <h2>{game.over ? 'Game Over' : 'Pausa'}</h2>
              {game.over && <p>{game.score} puntos</p>}
              <button type="button" onClick={() => dispatch({ type: 'restart' })}>
                {game.over ? 'Jugar de nuevo' : 'Reiniciar'}
              </button>
            </div>
          )}
        </div>

        <div className="nx-tet-side">
          <span>Next</span>
          <Mini type={game.queue[0] ?? null} />
          {!isPhone && <Mini type={game.queue[1] ?? null} />}
        </div>
      </div>

      <div className="nx-tet-pad">
        <button type="button" onClick={() => dispatch({ type: 'move', dc: -1, dr: 0 })} aria-label="Izquierda">◀</button>
        <button type="button" onClick={() => dispatch({ type: 'rotate', dir: 1 })} aria-label="Girar">↻</button>
        <button type="button" onClick={() => dispatch({ type: 'move', dc: 1, dr: 0 })} aria-label="Derecha">▶</button>
        <button type="button" onClick={() => dispatch({ type: 'move', dc: 0, dr: 1 })} aria-label="Bajar">▼</button>
        <button type="button" onClick={() => dispatch({ type: 'drop' })} aria-label="Drop">Drop</button>
        <button type="button" onClick={() => dispatch({ type: 'hold' })} aria-label="Hold">Hold</button>
      </div>

      {!isPhone && (
        <p className="nx-tet-hint">
          ← → mover · ↑/X girar · Z antihorario · ↓ bajar · Espacio drop · C hold · P pausa
        </p>
      )}

      <style>{`
        .nx-tet {
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(circle at 20% 0%, rgba(34, 211, 238, 0.12), transparent 40%),
            #0b0d12;
          color: #fff;
          font-family: Outfit, Inter, system-ui, sans-serif;
          user-select: none;
          outline: none;
          padding: 10px 10px 8px;
          box-sizing: border-box;
          touch-action: none;
        }
        .nx-tet-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr) auto;
          gap: 8px;
          align-items: end;
          margin-bottom: 8px;
        }
        .nx-tet-bar small {
          display: block;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.55;
        }
        .nx-tet-bar strong {
          font-size: 18px;
          font-variant-numeric: tabular-nums;
        }
        .nx-tet-bar button,
        .nx-tet-overlay button {
          height: 36px;
          padding: 0 12px;
          border: none;
          border-radius: 10px;
          background: rgba(255,255,255,0.1);
          color: #fff;
          font-weight: 650;
        }
        .nx-tet-play {
          flex: 1;
          min-height: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
        }
        .nx-tet-board {
          position: relative;
          aspect-ratio: 10 / 20;
          height: 100%;
          max-height: 100%;
          width: auto;
          max-width: min(100%, calc((100% - 20px) * 0.72));
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          grid-template-rows: repeat(20, 1fr);
          gap: 1px;
          padding: 3px;
          background: #05070b;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.15), 0 16px 40px rgba(0,0,0,0.4);
        }
        .nx-tet-board i {
          background: rgba(255,255,255,0.03);
          border-radius: 2px;
        }
        .nx-tet-board i.on { border-radius: 3px; }
        .nx-tet-board i.ghost {
          background: rgba(255,255,255,0.12) !important;
          box-shadow: none !important;
        }
        .nx-tet-side {
          width: 64px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 11px;
          opacity: 0.9;
        }
        .nx-tet-mini {
          width: 64px;
          height: 64px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: repeat(4, 1fr);
          gap: 2px;
          padding: 6px;
          background: rgba(255,255,255,0.04);
          border-radius: 10px;
        }
        .nx-tet-mini i { border-radius: 2px; }
        .nx-tet-overlay {
          position: absolute;
          inset: 0;
          background: rgba(5,7,11,0.78);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 10px;
        }
        .nx-tet-overlay h2 { margin: 0; font-size: 22px; }
        .nx-tet-overlay p { margin: 0; opacity: 0.75; }
        .nx-tet-pad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 10px;
        }
        .nx-tet-pad button {
          height: 52px;
          border: none;
          border-radius: 14px;
          background: rgba(255,255,255,0.08);
          color: #fff;
          font-size: 20px;
          font-weight: 700;
        }
        .nx-tet-pad button:active { transform: scale(0.94); background: rgba(34,211,238,0.25); }
        .nx-tet-hint {
          margin: 8px 0 0;
          text-align: center;
          font-size: 11px;
          opacity: 0.5;
        }
        .nx-tet.is-phone {
          padding: 4px 8px 6px;
        }
        .nx-tet.is-phone .nx-tet-bar {
          gap: 4px;
          margin-bottom: 4px;
        }
        .nx-tet.is-phone .nx-tet-bar small { font-size: 9px; }
        .nx-tet.is-phone .nx-tet-bar strong { font-size: 14px; }
        .nx-tet.is-phone .nx-tet-bar button {
          height: 28px;
          min-height: 28px;
          min-width: 0;
          padding: 0 10px;
          font-size: 12px;
        }
        .nx-tet.is-phone .nx-tet-play { gap: 6px; }
        .nx-tet.is-phone .nx-tet-side { width: 44px; font-size: 10px; }
        .nx-tet.is-phone .nx-tet-mini { width: 44px; height: 44px; padding: 3px; }
        .nx-tet.is-phone .nx-tet-board {
          max-width: min(100%, calc(100% - 88px));
          border-radius: 8px;
        }
        .nx-tet.is-phone .nx-tet-pad {
          gap: 6px;
          margin-top: 6px;
        }
        .nx-tet.is-phone .nx-tet-pad button {
          height: 46px;
          min-height: 46px;
          border-radius: 16px;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        @media (orientation: landscape) and (max-height: 500px) {
          .nx-tet { padding: 6px; }
          .nx-tet-play { gap: 8px; }
          .nx-tet-pad { grid-template-columns: repeat(6, 1fr); margin-top: 6px; }
          .nx-tet-pad button { height: 40px; font-size: 16px; }
          .nx-tet-hint { display: none; }
        }
      `}</style>
    </div>
  );
};

export default Tetris;
