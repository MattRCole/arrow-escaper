import { GridDefaults } from './constants'
import { type DirectionT, add, Direction, getDirection, getGridToWorldFn, OppDirection, travel, } from './geometry'
import type { PointPair } from './types'
import { range, type GridInfo } from './util'


type GridOffsetMap = { [P in DirectionT]: (startingPoint: PointPair) => PointPair }

const onDirectionOffset = 1.0 / 4.0
const offDirectionOffset = 1.0 / 3.0
const headBuffer = 0.3

const GetArrowHeadDeltas: { [P in DirectionT]: (startingPoint: PointPair) => [PointPair, PointPair, PointPair] } = {
  [Direction.North]: ([x, y]) => {
    const fixed: PointPair = [Math.floor(x), y]
    return [add([offDirectionOffset, 1.0 - onDirectionOffset], fixed), add([0.5, headBuffer], fixed), add([1.0 - offDirectionOffset, 1.0 - onDirectionOffset], fixed)]
  },
  [Direction.East]: ([x, y]) => {
    const fixed: PointPair = [x, Math.floor(y)]
    return [add([onDirectionOffset, offDirectionOffset], fixed), add([1 - headBuffer, 0.5], fixed), add([onDirectionOffset, 1.0 - offDirectionOffset], fixed)]
  },
  [Direction.South]: ([x, y]) => {
    const fixed: PointPair = [Math.floor(x), y]
    return [add([offDirectionOffset, onDirectionOffset], fixed), add([0.5, 1.0 - headBuffer], fixed), add([1.0 - offDirectionOffset, onDirectionOffset], fixed)]
  },
  [Direction.West]: ([x, y]) => {
    const fixed: PointPair = [x, Math.floor(y)]
    return [add([1.0 - onDirectionOffset, offDirectionOffset], fixed), add([headBuffer, 0.5], fixed), add([1.0 - onDirectionOffset, 1.0 - offDirectionOffset], fixed)]
  },
}

export const drawArrowHeadPointingInDirection = (args: {
  ctx: CanvasRenderingContext2D,
  gridInfo: GridInfo,
  direction: DirectionT,
  pt: PointPair,
}) => {
  const {
    ctx,
    gridInfo,
    direction,
    pt,
  } = args
  const gridToWorld = getGridToWorldFn(gridInfo)

  const [pt1, pt2, pt3] = GetArrowHeadDeltas[direction](pt)
  // We're assuming the ctx has been prepped for this
  ctx.beginPath()
  ctx.moveTo(...gridToWorld(...pt1))
  ctx.lineTo(...gridToWorld(...pt2))
  ctx.lineTo(...gridToWorld(...pt3))
  ctx.closePath()
  ctx.fill()
}

const _startingOffsets: GridOffsetMap = {
  [Direction.North]: ([x, y]) => add([0.5, 1.0], [Math.floor(x), y]),
  [Direction.East]: ([x, y]) => add([0.0, 0.5], [x, Math.floor(y)]),
  [Direction.South]: ([x, y]) => add([0.5, 0.0], [Math.floor(x), y]),
  [Direction.West]: ([x, y]) => add([1.0, 0.5], [x, Math.floor(y)]),
}

// REMEMBER: lines _start_ at the tail and _end_ at the head
const LineOffsets: { start: GridOffsetMap, term: GridOffsetMap, end: GridOffsetMap } = {
  start: _startingOffsets,
  // This actually just works for tails and heads
  term: {
    [Direction.North]: ([x, y]) => add([0.5, 0.6], [Math.floor(x), y]),
    [Direction.East]: ([x, y]) => add([0.4, 0.5], [x, Math.floor(y)]),
    [Direction.South]: ([x, y]) => add([0.5, 0.4], [Math.floor(x), y]),
    [Direction.West]: ([x, y]) => add([0.6, 0.5], [x, Math.floor(y)]),
  },
  end: {
    [Direction.North]: _startingOffsets[Direction.South],
    [Direction.East]: _startingOffsets[Direction.West],
    [Direction.South]: _startingOffsets[Direction.North],
    [Direction.West]: _startingOffsets[Direction.East],
  },
}

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
  const getStartOffset = startIsTail ? LineOffsets.term[direction] : LineOffsets.start[direction]
  const getEndOffset = endIsHead ? LineOffsets.term[direction] : LineOffsets.end[direction]
  const [worldStart, worldEnd] = [
    gridToWorld(...getStartOffset(startingPoint)),
    gridToWorld(...getEndOffset(endingPoint)),
  ]
  ctx.moveTo(...worldStart)
  ctx.lineTo(...worldEnd)
}

/**
* `renderArrow`
* `start` and `stop` are index based ranges from which to start and stop
*
* if `stop` is greater than the length of `arrow`, the arrow's head will be extended in its final direction.
*
* `start` and `stop` need not be integers. If they are not, the floating point portion of the `start`/`stop` indexes
*    will be used as sort of a "percentage" to render the `start` and `stop` (respectively) indexes of the arrow.
*
*/
const renderArrow = (args: { arrow: PointPair[], gameBoard: HTMLCanvasElement, gridInfo: GridInfo, start: number, stop: number }) => {
  const {
    arrow,
    gameBoard,
    gridInfo,
    start,
    stop,
  } = args
  const { gridSizePx } = gridInfo

  const ctx = gameBoard.getContext("2d")
  ctx.translate(0.5, 0.5)

  let lastDirection: DirectionT = Direction.North
  ctx.fillStyle = GridDefaults.arrowStyle
  ctx.strokeStyle = GridDefaults.arrowStyle
  let prevPoint: PointPair = [arrow[0][1], arrow[0][0]]
  let lineFirstPoint: PointPair = prevPoint
  let lineStartIdx = 0
  let lastX = 0, lastY = 0
  const subStart = start - Math.floor(start)
  const subStop = stop - Math.floor(stop)
  const stopIdx = Math.floor(stop)
  const startIdx = Math.floor(start)
  for (const i of range({ start: startIdx, stop: stopIdx })) {
    const subIdx = i < start ? subStart : i === stopIdx ? subStop : 0
    const ptWhole: PointPair = i >= arrow.length ? travel([lastX, lastY], lastDirection, 1) : [arrow[i][1], arrow[i][0]]
    const pt = add(ptWhole, [subIdx, subIdx])

    if (i === stopIdx) {
      drawStraitghtLine({ ctx, gridInfo, startingPoint: lineFirstPoint, endingPoint: pt, direction: lastDirection, endIsHead: true, startIsTail: lineStartIdx === startIdx })
      ctx.stroke()
      drawArrowHeadPointingInDirection({ ctx, gridInfo, direction: lastDirection, pt })
      ctx.stroke()
      continue
    }
    const nextPt: PointPair = i >= arrow.length ? travel(ptWhole, lastDirection, 1) : [arrow[i + 1][1], arrow[i + 1][0]]
    const nextDirection = getDirection(ptWhole, nextPt)
    if (i === startIdx) {
      ctx.lineWidth = Math.floor(GridDefaults.linePercent * gridSizePx)
      ctx.beginPath()
    } else if (lastDirection !== nextDirection) {
      if (lineStartIdx != -1) {
        // If we had at least one straight segment
        drawStraitghtLine({ ctx, gridInfo, startingPoint: lineFirstPoint, endingPoint: prevPoint, direction: lastDirection, startIsTail: lineStartIdx === 0 })
      }
      drawArcInDirection({ ctx, gridInfo, borders: `${OppDirection[lastDirection]}|${nextDirection}`, cell: pt })
      lineStartIdx = -1
    } else if (lineStartIdx === -1) {
      // If we did a curve last point and this point we're going straight
      // set ourselves as the first point in the line
      lineFirstPoint = pt
      lineStartIdx = i
    }
    lastDirection = nextDirection
    prevPoint = pt
  }
}
