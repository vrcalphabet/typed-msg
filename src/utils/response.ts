type Success = { success: true }
type SuccessData<T> = Success & { data: T }

type Failure = { success: false }
type FailureMessage<T> = Failure & { message: T }

/**
 * 成功レスポンスを生成するヘルパー関数です。
 *
 * - 引数なしで呼ぶと `{ success: true }` を返します。
 * - 引数にデータを渡すと `{ success: true, data: T }` を返します。
 *
 * @param data - レスポンスに含めるデータ。省略可能です。
 * @returns 成功レスポンスオブジェクト
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
export function success(): Success
export function success<T>(data: T): SuccessData<T>
export function success(data?: unknown) {
  if (data === undefined) {
    return { success: true }
  } else {
    return { success: true, data }
  }
}

/**
 * 失敗レスポンスを生成するヘルパー関数です。
 *
 * - 引数なしで呼ぶと `{ success: false }` を返します。
 * - 引数にメッセージを渡すと `{ success: false, message: T }` を返します。
 *
 * @param message - エラーメッセージ。省略可能です。
 * @returns 失敗レスポンスオブジェクト
 *
 * @example
 * ```ts
 * tabsReceiver.on('getCurrentTab', async (_, sender) => {
 *   const tab = sender.tab
 *   if (!tab?.id || !tab.url || !tab.title) {
 *     return failure('タブ情報を取得できませんでした')
 *   }
 *   return success({ id: tab.id, url: tab.url, title: tab.title })
 * })
 * ```
 */
export function failure(): Failure
export function failure<T>(message: T): FailureMessage<T>
export function failure(message?: unknown) {
  if (message === undefined) {
    return { success: false }
  } else {
    return { success: false, message }
  }
}
