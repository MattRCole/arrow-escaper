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
import levelManifest from './level-manifest.json'

type Level = {
  rows: number,
  cols: number,
  minArrowLen: number,
  maxArrowLen: number,
  seed: number | string,
  joinedArrows: boolean,
  fullyPacked: boolean,
  arrows: number[][][]
}

const initGameBoard = () => {
  const gameBoard: HTMLCanvasElement = document.getElementById('game-board')!

  const ctx = gameBoard.getContext("2d")

  if (!ctx) {
    throw new Error("NO CAN DO CAPTAIN!")
  }

  ctx.arc()
}

const getLevel = (): Level => fetch(levelManifest["10x20"][0]["location"]).then((resp) => { return resp.json() as Promise<unknown> })

window.addEventListener('load', () => {
  console.log("hello", levelManifest)

})
