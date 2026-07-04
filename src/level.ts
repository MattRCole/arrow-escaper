import type { Level, PointPair, GridInfo } from './types.d.ts'
import { enumerate, range } from './util.ts'
import { getDirection, getGridToWorldFn, travel, Direction, type DirectionT, add } from './geometry.ts'
import { GridDefaults } from './constants.ts'
import { renderArrow } from './arrow.ts'

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

const _startingOffsets = {
  [Direction.North]: [0.5, 1.0],
  [Direction.East]: [0.0, 0.5],
  [Direction.South]: [0.5, 0.0],
  [Direction.West]: [1.0, 0.5],
} as const

// REMEMBER: lines _start_ at the tail and _end_ at the head
const LineOffsets = {
  start: _startingOffsets,
  // This actually just works for tails and heads
  term: {
    [Direction.North]: [0.5, 0.6],
    [Direction.East]: [0.4, 0.5],
    [Direction.South]: [0.5, 0.4],
    [Direction.West]: [0.6, 0.5],
  },
  end: {
    [Direction.North]: _startingOffsets[Direction.South],
    [Direction.East]: _startingOffsets[Direction.West],
    [Direction.South]: _startingOffsets[Direction.North],
    [Direction.West]: _startingOffsets[Direction.East],
  },
} as const

export function* animateArrowLeaving(args: { arrow: PointPair[], ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, gridInfo: GridInfo, percentPerSecond: number, bounds: PointPair, exponent?: number }) {
  const {
    arrow: backwardsArrow,
    ctx,
    gridInfo,
    percentPerSecond,
    bounds,
    exponent = 1,
  } = args

  const arrow: PointPair[] = backwardsArrow.map(([y, x]) => [x, y])
  const getGridToWorld = getGridToWorldFn(gridInfo)
  // We can always assume the last direction is the final direction, arrow heads are always co-linear with the prev  column
  const directions = arrow.map((pt, idx) => (idx === arrow.length - 1 ? getDirection(arrow[idx - 1], pt) : getDirection(pt, arrow[idx + 1])))
  const arrowHead = arrow.at(-1)
  let totalTime: number = 0.0
  let prevGridPos = arrow[0]
  const finalDirection = directions.at(-1)
  let deltaT = 0
  while (true) {
    totalTime = totalTime + deltaT
    const fullOffset = Math.pow((totalTime / 1000) * percentPerSecond, exponent)
    const idx = Math.floor(fullOffset)
    const pos = idx >= arrow.length ? travel(arrowHead, finalDirection, idx - arrow.length + 1) : arrow[idx]
    const subGridOffset = fullOffset - idx

    for (const toClear of range(Math.ceil(fullOffset))) {
      if (toClear > idx && subGridOffset < 0.6) continue

      const clearPoint = toClear >= arrow.length ? travel(arrowHead, finalDirection, toClear - arrow.length + 1) : arrow[toClear]
      if (clearPoint[0] < 0 || clearPoint[0] >= bounds[0] || clearPoint[1] < 0 || clearPoint[1] >= bounds[1]) break;
      ctx.fillStyle = GridDefaults.bgStyle
      ctx.fillRect(
        ...getGridToWorld(...clearPoint),
        gridInfo.gridSizePx,
        gridInfo.gridSizePx
      )
      ctx.fillStyle = GridDefaults.gridDotStyle
      ctx.beginPath()
      ctx.arc(...getGridToWorld(clearPoint[0] + 0.5, clearPoint[1] + 0.5), Math.floor(gridInfo.gridSizePx * GridDefaults.gridDotPercent), 0, Math.PI * 2)
      ctx.fill()
    }
    renderArrow({ arrow: backwardsArrow, ctx, gridInfo, start: fullOffset + 0.4, stop: fullOffset + arrow.length - 1 })
    ctx.stroke()
    prevGridPos = pos
    const _deltaT = yield prevGridPos
    deltaT = _deltaT || 0
  }
}

export type AnimateArrowLeavingGenerator = ReturnType<typeof animateArrowLeaving>

export const getEmptySpaces = (level: Level, arrowsToExclude?: Set<number>): PointPair[] => {
  const isInBounds = level.bounds ? (x: number, y: number) => level.bounds[x][y] === 1 : (_x: number, _y: number) => true

  return arrowsToBoolmap(level, arrowsToExclude ?? new Set<number>()).reduce((points, column, x) => {
    return [...points, ...column.reduce((colPoints, hasArrow, y) => hasArrow || !isInBounds(x, y) ? colPoints : [...colPoints, [x, y]], [])]
  }, [])
}


export const renderEmpty = (args: { level: Level, gridInfo: GridInfo, ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, arrowsToExclude?: Set<number> }) => {
  const {
    level,
    gridInfo,
    ctx,
    arrowsToExclude,
  } = args
  const emptySpaces: PointPair[] = getEmptySpaces(level, arrowsToExclude)
  const gridToWorld = getGridToWorldFn(gridInfo)

  const {
    xOffset, yOffset, gridSizePx
  } = gridInfo
  ctx.fillStyle = GridDefaults.bgStyle
  ctx.fillRect(
    Math.floor(xOffset - (gridSizePx / 2)),
    Math.floor(yOffset - (gridSizePx / 2)),
    gridSizePx * (level.cols + 1),
    gridSizePx * (level.rows + 1),
  )

  const radius = Math.max(1.0, (Math.floor(GridDefaults.gridDotPercent * gridInfo.gridSizePx)))
  ctx.fillStyle = GridDefaults.gridDotStyle

  // draw the background board
  for (const [gridX, gridY] of emptySpaces) {
    ctx.beginPath()
    ctx.arc(...gridToWorld(gridX + 0.5, gridY + 0.5), radius, 0, Math.PI * 2)
    ctx.fill()
  }
}
