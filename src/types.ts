export type LevelManifest = (typeof import('./level-manifest.json'))["10x20"][number]

export type Level = LevelManifest & {
  arrows: [number, number][][]
  bounds?: number[][],
  solution: number[],
  dependencies: { [idx: string]: number[] }
}

export type PointPair = [number, number]

export const RenderWorkerCommand = {
  Init: 'init',
  RemoveArrow: 'remove-arrow',
  Pause: 'pause',
  Resume: 'resume',
  CanvasUpdate: 'canvas-update'
} as const

type RenderWorkerCommandE = typeof RenderWorkerCommand

export type GridInfo = {
  gridSizePx: number,
  xOffset: number,
  yOffset: number,
}

export type RenderInitCommand = {
  type: RenderWorkerCommandE['Init']
  payload: {
    prepBoard: OffscreenCanvas,
    gameBoard: OffscreenCanvas,
    gridInfo: GridInfo,
    level: Level,
    targetFPS: number,
    arrowPercentPerSecond: number,
  }
}

export type RenderRemoveArrowCommand = {
  type: RenderWorkerCommandE['RemoveArrow'],
  payload: number,
}

type SimpleCommand<T extends RenderWorkerCommandT> = { type: T }
export type RenderPauseCommand = SimpleCommand<RenderWorkerCommandE['Pause']>
export type RenderResumeCommand = SimpleCommand<RenderWorkerCommandE['Resume']>
export type RenderCanvasUpdateCommand = {
  type: RenderWorkerCommandE['CanvasUpdate'],
  payload: { gridInfo: GridInfo, width: number, height: number }
}

export type RenderWorkerCommandT = typeof RenderWorkerCommand[keyof typeof RenderWorkerCommand]
export type RenderMessage = RenderInitCommand | RenderRemoveArrowCommand | RenderPauseCommand | RenderResumeCommand | RenderCanvasUpdateCommand


export const RenderWorkerUpdate = {
  ArrowRemoved: 'arrow-removed',
} as const
export type RenderWorkerUpdateT = typeof RenderWorkerUpdate[keyof typeof RenderWorkerUpdate]

export type RenderArrowRemovedMessage = { type: typeof RenderWorkerUpdate['ArrowRemoved'], payload: number }
export type RenderResponseMessage = RenderArrowRemovedMessage

