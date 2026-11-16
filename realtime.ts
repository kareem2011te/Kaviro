import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { getDb } from './store.ts';
import { hashToken } from './security.ts';

interface SocketClient {
  ws: WebSocket;
  userId: string;
  sessionId: string;
}

const clientsByUser = new Map<string, Set<SocketClient>>();
const clientsBySession = new Map<string, SocketClient>();

export function getOnlineUserIds(): string[] {
  return Array.from(clientsByUser.entries())
    .filter(([, set]) => set.size > 0)
    .map(([userId]) => userId);
}

export function broadcastToUsers(userIds: string[], event: string, payload: unknown): void {
  const frame = JSON.stringify({ event, payload });
  for (const uid of userIds) {
    const set = clientsByUser.get(uid);
    if (!set) continue;
    for (const client of set) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(frame);
      }
    }
  }
}

export function broadcastAll(event: string, payload: unknown): void {
  const frame = JSON.stringify({ event, payload });
  for (const set of clientsByUser.values()) {
    for (const client of set) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(frame);
      }
    }
  }
}

export function forceDisconnectSession(sessionId: string, reason: string): void {
  const client = clientsBySession.get(sessionId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify({ event: 'session:revoked', payload: { sessionId, reason } }));
    client.ws.close(4001, 'Session revoked');
  }
}

export function attachWebSocketServer(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url || '/ws', 'http://localhost');
      const rawToken = url.searchParams.get('token') || '';
      if (!rawToken) {
        ws.close(4001, 'Missing token');
        return;
      }

      const db = getDb();
      const tokenHash = hashToken(rawToken);
      const session = db.sessions.find((s) => s.tokenHash === tokenHash && s.status === 'active');
      if (!session) {
        ws.close(4001, 'Invalid or expired session');
        return;
      }

      const client: SocketClient = {
        ws,
        userId: session.userId,
        sessionId: session.id,
      };

      if (!clientsByUser.has(session.userId)) {
        clientsByUser.set(session.userId, new Set());
      }
      clientsByUser.get(session.userId)!.add(client);
      clientsBySession.set(session.id, client);

      ws.send(
        JSON.stringify({
          event: 'presence:init',
          payload: { onlineUserIds: getOnlineUserIds() },
        })
      );
      broadcastAll('presence:update', { onlineUserIds: getOnlineUserIds() });

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString()) as {
            event?: string;
            payload?: { conversationId?: string; isTyping?: boolean };
          };
          if (parsed.event === 'typing' && parsed.payload?.conversationId) {
            const conv = getDb().conversations.find((c) => c.id === parsed.payload?.conversationId);
            if (conv && conv.memberIds.includes(session.userId)) {
              const recipients = conv.memberIds.filter((id) => id !== session.userId);
              broadcastToUsers(recipients, 'typing:update', {
                conversationId: conv.id,
                userId: session.userId,
                isTyping: Boolean(parsed.payload.isTyping),
              });
            }
          }
        } catch {
          // Ignore malformed frames
        }
      });

      ws.on('close', () => {
        const set = clientsByUser.get(session.userId);
        if (set) {
          set.delete(client);
          if (set.size === 0) clientsByUser.delete(session.userId);
        }
        clientsBySession.delete(session.id);
        broadcastAll('presence:update', { onlineUserIds: getOnlineUserIds() });
      });
    } catch {
      ws.close(4000, 'Connection error');
    }
  });
}
