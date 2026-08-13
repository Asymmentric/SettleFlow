import winston, { createLogger, format, transports } from "winston";

const { combine, timestamp, colorize, printf, errors, splat } = format;

// ── Helpers ──────────────────────────────────────────────────────────────────

function errorMetadata(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function prepareLog(message: unknown, args: unknown[]) {
  const metadata: Record<string, unknown> = {};
  const extra: unknown[] = [];
  let text: string;

  if (message instanceof Error) {
    text = message.message;
    metadata.error = errorMetadata(message);
  } else if (typeof message === "object" && message !== null) {
    text = "Log event";
    Object.assign(metadata, message);
  } else {
    text = String(message);
  }

  for (const argument of args) {
    if (argument instanceof Error) {
      metadata.error = errorMetadata(argument);
    } else if (typeof argument === "object" && argument !== null && !Array.isArray(argument)) {
      Object.assign(metadata, argument);
    } else {
      extra.push(argument);
    }
  }

  if (extra.length) metadata.extra = extra;
  return { text, metadata };
}

function writeLog(level: "debug" | "info" | "warn" | "error", message: unknown, args: unknown[]) {
  const { text, metadata } = prepareLog(message, args);
  winstonLogger.log(level, text, metadata);
}

// ── Custom format ─────────────────────────────────────────────────────────────

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp: ts, stack, ...metadata }) => {
    const base = `[${ts}] ${level}: ${message}`;
    const context = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : "";
    return stack ? `${base}${context}\n${stack}` : `${base}${context}`;
  })
);

const fileFormat = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  splat(),
  format.json()
);

// ── Winston instance ──────────────────────────────────────────────────────────

const winstonLogger = createLogger({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  transports: [
    // Always write to stdout (mirrors console.log behaviour)
    new transports.Console({ format: consoleFormat }),

    // Persistent JSON logs for production observability
    new transports.File({
      filename: "logs/error.log",
      level: "error",
      format: fileFormat,
    }),
    new transports.File({
      filename: "logs/combined.log",
      format: fileFormat,
    }),
  ],
  // Don't crash the process on unhandled transport errors
  exitOnError: false,
});

// ── Public Logger API ─────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `console` that adds structured logging via Winston.
 *
 * @example
 * Logger.info("Server started on port", 3000);
 * Logger.debug("Request body", req.body);
 * Logger.warn("Deprecated endpoint called", { path: req.path });
 * Logger.error("Unhandled exception", error);
 */
export const Logger = {
  /** General informational messages (always shown in production). */
  info(message: unknown, ...args: unknown[]): void {
    writeLog("info", message, args);
  },

  /** Alias of `info` — mirrors the `console.log` naming convention. */
  log(message: unknown, ...args: unknown[]): void {
    writeLog("info", message, args);
  },

  /** Verbose / diagnostic messages (suppressed in production by default). */
  debug(message: unknown, ...args: unknown[]): void {
    writeLog("debug", message, args);
  },

  /** Non-fatal warnings. */
  warn(message: unknown, ...args: unknown[]): void {
    writeLog("warn", message, args);
  },

  /** Errors — always logged and written to `logs/error.log`. */
  error(message: unknown, ...args: unknown[]): void {
    writeLog("error", message, args);
  },

  /**
   * Expose the underlying Winston instance for advanced use-cases
   * (e.g. adding transports, child loggers with extra metadata).
   */
  get winston(): winston.Logger {
    return winstonLogger;
  },
} as const;

export default Logger;
