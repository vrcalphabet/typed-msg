import { Receiver } from './services/Receiver';
import {
  MergedMessageDefinitions,
  MessageInterface,
} from './types/internal/message';

export * from './types/message';

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
export function connect<T extends MergedMessageDefinitions>(
  scope: keyof T & string,
): MessageInterface<T[keyof T & string]> {
  return new Proxy({} as MessageInterface<T[keyof T & string]>, {
    get(_, name: string) {
      return (req: unknown) =>
        new Promise((resolve, reject) =>
          chrome.runtime.sendMessage({ scope, name, req }, (res) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(res);
            }
          }),
        );
    },
  });
}

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
export function receive<T extends MergedMessageDefinitions>(
  scope: keyof T & string,
): Receiver<T, keyof T & string> {
  return new Receiver(scope);
}
