import {
  MessageHandler,
  MessageHandlers,
  ValidatedMessageDefinitions,
} from '../types/internal/message';

type AnyHandler<T, K> = (name: keyof T & string, scope: K) => void;

export class Receiver<T extends ValidatedMessageDefinitions, K extends string> {
  private _handlers: MessageHandlers<T> = {};
  private _anyHandlers: AnyHandler<T, K>[] = [];

  constructor(private _scope: K) {
    chrome.runtime.onMessage.addListener((message, sender, sendMessage) => {
      if (!this._typed(message)) return;
      if (message.scope !== this._scope) return;

      (async () => {
        const handler = this._handlers[message.name];
        if (!handler) {
          sendMessage({ error: 'ハンドラーが未定義です。' });
          return;
        }

        const res = await Promise.resolve(handler(message.req, sender));
        sendMessage({ res });
      })();

      setTimeout(() => {
        this._anyHandlers.forEach((handler) => {
          handler(message.name, _scope);
        });
      }, 0);

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
  on<V extends keyof T & string>(name: V, handler: MessageHandler<T, V>) {
    if (name in this._handlers) {
      throw new Error(
        `同じ名前のハンドラーは複数登録できません。（スコープ: "${this._scope}", 名前: "${name}）`,
      );
    }

    this._handlers[name] = handler;
  }

  /**
   * メッセージ名に関係なく、すべてのメッセージを受け取る any ハンドラーを登録します。
   *
   * 複数の any ハンドラーを登録でき、登録順に実行されます。
   *
   * @param handler - すべてのメッセージを処理するコールバック関数。引数は以下の通りです:
   *   - `name`: 受信したメッセージの名前
   *   - `scope`: このレシーバーのスコープ名
   *
   * @example
   * ```ts
   * const receiver = receive<Message>("remote");
   *
   * receiver.onAny((name, scope) => {
   *   console.log(`メッセージ "${name}" をスコープ "${scope}" で受信しました`);
   * });
   * ```
   */
  onAny(handler: AnyHandler<T, K>) {
    this._anyHandlers.push(handler);
  }

  private _typed(
    message: any,
  ): message is { scope: string; name: string; req: any } {
    return typeof message?.scope === 'string' && typeof message?.name === 'string';
  }
}
