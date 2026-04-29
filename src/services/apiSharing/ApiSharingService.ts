import {ApiServer} from './ApiServer';
import {PortUtils} from '../../utils/PortUtils';

export type ApiSharingStartResult =
  | {type: 'success'; port: number}
  | {type: 'port_conflict'; suggestedPort: number}
  | {type: 'permission_denied'}
  | {type: 'network_error'}
  | {type: 'already_running'; port: number};

export class ApiSharingService {
  private server: ApiServer | null = null;
  private currentApiKey: string | null = null;
  private allowLocalNetwork: boolean = false;

  constructor() {}

  isRunning(): boolean {
    return this.server?.isServerRunning() ?? false;
  }

  getPort(): number {
    return this.server?.getPort() ?? 11434;
  }

  getHost(): string {
    return this.server?.getHost() ?? '127.0.0.1';
  }

  async startServer(
    host: string = '127.0.0.1',
    port: number = 11434,
    apiKey: string | null = null,
    allowLocalNetwork: boolean = false,
  ): Promise<ApiSharingStartResult> {
    if (this.isRunning()) {
      return {type: 'already_running', port: this.getPort()};
    }

    if (!(await PortUtils.isPortAvailable(port))) {
      try {
        const availablePort = await PortUtils.findAvailablePort(port);
        return {type: 'port_conflict', suggestedPort: availablePort};
      } catch {
        return {type: 'network_error'};
      }
    }

    this.currentApiKey = apiKey;
    this.allowLocalNetwork = allowLocalNetwork;

    const actualHost = allowLocalNetwork ? '0.0.0.0' : host;

    try {
      this.server = new ApiServer(actualHost, port, apiKey);
      await this.server.start();
      return {type: 'success', port};
    } catch {
      return {type: 'network_error'};
    }
  }

  stopServer(): void {
    this.server?.stop();
    this.server = null;
    this.currentApiKey = null;
  }

  updateServerStatus(): void {}

  generateRandomKey(): string {
    return 'sk-' + Math.random().toString(36).substring(2, 26);
  }

  setApiKey(apiKey: string | null): void {
    this.currentApiKey = apiKey;
    this.server?.setApiKey(apiKey);
  }

  async testConnection(): Promise<{ok: boolean; error?: string}> {
    if (!this.isRunning()) {
      return {ok: false, error: 'Server is not running'};
    }

    const port = this.getPort();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/models`);
      return {ok: response.ok};
    } catch (error) {
      return {ok: false, error: error instanceof Error ? error.message : 'Unknown error'};
    }
  }
}