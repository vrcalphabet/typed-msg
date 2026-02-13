import { Receiver } from './services/Receiver';
import {
  MergedMessageDefinitions,
  MessageInterface,
} from './types/internal/message';

export type * from './types/message';
export * from './utils/response';

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
     * type Messages = MergeMessageDefinitions<{ remote: RemoteMessages }>;
     *
     * const sender = connect<Messages>('remote');
     * const result = await sender.addRepository({ url: 'https://...' });
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
                  console.error(chrome.runtime.lastError);
                  reject(`ハンドラーが未定義の可能性があります。（スコープ: "${scope}", 名前: "${name}）`);
                } else if (message.error !== undefined) {
                  reject(`${message.error}（スコープ: "${scope}", 名前: "${name}）`);
                } else {
                  resolve(message.res);
                }
              }),
            );
        },
      });
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
     * type Messages = MergeMessageDefinitions<{ remote: RemoteMessages }>;
     *
     * const receiver = receive<Messages>('remote');
     * receiver.on('addRepository', (req, sender) => {
     *   console.log(req.url);
     *   return { success: true };
     * });
     * ```
     */
    receive<K extends keyof T & string>(
      scope: K,
    ): Receiver<T[K], K> {
      return new Receiver(scope);
    },
  };
}
