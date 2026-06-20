import { readdir, writeFile } from "node:fs/promises";

/** @type {(target: string, ...toRemove: string[]) => string} */
const removePrefix = (target, ...toRemove) => {
  for (const prefix of toRemove) {
    if (!target.startsWith(toRemove)) continue

    return target.slice(prefix.length)
  }
  return target
}

/** @type {(target: string, ...toRemove: string[]) => string} */
const removeSuffix = (target, ...toRemove) => {
  for (const suffix of toRemove) {
    if (!target.startsWith(toRemove)) continue

    return target.slice(0, -(suffix.length))
  }
  return target
}

/**
  * @template T
  * @template {(keyof T)[]} K
  * @param {T} obj
  * @param {K} keysToOmit
  * @returns {Omit<T, K[number]>}
  */
const omit = (obj, ...keysToOmit) => {
  return Object.entries(obj).reduce((acc, [k, v]) => (keysToOmit.includes(k) ? acc : { ...acc, [k]: v }), {})
}


/** @type {(path?: string, outPath?: string) => Promise<void>} */
const main = async (path, outPath, webPath) => {
  const loadPath = path ?? './public/levels/'
  const writePath = outPath ?? './src'
  const insertPath = webPath ?? removePrefix(loadPath, './public')

  const dirContents = await readdir(loadPath)
  const levels = dirContents.filter(fp => fp.endsWith(".json") && !fp.endsWith("manifest.json"))
  const manifest = await levels.reduce(async (accPromise, levelName) => {
    const acc = await accPromise
    const cleanName = removePrefix(levelName, '/', './')

    const importPath = `${removeSuffix(loadPath, '/')}/${cleanName}`
    const level = omit((await import(importPath, { with: { type: "json" } })).default, 'arrows', 'solution', 'dependencies', 'bounds')
    const key = `${level.rows}x${level.cols}`
    const prev = acc[key] ?? []
    return { ...acc, [key]: [...prev, { ...level, location: `${removeSuffix(insertPath, '/')}/${cleanName}` }] }
  }, Promise.resolve({}))

  await writeFile(`${removeSuffix(writePath, '/')}/manifest.json`, JSON.stringify(manifest, null, 2), { encoding: 'utf-8' })
}


if (import.meta.main) {
  main().then(() => { })
}

