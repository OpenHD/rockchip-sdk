import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from 'ioredis';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

// We use an in-memory variable to keep the Socket.io server alive across 
// multiple function invocations in the same container.
let io: Server | undefined;
let redisPublisher: Redis | undefined;
let redisSubscriber: Redis | undefined;

function getRedisClient() {
  if (!process.env.REDIS_URL) {
    console.warn('No REDIS_URL found. Running without Redis pub/sub sync.');
    return null;
  }
  return new Redis(process.env.REDIS_URL);
}

export default function SocketHandler(req: VercelRequest, res: VercelResponse) {
  // Check if we already initialized the WebSocket server for this container
  if (!res.socket) {
    res.end();
    return;
  }

  const socket = res.socket as any;
  if (!socket.server.io) {
    console.log('*First use, starting Socket.IO server...');
    const ioServer = new Server(socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: '*', // Adjust based on your security needs
        methods: ['GET', 'POST']
      }
    });

    socket.server.io = ioServer;
    io = ioServer;

    const pub = getRedisClient();
    const sub = pub ? getRedisClient() : null;

    if (pub && sub) {
      redisPublisher = pub;
      redisSubscriber = sub;
      ioServer.adapter(createAdapter(pub, sub));
      console.log('Redis connected for Pub/Sub and Socket.IO Adapter configured.');
    }

    // In-memory state for this instance
    // Note: For a true multi-instance Vercel setup, complex state like `rooms` 
    // should ideally be stored in Redis (e.g. JSON.set). 
    // Here we keep it simple for the MVP, relying on the Redis Adapter to sync messages.
    const rooms = new Map();

    function generateRoomCode(): string {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i += 1) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return rooms.has(code) ? generateRoomCode() : code;
    }

    function publicUsers(room: any) {
      return room.users.map((u: any) => ({ id: u.id, name: u.name, isHost: u.isHost }));
    }

    const DEFAULT_DJ_EQ = {
      enabled: false,
      preset: 'Flat',
      bands: Array(32).fill(0),
      lowCut: false,
      highCut: false,
    };

    function serializeDjPool(pool: any[], socketId: string) {
      return [...pool]
        .map((e) => ({
          ...e,
          voteCount: e.votes.length,
          votedByMe: e.votes.includes(socketId),
        }))
        .sort((a, b) => b.voteCount - a.voteCount || a.addedAt - b.addedAt);
    }

    function broadcastDjEq(roomCode: string) {
      const room = rooms.get(roomCode);
      if (!room) return;
      ioServer.to(roomCode).emit('dj:eq', room.djEq);
    }

    function getTopDjEntry(room: any) {
      if (!room.djPool.length) return null;
      const sorted = [...room.djPool].sort(
        (a, b) => b.votes.length - a.votes.length || a.addedAt - b.addedAt,
      );
      return sorted[0];
    }

    function broadcastDjPool(roomCode: string) {
      const room = rooms.get(roomCode);
      if (!room) return;
      ioServer.in(roomCode).fetchSockets().then((sockets) => {
        for (const s of sockets) {
          s.emit('dj:pool', serializeDjPool(room.djPool, s.id));
        }
      });
    }

    function broadcastDjState(roomCode: string) {
      const room = rooms.get(roomCode);
      if (!room) return;
      ioServer.to(roomCode).emit('dj:state', room.djMode);
    }

    function createRoomPayload(room: any, socketId: string) {
      return {
        code: room.code,
        isHost: room.hostId === socketId,
        playback: room.playback,
        queue: room.queue,
        djMode: room.djMode,
        djPool: serializeDjPool(room.djPool, socketId),
        djEq: room.djEq,
      };
    }

    ioServer.on('connection', (clientSocket) => {
      let currentRoom: string | null = null;
      let userName = 'Anónimo';

      clientSocket.on('room:create', ({ username, enableDj }, callback) => {
        const code = generateRoomCode();
        userName = username?.trim() || 'Host';

        const room = {
          code,
          hostId: clientSocket.id,
          users: [{ id: clientSocket.id, name: userName, isHost: true }],
          playback: null,
          queue: [],
          chat: [],
          djMode: { enabled: !!enableDj, autoPlay: true },
          djPool: [],
          djEq: { ...DEFAULT_DJ_EQ },
        };

        rooms.set(code, room);
        clientSocket.join(code);
        currentRoom = code;

        callback?.(createRoomPayload(room, clientSocket.id));
        ioServer.to(code).emit('room:users', publicUsers(room));
        if (room.djMode.enabled) {
          broadcastDjState(code);
          broadcastDjPool(code);
        }
      });

      clientSocket.on('room:join', ({ code, username }, callback) => {
        const normalized = code?.trim().toUpperCase();
        const room = normalized ? rooms.get(normalized) : null;
    
        if (!room) {
          callback?.({ error: 'Sala no encontrada. Verificá el código.' });
          return;
        }
    
        userName = username?.trim() || 'Invitado';
        if (!room.users.some((u: any) => u.id === clientSocket.id)) {
          room.users.push({ id: clientSocket.id, name: userName, isHost: false });
        }
    
        clientSocket.join(normalized);
        currentRoom = normalized;
    
        callback?.(createRoomPayload(room, clientSocket.id));
    
        ioServer.to(normalized).emit('room:users', publicUsers(room));
        clientSocket.to(normalized).emit('chat:message', {
          id: Date.now(),
          user: 'Sistema',
          text: `${userName} se unió a la sala`,
          at: Date.now(),
        });
      });
    
      clientSocket.on('room:leave', () => {
        leaveCurrentRoom();
      });
    
      clientSocket.on('playback:sync', (state) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.hostId !== clientSocket.id) return;
    
        room.playback = { ...state, updatedAt: Date.now() };
        clientSocket.to(currentRoom).emit('playback:sync', room.playback);
      });
    
      clientSocket.on('queue:sync', (queue) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.hostId !== clientSocket.id) return;
    
        room.queue = Array.isArray(queue) ? queue : [];
        clientSocket.to(currentRoom).emit('queue:sync', room.queue);
      });
    
      clientSocket.on('dj:toggle', ({ enabled, autoPlay }, callback) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.hostId !== clientSocket.id) return;

        if (typeof enabled === 'boolean') room.djMode.enabled = enabled;
        if (typeof autoPlay === 'boolean') room.djMode.autoPlay = autoPlay;

        broadcastDjState(currentRoom);
        broadcastDjPool(currentRoom);

        ioServer.to(currentRoom).emit('chat:message', {
          id: Date.now(),
          user: 'Sistema',
          text: room.djMode.enabled
            ? '🎧 Modo DJ activado — la audiencia puede sugerir y votar canciones'
            : 'Modo DJ desactivado',
          at: Date.now(),
        });

        callback?.({ ok: true, djMode: room.djMode });
      });

      clientSocket.on('dj:eq', (eq, callback) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.hostId !== clientSocket.id) return;
        if (!eq || typeof eq !== 'object' || !Array.isArray(eq.bands)) {
          callback?.({ error: 'Valores de EQ inválidos' });
          return;
        }

        const bands = eq.bands.slice(0, 32).map((value: any) => Number(value) || 0);
        while (bands.length < 32) bands.push(0);

        room.djEq = {
          enabled: !!eq.enabled,
          preset: String(eq.preset || 'Flat'),
          bands,
          lowCut: !!eq.lowCut,
          highCut: !!eq.highCut,
        };

        broadcastDjEq(currentRoom);
        ioServer.to(currentRoom).emit('chat:message', {
          id: Date.now(),
          user: 'Sistema',
          text: '🎚️ Ajustes del ecualizador DJ actualizados',
          at: Date.now(),
        });

        callback?.({ ok: true, djEq: room.djEq });
      });

      clientSocket.on('dj:suggest', ({ track }, callback) => {
        if (!currentRoom || !track?.id) return;
        const room = rooms.get(currentRoom);
        if (!room?.djMode.enabled) {
          callback?.({ error: 'El modo DJ no está activo' });
          return;
        }
    
        const duplicate = room.djPool.some((e: any) => e.track.id === track.id);
        if (duplicate) {
          callback?.({ error: 'Esa canción ya está en la votación' });
          return;
        }
    
        const entry = {
          entryId: `dj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          track,
          votes: [clientSocket.id],
          suggestedById: clientSocket.id,
          suggestedByName: userName,
          addedAt: Date.now(),
        };
    
        room.djPool.push(entry);
        broadcastDjPool(currentRoom);
    
        ioServer.to(currentRoom).emit('chat:message', {
          id: Date.now(),
          user: 'Sistema',
          text: `🎵 ${userName} sugirió: ${track.title}`,
          at: Date.now(),
        });
    
        callback?.({ ok: true });
      });
    
      clientSocket.on('dj:vote', ({ entryId }, callback) => {
        if (!currentRoom || !entryId) return;
        const room = rooms.get(currentRoom);
        if (!room?.djMode.enabled) return;
    
        const entry = room.djPool.find((e: any) => e.entryId === entryId);
        if (!entry) {
          callback?.({ error: 'Entrada no encontrada' });
          return;
        }
    
        const alreadyOnThis = entry.votes.includes(clientSocket.id);
        room.djPool.forEach((e: any) => {
          e.votes = e.votes.filter((v: any) => v !== clientSocket.id);
        });
        if (!alreadyOnThis) entry.votes.push(clientSocket.id);
    
        broadcastDjPool(currentRoom);
        callback?.({ ok: true });
      });
    
      clientSocket.on('dj:play-top', (_payload, callback) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.hostId !== clientSocket.id) return;
    
        const winner = getTopDjEntry(room);
        if (!winner) {
          callback?.({ error: 'No hay sugerencias en la votación' });
          return;
        }
    
        room.djPool = room.djPool.filter((e: any) => e.entryId !== winner.entryId);
    
        ioServer.to(currentRoom).emit('dj:play-winner', {
          track: winner.track,
          suggestedByName: winner.suggestedByName,
          voteCount: winner.votes.length,
        });
    
        broadcastDjPool(currentRoom);
    
        ioServer.to(currentRoom).emit('chat:message', {
          id: Date.now(),
          user: 'Sistema',
          text: `▶ Reproduciendo ganadora: ${winner.track.title} (${winner.votes.length} votos)`,
          at: Date.now(),
        });
    
        callback?.({ ok: true, track: winner.track });
      });
    
      clientSocket.on('dj:clear', (_payload, callback) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.hostId !== clientSocket.id) return;
    
        room.djPool = [];
        broadcastDjPool(currentRoom);
        callback?.({ ok: true });
      });
    
      clientSocket.on('chat:message', ({ text }) => {
        if (!currentRoom || !text?.trim()) return;
    
        const room = rooms.get(currentRoom);
        const msg = {
          id: Date.now(),
          user: userName,
          text: text.trim().slice(0, 500),
          at: Date.now(),
        };
    
        room?.chat.push(msg);
        ioServer.to(currentRoom).emit('chat:message', msg);
      });
    
      clientSocket.on('reaction', ({ emoji }) => {
        if (!currentRoom || !emoji) return;
        ioServer.to(currentRoom).emit('reaction', { emoji, user: userName });
      });
    
      function leaveCurrentRoom() {
        if (!currentRoom) return;
    
        const room = rooms.get(currentRoom);
        if (room) {
          room.users = room.users.filter((u: any) => u.id !== clientSocket.id);
          room.djPool.forEach((e: any) => {
            e.votes = e.votes.filter((v: any) => v !== clientSocket.id);
          });
    
          if (room.users.length === 0) {
            rooms.delete(currentRoom);
          } else {
            if (room.hostId === clientSocket.id) {
              room.hostId = room.users[0].id;
              room.users[0].isHost = true;
              ioServer.to(currentRoom).emit('room:host-changed', { hostId: room.hostId });
              ioServer.to(currentRoom).emit('chat:message', {
                id: Date.now(),
                user: 'Sistema',
                text: `${room.users[0].name} ahora es el anfitrión`,
                at: Date.now(),
              });
            }
            ioServer.to(currentRoom).emit('room:users', publicUsers(room));
            broadcastDjPool(currentRoom);
            clientSocket.to(currentRoom).emit('chat:message', {
              id: Date.now(),
              user: 'Sistema',
              text: `${userName} salió de la sala`,
              at: Date.now(),
            });
          }
        }
    
        clientSocket.leave(currentRoom);
        currentRoom = null;
      }
    
      clientSocket.on('disconnect', () => {
        leaveCurrentRoom();
      });
    });
  }

  res.end();
}
