/**
 * 异步双端安全消息队列
 * 支持同步非阻塞全部弹出 (drain) 与异步挂起等待 (popAsync)
 */
export class MessageQueue<T> {
  private items: T[] = [];
  private waitResolvers: ((item: T | null) => void)[] = [];

  /**
   * 向队列末尾推入一个或多个元素
   */
  push(...elements: T[]): void {
    for (const item of elements) {
      if (this.waitResolvers.length > 0) {
        const resolve = this.waitResolvers.shift()!;
        resolve(item);
      } else {
        this.items.push(item);
      }
    }
  }

  /**
   * 非阻塞式同步清空并返回当前队列所有积压的消息
   */
  drain(): T[] {
    const list = [...this.items];
    this.items = [];
    return list;
  }

  /**
   * 异步等待并弹出一个元素
   * 若队列为空则返回 Promise 挂起，直到有新消息 push 或收到终止信号
   */
  async popAsync(): Promise<T | null> {
    if (this.items.length > 0) {
      return this.items.shift()!;
    }
    return new Promise((resolve) => {
      this.waitResolvers.push(resolve);
    });
  }

  /**
   * 查看当前队列头部元素（不弹出）
   */
  peek(): T | undefined {
    return this.items[0];
  }

  /**
   * 判断队列当前是否有未消费积压
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * 获取当前队列积压数量
   */
  size(): number {
    return this.items.length;
  }

  /**
   * 清理队列并唤醒所有等待者（返回 null）
   */
  close(): void {
    this.items = [];
    while (this.waitResolvers.length > 0) {
      const resolve = this.waitResolvers.shift()!;
      resolve(null);
    }
  }
}
