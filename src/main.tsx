// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './index.css'
// import App from './App.tsx'
//
// createRoot(document.getElementById('root')!).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )
//
//
//
import './index.css'
import { animateArrowLeaving, getEmptySpaces, drawArrowHeadPointingInDirection, drawStraitghtLine } from './level'
import levelManifest from './level-manifest.json'
import type { Level, LevelManifest, PointPair } from './types'
import { type GridInfo, getGridInfo, enumerate, getDebounced } from './util'
import { fixCanvasDims } from './game'
import { GridDefaults } from './constants.ts'
import {
  type DirectionT,
  getDirection,
  Direction,
  OppDirection,
  getGridToWorldFn,
  add,
} from './geometry'




const initGameBoard = () => {
  const gameBoard = document.getElementById('game-board')! as HTMLCanvasElement

  fixCanvasDims(gameBoard)
  const ctx = gameBoard.getContext("2d")

  if (!ctx) {
    throw new Error("NO CAN DO CAPTAIN!")
  }
  return gameBoard
}





// Note: I'm not making this type make any sense, north|north is valid, so is north|south, fuck off intrusive thoughts.
type DirectionPair = `${DirectionT}|${DirectionT}`

const ArcOffsets: { [P in DirectionPair]: [PointPair, PointPair, PointPair, PointPair] } = ({
  'north|east': [[0.5, 0], [0.5, 0.25], [0.75, 0.5], [1.0, 0.5]],
  'east|north': [[0.5, 0], [0.5, 0.25], [0.75, 0.5], [1.0, 0.5]],
  'east|south': [[0.5, 1.0], [0.5, 0.75], [0.75, 0.5], [1.0, 0.5]],
  'south|east': [[0.5, 1.0], [0.5, 0.75], [0.75, 0.5], [1.0, 0.5]],
  'south|west': [[0.5, 1.0], [0.5, 0.75], [0.25, 0.5], [0.0, 0.5]],
  'west|south': [[0.5, 1.0], [0.5, 0.75], [0.25, 0.5], [0.0, 0.5]],
  'west|north': [[0.5, 0.0], [0.5, 0.25], [0.25, 0.5], [0.0, 0.5]],
  'north|west': [[0.5, 0.0], [0.5, 0.25], [0.25, 0.5], [0.0, 0.5]],
} as unknown as typeof ArcOffsets)

const drawArcInDirection = (args: {
  ctx: CanvasRenderingContext2D,
  gridInfo: GridInfo,
  borders: DirectionPair,
  cell: PointPair
}) => {
  const {
    ctx,
    gridInfo,
    borders,
    cell,
  } = args
  const gridToWorld = getGridToWorldFn(gridInfo)
  const [o1, o2, o3, o4] = ArcOffsets[borders]
  const [
    wLineStart,
    _,
    wMidPoint,
    __,
    wLineEnd,
    radius,
  ] = [
      gridToWorld(...add(cell, o1)),
      gridToWorld(...add(cell, o2)),
      gridToWorld(...add(cell, [0.5, 0.5])),
      gridToWorld(...add(cell, o3)),
      gridToWorld(...add(cell, o4)),
      gridInfo.gridSizePx / 4.0
    ]
  ctx.moveTo(...wLineStart)
  // ctx.lineTo(...wArcStart)
  // ctx.moveTo(...wArcStart)
  ctx.arcTo(...wMidPoint, ...wLineEnd, radius)
  ctx.lineTo(...wLineEnd)
}

const renderEmpty = (args: { level: Level, gameBoard: HTMLCanvasElement, arrowsToExclude?: Set<number> }) => {
  const {
    level,
    gameBoard,
    arrowsToExclude,
  } = args
  const emptySpaces: PointPair[] = getEmptySpaces(level, arrowsToExclude)

  const gridInfo = getGridInfo(level, gameBoard)
  const gridToWorld = getGridToWorldFn(gridInfo)
  const ctx = gameBoard.getContext("2d")

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

  // if (level.bounds) {
  //   for (const [gridY, row] of enumerate(level.bounds)) {
  //     for (const [gridX, isInBounds] of enumerate(row)) {
  //       if (!isInBounds) continue
  //
  //       ctx.beginPath()
  //       ctx.arc(...gridToWorld(gridX + 0.5, gridY + 0.5), radius, 0, Math.PI * 2)
  //       ctx.fill()
  //     }
  //   }
  // } else {
  //   for (const gridX of range(level.cols)) {
  //     for (const gridY of range(level.rows)) {
  //       ctx.beginPath()
  //       ctx.arc(...gridToWorld(gridX + 0.5, gridY + 0.5), radius, 0, Math.PI * 2)
  //       ctx.fill()
  //     }
  //   }
  // }
}

const renderArrows = (args: { level: Level, gameBoard: HTMLCanvasElement, arrowsToSkip?: Set<number> }) => {
  const {
    level,
    gameBoard,
    arrowsToSkip = new Set<number>(),
  } = args
  const gridInfo = getGridInfo(level, gameBoard)
  const { gridSizePx, xOffset, yOffset } = gridInfo

  const ctx = gameBoard.getContext("2d")
  ctx.translate(0.5, 0.5)

  console.log(gridInfo)

  ctx.imageSmoothingEnabled = false
  for (const [idx, arrow] of enumerate(level.arrows)) {

    if (arrowsToSkip.has(idx)) continue

    let lastDirection: DirectionT = Direction.North
    ctx.fillStyle = 'black'
    ctx.strokeStyle = 'black'
    let prevPoint: PointPair = [arrow[0][1], arrow[0][0]]
    let lineFirstPoint: PointPair = prevPoint
    let lineStartIdx = 0
    for (let i = 0; i < arrow.length; i++) {
      // NOTE: Arrow coords are always stored backwards....
      const [y, x] = arrow[i]
      const pt: PointPair = [x, y]
      if (i + 1 === arrow.length) {
        drawStraitghtLine({ ctx, gridInfo, startingPoint: lineFirstPoint, endingPoint: pt, direction: lastDirection, endIsHead: true, startIsTail: lineStartIdx === 0 })
        ctx.stroke()
        drawArrowHeadPointingInDirection({ ctx, gridInfo, direction: lastDirection!, x, y })
        ctx.stroke()
        continue
      }
      const [nextY, nextX] = arrow[i + 1]
      const nextPt: PointPair = [nextX, nextY]
      const nextDirection = getDirection(pt, nextPt)
      if (i === 0) {
        ctx.lineWidth = Math.floor(gridSizePx / 7.0)
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
}



const allLevels: LevelManifest[] = Object.values(levelManifest).flat(1) as LevelManifest[]

let lvlIdx = 0


const getLevel = (): Promise<Level> => {
  const { location } = allLevels[lvlIdx]
  return fetch(location).then((resp) => { return resp.json() as Promise<Level> })
}

let level: Level | undefined = undefined

// const setupLevelCo

window.addEventListener('load', async () => {
  const gameBoard = initGameBoard()
  console.log(allLevels)
  level = await getLevel()
  // setInterval(async () => {
  //   lvlIdx = (lvlIdx + 1) % allLevels.length
  //   level = await getLevel()
  //
  //   // fixCanvasDims(gameBoard)
  //   const ctx = gameBoard.getContext("2d")
  //
  //   ctx.reset()
  //   ctx.fillStyle = "black"
  //   ctx.fillRect(0, 0, gameBoard.width, gameBoard.height)
  //   const skipArrows = new Set([lvlIdx % level.arrows.length])
  //   renderEmpty({ level, gameBoard, arrowsToExclude: skipArrows })
  //   renderArrows({ level, gameBoard, arrowsToSkip: skipArrows })
  //
  // }, 3000)
  //

  let gridInfo = getGridInfo(level, gameBoard)
  const skipArrows = new Set([lvlIdx % level.arrows.length])
  renderEmpty({ level, gameBoard })
  renderArrows({ level, gameBoard })
  const arrowsToSkip = new Set<number>()
  const debounced = getDebounced()
  addEventListener('resize', () => {
    debounced(10, () => {
      fixCanvasDims(gameBoard)
      renderEmpty({ level, gameBoard, arrowsToExclude: arrowsToSkip })
      renderArrows({ level, gameBoard, arrowsToSkip })
      gridInfo = getGridInfo(level, gameBoard)
    })
  })
  for (const arrowIdx of level.solution) {
    const arrow = level.arrows[arrowIdx]
    const ctx = gameBoard.getContext("2d")
    const gen = animateArrowLeaving({ arrow, ctx, gridInfo, percentPerSecond: 0.4 })
    const origPos: PointPair = [arrow[0][1], arrow[0][0]]
    // console.log({ arrowIdx })
    // if (arrowIdx === 20) {
    await new Promise<void>(res => {
      let tsStart: number | undefined = undefined
      const cb = (ts) => {
        if (tsStart === undefined) { tsStart = ts }
        const pos = gen.next(ts - tsStart).value || origPos
        // console.log({ pos })
        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, gameBoard.width, gridInfo.yOffset - (gridInfo.gridSizePx / 2))
        ctx.fillRect(0, 0, Math.floor(gridInfo.xOffset - (gridInfo.gridSizePx / 2)), gameBoard.height)
        ctx.fillRect(0, Math.floor(gridInfo.gridSizePx * (level.rows + 0.5) + gridInfo.yOffset), gameBoard.width, gridInfo.yOffset - Math.floor(gridInfo.gridSizePx / 2))
        ctx.fillRect(Math.floor(gridInfo.xOffset - (gridInfo.gridSizePx / 2)) + (gridInfo.gridSizePx * (level.cols + 1)), 0, gameBoard.width, gameBoard.height)
        // ctx.fillRect(
        //   Math.floor(xOffset - (gridSizePx / 2)),
        //   Math.floor(yOffset - (gridSizePx / 2)),
        //   gridSizePx * (level.cols + 1),
        //   gridSizePx * (level.rows + 1),
        // )

        if (pos[0] > level.cols || pos[1] > level.rows || pos[0] < -1 || pos[1] < -1) {
          res()
          return
        }

        requestAnimationFrame(cb)
      }
      requestAnimationFrame(cb)
    })
    // }
    arrowsToSkip.add(arrowIdx)


    ctx.reset()
    renderEmpty({ level, gameBoard, arrowsToExclude: arrowsToSkip })
    renderArrows({ level, gameBoard, arrowsToSkip })
    // while (pos[0] < level.cols && pos[1] < level.rows && it < maxIt) {
    //
    //   it = it + 1
    // }
  }

})
