import { AsyncOrSync, SafeExtract } from '../utils/utils'

export type MessageShape = {
  req?: unknown
  res?: unknown
}

export type ValidatedMessageDefinitions = Record<string, MessageShape>

export type MergedMessageDefinitions = Record<string, ValidatedMessageDefinitions>

export type MessageInterface<T extends ValidatedMessageDefinitions> = {
  [K in keyof T]: T[K] extends MessageShape ?
    (req: SafeExtract<T[K], 'req'>) => Promise<SafeExtract<T[K], 'res'>>
  : never
}

export type MessageHandler<T extends ValidatedMessageDefinitions, K extends string> =
  K extends keyof T ?
    (
      req: SafeExtract<T[K], 'req'>,
      sender: chrome.runtime.MessageSender,
    ) => AsyncOrSync<SafeExtract<T[K], 'res'>>
  : never

export type MessageHandlers<T extends ValidatedMessageDefinitions> = {
  [K in keyof T & string]?: MessageHandler<T, K>
}
