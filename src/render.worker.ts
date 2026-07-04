import { RenderingEngine } from "./renderer";
import { type RenderMessage } from "./types";


onmessage = (ev: MessageEvent<RenderMessage>) => {
  renderer.handleMessage(ev.data)
}


const renderer = new RenderingEngine((...args: Parameters<typeof postMessage>) => postMessage(...args))
