import { NeemeeMcpClient, NeemeeClientOptions } from './client.js';
import { NeemeeTools } from './operations/tools.js';
import { NeemeeResources } from './operations/resources.js';

export class NeemeeClient {
  private mcpClient: NeemeeMcpClient;
  public tools: NeemeeTools;
  public resources: NeemeeResources;

  constructor(options: NeemeeClientOptions) {
    this.mcpClient = new NeemeeMcpClient(options);
    
    this.tools = new NeemeeTools(this.mcpClient.client);
    this.resources = new NeemeeResources(this.mcpClient.client);
  }

  async connect(): Promise<void> {
    await this.mcpClient.connect();
  }

  async disconnect(): Promise<void> {
    await this.mcpClient.disconnect();
  }

  async listAvailableTools(): Promise<any> {
    return await this.mcpClient.client.listTools();
  }

  async listAvailableResources(): Promise<any> {
    return await this.mcpClient.client.listResources();
  }
}

export type {
  NeemeeClientOptions,
  CreateNoteParams,
  UpdateNoteParams,
  SearchNotesParams
} from './client.js';

export {
  NeemeeClientError,
  AuthenticationError,
  ConnectionError,
  NotFoundError,
  ValidationError,
  ServerError
} from './errors.js';

export { LegacyNeemeeClient } from './legacy.js';

export default NeemeeClient;