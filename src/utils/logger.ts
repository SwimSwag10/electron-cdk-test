// src/utils/logger.ts
export class Logger {
  private readonly context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string): void {
    console.log(`[INFO] ${this.context}: ${message}`);
  }

  error(message: string): void {
    console.error(`[ERROR] ${this.context}: ${message}`);
  }
}