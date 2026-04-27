import {Server} from 'react-native-http-server';
import {serverStore} from '../../store';
import {ModelStore} from '../../store/ModelStore';
import {CompletionResult, CompletionStreamData} from '../../utils/completionTypes';

class ApiSharingService {
  private server: Server | null = null;
  private port = 3000;

  constructor(private modelStore: ModelStore) {}

  startServer(): void {
    if (this.server) {
      this.stopServer();
    }

    this.server = new Server((req: any, res: any) => {
      this.handleRequest(req, res);
    });

    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`API Sharing server started on port ${this.port}`);
    });
  }

  stopServer(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
      console.log('API Sharing server stopped');
    }
  }

  private handleRequest(req: any, res: any): void {
    const {method, url, headers} = req;

    // Check if API sharing is enabled
    if (!serverStore.apiSharingEnabled) {
      this.sendError(res, 403, 'API sharing is disabled');
      return;
    }

    // Check API key if provided
    if (serverStore.apiSharingKey) {
      const authHeader = headers.authorization;
      if (!authHeader) {
        this.sendError(res, 401, 'API key required');
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      if (token !== serverStore.apiSharingKey) {
        this.sendError(res, 401, 'Invalid API key');
        return;
      }
    }

    // Handle different endpoints
    if (method === 'GET' && url === '/v1/models') {
      this.handleGetModels(res);
    } else if (method === 'POST' && url === '/v1/chat/completions') {
      this.handleChatCompletions(req, res);
    } else {
      this.sendError(res, 404, 'Endpoint not found');
    }
  }

  private handleGetModels(res: any): void {
    const models = this.modelStore.models.filter(model => model.isDownloaded);
    const modelInfos = models.map(model => ({
      id: model.id,
      object: 'model',
      owned_by: 'pocketpal',
    }));

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({data: modelInfos}));
  }

  private handleChatCompletions(req: any, res: any): void {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const {model, messages, temperature = 0.7, max_tokens = 1000, stream = false} = data;

        // Find the model
        const targetModel = this.modelStore.models.find(m => m.id === model);
        if (!targetModel) {
          this.sendError(res, 404, `Model ${model} not found`);
          return;
        }

        // Check if model is loaded
        if (!this.modelStore.isModelLoaded(targetModel.id)) {
          this.sendError(res, 400, `Model ${model} not loaded. Please initialize the model first.`);
          return;
        }

        if (stream) {
          this.handleStreamingCompletion(res, targetModel.id, messages, temperature, max_tokens);
        } else {
          this.handleNonStreamingCompletion(res, targetModel.id, messages, temperature, max_tokens);
        }
      } catch (error) {
        this.sendError(res, 400, 'Invalid request body');
      }
    });
  }

  private async handleNonStreamingCompletion(
    res: any,
    modelId: string,
    messages: any[],
    temperature: number,
    maxTokens: number
  ): Promise<void> {
    try {
      const result = await this.modelStore.getModel(modelId).complete({
        prompt: messages.map(msg => `${msg.role}: ${msg.content}`).join('\n'),
        temperature,
        max_tokens: maxTokens,
      });

      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: result.text,
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: result.tokens_predicted || 0,
          total_tokens: result.tokens_predicted || 0,
        },
      }));
    } catch (error) {
      this.sendError(res, 500, 'Internal server error');
    }
  }

  private handleStreamingCompletion(
    res: any,
    modelId: string,
    messages: any[],
    temperature: number,
    maxTokens: number
  ): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const onToken = (data: CompletionStreamData) => {
      const chunk = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{
          index: 0,
          delta: {
            content: data.token,
          },
          finish_reason: null,
        }],
      };

      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    };

    const onComplete = (result: CompletionResult) => {
      const finalChunk = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelId,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      };

      res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    };

    const onError = (error: any) => {
      this.sendError(res, 500, 'Streaming error');
    };

    this.modelStore.getModel(modelId).complete({
      prompt: messages.map(msg => `${msg.role}: ${msg.content}`).join('\n'),
      temperature,
      max_tokens: maxTokens,
      stream: true,
      onToken,
    }).then(onComplete).catch(onError);
  }

  private sendError(res: any, statusCode: number, message: string): void {
    res.writeHead(statusCode, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      error: {
        message,
        type: 'invalid_request_error',
        param: null,
        code: null,
      },
    }));
  }

  updateServerStatus(): void {
    if (serverStore.apiSharingEnabled) {
      this.startServer();
    } else {
      this.stopServer();
    }
  }
}

export default ApiSharingService;