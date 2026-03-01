import { WebSocket, WebSocketServer } from 'ws';

interface WsBaseEvent {
  channelId: string;
  requestId: string;
  ts: string;
}

interface WsStreamStartedEvent extends WsBaseEvent {
  type: 'stream-started';
  meta?: { sessionId?: string };
}

interface WsStreamPartialEvent extends WsBaseEvent {
  type: 'stream-partial';
  textDelta: string;
}

interface WsStreamCompletedEvent extends WsBaseEvent {
  type: 'stream-completed';
  fullText: string;
  elapsedMs?: number;
}

interface WsStreamErrorEvent extends WsBaseEvent {
  type: 'stream-error';
  message: string;
  fatal?: boolean;
  elapsedMs?: number;
}

export type WsEvent =
  | WsStreamStartedEvent
  | WsStreamPartialEvent
  | WsStreamCompletedEvent
  | WsStreamErrorEvent;

export interface WsBroadcaster {
  sendStreamStarted(channelId: string, requestId: string, meta?: { sessionId?: string }): void;
  sendStreamPartial(channelId: string, requestId: string, textDelta: string): void;
  sendStreamCompleted(channelId: string, requestId: string, fullText: string, elapsedMs?: number): void;
  sendStreamError(
    channelId: string,
    requestId: string,
    message: string,
    options?: { fatal?: boolean; elapsedMs?: number },
  ): void;
}

const WS_PORT = Number(process.env.WS_PORT ?? 8787);

function safeSend(client: WebSocket, payload: string): void {
  if (client.readyState !== WebSocket.OPEN) return;
  try {
    client.send(payload);
  } catch {
    // 送信失敗は無視
  }
}

export function createWsBroadcaster(): WsBroadcaster {
  const wss = new WebSocketServer({ port: WS_PORT });
  const clients = new Set<WebSocket>();

  wss.on('connection', (socket) => {
    clients.add(socket);
    socket.on('close', () => {
      clients.delete(socket);
    });
  });

  console.log(`[ws] listening on :${WS_PORT}`);

  const broadcast = (event: WsEvent): void => {
    const payload = JSON.stringify(event);
    for (const client of clients) {
      safeSend(client, payload);
    }
  };

  return {
    sendStreamStarted(channelId, requestId, meta) {
      broadcast({
        type: 'stream-started',
        channelId,
        requestId,
        meta,
        ts: new Date().toISOString(),
      });
    },
    sendStreamPartial(channelId, requestId, textDelta) {
      broadcast({
        type: 'stream-partial',
        channelId,
        requestId,
        textDelta,
        ts: new Date().toISOString(),
      });
    },
    sendStreamCompleted(channelId, requestId, fullText, elapsedMs) {
      broadcast({
        type: 'stream-completed',
        channelId,
        requestId,
        fullText,
        elapsedMs,
        ts: new Date().toISOString(),
      });
    },
    sendStreamError(channelId, requestId, message, options) {
      broadcast({
        type: 'stream-error',
        channelId,
        requestId,
        message,
        fatal: options?.fatal,
        elapsedMs: options?.elapsedMs,
        ts: new Date().toISOString(),
      });
    },
  };
}
