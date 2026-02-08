import {
  MergedMessageDefinitions,
  ValidatedMessageDefinitions,
} from './internal/message';

/**
 * 個別のメッセージ定義を作成するための型エイリアスです。
 *
 * 各メッセージは `req`（リクエスト）と `res`（レスポンス）を持つオブジェクトとして定義します。
 * この型で定義したメッセージ群は、`MergeMessageDefinitions` で統合する必要があります。
 *
 * @template T - メッセージ名をキー、`{ req?, res? }` を値とするオブジェクト型
 *
 * @example
 * ```ts
 * type RemoteMessages = MessageDefinitions<{
 *   addRepository: {
 *     req: { url: string };
 *     res: MessageResponse;
 *   };
 *   getRepository: {
 *     req: { id: number };
 *     res: MessageResponse<{ name: string; url: string }>;
 *   };
 * }>;
 * ```
 */
export type MessageDefinitions<T extends ValidatedMessageDefinitions> = T;

/**
 * 複数のメッセージ定義をスコープごとに統合するための型エイリアスです。
 *
 * `MessageDefinitions` で作成した個別の定義を、スコープ名をキーとしてまとめます。
 * `connect` と `receive` はこの型を型引数として受け取ります。
 *
 * @template T - スコープ名をキー、`MessageDefinitions` を値とするオブジェクト型
 *
 * @example
 * ```ts
 * type RemoteMessages = MessageDefinitions<{ ... }>;
 * type BackgroundMessages = MessageDefinitions<{ ... }>;
 *
 * type Messages = MergeMessageDefinitions<{
 *   remote: RemoteMessages;
 *   background: BackgroundMessages;
 * }>;
 *
 * // 使用時:
 * const sender = connect<Messages>('remote');
 * const receiver = receive<Messages>('remote');
 * ```
 */
export type MergeMessageDefinitions<T extends MergedMessageDefinitions> = T;

/**
 * メッセージハンドラーのレスポンス型で、成功か失敗かを表すユーティリティ型です。
 *
 * 成功時は `{ success: true }` または `{ success: true, message: T }` を、
 * 失敗時は `{ success: false, message: string }` を返します。
 *
 * @template T - 成功時に返すデータの型。省略時は `void` です。
 *
 * @example
 * ```ts
 * // データなしの成功レスポンス
 * type SimpleRes = MessageResponse;
 * // { success: true } | { success: false, message: string }
 *
 * // データありの成功レスポンス
 * type DataRes = MessageResponse<User>;
 * // { success: true, message: User } | { success: false, message: string }
 * ```
 */
export type MessageResponse<T = void> =
  | SuccessMessageResponse<T>
  | FailureMessageResponse;

/**
 * 成功時のレスポンス型です。
 *
 * - `T` が `void` の場合: `{ success: true }`
 * - `T` が `void` 以外の場合: `{ success: true, message: T }`
 *
 * @template T - 成功時に返すデータの型。省略時は `void` です。
 */
export type SuccessMessageResponse<T = void> =
  T extends void ? { success: true } : { success: true; data: T };

/**
 * 失敗時のレスポンス型です。
 *
 * エラーメッセージを `message` に格納して返します。
 *
 * @example
 * ```ts
 * const errorResponse: FailureMessageResponse = {
 *   success: false,
 *   message: 'リポジトリが見つかりません',
 * };
 * ```
 */
export type FailureMessageResponse = {
  success: false;
  message: string;
};
