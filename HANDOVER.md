# HANDOVER — リトアニア音楽紀行

別端末・別の人（または将来の自分）がこのプロジェクトを引き継ぐためのセットアップ・運用手順です。
**プロジェクトの設計方針・仕様は `CLAUDE.md` を参照してください。** このファイルは「動かし方」と「運用」のみ。

## このプロジェクトについて

AKクワイア向けに作っているスマホブラウザ用RPG。
リトアニアの音楽祭典「ダイヌシュベンテ」を目指して、各都市で歌詞ピースを集める2-3時間のゲームです。

- 配布形態: GitHub Pages でホスト、URLを共有
- アクセス先: スマホブラウザ（Chrome/Safari）
- アカウント不要・インストール不要・無料

## 開発環境セットアップ

### 必要なもの
- Git
- ブラウザ（Chrome/Safari推奨）
- Python 3（ローカルサーバー用、`python -m http.server` を使う）
- テキストエディタ（VS Code 等）

### リポジトリのクローン
```bash
git clone https://github.com/lindenkg-pixel/lithuania-rpg.git
cd lithuania-rpg
```

### ローカル起動

`file://` 直開きだとブラウザによって挙動が変わるので、必ずローカルサーバー経由で開きます。

```bash
cd C:\Users\kei_x\works\lithuania-rpg
python -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開く。

### スマホ実機での確認

PCと同じWi-Fiにスマホをつないでアクセス:
```
http://<PCのIP>:8000/
```

PCのIPは Windows なら `ipconfig`、Mac/Linux なら `ifconfig` で確認。
Windows ファイアウォールが Python をブロックする場合は、初回アクセス時にダイアログが出るので「許可」する。

## ファイル構成

```
lithuania-rpg/
├── index.html              # エントリポイント（HTML、CSS、UIボタン）
├── js/
│   ├── game.js            # ゲーム全体のロジック（Phase 1完了後に分割予定）
│   ├── maps/              # 都市ごとのマップデータ
│   ├── data/              # NPC・アイテム・敵・歌詞ピースデータ
│   └── systems/           # 描画・戦闘・ダイアログ・セーブ
├── assets/                # BGM・SE・画像素材
├── CLAUDE.md              # 設計方針・仕様書（AI向け）
├── HANDOVER.md            # これ（人間向け）
└── README.md              # 配布用の簡易説明
```

## 開発の進め方

### 仕様の参照
`CLAUDE.md` にすべての仕様（ストーリー進行・キーパーソン・歌詞ピース配分・戦闘システム・実装フェーズ）が書かれています。
変更が入ったら CLAUDE.md も同時に更新する。

### 動作確認のサイクル
1. コードを編集
2. ブラウザでリロード（Ctrl+R / Cmd+R）
3. キーボード（矢印・WASD・Z/X）or タッチ操作で確認
4. スマホ実機でも確認（特にUI周り）

### コミット粒度
- フェーズの区切り or 機能単位で1コミット
- 都市追加は都市ごと、戦闘システム改修は1コミットなど
- メッセージ例: `feat: 3人パーティ戦闘システム実装`

### Git運用
- ブランチ: `master`（デフォルト）
- 個人開発なので `master` 直 push でもOK
- 大きな機能は `feature/3p-party` のようなブランチで作業すると楽

## デプロイ（GitHub Pages）

完成時 or 段階リリースに使う。

### 初回設定
1. GitHub のリポジトリ設定 → Pages
2. Source: `Deploy from a branch`
3. Branch: `master` / Folder: `/ (root)`
4. Save

数分後に `https://lindenkg-pixel.github.io/lithuania-rpg/` で公開される。

### 更新時
`master` に push するだけで自動デプロイされる。反映には1-2分かかる。

### 配布
公開URLをAKクワイアの方々に共有。スマホブラウザでアクセスして遊んでもらう。

## トラブルシューティング

### スマホ実機で開けない
- PCと同じWi-Fiにつないでいるか確認
- Windowsファイアウォールで Python がブロックされていないか
- IPアドレスが正しいか（VPN接続中だと別IPになることあり）

### ブラウザでゲームが動かない
- `file://` 直開きしていないか確認（必ず `http://localhost:8000/`）
- ブラウザのコンソール（F12）でエラー確認
- localStorage が無効になっていないか（プライベートブラウジングだとセーブ不可）

### セーブデータをリセットしたい
- ブラウザのデベロッパーツール → Application → Local Storage → 該当ドメインをクリア
- または、ゲーム内のメニューから（実装後）

### スリープからの復帰でサーバーが落ちている
- ターミナルに戻って `python -m http.server 8000` を再起動
- ブラウザはリロードすればOK

## 引き継ぎチェックリスト

別端末で再開するときの確認:
- [ ] Git clone したか
- [ ] Python が入っているか（`python --version`）
- [ ] ローカルサーバーが起動するか
- [ ] ブラウザでゲーム画面が表示されるか
- [ ] CLAUDE.md を読んで仕様を把握したか
- [ ] 「今後のタスク」に書かれた次のフェーズを確認したか

## 連絡先・関連リンク

- リポジトリ: https://github.com/lindenkg-pixel/lithuania-rpg
- 制作: ケイ
- 協力: AKクワイアのみなさん
