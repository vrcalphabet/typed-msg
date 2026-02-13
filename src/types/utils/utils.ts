export type SafeExtract<T, K> = K extends keyof T ? T[K] : void

export type AsyncOrSync<T> = T | Promise<T>

export type UnknownToUndefined<T> = unknown extends T ? undefined : T
