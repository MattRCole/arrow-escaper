import { RenderingEngine } from "./renderer"
import { RenderWorkerCommand, type RenderMessage } from "./types"

/** Don't get it twisted: this renders, but it isn't a worker, it fakes the worker API */
export class FakeRenderWorker {
  public onmessage: (ev: MessageEvent<any>) => void
  public renderer: RenderingEngine

  postMessage(...args: [unknown, Transferable] | [unknown] | [unknown, StructuredSerializeOptions]) {
    const [message] = (args as [RenderMessage])
    switch (message.type) {
      case RenderWorkerCommand.Init:
        this.renderer.init(message.payload)
        return
      case RenderWorkerCommand.CanvasUpdate:
        this.renderer.updateSizing(message.payload)
        return
      case RenderWorkerCommand.RemoveArrow:
        this.renderer.removeArrow(message.payload)
        return
      case RenderWorkerCommand.Pause:
      case RenderWorkerCommand.Resume:
      default:
        console.warn("The fake worker can't handle the following message:", message)
    }
  }

  handlePostMessage(...args: Parameters<typeof Worker.prototype.postMessage>) {
    if (!this.onmessage) return
    this.onmessage(new MessageEvent('message', { data: args[0] }))
  }
  constructor() {
    this.handlePostMessage = this.handlePostMessage.bind(this)
    this.renderer = new RenderingEngine((...args: Parameters<typeof Worker.prototype.postMessage>) => {
      this.handlePostMessage(args[0])
    })
  }
}

