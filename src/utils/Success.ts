import { Failure } from './Failure'

/**
 * 成功を表すクラスです。`instanceof Success` でレスポンスの成功判定に使用します。
 *
 * 直接インスタンス化はできません。成功レスポンスの生成には {@link success} を使用してください。
 *
 * @example
 * ```ts
 * const result = await storage.getSettings()
 * if (result instanceof Success) {
 *   console.log(result.theme)
 * }
 * ```
 */
export class Success {
  private constructor() {}

  static [Symbol.hasInstance](value: unknown): boolean {
    return !(value instanceof Failure)
  }
}

/**
 * 成功レスポンスを生成するヘルパー関数です。
 *
 * - 引数なしで呼ぶと `undefined` を返します。
 * - 引数にデータを渡すと、そのデータ自体が成功レスポンスとして返されます。
 *
 * 返された値は `instanceof Success` で `true` と判定されます。
 * ただし、返されるデータは `TData` であり `Success` のインスタンスではありません。
 *
 * @returns 成功レスポンス
 *
 * @example
 * ```ts
 * storageReceiver.on('setSettings', async (req) => {
 *   await chrome.storage.local.set({ settings: req })
 *   return success()
 * })
 *
 * storageReceiver.on('getSettings', async () => {
 *   const data = await chrome.storage.local.get('settings')
 *   return success(data.settings)
 * })
 * ```
 */
export function success(): undefined & Success
/**
 * 成功レスポンスを生成するヘルパー関数です。
 *
 * @param data - レスポンスに含めるデータ
 * @returns 成功レスポンス
 */
export function success<TData>(data: TData): TData & Success
export function success(data?: unknown) {
  return data
}
