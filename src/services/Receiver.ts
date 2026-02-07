import {
  MergedMessageDefinitions,
  MessageHandler,
  MessageHandlers,
} from '../types/internal/message';

export class Receiver<
  T extends MergedMessageDefinitions,
  K extends keyof T & string,
> {
  private handlers: MessageHandlers<T[K]> = {};

  constructor(scope: K) {
    chrome.runtime.onMessage.addListener((message, sender, sendMessage) => {
      if (!this._typed(message)) return;
      if (message.scope !== scope) return;

      (async () => {
        const handler = this.handlers[message.name];
        if (!handler) {
          throw new Error(
            `scope: "${scope}", name: "${message.name}" のハンドラーが未定義です。`,
          );
        }

        const res = await Promise.resolve(handler(message.req, sender));
        sendMessage(res);
      })();

      return true;
    });
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
   * const receiver = receive<Message>("remote");
   *
   * receiver.on('addRepository', (req, sender) => {
   *   console.log(req.url);
   *   console.log(sender.tab?.id);
   *   return { success: true };
   * });
   *
   * // 非同期のハンドラーも指定可能
   * receiver.on('fetchData', async (req) => {
   *   const data = await someAsyncOperation(req);
   *   return { success: true, message: data };
   * });
   * ```
   */
  on<V extends keyof T[K] & string>(name: V, handler: MessageHandler<T[K], V>) {
    if (name in this.handlers) {
      throw new Error('同じ名前のメッセージリスナーは複数登録できません');
    }

    this.handlers[name] = handler;
  }

  private _typed(
    message: any,
  ): message is { scope: string; name: string; req: any } {
    return typeof message?.scope === 'string' && typeof message?.name === 'string';
  }
}
