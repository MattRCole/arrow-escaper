import { RenderingEngine } from "./renderer";
import { type RenderMessage, RenderWorkerCommand } from "./types";


onmessage = (ev: MessageEvent<RenderMessage>) => {
  switch (ev.data.type) {
    case RenderWorkerCommand.RemoveArrow:
      renderer.removeArrow(ev.data.payload)
      break
    case RenderWorkerCommand.Init:
      renderer.init(ev.data.payload)
      return
    case RenderWorkerCommand.CanvasUpdate:
      renderer.updateSizing(ev.data.payload)
      return
    case RenderWorkerCommand.Pause:
    case RenderWorkerCommand.Resume:
    default:
      // Not supported yet I suppose
      console.warn(`Render worker cannot yet handle the ${ev.data.type} command yet`)
      return;

  }
}


const renderer = new RenderingEngine((...args: Parameters<typeof postMessage>) => postMessage(...args))
