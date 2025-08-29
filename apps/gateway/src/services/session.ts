import { Session, Features, Address } from '@gibberlink/protocol-core';

export interface SessionStore {
  get(sessionId: string): Session | null;
  set(sessionId: string, session: Session): void;
  delete(sessionId: string): void;
  cleanup(): void;
}

export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  get(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (new Date(session.expiresAt) < new Date()) {
      this.delete(sessionId);
      return null;
    }

    return session;
  }

  set(sessionId: string, session: Session): void {
    this.sessions.set(sessionId, session);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  cleanup(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt) < now) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  getStats(): { total: number; active: number } {
    const now = new Date();
    let active = 0;

    for (const session of this.sessions.values()) {
      if (new Date(session.expiresAt) >= now) {
        active++;
      }
    }

    return {
      total: this.sessions.size,
      active,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
}

export class SessionManager {
  private store: SessionStore;

  constructor(store: SessionStore) {
    this.store = store;
  }

  createSession(
    sessionId: string,
    transport: string,
    features: Features,
    peerAddress: Address
  ): Session {
    const session: Session = {
      id: sessionId,
      transport,
      features,
      peerAddress,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    };

    this.store.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): Session | null {
    return this.store.get(sessionId);
  }

  deleteSession(sessionId: string): void {
    this.store.delete(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<Session>): Session | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const updatedSession = { ...session, ...updates };
    this.store.set(sessionId, updatedSession);
    return updatedSession;
  }

  getStats(): { total: number; active: number } {
    if (this.store instanceof InMemorySessionStore) {
      return this.store.getStats();
    }
    return { total: 0, active: 0 };
  }

  destroy(): void {
    if (this.store instanceof InMemorySessionStore) {
      this.store.destroy();
    }
  }
}
