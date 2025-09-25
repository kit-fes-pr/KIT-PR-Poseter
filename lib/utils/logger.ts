/**
 * 統一ログシステム
 * 開発環境と本番環境で異なるログレベルを提供
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogContext {
  component?: string;
  operation?: string;
  userId?: string;
  teamCode?: string;
  year?: number;
  duration?: number;
  extra?: Record<string, unknown>;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const emoji = {
      DEBUG: '🐛',
      INFO: 'ℹ️',
      WARN: '⚠️', 
      ERROR: '❌'
    }[level] || '';

    let formatted = `${emoji} [${timestamp}] ${level}: ${message}`;
    
    if (context) {
      const contextParts: string[] = [];
      if (context.component) contextParts.push(`component=${context.component}`);
      if (context.operation) contextParts.push(`op=${context.operation}`);
      if (context.userId) contextParts.push(`user=${context.userId}`);
      if (context.teamCode) contextParts.push(`team=${context.teamCode}`);
      if (context.year) contextParts.push(`year=${context.year}`);
      if (context.duration !== undefined) contextParts.push(`duration=${context.duration}ms`);
      
      if (contextParts.length > 0) {
        formatted += ` [${contextParts.join(', ')}]`;
      }
    }
    
    return formatted;
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    console.log(this.formatMessage('DEBUG', message, context));
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    console.log(this.formatMessage('INFO', message, context));
  }

  warn(message: string, context?: LogContext, error?: unknown): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    console.warn(this.formatMessage('WARN', message, context));
    if (error && this.isDevelopment) {
      console.warn('詳細:', error);
    }
  }

  error(message: string, context?: LogContext, error?: unknown): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    console.error(this.formatMessage('ERROR', message, context));
    if (error) {
      console.error('エラー詳細:', error);
      const errorObj = error as { stack?: string };
      if (errorObj.stack && this.isDevelopment) {
        console.error('スタックトレース:', errorObj.stack);
      }
    }

    // 本番環境では外部ログサービスに送信（実装例）
    if (!this.isDevelopment) {
      this.sendToExternalLogger();
    }
  }

  // パフォーマンス測定用
  performance(operation: string, duration: number, context?: LogContext): void {
    const perfContext = { ...context, operation, duration };
    
    if (duration > 1000) {
      this.warn(`遅延検出: ${operation}`, perfContext);
    } else if (duration > 500) {
      this.info(`性能情報: ${operation}`, perfContext);
    } else if (this.isDevelopment) {
      this.debug(`性能情報: ${operation}`, perfContext);
    }
  }

  // API呼び出し専用ログ
  apiCall(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void {
    const apiContext = {
      ...context,
      operation: `${method} ${url}`,
      duration
    };

    if (statusCode >= 500) {
      this.error(`API サーバーエラー`, apiContext);
    } else if (statusCode >= 400) {
      this.warn(`API クライアントエラー (${statusCode})`, apiContext);
    } else if (statusCode >= 200 && statusCode < 300) {
      this.debug(`API 成功 (${statusCode})`, apiContext);
    }
  }

  // 認証関連ログ
  auth(event: 'login' | 'logout' | 'verify' | 'error', context?: LogContext): void {
    const authContext = { ...context, operation: `auth_${event}` };
    
    switch (event) {
      case 'login':
        this.info('ユーザーログイン', authContext);
        break;
      case 'logout':
        this.info('ユーザーログアウト', authContext);
        break;
      case 'verify':
        this.debug('認証確認', authContext);
        break;
      case 'error':
        this.error('認証エラー', authContext);
        break;
    }
  }

  private sendToExternalLogger(): void {
    // 本番環境での外部ログサービス連携
    // Sentry, LogRocket, CloudWatch などに送信
    try {
      // 実装例（実際のサービスに応じて変更）
      // Sentry.captureException(error, { 
      //   tags: { component: context?.component },
      //   extra: context
      // });
    } catch (logError) {
      console.error('外部ログサービス送信エラー:', logError);
    }
  }

  // ログレベル変更（デバッグ用）
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`ログレベルを変更しました: ${LogLevel[level]}`);
  }
}

// シングルトンインスタンス
export const logger = Logger.getInstance();

// 便利な関数エクスポート
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context);
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context);
export const logWarn = (message: string, context?: LogContext, error?: unknown) => logger.warn(message, context, error);
export const logError = (message: string, context?: LogContext, error?: unknown) => logger.error(message, context, error);
export const logPerformance = (operation: string, duration: number, context?: LogContext) => logger.performance(operation, duration, context);
export const logApiCall = (method: string, url: string, statusCode: number, duration: number, context?: LogContext) => logger.apiCall(method, url, statusCode, duration, context);
export const logAuth = (event: 'login' | 'logout' | 'verify' | 'error', context?: LogContext) => logger.auth(event, context);

// Hook用のログユーティリティ
export function useLogger(componentName: string) {
  const baseContext: LogContext = { component: componentName };

  return {
    debug: (message: string, context?: Partial<LogContext>) => 
      logger.debug(message, { ...baseContext, ...context }),
    info: (message: string, context?: Partial<LogContext>) => 
      logger.info(message, { ...baseContext, ...context }),
    warn: (message: string, context?: Partial<LogContext>, error?: unknown) => 
      logger.warn(message, { ...baseContext, ...context }, error),
    error: (message: string, context?: Partial<LogContext>, error?: unknown) => 
      logger.error(message, { ...baseContext, ...context }, error),
    performance: (operation: string, duration: number, context?: Partial<LogContext>) =>
      logger.performance(operation, duration, { ...baseContext, ...context })
  };
}

// パフォーマンス測定デコレーター
export function measurePerformance(operationName: string, context?: LogContext) {
  return function <T extends (...args: unknown[]) => unknown>(
    target: unknown,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;
    
    descriptor.value = (async function (this: unknown, ...args: unknown[]) {
      const startTime = Date.now();
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        logger.performance(operationName || propertyName, duration, context);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`${operationName || propertyName} 実行エラー`, 
          { ...context, duration }, error);
        throw error;
      }
    }) as T;

    return descriptor;
  };
}