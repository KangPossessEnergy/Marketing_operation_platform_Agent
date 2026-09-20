import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface MCPCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export class MCPClient {
  private process: ChildProcess | null = null;
  private rl: Interface | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private serverName: string;

  constructor(private command: string, private args: string[], private env?: Record<string, string>) {
    this.serverName = args[args.length - 1]?.replace(/^@.*\//, '') || 'mcp-server';
  }

  async connect(): Promise<void> {
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.env },
    });

    this.process.on('error', (err) => {
      console.error(`  [MCP] 进程启动失败: ${err.message}`);
    });

    this.process.stderr?.on('data', () => {});

    this.rl = createInterface({ input: this.process.stdout! });
    this.rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) {
            p.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
          } else {
            p.resolve(msg.result);
          }
        }
      } catch { /* ignore non-JSON lines */ }
    });

    await this.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'super-agent', version: '0.5.0' },
    });

    this.process.stdin!.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }) + '\n');
  }

  private send(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, 15000);

      this.pending.set(id, {
        resolve: (v: any) => { clearTimeout(timeout); resolve(v); },
        reject: (e: Error) => { clearTimeout(timeout); reject(e); },
      });

      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      this.process!.stdin!.write(msg + '\n');
    });
  }

  async listTools(): Promise<MCPTool[]> {
    const result = await this.send('tools/list', {});
    return result.tools || [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result: MCPCallResult = await this.send('tools/call', { name, arguments: args });
    const texts = (result.content || [])
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text!);
    return texts.join('\n') || '(无返回内容)';
  }

  async close(): Promise<void> {
    if (this.rl) this.rl.close();
    if (this.process) this.process.kill();
  }
}

export class MockMCPClient {
  async connect(): Promise<void> {}

  async listTools(): Promise<MCPTool[]> {
    return [
      {
        name: 'list_issues',
        description: '列出 GitHub 仓库的 Issues',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: '仓库所有者' },
            repo: { type: 'string', description: '仓库名称' },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'search_repositories',
        description: '搜索 GitHub 仓库',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_file_contents',
        description: '获取仓库中文件的内容',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: '仓库所有者' },
            repo: { type: 'string', description: '仓库名称' },
            path: { type: 'string', description: '文件路径' },
          },
          required: ['owner', 'repo', 'path'],
        },
      },
    ];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'list_issues':
        return JSON.stringify([
          { number: 42, title: '支持 MCP 协议接入', state: 'open', labels: ['enhancement'] },
          { number: 41, title: '循环检测阈值可配置化', state: 'open', labels: ['feature'] },
          { number: 39, title: 'Token 预算用完后的优雅降级', state: 'closed', labels: ['bug'] },
        ], null, 2);
      case 'search_repositories':
        return JSON.stringify([
          { full_name: 'anthropics/anthropic-sdk-python', stars: 2800, description: 'Anthropic Python SDK' },
          { full_name: 'vercel/ai', stars: 12000, description: 'AI SDK for TypeScript' },
          { full_name: 'modelcontextprotocol/servers', stars: 5600, description: 'MCP Servers' },
        ], null, 2);
      case 'get_file_contents':
        return `# README\n\nThis is a mock file content for ${args.owner}/${args.repo}/${args.path}`;
      default:
        return `未知工具: ${name}`;
    }
  }

  async close(): Promise<void> {}
}
