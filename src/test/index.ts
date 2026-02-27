import {
  createMessaging,
  Failure,
  failure,
  MergeMessageDefs,
  Success,
  success,
} from '../main'

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
type Messages = MergeMessageDefs<{
  storage: StorageMessages
  tabs: TabMessages
}>

export const { sender, receive } = createMessaging<Messages>({
  onError(error) {
    console.log('onConnectionError', error)
  },

  onRequest({ scope, name, req }) {
    console.log('onRequest', scope, name, req)
  },

  onResponse({ scope, name, req, res }) {
    console.log('onResponse', scope, name, req, res)
  },
})

// ------------------------- //

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

// ---------------------------------

// スコープごとに送信インターフェースを作成
const storage = sender('storage')
const tabs = sender('tabs')

// 設定を保存
const saveResult = await storage.setSettings({ theme: 'dark', language: 'ja' })
if (saveResult instanceof Success) {
  console.log('設定を保存しました')
} else {
  saveResult
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
  // アンチパターン？もできます
  console.error('取得に失敗しました', tabResult.message)
  // @ts-expect-error
  return
}
console.log('タブID:', tabResult.id)
console.log('URL:', tabResult.url)

// 新しいタブを開く
const openResult = await tabs.openTab({ url: 'https://example.com' })
if (openResult instanceof Success) {
  console.log('新しいタブを開きました:', openResult.tabId)
}
