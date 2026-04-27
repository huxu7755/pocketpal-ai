import { Platform } from 'react-native';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  deviceInfo?: {
    platform: string;
    version: string;
    deviceId?: string;
  };
}

export class Logger {
  private static instance: Logger;
  private isEnabled: boolean = true;
  private minimumLevel: LogLevel = LogLevel.DEBUG;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  setMinimumLevel(level: LogLevel): void {
    this.minimumLevel = level;
  }

  debug(message: string, context?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  error(message: string, context?: string, data?: any): void {
    this.log(LogLevel.ERROR, message, context, data);
  }

  fatal(message: string, context?: string, data?: any): void {
    this.log(LogLevel.FATAL, message, context, data);
  }

  private log(level: LogLevel, message: string, context?: string, data?: any): void {
    if (!this.isEnabled || this.shouldSkipLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
      deviceInfo: {
        platform: Platform.OS,
        version: Platform.Version.toString(),
      },
    };

    // Send to LogManager for storage
    this.sendToLogManager(logEntry);

    // Also log to console for immediate debugging
    this.logToConsole(logEntry);
  }

  private shouldSkipLog(level: LogLevel): boolean {
    const levelOrder = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    return levelOrder.indexOf(level) < levelOrder.indexOf(this.minimumLevel);
  }

  private sendToLogManager(entry: LogEntry): void {
    // This will be implemented when LogManager is created
    try {
      // Check if logManager is available globally
      if (typeof global !== 'undefined' && (global as any).logManager) {
        (global as any).logManager.addLog(entry);
      }
    } catch (error) {
      // Failed to send log to LogManager
    }
  }

  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp}`;
    const context = entry.context ? `[${entry.context}] ` : '';
    const logMessage = `${prefix} ${context}${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.log(logMessage, entry.data);
        break;
      case LogLevel.INFO:
        console.info(logMessage, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, entry.data);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(logMessage, entry.data);
        break;
    }
  }
}