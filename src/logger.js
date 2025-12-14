// src/logger.js
// Centralized logging with levels and structured output

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
};

class Logger {
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level || process.env.LOG_LEVEL || 'info'];
    this.prefix = options.prefix || '';
    this.timestamps = options.timestamps !== false;
    this.colors = options.colors !== false && process.stdout.isTTY;
  }

  /**
   * Create a child logger with a prefix
   * @param {string} prefix - Prefix for all messages
   * @returns {Logger} - Child logger instance
   */
  child(prefix) {
    return new Logger({
      level: Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === this.level),
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      timestamps: this.timestamps,
      colors: this.colors
    });
  }

  /**
   * Format a log message
   */
  format(level, message, data) {
    const parts = [];

    // Timestamp
    if (this.timestamps) {
      const now = new Date().toISOString().slice(11, 23);
      parts.push(this.colors ? `\x1b[90m${now}\x1b[0m` : now);
    }

    // Level
    const levelColors = {
      debug: '\x1b[90m',  // gray
      info: '\x1b[36m',   // cyan
      warn: '\x1b[33m',   // yellow
      error: '\x1b[31m'   // red
    };
    const levelStr = level.toUpperCase().padEnd(5);
    parts.push(this.colors ? `${levelColors[level]}${levelStr}\x1b[0m` : levelStr);

    // Prefix
    if (this.prefix) {
      parts.push(this.colors ? `\x1b[35m[${this.prefix}]\x1b[0m` : `[${this.prefix}]`);
    }

    // Message
    parts.push(message);

    // Data
    if (data && Object.keys(data).length > 0) {
      const dataStr = JSON.stringify(data);
      parts.push(this.colors ? `\x1b[90m${dataStr}\x1b[0m` : dataStr);
    }

    return parts.join(' ');
  }

  /**
   * Log a debug message
   */
  debug(message, data = {}) {
    if (this.level <= LOG_LEVELS.debug) {
      console.log(this.format('debug', message, data));
    }
  }

  /**
   * Log an info message
   */
  info(message, data = {}) {
    if (this.level <= LOG_LEVELS.info) {
      console.log(this.format('info', message, data));
    }
  }

  /**
   * Log a warning message
   */
  warn(message, data = {}) {
    if (this.level <= LOG_LEVELS.warn) {
      console.warn(this.format('warn', message, data));
    }
  }

  /**
   * Log an error message
   */
  error(message, data = {}) {
    if (this.level <= LOG_LEVELS.error) {
      console.error(this.format('error', message, data));
    }
  }

  /**
   * Log a success message (uses info level with green color)
   */
  success(message, data = {}) {
    if (this.level <= LOG_LEVELS.info) {
      const prefix = this.colors ? '\x1b[32m✓\x1b[0m' : '✓';
      console.log(this.format('info', `${prefix} ${message}`, data));
    }
  }

  /**
   * Log a step in a process
   */
  step(stepNum, total, message) {
    if (this.level <= LOG_LEVELS.info) {
      const progress = `[${stepNum}/${total}]`;
      const coloredProgress = this.colors ? `\x1b[36m${progress}\x1b[0m` : progress;
      console.log(this.format('info', `${coloredProgress} ${message}`, {}));
    }
  }

  /**
   * Log a divider line
   */
  divider(char = '─', length = 50) {
    if (this.level <= LOG_LEVELS.info) {
      const line = char.repeat(length);
      console.log(this.colors ? `\x1b[90m${line}\x1b[0m` : line);
    }
  }

  /**
   * Log a section header
   */
  section(title) {
    if (this.level <= LOG_LEVELS.info) {
      this.divider('═', 60);
      const padded = ` ${title} `;
      console.log(this.colors ? `\x1b[1m\x1b[36m${padded}\x1b[0m` : padded);
      this.divider('═', 60);
    }
  }

  /**
   * Create a timer for measuring duration
   */
  timer(label) {
    const start = Date.now();
    return {
      end: (message) => {
        const duration = Date.now() - start;
        const formatted = duration < 1000
          ? `${duration}ms`
          : `${(duration / 1000).toFixed(1)}s`;
        this.info(message || label, { duration: formatted });
        return duration;
      }
    };
  }
}

// Default logger instance
const logger = new Logger();

// Named exports for convenience
export const debug = (msg, data) => logger.debug(msg, data);
export const info = (msg, data) => logger.info(msg, data);
export const warn = (msg, data) => logger.warn(msg, data);
export const error = (msg, data) => logger.error(msg, data);
export const success = (msg, data) => logger.success(msg, data);

export { Logger };
export default logger;
