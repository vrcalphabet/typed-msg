import { MessagingError } from './errors/MessagingError'
import { Receiver } from './services/Receiver'
import { MergedMessageDefs } from './types/internal/message'
import { MessageInterface, MessagingOptions } from './types/message'
import { failure } from './utils'
import { Failure } from './utils/Failure'

export type * from './types/message'
export type { MergedMessageDefs, MessageDefs } from './types/internal/message'
export type { AsyncOrSync } from './types/utils'
export * from './utils'
export { MessagingError } from './errors/MessagingError'
export { Receiver } from './services/Receiver'

/**
 * 型付きメッセージングインターフェースを生成するファクトリ関数です。
 *
 * `MergeMessageDefs` で統合した型を型引数に渡すことで、
 * `sender`（送信）と `receive`（受信）からなるオブジェクトを取得できます。
 *
 * @template TMergedDefs - `MergeMessageDefs` で作成した統合メッセージ定義型
 * @param options - オプション設定。
 * @returns `sender` と `receive` を持つオブジェクト
 *
 * @example
 * ```ts
 * import { type MergeMessageDefs, createMessaging } from 'typed-msg'
 *
 * type StorageMessages = {
 *   setSettings: {
 *     req: { theme: 'light' | 'dark'; language: string }
 *     res: void
 *   }
 * }
 *
 * type Messages = MergeMessageDefs<{
 *   storage: StorageMessages
 * }>
 *
 * export const { sender, receive } = createMessaging<Messages>()
 * ```
 */
export function createMessaging<TMergedDefs extends MergedMessageDefs>(
  options: MessagingOptions<TMergedDefs> = {},
) {
  return {
    /**
     * メッセージの送信用インターフェースを作成します。
     *
     * 返される Proxy オブジェクトでは、定義したメッセージ名をメソッドとして呼び出せます。
     * 各メソッドは `req` を引数に取り、`Promise<res>` を返します。
     *
     * 通信エラーが発生した場合:
     * - `options.onError` が `Failure` を返す -> その `Failure` で resolve
     * - それ以外 -> {@link MessagingError} をスロー
     *
     * @param scope - メッセージのスコープ名。受信側（`receive`）と一致させる必要があります。
     * @returns メッセージ送信用の Proxy オブジェクト
     *
     * @example
     * ```ts
     * const storage = sender('storage')
     *
     * // req ありのメッセージ
     * const saveResult = await storage.setSettings({ theme: 'dark', language: 'ja' })
     *
     * // req なしのメッセージ
     * const settingsResult = await storage.getSettings()
     * if (settingsResult instanceof Success) {
     *   console.log(settingsResult.theme)
     * }
     * ```
     */
    sender<TScope extends keyof TMergedDefs & string>(
      scope: TScope,
    ): MessageInterface<TMergedDefs[TScope]> {
      return new Proxy({} as MessageInterface<TMergedDefs[TScope]>, {
        get(_, name: string) {
          return async (req: unknown) => {
            try {
              const message = await chrome.runtime.sendMessage({ scope, name, req })
              if (message.error) throw message.error

              // シリアライズされた失敗レスポンスを再構築
              return message.success ? message.data : failure(message.data)
            } catch (e) {
              // SWへの接続不良やreceive()が未設定の場合
              const errorMessage = e instanceof Error ? e.message : String(e)
              const error = new MessagingError(scope, name, errorMessage)
              const result = options.onError?.(error)

              if (result instanceof Failure) return result
              throw error
            }
          }
        },
      })
    },

    /**
     * メッセージを受信するためのレシーバーを作成します。
     *
     * @param scope - 受信するメッセージのスコープ名。送信側（`sender`）と一致させる必要があります。
     * @returns メッセージハンドラーを登録するための {@link Receiver} インスタンス
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
    receive<TScope extends keyof TMergedDefs & string>(
      scope: TScope,
    ): Receiver<TMergedDefs[TScope], TScope> {
      return new Receiver(scope, options)
    },
  }
}
