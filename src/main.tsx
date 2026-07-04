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
import levelManifest from './level-manifest.json'
import { type Level, type LevelManifest, RenderWorkerCommand, type RenderCanvasUpdateCommand, type RenderInitCommand, type RenderRemoveArrowCommand, type RenderResponseMessage, RenderWorkerUpdate, type PointPair } from './types'
import { getGridInfo } from './util'
import Worker from './render.worker.ts?worker'
import { FakeRenderWorker } from './fake-worker.ts'
import { getWorldToGridFn } from './geometry.ts'
import defaultLogger from './logging.ts'



const initGameBoard = () => {
  const gameBoard = document.getElementById('game-board')! as HTMLCanvasElement

  const { width, height } = gameBoard.getBoundingClientRect()
  gameBoard.width = width
  gameBoard.height = height
  return gameBoard
}

const allLevels: LevelManifest[] = Object.values(levelManifest).flat(1) as LevelManifest[]

let lvlIdx = 0


const getLevel = async (): Promise<Level> => {
  const { location } = allLevels[lvlIdx]
  level = await fetch(location).then((resp) => { return resp.json() as Promise<Level> })
  lvlIdx = lvlIdx + 1
  return level
}

let level: Level | undefined = undefined

const startGame = (level: Level, prepCanvas: OffscreenCanvas, gameBoard: OffscreenCanvas, worker: Worker | FakeRenderWorker, origGameBoard: HTMLCanvasElement) => {
  worker.postMessage({
    type: RenderWorkerCommand.Init,
    payload: {
      prepBoard: prepCanvas,
      gameBoard,
      arrowPercentPerSecond: 10,
      gridInfo: getGridInfo(level, gameBoard),
      targetFPS: 60,
      level,
    }
  } as RenderInitCommand, [prepCanvas, gameBoard])
  let gridInfo = getGridInfo(level, gameBoard)
  let rect = origGameBoard.getBoundingClientRect()
  const resizeHandler = () => {
    rect = origGameBoard.getBoundingClientRect()
    gridInfo = getGridInfo(level, rect)
    worker.postMessage({ type: RenderWorkerCommand.CanvasUpdate, payload: { gridInfo, width: rect.width, height: rect.height } } as RenderCanvasUpdateCommand)
  }
  addEventListener('resize', resizeHandler)

  const dependencies = Object.entries(level.dependencies).reduce((acc, [idxStr, dependsOn]) => ({ ...acc, [parseInt(idxStr)]: new Set(dependsOn) }), {} as { [arrowIdx: number]: Set<number> })
  let pendingRemovalArrows = []
  const removedArrows = new Set()
  const remainingArrows = new Set(level.arrows.map((_, idx) => idx))
  const posToArrowIdx = level.arrows.reduce((acc, arrow, arrowIdx) => {
    return arrow.reduce((acc2, [y, x]) => {
      const existingX = acc2[x] ?? {}
      return { ...acc2, [x]: { ...existingX, [y]: arrowIdx } }
    }, acc)
  }, {} as { [x: number]: { [y: number]: number } })
  console.log(dependencies, posToArrowIdx)

  // worker.onmessage = (ev: MessageEvent<RenderResponseMessage>) => {
  //   if (!ev.data.type || ev.data.type !== RenderWorkerUpdate.ArrowRemoved) {
  //     console.warn('WTF am I supposed to do with this shit???', ev.data)
  //     return
  //   }
  //   pendingRemovalArrows.splice(pendingRemovalArrows.indexOf(ev.data.payload), 1)
  //   if (pendingRemovalArrows.length) {
  //     worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: pendingRemovalArrows[0] })
  //   }
  // }

  origGameBoard.onclick = ev => {
    const worldPos: PointPair = [ev.x - rect.left, ev.y - rect.top]
    const worldToGrid = getWorldToGridFn(gridInfo)
    const gridPos = worldToGrid(...worldPos)
    const adjustedPos: PointPair = [Math.round(gridPos[0] - 0.5), Math.round(gridPos[1] - 0.5)]
    const [x, y] = adjustedPos
    const centeredPos: PointPair = [adjustedPos[0] + 0.5, adjustedPos[1] + 0.5]
    worker.postMessage({ type: RenderWorkerCommand.DebugTap, payload: gridPos })
    // defaultLogger.warn({ gridPos, adjustedPos, adjustedWorld: worldPos, original: [ev.x, ev.y], rect: rect.toJSON(), gridInfo })
    const arrowIdx = (posToArrowIdx[x] ?? {})[y] ?? -1

    if (!remainingArrows.has(arrowIdx)) {
      console.log("miss-click at ${x},${y}")
      return
    }
    const arrowDeps = dependencies[arrowIdx]
    const remainigDeps = arrowDeps.difference(removedArrows)
    if (remainigDeps.size > 0) {
      console.log(`Cannot remove ${arrowIdx}, remainingDeps: ${JSON.stringify(Array.from(remainigDeps))}`)
      return
    }
    pendingRemovalArrows.push(arrowIdx)
    removedArrows.add(arrowIdx)
    remainingArrows.delete(arrowIdx)
    console.log(JSON.stringify(Array.from(remainingArrows)))
    if (remainingArrows.size === 0) {
      let foo = true
      worker.onmessage = ({ data }) => {
        if (data.payload !== arrowIdx || !foo) return

        foo = false
        console.log("starting next level...")
        removeEventListener('resize', resizeHandler)
        getLevel().then(nextLevel => {
          startGame(nextLevel, prepCanvas, gameBoard, worker, origGameBoard)
        })
      }
    }
    worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: arrowIdx } as RenderRemoveArrowCommand)
    // if (pendingRemovalArrows.length === 1) {
    //   worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: arrowIdx } as RenderRemoveArrowCommand)
    //   return
    // }

    // ev.offsetX
  }
  // let solutionIdx = 1
  // worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: level.solution[0] } as RenderRemoveArrowCommand)
  // worker.onmessage = (ev: MessageEvent<RenderResponseMessage>) => {
  //   if (!ev.data.type || ev.data.type !== RenderWorkerUpdate.ArrowRemoved) {
  //     console.warn('WTF am I supposed to do with this shit???', ev.data)
  //     return
  //   }
  //   if (solutionIdx < level.solution.length) {
  //     worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: level.solution[solutionIdx] })
  //     solutionIdx = solutionIdx + 1
  //   }
  // }
}

window.addEventListener('load', async () => {
  const gameBoard = initGameBoard()
  console.log(allLevels)
  level = await getLevel()

  // const worker = window.Worker ? new Worker() : new FakeRenderWorker()
  const worker = new FakeRenderWorker()
  const prepCanvas = document.createElement('canvas')
  prepCanvas.width = gameBoard.width
  prepCanvas.height = gameBoard.height
  const offscreenPrep = prepCanvas.transferControlToOffscreen()
  const offscreenGameBoard = gameBoard.transferControlToOffscreen()
  startGame(level, offscreenPrep, offscreenGameBoard, worker, gameBoard)
  // worker.postMessage({
  //   type: RenderWorkerCommand.Init,
  //   payload: {
  //     prepBoard: offscreenPrep,
  //     gameBoard: offscreenGameBoard,
  //     arrowPercentPerSecond: 10,
  //     gridInfo: getGridInfo(level, gameBoard),
  //     targetFPS: 60,
  //     level,
  //   }
  // } as RenderInitCommand, [offscreenPrep, offscreenGameBoard])
  // let gridInfo = getGridInfo(level, gameBoard)
  // let rect = gameBoard.getBoundingClientRect()
  // addEventListener('resize', () => {
  //   rect = gameBoard.getBoundingClientRect()
  //   gridInfo = getGridInfo(level, rect)
  //   worker.postMessage({ type: RenderWorkerCommand.CanvasUpdate, payload: { gridInfo, width: rect.width, height: rect.height } } as RenderCanvasUpdateCommand)
  // })
  //
  // const dependencies = Object.entries(level.dependencies).reduce((acc, [idxStr, dependsOn]) => ({ ...acc, [parseInt(idxStr)]: new Set(dependsOn) }), {} as { [arrowIdx: number]: Set<number> })
  // let pendingRemovalArrows = []
  // const removedArrows = new Set()
  // const remainingArrows = new Set(level.arrows.map((_, idx) => idx))
  // const posToArrowIdx = level.arrows.reduce((acc, arrow, arrowIdx) => {
  //   return arrow.reduce((acc2, [y, x]) => {
  //     const existingX = acc2[x] ?? {}
  //     return { ...acc2, [x]: { ...existingX, [y]: arrowIdx } }
  //   }, acc)
  // }, {} as { [x: number]: { [y: number]: number } })
  // console.log(dependencies, posToArrowIdx)
  //
  // // worker.onmessage = (ev: MessageEvent<RenderResponseMessage>) => {
  // //   if (!ev.data.type || ev.data.type !== RenderWorkerUpdate.ArrowRemoved) {
  // //     console.warn('WTF am I supposed to do with this shit???', ev.data)
  // //     return
  // //   }
  // //   pendingRemovalArrows.splice(pendingRemovalArrows.indexOf(ev.data.payload), 1)
  // //   if (pendingRemovalArrows.length) {
  // //     worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: pendingRemovalArrows[0] })
  // //   }
  // // }
  //
  // gameBoard.onclick = ev => {
  //   const worldPos: PointPair = [ev.x - rect.left, ev.y - rect.top]
  //   const worldToGrid = getWorldToGridFn(gridInfo)
  //   const gridPos = worldToGrid(...worldPos)
  //   const adjustedPos: PointPair = [Math.round(gridPos[0] - 0.5), Math.round(gridPos[1] - 0.5)]
  //   const [x, y] = adjustedPos
  //   const centeredPos: PointPair = [adjustedPos[0] + 0.5, adjustedPos[1] + 0.5]
  //   worker.postMessage({ type: RenderWorkerCommand.DebugTap, payload: gridPos })
  //   // defaultLogger.warn({ gridPos, adjustedPos, adjustedWorld: worldPos, original: [ev.x, ev.y], rect: rect.toJSON(), gridInfo })
  //   const arrowIdx = (posToArrowIdx[x] ?? {})[y] ?? -1
  //
  //   if (!remainingArrows.has(arrowIdx)) {
  //     console.log("miss-click at ${x},${y}")
  //     return
  //   }
  //   const arrowDeps = dependencies[arrowIdx]
  //   const remainigDeps = arrowDeps.difference(removedArrows)
  //   if (remainigDeps.size > 0) {
  //     console.log(`Cannot remove ${arrowIdx}, remainingDeps: ${JSON.stringify(Array.from(remainigDeps))}`)
  //     return
  //   }
  //   pendingRemovalArrows.push(arrowIdx)
  //   removedArrows.add(arrowIdx)
  //   remainingArrows.delete(arrowIdx)
  //   worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: arrowIdx } as RenderRemoveArrowCommand)
  //   if (remainingArrows.size === 0) {
  //   }
  //   // if (pendingRemovalArrows.length === 1) {
  //   //   worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: arrowIdx } as RenderRemoveArrowCommand)
  //   //   return
  //   // }
  //
  //   // ev.offsetX
  // }
  // // let solutionIdx = 1
  // // worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: level.solution[0] } as RenderRemoveArrowCommand)
  // // worker.onmessage = (ev: MessageEvent<RenderResponseMessage>) => {
  // //   if (!ev.data.type || ev.data.type !== RenderWorkerUpdate.ArrowRemoved) {
  // //     console.warn('WTF am I supposed to do with this shit???', ev.data)
  // //     return
  // //   }
  // //   if (solutionIdx < level.solution.length) {
  // //     worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: level.solution[solutionIdx] })
  // //     solutionIdx = solutionIdx + 1
  // //   }
  // // }
})

