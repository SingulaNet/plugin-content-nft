# plugin.js 設計書

## 概要

ブロックチェーン（Ethereum互換）との接続およびスマートコントラクト操作を提供するプラグインモジュール。
Web3.js を使用して WebSocket 経由でブロックチェーンノードに接続し、NFT コンテンツの操作とイベント監視を行う。

### 実装ファイル
- `src/lib/plugin.js`

---

## クラス構造

### PluginContentNft

EventEmitter2 を継承したクラス。ブロックチェーン接続とスマートコントラクト操作を提供する。

**継承:**
- `EventEmitter2` (eventemitter2 パッケージ)

**実装箇所:** `src/lib/plugin.js:L14-L258`

---

## コンストラクタ

### constructor(opts)

プラグインインスタンスを初期化する。

**パラメータ:**
- `opts.provider` (string): プライマリブロックチェーンプロバイダーの WebSocket URL
- `opts.altProvider` (string, optional): セカンダリプロバイダーの WebSocket URL（フォールバック用）
- `opts.contractAddress` (string): NFT スマートコントラクトのアドレス

**実装箇所:** `src/lib/plugin.js:L15-L23`

**初期化される内部プロパティ:**
- `_primaryProvider`: プライマリプロバイダー URL
- `_secondaryProvider`: セカンダリプロバイダー URL
- `provider`: 現在使用中のプロバイダー URL
- `contractAddress`: コントラクトアドレス
- `web3`: Web3 インスタンス（初期値は null）
- `healthCheck`: ヘルスチェック開始フラグ（初期値は false）

---

## 接続管理メソッド

### connect()

ブロックチェーンノードに WebSocket 接続し、イベントリスナーを登録する。

**実装箇所:** `src/lib/plugin.js:L25-L67`

**処理内容:**
1. ヘルスチェック機能を開始（初回のみ）
2. WebSocketProvider を生成して Web3 インスタンスを作成
3. handleRevert を有効化
4. スマートコントラクトインスタンスを生成
5. 以下のイベントリスナーを登録:
   - `DesignLog`: Design イベントとして emit
   - `MintLog`: Mint イベントとして emit
   - `Transfer`: TransferObject イベントとして emit

**設定値:**
- `transactionBlockTimeout`: 20000 ミリ秒

### disconnect()

ブロックチェーン接続を切断し、リソースをクリーンアップする。

**実装箇所:** `src/lib/plugin.js:L69-L77`

**処理内容:**
1. web3 インスタンスが存在しない場合は何もしない
2. contract のイベントリスナーを全て削除
3. WebSocket 接続を切断
4. web3 と contract を null に設定

### _heartbeat()

5秒間隔でブロックチェーン接続の状態を監視し、切断時に自動再接続を行う。

**実装箇所:** `src/lib/plugin.js:L79-L119`

**処理内容:**
1. 5秒ごとに `isListening()` で接続状態を確認
2. 接続エラー時、プライマリとセカンダリのプロバイダーを切り替え
3. 新しいプロバイダーで再接続を試行
4. web3 が null の場合も再接続を試行

**インターバル:** 5000 ミリ秒

---

## ブロックチェーン情報取得メソッド

### getTransactionCount(address)

指定アドレスのペンディングトランザクション数を取得する。

**実装箇所:** `src/lib/plugin.js:L121-L127`

**パラメータ:**
- `address` (string): Ethereum アドレス

**戻り値:**
- Promise<number>: トランザクション数（nonce）

### getContract()

スマートコントラクトインスタンスを取得する。

**実装箇所:** `src/lib/plugin.js:L129-L131`

**戻り値:**
- Contract: web3.eth.Contract インスタンス

---

## スマートコントラクト操作メソッド

### issuer()

NFT コントラクトの発行者アドレスを取得する。

**実装箇所:** `src/lib/plugin.js:L133-L140`

**戻り値:**
- Promise<Object>: `{ issuer: string }` 形式のオブジェクト

### getOwnedTokens(address)

指定アドレスが所有する NFT トークン ID 一覧を取得する。

**実装箇所:** `src/lib/plugin.js:L142-L155`

**パラメータ:**
- `address` (string): Ethereum アドレス

**戻り値:**
- Promise<Object|null>: `{ ownedTokens: Array }` 形式のオブジェクト、エラー時は null


### getContent(contentId)

コンテンツ ID からコンテンツ情報を取得する。

**実装箇所:** `src/lib/plugin.js:L157-L170`

**パラメータ:**
- `contentId` (string|number): コンテンツ ID

**戻り値:**
- Promise<Object|null>: `{ content: Object }` 形式のオブジェクト、エラー時は null

### getToken(tokenId)

トークン ID からトークン情報を取得する。

**実装箇所:** `src/lib/plugin.js:L172-L185`

**パラメータ:**
- `tokenId` (string|number): トークン ID

**戻り値:**
- Promise<Object|null>: `{ token: Object }` 形式のオブジェクト、エラー時は null

### getPastEvents(eventName, fromBlock)

指定イベントの過去ログを取得する。

**実装箇所:** `src/lib/plugin.js:L200-L214`

**パラメータ:**
- `eventName` (string): イベント名
- `fromBlock` (number|string): 検索開始ブロック番号

**戻り値:**
- Promise<Array|null>: イベント配列、エラー時は null

**検索範囲:**
- `fromBlock`: 指定されたブロック番号
- `toBlock`: 'latest'（最新ブロック）

---

## トランザクション送信メソッド

### sendSignedTransaction(serializedTx)

署名済みトランザクションをブロックチェーンに送信する。

**実装箇所:** `src/lib/plugin.js:L187-L198`

**パラメータ:**
- `serializedTx` (string): シリアライズされた署名済みトランザクション

**戻り値:**
- Promise<Object>: トランザクションレシート
- Promise.reject<Error>: エラー時

### _sendSignedTransaction(from, privateKey, txData)

トランザクションデータに署名してブロックチェーンに送信する（内部メソッド）。

**実装箇所:** `src/lib/plugin.js:L216-L258`

**パラメータ:**
- `from` (string): 送信元 Ethereum アドレス
- `privateKey` (string): 秘密鍵（"0x" プレフィックス付き）
- `txData` (string): トランザクションデータ（エンコード済み）

**戻り値:**
- Promise<Object>: トランザクションレシート
- Promise.reject<Error>: エラー時

**トランザクション設定:**
- `gas`: 29900000
- `gasLimit`: 29900000
- `gasPrice`: 0
- `to`: コントラクトアドレス

**署名処理:**
- LegacyTransaction を使用
- Common 設定: chainId 11421, hardfork "petersburg"

---

## ブロックチェーン設定

### Common Configuration

**実装箇所:** `src/lib/plugin.js:L8-L11`

**設定値:**
- `chainId`: 11421（カスタムチェーン）
- `hardfork`: "petersburg"

---

## 依存パッケージ

**実装箇所:** `src/lib/plugin.js:L3-L11`

- `debug`: デバッグログ出力
- `eventemitter2`: イベント発行機能
- `web3`: Web3.js ライブラリ
  - `Web3`: メインクラス
  - `WebSocketProvider`: WebSocket プロバイダー
- `@ethereumjs/tx`: トランザクション処理
  - `LegacyTransaction`: レガシートランザクション
- `@ethereumjs/common`: チェーン設定
  - `Common`, `Chain`, `Hardfork`
- `../abi/ContentNft.json`: スマートコントラクト ABI 定義

---

## イベント

このクラスは以下のイベントを emit する:

### Design
ブロックチェーンの `DesignLog` イベント発生時に emit される。

**データ:** イベントの returnValues

### Mint
ブロックチェーンの `MintLog` イベント発生時に emit される。

**データ:** イベントの returnValues

### TransferObject
ブロックチェーンの `Transfer` イベント発生時に emit される。

**データ:** イベントオブジェクト全体

---

## モジュールエクスポート

**実装箇所:** `src/lib/plugin.js:L258`

PluginContentNft クラスを CommonJS 形式でエクスポートする。
