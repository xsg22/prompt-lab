/**
 * 并发控制工具类
 * 用于控制异步任务的并发执行数量
 */

/**
 * 并发控制配置接口
 */
export interface ConcurrencyConfig {
  maxConcurrency: number;
  onProgress?: (completed: number, total: number) => void;
  onError?: (error: any, index: number) => void;
}

/**
 * 使用并发控制处理一组异步任务
 * @param items 要处理的项目数组
 * @param processor 处理单个项目的异步函数
 * @param maxConcurrency 最大并发数，默认为5
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
 * await processWithConcurrency(
 *   items,
 *   async (item, index) => {
 *     console.log(`Processing item ${item} at index ${index}`);
 *     await delay(1000); // 模拟异步操作
 *   },
 *   3 // 最多3个并发
 * );
 * ```
 */
export const processWithConcurrency = async <T>(
  items: T[],
  processor: (item: T, index: number) => Promise<void>,
  maxConcurrency: number = 5
): Promise<void> => {
  if (items.length === 0) return;
  if (maxConcurrency <= 0) throw new Error('maxConcurrency must be greater than 0');

  let currentIndex = 0;
  const inProgress = new Set<Promise<void>>();

  const executeNext = async (): Promise<void> => {
    if (currentIndex >= items.length) return;

    const index = currentIndex++;
    const item = items[index];

    const task = processor(item, index).finally(() => {
      inProgress.delete(task);
      // 当一个任务完成时，启动下一个任务
      if (currentIndex < items.length) {
        executeNext();
      }
    });

    inProgress.add(task);
  };

  // 启动初始的并发任务
  const initialConcurrency = Math.min(maxConcurrency, items.length);
  const startTasks = [];
  for (let i = 0; i < initialConcurrency; i++) {
    startTasks.push(executeNext());
  }

  await Promise.all(startTasks);

  // 等待所有任务完成
  while (inProgress.size > 0) {
    await Promise.race(inProgress);
  }
};

/**
 * 带进度回调的并发控制处理函数
 * @param items 要处理的项目数组
 * @param processor 处理单个项目的异步函数
 * @param config 并发控制配置
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * await processWithConcurrencyAndProgress(
 *   items,
 *   async (item, index) => {
 *     // 处理逻辑
 *   },
 *   {
 *     maxConcurrency: 3,
 *     onProgress: (completed, total) => {
 *       console.log(`Progress: ${completed}/${total}`);
 *     },
 *     onError: (error, index) => {
 *       console.error(`Error at index ${index}:`, error);
 *     }
 *   }
 * );
 * ```
 */
export const processWithConcurrencyAndProgress = async <T>(
  items: T[],
  processor: (item: T, index: number) => Promise<void>,
  config: ConcurrencyConfig
): Promise<void> => {
  if (items.length === 0) return;
  if (config.maxConcurrency <= 0) throw new Error('maxConcurrency must be greater than 0');

  let currentIndex = 0;
  let completedCount = 0;
  const inProgress = new Set<Promise<void>>();

  const executeNext = async (): Promise<void> => {
    if (currentIndex >= items.length) return;

    const index = currentIndex++;
    const item = items[index];

    const task = (async () => {
      try {
        await processor(item, index);
        completedCount++;
        config.onProgress?.(completedCount, items.length);
      } catch (error) {
        completedCount++;
        config.onError?.(error, index);
        config.onProgress?.(completedCount, items.length);
      }
    })().finally(() => {
      inProgress.delete(task);
      // 当一个任务完成时，启动下一个任务
      if (currentIndex < items.length) {
        executeNext();
      }
    });

    inProgress.add(task);
  };

  // 启动初始的并发任务
  const initialConcurrency = Math.min(config.maxConcurrency, items.length);
  const startTasks = [];
  for (let i = 0; i < initialConcurrency; i++) {
    startTasks.push(executeNext());
  }

  await Promise.all(startTasks);

  // 等待所有任务完成
  while (inProgress.size > 0) {
    await Promise.race(inProgress);
  }
};

/**
 * 简单的延迟函数，用于测试
 * @param ms 延迟毫秒数
 * @returns Promise<void>
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 并发控制执行器类
 * 提供更高级的并发控制功能
 */
export class ConcurrencyController<T> {
  private maxConcurrency: number;
  private completedCount = 0;
  private inProgress = new Set<Promise<void>>();
  private items: T[] = [];
  private processor?: (item: T, index: number) => Promise<void>;

  constructor(maxConcurrency: number = 5) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * 设置要处理的项目
   * @param items 项目数组
   * @returns ConcurrencyController
   */
  setItems(items: T[]): ConcurrencyController<T> {
    this.items = items;
    this.reset();
    return this;
  }

  /**
   * 设置处理函数
   * @param processor 处理函数
   * @returns ConcurrencyController
   */
  setProcessor(processor: (item: T, index: number) => Promise<void>): ConcurrencyController<T> {
    this.processor = processor;
    return this;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.completedCount = 0;
    this.inProgress.clear();
  }

  /**
   * 执行处理
   * @returns Promise<void>
   */
  async execute(): Promise<void> {
    if (!this.processor) throw new Error('Processor not set');
    if (this.items.length === 0) return;

    return processWithConcurrency(this.items, this.processor, this.maxConcurrency);
  }

  /**
   * 获取进度信息
   * @returns 进度对象
   */
  getProgress(): { completed: number; total: number; percentage: number } {
    return {
      completed: this.completedCount,
      total: this.items.length,
      percentage: this.items.length > 0 ? (this.completedCount / this.items.length) * 100 : 0
    };
  }
} 