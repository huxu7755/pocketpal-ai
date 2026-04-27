import {Logger, LogLevel} from './Logger';
import LogManager from './LogManager';
import LogExporter from './LogExporter';
import {LogStore} from './LogStore';

// Create instances
const logger = Logger.getInstance();
const logManager = LogManager.getInstance();
const logExporter = LogExporter.getInstance();
const logStore = LogStore.getInstance();

// Expose to global for easy access
declare global {
  var logManager: LogManager;
  var logger: Logger;
}

global.logManager = logManager;
global.logger = logger;

// Initialize logging system
export const initializeLogging = async (): Promise<void> => {
  try {
    // Initialize store first to get settings
    await logStore.initialize();

    // Configure logger based on settings
    logger.setEnabled(logStore.isLoggingEnabled);
    logger.setMinimumLevel(logStore.logLevel);

    // Initialize log manager
    await logManager.initialize();

    // Log initialization
    logger.info('Logging system initialized', 'Logging');
  } catch {
    // Silent error handling
  }
};

// Shutdown logging system
export const shutdownLogging = async (): Promise<void> => {
  try {
    await logManager.shutdown();
    logger.info('Logging system shutdown', 'Logging');
  } catch {
    // Silent error handling
  }
};

// Reconfigure logger when settings change
export const reconfigureLogger = (): void => {
  logger.setEnabled(logStore.isLoggingEnabled);
  logger.setMinimumLevel(logStore.logLevel);
  logger.info('Logger reconfigured', 'Logging');
};

export {logger, logManager, logStore, LogLevel};
export default logExporter;
