export type MessageDefs = Record<
  string,
  {
    req: unknown
    res: unknown
  }
>

export type MergedMessageDefs = Record<string, MessageDefs>
