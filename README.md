# typed-msg

[![npm version](https://badge.fury.io/js/typed-msg.svg)](https://badge.fury.io/js/typed-msg)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeScriptで書かれた、Chrome拡張機能のSW⇔Content Scripts間の通信を型安全にするラッパーライブラリです。

サンプルプロジェクトは [こちら](https://github.com/vrcalphabet/typed-msg-example) にあります。

## 例

この例では、ストレージ操作とタブ操作の2つのスコープを持つメッセージインタフェイスを定義します。

### 1. メッセージインターフェース（型）定義

- スコープごとに送受信するメッセージの型を定義します。
  - 各メッセージは `req`（リクエスト）と `res`（レスポンス）のプロパティを持ちます。
  - `req` はリクエストのパラメータ型です。パラメータが不要な場合は省略できます。
  - `res` にはデータの型を直接指定します。レスポンスが不要な場合は `void` を指定します。
- `MergeMessageDefinitions<T>` を使ってスコープごとのメッセージ型を統合します。
- `createMessaging<T>()` で型付きの `sender` (メッセージ送信用関数) と `receive` (メッセージ受信用関数) を取得し、エクスポートします。

```ts
// types/messages.ts
import { type MergeMessageDefinitions, createMessaging } from 'typed-msg'

interface StorageSettings {
  theme: 'light' | 'dark'
  language: string
}

interface TabInfo {
  id: number
  url: string
  title: string
}

// ストレージ関連のメッセージ
type StorageMessages = {
  // 設定を保存
  setSettings: {
    req: StorageSettings
    res: void
  }
  // 設定を取得
  getSettings: {
    res: StorageSettings
  }
}

// タブ関連のメッセージ
type TabMessages = {
  // 現在のタブ情報を取得
  getCurrentTab: {
    res: TabInfo
  }
  // 新しいタブを開く
  openTab: {
    req: { url: string }
    res: { tabId: number }
  }
}

// すべてのスコープを統合
type Messages = MergeMessageDefinitions<{
  storage: StorageMessages
  tabs: TabMessages
}>

export const { sender, receive } = createMessaging<Messages>()
```

### 2. 受信側（Service Worker）

- `receive(scope)` でスコープを指定して `Receiver` インスタンスを取得します。
- `Receiver.on(name, handler)` でメッセージの名前に対応したハンドラーを登録します。
  - `success(data)` や `failure(message)` で成功または失敗レスポンスを返します。
- ハンドラーは、スコープごとにファイルを分けても動作します。

```ts
// background.ts
import { receive } from './types/messages'
import { success, failure } from 'typed-msg'

// ストレージ関連のハンドラー
const storageReceiver = receive('storage')

storageReceiver.on('setSettings', async (req) => {
  await chrome.storage.local.set({ settings: req })
  return success()
})

storageReceiver.on('getSettings', async () => {
  const data = await chrome.storage.local.get<any>('settings')
  return success(data.settings)
})

// タブ関連のハンドラー
const tabsReceiver = receive('tabs')

tabsReceiver.on('getCurrentTab', async (_, sender) => {
  const tab = sender.tab
  if (!(tab && tab.id && tab.url && tab.title)) {
    return failure('タブ情報を取得できませんでした')
  }
  return success({ id: tab.id, url: tab.url, title: tab.title })
})

tabsReceiver.on('openTab', async (req) => {
  const tab = await chrome.tabs.create({ url: req.url })
  if (!tab.id) {
    return failure('タブを開けませんでした')
  }
  return success({ tabId: tab.id })
})
```

### 3. 送信側（Content Scripts）

- `sender(scope)` でスコープを指定し、送信インターフェースを取得します。
- メッセージを送信すると、`Promise` でレスポンスを受け取ります。
  - `req` が不要なメッセージは引数なしで呼び出せます。
- `instanceof Success` または `instanceof Failure` でレスポンスの成功/失敗を判定します。
  - 成功時: プロパティに直接アクセスできます。
  - 失敗時: `message` プロパティでエラーメッセージにアクセスできます。

```ts
// content.ts
import { sender } from './types/messages'
import { Success, Failure } from 'typed-msg'

// スコープごとに送信インターフェースを作成
const storage = sender('storage')
const tabs = sender('tabs')

// 設定を保存
const saveResult = await storage.setSettings({ theme: 'dark', language: 'ja' })
if (saveResult instanceof Success) {
  console.log('設定を保存しました')
}

// 設定を取得
const settingsResult = await storage.getSettings()
if (settingsResult instanceof Success) {
  console.log('テーマ:', settingsResult.theme)
  console.log('言語:', settingsResult.language)
}

// 現在のタブ情報を取得
const tabResult = await tabs.getCurrentTab()
if (tabResult instanceof Failure) {
  console.error('取得に失敗しました', tabResult.message)
  return
}
console.log('タブID:', tabResult.id)
console.log('URL:', tabResult.url)

// 新しいタブを開く
const openResult = await tabs.openTab({ url: 'https://example.com' })
if (openResult instanceof Success) {
  console.log('新しいタブを開きました:', openResult.tabId)
}
```

### 4. オプション（`MessagingOptions`）

`createMessaging<T>()` の第1引数にオプションオブジェクトを渡すことで、通信エラーのハンドリングやリクエスト/レスポンスのフック処理を設定できます。

すべてのオプションは省略可能です。

| オプション | 説明 |
| - | - |
| `onError` | 通信レベルのエラー（SW 停止など）が発生したときに呼ばれるコールバック。`failure()` によるビジネスロジックの失敗では呼ばれません。 |
| `onRequest` | メッセージ受信時、メインハンドラーが実行される**前に**呼ばれるフック。ロギングやデバッグ用途を想定しています。 |
| `onResponse` | メインハンドラーが実行され、レスポンスを返した**後に**呼ばれるフック。 |

#### `onError`

通信レベルのエラーが発生したときのコールバックです。 Content Scripts 側で発火します。

- `Failure` を返すと、Promise がその `Failure` で `resolve` します。
- 何も返さない場合は、従来通り `MessagingError` がスローされます。

```ts
import { type MergeMessageDefinitions, createMessaging, failure } from 'typed-msg'

const { sender, receive } = createMessaging<Messages>({
  onError: (error) => {
    // error は MessagingError インスタンス
    // error.scope, error.name, error.message が利用可能
    console.error(`[${error.scope}.${error.name}] ${error.message}`)

    // Failure を返すと reject せずに resolve される
    return failure('通信に失敗しました')
  },
})
```

#### `onRequest`

メッセージ受信時、ハンドラー実行前に呼ばれるフックです。 Service Worker 側で発火します。

```ts
const { sender, receive } = createMessaging<Messages>({
  onRequest: ({ scope, name, req }) => {
    console.log(`[${scope}] ${name} を受信しました`, { req })
  },
})
```

#### `onResponse`

ハンドラー実行後、レスポンス返却時に呼ばれるフックです。 Service Worker 側で発火します。

```ts
const { sender, receive } = createMessaging<Messages>({
  onResponse: ({ scope, name, req, res }) => {
    console.log(`[${scope}] ${name} が完了しました`, { req, res })
  },
})
```

## インストール

```bash
npm install typed-msg
# or
yarn add typed-msg
# or
pnpm add typed-msg
```

## 貢献

プロジェクトへの貢献を歓迎します！以下のルールに従うと，あなたの貢献がスムーズになります！

### Issue / PR

Issueを立てる際は，バグ報告・機能要望のどちらかを明記してください。
PRの説明には，目的・変更点・影響範囲・サンプルコードがあるとありがたいです。

## ライセンス

MIT License

詳細は[LICENSE](./LICENSE)ファイルを参照してください。

## 変更履歴・リリース情報

### v1.0.0 (2026-02-08)

- 初回リリース

### v2.0.0 (2026-02-08)

- 成功時のメッセージレスポンス `SuccessMessageResponse` のプロパティを `message` から `data` に変更
- 失敗時のメッセージレスポンス `FailureMessageResponse` の `message` 型を変更/省略
- ハンドラー未定義時のエラーをより分かりやすく
- ユーティリティ関数 `success`, `failure` を追加

### v2.0.1 (2026-02-10)

- `failure` 関数の戻り値のプロパティを `data` から `message` に修正

### v2.1.0 (2026-02-13)

- `onAny` メソッドを追加

### v3.0.0 (2026-02-23)

- `connect` を `sender` に名前変更
- レスポンスの判定方法を `result.success` から `instanceof Success` / `instanceof Failure` に変更
- 成功レスポンスのデータに直接アクセス可能に
- `Success` / `Failure` クラスを追加
- `MessagingOptions` を追加
