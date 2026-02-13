# typed-msg

[![npm version](https://badge.fury.io/js/typed-msg.svg)](https://badge.fury.io/js/typed-msg)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeScriptで書かれた、Chrome拡張機能のSW⇔Content Scripts間の通信を型安全にするラッパーライブラリです。

## 例

この例では、ストレージ操作とタブ操作の2つのスコープを持つメッセージインタフェイスを定義します。

### 1. メッセージインターフェース（型）定義

- `MessageDefinitions<T>` を使ってスコープごとに送受信するメッセージの型を定義します。
  - 各メッセージは `req`（リクエスト）と `res`（レスポンス）のプロパティを持ちます。
  - `req` はリクエストのパラメータ型です。パラメータが不要な場合は省略できます。
  - `res` は `MessageResponse` を指定します。通常の型も使用可能です。レスポンスが不要な場合は省略できます。
- `MergeMessageDefinitions<T>` を使ってスコープごとのメッセージ型を統合します。
- `createMessaging<T>()` で型付きの `connect` (メッセージ送信用関数) と `receive` (メッセージ受信用関数) を取得し、公開します。

```ts
// types/messages.ts
import {
  type MessageDefinitions,
  type MergeMessageDefinitions,
  type MessageResponse,
  createMessaging,
} from 'typed-msg'

// ストレージ関連のメッセージ
type StorageMessages = MessageDefinitions<{
  // 設定を保存
  setSettings: {
    req: { theme: 'light' | 'dark'; language: string }
    res: MessageResponse
  }
  // 設定を取得
  getSettings: {
    res: MessageResponse<{ theme: 'light' | 'dark'; language: string }>
  }
}>

// タブ関連のメッセージ
type TabMessages = MessageDefinitions<{
  // 現在のタブ情報を取得
  getCurrentTab: {
    res: MessageResponse<{ id: number; url: string; title: string }>
  }
  // 新しいタブを開く
  openTab: {
    req: { url: string }
    res: MessageResponse<{ tabId: number }>
  }
}>

// すべてのスコープを統合
type Messages = MergeMessageDefinitions<{
  storage: StorageMessages
  tabs: TabMessages
}>

export const { connect, receive } = createMessaging<Messages>()
```

### 2. 受信側（Service Worker）

- `receive(scope)` でスコープを指定して `Receiver` インスタンスを取得します。
- `Receiver.on(name, handler)` でメッセージの名前に対応したハンドラーを登録します。
  - `success(data)` や `failure(message)` で成功または失敗レスポンスを返します。
- ハンドラーは、スコープごとにファイルを分けても動作します。

```ts
// background.ts
import { receive, type Messages } from './types/messages'
import { success, failure } from 'typed-msg'

// ストレージ関連のハンドラー
const storageReceiver = receive('storage')

storageReceiver.on('setSettings', async (req) => {
  await chrome.storage.local.set({ settings: req })
  return success()
})

storageReceiver.on('getSettings', async () => {
  const data = await chrome.storage.local.get('settings')
  return success(data.settings)
})

// タブ関連のハンドラー
const tabsReceiver = receive('tabs')

tabsReceiver.on('getCurrentTab', async (_, sender) => {
  const tab = sender.tab
  if (!tab?.id || !tab.url || !tab.title) {
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

- `connect(scope)` でスコープを指定し、送信インターフェースを取得します。
- `sender.messageType(req)` でメッセージを送信し、`Promise<MessageResponse>` を受け取ります。
  - `req` が不要なメッセージは引数なしで呼び出せます。
- レスポンスの `success` プロパティで成功/失敗を判定します。
  - 成功時: `response.data` でレスポンスデータにアクセスできます。
  - 失敗時: `response.message` でエラーメッセージにアクセスできます。

```ts
// content.ts
import { connect, type Messages } from './types/messages'

// スコープごとに送信インターフェースを作成
const storage = connect('storage')
const tabs = connect('tabs')

// 設定を保存
const saveResult = await storage.setSettings({ theme: 'dark', language: 'ja' })
if (saveResult.success) {
  console.log('設定を保存しました')
}

// 設定を取得
const settingsResult = await storage.getSettings()
if (settingsResult.success) {
  console.log('テーマ:', settingsResult.data.theme)
  console.log('言語:', settingsResult.data.language)
}

// 現在のタブ情報を取得
const tabResult = await tabs.getCurrentTab()
if (tabResult.success) {
  console.log('タブID:', tabResult.data.id)
  console.log('URL:', tabResult.data.url)
}

// 新しいタブを開く
const openResult = await tabs.openTab({ url: 'https://example.com' })
if (openResult.success) {
  console.log('新しいタブを開きました:', openResult.data.tabId)
}
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
