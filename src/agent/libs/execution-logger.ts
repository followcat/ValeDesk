/**
 * Execution Logger - Structured logging for LLM execution and reasoning
 * Logs to: {app_data_dir}/logs/execution-{date}.jsonl
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

type LogLevel = 'info' | 'debug' | 'warn' | 'error';

type BaseLogEntry = {
  timestamp: string;
  sessionId: string;
  level: LogLevel;
  type: string;
};

type LLMRequestLog = BaseLogEntry & {
  type: 'llm_request';
  model: string;
  messageCount: number;
  toolCount: number;
  hasAttachments: boolean;
};

type LLMResponseLog = BaseLogEntry & {
  type: 'llm_response';
  finishReason: string;
  textLength: number;
  toolCallsCount: number;
  thinkingLength?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
};

type ToolExecutionLog = BaseLogEntry & {
  type: 'tool_execution';
  toolName: string;
  toolUseId: string;
  input: any;
  status: 'start' | 'success' | 'error' | 'permission_required';
  result?: any;
  error?: string;
  durationMs?: number;
};

type ReasoningLog = BaseLogEntry & {
  type: 'reasoning';
  thinking: string;
  context?: string;
};

type DecisionLog = BaseLogEntry & {
  type: 'decision';
  decision: string;
  reason: string;
  context?: any;
};

type IterationLog = BaseLogEntry & {
  type: 'iteration';
  iteration: number;
  action: 'start' | 'complete';
  totalInputTokens: number;
  totalOutputTokens: number;
  elapsedMs: number;
};

type LogEntry = 
  | LLMRequestLog 
  | LLMResponseLog 
  | ToolExecutionLog 
  | ReasoningLog 
  | DecisionLog 
  | IterationLog;

class ExecutionLogger {
  private logDir: string | null = null;
  private currentLogFile: string | null = null;
  private sessionId: string = '';
  private enabled: boolean = true;

  constructor() {
    this.initLogDir();
  }

  private initLogDir() {
    try {
      const userDataDir = process.env.VALERA_USER_DATA_DIR;
      if (!userDataDir) {
        console.warn('[ExecutionLogger] VALERA_USER_DATA_DIR not set, logging disabled');
        this.enabled = false;
        return;
      }

      this.logDir = join(userDataDir, 'logs');
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }

      // Create log file for today
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      this.currentLogFile = join(this.logDir, `execution-${today}.jsonl`);
      
      console.log(`[ExecutionLogger] Initialized: ${this.currentLogFile}`);
    } catch (error) {
      console.error('[ExecutionLogger] Failed to initialize:', error);
      this.enabled = false;
    }
  }

  setSession(sessionId: string) {
    this.sessionId = sessionId;
  }

  private writeLog(entry: LogEntry) {
    if (!this.enabled || !this.currentLogFile) return;

    try {
      const line = JSON.stringify(entry) + '\n';
      appendFileSync(this.currentLogFile, line, 'utf-8');
    } catch (error) {
      console.error('[ExecutionLogger] Failed to write log:', error);
    }
  }

  logLLMRequest(data: {
    model: string;
    messageCount: number;
    toolCount: number;
    hasAttachments: boolean;
  }) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'llm_request',
      ...data
    });
  }

  logLLMResponse(data: {
    finishReason: string;
    textLength: number;
    toolCallsCount: number;
    thinkingLength?: number;
    inputTokens?: number;
    outputTokens?: number;
    durationMs: number;
  }) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'llm_response',
      ...data
    });
  }

  logToolExecution(data: {
    toolName: string;
    toolUseId: string;
    input: any;
    status: 'start' | 'success' | 'error' | 'permission_required';
    result?: any;
    error?: string;
    durationMs?: number;
  }) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: data.status === 'error' ? 'error' : 'info',
      type: 'tool_execution',
      ...data
    });
  }

  logReasoning(thinking: string, context?: string) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'debug',
      type: 'reasoning',
      thinking,
      context
    });
  }

  logDecision(decision: string, reason: string, context?: any) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'decision',
      decision,
      reason,
      context
    });
  }

  logIteration(data: {
    iteration: number;
    action: 'start' | 'complete';
    totalInputTokens: number;
    totalOutputTokens: number;
    elapsedMs: number;
  }) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'iteration',
      ...data
    });
  }
}

// Singleton instance
export const executionLogger = new ExecutionLogger();
