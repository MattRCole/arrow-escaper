import type { PointPair } from './types.ts'
import { type GridInfo } from './util.ts'

export const Direction = {
  North: 'north',
  East: 'east',
  South: 'south',
  West: 'west'
} as const

export type DirectionT = typeof Direction[keyof typeof Direction]

export const DirectionDelta: { [P in DirectionT]: [number, number] } = {
  [Direction.North]: [0, -1],
  [Direction.East]: [1, 0],
  [Direction.South]: [0, 1],
  [Direction.West]: [-1, 0],
}
export const OppDirection = {
  [Direction.North]: Direction.South,
  [Direction.East]: Direction.West,
  [Direction.South]: Direction.North,
  [Direction.West]: Direction.East,
} as const

export const getDirection = ([fromX, fromY]: [number, number], [toX, toY]: [number, number]): DirectionT => {
  const [dx, dy] = [toX - fromX, toY - fromY]
  if (dx === 0 && dy === -1) return Direction.North
  if (dx === 1 && dy === 0) return Direction.East
  if (dx === 0 && dy === 1) return Direction.South
  if (dx === -1 && dy === 0) return Direction.West

  throw new Error(`(${fromX}, ${fromY}) is not a cardinal neighbor of (${toX}, ${toY})`)
}
export const travel = ([x, y]: PointPair, direction: DirectionT, amount: number) => (({
  [Direction.North]: () => [x, y - amount],
  [Direction.East]: () => [x + amount, y],
  [Direction.South]: () => [x, y + amount],
  [Direction.West]: () => [x - amount, y],
} as { [P in DirectionT]: () => PointPair })[direction]())

export const getGridToWorldFn = ({ gridSizePx, yOffset, xOffset }: GridInfo) => (x: number, y: number): [number, number] => [Math.round((x * gridSizePx) + xOffset), Math.round((y * gridSizePx) + yOffset)]
export const getWorldToGridFn = ({ gridSizePx, yOffset, xOffset }: GridInfo) => (x: number, y: number): [number, number] => [Math.round((x - xOffset) / gridSizePx), Math.round((y - yOffset) / gridSizePx)]

export const add = ([x1, y1]: PointPair, [x2, y2]: PointPair): PointPair => [x1 + x2, y1 + y2]

