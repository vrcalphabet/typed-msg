import {
  MessageHandler,
  MessageHandlers,
  ValidatedMessageDefinitions,
} from '../types/internal/message'
import { UnknownToUndefined } from '../types/utils/utils'

type AnyBeforeHandler<T extends ValidatedMessageDefinitions, K extends string> = (
  name: keyof T & string,
  scope: K,
) => void

type AnyAfterHandlerArgs<T extends ValidatedMessageDefinitions, K extends string> = {
  [N in keyof T & string]: [
    name: N,
    message: {
      req: UnknownToUndefined<T[N]['req']>
      res: UnknownToUndefined<T[N]['res']>
    },
    scope: K,
  ]
}[keyof T & string]

type AnyAfterHandler<T extends ValidatedMessageDefinitions, K extends string> = (
  ...args: AnyAfterHandlerArgs<T, K>
) => void

export class Receiver<T extends ValidatedMessageDefinitions, K extends string> {
  private _handlers: MessageHandlers<T> = {}
  private _anyBeforeHandlers: AnyBeforeHandler<T, K>[] = []
  private _anyAfterHandlers: AnyAfterHandler<T, K>[] = []

  constructor(private _scope: K) {
    chrome.runtime.onMessage.addListener((message, sender, sendMessage) => {
      if (!this._typed(message)) return
      if (message.scope !== this._scope) return
      ;(async () => {
        const handler = this._handlers[message.name]
        if (!handler) {
          sendMessage({ error: 'ハンドラーが未定義です。' })
          return
        }

        this._anyBeforeHandlers.forEach((beforeHandler) => {
          beforeHandler(message.name, _scope)
        })

        const res = await Promise.resolve(handler(message.req, sender))
        sendMessage({ res })

        setTimeout(() => {
          this._anyAfterHandlers.forEach((afterHandler) => {
            // req, res が省略された型でもエラーが出ないように any
            afterHandler(message.name, { req: message.req, res } as any, _scope)
          })
        }, 0)
      })()

      return true
    })
  }

  /**
   * 指定したメッセージ名に対するハンドラーを登録します。
   *
   * 同じスコープ、同じ名前で複数のハンドラーは登録できず、エラーを投げます。
   *
   * @param name - 処理するメッセージの名前。`MessageDefinitions` で定義した名前（キー）を指定します。
   * @param handler - メッセージを処理するコールバック関数。引数は以下の通りです:
   *   - `req`: 送信側から送られたリクエストデータ
   *   - `sender`: `chrome.runtime.MessageSender` オブジェクト（タブ情報等）
   * @returns 送信側に返すレスポンス。Promiseを返すと自動的に解決されます。
   * @throws 同じスコープ、同じ名前のハンドラーが既に登録されている場合
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
  on<V extends keyof T & string>(name: V, handler: MessageHandler<T, V>) {
    if (name in this._handlers) {
      throw new Error(
        `同じ名前のハンドラーは複数登録できません。（スコープ: "${this._scope}", 名前: "${name}）`,
      )
    }

    this._handlers[name] = handler
  }

  /**
   * すべてのメッセージを受け取るハンドラーを登録します。
   *
   * メインハンドラが**実行される前に**、登録順に実行されます。そのため、特別な場合を除き重い処理をしてはいけません。
   *
   * @param handler - すべてのメッセージを処理するコールバック関数。引数は以下の通りです:
   *   - `name`: 受信したメッセージの名前
   *   - `scope`: このレシーバーのスコープ名
   *
   * @example
   * ```ts
   * const storageReceiver = receive('storage')
   *
   * storageReceiver.onAnyBefore((name, scope) => {
   *   console.log(`[${scope}] ${name} を受信しました`)
   * })
   * ```
   */
  onAnyBefore(handler: AnyBeforeHandler<T, K>) {
    this._anyBeforeHandlers.push(handler)
  }

  /**
   * すべてのメッセージを受け取るハンドラーを登録します。
   *
   * メインハンドラが**実行され、レスポンスを返した後に**、登録順に実行されます。
   *
   * @param handler - すべてのメッセージを処理するコールバック関数。引数は以下の通りです:
   *   - `name`: 受信したメッセージの名前
   *   - `message`: リクエスト（`req`）とレスポンス（`res`）を含むオブジェクト
   *   - `scope`: このレシーバーのスコープ名
   *
   * @example
   * ```ts
   * const storageReceiver = receive('storage')
   *
   * storageReceiver.onAnyAfter((name, message, scope) => {
   *   // name で分岐すると message の型が絞り込まれる
   *   if (name === 'setSettings') {
   *     console.log(message.req) // { theme: 'light' | 'dark'; language: string }
   *   }
   *
   *   console.log(`[${scope}] ${name} が完了しました`, message.res)
   * })
   * ```
   */
  onAnyAfter(handler: AnyAfterHandler<T, K>) {
    this._anyAfterHandlers.push(handler)
  }

  private _typed(
    message: any,
  ): message is { scope: string; name: string; req: any } {
    return typeof message?.scope === 'string' && typeof message?.name === 'string'
  }
}
