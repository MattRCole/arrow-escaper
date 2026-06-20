export type LevelManifest = (typeof import('./level-manifest.json'))["10x20"][number]

export type Level = LevelManifest & {
  arrows: [number, number][][]
  bounds?: number[][],
  solution: number[],
  dependencies: { [idx: string]: number[] }
}

export type PointPair = [number, number]
