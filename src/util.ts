import type { Level } from './types.ts'

export const clamp = (min: number, target: number, max: number) => Math.min(min, Math.min(target, max))

export function* enumerate<T>(iterable: Iterable<T>): Iterable<[number, T]> {
  let idx = 0
  for (const item of iterable) {
    yield [idx, item]
    idx++
  }
}

export const getGridInfo = (level: Level, gameBoard: HTMLCanvasElement): { gridSizePx: number, xOffset: number, yOffset: number } => {
  const gridSizePx = Math.floor(Math.min(gameBoard.height / (level.rows + 1), gameBoard.width / (level.cols + 1)))
  return {
    gridSizePx,
    xOffset: Math.floor((gameBoard.width - (level.cols * gridSizePx)) / 2),
    yOffset: Math.floor((gameBoard.height - (level.rows * gridSizePx)) / 2),
  }
}

export type GridInfo = ReturnType<typeof getGridInfo>

export function* range(args: number | { start?: number, stop: number, step?: number }): Iterable<number> {
  const argsIsNum = typeof args === 'number'
  const {
    start = 0,
    stop = argsIsNum ? args : args.stop,
    step = argsIsNum ? 1 : args.step ?? 1,
  } = argsIsNum ? {} : args

  for (let i = start; i != stop; i = i + step) {
    yield i
  }
}


export const getDebounced = () => {
  let debounceTimeout: undefined | ReturnType<typeof setTimeout> = undefined
  function debounced<T extends (...args: any[]) => any>(debounceTimeoutMS: number, fn: T, ...args: Parameters<T>) {
    if (debounceTimeout !== undefined) return

    debounceTimeout = setTimeout(() => {
      fn(...args)
      debounceTimeout = undefined
    }, debounceTimeoutMS)
  }
  return debounced
}

