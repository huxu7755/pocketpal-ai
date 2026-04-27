import * as FileSystem from '@dr.pogodin/react-native-fs';
import LogManager from './LogManager';
import {LogEntry} from './Logger';

export default class LogExporter {
  private static instance: LogExporter;
  private logManager: LogManager;

  private constructor() {
    this.logManager = LogManager.getInstance();
  }

  static getInstance(): LogExporter {
    if (!LogExporter.instance) {
      LogExporter.instance = new LogExporter();
    }
    return LogExporter.instance;
  }

  async exportLogs(): Promise<string | null> {
    try {
      const allLogs = await this.logManager.getAllLogs();

      if (Object.keys(allLogs).length === 0) {
        return null;
      }

      const formattedLogs = this.formatLogs(allLogs);

      const exportDir = `${FileSystem.DocumentDirectoryPath}/logs`;
      const dirExists = await FileSystem.exists(exportDir);
      if (!dirExists) {
        await FileSystem.mkdir(exportDir, {intermediates: true});
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `logs_${timestamp}.txt`;
      const filePath = `${exportDir}/${fileName}`;

      await FileSystem.writeFile(filePath, formattedLogs, 'utf8');

      return filePath;
    } catch {
      return null;
    }
  }

  private formatLogs(logs: Record<string, LogEntry[]>): string {
    let formatted = '=== PocketPal Log Export ===\n';
    formatted += `Exported at: ${new Date().toISOString()}\n`;
    formatted += '============================\n\n';

    const sortedDates = Object.keys(logs).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });

    for (const date of sortedDates) {
      formatted += `=== Logs for ${date} ===\n`;

      const sortedLogs = logs[date].sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      for (const log of sortedLogs) {
        formatted += `[${log.timestamp}] [${log.level.toUpperCase()}]`;
        if (log.context) {
          formatted += ` [${log.context}]`;
        }
        formatted += `: ${log.message}\n`;

        if (log.data) {
          try {
            formatted += `  Data: ${JSON.stringify(log.data, null, 2)}\n`;
          } catch {
            formatted += `  Data: [Failed to stringify]\n`;
          }
        }

        if (log.deviceInfo) {
          formatted += `  Device: ${log.deviceInfo.platform} ${log.deviceInfo.version}\n`;
        }

        formatted += '\n';
      }

      formatted += '\n';
    }

    return formatted;
  }

  async getExportDirectory(): Promise<string> {
    const exportDir = `${FileSystem.DocumentDirectoryPath}/logs`;
    const dirExists = await FileSystem.exists(exportDir);
    if (!dirExists) {
      await FileSystem.mkdir(exportDir, {intermediates: true});
    }
    return exportDir;
  }

  async getExportedFiles(): Promise<string[]> {
    try {
      const exportDir = await this.getExportDirectory();
      const files = await FileSystem.readDir(exportDir);
      return files
        .filter(file => file.isFile() && file.name.endsWith('.txt'))
        .map(file => file.path);
    } catch {
      return [];
    }
  }

  async deleteExportedFile(filePath: string): Promise<boolean> {
    try {
      await FileSystem.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}