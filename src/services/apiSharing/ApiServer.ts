const TCP = require('react-native-tcp-socket');

interface RequestData {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: any;
}

export class ApiServer {
  private server: any = null;
  private port: number = 11434;
  private host: string = '127.0.0.1';
  private apiKey: string | null = null;
  private running = false;

  constructor(host: string = '127.0.0.1', port: number = 11434, apiKey: string | null = null) {
    this.host = host;
    this.port = port;
    this.apiKey = apiKey;
  }

  setApiKey(apiKey: string | null): void {
    this.apiKey = apiKey;
  }

  isServerRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    return this.port;
  }

  getHost(): string {
    return this.host;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = TCP.createServer((socket: any) => {
        socket.on('data', (data: Buffer) => {
          this.handleRequest(socket, data);
        });

        socket.on('error', () => {
          // Silent error handling
        });

        socket.on('close', () => {
          // Connection closed
        });
      });

      this.server.listen(this.port, this.host, () => {
        this.running = true;
        resolve();
      });

      this.server.on('error', (error: any) => {
        this.running = false;
        reject(error);
      });
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.running = false;
    }
  }

  private parseRequest(data: Buffer): RequestData | null {
    try {
      const requestStr = data.toString('utf-8');
      const lines = requestStr.split('\r\n');
      
      if (lines.length === 0) return null;

      const firstLine = lines[0];
      const [method, path] = firstLine.split(' ');

      const headers: Record<string, string> = {};
      let bodyStartIndex = -1;

      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '') {
          bodyStartIndex = i + 1;
          break;
        }
        const [key, value] = lines[i].split(': ');
        if (key && value) {
          headers[key.toLowerCase()] = value;
        }
      }

      let body: any = null;
      if (bodyStartIndex !== -1 && headers['content-type']?.includes('application/json')) {
        const bodyStr = lines.slice(bodyStartIndex).join('\r\n');
        try {
          body = JSON.parse(bodyStr);
        } catch {
          // Invalid JSON body
        }
      }

      return { method, path, headers, body };
    } catch {
      return null;
    }
  }

  private async handleRequest(socket: any, data: Buffer) {
    const request = this.parseRequest(data);
    if (!request) {
      this.sendResponse(socket, 400, 'Bad Request');
      return;
    }

    if (!this.authenticate(request.headers)) {
      this.sendResponse(socket, 401, JSON.stringify({ error: { message: 'Invalid API Key' } }));
      return;
    }

    try {
      await this.routeRequest(socket, request);
    } catch (error) {
      this.sendResponse(socket, 500, JSON.stringify({ error: { message: 'Internal Server Error' } }));
    }
  }

  private authenticate(headers: Record<string, string>): boolean {
    if (!this.apiKey || this.apiKey === '') {
      return true;
    }

    const authHeader = headers['authorization'];
    if (!authHeader) {
      return false;
    }

    const match = authHeader.match(/Bearer\s+(.+)/);
    if (!match || match[1] !== this.apiKey) {
      return false;
    }

    return true;
  }

  private async routeRequest(socket: any, request: RequestData) {
    const { method, path } = request;

    if (method === 'GET' && path === '/v1/models') {
      await this.handleGetModels(socket);
    } else if (method === 'POST' && path === '/v1/chat/completions') {
      await this.handleChatCompletions(socket, request.body);
    } else {
      this.sendResponse(socket, 404, JSON.stringify({ error: { message: 'Not Found' } }));
    }
  }

  private async handleGetModels(socket: any) {
    const response = JSON.stringify({
      object: 'list',
      data: [],
    });
    this.sendResponse(socket, 200, response, { 'Content-Type': 'application/json' });
  }

  private async handleChatCompletions(socket: any, body: any) {
    const response = JSON.stringify({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Date.now(),
      model: 'PocketPal-Local',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'API sharing is enabled but model inference is not yet implemented.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    });
    this.sendResponse(socket, 200, response, { 'Content-Type': 'application/json' });
  }

  private sendResponse(socket: any, statusCode: number, body: string, headers: Record<string, string> = {}) {
    const statusText = this.getStatusText(statusCode);
    let response = `HTTP/1.1 ${statusCode} ${statusText}\r\n`;
    
    response += 'Access-Control-Allow-Origin: *\r\n';
    response += 'Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n';
    response += 'Access-Control-Allow-Headers: *\r\n';
    response += `Content-Length: ${Buffer.byteLength(body, 'utf-8')}\r\n`;
    
    if (headers['Content-Type']) {
      response += `Content-Type: ${headers['Content-Type']}\r\n`;
    } else {
      response += 'Content-Type: text/plain\r\n';
    }
    
    response += '\r\n';
    response += body;

    socket.write(response);
    socket.destroy();
  }

  private getStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      400: 'Bad Request',
      401: 'Unauthorized',
      404: 'Not Found',
      500: 'Internal Server Error',
    };
    return statusTexts[statusCode] || 'Unknown Status';
  }
}