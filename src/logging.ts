export const LogLevel = {
  Debug: 0,
  Info: 1,
  Warn: 2,
  Error: 3,
} as const

export type LogLevels = typeof LogLevel[keyof typeof LogLevel]

export class Logger {
  public readonly logLevel: LogLevels
  private readonly fns = {
    [LogLevel.Debug]: console.debug,
    [LogLevel.Info]: console.info,
    [LogLevel.Warn]: console.warn,
    [LogLevel.Error]: console.error,
  } as const
  /** Will only log at given level and higher */
  constructor(logLevel: LogLevels) {
    this.logLevel = logLevel
    // bind the fns... no idea if this is good or bad practice.
    this.log = this.log.bind(this)
    this.info = this.info.bind(this)
    this.warn = this.warn.bind(this)
    this.error = this.error.bind(this)
  }

  private coerce(arg: any): any {
    if (['string', 'boolean', 'undefined', 'function', 'bigint'].includes(typeof arg)) return arg
    if (typeof arg === 'number') {
      const strRep = arg.toFixed(4)
      return strRep.endsWith('.0000') ? strRep.slice(0, -5) : strRep.replace(/0+$/, '')
    }
    if (Array.isArray(arg) && arg.length === 2 && typeof arg[0] === 'number') {
      // stringify PointPair
      return JSON.stringify(arg)
    }
    if (arg instanceof Date) {
      return arg.toISOString()
    }
    if (arg instanceof Set) {
      return `Set(${[...arg].map(a => `${this.coerce(a)}`).join(', ')})`
    }
    if (Array.isArray(arg)) {
      return arg.map(a => this.coerce(a))
    }
    if ([null, Object.prototype].includes(Object.getPrototypeOf(arg))) {
      return Object.entries(arg).reduce((acc, [k, v]) => ({ ...acc, [k]: this.coerce(v) }), {})
    }
    // some sort of class maybe...?
    if (typeof arg.toString === 'function') return arg.toString()

    return arg
  }
  log(level: LogLevels, ...args: unknown[]) {
    if (this.logLevel > level) return
    this.fns[level](...args.map(arg => this.coerce(arg)))
  }

  debug(...args: unknown[]) { this.log(LogLevel.Debug, ...args) }
  info(...args: unknown[]) { this.log(LogLevel.Info, ...args) }
  warn(...args: unknown[]) { this.log(LogLevel.Warn, ...args) }
  error(...args: unknown[]) { this.log(LogLevel.Error, ...args) }
}

const commonPrivateIPAddresses = [
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.'
]

const defaultLogger = new Logger(
  // (['localhost', '127.0.0.1'].includes(document.location.hostname) || commonPrivateIPAddresses.filter(ipStart => document.location.hostname.startsWith(ipStart)).length > 0)
  // ? LogLevel.Debug
  // : LogLevel.Warn
  LogLevel.Warn
)

export default defaultLogger
