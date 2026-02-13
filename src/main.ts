import { Receiver } from './services/Receiver'
import { MergedMessageDefinitions, MessageInterface } from './types/internal/message'

export type * from './types/message'
export * from './utils/response'

/**
 * 型付きメッセージングインターフェースを生成するファクトリ関数です。
 *
 * `MergeMessageDefinitions` で統合した型を型引数に渡すことで、
 * `connect`（送信）と `receive`（受信）からなるオブジェクトを取得できます。
 *
 * @template T - `MergeMessageDefinitions` で作成した統合メッセージ定義型
 * @returns `connect` と `receive` を持つオブジェクト
 *
 * @example
 * ```ts
 * import { type MessageDefinitions, type MergeMessageDefinitions, createMessaging } from 'typed-msg'
 *
 * type StorageMessages = MessageDefinitions<{
 *   setSettings: {
 *     req: { theme: 'light' | 'dark'; language: string }
 *     res: MessageResponse
 *   }
 * }>
 *
 * type Messages = MergeMessageDefinitions<{
 *   storage: StorageMessages
 * }>
 *
 * export const { connect, receive } = createMessaging<Messages>()
 * ```
 */
export function createMessaging<T extends MergedMessageDefinitions>() {
  return {
    /**
     * メッセージリスナーとの通信を行うための送信用インターフェースを作成します。
     *
     * @template T - メッセージ定義の型。`MergeMessageDefinitions` で作成した型を指定します。
     * @param scope - メッセージのスコープ名。受信側（`receive`）と一致させる必要があります。
     * @returns メッセージ送信用のProxyオブジェクト。定義したメッセージ名をメソッドとして呼び出せます。
     *
     * @example
     * ```ts
     * const storage = connect('storage')
     *
     * // req ありのメッセージ
     * const saveResult = await storage.setSettings({ theme: 'dark', language: 'ja' })
     *
     * // req なしのメッセージ
     * const settingsResult = await storage.getSettings()
     * if (settingsResult.success) {
     *   console.log(settingsResult.data.theme)
     * }
     * ```
     */
    connect<K extends keyof T & string>(scope: K): MessageInterface<T[K]> {
      return new Proxy({} as MessageInterface<T[K]>, {
        get(_, name: string) {
          return (req: unknown) =>
            new Promise((resolve, reject) =>
              chrome.runtime.sendMessage({ scope, name, req }, (message) => {
                if (chrome.runtime.lastError) {
                  // SWへの接続不良やreceive()が未設定の場合
                  console.error(chrome.runtime.lastError)
                  reject(
                    `ハンドラーが未定義の可能性があります。（スコープ: "${scope}", 名前: "${name}）`,
                  )
                } else if (message.error !== undefined) {
                  reject(`${message.error}（スコープ: "${scope}", 名前: "${name}）`)
                } else {
                  resolve(message.res)
                }
              }),
            )
        },
      })
    },

    /**
     * メッセージを受信するためのレシーバーを作成します。
     *
     * @template T - メッセージ定義の型。`MergeMessageDefinitions` で作成した型を指定します。
     * @param scope - 受信するメッセージのスコープ名。送信側（`connect`）と一致させる必要があります。
     * @returns メッセージハンドラーを登録するための `Receiver` インスタンスです。
     *
     * @example
     * ```ts
     * import { success, failure } from 'typed-msg'
     *
     * const storageReceiver = receive('storage')
     *
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
    receive<K extends keyof T & string>(scope: K): Receiver<T[K], K> {
      return new Receiver(scope)
    },
  }
}
