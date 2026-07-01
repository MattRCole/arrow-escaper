import { GridDefaults } from './constants'
import { type DirectionT, add, Direction, getDirection, getGridToWorldFn, OppDirection, travel, } from './geometry'
import type { PointPair } from './types'
import { range, type GridInfo } from './util'
import logger from './logging'

type NeighborDir<D extends DirectionT> = D extends 'north' | 'south' ? 'east' | 'west'
  : D extends 'east' | 'west' ? 'north' | 'south' : never


const ArcToOffsets: { [P in DirectionT]: { [R in NeighborDir<P>]: (mod: number) => [PointPair, PointPair] } } = ({
  [Direction.North]: {
    [Direction.West]: mod => [[0.5, 1 - mod], [0.0, 0.5]],
    [Direction.East]: mod => [[0.5, 1 - mod], [1.0, 0.5]],
  },
  [Direction.East]: {
    [Direction.North]: mod => [[0.0 + mod, 0.5], [0.5, 0]],
    [Direction.South]: mod => [[0.0 + mod, 0.5], [0.5, 1.0]],
  },
  [Direction.South]: {
    [Direction.East]: mod => [[0.5, 0.0 + mod], [1.0, 0.5]],
    [Direction.West]: mod => [[0.5, 0.0 + mod], [0.0, 0.5]],
  },
  [Direction.West]: {
    [Direction.South]: mod => [[1.0 - mod, 0.5], [0.5, 1.0]],
    [Direction.North]: mod => [[1.0 - mod, 0.5], [0.5, 0.0]]
  }
})

const drawStaticArc = (args: {
  ctx: CanvasRenderingContext2D,
  gridInfo: GridInfo,
  prevDirection: DirectionT,
  currentDirection: DirectionT,
  subIndex: number,
  pt: PointPair
}) => {
  const {
    ctx,
    gridInfo,
    prevDirection: previousDirection,
    currentDirection,
    pt,
    subIndex: mod,
  } = args
  const gridToWorld = getGridToWorldFn(gridInfo)
  const [o1, o4] = ArcToOffsets[previousDirection][currentDirection](mod)
  const [
    wLineStart,
    wMidPoint,
    wLineEnd,
    radius,
  ] = [
      gridToWorld(...add(pt, o1)),
      gridToWorld(...add(pt, [0.5, 0.5])),
      gridToWorld(...add(pt, o4)),
      gridInfo.gridSizePx / 4.0
    ]
  ctx.moveTo(...wLineStart)
  ctx.arcTo(...wMidPoint, ...wLineEnd, radius)
  ctx.lineTo(...wLineEnd)
}

const ArcInfo = {
  [Direction.North]: {
    [Direction.West]: (percent: number) => [[0.25, 0.75], [Math.PI * (2 - (0.5 * percent)), 3 / 2 * Math.PI, true]],
    [Direction.East]: (percent: number) => [[0.75, 0.75], [Math.PI * (1 + (0.5 * percent)), 3 / 2 * Math.PI, false]],
  },
  [Direction.East]: {
    [Direction.North]: (percent: number) => [[0.25, 0.25], [Math.PI * (0.5 - (0.5 * percent)), 0, true]],
    [Direction.South]: (percent: number) => [[0.25, 0.75], [Math.PI * (1.5 + (0.5 * percent)), 0, false]],
  },
  [Direction.South]: {
    [Direction.East]: (percent: number) => [[0.75, 0.25], [Math.PI * (1.0 - (0.5 * percent)), Math.PI * 0.5, true]],
    [Direction.West]: (percent: number) => [[0.25, 0.25], [Math.PI * 0.5 * percent, Math.PI * 0.5, false]],
  },
  [Direction.West]: {
    [Direction.South]: (percent: number) => [[0.75, 0.75], [Math.PI * (1.5 - (percent / 2)), Math.PI, true]],
    [Direction.North]: (percent: number) => [[0.75, 0.25], [Math.PI * (0.5 + (percent / 2)), Math.PI, false]],
  }
} as any as { [P in DirectionT]: { [P in DirectionT]: (percent: number) => [PointPair, [number, number, boolean]] } }

const drawArc = (args: {
  subIndex: number,
  ctx: CanvasRenderingContext2D,
  pt: PointPair,
  prevDirection: DirectionT,
  currentDirection: DirectionT,
  gridInfo: GridInfo,
}) => {
  const {
    subIndex,
    ctx,
    pt,
    prevDirection,
    currentDirection,
    gridInfo,
  } = args
  const radius = gridInfo.gridSizePx * 0.25
  const gridToWorld = getGridToWorldFn(gridInfo)
  if (subIndex < 0.25) {
    // we are only "cutting off" less than 25% of the arc, so we can use static values
    drawStaticArc({ ctx, gridInfo, prevDirection, currentDirection, pt, subIndex })
  } else if (subIndex < 0.75) {
    const arcPercent = (subIndex - 0.25) / 0.5
    const [centerPoint, arcInfo] = ArcInfo[prevDirection][currentDirection](arcPercent)
    // draw arc
    ctx.arc(...gridToWorld(...add(pt, centerPoint)), radius, ...arcInfo)
    // draw exit line, (note, exclude the starting point since path is at correct point already to fix some render errors)
    drawStraitghtLine({
      gridInfo,
      ctx,
      direction: currentDirection,
      endingPoint: pt,
      endMod: 0,
    })

  } else {
    drawStraitghtLine({
      gridInfo,
      ctx,
      direction: currentDirection,
      startingPoint: pt,
      endingPoint: pt, startMod: subIndex, endMod: 0
    })
  }
}

type GridOffsetMap = { [P in DirectionT]: (startingPoint: PointPair, mod: number) => PointPair }

const onDirectionOffset = 1.0 / 4.0
const offDirectionOffset = 1.0 / 3.0
const headBuffer = 0.3

const GetArrowHeadDeltas: { [P in DirectionT]: (startingPoint: PointPair, mod: number) => [PointPair, PointPair, PointPair] } = {
  [Direction.North]: (pt, mod) => [add([offDirectionOffset, 1.0 - onDirectionOffset - mod], pt), add([0.5, headBuffer - mod], pt), add([1.0 - offDirectionOffset, 1.0 - onDirectionOffset - mod], pt)],
  [Direction.East]: (pt, mod) => [add([onDirectionOffset + mod, offDirectionOffset], pt), add([1 - headBuffer + mod, 0.5], pt), add([onDirectionOffset + mod, 1.0 - offDirectionOffset], pt)],
  [Direction.South]: (pt, mod) => [add([offDirectionOffset, onDirectionOffset + mod], pt), add([0.5, 1.0 - headBuffer + mod], pt), add([1.0 - offDirectionOffset, onDirectionOffset + mod], pt)],
  [Direction.West]: (pt, mod) => [add([1.0 - onDirectionOffset - mod, offDirectionOffset], pt), add([headBuffer - mod, 0.5], pt), add([1.0 - onDirectionOffset - mod, 1.0 - offDirectionOffset], pt)],
}

export const drawArrowHeadPointingInDirection = (args: {
  ctx: CanvasRenderingContext2D,
  gridInfo: GridInfo,
  direction: DirectionT,
  pt: PointPair,
  mod: number,
}) => {
  const {
    ctx,
    gridInfo,
    direction,
    pt,
    mod,
  } = args
  const gridToWorld = getGridToWorldFn(gridInfo)

  const [pt1, pt2, pt3] = GetArrowHeadDeltas[direction](pt, mod)
  // logger.debug({ mod, direction, pt, pt1, pt2, pt3, })
  // We're assuming the ctx has been prepped for this
  ctx.beginPath()
  ctx.moveTo(...gridToWorld(...pt1))
  ctx.lineTo(...gridToWorld(...pt2))
  ctx.lineTo(...gridToWorld(...pt3))
  ctx.closePath()
  ctx.fill()
}

const _startingOffsets: GridOffsetMap = {
  [Direction.North]: ([x, y], mod) => add([0.5, 1.0 - mod], [x, y]),
  [Direction.East]: ([x, y], mod) => add([0.0 + mod, 0.5], [x, y]),
  [Direction.South]: ([x, y], mod) => add([0.5, 0.0 + mod], [x, y]),
  [Direction.West]: ([x, y], mod) => add([1.0 - mod, 0.5], [x, y]),
}

// REMEMBER: lines _start_ at the tail and _end_ at the head
const LineOffsets: { start: GridOffsetMap, term: GridOffsetMap, end: GridOffsetMap } = {
  start: _startingOffsets,
  // This actually just works for tails and heads
  term: {
    [Direction.North]: ([x, y], mod) => add([0.5, 0.6 - mod], [x, y]),
    [Direction.East]: ([x, y], mod) => add([0.4 + mod, 0.5], [x, y]),
    [Direction.South]: ([x, y], mod) => add([0.5, 0.4 + mod], [x, y]),
    [Direction.West]: ([x, y], mod) => add([0.6 - mod, 0.5], [x, y]),
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
  startingPoint?: PointPair,
  startMod?: number,
  endingPoint: PointPair,
  endMod: number,
  direction: DirectionT,
  startIsTail?: boolean,
  endIsHead?: boolean
}) => {
  const {
    ctx,
    gridInfo,
    startingPoint,
    startMod,
    endingPoint,
    endMod,
    direction,
    startIsTail = false,
    endIsHead = false,
  } = args
  const gridToWorld = getGridToWorldFn(gridInfo)
  const getStartOffset = LineOffsets.start[direction]
  // const getStartOffset = startIsTail ? LineOffsets.term[direction] : LineOffsets.start[direction]
  const getEndOffset = endIsHead ? LineOffsets.term[direction] : LineOffsets.end[direction]
  const [modStart, modEnd] = [
    startingPoint ? getStartOffset(startingPoint, startMod) : 'none',
    getEndOffset(endingPoint, endMod),
  ]
  // logger.debug({ start: startingPoint, modStart, end: endingPoint, modEnd, direction })
  if (startingPoint) {
    ctx.moveTo(...gridToWorld(
      ...getStartOffset(startingPoint, startMod ?? 0)
    ))
  }
  const worldEnd = gridToWorld(...getEndOffset(endingPoint, endMod))
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
export const renderArrow = (args: { arrow: PointPair[], ctx: CanvasRenderingContext2D, gridInfo: GridInfo, start: number, stop: number }) => {
  const {
    arrow,
    ctx,
    gridInfo,
    start,
    stop,
  } = args
  const { gridSizePx } = gridInfo

  ctx.translate(0.5, 0.5)

  ctx.fillStyle = GridDefaults.arrowStyle
  ctx.strokeStyle = GridDefaults.arrowStyle
  let prevPoint: PointPair = [arrow[0][1], arrow[0][0]]
  let prevPointWhole: PointPair = prevPoint
  let lineFirstPoint: PointPair = prevPoint
  const stopIdx = Math.floor(stop)
  const startIdx = Math.floor(start)
  const subStart = start - Math.floor(start)
  const subStop = stop - Math.floor(stop)

  const finalDirection = getDirection([arrow.at(-2)[1], arrow.at(-2)[0]], [arrow.at(-1)[1], arrow.at(-1)[0]])
  const finalPoint: PointPair = [arrow.at(-1)[1], arrow.at(-1)[0]]

  // Returns a "safe" point pair in the form of [x,y]
  const getSafePointAt = (idx: number): PointPair => (idx >= arrow.length
    ? travel(finalPoint, finalDirection, idx - arrow.length + 1)
    : [arrow[idx][1], arrow[idx][0]])

  let lineStartIdx = -1
  let lineModIdx = 0
  let lastDirection: DirectionT = Direction.North
  {
    const idx1 = startIdx === 0 ? 0 : startIdx - 1
    const idx2 = startIdx === 0 ? 1 : startIdx
    // We need to have an accurate "lastDirection" but we have to handle the edge-case of starting at the first index
    lastDirection = getDirection(getSafePointAt(idx1), getSafePointAt(idx2))
    if (startIdx === 0 || lastDirection === getDirection(getSafePointAt(idx2), getSafePointAt(idx2 + 1))) {
      lineFirstPoint = getSafePointAt(startIdx)
      lineStartIdx = startIdx
      lineModIdx = subStart
    }
  }
  ctx.lineWidth = Math.floor(GridDefaults.linePercent * gridSizePx)
  ctx.beginPath()
  // logger.debug("Mark.")
  // logger.debug({ lineFirstPoint, lineModIdx, lineStartIdx })
  for (const i of range({ start: startIdx, stop: stopIdx + 1 })) {
    const subIdx = i === stopIdx ? subStop : i < start ? subStart : 0
    const ptWhole = getSafePointAt(i)
    const pt = add(ptWhole, [subIdx, subIdx])
    console.log({ i, start, stop, ptWhole: JSON.stringify(ptWhole), pt: JSON.stringify(pt), arrowLen: arrow.length })

    if (i === stopIdx) {
      drawStraitghtLine({
        ctx,
        gridInfo,
        startingPoint: lineFirstPoint,
        startMod: lineModIdx,
        endingPoint: ptWhole,
        endMod: subIdx,
        direction: lastDirection,
        endIsHead: true,
        startIsTail: lineStartIdx === startIdx
      })
      ctx.stroke()
      drawArrowHeadPointingInDirection({ ctx, gridInfo, direction: lastDirection, pt: ptWhole, mod: subIdx })
      ctx.stroke()
      continue
    }
    const nextPt = getSafePointAt(i + 1)
    const nextDirection = getDirection(ptWhole, nextPt)
    if (lastDirection !== nextDirection) {
      if (lineStartIdx != -1 && i !== startIdx) {
        // If we had at least one straight segment
        drawStraitghtLine({
          ctx,
          gridInfo,
          startingPoint: lineFirstPoint,
          startMod: lineModIdx,
          endingPoint: prevPointWhole,
          endMod: subIdx,
          direction: lastDirection,
          startIsTail: lineStartIdx === 0
        })
      }
      drawArc({ ctx, gridInfo, prevDirection: lastDirection, currentDirection: nextDirection, pt: ptWhole, subIndex: subIdx, })
      lineStartIdx = -1
    } else if (lineStartIdx === -1) {
      // If we did a curve last point and this point we're going straight
      // set ourselves as the first point in the line
      // logger.debug({ prevLineFirstPoint: lineFirstPoint, prevLineModIdx: lineModIdx, prevLineStartIdx: lineStartIdx, lineFirstPoint: ptWhole, lineModIdx: subIdx, lineStartIdx: i })
      lineFirstPoint = ptWhole
      lineModIdx = subIdx
      lineStartIdx = i
    }
    lastDirection = nextDirection
    prevPoint = pt
    prevPointWhole = ptWhole
  }
}
