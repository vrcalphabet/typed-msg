# typed-msg

[![npm version](https://badge.fury.io/js/typed-msg.svg)](https://badge.fury.io/js/typed-msg)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeScriptで書かれた、Chrome拡張機能のSW⇔Content Scripts間の通信を型安全にするラッパーライブラリです。

## 例

この例では、ストレージ操作とタブ操作の2つのスコープを持つメッセージインタフェイスを定義します。

### 1. メッセージインターフェース（型）定義

まず、送受信するメッセージの型を定義します。

```ts
// types/messages.ts
import {
  MessageDefinitions,
  MergeMessageDefinitions,
  MessageResponse,
} from 'typed-msg';

// ストレージ関連のメッセージ
type StorageMessages = MessageDefinitions<{
  // 設定を保存
  setSettings: {
    req: { theme: 'light' | 'dark'; language: string };
    res: MessageResponse;
  };
  // 設定を取得
  getSettings: {
    req: void;
    res: MessageResponse<{ theme: 'light' | 'dark'; language: string }>;
  };
}>;

// タブ関連のメッセージ
type TabMessages = MessageDefinitions<{
  // 現在のタブ情報を取得
  getCurrentTab: {
    req: void;
    res: MessageResponse<{ id: number; url: string; title: string }>;
  };
  // 新しいタブを開く
  openTab: {
    req: { url: string };
    res: MessageResponse<{ tabId: number }>;
  };
}>;

// すべてのスコープを統合
export type Messages = MergeMessageDefinitions<{
  storage: StorageMessages;
  tabs: TabMessages;
}>;
```

### 2. 受信側（Service Worker）

Service Worker側では `receive` を使ってスコープごとにハンドラーを登録します。

ハンドラーは、スコープごとにファイルを分けても動作します。

```ts
// background.ts
import type { Messages } from './types/messages';
import { receive } from 'typed-msg';

// ストレージ関連のハンドラー
const storageReceiver = receive<Messages>('storage');

storageReceiver.on('setSettings', async (req) => {
  await chrome.storage.local.set({ settings: req });
  return { success: true };
});

storageReceiver.on('getSettings', async () => {
  const data = await chrome.storage.local.get('settings');
  return { success: true, message: data.settings };
});

// タブ関連のハンドラー
const tabsReceiver = receive<Messages>('tabs');

tabsReceiver.on('getCurrentTab', async (_, sender) => {
  const tab = sender.tab;
  if (!tab?.id || !tab.url || !tab.title) {
    return { success: false, message: 'タブ情報を取得できませんでした' };
  }
  return { success: true, message: { id: tab.id, url: tab.url, title: tab.title } };
});

tabsReceiver.on('openTab', async (req) => {
  const tab = await chrome.tabs.create({ url: req.url });
  if (!tab.id) {
    return { success: false, message: 'タブを開けませんでした' };
  }
  return { success: true, message: { tabId: tab.id } };
});
```

### 3. 送信側（Content Scripts）

Content Scripts側では `connect` を使ってメッセージを送信します。
スコープごとに別々の送信インターフェースを作成できます。

```ts
// content.ts (Content Script)
import type { Messages } from './types/messages';
import { connect } from 'typed-msg';

// スコープごとに送信インターフェースを作成
const storage = connect<Messages>('storage');
const tabs = connect<Messages>('tabs');

// 設定を保存
const saveResult = await storage.setSettings({ theme: 'dark', language: 'ja' });
if (saveResult.success) {
  console.log('設定を保存しました');
}

// 設定を取得
const settingsResult = await storage.getSettings();
if (settingsResult.success) {
  console.log('テーマ:', settingsResult.message.theme);
  console.log('言語:', settingsResult.message.language);
}

// 現在のタブ情報を取得
const tabResult = await tabs.getCurrentTab();
if (tabResult.success) {
  console.log('タブID:', tabResult.message.id);
  console.log('URL:', tabResult.message.url);
}

// 新しいタブを開く
const openResult = await tabs.openTab({ url: 'https://example.com' });
if (openResult.success) {
  console.log('新しいタブを開きました:', openResult.message.tabId);
}
```

## インストール

### npm

```bash
npm install typed-msg
```

### yarn

```bash
yarn add typed-msg
```

### pnpm

```bash
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
