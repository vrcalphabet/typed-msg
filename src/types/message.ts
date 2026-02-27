import { MessagingError } from '../errors/MessagingError'
import { Failure } from '../utils/Failure'
import { Success } from '../utils/Success'
import { MergedMessageDefs, MessageDefs } from './internal/message'
import { AsyncOrSync } from './utils'

/**
 * `createMessaging` に渡すオプションです。
 *
 * 通信エラー時のハンドリング、リクエスト/レスポンスのフック処理を設定できます。
 *
 * @example
 * ```ts
 * const { sender, receive } = createMessaging<Messages>({
 *   onError: ({ scope, name, message }) => {
 *     console.error(`[${scope}.${name}] ${message}`)
 *   },
 * })
 * ```
 */
export interface MessagingOptions<TMergedDefs extends MergedMessageDefs> {
  /**
   * 通信レベルのエラーが発生したときに呼ばれるコールバックです。
   *
   * Service Worker の停止などでメッセージの送受信自体が失敗した場合に発火します。
   * `failure()` によるビジネスロジックの失敗では呼ばれません。
   *
   * `Failure` を返すと `reject` せずにそのまま `resolve` します。
   * 何も返さなければ従来通り `reject` されます。
   *
   * @param error - 発生した {@link MessagingError} インスタンス
   * @returns `Failure` を返すと resolve されます。何も返さないと reject されます。
   */
  onError?: OnErrorHandler

  /**
   * メッセージ受信時、メインハンドラが**実行される前に**呼ばれるフックです。
   *
   * ロギングやデバッグ用途を想定しています。重い処理を入れることは推奨されません。
   *
   * @param context - 受信したメッセージのスコープ名・メッセージ名・リクエストデータを含むオブジェクト
   *
   * @example
   * ```ts
   * const { sender, receive } = createMessaging<Messages>({
   *   onRequest: ({ scope, name, req }) => {
   *     console.log(`[${scope}] ${name} を受信しました`, { req })
   *   },
   * })
   * ```
   */
  onRequest?: OnRequestHandler<TMergedDefs>

  /**
   * メインハンドラが**実行され、レスポンスを返した後に**呼ばれるフックです。
   *
   * @param context - スコープ名・メッセージ名・リクエスト・レスポンスを含むオブジェクト
   *
   * @example
   * ```ts
   * const { sender, receive } = createMessaging<Messages>({
   *   onResponse: ({ scope, name, req, res }) => {
   *     console.log(`[${scope}] ${name} が完了しました`, { req, res })
   *   },
   * })
   * ```
   */
  onResponse?: OnResponseHandler<TMergedDefs>
}

/**
 * メッセージ定義の基本単位です。
 *
 * 各メッセージは `req`（リクエスト）と `res`（レスポンス）で構成されます。
 * `req` は省略可能で、その場合は `void` として扱われます。
 */
export type Message = {
  /** リクエストデータ。省略した場合は `void` として扱われます。 */
  req?: unknown
  /** レスポンスデータ。 */
  res: unknown
}

/**
 * 複数のメッセージ定義をスコープごとに統合するための型エイリアスです。
 *
 * 個別のメッセージ定義を、スコープ名をキーとしてまとめます。
 *
 * `req`, `res` の各値は、シリアライズ可能な型を指定する必要があります。
 * `req` を省略すると自動的に `void` になります。
 *
 * @template TMergedDefs - スコープ名をキー、メッセージ定義を値とするオブジェクト型
 *
 * @example
 * ```ts
 * type StorageMessages = { ... }
 * type TabMessages = { ... }
 *
 * type Messages = MergeMessageDefs<{
 *   storage: StorageMessages
 *   tabs: TabMessages
 * }>
 *
 * const { sender, receive } = createMessaging<Messages>()
 * ```
 */
export type MergeMessageDefs<
  TMergedDefs extends Record<string, Record<string, Message>>,
> = {
  [TScope in keyof TMergedDefs & string]: {
    [TName in keyof TMergedDefs[TScope] & string]: {
      // req が省略されていた場合は void をデフォルト値とする
      req: 'req' extends keyof TMergedDefs[TScope][TName]
        ? TMergedDefs[TScope][TName]['req']
        : void
      res: MessageResponse<TMergedDefs[TScope][TName]['res']>
    }
  }
}

/**
 * メッセージのレスポンス型です。成功時は `TData & Success`、失敗時は `Failure` になります。
 *
 * `instanceof Success` または `instanceof Failure` で判定できます。
 * 成功時はデータのプロパティに直接アクセスできます。
 *
 * @template TData - 成功時に返すデータの型。省略時は `void` です。
 *
 * @example
 * ```ts
 * const result = await storage.getSettings()
 *
 * if (result instanceof Success) {
 *   console.log(result.theme) // プロパティに直接アクセス可能
 * }
 *
 * if (result instanceof Failure) {
 *   console.error(result.message)
 * }
 * ```
 */
export type MessageResponse<TData = void> = (TData & Success) | Failure

/**
 * 送信側が使うメッセージインターフェースの型です。
 *
 * `sender(scope)` の戻り値として使われます。
 * 各メッセージ名がメソッドとして型付けされ、
 * `req` を引数に取り `Promise<res>` を返します。
 *
 * @template TDefs - スコープ内のメッセージ定義の型
 */
export type MessageInterface<TDefs extends MessageDefs> = {
  [TName in keyof TDefs & string]: (
    req: TDefs[TName]['req'],
  ) => Promise<TDefs[TName]['res']>
}

/**
 * 個々のメッセージを処理するハンドラー関数の型です。
 *
 * `Receiver.on()` で登録するコールバック関数がこの型に対応します。
 *
 * @template TDefs - スコープ内のメッセージ定義の型
 * @template TName - 処理対象のメッセージ名の型
 *
 * @param req - 送信側から送られたリクエストデータ
 * @param sender - メッセージを送信した側の情報（`chrome.runtime.MessageSender`）
 * @returns レスポンスを同期または非同期（`Promise`）で返します
 */
export type MessageHandler<
  TDefs extends MessageDefs,
  TName extends keyof TDefs & string,
> = (
  req: TDefs[TName]['req'],
  sender: chrome.runtime.MessageSender,
) => AsyncOrSync<TDefs[TName]['res']>

/**
 * スコープ内の全メッセージハンドラーを格納するオブジェクトの型です。
 *
 * 各メッセージ名をキー、対応する {@link MessageHandler} を値とする部分的なレコードです。
 * ハンドラーが未登録のメッセージは `undefined` になります。
 *
 * @template TDefs - スコープ内のメッセージ定義の型
 */
export type MessageHandlers<TDefs extends MessageDefs> = {
  [TName in keyof TDefs & string]?: MessageHandler<TDefs, TName>
}

/**
 * 通信エラー発生時のコールバック関数の型です。
 *
 * {@link MessagingError} を引数に受け取ります。
 * `Failure` を返すと Promise が reject されずに resolve されます。
 * `void` を返すと従来通り reject されます。
 *
 * @param error - 発生した {@link MessagingError}
 * @returns `Failure` を返すと reject を抑制します。`void` なら reject されます。
 */
export type OnErrorHandler = (error: MessagingError) => Failure | void

/**
 * メッセージ受信時（ハンドラー実行前）に呼ばれるフックの型です。
 *
 * `MessagingOptions.onRequest` で使用されます。
 * スコープ名・メッセージ名・リクエストデータを含むコンテキストを受け取ります。
 *
 * @template TMergedDefs - 統合されたメッセージ定義の型
 * @param context - `scope`, `name`, `req` を含むオブジェクト
 */
export type OnRequestHandler<TMergedDefs extends MergedMessageDefs> = (
  context: {
    [TScope in keyof TMergedDefs & string]: {
      [TName in keyof TMergedDefs[TScope] & string]: {
        scope: TScope
        name: TName
        req: TMergedDefs[TScope][TName]['req']
      }
    }[keyof TMergedDefs[TScope] & string]
  }[keyof TMergedDefs & string],
) => void

/**
 * レスポンス返却後に呼ばれるフックです。
 *
 * `MessagingOptions.onResponse` で使用されます。
 * スコープ名・メッセージ名・リクエスト・レスポンスを含むコンテキストを受け取ります。
 *
 * @template TMergedDefs - 統合されたメッセージ定義の型
 * @param context - `scope`, `name`, `req`, `res` を含むオブジェクト
 */
export type OnResponseHandler<TMergedDefs extends MergedMessageDefs> = (
  context: {
    [TScope in keyof TMergedDefs & string]: {
      [TName in keyof TMergedDefs[TScope] & string]: {
        scope: TScope
        name: TName
        req: TMergedDefs[TScope][TName]['req']
        res: TMergedDefs[TScope][TName]['res']
      }
    }[keyof TMergedDefs[TScope] & string]
  }[keyof TMergedDefs & string],
) => void
