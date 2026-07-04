import { add } from "./geometry";
import type { Level, PointPair, GridInfo } from "./types";
import { getDebounced, getGridInfo } from "./util";

export const fixCanvasDims = (canvas: HTMLCanvasElement) => {
  const { width, height } = canvas.getBoundingClientRect()
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
}

export class Game {
  public readonly gameBoard: HTMLCanvasElement
  public readonly level: Level
  public removedArrows: Set<number>
  public readonly arrowLeavePercentage: number
  private onWin: () => void
  private upperLeft: PointPair
  private lowerRight: PointPair
  private gridInfo: GridInfo
  private leavingArrows: number[]
  private taps: PointerEvent[]
  constructor(args: { gameBoard: HTMLCanvasElement, level: Level, onWin: () => void, arrowLeavePercentage: number }) {
    const {
      gameBoard,
      level,
      onWin,
      arrowLeavePercentage,
    } = args
    this.gameBoard = gameBoard
    this.level = level
    this.onWin = onWin
    this.removedArrows = new Set<number>()
    this.recomputeBoundaries()
    this.arrowLeavePercentage = arrowLeavePercentage
    this.addResize()
  }

  addResize() {
    const debounced = getDebounced()
    const renderGameBoard = this.renderGameBoard.bind(this)
    const recomputeBoundaries = this.recomputeBoundaries.bind(this)
    this.gameBoard.addEventListener('resize', () => {
      debounced(20, () => {
        fixCanvasDims(this.gameBoard)
        recomputeBoundaries()
        renderGameBoard()
      })
    })

  }

  recomputeBoundaries() {
    this.gridInfo = getGridInfo(this.level, this.gameBoard);
    this.upperLeft = [Math.floor(this.gridInfo.xOffset - (this.gridInfo.gridSizePx / 2)), Math.floor(this.gridInfo.yOffset - (this.gridInfo.gridSizePx / 2))];
    this.lowerRight = add(this.upperLeft, [Math.round(this.gridInfo.gridSizePx * (this.level.cols + 1)), Math.round(this.gridInfo.gridSizePx * (this.level.rows + 1))]);
  }

  renderGameBoard() {
  }
  renderArrows() {
    // const ctx
  }
}
