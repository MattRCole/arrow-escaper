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

export const drawStraitghtLine = (args: {
  ctx: CanvasRenderingContext2D,
  gridInfo: GridInfo,
  startingPoint: PointPair,
  endingPoint: PointPair,
  direction: DirectionT,
  startIsTail?: boolean,
  endIsHead?: boolean
}) => {
  const {
    ctx,
    gridInfo,
    startingPoint,
    endingPoint,
    direction,
    startIsTail = false,
    endIsHead = false,
  } = args
  const gridToWorld = getGridToWorldFn(gridInfo)
  const startOffset = startIsTail ? LineOffsets.term[direction] : LineOffsets.start[direction]
  const endOffset = endIsHead ? LineOffsets.term[direction] : LineOffsets.end[direction]
  const [worldStart, worldEnd] = [
    gridToWorld(...add(startOffset, startingPoint)),
    gridToWorld(...add(endOffset, endingPoint)),
  ]
  ctx.moveTo(...worldStart)
  ctx.lineTo(...worldEnd)
}

export const fillArrowHeadArea = (args: {
  ctx: CanvasRenderingContext2D,
  gridInfo: GridInfo,
  direction: DirectionT,
  pt: PointPair,
}) => {
  const {
    ctx,
    gridInfo,
    direction,
    pt
  } = args
  const gridToWorld = getGridToWorldFn(gridInfo)

  const onDirectionOffset = (1.0 / 3.9) - GridDefaults.linePercent
  const offDirectionOffset = (1.0 / 2.9) - GridDefaults.linePercent
  const headBuffer = (0.2) - GridDefaults.linePercent
  const onSize = 1 - onDirectionOffset - headBuffer
  const offSize = 1 - (2 * (offDirectionOffset))

  const arrowHeadDeltas: { [P in DirectionT]: [PointPair, PointPair] } = {
    [Direction.North]: [[offDirectionOffset, headBuffer], [offSize, onSize]],
    [Direction.East]: [[onDirectionOffset, offDirectionOffset], [offSize, onSize]],
    [Direction.South]: [[offDirectionOffset, onDirectionOffset], [offSize, onSize]],
    [Direction.West]: [[headBuffer, offDirectionOffset], [onSize, offSize]],
  }

  const [pt1, [w, h]] = arrowHeadDeltas[direction]
  // We're assuming the ctx has been prepped for this
  ctx.fillRect(...gridToWorld(...add(pt, pt1)), w * gridInfo.gridSizePx, h * gridInfo.gridSizePx)
}
export const drawArrowHeadPointingInDirection = (args: {
  ctx: CanvasRenderingContext2D,
  gridInfo: GridInfo,
  direction: DirectionT,
  x?: number,
  y?: number,
  pt?: PointPair,
}) => {
  const {
    ctx,
    gridInfo,
    direction,
  } = args
  let {
    x,
    y,
  } = args
  const {
    pt = [x, y]
  } = args
  const gridToWorld = getGridToWorldFn(gridInfo)
  x = pt[0]
  y = pt[1]
  const onDirectionOffset = 1.0 / 4.0
  const offDirectionOffset = 1.0 / 3.0
  const headBuffer = 0.3

  const arrowHeadDeltas: { [P in DirectionT]: [PointPair, PointPair, PointPair] } = {
    [Direction.North]: [[offDirectionOffset, 1.0 - onDirectionOffset], [0.5, headBuffer], [1.0 - offDirectionOffset, 1.0 - onDirectionOffset]],
    [Direction.East]: [[onDirectionOffset, offDirectionOffset], [1 - headBuffer, 0.5], [onDirectionOffset, 1.0 - offDirectionOffset]],
    [Direction.South]: [[offDirectionOffset, onDirectionOffset], [0.5, 1.0 - headBuffer], [1.0 - offDirectionOffset, onDirectionOffset]],
    [Direction.West]: [[1.0 - onDirectionOffset, offDirectionOffset], [headBuffer, 0.5], [1.0 - onDirectionOffset, 1.0 - offDirectionOffset]],
  }

  const [pt1, pt2, pt3] = arrowHeadDeltas[direction]
  // We're assuming the ctx has been prepped for this
  ctx.beginPath()
  ctx.moveTo(...gridToWorld(...add([x, y], pt1)))
  ctx.lineTo(...gridToWorld(...add([x, y], pt2)))
  ctx.lineTo(...gridToWorld(...add([x, y], pt3)))
  ctx.closePath()
  ctx.fill()
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
  const arrowHead = arrow.at(-1)
  console.log({ arrow, directions })
  const finalDirection = directions.at(-1)
  let totalTime: number = 0.0
  let idxPrev: number = 0
  let subGridOffsetPrev: number = 0
  let prevGridPos = arrow[0]
  while (true) {
    const deltaT: number = yield prevGridPos
    if (!deltaT) {
      // either somehow we haven't traveled at all
      continue
    }
    totalTime = totalTime + deltaT
    const fullOffset = (totalTime / 1000) * percentPerSecond
    const idx = Math.floor(fullOffset)
    const prevDirection = idx === 0 ? directions[0] : (idx > arrow.length ? finalDirection : directions[idx - 1])
    const subGridOffset = fullOffset - idx
    const pos = idx < arrow.length ? arrow[idx] : travel(arrow.at(-1), finalDirection, idx - arrow.length + 1)
    const [x, y] = pos
    if (idxPrev < idx) {
      for (const toClear of range({ start: Math.max(0, idxPrev - 3), stop: idx })) {
        const clearPoint = toClear >= arrow.length ? travel(arrowHead, finalDirection, toClear - arrow.length) : arrow[toClear]
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
    }

    // erase previous arrowhead
    ctx.fillStyle = GridDefaults.bgStyle
    fillArrowHeadArea({
      ctx,
      direction: finalDirection,
      pt: travel(arrowHead, finalDirection, idxPrev + subGridOffsetPrev),
      gridInfo,
    })
    // Draw the head
    ctx.fillStyle = GridDefaults.arrowStyle
    ctx.lineWidth = Math.floor(GridDefaults.linePercent * gridInfo.gridSizePx)
    drawArrowHeadPointingInDirection({
      ctx,
      gridInfo,
      direction: finalDirection,
      pt: travel(arrowHead, finalDirection, fullOffset)
    })
    ctx.stroke()
    // fill in the line
    drawStraitghtLine({
      startingPoint: travel(arrowHead, finalDirection, idxPrev + subGridOffsetPrev),
      endingPoint: travel(arrowHead, finalDirection, fullOffset),
      endIsHead: true,
      direction: finalDirection,
      gridInfo,
      ctx,
    })
    ctx.stroke()


    const getRectInfo = (direction: DirectionT, noErr: boolean = false) => {
      const errMargin = (idx === 0 || noErr) ? 0.0 : Math.min(percentPerSecond * 2, 0.4)
      return {
        [Direction.North]: [[0, 1 - subGridOffset], [1, subGridOffset + errMargin]],
        [Direction.East]: [[-errMargin, 0], [subGridOffset + errMargin, 1]],
        [Direction.South]: [[0, -errMargin], [1, subGridOffset + errMargin]],
        [Direction.West]: [[1 - subGridOffset, 0], [subGridOffset + errMargin, 1]],
      }[direction]
    }

    const currentDirection = idx < arrow.length ? directions[idx] : finalDirection
    if (prevDirection !== currentDirection) {
      if (subGridOffset <= 0.25) {
        const [[x1, y1], [w, h]] = getRectInfo(prevDirection, true)
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
      const [[x1, y1], [w, h]] = getRectInfo(currentDirection)
      ctx.fillStyle = GridDefaults.bgStyle
      ctx.fillRect(...getGridToWorld(x + x1, y + y1), Math.round(w * gridInfo.gridSizePx), Math.round(h * gridInfo.gridSizePx))
      if (subGridOffset > 0.5 + (GridDefaults.gridDotPercent / 2)) {
        ctx.fillStyle = GridDefaults.gridDotStyle
        ctx.beginPath()
        ctx.arc(...getGridToWorld(x + 0.5, y + 0.5), Math.floor(gridInfo.gridSizePx * GridDefaults.gridDotPercent), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    prevGridPos = pos
    idxPrev = idx
    subGridOffsetPrev = subGridOffset
    // yield pos
  }
}

export type AnimateArrowLeavingGenerator = ReturnType<typeof animateArrowLeaving>

export const getEmptySpaces = (level: Level, arrowsToExclude?: Set<number>): PointPair[] => {
  const isInBounds = level.bounds ? (x: number, y: number) => level.bounds[x][y] === 1 : (_x: number, _y: number) => true

  return arrowsToBoolmap(level, arrowsToExclude ?? new Set<number>()).reduce((points, column, x) => {
    return [...points, ...column.reduce((colPoints, hasArrow, y) => hasArrow || !isInBounds(x, y) ? colPoints : [...colPoints, [x, y]], [])]
  }, [])
}

