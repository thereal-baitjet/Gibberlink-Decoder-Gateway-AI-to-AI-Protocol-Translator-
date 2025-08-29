import fs from 'fs/promises';
import path from 'path';
import { AuditLog } from '@gibberlink/protocol-core';

export interface AuditConfig {
  logPath: string;
  maxFileSize: number;
  maxFiles: number;
}

export class AuditLogger {
  private config: AuditConfig;
  private logStream?: fs.FileHandle;

  constructor(config: AuditConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Ensure log directory exists
    const logDir = path.dirname(this.config.logPath);
    await fs.mkdir(logDir, { recursive: true });

    // Open log file for appending
    this.logStream = await fs.open(this.config.logPath, 'a');
  }

  async log(auditEntry: AuditLog): Promise<void> {
    if (!this.logStream) {
      throw new Error('Audit logger not initialized');
    }

    const logLine = JSON.stringify(auditEntry) + '\n';
    await this.logStream.write(logLine);

    // Check if we need to rotate logs
    await this.checkRotation();
  }

  async getTranscript(msgId: string): Promise<AuditLog | null> {
    if (!this.logStream) {
      throw new Error('Audit logger not initialized');
    }

    // Read the log file and find the entry
    const content = await fs.readFile(this.config.logPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const entry: AuditLog = JSON.parse(line);
        if (entry.msgId === msgId) {
          return entry;
        }
      } catch (error) {
        console.warn('Failed to parse audit log line:', error);
      }
    }

    return null;
  }

  async searchTranscripts(query: {
    actor?: string;
    route?: string;
    startTime?: string;
    endTime?: string;
    policyDecision?: 'allow' | 'deny';
  }): Promise<AuditLog[]> {
    if (!this.logStream) {
      throw new Error('Audit logger not initialized');
    }

    const content = await fs.readFile(this.config.logPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const results: AuditLog[] = [];

    for (const line of lines) {
      try {
        const entry: AuditLog = JSON.parse(line);
        
        // Apply filters
        if (query.actor && entry.actor !== query.actor) continue;
        if (query.route && entry.route !== query.route) continue;
        if (query.policyDecision && entry.policyDecision !== query.policyDecision) continue;
        
        if (query.startTime && entry.timestamp < query.startTime) continue;
        if (query.endTime && entry.timestamp > query.endTime) continue;

        results.push(entry);
      } catch (error) {
        console.warn('Failed to parse audit log line:', error);
      }
    }

    return results;
  }

  private async checkRotation(): Promise<void> {
    if (!this.logStream) return;

    try {
      const stats = await this.logStream.stat();
      
      if (stats.size > this.config.maxFileSize) {
        await this.rotateLogs();
      }
    } catch (error) {
      console.warn('Failed to check log rotation:', error);
    }
  }

  private async rotateLogs(): Promise<void> {
    if (!this.logStream) return;

    // Close current log file
    await this.logStream.close();

    // Rotate existing log files
    for (let i = this.config.maxFiles - 1; i > 0; i--) {
      const oldPath = `${this.config.logPath}.${i}`;
      const newPath = `${this.config.logPath}.${i + 1}`;
      
      try {
        await fs.rename(oldPath, newPath);
      } catch (error) {
        // File doesn't exist, that's okay
      }
    }

    // Move current log to .1
    try {
      await fs.rename(this.config.logPath, `${this.config.logPath}.1`);
    } catch (error) {
      console.warn('Failed to rotate current log file:', error);
    }

    // Reopen log file
    this.logStream = await fs.open(this.config.logPath, 'a');
  }

  async close(): Promise<void> {
    if (this.logStream) {
      await this.logStream.close();
    }
  }
}

export const defaultAuditConfig: AuditConfig = {
  logPath: './logs/audit.jsonl',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
};
