import { RenderingEngine } from "./renderer"
import { type RenderMessage } from "./types"

/** Don't get it twisted: this renders, but it isn't a worker, it fakes the worker API */
export class FakeRenderWorker {
  public onmessage: (ev: MessageEvent<any>) => void
  public renderer: RenderingEngine

  postMessage(...args: [unknown, Transferable] | [unknown] | [unknown, StructuredSerializeOptions]) {
    this.renderer.handleMessage(args[0] as RenderMessage)
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

