import type { Level, PointPair } from './types.d.ts'
import { enumerate, range, type GridInfo } from './util.ts'
import { getDirection, getGridToWorldFn, travel, Direction, type DirectionT, add } from './geometry.ts'
import { GridDefaults } from './constants.ts'

const arrowsToBoolmap = (level: Level, arrowsToExclude: Set<number>) => {
  const map = [...range(level.cols)].map(() => (new Array(level.rows)).fill(false) as boolean[])
  for (const [arrowIdx, arrow] of enumerate(level.arrows)) {
    if (arrowsToExclude.has(arrowIdx)) continue
    for (const [y, x] of arrow) {
      map[x][y] = true
    }
  }
  return map
}

const ArcInfo = {
  [Direction.North]: {
    [Direction.West]: (percent: number) => [[[0.25, 0.75], [0.50, 0.27]], [[0.25, 0.75], [0.75, 0.75]], [0, Math.PI * (2 - (0.5 * percent)), true]],
    [Direction.East]: (percent: number) => [[[0.25, 0.75], [0.50, 0.27]], [[0.75, 0.75], [0.25, 0.75]], [Math.PI, Math.PI * (1 + (0.5 * percent)), false]],
  },
  [Direction.East]: {
    [Direction.North]: (percent: number) => [[[0.00, 0.25], [0.25, 0.50]], [[0.25, 0.25], [0.25, 0.75]], [Math.PI * 0.5, Math.PI * (0.5 - (0.5 * percent)), true]],
    [Direction.South]: (percent: number) => [[[0.00, 0.25], [0.25, 0.50]], [[0.25, 0.75], [0.25, 0.25]], [Math.PI * 1.5, Math.PI * (1.5 + (0.5 * percent)), false]],
  },
  [Direction.South]: {
    [Direction.East]: (percent: number) => [[[0.25, 0.00], [0.25, 0.50]], [[0.75, 0.25], [0.25, 0.25]], [Math.PI, Math.PI * (1.0 - (0.5 * percent)), true]],
    [Direction.West]: (percent: number) => [[[0.25, 0.00], [0.25, 0.50]], [[0.25, 0.25], [0.75, 0.25]], [0, Math.PI * 0.5 * percent, false]],
  },
  [Direction.West]: {
    [Direction.South]: (percent: number) => [[[0.00, 0.25], [0.50, 0.25]], [[0.25, 0.75], [0.25, 0.25]], [Math.PI * 1.5, Math.PI * (1.5 + (percent / 2)), false]],
    [Direction.North]: (percent: number) => [[[0.75, 0.25], [0.50, 0.25]], [[0.75, 0.25], [0.75, 0.75]], [Math.PI * 0.5, Math.PI * (0.5 + (percent / 2)), false]],
  }
} as any as { [P in DirectionT]: { [P in DirectionT]: (percent: number) => [[PointPair, PointPair], [PointPair, PointPair], [number, number, boolean]] } }

export function* animateArrowLeaving(args: { arrow: PointPair[], ctx: CanvasRenderingContext2D, gridInfo: GridInfo, percentPerSecond: number }) {
  const { arrow: backwardsArrow, ctx, gridInfo, percentPerSecond } = args
  const arrow: PointPair[] = backwardsArrow.map(([y, x]) => [x, y])
  const getGridToWorld = getGridToWorldFn(gridInfo)
  // We can always assume the last direction is the final direction, arrow heads are always co-linear with the prev  column
  const directions = arrow.map((pt, idx) => (idx === arrow.length - 1 ? getDirection(arrow[idx - 1], pt) : getDirection(pt, arrow[idx + 1])))
  console.log({ arrow, directions })
  const finalDirection = directions.at(-1)
  let totalTime: number = 0.0
  let idxPrev: number = 0
  let prevGridPos = arrow[0]
  while (true) {
    const deltaT: number = yield prevGridPos
    if (!deltaT) {
      // either somehow we haven't traveled at all
      console.log("Waiting....")
      continue
    }
    totalTime = totalTime + deltaT
    const fullOffset = (totalTime / 1000) * percentPerSecond
    const idx = Math.floor(fullOffset)
    const prevDirection = idx === 0 ? directions[0] : (idx > arrow.length ? finalDirection : directions[idx - 1])
    const subGridOffset = fullOffset - idx
    const pos = idx < arrow.length ? arrow[idx] : travel(arrow.at(-1), finalDirection, idx - arrow.length + 1)
    const [x, y] = pos
    if (idx - idxPrev > 1) console.log({ message: "big jump!", idx, idxPrev })
    if (idxPrev < idx && idxPrev < arrow.length) {
      for (const toClear of range({ start: idxPrev, stop: Math.min(idx, arrow.length - 1) })) {
        ctx.fillStyle = GridDefaults.bgStyle
        ctx.fillRect(
          ...getGridToWorld(...arrow[toClear]),
          gridInfo.gridSizePx,
          gridInfo.gridSizePx
        )
        ctx.fillStyle = GridDefaults.gridDotStyle
        ctx.beginPath()
        ctx.arc(...getGridToWorld(arrow[toClear][0] + 0.5, arrow[toClear][1] + 0.5), Math.floor(gridInfo.gridSizePx * GridDefaults.gridDotPercent), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const rectInfo: { [P in DirectionT]: () => [PointPair, PointPair] } = {
      [Direction.North]: () => [[0, 1 - subGridOffset], [1, subGridOffset]],
      [Direction.East]: () => [[0, 0], [subGridOffset, 1]],
      [Direction.South]: () => [[0, 0], [1, subGridOffset]],
      [Direction.West]: () => [[1 - subGridOffset, 0], [subGridOffset, 1]],
    }

    const currentDirection = idx < arrow.length ? directions[idx] : finalDirection
    if (prevDirection !== currentDirection) {
      console.log({ subGridOffset })
      if (subGridOffset <= 0.25) {
        const [[x1, y1], [w, h]] = rectInfo[prevDirection]()
        ctx.fillStyle = GridDefaults.bgStyle
        ctx.fillRect(...getGridToWorld(x1 + x, y1 + y), w * gridInfo.gridSizePx, h * gridInfo.gridSizePx)
      }
      else if (subGridOffset >= 0.75) {
        const [[x1, y1], [w, h]] = {
          [Direction.North]: () => [[0, 1 - subGridOffset], [1, subGridOffset]],
          [Direction.East]: () => [[0, 0], [subGridOffset, 1]],
          [Direction.South]: () => [[0, 0], [1, subGridOffset]],
          [Direction.West]: () => [[1 - subGridOffset, 0], [subGridOffset, 1]],
        }[currentDirection]()
        ctx.fillStyle = GridDefaults.bgStyle
        ctx.fillRect(...getGridToWorld(x1 + x, y1 + y), w * gridInfo.gridSizePx, h * gridInfo.gridSizePx)
        ctx.fillStyle = GridDefaults.gridDotStyle
        ctx.beginPath()
        ctx.arc(...getGridToWorld(x + 0.5, y + 0.5), gridInfo.gridSizePx * GridDefaults.gridDotPercent, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const arcPercent = (subGridOffset - 0.25) / 0.5
        const [rectInfo, lineInfo, arcInfo] = ArcInfo[prevDirection][currentDirection](arcPercent)
        const [rectP, [w, h]] = rectInfo
        const [line1, line2] = lineInfo
        const [startAngle, endAngle, ccw] = arcInfo
        // console.log({ x1, y1, startAngle, endAngle, ccw })
        ctx.fillStyle = GridDefaults.bgStyle
        ctx.fillRect(...getGridToWorld(...add(pos, rectP)), Math.round(w * gridInfo.gridSizePx), Math.round(h * gridInfo.gridSizePx))
        ctx.beginPath()
        ctx.moveTo(...getGridToWorld(...add(pos, line1)))
        ctx.lineTo(...getGridToWorld(...add(pos, line2)))
        ctx.arc(...getGridToWorld(...add(pos, line1)), gridInfo.gridSizePx * 0.5, startAngle, endAngle, ccw)
        ctx.closePath()
        ctx.fill()
      }
    }
    else {
      const [[x1, y1], [w, h]] = rectInfo[currentDirection]()
      // console.log({ subGridOffset, x, y, x1, y1, w, h })
      ctx.fillStyle = GridDefaults.bgStyle
      ctx.fillRect(...getGridToWorld(x + x1, y + y1), w * gridInfo.gridSizePx, h * gridInfo.gridSizePx)
      if (subGridOffset > 0.5 + (GridDefaults.gridDotPercent / 2)) {
        ctx.fillStyle = GridDefaults.gridDotStyle
        ctx.beginPath()
        ctx.arc(...getGridToWorld(x + 0.5, y + 0.5), Math.floor(gridInfo.gridSizePx * GridDefaults.gridDotPercent), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // if (idxPrev != idx) {
    //   console.log({ idxPrev, idx })
    //   prevDirection = currentDirection
    // }
    prevGridPos = pos
    idxPrev = idx
    // yield pos
  }
}

export const getEmptySpaces = (level: Level, arrowsToExclude?: Set<number>): PointPair[] => {
  const isInBounds = level.bounds ? (x: number, y: number) => level.bounds[x][y] === 1 : (_x: number, _y: number) => true

  return arrowsToBoolmap(level, arrowsToExclude ?? new Set<number>()).reduce((points, column, x) => {
    return [...points, ...column.reduce((colPoints, hasArrow, y) => hasArrow || !isInBounds(x, y) ? colPoints : [...colPoints, [x, y]], [])]
  }, [])
}

