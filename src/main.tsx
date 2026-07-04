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
import { type Level, type LevelManifest, RenderWorkerCommand, type RenderCanvasUpdateCommand, type RenderInitCommand, type RenderRemoveArrowCommand, type RenderResponseMessage, RenderWorkerUpdate } from './types'
import { getGridInfo } from './util'
import Worker from './render.worker.ts?worker'
import { FakeRenderWorker } from './fake-worker.ts'



const initGameBoard = () => {
  const gameBoard = document.getElementById('game-board')! as HTMLCanvasElement

  const { width, height } = gameBoard.getBoundingClientRect()
  gameBoard.width = width
  gameBoard.height = height
  return gameBoard
}

const allLevels: LevelManifest[] = Object.values(levelManifest).flat(1) as LevelManifest[]

let lvlIdx = 0


const getLevel = (): Promise<Level> => {
  const { location } = allLevels[lvlIdx]
  return fetch(location).then((resp) => { return resp.json() as Promise<Level> })
}

let level: Level | undefined = undefined

window.addEventListener('load', async () => {
  const gameBoard = initGameBoard()
  console.log(allLevels)
  level = await getLevel()

  const worker = window.Worker ? new Worker() : new FakeRenderWorker()
  const prepCanvas = document.createElement('canvas')
  prepCanvas.width = gameBoard.width
  prepCanvas.height = gameBoard.height
  const offscreenPrep = prepCanvas.transferControlToOffscreen()
  const offscreenGameBoard = gameBoard.transferControlToOffscreen()
  worker.postMessage({
    type: RenderWorkerCommand.Init,
    payload: {
      prepBoard: offscreenPrep,
      gameBoard: offscreenGameBoard,
      arrowPercentPerSecond: 10,
      gridInfo: getGridInfo(level, gameBoard),
      targetFPS: 60,
      level,
    }
  } as RenderInitCommand, [offscreenPrep, offscreenGameBoard])
  addEventListener('resize', () => {
    const rect = gameBoard.getBoundingClientRect()
    worker.postMessage({ type: RenderWorkerCommand.CanvasUpdate, payload: { gridInfo: getGridInfo(level, rect), width: rect.width, height: rect.height } } as RenderCanvasUpdateCommand)
  })
  let solutionIdx = 1
  worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: level.solution[0] } as RenderRemoveArrowCommand)
  worker.onmessage = (ev: MessageEvent<RenderResponseMessage>) => {
    if (!ev.data.type || ev.data.type !== RenderWorkerUpdate.ArrowRemoved) {
      console.warn('WTF am I supposed to do with this shit???', ev.data)
      return
    }
    if (solutionIdx < level.solution.length) {
      worker.postMessage({ type: RenderWorkerCommand.RemoveArrow, payload: level.solution[solutionIdx] })
      solutionIdx = solutionIdx + 1
    }
  }
})

