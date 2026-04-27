import { makeAutoObservable } from 'mobx';
import { LogLevel } from './Logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class LogStore {
  private static instance: LogStore;
  
  isLoggingEnabled: boolean = true; // Default enabled
  logLevel: LogLevel = LogLevel.DEBUG;
  private _isInitialized: boolean = false;

  private constructor() {
    makeAutoObservable(this);
  }

  static getInstance(): LogStore {
    if (!LogStore.instance) {
      LogStore.instance = new LogStore();
    }
    return LogStore.instance;
  }

  async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Load settings from AsyncStorage
      const enabled = await AsyncStorage.getItem('logging_enabled');
      const level = await AsyncStorage.getItem('logging_level');

      if (enabled !== null) {
        this.isLoggingEnabled = enabled === 'true';
      }

      if (level !== null && Object.values(LogLevel).includes(level as LogLevel)) {
        this.logLevel = level as LogLevel;
      }

      this._isInitialized = true;
    } catch {
      // Silent error handling
    }
  }

  setLoggingEnabled(enabled: boolean): void {
    this.isLoggingEnabled = enabled;
    this.saveSettings();
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.saveSettings();
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem('logging_enabled', String(this.isLoggingEnabled));
      await AsyncStorage.setItem('logging_level', this.logLevel);
    } catch {
      // Silent error handling
    }
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }
}