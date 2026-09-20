import { type ModelMessage } from 'ai';
import { ToolRegistry } from '../tools/tool-registry';
import { runLoop } from './loop';
import { MessageQueue } from './queue';
import { type AgentEvent, type AgentEventListener, type Unsubscribe } from './types';

export interface AgentSessionOptions {
  model: any;
  registry: ToolRegistry;
  systemPrompt: string;
  initialMessages?: ModelMessage[];
  maxSteps?: number;
  maxRetries?: number;
}

/**
 * AgentSession 对外门面类
 *
 * 职责：
 * 1. 维护生命周期、上下文 messages
 * 2. 管理双队列：steeringQueue (内层打断/纠偏) 和 followUpQueue (外层对话)
 * 3. 规范发布/订阅机制 (subscribe / emit)
 */
export class AgentSession {
  private model: any;
  private registry: ToolRegistry;
  private systemPrompt: string;
  private messages: ModelMessage[];
  private maxSteps?: number;
  private maxRetries?: number;

  private steeringQueue = new MessageQueue<ModelMessage>();
  private followUpQueue = new MessageQueue<ModelMessage>();
  private listeners: AgentEventListener[] = [];
  private isRunning = false;
  private abortController: AbortController | null = null;

  constructor(options: AgentSessionOptions) {
    this.model = options.model;
    this.registry = options.registry;
    this.systemPrompt = options.systemPrompt;
    this.messages = [...(options.initialMessages ?? [])];
    this.maxSteps = options.maxSteps;
    this.maxRetries = options.maxRetries;
  }

  /**
   * 订阅 Agent 事件流 (发布订阅模式)
   */
  subscribe(listener: AgentEventListener): Unsubscribe {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) {
        this.listeners.splice(idx, 1);
      }
    };
  }

  /**
   * 派发事件给所有消费者
   */
  private emit(event: AgentEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[AgentSession] Listener error:', err);
      }
    }
  }

  /**
   * 发起普通用户消息（推入 followUpQueue，由外层循环消费）
   * 返回一个在本次 Turn 结束或出错时 resolve 的 Promise
   */
  prompt(text: string): Promise<void> {
    const p = new Promise<void>((resolve, reject) => {
      let unsubscribe: Unsubscribe | null = null;
      unsubscribe = this.subscribe((event) => {
        if (event.type === 'turn:end') {
          unsubscribe?.();
          resolve();
        } else if (event.type === 'error') {
          unsubscribe?.();
          reject(event.error);
        }
      });
    });

    this.followUpQueue.push({
      role: 'user',
      content: text,
    });
    this.ensureRunning();
    return p;
  }

  /**
   * 发起紧急纠偏/打断消息（推入 steeringQueue，由内层循环在下一个 Step 消费）
   */
  steer(text: string): void {
    this.steeringQueue.push({
      role: 'user',
      content: `[用户打断/控制指令]: ${text}`,
    });
  }

  /**
   * 启动/确保引擎运行循环
   */
  private ensureRunning(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.abortController = new AbortController();

    void (async () => {
      try {
        await runLoop({
          model: this.model,
          registry: this.registry,
          messages: this.messages,
          system: this.systemPrompt,
          steeringQueue: this.steeringQueue,
          followUpQueue: this.followUpQueue,
          emit: (event) => this.emit(event),
          signal: this.abortController?.signal,
          maxSteps: this.maxSteps,
          maxRetries: this.maxRetries,
        });
      } catch (error) {
        this.emit({ type: 'error', error });
      } finally {
        this.isRunning = false;
        this.abortController = null;
      }
    })();
  }

  /**
   * 获取当前对话历史消息
   */
  getMessages(): ModelMessage[] {
    return [...this.messages];
  }

  /**
   * 主动终止当前执行
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.steeringQueue.close();
    this.followUpQueue.close();
    this.isRunning = false;
  }
}
