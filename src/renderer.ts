import { renderArrows } from "./arrow"
import { getGridToWorldFn } from "./geometry"
import { animateArrowLeaving, renderEmpty } from "./level"
import { RenderWorkerCommand, RenderWorkerUpdate, type GridInfo, type Level, type PointPair, type RenderCanvasUpdateCommand, type RenderInitCommand, type RenderMessage } from "./types"


export class RenderingEngine {
  public gameBoard: OffscreenCanvas
  public prepBoard: OffscreenCanvas
  public gridInfo: GridInfo
  public arrowPercentPerSecond: number
  public level: Level
  public targetFPS: number
  public prepCtx: OffscreenCanvasRenderingContext2D
  public renderCtx: OffscreenCanvasRenderingContext2D
  public arrowsRemoved: Set<number>
  public arrowsLeaving: Set<number>
  public prevFrame: number
  public arrowsLeavingGenMap: { [arrowIdx: number]: ReturnType<typeof animateArrowLeaving> }
  public debugTaps: { [pos: string]: PointPair }
  public bgImageHash: string
  public _bgImage: ImageData
  public _postMessage: typeof Worker.prototype.postMessage

  get frameTime() { return 1000 / this.targetFPS }

  get bgImage(): ImageData {
    const hash = `${this.arrowsRemoved.size}|${this.arrowsLeaving.size}|${this.gameBoard.width}|${this.gameBoard.height}`
    if (this.bgImageHash === hash) return this._bgImage

    this.bgImageHash = hash
    this._bgImage = this._getBgImage()

    return this._bgImage
  }

  constructor(postMessage) {
    this._postMessage = postMessage
    // this.popDebugTap = this.popDebugTap.bind(this)
    this.loop = this.loop.bind(this)
    this.debugTaps = {}
    // setInterval(this.popDebugTap, 5000)
  }
  // private popDebugTap() {
  //   if (!this.debugTaps.length)
  //     return
  //   const [_, ...debugTaps] = this.debugTaps
  //   this.debugTaps = debugTaps
  //   this.renderDebugTaps(this.arrowsLeaving.size === 0)
  // }

  handleMessage(message: RenderMessage) {
    switch (message.type) {
      case RenderWorkerCommand.RemoveArrow:
        this.removeArrow(message.payload)
        break
      case RenderWorkerCommand.Init:
        this.init(message.payload)
        return
      case RenderWorkerCommand.CanvasUpdate:
        this.updateSizing(message.payload)
        return
      case RenderWorkerCommand.DebugTap:
        this.addDebugTap(message.payload)
        return
      case RenderWorkerCommand.Pause:
      case RenderWorkerCommand.Resume:
      default:
        // Not supported yet I suppose
        console.warn(`Render worker cannot yet handle the ${message.type} command yet`)
        return;

    }
  }

  updateSizing(args: RenderCanvasUpdateCommand['payload']) {
    this.gridInfo.gridSizePx = args.gridInfo.gridSizePx
    this.gridInfo.xOffset = args.gridInfo.xOffset
    this.gridInfo.yOffset = args.gridInfo.yOffset
    this.gameBoard.width = args.width
    this.prepBoard.width = args.width
    this.gameBoard.height = args.height
    this.prepBoard.height = args.height
    if (this.arrowsLeaving.size === 0) this.renderBoard()
  }
  _getBgImage() {
    this.prepCtx.reset()
    this.prepCtx.clearRect(0, 0, this.prepBoard.width, this.prepBoard.height)
    renderEmpty({
      level: this.level,
      ctx: this.prepCtx,
      gridInfo: this.gridInfo,
      arrowsToExclude: this.arrowsRemoved.difference(this.arrowsLeaving),
    })
    this.prepCtx.resetTransform()
    renderArrows({
      level: this.level,
      ctx: this.prepCtx,
      gridInfo: this.gridInfo,
      arrowsToSkip: this.arrowsRemoved,
    })
    return this.prepCtx.getImageData(0, 0, this.prepBoard.width, this.prepBoard.height)
  }
  renderDebugTaps(clear: boolean = false) {
    if (clear) this.renderCtx.putImageData(this.bgImage, 0, 0)

    this.renderCtx.fillStyle = 'red'
    for (const tap of Object.values(this.debugTaps)) {
      this.renderCtx.resetTransform()
      this.renderCtx.beginPath()
      this.renderCtx.arc(...getGridToWorldFn(this.gridInfo)(...tap), this.gridInfo.gridSizePx * 0.15, 0, Math.PI * 2)
      this.renderCtx.fill()
    }
  }
  renderBoard() {
    this.renderCtx.reset()
    this.renderCtx.putImageData(this.bgImage, 0, 0)

  }

  addDebugTap(point: PointPair) {
    const key = `${point[0]}:${point[1]}`
    const debugTaps = this.debugTaps
    debugTaps[key] = point
    setTimeout(() => {
      delete debugTaps[key]
    }, 500)
    this.renderDebugTaps(this.arrowsLeaving.size === 0)
  }

  init(args: RenderInitCommand['payload']) {
    this.gameBoard = args.gameBoard
    this.prepBoard = args.prepBoard
    this.gridInfo = args.gridInfo
    this.arrowPercentPerSecond = args.arrowPercentPerSecond
    this.level = args.level
    this.targetFPS = args.targetFPS
    this.arrowsRemoved = new Set()
    this.arrowsLeaving = new Set()
    this.arrowsLeavingGenMap = {}
    this.prevFrame = 0
    this.prepCtx = args.prepBoard.getContext("2d", { willReadFrequently: true })
    this.renderCtx = args.gameBoard.getContext("2d")
    this.renderBoard()
  }
  removeArrow(idx: number) {
    const callLoop = this.arrowsLeaving.size === 0

    this.arrowsRemoved.add(idx)
    this.arrowsLeaving.add(idx)

    if (callLoop) {
      this.prevFrame = 0
      requestAnimationFrame(this.loop)
    }
  }

  loop(ts: number) {
    const {
      level,
      renderCtx,
      gridInfo,
      arrowsLeaving,
      arrowPercentPerSecond,
      arrowsLeavingGenMap,
    } = this
    if (arrowsLeaving.size === 0) {
      // we don't need to be rendering rn, we'll wait for loop to be called again.
      return
    }
    const delta = this.prevFrame === 0 ? 0 : ts - this.prevFrame

    this.prevFrame = ts
    this.renderBoard()
    for (const arrowIdx of arrowsLeaving.values()) {
      if (arrowsLeavingGenMap[arrowIdx] === undefined) {
        arrowsLeavingGenMap[arrowIdx] = animateArrowLeaving({
          gridInfo,
          arrow: level.arrows[arrowIdx],
          bounds: [level.cols, level.rows],
          ctx: renderCtx,
          percentPerSecond: arrowPercentPerSecond,
          exponent: 1.3,
        })
      }

      renderCtx.resetTransform()
      const gen = arrowsLeavingGenMap[arrowIdx]
      const pos = gen.next(delta).value

      if (!pos) continue
      const [x, y] = pos

      if (x < 0 || y < 0 || x >= level.cols || y >= level.rows) {
        arrowsLeaving.delete(arrowIdx)
        arrowsLeavingGenMap[arrowIdx] = undefined
        this._postMessage({ type: RenderWorkerUpdate['ArrowRemoved'], payload: arrowIdx })
      }
    }
    this.renderDebugTaps()

    requestAnimationFrame(this.loop)
  }
}

