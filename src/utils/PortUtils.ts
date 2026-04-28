export class PortUtils {
  static isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = require('react-native-tcp-socket').createServer(() => {});
      
      server.on('error', () => {
        server.close();
        resolve(false);
      });

      server.listen(port, '127.0.0.1', () => {
        server.close();
        resolve(true);
      });
    });
  }

  static async findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number> {
    let port = startPort;
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
      port++;
    }
    throw new Error('No available port found');
  }
}