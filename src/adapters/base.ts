export interface AdapterRunResult {
  outputLog: string;
  debugLog?: string;
  tokenUsage: number;
  costCents: number;
  success: boolean;
}

export interface AgentAdapter {
  name: string;
  /** 执行一次任务 */
  run(prompt: string, config: Record<string, unknown>): Promise<AdapterRunResult>;
  /** 检查适配器是否可用 */
  isAvailable(): Promise<boolean>;
}
