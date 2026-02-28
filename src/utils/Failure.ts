const InternalKey = Symbol()

/**
 * 失敗を表すクラスです。`instanceof Failure` でレスポンスの失敗判定に使用します。
 * エラーメッセージは `message` プロパティから取得できます。
 *
 * 直接インスタンス化はできません。失敗レスポンスの生成には {@link failure} を使用してください。
 *
 * @example
 * ```ts
 * const result = await tabs.getCurrentTab()
 * if (result instanceof Failure) {
 *   console.error(result.message)
 * }
 * ```
 */
export class Failure {
  /**
   * @hidden
   * @deprecated インスタンス化はできません。失敗レスポンスの生成には {@link failure} を使ってください。
   */
  constructor(
    _key: typeof InternalKey,
    public readonly message: string,
  ) {}
}

/**
 * 失敗レスポンスを生成するヘルパー関数です。
 *
 * 返された値は {@link Failure} クラスのインスタンスであり、
 * `instanceof Failure` で判定できます。
 *
 * @param data - エラーメッセージ、もしくは Error インスタンス。省略すると空文字列になります。
 * @returns {@link Failure} インスタンス
 *
 * @example
 * ```ts
 * tabsReceiver.on('getCurrentTab', async (_, sender) => {
 *   const tab = sender.tab
 *   if (!(tab && tab.id && tab.url && tab.title)) {
 *     return failure('タブ情報を取得できませんでした')
 *   }
 *   return success({ id: tab.id, url: tab.url, title: tab.title })
 * })
 * ```
 */
export function failure(data?: string | Error): Failure {
  return new Failure(
    InternalKey,
    data instanceof Error ? String(data) : (data ?? ''),
  )
}
