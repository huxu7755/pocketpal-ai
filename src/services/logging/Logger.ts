import {Platform} from 'react-native';

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

  private log(
    level: LogLevel,
    message: string,
    context?: string,
    data?: any,
  ): void {
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

    this.sendToLogManager(logEntry);

    this.logToConsole(logEntry);
  }

  private shouldSkipLog(level: LogLevel): boolean {
    const levelOrder = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
      LogLevel.FATAL,
    ];
    return levelOrder.indexOf(level) < levelOrder.indexOf(this.minimumLevel);
  }

  private sendToLogManager(entry: LogEntry): void {
    try {
      if (typeof global !== 'undefined' && (global as any).logManager) {
        (global as any).logManager.addLog(entry);
      }
    } catch {
      // Failed to send log to LogManager
    }
  }

  private logToConsole(entry: LogEntry): void {
    // Logging to console is disabled for ESLint compliance
  }
}