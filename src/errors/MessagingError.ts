/**
 * 通信レベルで発生したエラーを表すクラスです。
 *
 * Service Worker の停止やレシーバー未設定など、
 * `chrome.runtime.sendMessage` 自体が失敗した場合にスローされます。
 *
 * `failure()` によるビジネスロジック上の失敗とは区別されます。
 *
 * @example
 * ```ts
 * const { sender } = createMessaging<Messages>({
 *   onError: (error) => {
 *     // error は MessagingError のインスタンス
 *     console.error(`[${error.scope}.${error.name}] ${error.message}`)
 *   },
 * })
 * ```
 */
export class MessagingError extends Error {
  /**
   * @param scope - エラーが発生したメッセージのスコープ名
   * @param name - エラーが発生したメッセージの名前
   * @param message - エラーメッセージの本文
   */
  constructor(
    readonly scope: string,
    readonly name: string,
    message: string,
  ) {
    super(message)
  }
}

// TODO: readme, typedocを更新したうえでpublish