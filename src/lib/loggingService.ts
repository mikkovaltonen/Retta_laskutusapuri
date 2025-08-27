/**
 * Keskitetty lokituspalvelu sovelluksen debug- ja virhelokien hallintaan
 * Tallentaa lokit muistipuskuriin ja mahdollistaa niiden tallennuksen tietokantaan
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  action: string;
  message?: string;
  data?: any;
  sessionId?: string;
  userId?: string;
}

export interface ChatSessionLog {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  logs: LogEntry[];
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    functionCalls?: string[];
  }>;
  metadata: {
    totalMessages: number;
    totalFunctionCalls: number;
    totalErrors: number;
    systemPrompt?: string;
    uploadedFileName?: string;
    ostolaskuDataSample?: any;
    contextUsage?: {
      systemPromptTokens: number;
      messagesTokens: number;
      ostolaskuDataTokens: number;
      totalTokens: number;
    };
  };
  llmInteractions?: Array<{
    input: string;
    output: string;
    timestamp: Date;
    model?: string;
    functionCalls?: any[];
  }>;
  userFeedback?: {
    rating: 'thumbs_up' | 'thumbs_down';
    comment?: string;
    timestamp: Date;
  };
}

class LoggingService {
  private static instance: LoggingService;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 500; // Säilytä viimeiset 500 lokia muistissa
  private sessionLogs: Map<string, LogEntry[]> = new Map();
  private llmInteractions: Map<string, Array<{input: string; output: string; timestamp: Date; model?: string; functionCalls?: any[]}>> = new Map();
  private isProduction = import.meta.env.PROD;
  private debugMode = localStorage.getItem('debugMode') === 'true';
  private focusedLogging = true; // Focus on empty responses and UI issues

  private constructor() {}

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  /**
   * Kirjaa viestin määritetyllä tasolla
   */
  log(
    level: LogLevel,
    component: string,
    action: string,
    message?: string,
    data?: any,
    sessionId?: string
  ): void {
    // Focus mode: Only log critical issues
    if (this.focusedLogging && !this.isCriticalLog(level, action, message)) {
      return;
    }
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      component,
      action,
      message,
      data: this.sanitizeData(data),
      sessionId,
      userId: this.getCurrentUserId()
    };

    // Lisää puskuriin
    this.addToBuffer(entry);

    // Lisää session-lokeihin jos sessionId annettu
    if (sessionId) {
      this.addToSessionLog(sessionId, entry);
    }

    // Tulosta konsoliin kehitysympäristössä tai debug-tilassa
    if (!this.isProduction || this.debugMode) {
      this.logToConsole(entry);
    }
  }

  /**
   * Helppokäyttöiset metodit eri lokitasoille
   */
  debug(component: string, action: string, message?: string, data?: any, sessionId?: string): void {
    this.log('DEBUG', component, action, message, data, sessionId);
  }

  info(component: string, action: string, message?: string, data?: any, sessionId?: string): void {
    this.log('INFO', component, action, message, data, sessionId);
  }

  warn(component: string, action: string, message?: string, data?: any, sessionId?: string): void {
    this.log('WARN', component, action, message, data, sessionId);
  }

  error(component: string, action: string, message?: string, data?: any, sessionId?: string): void {
    this.log('ERROR', component, action, message, data, sessionId);
  }

  /**
   * Aloita uusi session-lokitus
   */
  startSession(sessionId: string): void {
    this.sessionLogs.set(sessionId, []);
    this.info('LoggingService', 'startSession', `Session started: ${sessionId}`, null, sessionId);
  }

  /**
   * Lopeta session-lokitus ja palauta kaikki lokit
   */
  endSession(sessionId: string): LogEntry[] {
    const logs = this.sessionLogs.get(sessionId) || [];
    this.info('LoggingService', 'endSession', `Session ended: ${sessionId}`, { logCount: logs.length }, sessionId);
    return logs;
  }

  /**
   * Hae session-lokit
   */
  getSessionLogs(sessionId: string): LogEntry[] {
    return this.sessionLogs.get(sessionId) || [];
  }

  /**
   * Tyhjennä session-lokit
   */
  clearSessionLogs(sessionId: string): void {
    this.sessionLogs.delete(sessionId);
  }

  /**
   * Hae kaikki puskuroidut lokit
   */
  getAllLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Hae lokit tietyltä aikaväliltä
   */
  getLogsByTimeRange(startTime: Date, endTime: Date): LogEntry[] {
    return this.logBuffer.filter(
      log => log.timestamp >= startTime && log.timestamp <= endTime
    );
  }

  /**
   * Hae lokit komponentin mukaan
   */
  getLogsByComponent(component: string): LogEntry[] {
    return this.logBuffer.filter(log => log.component === component);
  }

  /**
   * Tyhjennä lokipuskuri
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Aseta debug-tila
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    localStorage.setItem('debugMode', enabled ? 'true' : 'false');
    this.info('LoggingService', 'setDebugMode', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Onko debug-tila päällä
   */
  isDebugMode(): boolean {
    return this.debugMode;
  }

  /**
   * Valmistele chat-session tallennusta varten
   */
  prepareChatSessionLog(
    sessionId: string,
    messages: Array<any>,
    systemPrompt?: string,
    uploadedFileName?: string,
    ostolaskuData?: any[]
  ): ChatSessionLog {
    const logs = this.getSessionLogs(sessionId);
    const errorCount = logs.filter(log => log.level === 'ERROR').length;
    const functionCallCount = messages.filter(m => m.functionCalls && m.functionCalls.length > 0)
      .reduce((acc, m) => acc + (m.functionCalls?.length || 0), 0);

    // Ota näyte ostolaskuDatasta (max 3 riviä)
    const ostolaskuDataSample = ostolaskuData && ostolaskuData.length > 0
      ? ostolaskuData.slice(0, 3)
      : null;
    
    // Laske kontekstin käyttö
    const contextUsage = this.calculateContextUsage(systemPrompt, messages, ostolaskuData);

    return {
      sessionId,
      userId: this.getCurrentUserId(),
      startTime: logs[0]?.timestamp || new Date(),
      endTime: new Date(),
      logs: logs,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        functionCalls: m.functionCalls
      })),
      metadata: {
        totalMessages: messages.length,
        totalFunctionCalls: functionCallCount,
        totalErrors: errorCount,
        systemPrompt,
        uploadedFileName,
        ostolaskuDataSample,
        contextUsage
      },
      llmInteractions: this.getLLMInteractions(sessionId)
    };
  }

  /**
   * Lisää käyttäjän palaute session-lokiin
   */
  addUserFeedback(
    sessionLog: ChatSessionLog,
    rating: 'thumbs_up' | 'thumbs_down',
    comment?: string
  ): ChatSessionLog {
    return {
      ...sessionLog,
      userFeedback: {
        rating,
        comment,
        timestamp: new Date()
      }
    };
  }

  /**
   * Private helper methods
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Pidä puskuri rajattuna
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  private addToSessionLog(sessionId: string, entry: LogEntry): void {
    if (!this.sessionLogs.has(sessionId)) {
      this.sessionLogs.set(sessionId, []);
    }
    this.sessionLogs.get(sessionId)!.push(entry);
  }

  private sanitizeData(data: any): any {
    if (!data) return null;
    
    try {
      // Poista undefined-arvot ja muuta ne null:iksi
      const cleaned = JSON.parse(JSON.stringify(data, (_, value) => 
        value === undefined ? null : value
      ));
      return cleaned;
    } catch {
      return null;
    }
  }

  private getCurrentUserId(): string {
    // Tämä voidaan päivittää hakemaan oikea userId auth-palvelusta
    try {
      const authData = localStorage.getItem('authData');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.userId || 'anonymous';
      }
    } catch {
      // Ignore parsing errors
    }
    return 'anonymous';
  }

  private logToConsole(entry: LogEntry): void {
    const emoji = this.getLogEmoji(entry.level);
    const style = this.getConsoleStyle(entry.level);
    
    const message = `${emoji} [${entry.component}] ${entry.action}${entry.message ? ': ' + entry.message : ''}`;
    
    switch (entry.level) {
      case 'ERROR':
        console.error(message, entry.data || '');
        break;
      case 'WARN':
        console.warn(message, entry.data || '');
        break;
      case 'INFO':
        console.info(message, entry.data || '');
        break;
      case 'DEBUG':
      default:
        console.log(`%c${message}`, style, entry.data || '');
        break;
    }
  }

  private getLogEmoji(level: LogLevel): string {
    switch (level) {
      case 'ERROR': return '❌';
      case 'WARN': return '⚠️';
      case 'INFO': return 'ℹ️';
      case 'DEBUG': return '🔍';
      default: return '📝';
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    switch (level) {
      case 'ERROR': return 'color: red; font-weight: bold;';
      case 'WARN': return 'color: orange; font-weight: bold;';
      case 'INFO': return 'color: blue;';
      case 'DEBUG': return 'color: gray;';
      default: return '';
    }
  }

  /**
   * Laske kontekstin käyttö (arvio token-määrästä)
   */
  private calculateContextUsage(
    systemPrompt?: string,
    messages?: Array<any>,
    ostolaskuData?: any[]
  ): {
    systemPromptTokens: number;
    messagesTokens: number;
    ostolaskuDataTokens: number;
    totalTokens: number;
  } {
    // Arvio: 1 token ≈ 4 merkkiä
    const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
    
    const systemPromptTokens = systemPrompt ? estimateTokens(systemPrompt) : 0;
    const messagesTokens = messages 
      ? messages.reduce((acc, m) => acc + estimateTokens(JSON.stringify(m)), 0)
      : 0;
    const ostolaskuDataTokens = ostolaskuData 
      ? estimateTokens(JSON.stringify(ostolaskuData))
      : 0;
    
    const usage = {
      systemPromptTokens,
      messagesTokens,
      ostolaskuDataTokens,
      totalTokens: systemPromptTokens + messagesTokens + ostolaskuDataTokens
    };
    
    // Lokita konsoliin jos kontekstin käyttö on suuri
    if (usage.totalTokens > 50000) {
      console.warn('⚠️ Large context usage:', usage);
    }
    
    return usage;
  }

  /**
   * Tallenna LLM input/output pari
   */
  logLLMInteraction(
    sessionId: string,
    input: string,
    output: string,
    model?: string,
    functionCalls?: any[]
  ): void {
    const interaction = {
      input,
      output,
      timestamp: new Date(),
      model,
      functionCalls
    };
    
    // Tallenna session-kohtaiseen puskuriin
    if (!this.llmInteractions.has(sessionId)) {
      this.llmInteractions.set(sessionId, []);
    }
    this.llmInteractions.get(sessionId)?.push(interaction);
    
    // Lokita konsoliin debug-tilassa
    if (this.debugMode) {
      console.log('🤖 LLM Interaction:', {
        sessionId,
        model,
        inputLength: input.length,
        outputLength: output.length,
        hasFunctionCalls: !!functionCalls?.length,
        timestamp: interaction.timestamp
      });
    }
  }

  /**
   * Hae LLM-interaktiot sessiolta
   */
  getLLMInteractions(sessionId: string): Array<{input: string; output: string; timestamp: Date; model?: string; functionCalls?: any[]}> {
    return this.llmInteractions.get(sessionId) || [];
  }

  /**
   * Tyhjennä LLM-interaktiot sessiolta
   */
  clearLLMInteractions(sessionId: string): void {
    this.llmInteractions.delete(sessionId);
  }

  private isCriticalLog(level: LogLevel, action: string, message?: string): boolean {
    // Always log errors and warnings
    if (level === 'ERROR' || level === 'WARN') return true;
    
    // Critical actions to always log
    const criticalActions = [
      'Empty response',
      'Incomplete response',
      'Table overflow',
      'UI overflow',
      'sendMessage', // Only if it has issues
      'initializeSession',
      'endSession',
      'startSession'
    ];
    
    // Critical messages to watch for
    const criticalMessages = [
      'Empty response',
      'fallback',
      'cut off',
      'incomplete',
      'overflow',
      'truncated',
      'Failed',
      'Error',
      'Message processing complete' // Keep final status
    ];
    
    // Check if action or message contains critical keywords
    const actionIsCritical = criticalActions.some(critical => 
      action.toLowerCase().includes(critical.toLowerCase())
    );
    
    const messageIsCritical = message && criticalMessages.some(critical => 
      message.toLowerCase().includes(critical.toLowerCase())
    );
    
    return actionIsCritical || messageIsCritical;
  }

  /**
   * Set focused logging mode
   */
  setFocusedLogging(enabled: boolean): void {
    this.focusedLogging = enabled;
    this.info('LoggingService', 'setFocusedLogging', `Focused logging ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Export singleton instance
export const logger = LoggingService.getInstance();

// Export helper function for structured logging
export function structuredLog(
  level: LogLevel,
  component: string,
  action: string,
  details: {
    message?: string;
    data?: any;
    sessionId?: string;
    error?: Error;
  }
): void {
  const { message, data, sessionId, error } = details;
  
  if (error) {
    logger.log(level, component, action, message || error.message, {
      ...data,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }, sessionId);
  } else {
    logger.log(level, component, action, message, data, sessionId);
  }
}