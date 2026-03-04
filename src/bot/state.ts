import { readFileSync, writeFileSync } from 'fs';
import type { AiResult } from '../adapters';

interface PersistedState {
  activeThreads: string[];
  sessions: Record<string, string>;
}

export function createBotState(stateFile: string) {
  const activeThreads = new Set<string>();
  const sessions = new Map<string, string>();
  const threadUsage = new Map<string, AiResult>();

  function load(): void {
    try {
      const data = readFileSync(stateFile, 'utf-8');
      const state: PersistedState = JSON.parse(data);
      for (const id of state.activeThreads ?? []) {
        activeThreads.add(id);
      }
      for (const [threadId, sessionId] of Object.entries(state.sessions ?? {})) {
        sessions.set(threadId, sessionId);
      }
      console.log(`[state] 復元: threads=${activeThreads.size}, sessions=${sessions.size}`);
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  function save(): void {
    const state: PersistedState = {
      activeThreads: [...activeThreads],
      sessions: Object.fromEntries(sessions),
    };
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  }

  function isActiveThread(threadId: string): boolean {
    return activeThreads.has(threadId);
  }

  function activateThread(threadId: string): void {
    activeThreads.add(threadId);
  }

  function getSession(threadId: string): string | undefined {
    return sessions.get(threadId);
  }

  function setSession(threadId: string, sessionId: string): void {
    sessions.set(threadId, sessionId);
  }

  function clearSession(threadId: string): void {
    sessions.delete(threadId);
    threadUsage.delete(threadId);
  }

  function getUsage(threadId: string): AiResult | undefined {
    return threadUsage.get(threadId);
  }

  function setUsage(threadId: string, usage: AiResult): void {
    threadUsage.set(threadId, usage);
  }

  return {
    load,
    save,
    isActiveThread,
    activateThread,
    getSession,
    setSession,
    clearSession,
    getUsage,
    setUsage,
  };
}
