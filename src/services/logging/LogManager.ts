import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogEntry } from './Logger';

export default class LogManager {
  private static instance: LogManager;
  private isInitialized: boolean = false;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private maxLogSizePerDay: number = 5 * 1024 * 1024; // 5MB per day
  private maxDaysToKeep: number = 7; // Keep logs for 7 days

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
      // Clean up old logs
      await this.cleanupOldLogs();
      
      // Start periodic flush
      this.startPeriodicFlush();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize LogManager:', error);
    }
  }

  addLog(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Flush if buffer is large
    if (this.logBuffer.length >= 50) {
      this.flushLogs();
    }
  }

  private startPeriodicFlush(): void {
    // Flush logs every 30 seconds
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

      // Get existing logs for today
      const existingLogsJson = await AsyncStorage.getItem(logKey);
      const existingLogs: LogEntry[] = existingLogsJson ? JSON.parse(existingLogsJson) : [];

      // Add new logs
      const updatedLogs = [...existingLogs, ...logsToFlush];

      // Check log size
      const logsJson = JSON.stringify(updatedLogs);
      if (logsJson.length > this.maxLogSizePerDay) {
        // If too large, keep only the most recent logs
        const maxEntries = Math.floor((this.maxLogSizePerDay * 0.9) / (logsJson.length / updatedLogs.length));
        const trimmedLogs = updatedLogs.slice(-maxEntries);
        await AsyncStorage.setItem(logKey, JSON.stringify(trimmedLogs));
      } else {
        await AsyncStorage.setItem(logKey, logsJson);
      }
    } catch (error) {
      console.error('Failed to flush logs:', error);
      // Put logs back in buffer if flush failed
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
        const daysDiff = (today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff > this.maxDaysToKeep) {
          await AsyncStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  async getLogsForDate(date: string): Promise<LogEntry[]> {
    try {
      const logKey = `logs_${date}`;
      const logsJson = await AsyncStorage.getItem(logKey);
      return logsJson ? JSON.parse(logsJson) : [];
    } catch (error) {
      console.error('Failed to get logs for date:', error);
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
    } catch (error) {
      console.error('Failed to get all logs:', error);
      return {};
    }
  }

  async clearAllLogs(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const logKeys = keys.filter(key => key.startsWith('logs_'));
      await AsyncStorage.multiRemove(logKeys);
    } catch (error) {
      console.error('Failed to clear all logs:', error);
    }
  }

  private getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  async shutdown(): Promise<void> {
    // Flush any remaining logs
    if (this.logBuffer.length > 0) {
      await this.flushLogs();
    }

    // Clear interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.isInitialized = false;
  }
}