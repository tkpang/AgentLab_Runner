export interface HeartbeatOutputPayload {
  heartbeatId: string;
  issueId: string | null;
  agentId: string;
  chunk: string;
  structured?: unknown;
}

export type HeartbeatOutputEmitter = (payload: HeartbeatOutputPayload) => void | Promise<void>;

export function emitHeartbeatOutput(config: Record<string, unknown>, payload: HeartbeatOutputPayload): void {
  const maybeEmitter = config._heartbeatOutputEmitter;
  if (typeof maybeEmitter === 'function') {
    try {
      const result = (maybeEmitter as HeartbeatOutputEmitter)(payload);
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(() => {});
      }
      return;
    } catch {
      // no-op
    }
  }
  // Runner standalone mode has no local websocket fallback.
}
