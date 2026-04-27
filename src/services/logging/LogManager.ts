import AsyncStorage from '@react-native-async-storage/async-storage';
import {LogEntry} from './Logger';

export default class LogManager {
  private static instance: LogManager;
  private isInitialized: boolean = false;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private maxLogSizePerDay: number = 5 * 1024 * 1024;
  private maxDaysToKeep: number = 7;

  private constructor() {}

  static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager();
    }
    return LogManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.cleanupOldLogs();

      this.startPeriodicFlush();

      this.isInitialized = true;
    } catch {
      // Silent error handling
    }
  }

  addLog(entry: LogEntry): void {
    this.logBuffer.push(entry);

    if (this.logBuffer.length >= 50) {
      this.flushLogs();
    }
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flushLogs();
      }
    }, 30000);
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const today = this.getTodayString();
      const logKey = `logs_${today}`;

      const existingLogsJson = await AsyncStorage.getItem(logKey);
      const existingLogs: LogEntry[] = existingLogsJson
        ? JSON.parse(existingLogsJson)
        : [];

      const updatedLogs = [...existingLogs, ...logsToFlush];

      const logsJson = JSON.stringify(updatedLogs);
      if (logsJson.length > this.maxLogSizePerDay) {
        const maxEntries = Math.floor(
          (this.maxLogSizePerDay * 0.9) /
            (logsJson.length / updatedLogs.length),
        );
        const trimmedLogs = updatedLogs.slice(-maxEntries);
        await AsyncStorage.setItem(logKey, JSON.stringify(trimmedLogs));
      } else {
        await AsyncStorage.setItem(logKey, logsJson);
      }
    } catch {
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const logKeys = keys.filter(key => key.startsWith('logs_'));

      const today = new Date();
      for (const key of logKeys) {
        const dateStr = key.replace('logs_', '');
        const logDate = new Date(dateStr);
        const daysDiff =
          (today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff > this.maxDaysToKeep) {
          await AsyncStorage.removeItem(key);
        }
      }
    } catch {
      // Silent error handling
    }
  }

  async getLogsForDate(date: string): Promise<LogEntry[]> {
    try {
      const logKey = `logs_${date}`;
      const logsJson = await AsyncStorage.getItem(logKey);
      return logsJson ? JSON.parse(logsJson) : [];
    } catch {
      return [];
    }
  }

  async getAllLogs(): Promise<Record<string, LogEntry[]>> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const logKeys = keys.filter(key => key.startsWith('logs_'));

      const allLogs: Record<string, LogEntry[]> = {};
      for (const key of logKeys) {
        const dateStr = key.replace('logs_', '');
        const logs = await this.getLogsForDate(dateStr);
        allLogs[dateStr] = logs;
      }

      return allLogs;
    } catch {
      return {};
    }
  }

  async clearAllLogs(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const logKeys = keys.filter(key => key.startsWith('logs_'));
      await AsyncStorage.multiRemove(logKeys);
    } catch {
      // Silent error handling
    }
  }

  private getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  async shutdown(): Promise<void> {
    if (this.logBuffer.length > 0) {
      await this.flushLogs();
    }

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.isInitialized = false;
  }
}
