import { MessageDefs } from '../types/internal/message'
import { MessageHandler, MessageHandlers, MessagingOptions } from '../types/message'
import { Failure } from '../utils/Failure'

/**
 * メッセージを受信してハンドラーで処理するクラスです。
 *
 * `createMessaging` から返される `receive` 関数で生成します。
 * 直接インスタンス化せず、`receive(scope)` を使用してください。
 *
 * @example
 * ```ts
 * const storageReceiver = receive('storage')
 *
 * storageReceiver.on('setSettings', async (req) => {
 *   await chrome.storage.local.set({ settings: req })
 *   return success()
 * })
 * ```
 */
export class Receiver<TDefs extends MessageDefs, TScope extends string> {
  private _handlers: MessageHandlers<TDefs> = {}

  constructor(
    private _scope: TScope,
    options: MessagingOptions<any>,
  ) {
    chrome.runtime.onMessage.addListener((message, sender, sendMessage) => {
      if (!this._typed(message)) return
      if (message.scope !== this._scope) return
      const { scope, name, req } = message

      const handler = this._handlers[name]
      if (!handler) {
        sendMessage({ error: 'ハンドラーが未定義です。' })
        return
      }

      try {
        options.onRequest?.({ scope, name, req })
      } catch (e) {
        console.error(e)
      }

      ;(async () => {
        let res
        try {
          res = await Promise.resolve(handler(req, sender))
        } catch (e) {
          // handler でエラーが発生した場合
          sendMessage({ error: e instanceof Error ? e.message : String(e) })
          return
        }

        try {
          options.onResponse?.({ scope, name, req, res })
        } catch (e) {
          console.error(e)
        }

        // Failure はシリアライズできないので一旦バラす
        sendMessage({
          success: !(res instanceof Failure),
          data: res instanceof Failure ? res.message : res,
        })
      })()

      return true
    })
  }

  /**
   * 指定したメッセージ名に対するハンドラーを登録します。
   *
   * 同じスコープ、同じ名前で複数のハンドラーは登録できず、エラーを投げます。
   *
   * @param name - 処理するメッセージの名前。メッセージ定義のキーを指定します。
   * @param handler - メッセージを処理するコールバック関数。引数は以下の通りです:
   *   - `req`: 送信側から送られたリクエストデータ
   *   - `sender`: `chrome.runtime.MessageSender` オブジェクト（タブ情報等）
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
   * storageReceiver.on('getCurrentTab', async (_, sender) => {
   *   const tab = sender.tab
   *   if (!(tab && tab.id && tab.url && tab.title)) {
   *     return failure('タブ情報を取得できませんでした')
   *   }
   *   return success({ id: tab.id, url: tab.url, title: tab.title })
   * })
   * ```
   */
  on<TName extends keyof TDefs & string>(
    name: TName,
    handler: MessageHandler<TDefs, TName>,
  ) {
    if (name in this._handlers) {
      // リスナーを2つ以上追加してしまうと、どの返り値を返すか問題が発生する
      throw new Error(
        `同じ名前のハンドラーは複数登録できません。（スコープ: "${this._scope}", 名前: "${name}"）`,
      )
    }

    this._handlers[name] = handler
  }

  private _typed(
    message: any,
  ): message is { scope: string; name: string; req: any } {
    return typeof message?.scope === 'string' && typeof message?.name === 'string'
  }
}
