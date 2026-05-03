// ============================================================
// リトアニア音楽紀行 — メインゲームロジック
// ヴィリニュス縦スライス（フェーズA: 実物寄せ再配置＋タイトル＋3人パーティ＋宿屋＋オートセーブ）
// 今後 js/maps/, js/data/, js/systems/ に分割予定
// ============================================================

(function () {
  'use strict';

  const cvs = document.getElementById('screen');
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ============================================================
  // 定数
  // ============================================================
  const TILE = 32;
  const CHAR_W = 32;
  const CHAR_H = 48;
  const VIEW_COLS = 12;
  const VIEW_ROWS = 12;
  const CANVAS_W = VIEW_COLS * TILE; // 384
  const CANVAS_H = VIEW_ROWS * TILE;
  const MAP_COLS = 32;
  const MAP_ROWS = 32;
  const SAVE_KEY = 'lithuania-rpg-save';
  const SAVE_VERSION = 1;

  // タイル定義
  // 0:草地 1:道(石畳) 2:壁 3:木 4:水 5:一般入口
  // 6:ゲディミナス塔 7:夜明けの門 8:聖アンナ教会
  // 9:エンカウント草むら 10:大聖堂 11:宿屋入口 12:集会所入口 13:橋 14:花畑
  // 15:料理屋(マンタス) 16:雑貨屋 17:旧市庁舎(ホール入口)
  const T = {
    GRASS:0, ROAD:1, WALL:2, TREE:3, WATER:4, DOOR:5,
    GEDIMINAS:6, GATES:7, ANNE:8, ENC:9, CATHEDRAL:10, INN:11, AKHALL:12, BRIDGE:13, FLOWER:14,
    RESTAURANT:15, SHOP:16, TOWNHALL:17,
    // 追加：実在ヴィリニュスのランドマーク
    BERNARDINE:18, // ベルナルディン教会（聖アンナの隣）
    VU:19,         // ヴィリニュス大学
    CROSSES:20,    // 三つの十字架（丘）
    PRESIDENT:21,  // 大統領官邸
    UZUPIS:22,     // ウジュピス共和国の橋（記念碑）
    PILIES:23,     // ピリエス通り（土産物市場）
    STATION:24,    // 鉄道駅（都市間移動）
    KAUNAS_CASTLE:25,  // カウナス城
    CIURLIONIS:26,     // チョルリョーニス美術館
    BOAT:27,           // 小舟（クライペダ桟橋〜魔女の丘）
    SCULPTURE:28       // 魔女の丘の木彫り彫刻
  };

  // 都市定義（リトアニア地図上の座標とメタ情報）
  // realX/realY は overworldマップ上の0-1正規化座標
  // 都市座標は実際の緯度経度（Vilnius 54.7N/25.3E等）を国土の正規化座標に変換
  const CITIES = {
    vilnius:  { name: 'ヴィリニュス', realX: 0.74, realY: 0.69, color: '#dac030' },
    kaunas:   { name: 'カウナス',     realX: 0.50, realY: 0.62, color: '#3aae5a' },
    klaipeda: { name: 'クライペダ',   realX: 0.06, realY: 0.34, color: '#3a8acc' },
    trakai:   { name: 'トラカイ',     realX: 0.68, realY: 0.71, color: '#c83030', labelBelow: true },
    siauliai: { name: 'シャウレイ',   realX: 0.40, realY: 0.27, color: '#aa70d0' },
    vingis:   { name: 'Vingisパーク', realX: 0.71, realY: 0.69, color: '#f0c040' },
  };

  // ============================================================
  // 見た目（男4＋女8 = 12種類）
  // ============================================================
  const LOOKS = [
    // 男性4種
    { id:'m1', sex:'m', name:'青年（茶）',   skin:'#f0c89a', hair:'#5a3a1a', cloth:'#3a4abe' },
    { id:'m2', sex:'m', name:'青年（黒）',   skin:'#f0c89a', hair:'#1a1a1a', cloth:'#aa3030' },
    { id:'m3', sex:'m', name:'青年（金）',   skin:'#f0c89a', hair:'#dac030', cloth:'#3aae5a' },
    { id:'m4', sex:'m', name:'青年（眼鏡）', skin:'#f0c89a', hair:'#3a2a1a', cloth:'#7a3aae', glasses:true },
    // 女性8種
    { id:'f1', sex:'f', name:'娘（茶髪）',   skin:'#f8d8aa', hair:'#5a3a1a', cloth:'#c83080' },
    { id:'f2', sex:'f', name:'娘（黒髪）',   skin:'#f8d8aa', hair:'#1a1a1a', cloth:'#aa3030' },
    { id:'f3', sex:'f', name:'娘（金髪）',   skin:'#f8d8aa', hair:'#dac030', cloth:'#3a8abe' },
    { id:'f4', sex:'f', name:'娘（赤髪）',   skin:'#f8d8aa', hair:'#c84030', cloth:'#3aae5a' },
    { id:'f5', sex:'f', name:'娘（ロング茶）', skin:'#f8d8aa', hair:'#7a4a2a', cloth:'#dac030', longHair:true },
    { id:'f6', sex:'f', name:'娘（ロング黒）', skin:'#f8d8aa', hair:'#2a1a1a', cloth:'#7a3aae', longHair:true },
    { id:'f7', sex:'f', name:'娘（ポニー）', skin:'#f8d8aa', hair:'#8a5a3a', cloth:'#3a4abe', ponytail:true },
    { id:'f8', sex:'f', name:'娘（眼鏡）',   skin:'#f8d8aa', hair:'#3a2a1a', cloth:'#3a8a6a', glasses:true },
    // キーパーソン専用（NPC固定・主人公選択不可）
    { id:'ciurlionis', sex:'m', name:'チョルリョーニス', skin:'#f0c89a', hair:'#1a1a1a', cloth:'#f0f0e8', beard:true, bowtie:true, suit:true },
    { id:'yamasaki',   sex:'f', name:'ユウコヤマサキ',   skin:'#f8d8aa', hair:'#1a1015', cloth:'#aa3030', longHair:true, kimono:true },
    { id:'victoria',   sex:'f', name:'ヴィクトリア',     skin:'#f8d8aa', hair:'#e8c050', cloth:'#f8f0e0', longHair:true, dress:true },
    { id:'gintere',    sex:'f', name:'ギンターレ',       skin:'#f0c8a0', hair:'#a8a0a0', cloth:'#4a1838', longHair:true, dress:true },
  ];
  const lookById = (id) => LOOKS.find(l => l.id === id) || LOOKS[0];
  // プレイヤー選択可能なlook（キーパーソン専用は除外）
  const PLAYER_LOOKS = LOOKS.filter(l => /^[mf]\d+$/.test(l.id));
  // 表示用ラベル（m1 → 男1、f3 → 女3）
  const lookLabel = (id) => {
    const m = String(id || '').match(/^([mf])(\d+)$/);
    return m ? ((m[1] === 'm' ? '男' : '女') + m[2]) : String(id || '');
  };
  // 主人公の見た目（性別）に応じた呼称（年下のNPCが主人公を呼ぶときに使う）
  const sib = () => (lookById(state.party[0].look).sex === 'f' ? 'おねえちゃん' : 'おにいちゃん');

  // ============================================================
  // マップデータ（ヴィリニュス実物寄せ再配置）
  //  北: 大聖堂広場＋ゲディミナス塔（ネリス川が北を流れる）
  //  中央: 旧市庁舎広場＋マンタスのリトアニア料理店
  //  西: AKクワイア集会所＋みほさんの宿屋
  //  東: 聖アンナ教会
  //  南: 夜明けの門
  // ============================================================
  const MAP = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(T.GRASS));

  function clearMap() {
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) MAP[y][x] = T.GRASS;
    }
  }

  function buildVilnius() {
    const m = MAP;
    // 全マス草地で初期化
    for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLS; x++) m[y][x] = T.GRASS;

    // 外周は森
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        if (y < 2 || y >= MAP_ROWS - 2 || x < 1 || x >= MAP_COLS - 1) m[y][x] = T.TREE;
      }
    }

    // ネリス川（北を東西に流れる）
    for (let x = 6; x <= 26; x++) {
      m[3][x] = T.WATER;
      m[4][x] = T.WATER;
    }
    // 川の縁
    for (let x = 5; x <= 27; x++) {
      if (m[3][x] !== T.WATER) m[3][x] = T.GRASS;
      if (m[5][x] === T.TREE) m[5][x] = T.GRASS;
    }

    // 大聖堂広場（北中央 y=6-8）と大聖堂
    // 大聖堂を3x3で配置(11,5..13,7)
    for (let y = 5; y <= 7; y++) for (let x = 11; x <= 13; x++) m[y][x] = T.CATHEDRAL;
    // 広場（草地）
    for (let y = 6; y <= 9; y++) for (let x = 8; x <= 18; x++) {
      if (m[y][x] === T.GRASS) m[y][x] = T.FLOWER; // 花畑
    }
    // ゲディミナス塔（大聖堂の東の丘 16,5）
    m[5][16] = T.GEDIMINAS;
    m[6][16] = T.ROAD; // 塔の前へ続く参道（番人撃破後にAで詳細を見るための立ち位置）
    m[5][15] = T.TREE; m[5][17] = T.TREE; m[6][15] = T.TREE; m[6][17] = T.TREE;

    // 橋（川を渡る、北エリアと中央広場をつなぐ）
    m[3][12] = T.BRIDGE; m[4][12] = T.BRIDGE;

    // 北の道（橋から大聖堂前まで）
    for (let y = 5; y <= 9; y++) m[y][12] = (m[y][12] === T.GRASS || m[y][12] === T.FLOWER) ? T.ROAD : m[y][12];

    // 中央広場（旧市庁舎広場 y=10-14, x=8-22）
    for (let y = 10; y <= 14; y++) {
      for (let x = 8; x <= 22; x++) {
        if (m[y][x] === T.GRASS) m[y][x] = T.ROAD;
      }
    }
    // 旧市庁舎（中央 12,13）— 建物の真上1マスのみ壁、横の装飾壁は削除
    m[11][13] = T.WALL;
    m[12][13] = T.TOWNHALL;

    // マンタスの店（中央広場の北東 12,17）
    m[11][17] = T.WALL;
    m[12][17] = T.RESTAURANT;

    // 雑貨屋（中央広場の北西 12,8）
    m[11][8] = T.WALL;
    m[12][8] = T.SHOP;

    // 西側エリア（AKクワイア集会所＋宿屋） — 中央列のみ・1段下げて道に隣接
    // 集会所（真上1マスのみ壁、3マス目は歩行可）
    m[17][6] = T.WALL;
    m[18][6] = T.AKHALL;

    // 宿屋（みほさんの宿）
    m[17][10] = T.WALL;
    m[18][10] = T.INN;

    // 東側エリア（聖アンナ教会 22,16..24,18）
    for (let y = 16; y <= 18; y++) for (let x = 22; x <= 24; x++) m[y][x] = T.ANNE;

    // 南北の中央道（広場から夜明けの門へ）
    for (let y = 15; y <= 28; y++) m[y][14] = T.ROAD;

    // 南北道の左右に旧市街の家（2x2の壁、装飾のみ・入れない）
    m[20][10] = T.WALL; m[20][11] = T.WALL; m[21][10] = T.WALL; m[21][11] = T.WALL;
    m[20][17] = T.WALL; m[20][18] = T.WALL; m[21][17] = T.WALL; m[21][18] = T.WALL;
    m[24][10] = T.WALL; m[24][11] = T.WALL; m[25][10] = T.WALL; m[25][11] = T.WALL;
    m[24][17] = T.WALL; m[24][18] = T.WALL; m[25][17] = T.WALL; m[25][18] = T.WALL;

    // 夜明けの門（南 14,28）
    m[28][14] = T.GATES;
    m[27][14] = T.ROAD;
    m[29][14] = T.ROAD;

    // 横道（東西方向、中央広場から聖アンナまで）
    for (let x = 7; x <= 25; x++) {
      if (m[19][x] === T.GRASS || m[19][x] === T.ROAD) m[19][x] = T.ROAD;
    }
    // 集会所と宿屋への入口前道
    m[19][6] = T.ROAD; m[19][10] = T.ROAD;

    // 追加：実在ヴィリニュスの建造物群
    // ベルナルディン教会（聖アンナのすぐ東隣・実物そのままの位置関係）
    m[17][25] = T.BERNARDINE;
    // ヴィリニュス大学（街の北西、川の南。広いキャンパス）
    m[7][4]  = T.VU; m[7][5]  = T.VU;
    // 三つの十字架（川の東岸、ゲディミナスの隣の丘）
    m[5][20] = T.CROSSES;
    // 大統領官邸（大聖堂広場の南西、白い宮殿）
    m[10][6] = T.PRESIDENT;
    // ピリエス通り（旧市街最古の通り、市場）
    m[15][16] = T.PILIES;

    // イエヴァのいる北東広場（散歩スポットを必ず歩けるように確保）
    m[7][24] = T.FLOWER;
    m[8][24] = T.GRASS;
    m[8][25] = T.GRASS;
    m[6][24] = T.GRASS;

    // ヴィリニュス駅（南東、夜明けの門の東側）
    m[28][22] = T.STATION;
    // 駅へ続く道（南の門の東側から駅まで）
    for (let x = 15; x <= 21; x++) m[28][x] = T.ROAD;
    m[27][22] = T.ROAD;
    m[29][22] = T.ROAD;

    // 残った草地に座標シードでエンカウント草むら・木をまばらに散らす
    for (let y = 1; y < MAP_ROWS - 1; y++) {
      for (let x = 1; x < MAP_COLS - 1; x++) {
        if (m[y][x] !== T.GRASS) continue;
        const r = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        const v = r % 100;
        if (v < 10) m[y][x] = T.TREE;
        else if (v < 35) m[y][x] = T.ENC;
      }
    }
    // あきちゃんの初期位置（AKクワイア集会所の東隣）を確実に歩ける状態に
    if (m[18][7] === T.TREE || m[18][7] === T.ENC) m[18][7] = T.GRASS;
  }

  // カウナス（最小骨組み版：駅＋宿屋＋チョルリョーニス美術館＋カウナス城）
  function buildKaunas() {
    const m = MAP;
    for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLS; x++) m[y][x] = T.GRASS;
    // 外周は森
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        if (y < 2 || y >= MAP_ROWS - 2 || x < 1 || x >= MAP_COLS - 1) m[y][x] = T.TREE;
      }
    }
    // ネムナス川（西を南北に流れる）＋ネリス川（北を東西）の合流地
    for (let y = 4; y <= 26; y++) m[y][4] = T.WATER;
    for (let y = 4; y <= 26; y++) m[y][3] = T.WATER;
    for (let x = 4; x <= 14; x++) m[3][x] = T.WATER;
    for (let x = 4; x <= 14; x++) m[4][x] = T.WATER;
    // 橋
    m[5][8]  = T.BRIDGE; m[6][8]  = T.BRIDGE;
    m[15][4] = T.BRIDGE; m[15][3] = T.BRIDGE;
    // 中央通り（東西）
    for (let x = 5; x <= 28; x++) m[15][x] = T.ROAD;
    // 縦の道
    for (let y = 6; y <= 28; y++) m[y][16] = T.ROAD;
    // カウナス城（北西、川の合流点）
    m[6][6] = T.KAUNAS_CASTLE;
    // チョルリョーニス美術館（中央通り（col 16）の東隣に。道を塞がない位置）
    m[9][18]  = T.WALL;
    m[10][18] = T.CIURLIONIS;
    // 中央広場の宿屋（みほさん）— 真上1マスのみ壁、横の装飾壁は削除
    m[13][12] = T.WALL;
    m[14][12] = T.INN;
    // レストラン
    m[13][20] = T.WALL;
    m[14][20] = T.RESTAURANT;
    // AKクワイア集会所（カウナスは仮設）
    m[13][24] = T.WALL;
    m[14][24] = T.AKHALL;
    // カウナス駅（南東）
    m[26][22] = T.STATION;
    m[25][22] = T.ROAD;
    m[26][21] = T.ROAD;
    // 道沿いの花畑
    for (let x = 5; x <= 28; x++) {
      if (m[14][x] === T.GRASS) m[14][x] = T.FLOWER;
      if (m[16][x] === T.GRASS) m[16][x] = T.FLOWER;
    }
    // 旧市街の家（簡略・装飾のみ。入れない）
    [[18, 8], [18, 24], [22, 10], [22, 22]].forEach(([y, x]) => {
      m[y][x] = T.WALL; m[y][x+1] = T.WALL;
      m[y+1][x] = T.WALL; m[y+1][x+1] = T.WALL;
    });
    // 残り草地の散らし
    for (let y = 1; y < MAP_ROWS - 1; y++) {
      for (let x = 1; x < MAP_COLS - 1; x++) {
        if (m[y][x] !== T.GRASS) continue;
        const r = ((x * 91138233) ^ (y * 27109891)) >>> 0;
        const v = r % 100;
        if (v < 10) m[y][x] = T.TREE;
        else if (v < 30) m[y][x] = T.ENC;
      }
    }
    // NPC配置点・美術館前のアクセスタイルを歩ける状態に確保（散らしで木/草むらになっていたら戻す）
    [[12, 18], [10, 17], [10, 19], [11, 18]].forEach(([y, x]) => {
      if (m[y][x] === T.TREE || m[y][x] === T.ENC) m[y][x] = T.GRASS;
    });
  }

  // クライペダ（バルト海沿岸の港湾都市。クルシュー潟＋ダネ川＋旧市街）
  function buildKlaipeda() {
    const m = MAP;
    for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLS; x++) m[y][x] = T.GRASS;
    // 外周森（北・南・東。西は海）
    for (let x = 0; x < MAP_COLS; x++) { m[0][x] = T.TREE; m[1][x] = T.TREE; }
    for (let x = 0; x < MAP_COLS; x++) { m[MAP_ROWS-1][x] = T.TREE; m[MAP_ROWS-2][x] = T.TREE; }
    for (let y = 0; y < MAP_ROWS; y++) m[y][MAP_COLS-1] = T.TREE;
    // 西側のクルシュー潟（海。4列分）
    for (let y = 2; y <= 28; y++) {
      m[y][0] = T.WATER; m[y][1] = T.WATER; m[y][2] = T.WATER; m[y][3] = T.WATER;
    }
    // ダネ川（北から海へ流れる）
    for (let x = 4; x <= 14; x++) { m[3][x] = T.WATER; m[4][x] = T.WATER; }
    // ダネ川を渡る橋
    m[3][9] = T.BRIDGE; m[4][9] = T.BRIDGE;
    // 港の桟橋（西の海に伸びる、Phase 3.5の魔女の丘行き出発点）
    m[13][3] = T.BRIDGE; m[13][2] = T.BRIDGE;
    // 桟橋の先に小舟（魔女の丘行き）
    m[13][1] = T.BOAT;
    // メインの東西通り（旧市街通り、Tiltų gatvė）
    for (let x = 4; x <= 28; x++) m[15][x] = T.ROAD;
    // 縦の道
    for (let y = 6; y <= 24; y++) m[y][6] = T.ROAD;     // 港〜街
    for (let y = 8; y <= 26; y++) m[y][16] = T.ROAD;    // 中央南北
    for (let y = 8; y <= 24; y++) m[y][22] = T.ROAD;    // 東側南北
    // 劇場（Teatro aikštė、TOWNHALL流用）— 真上1マスのみ壁
    m[10][14] = T.WALL;
    m[11][14] = T.TOWNHALL;
    // 宿屋（みほさんamiクライペダ）— 道（row 15）の北側に配置
    m[13][8]  = T.WALL;
    m[14][8]  = T.INN;
    // AKクワイア集会所（仮設）
    m[13][12] = T.WALL;
    m[14][12] = T.AKHALL;
    // レストラン
    m[13][20] = T.WALL;
    m[14][20] = T.RESTAURANT;
    // 雑貨屋（コトリーナのお店）— 南側
    m[18][20] = T.WALL;
    m[19][20] = T.SHOP;
    // クライペダ駅（南東）
    m[26][22] = T.STATION;
    m[25][22] = T.ROAD;
    m[26][21] = T.ROAD;
    // 道沿いの花畑
    for (let x = 5; x <= 28; x++) {
      if (m[14][x] === T.GRASS) m[14][x] = T.FLOWER;
      if (m[16][x] === T.GRASS) m[16][x] = T.FLOWER;
    }
    // 草地に木とエンカウント草むら
    for (let y = 1; y < MAP_ROWS - 1; y++) {
      for (let x = 1; x < MAP_COLS - 1; x++) {
        if (m[y][x] !== T.GRASS) continue;
        const r = ((x * 12345671) ^ (y * 98765431)) >>> 0;
        const v = r % 100;
        if (v < 8) m[y][x] = T.TREE;
        else if (v < 28) m[y][x] = T.ENC;
      }
    }
    // NPC配置点を歩ける状態に確保（散らしで木/草むらになっていたら戻す）
    [[12,15],[19,19],[20,20],[13,4],[12,5],[18,24],[16,8]].forEach(([y,x]) => {
      if (m[y][x] === T.TREE || m[y][x] === T.ENC) m[y][x] = T.GRASS;
    });
  }

  // トラカイ（湖上の城・Mano kraštas完成地）
  // 北側に湖（Galvė）と島の城、南側にメインランドの町
  function buildTrakai() {
    const m = MAP;
    for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLS; x++) m[y][x] = T.GRASS;
    // 外周森（南北端）
    for (let x = 0; x < MAP_COLS; x++) { m[0][x] = T.TREE; m[1][x] = T.TREE; }
    for (let x = 0; x < MAP_COLS; x++) { m[MAP_ROWS-1][x] = T.TREE; m[MAP_ROWS-2][x] = T.TREE; }
    for (let y = 0; y < MAP_ROWS; y++) { m[y][0] = T.TREE; m[y][MAP_COLS-1] = T.TREE; }
    // 湖（Galvė湖）— 北側の広いエリア
    for (let y = 2; y <= 13; y++) {
      for (let x = 1; x < MAP_COLS - 1; x++) m[y][x] = T.WATER;
    }
    // 城島（湖の中央）— 行 6〜10 列 13〜19
    for (let y = 6; y <= 10; y++) {
      for (let x = 13; x <= 19; x++) m[y][x] = T.GRASS;
    }
    // トラカイ城（KAUNAS_CASTLE タイルを流用、city override で名前差し替え）
    m[8][16] = T.WALL;
    m[9][16] = T.KAUNAS_CASTLE;
    // 城島から南へ伸びる橋（湖を渡る）
    for (let y = 11; y <= 14; y++) m[y][16] = T.BRIDGE;
    m[14][16] = T.BRIDGE;
    // 南岸の道
    for (let x = 1; x < MAP_COLS - 1; x++) m[15][x] = T.ROAD;
    for (let x = 1; x < MAP_COLS - 1; x++) m[19][x] = T.ROAD;
    // 縦の道
    for (let y = 15; y <= 27; y++) m[y][16] = T.ROAD;
    for (let y = 15; y <= 25; y++) m[y][8]  = T.ROAD;
    for (let y = 15; y <= 25; y++) m[y][24] = T.ROAD;
    // 宿屋（みほさんamiトラカイ）— 西側
    m[17][10] = T.WALL;
    m[18][10] = T.INN;
    // AKクワイア集会所
    m[17][14] = T.WALL;
    m[18][14] = T.AKHALL;
    // レストラン（トラカイ名物・カライム風キビナイ）
    m[17][20] = T.WALL;
    m[18][20] = T.RESTAURANT;
    // 雑貨屋
    m[21][12] = T.WALL;
    m[22][12] = T.SHOP;
    // 民家（劇場流用 TOWNHALL）
    m[21][22] = T.WALL;
    m[22][22] = T.TOWNHALL;
    // トラカイ駅（南）
    m[26][16] = T.STATION;
    m[25][16] = T.ROAD;
    // 道沿いの花畑（街並みの彩り）
    for (let x = 2; x <= 28; x++) {
      if (m[20][x] === T.GRASS) m[20][x] = T.FLOWER;
    }
    // 草地に木とエンカウント草むら（南側）
    for (let y = 16; y < MAP_ROWS - 1; y++) {
      for (let x = 1; x < MAP_COLS - 1; x++) {
        if (m[y][x] !== T.GRASS) continue;
        const r = ((x * 71237) ^ (y * 31413)) >>> 0;
        const v = r % 100;
        if (v < 7) m[y][x] = T.TREE;
        else if (v < 24) m[y][x] = T.ENC;
      }
    }
    // 城島内の通行確保
    [[10,16],[8,14],[8,18]].forEach(([y,x]) => {
      if (m[y][x] === T.TREE || m[y][x] === T.ENC) m[y][x] = T.GRASS;
    });
    // NPC配置点を歩ける状態に
    [[12,16],[18,16],[20,12],[24,18],[16,5],[16,26],[26,15],[18,9]].forEach(([y,x]) => {
      if (m[y][x] === T.TREE || m[y][x] === T.ENC) m[y][x] = T.GRASS;
    });
  }

  function trakaiNPCs() {
    const list = [
      // みほさん（宿屋の左隣、入口に近い位置）
      { x: 9, y: 18, name: 'みほさん',     kind: 'miho',    look: 'f5', hint: null,    stationary: true },
      // 老吟遊詩人（城内 — Mano kraštas 5個目）
      { x: 16, y: 10, name: '老吟遊詩人', kind: 'tr_bard', look: 'm2', hint: 'aciu',  stationary: true },
      // 漁師（橋のたもと — Mano kraštas 4個目）
      { x: 18, y: 16, name: 'トラカイの漁師', kind: 'tr_fisher', look: 'm1', hint: 'kaip',  stationary: true },
      // カライム民族の女性（民家の隣、道沿い）
      { x: 24, y: 22, name: 'カライム女性', kind: 'tr_karaim', look: 'f6', hint: 'labas', stationary: true,
        quiz: {
          intro: [
            'カライム女性：「Labas. 私はカライムの民の末裔よ。」',
            '東欧でも珍しい民族。 トラカイには600年以上前から暮らしている。',
            '「うちの店のキビナイは、本場のカライム風よ。 ぜひ食べていってね。」',
          ],
          teach: [
            'カライム女性：「お客さんに『これでいい？』って訊かれた時── リト語ではこう答えるの。」',
            '「『Gerai』── "いいよ"、"OK"、"問題ない"。 一言で軽く返せる便利な言葉よ。」',
          ],
          question: 'カライム女性：「── じゃあ最後にひとつ。 リト語で『いいよ／OK』は？」',
          choices: ['Gerai', 'Ne', 'Atsiprašau'],
          correct: 0,
          wrongMsg: 'うーん、それだと話が止まっちゃうわねぇ。',
          learnedFlag: 'lt_gerai',
          correctLines: [
            'カライム女性：「Gerai! さすが旅の人ね。」',
            '「カライムの言葉とリト語、似ているところもあれば全然違うところもある── でも"Gerai"は両方で通じるの。」',
            '「キビナイ、温かいうちに食べていって。 湖を渡る前の腹ごしらえに、ぴったりよ。」',
          ],
        },
      },
      // 街の少女
      { x: 12, y: 20, name: '街の少女',     kind: 'tr_kid',    look: 'f3', hint: 'kaip' },
      // 駅員
      { x: 16, y: 25, name: '駅員',         kind: 'station_tr', look: 'm2', hint: null,  stationary: true },
    ];
    // チョルリョーニス精霊（橋の途中、湖上演出）— 1度話したら消える
    if (!(state.flags && state.flags.spirit_trakai_seen)) {
      list.push({ x: 16, y: 12, name: 'チョルリョーニス', kind: 'spirit_trakai', look: 'ciurlionis', hint: null, stationary: true });
    }
    return list;
  }

  // 魔女の丘（クルシュー砂州 Juodkrantė）— 砂地と木彫り彫刻のある森
  function buildWitches() {
    const m = MAP;
    for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLS; x++) m[y][x] = T.GRASS;
    // 周囲は海（砂州なので島状）
    for (let x = 0; x < MAP_COLS; x++) { m[0][x] = T.WATER; m[1][x] = T.WATER; }
    for (let x = 0; x < MAP_COLS; x++) { m[MAP_ROWS-1][x] = T.WATER; m[MAP_ROWS-2][x] = T.WATER; }
    for (let y = 0; y < MAP_ROWS; y++) { m[y][0] = T.WATER; m[y][1] = T.WATER; m[y][MAP_COLS-1] = T.WATER; m[y][MAP_COLS-2] = T.WATER; }
    // 森（外周は密、中央は疎）
    for (let y = 2; y < MAP_ROWS - 2; y++) {
      for (let x = 2; x < MAP_COLS - 2; x++) {
        const r = ((x * 53917) ^ (y * 91733)) >>> 0;
        const v = r % 100;
        // 中央付近（聖域）は森を薄く、外側ほど濃く
        const cd = Math.max(Math.abs(x - 16), Math.abs(y - 16));
        if (cd > 10) {
          if (v < 55) m[y][x] = T.TREE;
          else if (v < 75) m[y][x] = T.ENC;
        } else if (cd > 5) {
          if (v < 25) m[y][x] = T.TREE;
          else if (v < 45) m[y][x] = T.ENC;
        }
      }
    }
    // 砂の散歩道（南の上陸地点〜中央の聖域）
    for (let y = 26; y >= 16; y--) m[y][16] = T.ROAD;
    for (let x = 12; x <= 20; x++) m[16][x] = T.ROAD;
    // 上陸地点の桟橋（南端）
    m[27][15] = T.BRIDGE; m[27][16] = T.BRIDGE; m[27][17] = T.BRIDGE;
    // 帰り用の小舟
    m[28][16] = T.BOAT;
    // 木彫り彫刻群（彫刻公園を囲む）
    [[12,12],[12,16],[12,20],[16,12],[16,20],[20,12],[20,16],[20,20]].forEach(([y,x]) => {
      m[y][x] = T.SCULPTURE;
    });
    // 中央の聖域（草地のままにする）— カンクレスが置かれた台座
    // チョルリョーニス精霊もここに立つ
    m[14][16] = T.GRASS;
    m[15][16] = T.GRASS;
    // NPC配置点の確保
    [[14,16],[15,16],[26,16],[20,14]].forEach(([y,x]) => {
      if (m[y][x] === T.TREE || m[y][x] === T.ENC) m[y][x] = T.GRASS;
    });
  }

  function witchesNPCs() {
    return [
      // チョルリョーニス精霊（中央聖域）
      { x: 16, y: 14, name: 'チョルリョーニス', kind: 'spirit_witches', look: 'ciurlionis', hint: null, stationary: true },
      // 散歩中の老女（彫刻の解説役）
      { x: 14, y: 20, name: '森の老女', kind: 'witches_elder', look: 'f6', hint: null, stationary: true },
    ];
  }

  // シャウレイ — 十字架の丘（Kryžių kalnas）と街
  function buildSiauliai() {
    const m = MAP;
    for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLS; x++) m[y][x] = T.GRASS;
    // 外周森
    for (let x = 0; x < MAP_COLS; x++) { m[0][x] = T.TREE; m[1][x] = T.TREE; m[MAP_ROWS-1][x] = T.TREE; m[MAP_ROWS-2][x] = T.TREE; }
    for (let y = 0; y < MAP_ROWS; y++) { m[y][0] = T.TREE; m[y][MAP_COLS-1] = T.TREE; }
    // 北：十字架の丘 Kryžių kalnas — 緑の丘の上に無数の十字架。
    // クラスタを密に置く（Y=2-7, X=10-22）
    const crossPlots = [
      [3,12],[3,15],[3,18],[3,21],
      [4,11],[4,14],[4,17],[4,20],[4,23],
      [5,10],[5,13],[5,16],[5,19],[5,22],
      [6,12],[6,15],[6,18],[6,21],
      [7,13],[7,17],[7,21],
    ];
    crossPlots.forEach(([y,x]) => { m[y][x] = T.CROSSES; });
    // 丘へ続く参道
    for (let y = 8; y <= 13; y++) m[y][16] = T.ROAD;
    // 中央広場（Y=14, X=2..29）
    for (let x = 2; x < MAP_COLS - 1; x++) m[14][x] = T.ROAD;
    for (let x = 2; x < MAP_COLS - 1; x++) m[20][x] = T.ROAD;
    // 縦道
    for (let y = 14; y <= 27; y++) m[y][16] = T.ROAD;
    for (let y = 8;  y <= 25; y++) m[y][8]  = T.ROAD; // 西の道は十字架の丘の左の広場まで延ばす
    for (let y = 14; y <= 25; y++) m[y][24] = T.ROAD;
    // 十字架の丘の左の小広場（ヴィクトリアの居場所）
    for (let yy = 5; yy <= 7; yy++) for (let xx = 6; xx <= 8; xx++) m[yy][xx] = T.ROAD;
    // 宿屋（みほさん・amiシャウレイ）— 西
    m[16][10] = T.WALL;
    m[17][10] = T.INN;
    // AKクワイア集会所
    m[16][14] = T.WALL;
    m[17][14] = T.AKHALL;
    // レストラン（黒パン）
    m[16][20] = T.WALL;
    m[17][20] = T.RESTAURANT;
    // 雑貨屋
    m[21][12] = T.WALL;
    m[22][12] = T.SHOP;
    // 民家（カライム民族家流用 = TOWNHALL）
    m[21][22] = T.WALL;
    m[22][22] = T.TOWNHALL;
    // シャウレイ駅（南）
    m[26][16] = T.STATION;
    m[25][16] = T.ROAD;
    // 道沿いの花畑
    for (let x = 2; x <= 28; x++) {
      if (m[20][x] === T.GRASS) m[20][x] = T.FLOWER;
    }
    // 草地に木とエンカウント草むら（街の周辺）
    for (let y = 8; y < MAP_ROWS - 1; y++) {
      for (let x = 1; x < MAP_COLS - 1; x++) {
        if (m[y][x] !== T.GRASS) continue;
        const r = ((x * 41759) ^ (y * 17389)) >>> 0;
        const v = r % 100;
        if (v < 6) m[y][x] = T.TREE;
        else if (v < 22) m[y][x] = T.ENC;
      }
    }
    // 丘上の参道周辺は通行確保（十字架の合間を歩けるように）
    [[8,16],[10,16],[12,16],[3,16],[5,17],[7,16]].forEach(([y,x]) => {
      if (m[y][x] === T.TREE || m[y][x] === T.ENC) m[y][x] = T.GRASS;
    });
    // NPC配置点を歩ける状態に
    [[18,9],[18,14],[18,20],[12,16],[6,16],[20,18],[24,16],[26,15],[6,7]].forEach(([y,x]) => {
      if (m[y][x] === T.TREE || m[y][x] === T.ENC) m[y][x] = T.GRASS;
    });
  }

  function siauliaiNPCs() {
    const list = [
      // みほさん（宿屋の西隣）
      { x: 9,  y: 18, name: 'みほさん',   kind: 'miho',         look: 'f5', hint: null,    stationary: true },
      // ヴィクトリア（十字架の丘の左、開けた小広場）
      { x: 7,  y: 6,  name: 'ヴィクトリア', kind: 'victoria',    look: 'victoria', hint: null,    stationary: true },
      // 巡礼者（十字架の丘）— Kur giria 1個目
      { x: 17, y: 8,  name: '巡礼者',     kind: 'sl_pilgrim',   look: 'm2', hint: 'aciu',  stationary: true },
      // 街の老婦人（広場 — Kur giria 2個目）
      { x: 18, y: 18, name: '街の老婦人', kind: 'sl_elder',     look: 'f6', hint: 'kaip',  stationary: true,
        quiz: {
          intro: [
            '街の老婦人：「Labas vakaras… ここは静かでいいでしょう。」',
            '広場のベンチで、編み物の手を止めて旅人を見上げる女性。',
            '「私はね、若い頃にこの街の合唱団で歌っていたの。 今でも家事の合間に口ずさんでいるのよ。」',
          ],
          teach: [
            '街の老婦人：「旅人さん、お茶でも淹れましょうか── そういう時はね、リト語で『Prašau』と言うのよ。」',
            '「"どうぞ"とも"お願いします"とも訳せる、 やさしい言葉。 覚えておきなさいな。」',
          ],
          question: '街の老婦人：「── ではひとつ。 リト語で『どうぞ』は？」',
          choices: ['Prašau', 'Ačiū', 'Iki!'],
          correct: 0,
          wrongMsg: 'ふふ、それじゃ"どうぞ"にはならないわねぇ。',
          learnedFlag: 'lt_prasau',
          correctLines: [
            '街の老婦人：「Puikiai. やさしい発音ね。」',
            '「十字架の丘はね、誰かを思って釘を打つ場所なの。 願いと祈りが、長い年月で森になっていったのよ。」',
            '「歌もそう。 ひとりひとりの声が積み重なって、街そのものが歌い出すの。」',
            '「丘の上のヴィクトリアに会ってきなさい。 街じゅうの自慢の歌姫よ。」',
            '「それから、北のレストランの黒パン── あれは蜂蜜酒に合うの。 旅のお土産にぜひね。」',
          ],
        },
      },
      // 駅員
      { x: 16, y: 25, name: '駅員',       kind: 'station_sl',   look: 'm2', hint: null,    stationary: true },
    ];
    // チョルリョーニス精霊（十字架の丘の頂上）— ヴィクトリア対決後に出現、1度話したら消える
    if (state.flags && state.flags.victoria_done && !(state.flags && state.flags.spirit_siauliai_seen)) {
      list.push({ x: 16, y: 6, name: 'チョルリョーニス', kind: 'spirit_siauliai', look: 'ciurlionis', hint: null, stationary: true });
    }
    return list;
  }

  // ============================================================
  // Vingisパーク（ダイヌシュベンテ最終ステージ）
  //  ヴィリニュス西の大公園。野外ステージで3万人の観衆の前で歌う最終戦の舞台。
  //  Phase 7-1：ハコだけ実装（マップ＋ギンターレ＋ヴィリニュス帰還）。
  //  キーパーソン全員集合・最終戦・エンディングは Phase 7-2 以降。
  // ============================================================
  function buildVingis() {
    const m = MAP;
    for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLS; x++) m[y][x] = T.GRASS;
    // 外周森（公園の縁）
    for (let x = 0; x < MAP_COLS; x++) { m[0][x] = T.TREE; m[1][x] = T.TREE; m[MAP_ROWS-1][x] = T.TREE; m[MAP_ROWS-2][x] = T.TREE; }
    for (let y = 0; y < MAP_ROWS; y++) { m[y][0] = T.TREE; m[y][1] = T.TREE; m[y][MAP_COLS-1] = T.TREE; m[y][MAP_COLS-2] = T.TREE; }
    // ステージ（北側、横長の壁構造）
    for (let x = 8; x <= 23; x++) { m[3][x] = T.WALL; m[4][x] = T.WALL; }
    // 観客席（中央・花畑の絨毯で「無数の観衆」を示唆）
    for (let y = 7; y <= 22; y++) {
      for (let x = 4; x <= 27; x++) {
        if (m[y][x] === T.GRASS) m[y][x] = T.FLOWER;
      }
    }
    // ステージへの中央花道（ROAD）
    for (let y = 5; y <= 27; y++) m[y][16] = T.ROAD;
    // 入口の小広場（南）
    for (let y = 23; y <= 27; y++) for (let x = 12; x <= 20; x++) m[y][x] = T.ROAD;
    // ステージ前のオープンスペース（Phase 7-2でキーパーソン配置予定）
    for (let y = 5; y <= 6; y++) for (let x = 6; x <= 25; x++) {
      if (m[y][x] === T.WALL) continue;
      m[y][x] = T.ROAD;
    }
  }

  function vingisNPCs() {
    // Phase 7-2：ダイヌシュベンテ本番前、ステージ周辺(y=5〜12)に集めて散らす
    // 夫婦・母子は隣接、それ以外は左右に振り分け。中央花道 x=16 は通行用に空ける
    return [
      // 南入口の帰還案内
      { x: 16, y: 26, name: 'ギンターレ', kind: 'gintere_v', look: 'gintere', hint: null, stationary: true },
      // ステージ最前(y=5)：あきちゃん＆みほさん夫婦（AKクワイア主催）
      { x: 14, y: 5,  name: 'あきちゃん',     kind: 'akihiro_vp',  look: 'm4', hint: null,    stationary: true },
      { x: 15, y: 5,  name: 'みほさん',       kind: 'miho_vp',     look: 'f5', hint: null,    stationary: true },
      // ステージ前(y=6)：両端に夫婦ペア
      { x: 8,  y: 6,  name: 'マンタス',       kind: 'mantas_vp',   look: 'm4', hint: 'aciu',  stationary: true },
      { x: 9,  y: 6,  name: 'イエヴァ',       kind: 'ieva_vp',     look: 'f1', hint: 'kaip',  stationary: true },
      { x: 24, y: 6,  name: 'エレナ',         kind: 'elena_vp',    look: 'f7', hint: 'labas', stationary: true },
      { x: 25, y: 6,  name: 'マリウス',       kind: 'marius_vp',   look: 'm3', hint: null,    stationary: true },
      // 観客席最前列(y=8)：左右端にソロ
      { x: 5,  y: 8,  name: 'マリア',         kind: 'maria_vp',    look: 'f6', hint: null,    stationary: true },
      { x: 27, y: 8,  name: 'ヴィクトリア',   kind: 'victoria_vp', look: 'f6', hint: null,    stationary: true },
      // 観客席2列目(y=10)：右にユウコ単独
      { x: 20, y: 10, name: 'ユウコヤマサキ', kind: 'yamasaki_vp', look: 'f2', hint: null,    stationary: true },
      // 観客席3列目(y=12)：左にコトリーナ＆ルツィア母子
      { x: 10, y: 12, name: 'コトリーナ',     kind: 'kotryna_vp',  look: 'f5', hint: 'aciu',  stationary: true },
      { x: 11, y: 12, name: 'ルツィア',       kind: 'rutsia_vp',   look: 'f7', hint: 'labas', stationary: true },
    ];
  }

  // 初回はヴィリニュスを構築
  buildVilnius();

  // ============================================================
  // NPC配置（都市別、changeCityで切替）
  // ============================================================
  const NPCS = [];

  function vilniusNPCs() {
    const f = (state && state.flags) || {};
    const list = [
      { x: 7,  y: 18, name: 'あきちゃん',  kind: 'akihiro', look: 'm4', hint: null, stationary: true }, // AKクワイア集会所(6,18)の東隣に固定
      { x: 11, y: 18, name: 'みほさん',    kind: 'miho',    look: 'f5', hint: null, stationary: true },
      { x: 18, y: 12, name: 'マンタス',    kind: 'mantas',  look: 'm4', hint: 'aciu', stationary: true }, // レストラン(17,12)の東隣。後半ユウコ(16,14)と通路が被らないように
      { x: 24, y: 8,  name: 'イエヴァ',    kind: 'ieva',    look: 'f1', hint: 'kaip'  },
      { x: 12, y: 9,  name: '司祭',        kind: 'priest',  look: 'm2',
        quiz: {
          intro: ['司祭：「Sveiki, keliautojau. ようこそ、旅人よ。」'],
          teach: [
            '司祭：「祈りの中ではよく『Taip』と返事をする── これは"はい"を意味する短い言葉だ。」',
            '司祭：「短く、しかし重い。覚えておくとよい。」',
          ],
          question: '司祭：「── ではひとつ訊こう。リト語で『はい』はなんと言う？」',
          choices: ['Taip', 'Ne', 'Gerai'],
          correct: 0,
          wrongMsg: 'うむ、それは違うようだ…',
          learnedFlag: 'lt_taip',
        },
      },
      { x: 8,  y: 13, name: '雑貨屋',      kind: 'shop',    look: 'f3', hint: 'aciu'  },
      { x: 18, y: 19, name: '吟遊詩人',    kind: 'bard',    look: 'm3', hint: 'kaip'  },
      { x: 14, y: 21, name: '子ども',      kind: 'child',   look: 'f7', hint: 'labas' },
      { x: 23, y: 19, name: 'おばあさん',  kind: 'elder',   look: 'f6',
        quiz: {
          intro: ['おばあさん：「Labas, jaunime. ふぅ、若い人は元気じゃのぅ。」'],
          teach: [
            'おばあさん：「リト語で別れ際にひとこと、『Iki!』── "またね"、というのよ。」',
            'おばあさん：「短いけれど、温かい挨拶。覚えておきなさいな。」',
          ],
          question: 'おばあさん：「── じゃあ別れ際にひとこと。リト語で『またね』は？」',
          choices: ['Iki!', 'Labas!', 'Ačiū!'],
          correct: 0,
          wrongMsg: 'うふふ、それじゃ別れの挨拶にならんわ…',
          learnedFlag: 'lt_iki',
        },
      },
      { x: 16, y: 7,  name: '塔の番人',    kind: 'guardian', look: 'm2', hint: null, stationary: true },
      // 駅員（ヴィリニュス駅、切符配布役）
      { x: 21, y: 28, name: '駅員',       kind: 'station_v', look: 'm2', hint: null, stationary: true },
    ];
    // ヴィリニュス再訪（Phase 6）：
    //  - ピリエス通り入口にユウコヤマサキ（着物のカンクレス奏者）
    //  - AKクワイア集会所前にルツィア（おつかいクエストB＝クヴァス配達完了後に家族で来訪）
    if (f.vilnius_revisit) {
      list.push({ x: 16, y: 14, name: 'ユウコヤマサキ', kind: 'yamasaki', look: 'yamasaki', hint: null, stationary: true });
      if (f.fq_kvas_done) {
        list.push({ x: 7,  y: 19, name: 'ルツィア',       kind: 'rutsia_v', look: 'f7', hint: 'labas', stationary: true });
      }
    }
    // Phase 7：Kur giria 5/5 達成 → ギンターレ登場（Vingisパークへの送り出し役）
    const kurCount = (state && state.piecesBySong && state.piecesBySong.kur) || 0;
    if (kurCount >= 5) {
      list.push({ x: 12, y: 11, name: 'ギンターレ', kind: 'gintere', look: 'gintere', hint: null, stationary: true });
    }
    return list;
  }

  function kaunasNPCs() {
    return [
      { x: 12, y: 16, name: 'みほさん',    kind: 'miho',    look: 'f5', hint: null, stationary: true },
      { x: 18, y: 12, name: 'エレナ',      kind: 'elena',   look: 'f7', hint: 'labas', stationary: true },
      { x: 20, y: 16, name: 'マリウス',    kind: 'marius',  look: 'm3', hint: 'aciu',  stationary: true },
      { x: 8,  y: 18, name: 'カウナスの老人', kind: 'citizen', look: 'm1', hint: 'labas' },
      { x: 24, y: 18, name: '少年',        kind: 'kid_k',   look: 'm2', hint: 'kaip' },
      { x: 21, y: 26, name: '駅員',        kind: 'station_k', look: 'm2', hint: null, stationary: true },
    ];
  }

  function klaipedaNPCs() {
    return [
      { x: 8,  y: 16, name: 'みほさん',    kind: 'miho',    look: 'f5', hint: null, stationary: true },
      { x: 15, y: 12, name: 'マリア',      kind: 'maria',   look: 'f6', hint: 'labas', stationary: true }, // 劇場前のヴィオラ奏者（入口を塞がないよう東隣に配置）
      { x: 19, y: 19, name: 'コトリーナ',  kind: 'kotryna', look: 'f5', hint: 'aciu',  stationary: true }, // 雑貨屋の前
      { x: 20, y: 20, name: 'ルツィア',    kind: 'rutsia',  look: 'f7', hint: 'labas' }, // コトリーナの娘4歳
      { x: 4,  y: 14, name: '老漁師',      kind: 'fisher',  look: 'm2', hint: 'kaip',  stationary: true }, // 桟橋の南側、入口近く
      { x: 4,  y: 12, name: '日本人船員',  kind: 'sailor',  look: 'm1', hint: null,    stationary: true }, // 桟橋の北側、入口近く（ダイナミック琉球5番目の解禁役）
      { x: 24, y: 18, name: '港町の人',    kind: 'kl_citizen', look: 'm3', hint: 'aciu',
        quiz: {
          intro: [
            '港町の人：「Labas! クライペダは初めて？」',
            '潮焼けした肌に、人懐っこい笑顔。',
            '「ここは港町だからね。 観光客と漁師と荷揚げ人で、いつも誰かに肩がぶつかるんだ。」',
          ],
          teach: [
            '港町の人：「そんな時にひと言。 リト語で『Atsiprašau!』── "ごめん、ちょっと失礼"って意味さ。」',
            '「短い言葉だけど、これひとつで街の空気が柔らかくなるんだ。」',
          ],
          question: '港町の人：「── じゃあ訊くよ。 リト語で『すみません』は何だっけ？」',
          choices: ['Atsiprašau!', 'Ačiū!', 'Sveiki!'],
          correct: 0,
          wrongMsg: 'うーん、 なんて言ったの？',
          learnedFlag: 'lt_atsiprasau',
          correctLines: [
            '港町の人：「Labai gerai! 上手だね。」',
            '「クライペダはね、ドイツ語だとメーメル（Memel）って呼ばれてた港町なんだ。」',
            '「歴史のある場所だよ。 劇場前のマリアの演奏は絶対聴いていきな。」',
            '「あと、桟橋の先の小舟── 誰も乗ってないのに、 ときどき男の歌声が漏れてくるって噂だよ。 怖いような、 ありがたいような…」',
          ],
        },
      },
      { x: 21, y: 26, name: '駅員',        kind: 'station_kl', look: 'm2', hint: null, stationary: true },
    ];
  }

  function rebuildNPCs(cityKey) {
    NPCS.length = 0;
    const list =
      cityKey === 'kaunas'   ? kaunasNPCs()   :
      cityKey === 'klaipeda' ? klaipedaNPCs() :
      cityKey === 'trakai'   ? trakaiNPCs()   :
      cityKey === 'witches'  ? witchesNPCs()  :
      cityKey === 'siauliai' ? siauliaiNPCs() :
      cityKey === 'vingis'   ? vingisNPCs()   :
      vilniusNPCs();
    list.forEach(n => {
      n.homeX = n.x; n.homeY = n.y;
      NPCS.push(n);
    });
  }

  // ============================================================
  // ゲーム状態
  // ============================================================
  function initialState() {
    return {
      scene: 'title', // title | newgame | field | dialog | battle | win | lose
      titleStep: 'menu',  // menu | name1 | look1 | name2 | look2 | name3 | look3 | confirm
      tmp: { names: ['', '', ''], looks: ['m1', 'f5', 'm4'], whoIdx: 0, kanaIdx: 0 },
      // パーティ（共通レベル、それぞれHP/MPあり）
      party: [
        { name: '主人公', look: 'm1', hp: 20, maxHp: 20, mp: 10, maxMp: 10, alive: true },
        { name: 'あき',   look: 'm1', hp: 18, maxHp: 18, mp: 8,  maxMp: 8,  alive: true },
        { name: 'みほ',   look: 'f5', hp: 16, maxHp: 16, mp: 12, maxMp: 12, alive: true },
      ],
      px: 7, py: 19, pdir: 'up',
      cityKey: 'vilnius',
      visitedCities: { vilnius: true },
      lv: 1, xp: 0, gold: 30, nextXp: 8,
      pieces: 0,
      piecesBySong: { soran: 0, dynamic: 0, mano: 0, kur: 0 },
      piecesLog: [], // [{song:'soran', lyric:'…', from:'雑貨屋'}]
      flags: { guardian: false, child: false, shop: false, bard: false, mantas: false, ieva: false, kaunas_ticket: false },
      dialog: [], dialogIdx: 0,
      choices: null, onChoice: null, afterDialog: null,
      enemy: null, battleLog: '', battleStep: 'menu', battleSel: 0,
      buff: 0, // エホーマイ残ターン
      songCounter: 0,
      // ↓ 永続化されない演出用フィールド（saveGame では切り捨てる）
      battleFx: [], shakeTime: 0, activeActor: -1, turnIdx: 0,
      move: null, // { dx, dy, t0, dur } タイル間補間中の移動状態
      // 仲間2人のフィールド表示用（リーダー位置の履歴で「ヘビ列」追従）
      followers: [
        { x: 14, y: 19, dir: 'down', move: null },
        { x: 14, y: 19, dir: 'down', move: null },
      ],
    };
  }
  let state = initialState();
  rebuildNPCs('vilnius'); // state初期化後に呼ぶ（vilniusNPCs内でstate.flagsを参照するため）

  // 仲間2人をリーダー（主人公）位置にスナップ。都市切替・ロード時に呼ぶ。
  function resetFollowersToLeader() {
    state.followers = [
      { x: state.px, y: state.py, dir: state.pdir, move: null },
      { x: state.px, y: state.py, dir: state.pdir, move: null },
    ];
  }

  // ============================================================
  // セーブ／ロード
  // ============================================================
  function saveGame() {
    try {
      const snap = {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        party: state.party,
        px: state.px, py: state.py, pdir: state.pdir,
        lv: state.lv, xp: state.xp, gold: state.gold, nextXp: state.nextXp,
        pieces: state.pieces, flags: state.flags,
        piecesBySong: state.piecesBySong,
        piecesLog: state.piecesLog,
        cityKey: state.cityKey,
        visitedCities: state.visitedCities,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
      flashStatus('💾 セーブしました');
    } catch (e) {
      flashStatus('セーブ失敗: ' + e.message);
    }
  }
  function loadGame() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (!s) return false;
      const d = JSON.parse(s);
      if (!d || d.version !== SAVE_VERSION) return false;
      state.party = d.party;
      state.px = d.px; state.py = d.py; state.pdir = d.pdir || 'down';
      state.lv = d.lv; state.xp = d.xp; state.gold = d.gold; state.nextXp = d.nextXp;
      state.pieces = d.pieces; state.flags = d.flags || {};
      state.piecesBySong = d.piecesBySong || { soran: 0, dynamic: 0, mano: 0, kur: 0 };
      state.piecesLog = d.piecesLog || [];
      if (typeof rebuildSongs === 'function') rebuildSongs();
      state.cityKey = d.cityKey || 'vilnius';
      state.visitedCities = d.visitedCities || { vilnius: true };
      // 都市切替を反映
      if (state.cityKey === 'kaunas') buildKaunas();
      else if (state.cityKey === 'klaipeda') buildKlaipeda();
      else if (state.cityKey === 'trakai') buildTrakai();
      else if (state.cityKey === 'witches') buildWitches();
      else if (state.cityKey === 'siauliai') buildSiauliai();
      else if (state.cityKey === 'vingis') buildVingis();
      else buildVilnius();
      rebuildNPCs(state.cityKey);
      resetFollowersToLeader();
      state.scene = 'field';
      return true;
    } catch (e) { return false; }
  }
  function hasSave() { return !!localStorage.getItem(SAVE_KEY); }

  // ============================================================
  // 都市切替＋電車演出
  // ============================================================
  function changeCity(key) {
    state.cityKey = key;
    state.visitedCities = state.visitedCities || {};
    state.visitedCities[key] = true;
    if (key === 'kaunas') {
      buildKaunas();
      rebuildNPCs('kaunas');
      state.px = 22; state.py = 25; state.pdir = 'up'; // カウナス駅前
    } else if (key === 'klaipeda') {
      buildKlaipeda();
      rebuildNPCs('klaipeda');
      // 魔女の丘から戻ってきた場合は桟橋の上に降りる
      if (state.flags && state.flags._returnFromWitches) {
        state.px = 3;  state.py = 13; state.pdir = 'right';
        delete state.flags._returnFromWitches;
      } else {
        state.px = 22; state.py = 25; state.pdir = 'up'; // クライペダ駅前
      }
    } else if (key === 'trakai') {
      buildTrakai();
      rebuildNPCs('trakai');
      state.px = 16; state.py = 25; state.pdir = 'up'; // トラカイ駅前
    } else if (key === 'witches') {
      buildWitches();
      rebuildNPCs('witches');
      state.px = 16; state.py = 26; state.pdir = 'up'; // 砂州の南端、桟橋から上陸
    } else if (key === 'siauliai') {
      buildSiauliai();
      rebuildNPCs('siauliai');
      state.px = 16; state.py = 25; state.pdir = 'up'; // シャウレイ駅前
    } else if (key === 'vingis') {
      buildVingis();
      rebuildNPCs('vingis');
      state.px = 16; state.py = 27; state.pdir = 'up'; // 公園入口の南端から登場
    } else {
      // ヴィリニュス再訪フラグ判定：
      //   主条件: シャウレイで精霊チョルリョーニスと邂逅済み（spirit_siauliai_seen）
      //   保険:   victoria_done && Kur giria>=3（精霊と話さず離脱したケースの救済）
      const f = state.flags || {};
      const kurCount = (state.piecesBySong && state.piecesBySong.kur) || 0;
      const revisitReady = !!f.spirit_siauliai_seen || (!!f.victoria_done && kurCount >= 3);
      if (revisitReady && !f.vilnius_revisit) {
        state.flags.vilnius_revisit = true;
      }
      buildVilnius();
      rebuildNPCs('vilnius');
      // Vingisパークから戻ってきた場合はギンターレの目の前に戻す
      if (f._returnFromVingis) {
        state.px = 12; state.py = 12; state.pdir = 'up';
        delete state.flags._returnFromVingis;
      } else {
        state.px = 22; state.py = 27; state.pdir = 'up'; // ヴィリニュス駅前
      }
    }
    resetFollowersToLeader();
    saveGame();
    showCityBanner(CITY_NAMES[key] || '');
    render();
  }

  // 都市到着バナー（フィールド上部に3秒間表示）
  const CITY_NAMES = {
    vilnius:  'ヴィリニュス',
    kaunas:   'カウナス',
    klaipeda: 'クライペダ',
    trakai:   'トラカイ',
    witches:  '魔女の丘',
    siauliai: 'シャウレイ',
    vingis:   'Vingisパーク',
  };
  const CITY_SUBTITLES = {
    vilnius:  'Vilnius',
    kaunas:   'Kaunas',
    klaipeda: 'Klaipėda',
    trakai:   'Trakai',
    witches:  'Raganų kalnas',
    siauliai: 'Šiauliai',
    vingis:   'Vingio parkas — Dainų šventė',
  };
  function showCityBanner(text) {
    if (!text) return;
    if (state._cityBannerInt) { clearInterval(state._cityBannerInt); state._cityBannerInt = null; }
    state.cityBanner = { text, sub: CITY_SUBTITLES[state.cityKey] || '', t0: performance.now(), dur: 3000 };
    state._cityBannerInt = setInterval(() => {
      if (!state.cityBanner) { clearInterval(state._cityBannerInt); state._cityBannerInt = null; return; }
      if (performance.now() - state.cityBanner.t0 >= state.cityBanner.dur) {
        state.cityBanner = null;
        clearInterval(state._cityBannerInt); state._cityBannerInt = null;
        render();
        return;
      }
      if (state.scene === 'field' || state.scene === 'dialog') render();
    }, 60);
  }
  function drawCityBanner() {
    const b = state.cityBanner;
    if (!b) return;
    const t = performance.now() - b.t0;
    if (t < 0 || t >= b.dur) return;
    let alpha = 1;
    if (t < 350) alpha = t / 350;
    else if (t > b.dur - 600) alpha = Math.max(0, (b.dur - t) / 600);
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    const bandH = 54, bandY = 18;
    const grad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
    grad.addColorStop(0, 'rgba(20,20,40,0.85)');
    grad.addColorStop(1, 'rgba(10,10,24,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandY, CANVAS_W, bandH);
    ctx.strokeStyle = '#dac030';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, bandY + 1, CANVAS_W - 2, bandH - 2);
    ctx.fillStyle = '#dac030';
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(b.text, CANVAS_W / 2, bandY + 30);
    if (b.sub) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#c0d0e0';
      ctx.fillText(b.sub, CANVAS_W / 2, bandY + 46);
    }
    ctx.globalAlpha = prevA;
    ctx.textAlign = 'left';
  }

  // 電車演出（フェード→走行アニメ→到着）
  function playTrainTransition(toKey, onArrive) {
    state.scene = 'train';
    state.train = { phase: 'depart', t0: Date.now(), to: toKey };
    // 出発地より目的地が西寄りなら西行きアニメーション
    const fromX = (CITIES[state.cityKey] || {}).realX;
    const toX = (CITIES[toKey] || {}).realX;
    const goWest = (typeof fromX === 'number' && typeof toX === 'number') ? toX < fromX : true;
    // 進行方向の逆向きに景色が流れる：西行き（電車は左へ）なら景色は右へ → dir=-1で `(x - off*dir)` がプラス方向に
    const dir = goWest ? -1 : +1;

    // 流れる小オブジェクト（樹木・電柱）の位置を擬似ランダムで生成
    const trees = [];
    for (let i = 0; i < 7; i++) {
      trees.push({ x: i * 60 + (i * 53) % 30, h: 24 + ((i * 17) % 18), kind: i % 3 });
    }
    const poles = [];
    for (let i = 0; i < 4; i++) poles.push({ x: i * 110 + 30 });

    const drawSkyAndHills = (elapsed) => {
      // 空グラデーション（夕暮れ寄り）
      const sky = ctx.createLinearGradient(0, 0, 0, 200);
      sky.addColorStop(0, '#1a2050');
      sky.addColorStop(0.55, '#3a4a8a');
      sky.addColorStop(1, '#d68855');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CANVAS_W, 200);

      // 太陽/月（地平線に半分のぞかせる）
      ctx.fillStyle = '#ffd58a';
      ctx.beginPath();
      ctx.arc(goWest ? 80 : CANVAS_W - 80, 200, 22, Math.PI, 0);
      ctx.fill();

      // 雲（ゆっくり流れる）
      ctx.fillStyle = 'rgba(220,220,235,0.55)';
      const cloudOff = (elapsed * 0.04 * dir) % CANVAS_W;
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 120 - cloudOff) % CANVAS_W + CANVAS_W) % CANVAS_W;
        ctx.beginPath();
        ctx.arc(cx, 50 + (i % 2) * 18, 14, 0, Math.PI * 2);
        ctx.arc(cx + 14, 50 + (i % 2) * 18, 18, 0, Math.PI * 2);
        ctx.arc(cx + 30, 50 + (i % 2) * 18, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // 遠景の丘（パララックス：ゆっくり流れる）
      const hillOff1 = (elapsed * 0.08 * dir) % CANVAS_W;
      ctx.fillStyle = '#2a3a4a';
      ctx.beginPath();
      ctx.moveTo(0, 200);
      for (let x = 0; x <= CANVAS_W + 60; x += 30) {
        const px = ((x - hillOff1) % CANVAS_W + CANVAS_W) % CANVAS_W;
        const y = 175 + Math.sin((x + hillOff1) * 0.05) * 10;
        ctx.lineTo(px, y);
      }
      ctx.lineTo(CANVAS_W, 200); ctx.lineTo(0, 200);
      ctx.fill();

      // 中景の丘
      const hillOff2 = (elapsed * 0.18 * dir) % CANVAS_W;
      ctx.fillStyle = '#1d2c2a';
      ctx.beginPath();
      ctx.moveTo(0, 210);
      for (let x = 0; x <= CANVAS_W + 60; x += 24) {
        const px = ((x - hillOff2) % CANVAS_W + CANVAS_W) % CANVAS_W;
        const y = 195 + Math.sin((x + hillOff2) * 0.08) * 7;
        ctx.lineTo(px, y);
      }
      ctx.lineTo(CANVAS_W, 220); ctx.lineTo(0, 220);
      ctx.fill();

      // 草原（ベース）
      ctx.fillStyle = '#0f2418';
      ctx.fillRect(0, 220, CANVAS_W, 60);
    };

    const drawForegroundParallax = (elapsed) => {
      // 電柱（高速で流れる）
      const poleSpeed = 0.45;
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      poles.forEach(p => {
        const px = ((p.x - elapsed * poleSpeed * dir) % CANVAS_W + CANVAS_W) % CANVAS_W;
        ctx.beginPath();
        ctx.moveTo(px, 110);
        ctx.lineTo(px, 240);
        ctx.stroke();
        // 横腕
        ctx.beginPath();
        ctx.moveTo(px - 8, 120); ctx.lineTo(px + 8, 120);
        ctx.stroke();
      });
      // 架線
      ctx.strokeStyle = 'rgba(20,20,20,0.7)';
      ctx.beginPath(); ctx.moveTo(0, 120); ctx.lineTo(CANVAS_W, 120); ctx.stroke();

      // 樹木（最前景、最も速く流れる）
      const treeSpeed = 0.7;
      trees.forEach(t => {
        const tx = ((t.x - elapsed * treeSpeed * dir) % (CANVAS_W + 60) + (CANVAS_W + 60)) % (CANVAS_W + 60) - 30;
        // 幹
        ctx.fillStyle = '#3a2010';
        ctx.fillRect(tx - 2, 240 - t.h * 0.6, 4, t.h * 0.6);
        // 葉
        ctx.fillStyle = t.kind === 0 ? '#1c4a26' : t.kind === 1 ? '#234a2a' : '#2c5a35';
        if (t.kind === 0) {
          // 円錐型（針葉樹）
          ctx.beginPath();
          ctx.moveTo(tx, 240 - t.h);
          ctx.lineTo(tx - 12, 240 - t.h * 0.4);
          ctx.lineTo(tx + 12, 240 - t.h * 0.4);
          ctx.fill();
        } else {
          // 丸型
          ctx.beginPath();
          ctx.arc(tx, 240 - t.h * 0.7, 12 + (t.kind === 1 ? 2 : 4), 0, Math.PI * 2);
          ctx.fill();
        }
      });
    };

    const drawTracks = (elapsed) => {
      // 砂利（バラスト）
      ctx.fillStyle = '#3a3530';
      ctx.fillRect(0, 268, CANVAS_W, 22);
      // 枕木
      const tieOff = (elapsed * 0.5 * dir) % 28;
      ctx.fillStyle = '#4a3520';
      for (let x = -28; x < CANVAS_W + 28; x += 28) {
        const tx = ((x - tieOff) % (CANVAS_W + 28) + (CANVAS_W + 28)) % (CANVAS_W + 28);
        ctx.fillRect(tx, 274, 16, 6);
      }
      // 2本のレール
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(0, 272, CANVAS_W, 2);
      ctx.fillRect(0, 282, CANVAS_W, 2);
    };

    const drawTrain = (elapsed) => {
      // 車体は画面中央でわずかに上下に揺れる（走行感）
      const shake = Math.sin(elapsed * 0.02) * 0.8;
      const baseY = 226 + shake;
      const carW = 80; // 1両あたり
      const numCars = 3;
      const totalW = carW * numCars + (numCars - 1) * 4;
      const startX = (CANVAS_W - totalW) / 2;
      const noseW = 22; // 先頭部の傾き

      // 影
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(startX - noseW + 6, baseY + 36, totalW + noseW + 6, 6);

      for (let c = 0; c < numCars; c++) {
        const cx = startX + c * (carW + 4);
        const isHead = (goWest && c === 0) || (!goWest && c === numCars - 1);
        // 車体本体（メタリック青のグラデ）
        const grd = ctx.createLinearGradient(0, baseY, 0, baseY + 36);
        grd.addColorStop(0, '#3550b8');
        grd.addColorStop(0.5, '#5070d8');
        grd.addColorStop(1, '#1c2a70');
        ctx.fillStyle = grd;
        ctx.fillRect(cx, baseY, carW, 36);

        // 屋根のハイライト
        ctx.fillStyle = '#7088e8';
        ctx.fillRect(cx, baseY, carW, 3);

        // リトアニア国旗カラーのストライプ（黄・緑・赤）
        ctx.fillStyle = '#f5c043'; ctx.fillRect(cx, baseY + 14, carW, 2);
        ctx.fillStyle = '#1a8a3a'; ctx.fillRect(cx, baseY + 16, carW, 2);
        ctx.fillStyle = '#c92020'; ctx.fillRect(cx, baseY + 18, carW, 2);

        // 窓（4つ並べる、奥に乗客のシルエット）
        for (let w = 0; w < 4; w++) {
          const wx = cx + 6 + w * 18;
          ctx.fillStyle = '#dfeff5';
          ctx.fillRect(wx, baseY + 5, 14, 8);
          // 乗客シルエット（時々）
          if ((c + w) % 2 === 0) {
            ctx.fillStyle = '#3a4a5a';
            ctx.fillRect(wx + 4, baseY + 7, 6, 6);
          }
        }

        // ドア（先頭以外の中央）
        if (!isHead || numCars > 1) {
          ctx.fillStyle = '#1a2a60';
          ctx.fillRect(cx + carW / 2 - 4, baseY + 22, 8, 14);
          ctx.fillStyle = '#0a1a40';
          ctx.fillRect(cx + carW / 2 - 1, baseY + 24, 1, 10);
        }

        // 車輪 + 回転スポーク
        const wheelRot = (elapsed * 0.02) % (Math.PI * 2);
        for (let wh = 0; wh < 2; wh++) {
          const wx = cx + 14 + wh * (carW - 28);
          ctx.fillStyle = '#1a1a1a';
          ctx.beginPath();
          ctx.arc(wx, baseY + 38, 6, 0, Math.PI * 2);
          ctx.fill();
          // スポーク
          ctx.strokeStyle = '#888';
          ctx.lineWidth = 1.2;
          for (let s = 0; s < 3; s++) {
            const ang = wheelRot + s * (Math.PI / 3) * dir;
            ctx.beginPath();
            ctx.moveTo(wx, baseY + 38);
            ctx.lineTo(wx + Math.cos(ang) * 5, baseY + 38 + Math.sin(ang) * 5);
            ctx.stroke();
          }
        }

        // 連結器
        if (c < numCars - 1) {
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(cx + carW, baseY + 24, 4, 6);
        }
      }

      // 先頭部（流線型ノーズ）
      const headIdx = goWest ? 0 : numCars - 1;
      const headCx = startX + headIdx * (carW + 4);
      ctx.fillStyle = '#3550b8';
      ctx.beginPath();
      if (goWest) {
        // 左側に伸びるノーズ
        ctx.moveTo(headCx, baseY);
        ctx.lineTo(headCx - noseW, baseY + 16);
        ctx.lineTo(headCx - noseW, baseY + 30);
        ctx.lineTo(headCx, baseY + 36);
        ctx.closePath();
      } else {
        // 右側に伸びるノーズ
        ctx.moveTo(headCx + carW, baseY);
        ctx.lineTo(headCx + carW + noseW, baseY + 16);
        ctx.lineTo(headCx + carW + noseW, baseY + 30);
        ctx.lineTo(headCx + carW, baseY + 36);
        ctx.closePath();
      }
      ctx.fill();
      // ノーズのハイライト
      ctx.fillStyle = '#7088e8';
      if (goWest) {
        ctx.fillRect(headCx - noseW + 2, baseY + 16, noseW - 2, 2);
      } else {
        ctx.fillRect(headCx + carW, baseY + 16, noseW - 2, 2);
      }

      // 運転席窓（フロントガラス、ノーズ寄り）
      ctx.fillStyle = '#102030';
      if (goWest) {
        ctx.beginPath();
        ctx.moveTo(headCx - noseW + 4, baseY + 5);
        ctx.lineTo(headCx, baseY + 5);
        ctx.lineTo(headCx, baseY + 14);
        ctx.lineTo(headCx - noseW + 6, baseY + 14);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(headCx + carW, baseY + 5);
        ctx.lineTo(headCx + carW + noseW - 4, baseY + 5);
        ctx.lineTo(headCx + carW + noseW - 6, baseY + 14);
        ctx.lineTo(headCx + carW, baseY + 14);
        ctx.closePath();
        ctx.fill();
      }

      // ヘッドライト＋光芒
      const lightX = goWest ? headCx - noseW + 2 : headCx + carW + noseW - 2;
      const lightY = baseY + 23;
      const beamGrad = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, 60);
      beamGrad.addColorStop(0, 'rgba(255,250,200,0.9)');
      beamGrad.addColorStop(0.4, 'rgba(255,240,160,0.35)');
      beamGrad.addColorStop(1, 'rgba(255,240,160,0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.arc(lightX, lightY, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8c0';
      ctx.beginPath();
      ctx.arc(lightX, lightY, 3, 0, Math.PI * 2);
      ctx.fill();

      // パンタグラフ（架線集電装置）
      const pantCx = headCx + carW / 2;
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pantCx - 8, baseY); ctx.lineTo(pantCx, baseY - 12);
      ctx.lineTo(pantCx + 8, baseY);
      ctx.stroke();
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(pantCx - 12, baseY - 14, 24, 2);
    };

    const drawCaption = (toKey, elapsed) => {
      // 上部の半透明バンド
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 30, CANVAS_W, 70);
      ctx.strokeStyle = 'rgba(218,192,48,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 36, CANVAS_W - 16, 58);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      const cityName = (CITIES[toKey] || {}).name || toKey;
      ctx.fillText('〜 ' + cityName + ' へ向かっています 〜', CANVAS_W / 2, 60);
      ctx.fillStyle = '#dac030';
      ctx.font = '11px sans-serif';
      ctx.fillText('リトアニア国鉄 LG （Lietuvos geležinkeliai）', CANVAS_W / 2, 80);
      // 進行ドット
      const dots = Math.floor(elapsed / 350) % 4;
      ctx.fillStyle = '#dac030';
      for (let i = 0; i < dots; i++) ctx.beginPath(), ctx.arc(CANVAS_W / 2 - 14 + i * 14, 92, 2, 0, Math.PI * 2), ctx.fill();
      ctx.textAlign = 'left';
    };

    const step = () => {
      const now = Date.now();
      const elapsed = now - state.train.t0;

      drawSkyAndHills(elapsed);
      drawTracks(elapsed);
      drawForegroundParallax(elapsed);
      drawTrain(elapsed);
      drawCaption(toKey, elapsed);

      if (elapsed < 3500) {
        requestAnimationFrame(step);
      } else {
        state.scene = 'field';
        state.train = null;
        if (onArrive) onArrive();
      }
    };
    requestAnimationFrame(step);
  }

  let _flashTimer = null;
  function flashStatus(msg) {
    const s = document.getElementById('status');
    if (!s) return;
    s.dataset.flash = msg;
    if (_flashTimer) clearTimeout(_flashTimer);
    _flashTimer = setTimeout(() => { delete s.dataset.flash; updateStatus(); }, 1500);
    updateStatus();
  }

  // ============================================================
  // カメラ
  // ============================================================
  function getCamera() {
    let cx = state.px - Math.floor(VIEW_COLS / 2);
    let cy = state.py - Math.floor(VIEW_ROWS / 2);
    cx = Math.max(0, Math.min(MAP_COLS - VIEW_COLS, cx));
    cy = Math.max(0, Math.min(MAP_ROWS - VIEW_ROWS, cy));
    return { cx, cy };
  }

  // ============================================================
  // 描画ヘルパー
  // ============================================================
  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function clear(c) { rect(0, 0, CANVAS_W, CANVAS_H, c || '#000'); }

  // canvas に重ねる暗転用オーバーレイ（位置は画面サイズに同期）
  function ensureFadeOverlay() {
    let overlay = document.getElementById('fadeOverlay');
    if (overlay) return overlay;
    const screen = document.getElementById('screen');
    const root = document.getElementById('game-root');
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
    overlay = document.createElement('div');
    overlay.id = 'fadeOverlay';
    overlay.style.cssText =
      'position:absolute;background:#000;opacity:0;pointer-events:none;' +
      'z-index:10;border-radius:8px;transition:opacity 0s linear;';
    root.appendChild(overlay);
    const sync = () => {
      const r = screen.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      overlay.style.left = (r.left - rr.left) + 'px';
      overlay.style.top = (r.top - rr.top) + 'px';
      overlay.style.width = r.width + 'px';
      overlay.style.height = r.height + 'px';
    };
    sync();
    window.addEventListener('resize', sync);
    return overlay;
  }
  function fadeCanvas(durMs, toOpacity) {
    const overlay = ensureFadeOverlay();
    overlay.style.transition = 'opacity ' + (durMs / 1000) + 's ease-in-out';
    void overlay.offsetWidth; // reflow
    overlay.style.opacity = String(toOpacity);
  }

  function drawTile(t, sx, sy, mx, my) {
    if (t === T.GRASS || t === T.ENC || t === T.FLOWER) {
      rect(sx, sy, TILE, TILE, t === T.ENC ? '#5a8a3a' : '#6ea64a');
      ctx.fillStyle = t === T.ENC ? '#3e6a26' : '#4d8a36';
      for (let i = 0; i < 12; i++) {
        const dx = (i * 7 + sy) % TILE;
        const dy = (i * 11 + sx) % TILE;
        ctx.fillRect(sx + dx, sy + dy, 3, 3);
      }
      if (t === T.ENC) {
        ctx.fillStyle = '#2e5a1a';
        ctx.fillRect(sx + 6,  sy + 18, 2, 8);
        ctx.fillRect(sx + 16, sy + 14, 2, 10);
        ctx.fillRect(sx + 24, sy + 20, 2, 8);
      }
      if (t === T.FLOWER) {
        const cols = ['#dac030','#c84080','#ffffff','#aa6aee'];
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = cols[i % 4];
          const dx = ((sx + sy + i*9) * 13) % (TILE - 4);
          const dy = ((sx * 3 + sy * 5 + i*7) * 11) % (TILE - 4);
          ctx.fillRect(sx + dx, sy + dy, 3, 3);
        }
      }
    } else if (t === T.ROAD) {
      rect(sx, sy, TILE, TILE, '#c8a878');
      ctx.fillStyle = '#a88858';
      ctx.fillRect(sx + 4,  sy + 6,  3, 3);
      ctx.fillRect(sx + 18, sy + 22, 3, 3);
      ctx.fillRect(sx + 22, sy + 8,  2, 2);
      ctx.fillRect(sx + 8,  sy + 18, 2, 2);
    } else if (t === T.WALL) {
      rect(sx, sy, TILE, TILE, '#8a4a2a');
      ctx.fillStyle = '#6a3a1a';
      ctx.fillRect(sx, sy + 14, TILE, 1);
      ctx.fillRect(sx + 14, sy, 1, TILE);
      ctx.fillStyle = '#aa6a3a';
      ctx.fillRect(sx + 2,  sy + 2,  5, 4);
      ctx.fillRect(sx + 18, sy + 18, 5, 4);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 22, sy + 4,  4, 4);
      ctx.fillRect(sx + 4,  sy + 22, 4, 4);
    } else if (t === T.TREE) {
      rect(sx, sy, TILE, TILE, '#6ea64a');
      rect(sx + 13, sy + 22, 6, 10, '#5a3a1a');
      ctx.fillStyle = '#1e6a2a';
      ctx.beginPath(); ctx.arc(sx + 16, sy + 14, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2e8a3a';
      ctx.beginPath(); ctx.arc(sx + 16, sy + 11, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4eaa4a';
      ctx.beginPath(); ctx.arc(sx + 12, sy + 9, 3, 0, Math.PI * 2); ctx.fill();
    } else if (t === T.WATER) {
      rect(sx, sy, TILE, TILE, '#3a6abe');
      ctx.fillStyle = '#5a8ade';
      ctx.fillRect(sx + 4,  sy + 8,  10, 2);
      ctx.fillRect(sx + 16, sy + 18, 10, 2);
      ctx.fillRect(sx + 8,  sy + 24, 8,  1);
    } else if (t === T.DOOR) {
      rect(sx, sy, TILE, TILE, '#8a4a2a');
      rect(sx + 10, sy + 8, 12, 24, '#3a2a1a');
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 19, sy + 20, 2, 3);
      ctx.fillStyle = '#aa6a3a';
      ctx.fillRect(sx + 8, sy + 4, 16, 3);
    } else if (t === T.GEDIMINAS) {
      rect(sx, sy, TILE, TILE, '#6ea64a');
      rect(sx + 9, sy + 4, 14, 28, '#b06030');
      rect(sx + 7, sy + 2, 18, 5,  '#8a4020');
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 14, sy + 16, 4, 6);
      ctx.fillRect(sx + 14, sy + 24, 4, 5);
      ctx.fillStyle = '#dac030'; ctx.fillRect(sx + 15, sy,     2, 3);
      ctx.fillStyle = '#dac030'; ctx.fillRect(sx + 17, sy + 1, 6, 2);
      ctx.fillStyle = '#3aae5a'; ctx.fillRect(sx + 17, sy + 3, 6, 2);
      ctx.fillStyle = '#c83030'; ctx.fillRect(sx + 17, sy + 5, 6, 2);
    } else if (t === T.GATES) {
      rect(sx, sy, TILE, TILE, '#c8a878');
      rect(sx + 4, sy + 6, 24, 26, '#dab070');
      rect(sx + 11, sy + 14, 10, 18, '#3a2a1a');
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.arc(sx + 16, sy + 14, 5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 14, sy + 4, 4, 5);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 15, sy + 6, 2, 2);
    } else if (t === T.ANNE) {
      rect(sx, sy, TILE, TILE, '#c8a878');
      rect(sx + 6, sy + 14, 20, 18, '#a04030');
      ctx.fillStyle = '#702030';
      ctx.beginPath();
      ctx.moveTo(sx + 13, sy + 14); ctx.lineTo(sx + 16, sy);     ctx.lineTo(sx + 19, sy + 14); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx + 6,  sy + 14); ctx.lineTo(sx + 9,  sy + 4); ctx.lineTo(sx + 12, sy + 14); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx + 20, sy + 14); ctx.lineTo(sx + 23, sy + 4); ctx.lineTo(sx + 26, sy + 14); ctx.fill();
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 15, sy - 1, 2, 4);
      ctx.fillRect(sx + 14, sy + 1, 4, 1);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 14, sy + 22, 4, 10);
    } else if (t === T.CATHEDRAL) {
      // 大聖堂（クリーム色の壁＋3つの大きなアーチ窓＋頂上ドーム＆十字）
      rect(sx, sy, TILE, TILE, '#e8e0d0');
      // 屋根（暗茶の帯）
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(sx, sy + 8, TILE, 3);
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(sx, sy + 11, TILE, 1);
      // 中央のドーム
      ctx.fillStyle = '#c8a070';
      ctx.beginPath();
      ctx.arc(sx + 16, sy + 8, 6, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#a87850';
      ctx.fillRect(sx + 11, sy + 7, 10, 1);
      // 十字
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 15, sy - 2, 2, 6);
      ctx.fillRect(sx + 13, sy + 1, 6, 2);
      // 列柱風の縦溝＋アーチ窓
      const archCols = ['#c8c0a8', '#c8c0a8', '#c8c0a8'];
      for (let i = 0; i < 3; i++) {
        const wx = sx + 4 + i * 9;
        // 柱
        ctx.fillStyle = archCols[i];
        ctx.fillRect(wx, sy + 12, 5, TILE - 16);
        // アーチ窓（青）
        ctx.fillStyle = '#3a4a8e';
        ctx.fillRect(wx + 1, sy + 16, 3, 10);
        ctx.beginPath();
        ctx.arc(wx + 2.5, sy + 16, 1.5, Math.PI, 0);
        ctx.fill();
        // 窓の枠
        ctx.fillStyle = '#dac030';
        ctx.fillRect(wx + 2, sy + 18, 1, 6);
      }
      // 段差（土台）
      ctx.fillStyle = '#a89878';
      ctx.fillRect(sx, sy + TILE - 3, TILE, 3);
      ctx.fillStyle = '#888070';
      ctx.fillRect(sx, sy + TILE - 1, TILE, 1);
    } else if (t === T.INN) {
      // 宿屋（赤い三角屋根＋黄色の窓＋大きなベッド看板）
      rect(sx, sy, TILE, TILE, '#c8a878');  // 壁色
      // 三角屋根
      ctx.fillStyle = '#aa2828';
      for (let y = 0; y < 10; y++) {
        const w = 32 - y * 2;
        ctx.fillRect(sx + y, sy + y, w, 1);
      }
      // 屋根のシェード
      ctx.fillStyle = '#7a1818';
      for (let y = 0; y < 10; y++) {
        ctx.fillRect(sx + y, sy + y, 1, 1);
        ctx.fillRect(sx + 32 - y - 1, sy + y, 1, 1);
      }
      // 棟瓦
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 14, sy, 4, 2);
      // 窓（黄色く灯る）2つ
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 4, sy + 14, 6, 6);
      ctx.fillRect(sx + 22, sy + 14, 6, 6);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 5, sy + 15, 4, 4);
      ctx.fillRect(sx + 23, sy + 15, 4, 4);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 7, sy + 14, 1, 6); // 縦さん
      ctx.fillRect(sx + 25, sy + 14, 1, 6);
      // ドア
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 12, sy + 22, 8, 10);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 18, sy + 27, 1, 2);
      // 看板（吊り下げ式・ベッド絵）
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 13, sy + 11, 6, 1);  // 吊り紐
      ctx.fillStyle = '#fff8e0';
      ctx.fillRect(sx + 11, sy + 12, 10, 8);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 11, sy + 12, 10, 1);
      ctx.fillRect(sx + 11, sy + 19, 10, 1);
      ctx.fillRect(sx + 11, sy + 12, 1, 8);
      ctx.fillRect(sx + 20, sy + 12, 1, 8);
      // ベッド絵
      ctx.fillStyle = '#3a4abe'; ctx.fillRect(sx + 12, sy + 16, 8, 2);
      ctx.fillStyle = '#fff';    ctx.fillRect(sx + 13, sy + 14, 3, 2);
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(sx + 12, sy + 18, 1, 2);
      ctx.fillRect(sx + 19, sy + 18, 1, 2);
    } else if (t === T.AKHALL) {
      // AKクワイア集会所（青い三角屋根＋音符看板＋ステンドグラス窓）
      rect(sx, sy, TILE, TILE, '#c8a878');
      // 三角屋根（青）
      ctx.fillStyle = '#3a4abe';
      for (let y = 0; y < 10; y++) {
        const w = 32 - y * 2;
        ctx.fillRect(sx + y, sy + y, w, 1);
      }
      ctx.fillStyle = '#2a2a8e';
      for (let y = 0; y < 10; y++) {
        ctx.fillRect(sx + y, sy + y, 1, 1);
        ctx.fillRect(sx + 32 - y - 1, sy + y, 1, 1);
      }
      // 棟（金）
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 14, sy, 4, 2);
      // ステンドグラス丸窓（中央上）
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#dac030';
      ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 16, sy + 13, 1, 7);
      ctx.fillRect(sx + 13, sy + 16, 7, 1);
      // ドア
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 12, sy + 22, 8, 10);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 18, sy + 27, 1, 2);
      // 音符看板（左）
      ctx.fillStyle = '#fff8e0';
      ctx.fillRect(sx + 4, sy + 22, 6, 6);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 4, sy + 22, 6, 1);
      ctx.fillRect(sx + 4, sy + 27, 6, 1);
      ctx.fillRect(sx + 4, sy + 22, 1, 6);
      ctx.fillRect(sx + 9, sy + 22, 1, 6);
      // 音符
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 7, sy + 23, 1, 4);
      ctx.beginPath(); ctx.arc(sx + 6.5, sy + 27, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(sx + 7, sy + 23, 2, 1);
    } else if (t === T.BRIDGE) {
      // 縦に隣接するBRIDGEがあれば縦向き、無ければ横向きで描画
      let vertical = false;
      if (typeof mx === 'number' && typeof my === 'number') {
        const north = (my > 0) ? MAP[my - 1][mx] : -1;
        const south = (my < MAP_ROWS - 1) ? MAP[my + 1][mx] : -1;
        if (north === T.BRIDGE || south === T.BRIDGE) vertical = true;
      }
      rect(sx, sy, TILE, TILE, '#3a6abe');
      if (vertical) {
        // 縦向き桟橋（板が横方向に走る）
        rect(sx + 8, sy + 2, TILE - 16, TILE - 4, '#a88858');
        ctx.fillStyle = '#6a3a1a';
        for (let i = 0; i < 4; i++) ctx.fillRect(sx + 10, sy + 4 + i * 7, TILE - 20, 2);
      } else {
        // 横向き桟橋（板が縦方向に走る）
        rect(sx + 2, sy + 8, TILE - 4, TILE - 16, '#a88858');
        ctx.fillStyle = '#6a3a1a';
        for (let i = 0; i < 4; i++) ctx.fillRect(sx + 4 + i * 7, sy + 10, 2, TILE - 20);
      }
    } else if (t === T.RESTAURANT) {
      // 料理屋（緑の三角屋根＋ナイフ&フォーク看板＋湯気の窓）
      rect(sx, sy, TILE, TILE, '#c8a878');
      // 三角屋根（緑）
      ctx.fillStyle = '#3a8a4a';
      for (let y = 0; y < 10; y++) {
        const w = 32 - y * 2;
        ctx.fillRect(sx + y, sy + y, w, 1);
      }
      ctx.fillStyle = '#1a5a2a';
      for (let y = 0; y < 10; y++) {
        ctx.fillRect(sx + y, sy + y, 1, 1);
        ctx.fillRect(sx + 32 - y - 1, sy + y, 1, 1);
      }
      // 棟（鶏のシルエット）
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 15, sy, 2, 3);
      // 窓（湯気が出てる感じ。明るい色）
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 4, sy + 14, 6, 6);
      ctx.fillStyle = '#ffaa50';
      ctx.fillRect(sx + 5, sy + 15, 4, 4);
      // 湯気
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(sx + 5, sy + 12, 2, 2);
      ctx.fillRect(sx + 8, sy + 11, 2, 2);
      ctx.fillRect(sx + 6, sy + 10, 2, 2);
      // ドア
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 12, sy + 22, 8, 10);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 18, sy + 27, 1, 2);
      // 看板（吊り下げ・大）
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 16, sy + 11, 6, 1);
      ctx.fillStyle = '#fff8e0';
      ctx.fillRect(sx + 18, sy + 12, 10, 8);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 18, sy + 12, 10, 1);
      ctx.fillRect(sx + 18, sy + 19, 10, 1);
      ctx.fillRect(sx + 18, sy + 12, 1, 8);
      ctx.fillRect(sx + 27, sy + 12, 1, 8);
      // ナイフ
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(sx + 20, sy + 13, 1, 4);
      ctx.fillRect(sx + 19, sy + 13, 3, 1);
      ctx.fillStyle = '#7a4a2a';
      ctx.fillRect(sx + 20, sy + 17, 1, 2);
      // フォーク
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(sx + 25, sy + 13, 1, 4);
      ctx.fillRect(sx + 24, sy + 13, 1, 2);
      ctx.fillRect(sx + 26, sy + 13, 1, 2);
      ctx.fillStyle = '#7a4a2a';
      ctx.fillRect(sx + 25, sy + 17, 1, 2);
    } else if (t === T.SHOP) {
      // 雑貨屋（縞模様の天幕＋金貨看板＋商品の置かれた窓台）
      rect(sx, sy, TILE, TILE, '#c8a878');
      // 屋根（黄＋赤の縞天幕）
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = (i % 2 === 0) ? '#dac030' : '#c83030';
        ctx.fillRect(sx + i * 4, sy, 4, 8);
      }
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx, sy + 8, TILE, 2);
      // 天幕の波打ち
      ctx.fillStyle = '#3a2a1a';
      for (let i = 0; i < 8; i++) ctx.fillRect(sx + i * 4 + 1, sy + 7, 2, 1);
      // 窓台（商品が並ぶ）
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 4, sy + 12, 14, 8);
      ctx.fillStyle = '#dab070';
      ctx.fillRect(sx + 4, sy + 18, 14, 2); // カウンター
      // 商品（壺と布）
      ctx.fillStyle = '#aa6020';
      ctx.fillRect(sx + 6, sy + 14, 3, 4);
      ctx.fillStyle = '#3a8abe';
      ctx.fillRect(sx + 11, sy + 13, 4, 5);
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx + 12, sy + 14, 2, 1);
      // ドア
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 22, sy + 14, 8, 18);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 28, sy + 22, 1, 2);
      // 金貨看板（吊り下げ）
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 21, sy + 10, 1, 4);
      ctx.fillStyle = '#dac030';
      ctx.beginPath(); ctx.arc(sx + 21, sy + 16, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a6a10';
      ctx.font = 'bold 5px sans-serif';
      ctx.fillText('G', sx + 19, sy + 18);
    } else if (t === T.TOWNHALL) {
      // 旧市庁舎（白壁＋大きな三角ペディメント＋中央の柱＋屋根上の三色旗）
      rect(sx, sy, TILE, TILE, '#e8e0d0');
      // 三角ペディメント（屋根の三角）
      ctx.fillStyle = '#a89878';
      for (let y = 0; y < 8; y++) {
        const w = (8 - y) * 2;
        ctx.fillRect(sx + 16 - (8 - y), sy + y, w, 1);
      }
      ctx.fillStyle = '#888070';
      ctx.fillRect(sx + 8, sy + 8, 16, 2);
      // 旗ポール＋三色旗
      ctx.fillStyle = '#6a3a1a';
      ctx.fillRect(sx + 15, sy - 4, 2, 6);
      ctx.fillStyle = '#dac030'; ctx.fillRect(sx + 17, sy - 3, 8, 2);
      ctx.fillStyle = '#3aae5a'; ctx.fillRect(sx + 17, sy - 1, 8, 2);
      ctx.fillStyle = '#c83030'; ctx.fillRect(sx + 17, sy + 1, 8, 2);
      // 列柱（4本）
      ctx.fillStyle = '#a89878';
      for (let i = 0; i < 4; i++) {
        const cx = sx + 4 + i * 7;
        ctx.fillRect(cx, sy + 12, 3, 16);
      }
      // 柱の影
      ctx.fillStyle = '#3a2a1a';
      for (let i = 0; i < 4; i++) {
        const cx = sx + 4 + i * 7;
        ctx.fillRect(cx + 3, sy + 12, 1, 16);
      }
      // 大きな中央扉
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 12, sy + 16, 8, 14);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 18, sy + 23, 1, 2);
      // 段差
      ctx.fillStyle = '#a89878';
      ctx.fillRect(sx, sy + 28, TILE, 4);
      ctx.fillStyle = '#888070';
      ctx.fillRect(sx, sy + 28, TILE, 1);
    } else if (t === T.BERNARDINE) {
      // ベルナルディン教会（赤レンガ・聖アンナの隣・大柄の単塔）
      rect(sx, sy, TILE, TILE, '#c8a878');
      // 主壁
      rect(sx + 5, sy + 12, 22, 20, '#aa3838');
      // 屋根（赤煉瓦）
      ctx.fillStyle = '#7a2820';
      ctx.beginPath();
      ctx.moveTo(sx + 4, sy + 12); ctx.lineTo(sx + 16, sy + 2); ctx.lineTo(sx + 28, sy + 12);
      ctx.closePath(); ctx.fill();
      // 主塔（中央）
      rect(sx + 13, sy + 4, 6, 16, '#aa3838');
      ctx.fillStyle = '#7a2828';
      ctx.beginPath();
      ctx.moveTo(sx + 13, sy + 4); ctx.lineTo(sx + 16, sy - 2); ctx.lineTo(sx + 19, sy + 4);
      ctx.closePath(); ctx.fill();
      // 十字
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 15, sy - 4, 2, 5);
      ctx.fillRect(sx + 14, sy - 2, 4, 1);
      // アーチ窓3つ
      ctx.fillStyle = '#1a0a14';
      ctx.fillRect(sx + 8,  sy + 18, 3, 6);
      ctx.fillRect(sx + 14, sy + 18, 3, 6);
      ctx.fillRect(sx + 20, sy + 18, 3, 6);
      // 入口
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 13, sy + 26, 6, 6);
    } else if (t === T.VU) {
      // ヴィリニュス大学（薄黄の歴史的建造物・縦長の窓列＋アーケード）
      rect(sx, sy, TILE, TILE, '#dac0a0');
      ctx.fillStyle = '#a89070';
      ctx.fillRect(sx, sy, TILE, 2);
      ctx.fillRect(sx, sy + TILE - 2, TILE, 2);
      ctx.fillRect(sx, sy, 2, TILE);
      ctx.fillRect(sx + TILE - 2, sy, 2, TILE);
      // 屋根
      ctx.fillStyle = '#aa6a32';
      ctx.fillRect(sx, sy, TILE, 4);
      // 窓3列×2段
      ctx.fillStyle = '#3a2a1a';
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const wx = sx + 5 + c * 8;
          const wy = sy + 8 + r * 11;
          ctx.fillRect(wx, wy, 4, 7);
          ctx.fillStyle = '#aadaee';
          ctx.fillRect(wx + 1, wy + 1, 2, 5);
          ctx.fillStyle = '#3a2a1a';
        }
      }
      // 紋章看板
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 13, sy + 6, 6, 1);
    } else if (t === T.CROSSES) {
      // 三つの十字架（緑の丘の上に白い3本の十字）
      rect(sx, sy, TILE, TILE, '#6ea64a');
      // 丘
      ctx.fillStyle = '#3a6a2a';
      ctx.beginPath();
      ctx.moveTo(sx, sy + 28); ctx.lineTo(sx + 16, sy + 14); ctx.lineTo(sx + 32, sy + 28);
      ctx.lineTo(sx + 32, sy + 32); ctx.lineTo(sx, sy + 32);
      ctx.closePath(); ctx.fill();
      // 十字3本（白）
      ctx.fillStyle = '#f0f0f0';
      const drawCross = (cx, cy, h) => {
        ctx.fillRect(cx - 1, cy, 2, h);
        ctx.fillRect(cx - 3, cy + 2, 6, 2);
      };
      drawCross(sx + 16, sy + 4,  18); // 中央 高め
      drawCross(sx + 8,  sy + 8,  14); // 左 やや低め
      drawCross(sx + 24, sy + 8,  14); // 右
      // 影
      ctx.fillStyle = '#888070';
      ctx.fillRect(sx + 15, sy + 22, 1, 4);
      ctx.fillRect(sx + 7,  sy + 22, 1, 4);
      ctx.fillRect(sx + 23, sy + 22, 1, 4);
    } else if (t === T.PRESIDENT) {
      // 大統領官邸（白い宮殿・国旗付き）
      rect(sx, sy, TILE, TILE, '#f0e8d8');
      // 屋根
      ctx.fillStyle = '#888070';
      ctx.fillRect(sx, sy + 6, TILE, 2);
      // 列柱（細6本）
      ctx.fillStyle = '#dac0a0';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(sx + 3 + i * 5, sy + 10, 2, 16);
      }
      // 中央扉
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 14, sy + 18, 4, 10);
      // 段
      ctx.fillStyle = '#c0b8a0';
      ctx.fillRect(sx, sy + 26, TILE, 4);
      // 旗ポール＋三色旗
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(sx + 15, sy - 4, 1, 10);
      ctx.fillStyle = '#dac030'; ctx.fillRect(sx + 16, sy - 3, 6, 2);
      ctx.fillStyle = '#3aae5a'; ctx.fillRect(sx + 16, sy - 1, 6, 2);
      ctx.fillStyle = '#c83030'; ctx.fillRect(sx + 16, sy + 1, 6, 2);
    } else if (t === T.UZUPIS) {
      // ウジュピス共和国の橋（ボヘミアン地区のシンボル）
      rect(sx, sy, TILE, TILE, '#3a6abe');
      ctx.fillStyle = '#a88858';
      ctx.fillRect(sx + 2, sy + 12, 28, 8);
      // 欄干
      ctx.fillStyle = '#6a3a1a';
      ctx.fillRect(sx + 2, sy + 10, 28, 2);
      ctx.fillRect(sx + 2, sy + 20, 28, 2);
      // 看板（U）
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 14, sy + 4, 4, 4);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 15, sy + 5, 1, 2);
      ctx.fillRect(sx + 16, sy + 5, 1, 2);
      ctx.fillRect(sx + 15, sy + 7, 2, 1);
    } else if (t === T.PILIES) {
      // ピリエス通り（市場の屋台 — 通行可能）
      rect(sx, sy, TILE, TILE, '#c8a878'); // 石畳ベース
      ctx.fillStyle = '#a88858';
      ctx.fillRect(sx + 4, sy + 6, 3, 3);
      ctx.fillRect(sx + 22, sy + 22, 3, 3);
      // 屋台のテント（左右に）
      ctx.fillStyle = '#c83030';
      ctx.fillRect(sx + 1, sy + 10, 8, 5);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 1, sy + 12, 8, 1);
      // 棒
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(sx + 1, sy + 15, 1, 8);
      ctx.fillRect(sx + 8, sy + 15, 1, 8);
      // テント右
      ctx.fillStyle = '#3a8abe';
      ctx.fillRect(sx + 23, sy + 10, 8, 5);
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx + 23, sy + 12, 8, 1);
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(sx + 23, sy + 15, 1, 8);
      ctx.fillRect(sx + 30, sy + 15, 1, 8);
      // 商品（小さい点）
      ctx.fillStyle = '#aa6020';
      ctx.fillRect(sx + 3, sy + 16, 2, 2);
      ctx.fillStyle = '#3a8abe';
      ctx.fillRect(sx + 25, sy + 16, 2, 2);
    } else if (t === T.STATION) {
      // 鉄道駅（ホーム＋線路アイコン）
      rect(sx, sy, TILE, TILE, '#888070');
      // 駅舎部分（上半分）
      ctx.fillStyle = '#aa3030';
      ctx.fillRect(sx + 2, sy + 2, 28, 14);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 2, sy + 14, 28, 2);
      // 「駅」マーク
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx + 14, sy + 6, 4, 6);
      ctx.fillRect(sx + 11, sy + 8, 10, 2);
      // 線路（下半分）
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(sx, sy + 22, TILE, 2);
      ctx.fillRect(sx, sy + 28, TILE, 2);
      ctx.fillStyle = '#3a2a1a';
      for (let x = 0; x < TILE; x += 6) ctx.fillRect(sx + x, sy + 24, 3, 4);
    } else if (t === T.KAUNAS_CASTLE) {
      // カウナス城（赤煉瓦の塔）
      rect(sx, sy, TILE, TILE, '#3a5a3a');
      ctx.fillStyle = '#a85838';
      ctx.fillRect(sx + 6, sy + 8, 20, 22);
      // 銃眼
      ctx.fillStyle = '#a85838';
      ctx.fillRect(sx + 6, sy + 4, 4, 4);
      ctx.fillRect(sx + 14, sy + 4, 4, 4);
      ctx.fillRect(sx + 22, sy + 4, 4, 4);
      // 影
      ctx.fillStyle = '#7a3a20';
      ctx.fillRect(sx + 6, sy + 8, 2, 22);
      ctx.fillRect(sx + 24, sy + 8, 2, 22);
      // 窓
      ctx.fillStyle = '#1a0a14';
      ctx.fillRect(sx + 12, sy + 14, 4, 6);
      ctx.fillRect(sx + 18, sy + 14, 4, 6);
      // 旗
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 16, sy + 0, 2, 6);
      ctx.fillStyle = '#c83030';
      ctx.fillRect(sx + 18, sy + 1, 6, 4);
    } else if (t === T.CIURLIONIS) {
      // チョルリョーニス美術館（白い新古典）
      rect(sx, sy, TILE, TILE, '#aaa090');
      ctx.fillStyle = '#f0e8d0';
      ctx.fillRect(sx + 2, sy + 6, 28, 24);
      ctx.fillStyle = '#a89070';
      ctx.fillRect(sx + 2, sy + 6, 28, 2);
      // ペディメント
      ctx.fillStyle = '#f0e8d0';
      ctx.beginPath();
      ctx.moveTo(sx + 2, sy + 6); ctx.lineTo(sx + 16, sy + 0); ctx.lineTo(sx + 30, sy + 6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a89070'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + 2, sy + 6); ctx.lineTo(sx + 16, sy + 0); ctx.lineTo(sx + 30, sy + 6); ctx.stroke();
      // 列柱
      ctx.fillStyle = '#fff8e0';
      ctx.fillRect(sx + 6, sy + 10, 3, 18);
      ctx.fillRect(sx + 12, sy + 10, 3, 18);
      ctx.fillRect(sx + 18, sy + 10, 3, 18);
      ctx.fillRect(sx + 24, sy + 10, 3, 18);
      // 扉
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 14, sy + 18, 4, 12);
    } else if (t === T.BOAT) {
      // 小舟（水面の上に浮かぶ漁船）
      rect(sx, sy, TILE, TILE, '#3a6abe');
      ctx.fillStyle = '#5a8ade';
      ctx.fillRect(sx + 4, sy + 4, 8, 2);
      ctx.fillRect(sx + 22, sy + 26, 6, 2);
      // 船体
      ctx.fillStyle = '#7a4a2a';
      ctx.beginPath();
      ctx.moveTo(sx + 4,  sy + 18);
      ctx.lineTo(sx + 28, sy + 18);
      ctx.lineTo(sx + 25, sy + 26);
      ctx.lineTo(sx + 7,  sy + 26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(sx + 4,  sy + 18, 24, 2);
      // 帆柱と帆
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 15, sy + 4, 2, 14);
      ctx.fillStyle = '#f0e0c0';
      ctx.beginPath();
      ctx.moveTo(sx + 17, sy + 6);
      ctx.lineTo(sx + 26, sy + 16);
      ctx.lineTo(sx + 17, sy + 16);
      ctx.closePath();
      ctx.fill();
    } else if (t === T.SCULPTURE) {
      // 木彫り彫刻（魔女の丘）— 砂地ベースに不気味な木の像
      rect(sx, sy, TILE, TILE, '#c8b890');
      // 砂のテクスチャ
      ctx.fillStyle = '#a89870';
      for (let i = 0; i < 6; i++) {
        const dx = (i * 11 + sy) % TILE;
        const dy = (i * 7  + sx) % TILE;
        ctx.fillRect(sx + dx, sy + dy, 2, 2);
      }
      // 台座
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(sx + 8, sy + 26, 16, 4);
      // 彫刻本体（ねじれた木）
      ctx.fillStyle = '#4a2a10';
      ctx.fillRect(sx + 13, sy + 4, 6, 22);
      ctx.fillStyle = '#6a4020';
      ctx.fillRect(sx + 11, sy + 6, 2, 18);
      ctx.fillRect(sx + 19, sy + 8, 2, 16);
      // 顔（窪み）
      ctx.fillStyle = '#1a0a04';
      ctx.fillRect(sx + 14, sy + 10, 2, 2);
      ctx.fillRect(sx + 17, sy + 10, 2, 2);
      ctx.fillRect(sx + 15, sy + 14, 2, 2);
    }
  }

  // 色ヘルパー
  function darken(hex, factor) {
    const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return hex;
    const r = Math.max(0, Math.min(255, Math.floor(parseInt(m[1], 16) * factor)));
    const g = Math.max(0, Math.min(255, Math.floor(parseInt(m[2], 16) * factor)));
    const b = Math.max(0, Math.min(255, Math.floor(parseInt(m[3], 16) * factor)));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function lighten(hex, factor) { return darken(hex, factor); } // factor>1で明るく

  // チビ風キャラ描画（32×48、頭身2、表情豊か・ジャケット衣装）
  // (sx, sy) = キャラクターボックスの左上
  function drawCharDetailed(c, sx, sy, dir, look) {
    const L = lookById(look);
    const O       = '#1a0a18';
    const skin    = L.skin;
    const skinD   = darken(L.skin, 0.86);
    const skinH   = lighten(L.skin, 1.06);
    const hair    = L.hair;
    const hairD   = darken(L.hair, 0.55);
    const hairH   = lighten(L.hair, 1.45);
    const cloth   = L.cloth;
    const clothD  = darken(L.cloth, 0.62);
    const clothH  = lighten(L.cloth, 1.30);
    const shirt   = '#fff8e0';
    const pants   = '#3a2820';
    const pantsD  = '#1a1008';
    const pantsH  = '#5a4030';
    const boot    = '#221408';
    const bootH   = '#5a3825';
    const belt    = '#3a2010';
    const buckle  = '#dac030';
    const buckleH = '#fff080';
    const eyeW    = '#ffffff';
    const eyeI    = '#3a2a6a';      // 虹彩（やや紫）
    const eyeP    = '#0a0410';      // 瞳
    const cheek   = 'rgba(255,140,170,0.75)';
    const mouthC  = '#a82a36';

    function r(x, y, w, h, col) { c.fillStyle = col; c.fillRect(sx + x, sy + y, w, h); }

    // 影（足元）
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(sx + 16, sy + 47, 9, 1.8, 0, 0, Math.PI * 2);
    c.fill();

    // ============ 頭部（y=0..21、幅18: x=7..25） ============
    // 頭部輪郭（角丸）
    r(11, 0, 10, 1, O);
    r(9,  1, 14, 1, O);
    r(7,  2, 18, 1, O);
    r(6,  3,  1, 17, O); r(25, 3, 1, 17, O);
    r(7,  20, 18, 1, O);
    r(9,  21, 14, 1, O);

    // 顔ベース（肌）
    r(11, 0, 10, 1, skin);
    r(9,  1, 14, 1, skin);
    r(7,  2, 18, 18, skin);
    r(9,  20, 14, 1, skin);
    r(11, 21, 10, 1, skinD);

    // 髪
    if (dir === 'up') {
      // 後ろ向き：頭頂の肌が出ないよう、最上段から髪で覆う
      r(11, 0, 10, 1, hair);
      r(9,  1, 14, 1, hair);
      r(7,  2, 18, 17, hair);
      r(7,  19, 18, 1, hairD);
      r(9,  4, 7, 1, hairH);
      r(17, 4, 6, 1, hairH);
    } else {
      // 頭頂部（前髪より上）
      r(11, 0, 10, 1, hair);
      r(9,  1, 14, 1, hair);
      r(7,  2, 18, 1, hair);
      r(7,  3, 18, 6, hair);
      r(8,  3, 7, 1, hairH);
      r(17, 3, 6, 1, hairH);
      if (dir === 'left') {
        // 横向き（左）：後頭部（右側）にボリューム、前髪は薄め
        r(7,  9, 3, 1, hair);
        r(11, 9, 1, 1, hair);
        r(15, 9, 10, 1, hair);
        r(16, 10, 9, 1, hair);
        r(7,  10, 1, 6, hair);   // 左サイド（前）
        r(23, 10, 2, 6, hair);   // 右サイド（後ろ）— 厚め
      } else if (dir === 'right') {
        // 横向き（右）：左右反転
        r(22, 9, 3, 1, hair);
        r(20, 9, 1, 1, hair);
        r(7,  9, 10, 1, hair);
        r(7,  10, 9, 1, hair);
        r(7,  10, 2, 6, hair);   // 左サイド（後ろ）— 厚め
        r(24, 10, 1, 6, hair);   // 右サイド（前）
      } else {
        // 正面（dir === 'down'）：従来の不揃い前髪
        r(7,  9, 3, 1, hair);
        r(10, 9, 1, 2, hair);
        r(11, 10, 1, 1, hair);
        r(13, 9, 2, 1, hair);
        r(14, 8, 1, 1, hair);
        r(17, 9, 2, 1, hair);
        r(18, 8, 1, 1, hair);
        r(20, 10, 1, 1, hair);
        r(21, 9, 1, 1, hair);
        r(22, 9, 3, 1, hair);
        // サイドバング
        r(7,  10, 1, 6, hair);
        r(24, 10, 1, 6, hair);
      }
    }

    // 長髪・ポニー
    if (L.longHair && dir !== 'up') {
      r(5, 6, 1, 18, O);  r(26, 6, 1, 18, O);
      r(6, 6, 1, 18, hair); r(25, 6, 1, 18, hair);
      r(6, 24, 20, 1, hair);
      r(7, 25, 18, 1, hairD);
    } else if (L.ponytail && dir === 'down') {
      r(25, 4, 2, 1, O); r(27, 5, 1, 12, O); r(26, 17, 1, 1, O);
      r(25, 5, 2, 12, hair);
      r(26, 16, 1, 1, hairD);
    }

    // ============ 目（5x5、白目+虹彩+瞳+ハイライト） ============
    function eyeAt(x0, y0) {
      r(x0,    y0,    5, 5, O);
      r(x0+1,  y0+1,  3, 3, eyeW);
      r(x0+1,  y0+2,  3, 2, eyeI);
      r(x0+2,  y0+2,  1, 2, eyeP);
      r(x0+1,  y0+1,  1, 1, eyeW);
      r(x0+3,  y0+3,  1, 1, eyeW);
    }

    if (dir === 'down') {
      eyeAt(9,  13);
      eyeAt(18, 13);
      // 眉
      r(10, 11, 3, 1, hairD);
      r(19, 11, 3, 1, hairD);
    } else if (dir === 'left') {
      eyeAt(9, 13);
      r(10, 11, 3, 1, hairD);
    } else if (dir === 'right') {
      eyeAt(18, 13);
      r(19, 11, 3, 1, hairD);
    }

    // ============ 口（小さく可愛い） ============
    if (dir === 'down') {
      r(15, 18, 2, 1, mouthC);
    } else if (dir === 'left') {
      r(11, 18, 2, 1, mouthC);
    } else if (dir === 'right') {
      r(19, 18, 2, 1, mouthC);
    }

    // ============ 頬の赤み ============
    if (dir === 'down') {
      c.fillStyle = cheek;
      c.fillRect(sx + 8,  sy + 17, 2, 2);
      c.fillRect(sx + 22, sy + 17, 2, 2);
    } else if (dir === 'left') {
      c.fillStyle = cheek;
      c.fillRect(sx + 8, sy + 17, 2, 2);
    } else if (dir === 'right') {
      c.fillStyle = cheek;
      c.fillRect(sx + 22, sy + 17, 2, 2);
    }

    // ============ ヒゲ（チョルリョーニス用） ============
    if (L.beard && dir !== 'up') {
      // ヒゲは髪色をやや濃くしたものを使う（白髪のときは銀色のヒゲ、黒髪のときは濃いヒゲ）
      const bd = darken(L.hair, 0.78);
      if (dir === 'down') {
        // 口下〜あごのフルベアード
        r(13, 19, 6, 1, bd);
        r(12, 20, 8, 2, bd);
        r(11, 21, 10, 1, bd);
        // 口を覆う
        r(15, 18, 2, 1, bd);
      } else if (dir === 'left') {
        r(11, 19, 5, 1, bd);
        r(10, 20, 6, 2, bd);
        r(11, 18, 2, 1, bd);
      } else if (dir === 'right') {
        r(16, 19, 5, 1, bd);
        r(16, 20, 6, 2, bd);
        r(19, 18, 2, 1, bd);
      }
    }

    // ============ 眼鏡 ============
    if (L.glasses && dir === 'down') {
      r(9,  13, 5, 1, O); r(9,  17, 5, 1, O);
      r(9,  13, 1, 5, O); r(13, 13, 1, 5, O);
      r(18, 13, 5, 1, O); r(18, 17, 5, 1, O);
      r(18, 13, 1, 5, O); r(22, 13, 1, 5, O);
      r(14, 15, 4, 1, O);
      c.fillStyle = 'rgba(168,208,255,0.5)';
      c.fillRect(sx + 10, sy + 14, 3, 1);
      c.fillRect(sx + 19, sy + 14, 3, 1);
    }

    // ============ 首（y=22..23） ============
    r(13, 22, 6, 1, O);
    r(14, 23, 4, 1, skin);
    r(13, 23, 1, 1, O); r(18, 23, 1, 1, O);

    // ============ 胴体／ジャケット（y=24..40） ============
    r(7,  24, 18, 1, O);
    r(6,  25, 1, 15, O); r(25, 25, 1, 15, O);
    r(7,  40, 18, 1, O);
    // ジャケット本体
    r(7, 25, 18, 15, cloth);
    // ハイライト（左肩〜胸）
    r(8,  25, 6, 1, clothH);
    r(7,  25, 1, 9, clothH);
    // 影（右側下）
    r(24, 25, 1, 15, clothD);
    r(7,  39, 18, 1, clothD);
    if (dir === 'left' || dir === 'right') {
      // 横向き：襟・ボタンは顔側にオフセット、ラペルは前側だけ表示
      const dx = (dir === 'left') ? -3 : 3;
      const cx = 15 + dx;
      // 前側のラペルのみ
      if (dir === 'left') {
        r(8,  25, 4, 1, clothD);
        r(9,  26, 3, 6, clothD);
      } else {
        r(20, 25, 4, 1, clothD);
        r(20, 26, 3, 6, clothD);
      }
      // 襟（V字ではなく、顔側に寄せた縦のV型）
      r(cx - 2, 25, 5, 1, O);
      r(cx - 1, 25, 3, 1, shirt);
      r(cx - 2, 26, 1, 3, O);
      r(cx + 2, 26, 1, 3, O);
      r(cx - 1, 26, 3, 2, shirt);
      r(cx,     28, 1, 1, shirt);
      r(cx,     29, 1, 1, O);
      // ボタン（顔側にオフセット）
      r(cx, 31, 2, 2, buckle); r(cx, 31, 1, 1, buckleH);
      r(cx, 35, 2, 2, buckle); r(cx, 35, 1, 1, buckleH);
      // ベルト
      r(7, 38, 18, 2, belt);
      // バックル（顔側に）
      r(cx - 1, 38, 4, 2, buckle);
      r(cx,     38, 1, 1, buckleH);
    } else {
      // ラペル（左右の折り返し）
      r(8,  25, 4, 1, clothD);
      r(20, 25, 4, 1, clothD);
      r(9,  26, 3, 6, clothD);
      r(20, 26, 3, 6, clothD);
      // V字シャツ（白）
      r(13, 25, 6, 1, O);
      r(14, 25, 4, 1, shirt);
      r(13, 26, 1, 3, O); r(18, 26, 1, 3, O);
      r(14, 26, 4, 2, shirt);
      r(15, 28, 2, 1, shirt);
      r(15, 29, 2, 1, O);                 // V字の谷
      // ボタン（金色）
      r(15, 31, 2, 2, buckle); r(15, 31, 1, 1, buckleH);
      r(15, 35, 2, 2, buckle); r(15, 35, 1, 1, buckleH);
      // ベルト
      r(7, 38, 18, 2, belt);
      // バックル
      r(14, 38, 4, 2, buckle);
      r(15, 38, 1, 1, buckleH);
    }

    // ============ 腕（y=25..37） ============
    // 左腕
    r(5,  25, 1, 12, O);
    r(6,  25, 1, 11, cloth);
    r(6,  35, 1, 1, clothD);
    r(5,  36, 3, 1, O);
    r(5,  36, 3, 2, skin);
    r(5,  37, 1, 1, skinD); r(7, 37, 1, 1, skinD);
    // 右腕
    r(26, 25, 1, 12, O);
    r(25, 25, 1, 11, cloth);
    r(25, 35, 1, 1, clothD);
    r(24, 36, 3, 1, O);
    r(24, 36, 3, 2, skin);
    r(24, 37, 1, 1, skinD); r(26, 37, 1, 1, skinD);

    // ============ 脚／ズボン（y=41..46） ============
    // 左脚
    r(11, 41, 1, 5, O); r(15, 41, 1, 5, O);
    r(12, 41, 3, 5, pants);
    r(12, 41, 1, 5, pantsH);
    r(14, 45, 1, 1, pantsD);
    // 右脚
    r(16, 41, 1, 5, O); r(20, 41, 1, 5, O);
    r(17, 41, 3, 5, pants);
    r(17, 41, 1, 5, pantsH);
    r(19, 45, 1, 1, pantsD);

    // ============ 靴（y=46..47） ============
    r(10, 46, 6, 1, O);
    r(10, 47, 1, 1, O); r(15, 47, 1, 1, O);
    r(11, 46, 4, 1, boot);
    r(11, 47, 4, 1, bootH);

    r(16, 46, 6, 1, O);
    r(16, 47, 1, 1, O); r(21, 47, 1, 1, O);
    r(17, 46, 4, 1, boot);
    r(17, 47, 4, 1, bootH);

    // ============ 蝶ネクタイ（チョルリョーニス用） ============
    if (L.bowtie && dir !== 'up') {
      // スーツが明るい色のときは濃紺、暗い色のときは黒で目立たせる
      const bw = '#3a2a5a';
      const bwH = '#6a5a8a';
      if (dir === 'down') {
        r(13, 25, 6, 3, bw);
        r(15, 25, 2, 3, bwH); // 中央結び目（ややハイライト）
        r(14, 26, 4, 1, bwH);
      } else if (dir === 'left') {
        r(11, 25, 4, 3, bw);
        r(13, 26, 1, 1, bwH);
      } else if (dir === 'right') {
        r(17, 25, 4, 3, bw);
        r(18, 26, 1, 1, bwH);
      }
    }

    // ============ 着物（ユウコヤマサキ用：襟を交差・帯） ============
    if (L.kimono && dir !== 'up') {
      const kim = L.cloth;        // 着物地（赤系）
      const kimD = darken(kim, 0.55);
      const obi = '#dac030';      // 帯（金色）
      const obiD = darken(obi, 0.55);
      const inner = '#fff8e0';    // 白い襦袢
      // 上半身を着物色で塗り直す（ジャケットを上書き）
      r(7, 25, 18, 13, kim);
      r(7, 25, 18, 1, kimD);
      r(7, 37, 18, 1, kimD);
      r(7, 25, 1, 13, kimD); r(24, 25, 1, 13, kimD);
      if (dir === 'down') {
        // 襟（左前を上に重ねる：右側が上）
        r(13, 25, 1, 6, inner);
        r(14, 26, 1, 5, inner);
        r(15, 27, 1, 4, inner);
        r(16, 28, 1, 3, inner);
        r(17, 29, 1, 2, inner);
        r(18, 30, 1, 1, inner);
        // 襟の縁取り
        r(12, 25, 1, 7, kimD);
        r(13, 26, 1, 1, kimD); r(14, 27, 1, 1, kimD);
        r(15, 28, 1, 1, kimD); r(16, 29, 1, 1, kimD);
        r(17, 30, 1, 1, kimD); r(18, 31, 1, 1, kimD);
      } else if (dir === 'left') {
        r(11, 25, 1, 6, inner);
        r(12, 26, 1, 5, inner);
        r(13, 27, 1, 4, inner);
      } else if (dir === 'right') {
        r(20, 25, 1, 6, inner);
        r(19, 26, 1, 5, inner);
        r(18, 27, 1, 4, inner);
      }
      // 帯（広め）
      r(7, 33, 18, 5, obi);
      r(7, 33, 18, 1, obiD);
      r(7, 37, 18, 1, obiD);
      // スカート部分（着物の裾が脚を覆う）
      r(11, 41, 10, 5, kim);
      r(11, 41, 1, 5, kimD); r(20, 41, 1, 5, kimD);
      r(11, 45, 10, 1, kimD);
      // 草履（黒鼻緒）
      r(11, 46, 4, 1, '#2a1810'); r(11, 47, 4, 1, '#1a0a08');
      r(17, 46, 4, 1, '#2a1810'); r(17, 47, 4, 1, '#1a0a08');
    }

    // ============ ドレス（ヴィクトリア=白／ギンターレ=深色：L.cloth から色を取る） ============
    if (L.dress && dir !== 'up') {
      const dr = L.cloth || '#f8f0e0';
      const drD = darken(dr, 0.78);
      const drH = lighten(dr, 1.12);
      const trim = '#dac030';      // 金縁
      // 上半身を白で塗り直す
      r(7, 25, 18, 13, dr);
      r(7, 25, 18, 1, drD);
      r(7, 37, 18, 1, drD);
      r(7, 25, 1, 13, drD); r(24, 25, 1, 13, drH);
      if (dir === 'down') {
        // 胸元V字（深め）
        r(13, 25, 6, 1, O);
        r(13, 26, 1, 4, O); r(18, 26, 1, 4, O);
        r(14, 26, 4, 4, skin);
        r(14, 30, 1, 1, O); r(17, 30, 1, 1, O);
        r(15, 30, 2, 1, skin);
        r(15, 31, 2, 1, O);
        // 金の細い装飾線（ウエスト）
        r(7, 35, 18, 1, trim);
      } else {
        r(7, 35, 18, 1, trim);
      }
      // スカート（裾広がり、y=41..47を上書き）
      // 上から段階的に広がる
      r(10, 41, 12, 1, dr); r(10, 41, 1, 1, drD); r(21, 41, 1, 1, drD);
      r(9,  42, 14, 1, dr); r(9,  42, 1, 1, drD); r(22, 42, 1, 1, drD);
      r(8,  43, 16, 1, dr); r(8,  43, 1, 1, drD); r(23, 43, 1, 1, drD);
      r(7,  44, 18, 1, dr); r(7,  44, 1, 1, drD); r(24, 44, 1, 1, drD);
      r(6,  45, 20, 1, dr); r(6,  45, 1, 1, drD); r(25, 45, 1, 1, drD);
      r(5,  46, 22, 1, dr); r(5,  46, 1, 1, drD); r(26, 46, 1, 1, drD);
      r(5,  47, 22, 1, drD);
      // 金の縁（裾）
      r(6, 47, 20, 1, trim);
    }
  }

  // 呼び出し側はタイル左上(sx, sy)を渡す。キャラは32×48なので頭が上にはみ出し、足元がタイル下端に揃う。
  function drawChar(sx, sy, dir, look) { drawCharDetailed(ctx, sx, sy + TILE - CHAR_H, dir, look); }

  function getEnemyExpr() {
    if (!state.enemy) return 'normal';
    const r = state.enemy.hp / state.enemy.maxHp;
    if (r <= 0.25) return 'crying';
    if (r <= 0.55) return 'angry';
    return 'normal';
  }

  function drawEnemy(sx, sy, type, expr) {
    expr = expr || 'normal';
    const O = '#1a0a18';
    function r(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(sx + x, sy + y, w, h); }
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(sx + 60, sy + 122, 36, 5, 0, 0, Math.PI * 2); ctx.fill();

    if (type === 'guardian') {
      // 塔の番人（騎士・スマート比＝5頭身相当）
      const armor = '#6a7a88', armorD = '#3a4a58', armorH = '#aabac8';
      const cape  = '#9a2030', capeD = '#5a1018', capeH = '#bb3040';
      const skin  = '#e8b48a', skinD = '#b07c5a';
      const beard = '#2a1810', beardH = '#4a3020';
      const gold  = '#dac030';

      // ============ マント（背面・肩から足元まで） ============
      r(20, 44, 80, 68, capeD);
      r(22, 44, 76, 64, cape);
      r(22, 44, 76, 3, capeH);
      r(22, 100, 76, 8, capeD);
      r(60, 46, 1, 60, capeD); // 中央の縫い目

      // ============ 兜（頭部・32×32 スマート比） ============
      // プラム（赤い飾り房）
      r(58, 0, 4, 4, gold);
      r(54, 2, 4, 4, '#aa3030'); r(62, 2, 4, 4, '#aa3030');
      r(56, 0, 8, 2, O);
      // 兜輪郭
      r(46, 4, 28, 2, O);
      r(44, 6, 32, 2, O);
      r(42, 8, 36, 2, O);
      r(42, 10, 2, 18, O); r(76, 10, 2, 18, O);
      r(44, 10, 32, 16, armor);
      r(44, 10, 32, 4, armorH);
      r(44, 22, 32, 2, armorD);
      r(42, 26, 36, 2, O);

      // ============ 顔（兜の下から覗く） ============
      r(46, 28, 28, 12, skin);
      r(44, 28, 2, 12, O); r(74, 28, 2, 12, O);
      r(46, 38, 28, 2, skinD);
      r(44, 40, 32, 2, O);
      // 鼻
      r(58, 30, 4, 4, skinD);
      // 目
      if (expr === 'crying') {
        r(48, 28, 6, 2, '#fff'); r(66, 28, 6, 2, '#fff');
        r(49, 29, 4, 1, '#1a1a3a'); r(67, 29, 4, 1, '#1a1a3a');
        r(50, 32, 3, 8, '#5aaee8'); r(68, 32, 3, 8, '#5aaee8');
      } else if (expr === 'angry') {
        r(46, 26, 10, 2, beard);
        r(64, 26, 10, 2, beard);
        r(48, 30, 6, 2, '#3a1010'); r(66, 30, 6, 2, '#3a1010');
      } else {
        r(48, 30, 6, 2, '#1a1a2a'); r(66, 30, 6, 2, '#1a1a2a');
        r(49, 30, 2, 1, '#3a3a4a'); r(67, 30, 2, 1, '#3a3a4a');
      }
      // 髭（頬から顎、口を含む）
      r(46, 34, 28, 6, beard);
      r(48, 34, 24, 1, beardH);
      r(54, 36, 12, 1, '#3a1818');

      // ============ 首 ============
      r(54, 42, 12, 4, skin);
      r(52, 42, 2, 4, O); r(66, 42, 2, 4, O);

      // ============ 肩当て（広い騎士シルエット） ============
      r(28, 46, 14, 10, O);
      r(30, 46, 12, 10, armor);
      r(30, 46, 12, 3, armorH); r(30, 53, 12, 3, armorD);
      r(78, 46, 14, 10, O);
      r(80, 46, 12, 10, armor);
      r(80, 46, 12, 3, armorH); r(80, 53, 12, 3, armorD);

      // ============ 胸鎧（40w x 38h） ============
      r(40, 46, 40, 38, armor);
      r(40, 46, 40, 4, armorH);
      r(40, 80, 40, 4, armorD);
      r(38, 46, 2, 38, O); r(80, 46, 2, 38, O);
      r(38, 84, 44, 1, O);
      // 胸の紋章（黄色盾＋黒十字）
      r(52, 52, 16, 22, gold);
      r(50, 52, 2, 22, O); r(68, 52, 2, 22, O);
      r(52, 50, 16, 2, O); r(52, 74, 16, 2, O);
      r(58, 56, 4, 14, O);
      r(54, 62, 12, 2, O);

      // ============ 腕（細長く） ============
      r(30, 56, 12, 28, armor);
      r(28, 56, 2, 28, O); r(42, 56, 2, 28, O);
      r(30, 56, 12, 3, armorH);
      r(78, 56, 12, 28, armor);
      r(76, 56, 2, 28, O); r(90, 56, 2, 28, O);
      r(78, 56, 12, 3, armorH);
      // ガントレット
      r(28, 80, 14, 6, O);
      r(30, 80, 12, 5, '#3a2820');
      r(78, 80, 14, 6, O);
      r(80, 80, 12, 5, '#3a2820');

      // ============ 腰の鎧スカート（タセット） ============
      r(40, 84, 40, 14, armorD);
      r(40, 84, 40, 1, O);
      r(42, 86, 12, 12, armor); r(56, 86, 8, 12, armor); r(66, 86, 12, 12, armor);
      r(54, 86, 2, 12, armorD); r(64, 86, 2, 12, armorD);
      r(42, 86, 12, 2, armorH); r(56, 86, 8, 2, armorH); r(66, 86, 12, 2, armorH);

      // ============ 脚（グリーブ） ============
      r(44, 98, 14, 18, armor);
      r(62, 98, 14, 18, armor);
      r(43, 98, 1, 18, O); r(58, 98, 1, 18, O);
      r(61, 98, 1, 18, O); r(76, 98, 1, 18, O);
      r(44, 98, 14, 3, armorH); r(62, 98, 14, 3, armorH);
      r(44, 113, 14, 3, armorD); r(62, 113, 14, 3, armorD);
      // ブーツ
      r(42, 116, 18, 4, O);
      r(60, 116, 18, 4, O);
      r(43, 117, 16, 2, '#1a0a08');
      r(61, 117, 16, 2, '#1a0a08');

      // ============ ハルバード（右側に長く立てる） ============
      r(98, 8, 4, 108, O);
      r(99, 8, 2, 108, '#7a4a20');
      r(88, 4, 24, 4, O);
      r(90, 8, 20, 8, '#aaaaaa');
      r(90, 8, 20, 2, '#dadada');
      r(108, 0, 6, 12, O);
      r(110, 2, 2, 8, '#dadada');
    } else if (type === 'witches_idols') {
      // 魔女の丘で動き出した木彫り像9本（後列4＋前列5、中央=魔女が最大）
      // クルシュー砂州 Juodkrantė の彫刻公園にある縦長トーテムポール風
      const woodL = '#a06840', woodM = '#7a4a28', woodD = '#3a2010', woodH = '#c08858';
      const paintR = '#9a3a30', paintG = '#3a6a4a', paintY = '#dac030';
      const bands = [paintR, paintG, paintY];

      // 9体の彫刻設定（各々頭の形・体彩色・表情バリエが異なる）
      // headStyle: horns / hat / crown / beard / hooded / pointy / plain / rough / witch_big
      // exprVar: 0..2 同じexpr内での個体差（眉の角度・涙量・目の細さなど）
      // 横に大きく広げて「囲まれている」圧迫感を出す
      const idols = [
        // ===== 後列4体（上方・小さめ・薄暗い・霧の奥） =====
        { cx: -20, topY: 22, w: 14, hh: 20, bh: 64, head: 'horns',  band: 0, exprVar: 1, back: true },
        { cx: 30,  topY: 16, w: 14, hh: 22, bh: 70, head: 'crown',  band: 1, exprVar: 2, back: true },
        { cx: 90,  topY: 18, w: 14, hh: 22, bh: 68, head: 'beard',  band: 2, exprVar: 0, back: true },
        { cx: 140, topY: 22, w: 14, hh: 20, bh: 64, head: 'plain',  band: 0, exprVar: 1, back: true },
        // ===== 前列5体（下方・大きめ・最前面・観るものを取り囲む） =====
        { cx: -40, topY: 42, w: 18, hh: 24, bh: 84, head: 'pointy', band: 1, exprVar: 2, back: false },
        { cx: 12,  topY: 36, w: 18, hh: 26, bh: 88, head: 'hat',    band: 2, exprVar: 0, back: false },
        { cx: 60,  topY: 22, w: 24, hh: 32, bh: 104, head: 'witch_big', band: 0, exprVar: 1, back: false },
        { cx: 108, topY: 36, w: 18, hh: 26, bh: 88, head: 'rough',  band: 1, exprVar: 2, back: false },
        { cx: 160, topY: 42, w: 18, hh: 24, bh: 84, head: 'hooded', band: 2, exprVar: 0, back: false },
      ];

      // ===== 不気味な森の床（彫刻の足元に長い影を落とす） =====
      // 下半分に黒い帯を置き、ところどころ濡れた土のテクスチャ
      ctx.fillStyle = 'rgba(20,10,20,0.55)';
      ctx.fillRect(sx - 50, sy + 124, 280, 30);
      ctx.fillStyle = 'rgba(40,20,30,0.4)';
      for (let k = 0; k < 14; k++) {
        ctx.fillRect(sx - 50 + k * 22, sy + 130 + (k % 3) * 4, 8, 2);
      }

      // 後列を先に描く（前列が手前に重なる）
      const drawOrder = idols.slice().sort((a, b) => (b.back ? 1 : 0) - (a.back ? 1 : 0));
      drawOrder.forEach(I => {
        const cx = I.cx, ty = I.topY, w = I.w, hh = I.hh, bh = I.bh;
        const isBack = I.back;
        // 後列は色を一段暗く（霧の奥のニュアンス）
        const wL = isBack ? woodM : woodL;
        const wM = isBack ? woodD : woodM;
        const wH = isBack ? woodM : woodH;

        // ===== 頭の上の装飾 =====
        if (I.head === 'horns') {
          r(cx - w/2 + 1, ty - 4, 2, 4, woodD);
          r(cx + w/2 - 3, ty - 4, 2, 4, woodD);
        } else if (I.head === 'hat') {
          r(cx - 1, ty - 8, 2, 4, woodD);
          r(cx - 4, ty - 4, 8, 4, woodD);
        } else if (I.head === 'witch_big') {
          // 三角の魔女帽子
          r(cx - 2, ty - 14, 4, 4, woodD);
          r(cx - 6, ty - 10, 12, 4, woodD);
          r(cx - 12, ty - 6, 24, 4, woodD);
          r(cx - 4, ty - 10, 8, 4, woodM);
          r(cx - 10, ty - 6, 20, 4, woodM);
          r(cx - 14, ty - 2, 28, 2, woodD);
        } else if (I.head === 'crown') {
          r(cx - w/2 + 2, ty - 4, w - 4, 2, '#dac030');
          r(cx - 3, ty - 6, 2, 2, '#dac030');
          r(cx + 1, ty - 6, 2, 2, '#dac030');
        } else if (I.head === 'pointy') {
          r(cx - 1, ty - 4, 2, 4, woodD);
        } else if (I.head === 'hooded') {
          r(cx - w/2 - 1, ty, w + 2, 4, woodD);
        }
        // beard / plain / rough は装飾なし

        // ===== 頭部 =====
        r(cx - w/2, ty, w, hh, woodD);
        r(cx - w/2 + 1, ty + 1, w - 2, hh - 2, wM);
        r(cx - w/2 + 1, ty + 1, w - 2, 2, wH);

        // ===== 目（exprとexprVarで微妙に違う） =====
        const eyeY = ty + Math.floor(hh * 0.4);
        const eyeXL = cx - Math.floor(w * 0.28);
        const eyeXR = cx + Math.floor(w * 0.18);
        if (expr === 'crying') {
          // 泣き：白目＋青い涙の量がexprVarで変わる
          const tearLen = 4 + I.exprVar * 2;
          r(eyeXL, eyeY, 2, 2, '#fff'); r(eyeXR, eyeY, 2, 2, '#fff');
          r(eyeXL, eyeY + 3, 1, tearLen, '#5aaee8');
          r(eyeXR + 1, eyeY + 3, 1, tearLen, '#5aaee8');
        } else if (expr === 'angry') {
          // 怒り：眉の角度・目の鋭さがexprVarで変わる
          if (I.exprVar === 0) {
            // 眉つり上がり
            r(eyeXL - 1, eyeY - 2, 4, 1, woodD);
            r(eyeXR, eyeY - 2, 4, 1, woodD);
          } else if (I.exprVar === 1) {
            // 八の字眉（ハの字）
            r(eyeXL, eyeY - 2, 3, 1, woodD); r(eyeXL - 1, eyeY - 1, 1, 1, woodD);
            r(eyeXR, eyeY - 2, 3, 1, woodD); r(eyeXR + 2, eyeY - 1, 1, 1, woodD);
          } else {
            // 太い直線眉
            r(eyeXL - 1, eyeY - 2, 5, 2, woodD);
            r(eyeXR - 1, eyeY - 2, 5, 2, woodD);
          }
          r(eyeXL, eyeY, 2, 2, '#3a1010');
          r(eyeXR, eyeY, 2, 2, '#3a1010');
        } else {
          // 通常：目の形がexprVarで違う（◎・点・細目）
          if (I.exprVar === 0) {
            r(eyeXL, eyeY, 2, 2, woodD);
            r(eyeXR, eyeY, 2, 2, woodD);
          } else if (I.exprVar === 1) {
            r(eyeXL, eyeY, 3, 3, woodD);
            r(eyeXL + 1, eyeY + 1, 1, 1, '#fff');
            r(eyeXR - 1, eyeY, 3, 3, woodD);
            r(eyeXR, eyeY + 1, 1, 1, '#fff');
          } else {
            // 細目
            r(eyeXL, eyeY + 1, 3, 1, woodD);
            r(eyeXR - 1, eyeY + 1, 3, 1, woodD);
          }
        }

        // ===== 口（exprVar違い） =====
        const mouthY = ty + Math.floor(hh * 0.72);
        if (expr === 'crying') {
          // への字
          r(cx - 2, mouthY, 4, 1, woodD);
          r(cx - 3, mouthY + 1, 1, 1, woodD);
          r(cx + 2, mouthY + 1, 1, 1, woodD);
        } else if (expr === 'angry') {
          // 開き口（叫び）/ 噛み締め / ニヤリ
          if (I.exprVar === 0) {
            r(cx - 3, mouthY, 6, 3, '#1a0808');
            r(cx - 2, mouthY + 1, 4, 1, '#3a1010');
          } else if (I.exprVar === 1) {
            r(cx - 3, mouthY, 6, 1, woodD);
          } else {
            r(cx - 3, mouthY, 4, 1, woodD);
            r(cx + 1, mouthY - 1, 2, 1, woodD);
          }
        } else {
          // 通常：◎口・横一文字・半笑い
          if (I.exprVar === 0) {
            r(cx - 1, mouthY, 2, 1, woodD);
          } else if (I.exprVar === 1) {
            r(cx - 2, mouthY, 4, 1, woodD);
          } else {
            r(cx - 2, mouthY, 4, 1, woodD);
            r(cx - 3, mouthY + 1, 6, 1, '#3a1818');
          }
        }

        // ===== ヒゲ（beard / rough のみ） =====
        if (I.head === 'beard') {
          r(cx - 3, mouthY + 2, 6, 4, '#cccccc');
          r(cx - 4, mouthY + 3, 8, 2, '#aaaaaa');
        } else if (I.head === 'rough') {
          r(cx - 3, mouthY + 2, 6, 2, woodD);
        }

        // ===== 体（樽型ポスト） =====
        const bodyY = ty + hh;
        r(cx - w/2 - 1, bodyY, w + 2, bh, woodD);
        r(cx - w/2, bodyY + 1, w, bh - 2, wL);
        r(cx - w/2, bodyY + 1, w, 2, wH);

        // 民族衣装の彩色帯（バンド開始色を個体ごとに変える）
        const bandColors = [bands[I.band % 3], bands[(I.band + 1) % 3], bands[(I.band + 2) % 3]];
        r(cx - w/2, bodyY + Math.floor(bh * 0.18), w, 3, bandColors[0]);
        r(cx - w/2, bodyY + Math.floor(bh * 0.45), w, 4, bandColors[1]);
        r(cx - w/2, bodyY + Math.floor(bh * 0.72), w, 3, bandColors[2]);

        // 木目（縦の溝）
        r(cx - Math.floor(w * 0.2), bodyY + 2, 1, bh - 4, woodD);
        r(cx + Math.floor(w * 0.2), bodyY + 2, 1, bh - 4, woodD);
      });
    } else if (type === 'victoria') {
      // 歌姫ヴィクトリア（華やかなロングドレス＋片手を上げて歌うポーズ）
      const skin = '#f4d0a8', skinD = '#c89070';
      const hair = '#3a1810', hairH = '#7a3018', hairD = '#1a0a08';
      const dress = '#aa1840', dressH = '#cc3060', dressD = '#5a0820';
      const gold = '#dac030', goldH = '#fff088';
      // 髪の流れ（後ろ髪・肩より下まで）
      r(38, 32, 4, 36, hair); r(78, 32, 4, 36, hair);
      r(36, 36, 4, 28, hairH); r(80, 36, 4, 28, hairH);
      // 頭（やや小さめ・スマート）
      r(46, 6, 28, 2, O);
      r(44, 8, 32, 2, hair);
      r(42, 10, 36, 4, hair);
      r(42, 14, 2, 24, O); r(76, 14, 2, 24, O);
      r(44, 14, 32, 24, skin);
      r(44, 36, 32, 2, skinD);
      r(44, 38, 32, 2, O);
      // 前髪・横髪
      r(44, 14, 32, 4, hair);
      r(48, 14, 6, 2, hairH);
      r(44, 14, 2, 14, hair);
      r(74, 14, 2, 14, hair);
      // ティアラ
      r(54, 8, 12, 2, gold);
      r(58, 6, 4, 2, goldH); r(56, 7, 2, 1, goldH); r(62, 7, 2, 1, goldH);
      // 目（華やか）
      if (expr === 'crying') {
        r(50, 22, 4, 1, hairD); r(66, 22, 4, 1, hairD);
        r(50, 25, 3, 8, '#5aaee8'); r(66, 25, 3, 8, '#5aaee8');
      } else if (expr === 'angry') {
        r(48, 20, 8, 2, hairD); r(64, 20, 8, 2, hairD);
        r(50, 24, 4, 3, hairD); r(66, 24, 4, 3, hairD);
      } else {
        r(50, 23, 4, 4, hairD); r(66, 23, 4, 4, hairD);
        r(51, 24, 2, 2, '#fff'); r(67, 24, 2, 2, '#fff');
        r(48, 21, 8, 1, hair); r(64, 21, 8, 1, hair); // まつ毛
      }
      // 鼻
      r(59, 27, 2, 4, skinD);
      // 口紅（赤）
      r(56, 33, 8, 2, dress);
      r(57, 34, 6, 1, '#3a0810');
      // 頬の赤み
      ctx.fillStyle = 'rgba(255,140,150,0.55)';
      ctx.fillRect(sx + 44, sy + 30, 4, 4); ctx.fillRect(sx + 72, sy + 30, 4, 4);
      // イヤリング
      r(40, 24, 2, 4, gold); r(78, 24, 2, 4, gold);
      // 首・ネックレス
      r(56, 40, 8, 4, skin);
      r(50, 46, 20, 2, gold); r(54, 48, 12, 2, goldH);
      // 上半身（オフショルダードレス）
      r(40, 48, 40, 2, skinD);   // デコルテ
      r(38, 50, 8, 32, dress);    // 左肩のドレスストラップ
      r(74, 50, 8, 32, dress);    // 右肩
      r(38, 50, 8, 2, dressH); r(74, 50, 8, 2, dressH);
      r(46, 56, 28, 28, dress);   // 胸〜ウエスト
      r(46, 56, 28, 4, dressH);
      r(46, 80, 28, 4, dressD);
      // 金のサッシュ
      r(44, 80, 32, 4, gold);
      r(44, 80, 32, 1, goldH);
      // ロングフレアドレス（裾広がり）
      r(42, 84, 36, 6, dress);
      r(40, 90, 40, 6, dress);
      r(38, 96, 44, 6, dress);
      r(36, 102, 48, 6, dress);
      r(34, 108, 52, 6, dress);
      r(32, 114, 56, 6, dressD);
      // ドレープのライン
      r(48, 86, 2, 32, dressH); r(70, 86, 2, 32, dressH);
      r(58, 86, 4, 32, dressD);
      // 左腕（腰に当てる）
      r(28, 50, 12, 4, dress);
      r(28, 50, 4, 32, dress);
      r(28, 50, 4, 2, dressH);
      r(26, 80, 8, 6, skin); r(26, 80, 8, 1, skinD);
      // 右腕（高く挙げる：歌唱ポーズ）
      r(80, 38, 4, 12, skin);     // 上腕（斜め上）
      r(82, 22, 4, 18, skin);     // 前腕
      r(80, 14, 8, 10, skin);     // 手のひら
      r(80, 14, 8, 1, skinD); r(80, 23, 8, 1, skinD);
    } else if (type === 'audience_30k') {
      // 3万人の観衆（リアル寄り・4段構成）
      // sx=130, CANVAS_W=384 → local x = -120〜+240 で画面ほぼ全域を使う

      // ====== 第4列：最奥（22体・暗いシルエット・遠景の頭の波） ======
      for (let i = 0; i < 22; i++) {
        const bx = -118 + i * 16;
        const by = 2 + (i % 5) * 2;
        const col = (i % 2) ? '#2a1a3a' : '#3a2a4a';
        r(bx, by, 9, 18, col);
        r(bx, by, 9, 5, darken(col, 0.7));
        // 頭の丸み（角を一段暗く）
        r(bx, by, 1, 1, O); r(bx + 8, by, 1, 1, O);
        r(bx + 1, by, 7, 4, darken(col, 0.5));
      }

      // ====== 第3列：奥（13体・色付き・頭は丸めに） ======
      const r3pal = ['#5a3040','#3a5a7a','#7a5a30','#4a3a7a','#3a7a5a','#7a3a5a','#3a4a7a','#5a3a30'];
      for (let i = 0; i < 13; i++) {
        const bx = -110 + i * 28;
        const by = 22;
        const col = r3pal[i % r3pal.length];
        const skin = (i % 3 === 0) ? '#d8a880' : (i % 3 === 1) ? '#e8b890' : '#f0c89a';
        const hairC = ['#3a2a1a','#5a3a20','#dac060','#7a3a20','#a06040'][i % 5];
        // 体
        r(bx, by, 16, 24, col);
        r(bx, by, 16, 3, lighten(col, 1.3));
        r(bx, by + 21, 16, 3, darken(col, 0.65));
        // 頭（角を落として丸く）
        r(bx + 3, by - 10, 10, 10, skin);
        r(bx + 3, by - 10, 1, 1, O); r(bx + 12, by - 10, 1, 1, O);
        r(bx + 3, by - 1, 1, 1, O); r(bx + 12, by - 1, 1, 1, O);
        // 髪
        r(bx + 3, by - 10, 10, 4, hairC);
        r(bx + 4, by - 9, 8, 1, lighten(hairC, 1.4));
        if (i % 3 === 0) {
          // 長髪（女性）
          r(bx + 2, by - 6, 2, 8, hairC);
          r(bx + 12, by - 6, 2, 8, hairC);
        }
        // 眉
        r(bx + 4, by - 6, 2, 1, darken(hairC, 0.6));
        r(bx + 10, by - 6, 2, 1, darken(hairC, 0.6));
        // 目（点でなく短い線で人間味）
        r(bx + 5, by - 5, 1, 1, O); r(bx + 10, by - 5, 1, 1, O);
        // 鼻の影
        r(bx + 7, by - 4, 2, 1, darken(skin, 0.8));
        // 口
        r(bx + 6, by - 2, 4, 1, '#aa4040');
        // 万歳の腕
        if (i % 2 === 0) {
          r(bx - 1, by - 6, 2, 8, skin);
          r(bx + 15, by - 6, 2, 8, skin);
          r(bx - 2, by - 12, 4, 7, col);
          r(bx + 14, by - 12, 4, 7, col);
        }
      }

      // ====== 第2列：中段（9体・人間味のある顔・万歳/拍手交互） ======
      const r2pal = [
        {sk:'#f0c89a', skD:'#c89070', hr:'#3a2a1a', cl:'#aa3030', g:'f'},
        {sk:'#e8b890', skD:'#b08868', hr:'#dac030', cl:'#3a6abe', g:'f'},
        {sk:'#fadcb0', skD:'#c89c80', hr:'#7a3a20', cl:'#3aae6a', g:'m'},
        {sk:'#d8a880', skD:'#a87858', hr:'#5a3a20', cl:'#9a4ade', g:'f'},
        {sk:'#f0c89a', skD:'#c89070', hr:'#a06040', cl:'#aa6030', g:'m'},
        {sk:'#e8b890', skD:'#b08868', hr:'#3a2a1a', cl:'#3a8a8a', g:'f'},
        {sk:'#f4cca0', skD:'#cc9878', hr:'#dac060', cl:'#c83080', g:'f'},
        {sk:'#e0b890', skD:'#a88868', hr:'#5a3a20', cl:'#3a4ade', g:'m'},
        {sk:'#f0c89a', skD:'#c89070', hr:'#3a2a1a', cl:'#7a8a3a', g:'f'},
      ];
      for (let i = 0; i < 9; i++) {
        const bx = -106 + i * 38;
        const by = 56;
        const fp = r2pal[i];
        const hrH = lighten(fp.hr, 1.4), hrD = darken(fp.hr, 0.6);
        // 体
        r(bx, by, 24, 26, fp.cl);
        r(bx, by, 24, 4, lighten(fp.cl, 1.3));
        r(bx, by + 22, 24, 4, darken(fp.cl, 0.65));
        // 首
        r(bx + 9, by - 2, 6, 2, fp.sk);
        r(bx + 9, by - 2, 6, 1, fp.skD);
        // 頭（角を削って丸く）
        r(bx + 4, by - 16, 16, 16, fp.sk);
        r(bx + 4, by - 16, 1, 2, O); r(bx + 19, by - 16, 1, 2, O);
        r(bx + 4, by - 2, 1, 1, O); r(bx + 19, by - 2, 1, 1, O);
        // 額の明るみ
        r(bx + 7, by - 15, 10, 1, lighten(fp.sk, 1.1));
        // 顎の影
        r(bx + 5, by - 3, 14, 1, fp.skD);
        // 髪
        if (fp.g === 'f') {
          // 女性：横にも髪が伸びる
          r(bx + 3, by - 16, 18, 6, fp.hr);
          r(bx + 5, by - 15, 14, 1, hrH);
          r(bx + 3, by - 10, 2, 8, fp.hr);
          r(bx + 19, by - 10, 2, 8, fp.hr);
          // 前髪（不揃い）
          r(bx + 7, by - 11, 4, 1, fp.hr);
          r(bx + 14, by - 11, 4, 1, fp.hr);
        } else {
          // 男性：短髪
          r(bx + 4, by - 16, 16, 5, fp.hr);
          r(bx + 5, by - 15, 14, 1, hrH);
          r(bx + 5, by - 11, 3, 1, fp.hr);
          r(bx + 16, by - 11, 3, 1, fp.hr);
        }
        // 眉
        r(bx + 7, by - 10, 3, 1, hrD);
        r(bx + 14, by - 10, 3, 1, hrD);
        // 目（白目＋瞳）
        r(bx + 7, by - 9, 3, 2, '#fff');
        r(bx + 14, by - 9, 3, 2, '#fff');
        r(bx + 8, by - 9, 1, 2, O);
        r(bx + 15, by - 9, 1, 2, O);
        // 鼻
        r(bx + 11, by - 8, 2, 3, fp.skD);
        r(bx + 11, by - 5, 2, 1, darken(fp.sk, 0.65));
        // 口（笑顔・上下の唇）
        r(bx + 9, by - 4, 6, 1, '#aa3030');
        r(bx + 10, by - 3, 4, 1, '#5a1018');
        // 頬の赤み
        ctx.fillStyle = 'rgba(255,150,150,0.4)';
        ctx.fillRect(sx + bx + 5, sy + by - 7, 2, 2);
        ctx.fillRect(sx + bx + 17, sy + by - 7, 2, 2);
        // ポーズ
        if (i % 2 === 0) {
          // 万歳
          r(bx - 2, by - 18, 5, 10, fp.sk);
          r(bx + 21, by - 18, 5, 10, fp.sk);
          r(bx - 4, by - 26, 7, 10, fp.cl);
          r(bx + 21, by - 26, 7, 10, fp.cl);
          r(bx - 5, by - 30, 8, 6, fp.sk);
          r(bx + 21, by - 30, 8, 6, fp.sk);
          r(bx - 5, by - 30, 8, 1, fp.skD);
          r(bx + 21, by - 30, 8, 1, fp.skD);
        } else {
          // 拍手
          r(bx - 2, by + 4, 6, 14, fp.cl);
          r(bx + 20, by + 4, 6, 14, fp.cl);
          r(bx + 4, by + 14, 16, 7, fp.sk);
          r(bx + 4, by + 14, 16, 1, fp.skD);
          r(bx + 11, by + 14, 1, 7, fp.skD);
        }
      }

      // ====== 第1列（最前列）：4体・人間の顔の構造をしっかり描く ======
      const r1pal = [
        {sk:'#f0c89a', hr:'#7a3a20', cl:'#c83040', pose:'cheer', gender:'f', hair:'long', eye:'#3a4a6a'},
        {sk:'#d8a880', hr:'#2a1a10', cl:'#3aae6a', pose:'clap',  gender:'m', hair:'short', eye:'#3a2a1a', beard:true},
        {sk:'#fadcb0', hr:'#dac060', cl:'#3a6abe', pose:'cheer', gender:'f', hair:'long', eye:'#5a8aae'},
        {sk:'#e0a888', hr:'#5a3a20', cl:'#9a4ade', pose:'clap',  gender:'m', hair:'short', eye:'#3a2a1a'},
      ];
      for (let i = 0; i < 4; i++) {
        const bx = -110 + i * 84;
        const by = 100;
        const fp = r1pal[i];
        const skH = lighten(fp.sk, 1.12);
        const skD = darken(fp.sk, 0.78);
        const skDD = darken(fp.sk, 0.6);
        const hrH = lighten(fp.hr, 1.4);
        const hrD = darken(fp.hr, 0.6);
        const clH = lighten(fp.cl, 1.3);
        const clD = darken(fp.cl, 0.6);

        // ============ 体 ============
        r(bx + 2, by, 34, 22, fp.cl);
        r(bx, by + 2, 38, 18, fp.cl);
        r(bx, by + 2, 38, 4, clH);
        r(bx, by + 17, 38, 5, clD);
        r(bx + 4, by, 30, 1, clD); // 肩のライン
        // 服の襟元
        r(bx + 14, by, 10, 4, darken(fp.cl, 0.45));

        // ============ 首（影あり） ============
        r(bx + 14, by - 5, 10, 5, fp.sk);
        r(bx + 14, by - 5, 10, 1, skDD);
        r(bx + 14, by - 5, 1, 5, skD);
        r(bx + 23, by - 5, 1, 5, skD);

        // ============ 頭部（角を落として丸く） ============
        r(bx + 4, by - 26, 30, 22, fp.sk);
        // 角（左上・右上・左下・右下を1〜2px切る）
        r(bx + 4, by - 26, 2, 1, O); r(bx + 32, by - 26, 2, 1, O);
        r(bx + 4, by - 25, 1, 1, O); r(bx + 33, by - 25, 1, 1, O);
        r(bx + 4, by - 5, 1, 1, O);  r(bx + 33, by - 5, 1, 1, O);
        // 顔の輪郭（陰影で立体感）
        r(bx + 5, by - 16, 1, 8, skD);   // 左頬の影
        r(bx + 32, by - 16, 1, 8, skD);  // 右頬の影
        r(bx + 6, by - 7, 26, 1, skD);   // 顎下の影
        r(bx + 8, by - 24, 22, 1, skH);  // 額のハイライト

        // ============ 髪 ============
        if (fp.hair === 'long') {
          // ロング：頭頂〜サイド（耳の下）まで
          r(bx + 4, by - 26, 30, 9, fp.hr);
          r(bx + 6, by - 25, 26, 1, hrH);
          r(bx + 12, by - 24, 6, 1, hrH);
          r(bx + 22, by - 24, 4, 1, hrH);
          // 前髪（流れる）
          r(bx + 6, by - 18, 6, 2, fp.hr);
          r(bx + 14, by - 18, 4, 1, fp.hr);
          r(bx + 22, by - 18, 8, 2, fp.hr);
          // サイド（顎の高さまで）
          r(bx + 3, by - 18, 3, 12, fp.hr);
          r(bx + 32, by - 18, 3, 12, fp.hr);
          r(bx + 3, by - 16, 1, 10, hrD);
          r(bx + 34, by - 16, 1, 10, hrD);
        } else {
          // ショート：頭頂のみ・サイドは耳上まで
          r(bx + 4, by - 26, 30, 8, fp.hr);
          r(bx + 6, by - 25, 26, 1, hrH);
          r(bx + 14, by - 24, 8, 1, hrH);
          // 前髪（不揃い）
          r(bx + 6, by - 19, 8, 1, fp.hr);
          r(bx + 14, by - 19, 6, 2, fp.hr);
          r(bx + 22, by - 19, 6, 1, fp.hr);
          // 耳上
          r(bx + 3, by - 18, 2, 4, fp.hr);
          r(bx + 33, by - 18, 2, 4, fp.hr);
        }

        // ============ 眉 ============
        if (expr === 'angry') {
          // 怒り：内側上がり
          r(bx + 7, by - 19, 8, 2, hrD);
          r(bx + 23, by - 19, 8, 2, hrD);
          r(bx + 13, by - 17, 2, 1, hrD);
          r(bx + 23, by - 17, 2, 1, hrD);
        } else {
          r(bx + 8, by - 17, 7, 1, hrD);
          r(bx + 23, by - 17, 7, 1, hrD);
        }

        // ============ 目（白目・虹彩・瞳孔・反射光・睫毛） ============
        if (expr === 'crying') {
          // 涙目
          r(bx + 8, by - 16, 6, 4, '#fff');
          r(bx + 24, by - 16, 6, 4, '#fff');
          r(bx + 10, by - 15, 3, 2, fp.eye);
          r(bx + 26, by - 15, 3, 2, fp.eye);
          r(bx + 11, by - 15, 1, 1, O);
          r(bx + 27, by - 15, 1, 1, O);
          // 涙
          r(bx + 9, by - 11, 2, 8, '#5aaee8');
          r(bx + 27, by - 11, 2, 8, '#5aaee8');
          r(bx + 9, by - 11, 1, 8, '#9adcfa');
          r(bx + 27, by - 11, 1, 8, '#9adcfa');
        } else if (expr === 'angry') {
          r(bx + 8, by - 15, 6, 3, '#fff');
          r(bx + 24, by - 15, 6, 3, '#fff');
          r(bx + 10, by - 14, 3, 2, fp.eye);
          r(bx + 26, by - 14, 3, 2, fp.eye);
          r(bx + 11, by - 14, 1, 1, O);
          r(bx + 27, by - 14, 1, 1, O);
        } else {
          // 通常：白目＋虹彩＋瞳孔＋反射光
          r(bx + 8, by - 16, 6, 4, '#fff');
          r(bx + 24, by - 16, 6, 4, '#fff');
          r(bx + 10, by - 15, 3, 3, fp.eye);
          r(bx + 26, by - 15, 3, 3, fp.eye);
          r(bx + 11, by - 14, 1, 2, O);
          r(bx + 27, by - 14, 1, 2, O);
          r(bx + 10, by - 15, 1, 1, '#fff'); // 反射光
          r(bx + 26, by - 15, 1, 1, '#fff');
          // 睫毛（上下）
          r(bx + 8, by - 17, 6, 1, O);
          r(bx + 24, by - 17, 6, 1, O);
          r(bx + 8, by - 12, 6, 1, skD);
          r(bx + 24, by - 12, 6, 1, skD);
        }

        // ============ 鼻（橋＋鼻翼＋鼻孔） ============
        r(bx + 18, by - 14, 1, 6, skD);   // 左鼻筋
        r(bx + 19, by - 14, 1, 4, skH);   // 中央ハイライト
        r(bx + 20, by - 14, 1, 6, skD);   // 右鼻筋
        r(bx + 17, by - 10, 6, 2, skD);   // 鼻翼
        r(bx + 18, by - 9, 1, 1, O);      // 鼻孔
        r(bx + 21, by - 9, 1, 1, O);

        // ============ 口（上下の唇） ============
        if (expr === 'crying') {
          r(bx + 12, by - 7, 14, 2, O);
          r(bx + 13, by - 6, 12, 1, '#5a1018');
        } else if (expr === 'angry') {
          r(bx + 12, by - 7, 14, 2, O);
          r(bx + 14, by - 9, 4, 1, O);
          r(bx + 22, by - 9, 4, 1, O);
        } else {
          // 笑顔（上唇＋下唇＋口角）
          r(bx + 12, by - 8, 14, 1, '#cc4040');  // 上唇
          r(bx + 13, by - 7, 12, 2, '#aa3030');  // 下唇（厚み）
          r(bx + 14, by - 6, 10, 1, '#7a2020');  // 影
          r(bx + 11, by - 7, 1, 1, O);           // 口角左
          r(bx + 26, by - 7, 1, 1, O);           // 口角右
        }

        // ============ 髭（男性のみ） ============
        if (fp.beard) {
          r(bx + 12, by - 6, 14, 3, hrD);
          r(bx + 14, by - 5, 10, 1, fp.hr);
          r(bx + 16, by - 4, 6, 1, hrD);
        }

        // ============ 頬の赤み ============
        ctx.fillStyle = 'rgba(255,140,150,0.5)';
        ctx.fillRect(sx + bx + 6, sy + by - 12, 4, 4);
        ctx.fillRect(sx + bx + 28, sy + by - 12, 4, 4);

        // ============ 耳 ============
        r(bx + 2, by - 14, 2, 5, fp.sk);
        r(bx + 34, by - 14, 2, 5, fp.sk);
        r(bx + 2, by - 14, 1, 5, skD);
        r(bx + 35, by - 14, 1, 5, skD);

        // ============ 腕＋手 ============
        if (fp.pose === 'cheer') {
          // 万歳（肩から斜めに上がる）
          r(bx - 6, by + 2, 8, 12, fp.cl);
          r(bx + 36, by + 2, 8, 12, fp.cl);
          r(bx - 6, by + 2, 8, 2, clH);
          r(bx + 36, by + 2, 8, 2, clH);
          r(bx - 12, by - 18, 8, 22, fp.cl);
          r(bx + 42, by - 18, 8, 22, fp.cl);
          r(bx - 12, by - 18, 1, 22, clD);
          r(bx + 49, by - 18, 1, 22, clD);
          // 手のひら
          r(bx - 14, by - 26, 10, 10, fp.sk);
          r(bx + 42, by - 26, 10, 10, fp.sk);
          r(bx - 14, by - 26, 10, 1, skDD);
          r(bx + 42, by - 26, 10, 1, skDD);
          r(bx - 14, by - 17, 10, 1, skD);
          r(bx + 42, by - 17, 10, 1, skD);
          // 親指
          r(bx - 5, by - 22, 2, 3, fp.sk);
          r(bx + 41, by - 22, 2, 3, fp.sk);
          // 指の区切り
          r(bx - 11, by - 25, 1, 8, skD);
          r(bx - 8, by - 25, 1, 8, skD);
          r(bx + 45, by - 25, 1, 8, skD);
          r(bx + 48, by - 25, 1, 8, skD);
        } else {
          // 拍手（顔の前で両手）
          r(bx - 4, by + 2, 8, 14, fp.cl);
          r(bx + 34, by + 2, 8, 14, fp.cl);
          r(bx - 4, by + 2, 8, 2, clH);
          r(bx + 34, by + 2, 8, 2, clH);
          r(bx + 2, by + 14, 34, 8, fp.sk);
          r(bx + 2, by + 14, 34, 1, skDD);
          r(bx + 18, by + 14, 1, 8, skDD);
          r(bx + 2, by + 21, 34, 1, skD);
          // 指の細かい区切り
          for (let k = 0; k < 4; k++) {
            r(bx + 4 + k * 4, by + 15, 1, 6, skD);
            r(bx + 22 + k * 4, by + 15, 1, 6, skD);
          }
        }
      }

      // ====== 観衆が掲げるリトアニア国旗（観衆の上に） ======
      function bigFlag(fx, fy, w) {
        // ポール
        r(fx, fy, 2, 50, '#7a4a20');
        r(fx, fy, 1, 50, '#5a3a18');
        // 旗（横長・はためき）
        r(fx + 2, fy + 2, w, 4, '#dac030');
        r(fx + 2, fy + 6, w, 4, '#3aae6a');
        r(fx + 2, fy + 10, w, 4, '#c83040');
        r(fx + 2, fy + 2, w, 1, '#fff088');
        r(fx + 2, fy + 13, w, 1, '#7a1820');
        // 端の縫い
        r(fx + 1 + w, fy + 2, 1, 12, O);
      }
      bigFlag(-86, 50, 24);
      bigFlag(50, 38, 28);
      bigFlag(170, 46, 22);
      // 中段の小さめ旗
      r(-30, 56, 2, 28, '#7a4a20');
      r(-28, 58, 12, 3, '#dac030');
      r(-28, 61, 12, 3, '#3aae6a');
      r(-28, 64, 12, 3, '#c83040');
      r(116, 58, 2, 28, '#7a4a20');
      r(118, 60, 14, 3, '#dac030');
      r(118, 63, 14, 3, '#3aae6a');
      r(118, 66, 14, 3, '#c83040');

      // ====== 前景：スピーカースタック＆ミキシングコンソール ======
      // 左スピーカースタック
      r(-130, 92, 36, 32, '#0a0a0a');
      r(-130, 92, 36, 2, '#3a3a3a');
      r(-130, 122, 36, 2, '#1a1a1a');
      r(-128, 96, 14, 14, '#1a1a1a');
      r(-128, 96, 14, 2, '#5a5a5a');
      r(-112, 96, 12, 12, '#1a1a1a');
      r(-112, 96, 12, 2, '#5a5a5a');
      r(-128, 112, 32, 8, '#2a2a2a');
      r(-128, 112, 32, 1, '#5a5a5a');
      // ロゴ
      r(-122, 116, 2, 2, '#dac030');
      r(-118, 116, 2, 2, '#dac030');
      r(-114, 116, 2, 2, '#dac030');
      // 右スピーカースタック
      r(218, 92, 36, 32, '#0a0a0a');
      r(218, 92, 36, 2, '#3a3a3a');
      r(218, 122, 36, 2, '#1a1a1a');
      r(220, 96, 14, 14, '#1a1a1a');
      r(220, 96, 14, 2, '#5a5a5a');
      r(236, 96, 12, 12, '#1a1a1a');
      r(236, 96, 12, 2, '#5a5a5a');
      r(220, 112, 32, 8, '#2a2a2a');
      r(220, 112, 32, 1, '#5a5a5a');
      r(226, 116, 2, 2, '#dac030');
      r(230, 116, 2, 2, '#dac030');
      r(234, 116, 2, 2, '#dac030');

      // ミキシングコンソール（中央前景）
      r(-90, 110, 200, 14, '#1a1a2a');
      r(-90, 110, 200, 2, '#4a4a5a');
      r(-90, 122, 200, 2, '#0a0a14');
      // フェーダー＆つまみ
      for (let i = 0; i < 30; i++) {
        const cx = -85 + i * 7;
        r(cx, 113, 1, 7, '#dac030');
        r(cx, 113, 1, 1, '#fff088');
        r(cx - 1, 116, 3, 2, '#3a3a4a');
      }
      // ケーブル
      r(-130, 124, 384, 2, '#0a0a0a');
    } else {
      // 雑魚（4種類の名前で別の見た目／4色パレット）
      const enemyName = state.enemy ? state.enemy.name : '';
      let kind = 'citizen';
      if (enemyName.includes('老婦人')) kind = 'oldwoman';
      else if (enemyName.includes('おじさん')) kind = 'middleman';
      else if (enemyName.includes('学生')) kind = 'student';
      const palettes = [
        { hair: '#7a3a20', cloth: '#c83040', accent: '#dac030' },
        { hair: '#3a2a1a', cloth: '#3aae6a', accent: '#fff8e0' },
        { hair: '#dac030', cloth: '#3a6abe', accent: '#c83030' },
        { hair: '#a06040', cloth: '#9a4ade', accent: '#3aae6a' },
      ];
      const palIdx = (state.enemy && state.enemy.paletteIdx != null) ? state.enemy.paletteIdx : 0;
      const p = palettes[palIdx % 4];
      const skin = '#f0c89a', skinD = '#c89070';
      let hair = p.hair, cloth = p.cloth, accent = p.accent;
      let pants = '#3a3040';
      if (kind === 'oldwoman')      { hair = '#cccccc'; cloth = '#6a3a8a'; pants = '#4a2860'; }
      else if (kind === 'middleman'){ hair = '#5a3a20'; cloth = '#3a4a6a'; pants = '#2a2030'; }
      else if (kind === 'student')  { hair = '#2a1a10'; cloth = '#3a6a8a'; pants = '#3a3a4a'; }
      const hairD = darken(hair, 0.6), hairH = lighten(hair, 1.4);
      const clothD = darken(cloth, 0.65), clothH = lighten(cloth, 1.3);

      // ============ 頭部（32x32：スマート比） ============
      r(46, 6, 28, 2, O);
      r(44, 8, 32, 2, O);
      r(42, 10, 36, 2, O);
      r(42, 12, 2, 28, O); r(76, 12, 2, 28, O);
      r(44, 38, 32, 2, O);
      r(44, 12, 32, 26, skin);
      r(44, 36, 32, 2, skinD);
      // 髪型（kindで分岐）
      if (kind === 'middleman') {
        r(46, 12, 28, 4, skin); // 額（半ハゲ）
        r(46, 14, 6, 8, hair); r(70, 14, 6, 8, hair);
        r(46, 16, 28, 2, hair);
        r(48, 30, 24, 8, hair); // 髭
        r(50, 32, 20, 4, hairD);
      } else if (kind === 'oldwoman') {
        // 頭巾
        r(40, 8, 40, 4, accent);
        r(40, 12, 40, 14, accent);
        r(40, 12, 4, 14, darken(accent, 0.7));
        r(76, 12, 4, 14, darken(accent, 0.7));
        r(48, 12, 8, 2, lighten(accent, 1.3));
        r(46, 26, 28, 2, hairD); // 頭巾の影
      } else if (kind === 'student') {
        // パーカーフード（後ろに垂らす）
        r(38, 12, 44, 6, cloth);
        r(38, 12, 44, 2, clothD);
        r(46, 14, 28, 6, hair);
        r(48, 14, 24, 2, hairH);
      } else {
        // 通りすがり：標準短髪
        r(46, 12, 28, 6, hair);
        r(48, 12, 24, 2, hairH);
        r(44, 14, 4, 12, hair); r(72, 14, 4, 12, hair);
      }
      // 目
      if (expr === 'crying') {
        r(50, 22, 4, 2, O); r(66, 22, 4, 2, O);
        r(50, 25, 3, 10, '#5aaee8'); r(66, 25, 3, 10, '#5aaee8');
      } else if (expr === 'angry') {
        r(48, 20, 7, 2, O); r(65, 20, 7, 2, O);
        r(50, 23, 4, 3, O); r(66, 23, 4, 3, O);
      } else {
        r(50, 23, 4, 4, O); r(66, 23, 4, 4, O);
        r(51, 24, 2, 2, '#fff'); r(67, 24, 2, 2, '#fff');
      }
      // 鼻
      r(59, 27, 2, 4, skinD);
      // 口
      if (expr === 'angry') {
        r(54, 32, 12, 2, O);
        r(52, 30, 4, 2, O); r(64, 30, 4, 2, O);
      } else if (expr === 'crying') {
        r(54, 33, 12, 2, O);
        r(52, 32, 4, 1, O); r(64, 32, 4, 1, O);
      } else {
        r(56, 32, 8, 2, O);
        r(56, 33, 8, 1, '#aa4040');
      }
      // 頬の赤
      ctx.fillStyle = 'rgba(255,150,160,0.4)';
      ctx.fillRect(sx + 44, sy + 30, 4, 4);
      ctx.fillRect(sx + 72, sy + 30, 4, 4);

      // ============ 首 ============
      r(56, 40, 8, 6, skin);
      r(54, 40, 2, 6, O); r(64, 40, 2, 6, O);

      // ============ 胴・腕・脚（kindで分岐） ============
      if (kind === 'oldwoman') {
        // ロングドレス
        r(38, 46, 44, 36, cloth);
        r(38, 46, 44, 1, O);
        r(37, 46, 1, 36, O); r(82, 46, 1, 36, O);
        r(38, 46, 44, 3, clothH);
        r(38, 76, 44, 4, accent); // ベルト
        // ロングスカート（広がる）
        r(36, 82, 48, 6, cloth);
        r(34, 88, 52, 6, cloth);
        r(32, 94, 56, 6, cloth);
        r(30, 100, 60, 8, cloth);
        r(30, 108, 60, 6, clothD);
        r(30, 113, 60, 1, O);
        // 腕（左：自由・右：杖）
        r(34, 48, 4, 28, cloth);
        r(82, 48, 4, 28, cloth);
        r(34, 76, 6, 6, skin); r(80, 76, 6, 6, skin);
        // 杖
        r(86, 50, 3, 64, '#5a3a20');
        r(86, 48, 3, 4, '#3a2010');
      } else {
        const bodyW = (kind === 'middleman') ? 44 : (kind === 'student') ? 36 : 40;
        const bodyX = 60 - Math.floor(bodyW / 2);
        // 胴
        r(bodyX, 46, bodyW, 38, cloth);
        r(bodyX - 1, 46, 1, 38, O); r(bodyX + bodyW, 46, 1, 38, O);
        r(bodyX, 46, bodyW, 1, O);
        r(bodyX, 46, bodyW, 3, clothH);
        if (kind === 'middleman') {
          // ベスト
          r(bodyX + 4, 50, bodyW - 8, 30, accent);
          r(bodyX + 4, 50, bodyW - 8, 1, darken(accent, 0.6));
          // ボタン
          r(59, 56, 2, 2, '#dac030');
          r(59, 64, 2, 2, '#dac030');
          r(59, 72, 2, 2, '#dac030');
        } else if (kind === 'student') {
          // パーカーの紐
          r(58, 48, 4, 18, '#fff8e0');
          r(58, 48, 4, 1, O);
          // ロゴ的な装飾
          r(54, 60, 12, 6, accent);
          r(56, 62, 8, 2, '#fff');
          // リュックの肩紐（左右）
          r(40, 48, 2, 32, darken(accent, 0.5));
          r(78, 48, 2, 32, darken(accent, 0.5));
        } else {
          // 襟
          r(54, 46, 12, 6, '#fff8e0');
          r(54, 52, 12, 1, O);
        }
        // ベルト
        r(bodyX, 80, bodyW, 4, '#3a2820');
        r(bodyX, 80, bodyW, 1, O);
        // パンツ（左右）
        r(46, 84, 14, 30, pants);
        r(60, 84, 14, 30, pants);
        r(46, 84, 14, 1, lighten(pants, 1.5));
        r(60, 84, 14, 1, lighten(pants, 1.5));
        r(45, 84, 1, 30, O); r(60, 84, 1, 30, O);
        r(60, 84, 1, 30, O); r(74, 84, 1, 30, O);
        // 靴
        r(43, 114, 18, 5, O);
        r(59, 114, 18, 5, O);
        r(44, 115, 16, 3, '#1a0a08');
        r(60, 115, 16, 3, '#1a0a08');
        // 腕
        r(bodyX - 8, 48, 8, 32, cloth);
        r(bodyX + bodyW, 48, 8, 32, cloth);
        r(bodyX - 9, 48, 1, 32, O);
        r(bodyX + bodyW + 8, 48, 1, 32, O);
        r(bodyX - 8, 48, 8, 3, clothH);
        r(bodyX + bodyW, 48, 8, 3, clothH);
        // 手
        r(bodyX - 9, 78, 10, 6, skin); r(bodyX - 9, 78, 10, 1, O); r(bodyX - 9, 83, 10, 1, O);
        r(bodyX + bodyW - 1, 78, 10, 6, skin);
        r(bodyX + bodyW - 1, 78, 10, 1, O); r(bodyX + bodyW - 1, 83, 10, 1, O);
      }
    }
  }

  // ============================================================
  // タイトル／新規作成画面
  // ============================================================
  const KANA = [
    'あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの',
    'はひふへほ', 'まみむめも', 'やゆよわん', 'らりるれろ', 'がぎぐげご',
    'ざじずぜぞ', 'だぢづでど', 'ばびぶべぼ', 'ぱぴぷぺぽ', '・ー'
  ];

  function renderTitle() {
    clear('#1a1a2a');
    // 背景の星
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 30; i++) {
      const x = (i * 79) % CANVAS_W;
      const y = (i * 53) % 200;
      ctx.fillRect(x, y, 1, 1);
    }
    // ロゴ
    ctx.fillStyle = '#dac030';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('リトアニア音楽紀行', CANVAS_W / 2, 90);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText('〜失われた歌詞のピース〜', CANVAS_W / 2, 115);
    // 三色帯
    ctx.fillStyle = '#dac030'; ctx.fillRect(40, 130, CANVAS_W - 80, 4);
    ctx.fillStyle = '#3aae5a'; ctx.fillRect(40, 136, CANVAS_W - 80, 4);
    ctx.fillStyle = '#c83030'; ctx.fillRect(40, 142, CANVAS_W - 80, 4);
    // フィクション注記（下部に小さく）
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('※このゲームに登場する人物・団体・物語は', CANVAS_W / 2, CANVAS_H - 24);
    ctx.fillText('すべてフィクションです', CANVAS_W / 2, CANVAS_H - 10);
    ctx.textAlign = 'left';
  }

  function showTitleMenu() {
    state.scene = 'title';
    state.titleStep = 'tap';
    renderTitle();
    // フェーズ1: タップで音楽解錠＋メニュー表示（自動再生ブロック対策）
    const d = document.getElementById('dialog');
    d.innerHTML =
      '<div style="font-size:13px;margin-bottom:10px;text-align:center;color:#dac030;">🎵 タップしてはじめる</div>' +
      '<button data-act="start" style="width:100%;padding:14px;background:#1a1a2a;border:2px solid #dac030;border-radius:8px;color:#dac030;cursor:pointer;font-size:14px;">▶ TAP TO START</button>';
    d.querySelector('[data-act="start"]').addEventListener('click', () => {
      audio.ensureCtx();
      audio.playBGM('title');
      audio.playSE('decide');
      showTitleMenuPhase2();
    });
  }

  function showTitleMenuPhase2() {
    state.titleStep = 'menu';
    const hasSaveData = hasSave();
    if (typeof state.titleSel !== 'number') state.titleSel = hasSaveData ? 1 : 0;
    if (!hasSaveData) state.titleSel = 0;
    const d = document.getElementById('dialog');
    const sel = state.titleSel;
    const styleSel    = 'padding:10px;background:#2a2a3a;border:2px solid #dac030;border-radius:6px;color:#dac030;cursor:pointer;font-weight:bold;';
    const styleNormal = 'padding:10px;background:#222;border:1px solid #555;border-radius:6px;color:#fff;cursor:pointer;';
    let html = '<div style="font-size:13px;margin-bottom:8px;text-align:center;">メニュー（↑↓で選択 / Enter or Z で決定）</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    html += `<button data-act="new" class="title-btn" style="${sel === 0 ? styleSel : styleNormal}">${sel === 0 ? '▶' : '　'} はじめから</button>`;
    if (hasSaveData) {
      html += `<button data-act="cont" class="title-btn" style="${sel === 1 ? styleSel : styleNormal}">${sel === 1 ? '▶' : '　'} つづきから</button>`;
    } else {
      html += '<button disabled style="padding:10px;background:#111;border:1px solid #333;border-radius:6px;color:#555;">　 つづきから（セーブなし）</button>';
    }
    html += '</div>';
    d.innerHTML = html;
    d.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        audio.ensureCtx();
        audio.playSE('decide');
        if (b.dataset.act === 'cont') {
          if (loadGame()) { renderAndUpdate(); audio.playBGM('field'); openingResume(); }
        } else {
          startNewGame();
        }
      });
    });
  }

  function confirmTitleMenu() {
    audio.ensureCtx();
    audio.playSE('decide');
    if (state.titleSel === 1 && hasSave()) {
      if (loadGame()) { renderAndUpdate(); audio.playBGM('field'); openingResume(); }
    } else {
      startNewGame();
    }
  }

  function startNewGame() {
    state = initialState();
    state.scene = 'newgame';
    state.titleStep = 'name1';
    state.tmp = { names: ['', '', ''], looks: ['m1', 'f5', 'm4'], whoIdx: 0, kanaR: 0, kanaC: 0, lookIdx: 0, confirmSel: 1 };
    document.body.classList.add('newgame-mode');
    renderNewGameStep();
  }

  // ニューゲーム画面の十字キー/A/Bボタン → 既存のキー入力ハンドラに合成イベントで橋渡し
  function dispatchSyntheticKey(key) {
    try { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: false })); }
    catch (e) {}
  }

  function updateNewGameButtonLabels() {
    const a = document.getElementById('btnA');
    const b = document.getElementById('btnB');
    const inName = state.scene === 'newgame' && state.titleStep && state.titleStep.startsWith('name');
    if (a) a.textContent = inName ? 'けってい'  : 'A 決定';
    if (b) b.textContent = inName ? '１文字けす' : 'B メニュー';
  }

  function renderNewGameStep() {
    updateNewGameButtonLabels();
    clear('#1a1a2a');
    ctx.fillStyle = '#dac030';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    const titles = ['主人公', 'ふたり目', 'みっつ目'];
    const idx = state.tmp.whoIdx;
    const stepLabel = state.titleStep.startsWith('name') ? 'なまえを入力' : '見た目をえらぶ';
    ctx.fillText(titles[idx] + 'の' + stepLabel, CANVAS_W / 2, 50);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('（' + (idx + 1) + '/3）', CANVAS_W / 2, 75);

    if (state.titleStep.startsWith('look')) {
      // 見た目プレビュー（中央に大きく）
      const L = lookById(state.tmp.looks[idx]);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(L.name, CANVAS_W / 2, 100);
      // キャラ拡大表示（2x）
      const cx = CANVAS_W / 2 - CHAR_W;
      const cy = 110;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // テンポラリ・キャンバスに描いて2倍拡大
      const tmp = document.createElement('canvas');
      tmp.width = CHAR_W; tmp.height = CHAR_H;
      const tctx = tmp.getContext('2d');
      ctx.restore();
      drawCharOnCtx(tctx, 0, 0, 'down', state.tmp.looks[idx]);
      ctx.drawImage(tmp, cx, cy, CHAR_W * 2, CHAR_H * 2);
    }
    if (state.titleStep.startsWith('name')) {
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(state.tmp.names[idx] || '＿＿＿', CANVAS_W / 2, 150);
    }
    ctx.textAlign = 'left';
    showNewGameUI();
  }

  function drawCharOnCtx(c, sx, sy, dir, look) { drawCharDetailed(c, sx, sy, dir, look); }

  function showNewGameUI() {
    const d = document.getElementById('dialog');
    const idx = state.tmp.whoIdx;
    let html = '';

    if (state.titleStep.startsWith('name')) {
      html += '<div style="font-size:12px;margin-bottom:6px;color:#aaa;">名前（最大6文字）／矢印で選択（けす・けっていにも移動可）・Z/Enterで実行</div>';
      html += `<div style="font-size:14px;margin-bottom:8px;background:#222;padding:6px 10px;border-radius:4px;min-height:22px;">${state.tmp.names[idx] || ''}<span style="color:#888;">_</span></div>`;
      html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;font-size:13px;">';
      KANA.forEach((row, ri) => {
        for (let ci = 0; ci < row.length; ci++) {
          const ch = row[ci];
          const isCur = (ri === state.tmp.kanaR && ci === state.tmp.kanaC);
          const bg = isCur ? '#dac030' : '#222';
          const fg = isCur ? '#000' : '#fff';
          const bd = isCur ? '2px solid #fff' : '1px solid #555';
          const fw = isCur ? 'bold' : 'normal';
          html += `<button data-kana="${ch}" data-r="${ri}" data-c="${ci}" style="padding:6px 0;background:${bg};border:${bd};border-radius:4px;color:${fg};cursor:pointer;font-weight:${fw};">${ch}</button>`;
        }
      });
      html += '</div>';
      html += '<div style="display:flex;gap:6px;margin-top:6px;">';
      const onBs = (state.tmp.kanaR === KANA.length && state.tmp.kanaC === 0);
      const onOk = (state.tmp.kanaR === KANA.length && state.tmp.kanaC === 1);
      const bdBs = onBs ? '2px solid #fff' : '0';
      const bdOk = onOk ? '2px solid #fff' : '0';
      html += `<button data-act="bs" data-r="${KANA.length}" data-c="0" style="flex:1;padding:8px;background:#aa3030;border:${bdBs};border-radius:4px;color:#fff;cursor:pointer;">けす</button>`;
      html += `<button data-act="ok" data-r="${KANA.length}" data-c="1" style="flex:2;padding:8px;background:#3aae5a;border:${bdOk};border-radius:4px;color:#fff;cursor:pointer;">けってい</button>`;
      html += '</div>';
    } else if (state.titleStep.startsWith('look')) {
      html += '<div style="font-size:12px;margin-bottom:6px;color:#aaa;">12種類から見た目をえらぶ／矢印で選択・Z/Enterで決定</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">';
      PLAYER_LOOKS.forEach((L, li) => {
        const sel = L.id === state.tmp.looks[idx];
        const isCur = li === state.tmp.lookIdx;
        const bg = sel ? '#dac030' : (isCur ? '#555' : '#222');
        const bd = isCur ? '2px solid #fff' : '1px solid #555';
        html += `<button data-look="${L.id}" data-li="${li}" style="padding:4px;background:${bg};color:${sel ? '#000' : '#fff'};border:${bd};border-radius:4px;font-size:13px;cursor:pointer;">${lookLabel(L.id)}</button>`;
      });
      html += '</div>';
      html += `<div style="margin-top:6px;font-size:11px;color:#aaa;">選択中: ${lookLabel(state.tmp.looks[idx])}</div>`;
      html += '<button data-act="ok" style="margin-top:8px;width:100%;padding:8px;background:#3aae5a;border:0;border-radius:4px;color:#fff;cursor:pointer;">この見た目で決定(Z)</button>';
    } else if (state.titleStep === 'confirm') {
      html += '<div style="font-size:13px;margin-bottom:8px;">この3人で旅立ちますか？／矢印で選択・Z/Enterで決定</div>';
      for (let i = 0; i < 3; i++) {
        html += `<div style="margin:4px 0;font-size:13px;">${['主人公','仲間1','仲間2'][i]}: <b>${state.tmp.names[i]}</b>（${lookLabel(state.tmp.looks[i])}）</div>`;
      }
      const cs = state.tmp.confirmSel || 0;
      const bdBack = cs === 0 ? '2px solid #fff' : '0';
      const bdGo   = cs === 1 ? '2px solid #fff' : '0';
      html += '<div style="display:flex;gap:6px;margin-top:8px;">';
      html += `<button data-act="back" style="flex:1;padding:8px;background:#555;border:${bdBack};border-radius:4px;color:#fff;cursor:pointer;">最初から</button>`;
      html += `<button data-act="go" style="flex:2;padding:8px;background:#dac030;border:${bdGo};border-radius:4px;color:#000;font-weight:bold;cursor:pointer;">旅立つ！</button>`;
      html += '</div>';
    }

    d.innerHTML = html;
    bindNewGameUI();
    // 選択中ボタンを可視範囲に自動スクロール（スマホで十字キー操作時の見切れ対策）
    let selBtn = null;
    if (state.titleStep.startsWith('name')) {
      selBtn = d.querySelector('[data-r="' + state.tmp.kanaR + '"][data-c="' + state.tmp.kanaC + '"]');
    } else if (state.titleStep.startsWith('look')) {
      selBtn = d.querySelector('[data-li="' + state.tmp.lookIdx + '"]');
    } else if (state.titleStep === 'confirm') {
      selBtn = d.querySelector('[data-act="' + (state.tmp.confirmSel === 0 ? 'back' : 'go') + '"]');
    }
    if (selBtn && typeof selBtn.scrollIntoView === 'function') {
      try { selBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    }
  }

  function bindNewGameUI() {
    const d = document.getElementById('dialog');
    const idx = state.tmp.whoIdx;

    d.querySelectorAll('[data-kana]').forEach(b => {
      b.addEventListener('click', () => {
        // クリック位置にカーソルを移動
        if (b.dataset.r != null) state.tmp.kanaR = parseInt(b.dataset.r, 10);
        if (b.dataset.c != null) state.tmp.kanaC = parseInt(b.dataset.c, 10);
        if (state.tmp.names[idx].length >= 6) { renderNewGameStep(); return; }
        state.tmp.names[idx] += b.dataset.kana;
        renderNewGameStep();
      });
    });
    d.querySelectorAll('[data-look]').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.li != null) state.tmp.lookIdx = parseInt(b.dataset.li, 10);
        state.tmp.looks[idx] = b.dataset.look;
        renderNewGameStep();
      });
    });
    d.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'bs') {
          state.tmp.names[idx] = state.tmp.names[idx].slice(0, -1);
          renderNewGameStep();
        } else if (act === 'ok') {
          if (state.titleStep.startsWith('name')) {
            if (!state.tmp.names[idx]) { flashStatus('名前を入力してください'); return; }
            state.titleStep = 'look' + (idx + 1);
            // カーソル(lookIdx)をこの人のデフォルト見た目に合わせ直す（前の人の位置を引き継がない）
            state.tmp.lookIdx = PLAYER_LOOKS.findIndex(L => L.id === state.tmp.looks[idx]);
            if (state.tmp.lookIdx < 0) state.tmp.lookIdx = 0;
            renderNewGameStep();
          } else {
            // look確定 → 次の人 or 確認画面
            if (idx < 2) {
              state.tmp.whoIdx++;
              state.titleStep = 'name' + (state.tmp.whoIdx + 1);
              state.tmp.kanaR = 0; state.tmp.kanaC = 0;
            } else {
              state.titleStep = 'confirm';
            }
            renderNewGameStep();
          }
        } else if (act === 'back') {
          startNewGame();
        } else if (act === 'go') {
          finalizeNewGame();
        }
      });
    });
  }

  function finalizeNewGame() {
    state.party[0].name = state.tmp.names[0]; state.party[0].look = state.tmp.looks[0];
    state.party[1].name = state.tmp.names[1]; state.party[1].look = state.tmp.looks[1];
    state.party[2].name = state.tmp.names[2]; state.party[2].look = state.tmp.looks[2];
    // あきちゃん・みほさんは固有キャラ（NPCS定義のまま、上書きしない）
    // エンディング→タイトル→はじめから の場合 MAP 配列が Vingis 等のまま残っているので
    // 必ずヴィリニュスを再構築する
    buildVilnius();
    rebuildNPCs('vilnius');
    if (typeof rebuildSongs === 'function') rebuildSongs();
    resetFollowersToLeader();
    document.body.classList.remove('newgame-mode');
    state.scene = 'field';
    updateNewGameButtonLabels();
    render(); // ニューゲーム画面（「みっつ目の見た目をえらぶ」表示など）をクリアしてマップを描画
    audio.playBGM('field');
    saveGame();
    setDialog([
      'あなたは AKクワイア のメンバーとして、',
      'リトアニア音楽の祭典「ダイヌシュベンテ」で歌うため、',
      'はるばる リトアニア・ヴィリニュス にやってきた。',
      'ところが——歌う曲の歌詞をすっかり忘れてしまった！',
      'リトアニア国内に散らばった歌詞のピースを集めて、祭典で歌い上げよう。',
      '（操作：矢印 で移動、A=決定/話す、B=歌詞の記憶を確認）',
      '（緑の草むらでは戦闘あり。建物・人にAで話しかけよう）',
    ], () => {
      // オープニング閉幕後、目の前のあきちゃんに自動で話しかける
      const aki = NPCS.find(n => n.kind === 'akihiro');
      if (aki) talkNPC(aki);
    });
  }

  function openingResume() {
    setDialog([`おかえりなさい、${state.party[0].name}！ 旅をつづけよう。`]);
  }

  // ============================================================
  // フィールド描画
  // ============================================================
  // ============================================================
  // 建物紹介データ（Aボタン詳細パネル用）
  // ============================================================
  const BUILDING_INFO = {
    [T.INN]: {
      name: 'みほさんの宿屋',
      desc: 'みほさんが切り盛りする旅人の宿。\nぐっすり眠ればHP・MPが全回復。\n優しい笑顔とおいしいスープが疲れた魂を癒してくれる。',
    },
    [T.AKHALL]: {
      name: 'AKクワイア集会所',
      desc: 'あきちゃんが主催するクワイアの拠点。\nリトアニアと日本をつなぐ歌の橋渡し役。\n歌と笑顔の絶えない、旅のはじまりの場所。',
    },
    [T.RESTAURANT]: {
      name: 'シティホールのレストラン',
      desc: 'マンタスとイエヴァ夫婦が腕をふるう、\n旧市街でも評判の店。\nリトアニア料理の香りが客を呼ぶ。',
    },
    [T.SHOP]: {
      name: '雑貨屋',
      desc: '伝統工芸品から日用品まで揃う街角の店。\n店主のおばさんがリト語のあいさつを教えてくれる。',
    },
    [T.TOWNHALL]: {
      name: '旧市庁舎',
      desc: 'ヴィリニュスの旧市庁舎。\n新古典様式の白い建物が広場の中央に堂々と立つ。\n市民の集いの場。',
    },
    [T.CATHEDRAL]: {
      name: 'ヴィリニュス大聖堂',
      desc: 'リトアニア・カトリックの中心、\n白い列柱が美しい新古典様式の聖堂。\n隣の鐘楼とともに街のシンボル。',
    },
    [T.GEDIMINAS]: {
      name: 'ゲディミナス塔',
      desc: '13世紀の城跡。小高い丘の上から\nリトアニア国旗がはためき、\n旧市街と新市街を一望できる絶景スポット。',
    },
    [T.GATES]: {
      name: '夜明けの門',
      desc: 'ヴィリニュス旧市街の南の玄関口。\n門の上の聖母マリア像は奇跡を起こすと\n信じられている、巡礼の聖地。',
    },
    [T.ANNE]: {
      name: '聖アンナ教会',
      desc: '15世紀の赤レンガ後期ゴシック様式。\nナポレオンが「掌に乗せて持ち帰りたい」と\n言ったとされる、繊細な煉瓦のレース。',
    },
    [T.BERNARDINE]: {
      name: 'ベルナルディン教会',
      desc: '聖アンナ教会の真隣に並び立つ赤煉瓦の修道院教会。\n15〜16世紀ゴシック後期の重厚な堂と単塔。\n小さな聖アンナと、雄大なベルナルディンが\n寄り添う姿は旧市街屈指の景観。',
    },
    [T.VU]: {
      name: 'ヴィリニュス大学',
      desc: '1579年創立、東欧最古級の大学。\n13の中庭をもつ広大なキャンパスで、\n古い壁画と回廊が学生たちを見守ってきた。\n旧市街の知の中心地。',
    },
    [T.CROSSES]: {
      name: '三つの十字架の丘',
      desc: '街を見下ろす緑の丘の上に立つ\n白い3本の十字架。\n殉教したフランシスコ会士を悼んで建てられ、\nヴィリニュスの空に静かに祈りを捧げる。',
    },
    [T.PRESIDENT]: {
      name: '大統領官邸',
      desc: 'もとは司教の館、のち皇帝の邸。\nリトアニア独立後は大統領の公邸となった、\n白く優雅な新古典様式の宮殿。\n夏には衛兵交代のセレモニーも見られる。',
    },
    [T.UZUPIS]: {
      name: 'ウジュピス橋',
      desc: '川向こうの自称「ウジュピス共和国」へ渡る橋。\n芸術家たちが集う自由の地区で、\n独自の憲法と国歌、大統領まで持っている。\n街の中の小さな別世界。',
    },
    [T.PILIES]: {
      name: 'ピリエス通り',
      desc: '旧市街を南北に貫く最古の目抜き通り。\nお土産物・琥珀・木彫りの屋台が並び、\n観光客と地元客でいつも賑わう。\n（このタイルは通り抜けられる）',
    },
    [T.KAUNAS_CASTLE]: {
      name: 'カウナス城',
      desc: 'ネムナス川とネリス川の合流点に建つ\n14世紀の赤煉瓦の城。\nリトアニア大公国の防衛拠点だった。\n川面に映る塔が街の象徴。',
    },
    [T.CIURLIONIS]: {
      name: 'チョルリョーニス美術館',
      desc: 'リトアニアが誇る音楽家・画家\nM.K.チョルリョーニスの作品を収蔵。\n絵画と音楽の融合を体現した\n夢幻的な作品群が並ぶ。',
    },
  };

  // 都市別の建物情報オーバーライド（同一タイルを別都市で別建物として再利用するため）
  const BUILDING_INFO_BY_CITY = {
    klaipeda: {
      [T.TOWNHALL]: {
        name: 'クライペダ・ドラマ劇場',
        desc: 'クライペダの旧市街、テアトロ広場に面した劇場。\n海風と弦の音がよく似合う、街の文化の中心。\n地元のヴィオラ奏者マリアもここで演奏している。',
      },
      [T.RESTAURANT]: {
        name: '港町のレストラン',
        desc: 'バルト海で獲れた魚介と、\n街自慢のスモーク料理が看板の店。\n夜には地元の漁師たちで賑わう。',
      },
      [T.SHOP]: {
        name: 'コトリーナの雑貨屋',
        desc: '4姉妹の長女コトリーナが営む、\n古い譜面から船員のお土産まで揃う雑貨屋。\n娘のルツィアが店先で遊んでいる。',
      },
      [T.AKHALL]: {
        name: 'AKクワイア集会所（クライペダ仮設）',
        desc: 'あきちゃんが各地に置いている拠点のひとつ。\n地元の歌い手も自由に立ち寄れる、開かれた歌の場。',
      },
    },
    kaunas: {
      [T.RESTAURANT]: {
        name: 'カウナスのレストラン',
        desc: 'ツェペリナイ（じゃがいも団子）が名物の店。\n川風が抜ける広場に面した憩いの場。',
      },
      [T.AKHALL]: {
        name: 'AKクワイア集会所（カウナス仮設）',
        desc: 'あきちゃんが各地に置いている拠点のひとつ。\n旅の途中で寄っても、必ず誰かが歌っている。',
      },
    },
    siauliai: {
      [T.INN]: {
        name: 'amiシャウレイ',
        desc: 'みほさんが切り盛りする街の宿。\n窓からは十字架の丘の方角を望める。',
      },
      [T.AKHALL]: {
        name: 'AKクワイア集会所（シャウレイ仮設）',
        desc: 'あきちゃんが各地に置いている拠点のひとつ。\n北リトアニアの澄んだ空気が、声をよく通すらしい。',
      },
      [T.RESTAURANT]: {
        name: 'シャウレイのパン屋',
        desc: 'ライ麦をじっくり発酵させて焼く黒パンが看板。\n蜂蜜酒と一緒に齧るのが地元の流儀。\nおつかいの注文も受けてくれる。',
      },
      [T.SHOP]: {
        name: 'シャウレイの雑貨屋',
        desc: '十字架の丘へ供える木彫りの十字架や、\n旅人向けの絵葉書、地元の蜂蜜など。',
      },
      [T.TOWNHALL]: {
        name: 'シャウレイの民家',
        desc: '北リトアニアの伝統的な木造家屋。\n小さな菜園と、軒先に下げられた乾燥ハーブが目印。',
      },
      [T.CROSSES]: {
        name: '十字架の丘 (Kryžių kalnas)',
        desc: '無数の十字架が立ち並ぶ巡礼の聖地。\nソ連時代に何度ブルドーザーで撤去されても、\n人々が夜のあいだに新しい十字架を立て直し続けた。\n祈りと抵抗の象徴として、今も増え続けている。',
      },
    },
    trakai: {
      [T.KAUNAS_CASTLE]: {
        name: 'トラカイ城',
        desc: 'ガルヴェ湖に浮かぶ赤煉瓦の島城。\n14〜15世紀リトアニア大公国の中心地のひとつ。\n湖面に映る塔と橋が、童話のような風景を作る。',
      },
      [T.INN]: {
        name: 'amiトラカイ',
        desc: 'みほさんが切り盛りする湖畔の宿。\n窓を開ければ城と湖が一望できる特等席。',
      },
      [T.AKHALL]: {
        name: 'AKクワイア集会所（トラカイ仮設）',
        desc: 'あきちゃんが各地に置いている拠点のひとつ。\n湖畔で歌うと声がよく響くのだそう。',
      },
      [T.RESTAURANT]: {
        name: '湖畔のレストラン',
        desc: 'カライム民族伝統の「カライム風キビナイ」が名物。\n湖を眺めながら、香ばしい焼き立てを味わえる。',
      },
      [T.SHOP]: {
        name: 'トラカイの雑貨屋',
        desc: '城観光のお土産品から、漁師道具まで揃う街角の店。\n湖の魚を干した珍味も売っている。',
      },
      [T.TOWNHALL]: {
        name: 'カライム民族の家',
        desc: 'トラカイに古くから住むカライム民族の伝統家屋。\n3つの窓（家族・神・大公）を持つ独特な建物様式。',
      },
    },
  };

  function openBuildingInfo(t, fx, fy) {
    const cityOverride = (BUILDING_INFO_BY_CITY[state.cityKey] || {})[t];
    const info = cityOverride || BUILDING_INFO[t];
    if (!info) return;
    state._prevScene = state.scene;
    state.scene = 'buildingInfo';
    state.buildingInfoT = t;
    state._buildingFx = (fx != null) ? fx : null;
    state._buildingFy = (fy != null) ? fy : null;
    renderBuildingInfo();
    const d = document.getElementById('dialog');
    let html = '<div style="font-weight:bold;font-size:14px;color:#dac030;margin-bottom:6px;">' + info.name + '</div>';
    html += '<div style="font-size:13px;line-height:1.6;white-space:pre-wrap;">' + info.desc + '</div>';
    html += '<div style="margin-top:8px;font-size:11px;color:#888;">▼ A/B で閉じる</div>';
    d.innerHTML = html;
  }
  function closeBuildingInfo() {
    const t = state.buildingInfoT;
    const fx = state._buildingFx;
    const fy = state._buildingFy;
    state.scene = 'field';
    state._prevScene = null;
    state.buildingInfoT = null;
    state._buildingFx = null;
    state._buildingFy = null;
    document.getElementById('dialog').textContent = '';
    // 機能のある建物はパネル閉じ後にインタラクションをチェーン
    const FUNCTIONAL = [T.INN, T.AKHALL, T.GATES];
    if (FUNCTIONAL.indexOf(t) >= 0 && fx != null && fy != null) {
      checkLandmark(t, fx, fy);
    } else if (t === T.RESTAURANT) {
      // レストランは料理紹介をチェーン
      const foodKey = (RESTAURANT_FOOD_BY_CITY || {})[state.cityKey];
      if (foodKey) { openFoodInfo(foodKey); return; }
      render();
    } else {
      render();
    }
  }

  // ========== 料理紹介 ==========
  const FOODS = {
    sakotis: {
      name: 'シャコティス（Šakotis）',
      desc: 'リトアニアの祝い菓子。回転する鉄串に卵黄たっぷりの生地を\n何度も垂らして焼き上げる、樹氷のような円錐ケーキ。\n結婚式やクリスマスで主役を飾る、リトアニアの誇り。',
      draw: 'sakotis',
    },
    tsepelinai: {
      name: 'ツェペリナイ（Cepelinai）',
      desc: 'リトアニアの国民食。すりおろしジャガイモで生地を作り、\n中に肉や白カビチーズを包んで茹で上げる、巨大な飛行船型の団子。\nサワークリームと炒めたベーコンのソースで一気に食べる。',
      draw: 'tsepelinai',
    },
    herring: {
      name: '燻製ニシン（Rūkyta silkė）',
      desc: 'バルト海の漁港クライペダの名物。表面は燻香で琥珀色、\n身は塩気を残しながらしっとり。黒パンと一緒に齧り、\nクヴァスや蜂蜜酒で流すのが地元の流儀。',
      draw: 'herring',
    },
    karaim: {
      name: 'カライム風キビナイ（Kibinai）',
      desc: 'トラカイのカライム民族に伝わる半月形の包み焼き。\n薄い卵黄の生地に、羊肉とタマネギをぎゅっと閉じ込める。\nヘリの編みは祈りの紐の象徴。湖の風と一緒にどうぞ。',
      draw: 'karaim',
    },
    rye_bread: {
      name: '黒パン（Juoda duona）',
      desc: 'ライ麦をじっくり発酵させて焼き上げる、リトアニアの主食。\n外はかちっと、中はしっとり。キャラウェイの香りが鼻に抜ける。\n燻製肉、蜂蜜、湖の魚── どんな食事にも添えられる素朴な相棒。',
      draw: 'rye_bread',
    },
  };
  const RESTAURANT_FOOD_BY_CITY = {
    vilnius:  'sakotis',
    kaunas:   'tsepelinai',
    klaipeda: 'herring',
    trakai:   'karaim',
    siauliai: 'rye_bread',
  };

  // ============================================================
  // おつかいクエスト（料理を運ぶ → ピース獲得）
  // ============================================================
  // 各クエストは3段階のフラグで進行する：
  //   {id}_req   : 依頼を受けた（NPC初回会話で設定）
  //   {id}_carry : 持ち帰り中（ソース都市レストランで購入後に設定）
  //   {id}_done  : 受け渡し完了（依頼NPCに渡してピース獲得後に設定）
  const FETCH_QUESTS = {
    fq_kibinai: {
      requesterName:  'カウナスの老人',
      requesterCity:  'kaunas',
      sourceCity:     'vilnius',
      foodLabel:      'ヴィリニュスのキビナイ',
      price:          25,
      rewardSong:     'soran',
    },
    fq_kvas: {
      requesterName:  'ルツィア',
      requesterCity:  'klaipeda',
      sourceCity:     'kaunas',
      foodLabel:      'カウナスのクヴァス',
      price:          15,
      rewardSong:     'dynamic',
    },
    fq_rye: {
      requesterName:  'マンタス',
      requesterCity:  'vilnius',
      sourceCity:     'siauliai',
      foodLabel:      'シャウレイの黒パン',
      price:          12,
      rewardSong:     'kur',
    },
  };
  // 現在地に「持ち帰り購入できる」アクティブクエストを返す
  function activeFetchAtSource() {
    const f = state.flags || {};
    for (const id in FETCH_QUESTS) {
      const q = FETCH_QUESTS[id];
      if (q.sourceCity !== state.cityKey) continue;
      if (!f[id + '_req']) continue;
      if (f[id + '_carry']) continue;
      if (f[id + '_done']) continue;
      return { id, ...q };
    }
    return null;
  }

  function openFoodInfo(key) {
    const food = FOODS[key];
    if (!food) return;
    state.scene = 'foodInfo';
    state.foodKey = key;
    renderFoodInfo();
    const d = document.getElementById('dialog');
    let html = '<div style="font-weight:bold;font-size:14px;color:#dac030;margin-bottom:6px;">' + food.name + '</div>';
    html += '<div style="font-size:13px;line-height:1.6;white-space:pre-wrap;">' + food.desc + '</div>';
    html += '<div style="margin-top:8px;font-size:11px;color:#888;">▼ A/B で閉じる</div>';
    d.innerHTML = html;
  }
  function closeFoodInfo() {
    state.scene = 'field';
    state.foodKey = null;
    document.getElementById('dialog').textContent = '';
    render();
    // おつかい品の購入プロンプト（依頼を受けていて、まだ持ち帰っていない場合）
    const q = activeFetchAtSource();
    if (q) {
      const canAfford = state.gold >= q.price;
      const intro = [
        `（${q.requesterName}に頼まれた「${q.foodLabel}」、ここで持ち帰り注文できる…）`,
        `店主：「テイクアウトなら €${q.price} ですよ。 包んで差し上げますか？」`,
      ];
      const choices = canAfford
        ? [`持ち帰る（€${q.price}）`, 'やめる']
        : [`持ち帰る（€${q.price}） — 所持金不足`, 'やめる'];
      setDialog(intro, null, choices, (i) => {
        if (i !== 0) {
          setDialog(['店主：「またのお越しを。」']);
          return;
        }
        if (!canAfford) {
          setDialog(['（…所持金が足りない。 €' + q.price + ' 必要だ。）']);
          return;
        }
        state.gold -= q.price;
        state.flags[q.id + '_carry'] = true;
        saveGame();
        setDialog([
          `店主：「ありがとうございます。 ── ほら、できあがり。」`,
          `【${q.foodLabel}（おつかい用） を入手！】`,
          `（${q.requesterName}に届けよう。）`,
        ]);
      });
    }
  }
  function renderFoodInfo() {
    const key = state.foodKey;
    const food = FOODS[key];
    if (!food) return;
    drawFoodDetail(food.draw);
    // 古地図風の角飾り
    ctx.strokeStyle = '#dac030'; ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, CANVAS_W - 12, CANVAS_H - 12);
    ctx.strokeStyle = '#7a5020'; ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, CANVAS_W - 20, CANVAS_H - 20);
  }
  function drawFoodDetail(key) {
    if (key === 'sakotis')   { drawSakotisDetail();   return; }
    if (key === 'tsepelinai'){ drawTsepelinaiDetail();return; }
    if (key === 'herring')   { drawHerringDetail();   return; }
    if (key === 'karaim')    { drawKaraimDetail();    return; }
    if (key === 'rye_bread') { drawRyeBreadDetail();  return; }
  }

  // 木のテーブル背景＋皿（料理絵共通の下地）
  function drawWoodTable(plateW, plateH, plateColor) {
    // 暖色グラデ
    for (let y = 0; y < CANVAS_H; y++) {
      const t = y / CANVAS_H;
      const rr = Math.floor(95 + t * 35);
      const gg = Math.floor(60 + t * 22);
      const bb = Math.floor(34 + t * 10);
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      ctx.fillRect(0, y, CANVAS_W, 1);
    }
    // 木目
    ctx.strokeStyle = 'rgba(48,26,10,0.45)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const yy = 30 + i * 50 + (i % 2 ? 8 : 0);
      ctx.moveTo(-10, yy);
      ctx.bezierCurveTo(120, yy - 6, 260, yy + 8, 400, yy - 2);
      ctx.stroke();
    }
    // 節
    ctx.fillStyle = 'rgba(40,20,8,0.5)';
    ctx.beginPath(); ctx.ellipse(80, 110, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(310, 250, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ツェペリナイ（ラグビーボール型のジャガイモ団子2つ＋サワークリームソース＋カリカリベーコン）
  function drawTsepelinaiDetail() {
    drawWoodTable();
    const cx = 192, cy = 220;

    // ===== 湯気（皿の前に下地として描いて団子で隠す） =====
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const sx = cx - 40 + i * 40;
      ctx.moveTo(sx, cy - 40);
      ctx.bezierCurveTo(sx - 14, cy - 70, sx + 14, cy - 100, sx - 6, cy - 140);
      ctx.stroke();
    }

    // ===== 皿（楕円・厚みあり）=====
    // 落ち影
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath(); ctx.ellipse(cx + 6, cy + 78, 158, 16, 0, 0, Math.PI * 2); ctx.fill();
    // 皿の側面
    ctx.fillStyle = '#cfc7a8';
    ctx.beginPath(); ctx.ellipse(cx, cy + 70, 168, 28, 0, 0, Math.PI * 2); ctx.fill();
    // 皿の上面
    ctx.fillStyle = '#f4ecd4';
    ctx.beginPath(); ctx.ellipse(cx, cy + 60, 168, 26, 0, 0, Math.PI * 2); ctx.fill();
    // 皿の窪み（料理が乗る面）
    ctx.fillStyle = '#e0d6b4';
    ctx.beginPath(); ctx.ellipse(cx, cy + 60, 142, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ece2bc';
    ctx.beginPath(); ctx.ellipse(cx, cy + 56, 138, 18, 0, 0, Math.PI * 2); ctx.fill();
    // 皿の縁ハイライト
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(cx - 40, cy + 47, 70, 3.5, -0.15, 0, Math.PI * 2); ctx.stroke();

    // ===== 団子（横向きラグビーボール型・前後2本並び） =====
    // w=横半径(長径), h=縦半径(短径) で 横長の紡錘形＝ツェペリナイ＝飛行船型
    const drawCepelinas = (zx, zy, w, h, tilt) => {
      ctx.save();
      ctx.translate(zx, zy);
      ctx.rotate(tilt);

      // 落ち影
      ctx.fillStyle = 'rgba(60,40,20,0.42)';
      ctx.beginPath();
      ctx.ellipse(4, h * 0.65, w * 1.0, h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      // 本体（横向きの紡錘形：左右が尖って中央がふくらむ）
      const body = new Path2D();
      body.moveTo(-w, 0);                                                // 左尖端
      body.bezierCurveTo(-w * 0.55, -h * 1.0,  w * 0.55, -h * 1.0,  w, 0); // 上ふくらみ
      body.bezierCurveTo( w * 0.55,  h * 1.0, -w * 0.55,  h * 1.0, -w, 0); // 下ふくらみ

      // ベース色（じゃがいも団子のグレーがかったクリーム色 / 上が明るく下が暗い）
      const grad = ctx.createLinearGradient(0, -h, 0, h);
      grad.addColorStop(0,   '#f4ead0');
      grad.addColorStop(0.55,'#dccfa6');
      grad.addColorStop(1,   '#9a8c6c');
      ctx.fillStyle = grad;
      ctx.fill(body);

      // 上部の光沢（湿ったハイライト）
      ctx.save();
      ctx.clip(body);
      ctx.fillStyle = 'rgba(255,250,220,0.55)';
      ctx.beginPath(); ctx.ellipse(-w * 0.2, -h * 0.55, w * 0.55, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,240,0.85)';
      ctx.beginPath(); ctx.ellipse(-w * 0.25, -h * 0.6, w * 0.3, h * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // 左右の閉じ口（団子をひねって閉じた跡）
      ctx.fillStyle = 'rgba(80,60,30,0.7)';
      ctx.beginPath(); ctx.ellipse(-w + 3, 0, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( w - 3, 0, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill();

      // 輪郭線（はっきりさせるため）
      ctx.strokeStyle = 'rgba(70,50,25,0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke(body);

      ctx.restore();
    };

    // 横置きで2本、前後に並べる（奥に1本・手前に1本）
    drawCepelinas(cx - 6, cy + 14, 92, 36, -0.04); // 奥
    drawCepelinas(cx + 8, cy + 46, 96, 38,  0.05); // 手前

    // ===== サワークリームソース（手前の団子の上から白くかかる） =====
    const drawSourCream = (sx, sy, sw, sh) => {
      // 不規則な形にするためのポイント
      ctx.fillStyle = '#fafaf0';
      ctx.beginPath();
      ctx.moveTo(sx - sw, sy);
      ctx.bezierCurveTo(sx - sw * 0.6, sy - sh,  sx + sw * 0.4, sy - sh * 0.85, sx + sw, sy - 2);
      ctx.bezierCurveTo(sx + sw * 0.7, sy + sh * 0.7, sx - sw * 0.6, sy + sh * 0.6, sx - sw, sy);
      ctx.fill();
      // 上面ハイライト
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(sx - sw * 0.15, sy - sh * 0.4, sw * 0.6, sh * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      // 縁の薄い影
      ctx.strokeStyle = 'rgba(180,170,140,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx - sw, sy);
      ctx.bezierCurveTo(sx - sw * 0.6, sy - sh,  sx + sw * 0.4, sy - sh * 0.85, sx + sw, sy - 2);
      ctx.stroke();
    };
    // 手前の団子（cx+8, cy+46 / w=96, h=38）の上面にかける
    drawSourCream(cx + 6, cy + 32, 70, 12);
    // 奥の団子の上にも少しだけ
    drawSourCream(cx - 12, cy + 2, 50, 8);

    // ===== カリカリベーコン＆玉ねぎ（spirgučiai） =====
    // サワークリームのエリア上に集中して散らす
    const baconCol = ['#5a2a10', '#7a3818', '#a05028', '#c06030'];
    const onionCol = ['#f0e0a8', '#d8c080'];
    const sprinkle = (sx, sy, sw, sh, count) => {
      for (let k = 0; k < count; k++) {
        const ang = k * 2.39;
        const r = (k * 7 % 100) / 100; // 0..1
        const bx = sx + Math.cos(ang) * sw * r;
        const by = sy + Math.sin(ang) * sh * r;
        if (k % 5 === 0) {
          ctx.fillStyle = onionCol[k % 2];
          ctx.fillRect(bx | 0, by | 0, 3, 2);
        } else {
          ctx.fillStyle = baconCol[k % 4];
          ctx.fillRect(bx | 0, by | 0, 3 + (k % 2), 2);
          if (k % 3 === 0) {
            ctx.fillStyle = '#e08040';
            ctx.fillRect((bx | 0), (by | 0), 1, 1);
          }
        }
      }
    };
    sprinkle(cx + 6, cy + 32, 60, 10, 22);
    sprinkle(cx - 12, cy + 2, 40, 6, 10);

    // ===== ディル（緑の葉・付け合わせ） =====
    const drawDill = (dx, dy, flip) => {
      ctx.save();
      ctx.translate(dx, dy);
      if (flip) ctx.scale(-1, 1);
      // 茎
      ctx.strokeStyle = '#3a8a4a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(4, -8, 8, -16, 6, -22);
      ctx.stroke();
      // 葉（細かい羽状）
      ctx.strokeStyle = '#4ca85a';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const yy = -2 - i * 3.5;
        const xx = i * 1.0;
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx - 7, yy - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(xx + 1, yy + 1);
        ctx.lineTo(xx + 8, yy - 3);
        ctx.stroke();
      }
      ctx.restore();
    };
    drawDill(cx - 110, cy + 50, false);
    drawDill(cx + 110, cy + 50, true);
  }

  // 燻製ニシン（皿の上の銀色〜琥珀色の魚＋ハーブ＋レモン）
  function drawHerringDetail() {
    drawWoodTable();
    // 落ち影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(196, 350, 130, 14, 0, 0, Math.PI * 2); ctx.fill();
    // 皿
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath(); ctx.ellipse(192, 338, 156, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e8ee';
    ctx.beginPath(); ctx.ellipse(192, 332, 150, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b0b0b8';
    ctx.beginPath(); ctx.ellipse(192, 336, 130, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4f4fa';
    ctx.beginPath(); ctx.ellipse(192, 330, 124, 14, 0, 0, Math.PI * 2); ctx.fill();

    // ===== 魚本体 =====
    ctx.save();
    ctx.translate(192, 320);
    ctx.rotate(-0.1);
    // 体の影
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 6, 130, 28, 0, 0, Math.PI * 2); ctx.fill();
    // 腹（明るい銀）
    ctx.fillStyle = '#e8e0c0';
    ctx.beginPath(); ctx.ellipse(0, 4, 124, 24, 0, 0, Math.PI * 2); ctx.fill();
    // 背中（燻香の琥珀〜茶）
    const grad = ctx.createLinearGradient(0, -18, 0, 4);
    grad.addColorStop(0, '#5a2a10');
    grad.addColorStop(0.5, '#a05820');
    grad.addColorStop(1, '#d8a058');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(0, -4, 122, 18, 0, 0, Math.PI, true); ctx.fill();
    // 銀の側線
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-115, 2); ctx.bezierCurveTo(-40, -1, 40, 5, 115, 2); ctx.stroke();
    // 鱗パターン
    ctx.strokeStyle = 'rgba(80,40,10,0.5)';
    ctx.lineWidth = 1;
    for (let k = -100; k <= 100; k += 12) {
      ctx.beginPath();
      ctx.arc(k, -2, 7, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    // 尾びれ
    ctx.fillStyle = '#7a3818';
    ctx.beginPath();
    ctx.moveTo(120, -2);
    ctx.lineTo(154, -22);
    ctx.lineTo(150, 0);
    ctx.lineTo(154, 22);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b06028';
    ctx.beginPath();
    ctx.moveTo(120, -2);
    ctx.lineTo(146, -16);
    ctx.lineTo(146, 12);
    ctx.closePath(); ctx.fill();
    // 背びれ
    ctx.fillStyle = '#6a3010';
    ctx.beginPath();
    ctx.moveTo(-20, -18);
    ctx.lineTo(-10, -28);
    ctx.lineTo(8, -27);
    ctx.lineTo(20, -18);
    ctx.closePath(); ctx.fill();
    // 頭
    ctx.fillStyle = '#7a4018';
    ctx.beginPath(); ctx.ellipse(-110, -2, 22, 18, -0.1, 0, Math.PI * 2); ctx.fill();
    // エラぶた
    ctx.strokeStyle = '#3a1808'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(-100, 0, 14, -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
    // 目
    ctx.fillStyle = '#fff8d8';
    ctx.beginPath(); ctx.arc(-117, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0a04';
    ctx.beginPath(); ctx.arc(-118, -4, 2.2, 0, Math.PI * 2); ctx.fill();
    // 口
    ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-130, 4); ctx.lineTo(-118, 6); ctx.stroke();
    // ハイライト
    ctx.fillStyle = 'rgba(255,255,235,0.5)';
    ctx.beginPath(); ctx.ellipse(-30, -10, 50, 3, -0.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ===== レモンのくし切り =====
    ctx.save();
    ctx.translate(82, 326);
    ctx.rotate(-0.4);
    ctx.fillStyle = '#3a2a08';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-32, -8); ctx.lineTo(-32, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f8d040';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-30, -7); ctx.lineTo(-30, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fce888';
    ctx.beginPath();
    ctx.moveTo(-2, 0); ctx.lineTo(-26, -5); ctx.lineTo(-26, 5); ctx.closePath(); ctx.fill();
    // 果肉のスジ
    ctx.strokeStyle = 'rgba(220,150,40,0.65)';
    ctx.lineWidth = 1;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(-26, k * 4);
      ctx.stroke();
    }
    ctx.restore();

    // ===== ディル =====
    ctx.strokeStyle = '#3a8a4a'; ctx.lineWidth = 1.4;
    const dill = (dx, dy, n) => {
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + 4, dy - 18); ctx.stroke();
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        const yy = dy - 2 - i * 3;
        ctx.moveTo(dx + i, yy); ctx.lineTo(dx + i - 6, yy - 4); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx + i + 1, yy + 1); ctx.lineTo(dx + i + 7, yy - 3); ctx.stroke();
      }
    };
    dill(298, 332, 5);
    dill(312, 326, 4);

    // ===== 黒コショウ・塩の粒 =====
    ctx.fillStyle = '#2a1a08';
    for (let k = 0; k < 12; k++) {
      const px = 130 + (k * 17) % 130;
      const py = 348 + (k * 7) % 6;
      ctx.fillRect(px, py, 1, 1);
    }
    ctx.fillStyle = 'rgba(255,255,250,0.85)';
    for (let k = 0; k < 14; k++) {
      const px = 140 + (k * 13) % 110;
      const py = 350 + (k * 11) % 5;
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // カライム風キビナイ（半月形の包み焼き、3つ）
  function drawKaraimDetail() {
    drawWoodTable();
    // 木の皿（円形）
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(196, 354, 140, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a3818';
    ctx.beginPath(); ctx.ellipse(192, 342, 152, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5028';
    ctx.beginPath(); ctx.ellipse(192, 338, 144, 20, 0, 0, Math.PI * 2); ctx.fill();
    // 木目（皿の上）
    ctx.strokeStyle = 'rgba(40,20,8,0.5)'; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(192, 338 - k * 4, 140 - k * 6, 18 - k * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ===== キビナイ3つ（半月形）=====
    const drawKibinas = (kx, ky, scale, rot) => {
      ctx.save();
      ctx.translate(kx, ky);
      ctx.rotate(rot);
      // 影
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(2, 6, 60 * scale, 30 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      // 本体（黄金色のパイ生地）— 半円
      const grad = ctx.createLinearGradient(0, -28 * scale, 0, 28 * scale);
      grad.addColorStop(0, '#e8a040');
      grad.addColorStop(0.5, '#c8782a');
      grad.addColorStop(1, '#7a4818');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 60 * scale, 30 * scale, 0, Math.PI, 0); // 上半月
      ctx.lineTo(60 * scale, 0);
      ctx.lineTo(-60 * scale, 0);
      ctx.closePath();
      ctx.fill();
      // 下のなだらかな膨らみ
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 4, 56 * scale, 8 * scale, 0, 0, Math.PI);
      ctx.fill();
      // ハイライト（左上）
      ctx.fillStyle = 'rgba(255,230,170,0.7)';
      ctx.beginPath();
      ctx.ellipse(-18 * scale, -14 * scale, 26 * scale, 5 * scale, -0.15, 0, Math.PI * 2);
      ctx.fill();
      // 焦げの斑点
      ctx.fillStyle = 'rgba(70,30,10,0.7)';
      for (let k = 0; k < 8; k++) {
        const ang = -Math.PI + (k / 7) * Math.PI;
        const r = 50 * scale;
        ctx.fillRect(Math.cos(ang) * r * 0.85 | 0, Math.sin(ang) * r * 0.5 - 6 | 0, 2, 1);
      }
      // 編み目（半月の弧に沿って）— カライムの祈りの紐
      ctx.strokeStyle = '#5a2810'; ctx.lineWidth = 1.5;
      for (let k = -8; k <= 8; k++) {
        const ang = (k / 16) * Math.PI - Math.PI / 2;
        const x1 = Math.cos(ang) * 56 * scale;
        const y1 = Math.sin(ang) * 26 * scale;
        const x2 = Math.cos(ang) * 60 * scale;
        const y2 = Math.sin(ang) * 30 * scale;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      // 縁の編みハイライト
      ctx.strokeStyle = 'rgba(255,200,140,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, 56 * scale, 26 * scale, 0, Math.PI + 0.2, -0.2);
      ctx.stroke();
      ctx.restore();
    };
    drawKibinas(120, 290, 0.85, -0.15);
    drawKibinas(200, 270, 1.0, 0.05);
    drawKibinas(282, 296, 0.9, 0.18);

    // 小麦粉のダスト
    ctx.fillStyle = 'rgba(255,250,235,0.7)';
    for (let k = 0; k < 30; k++) {
      const px = 80 + (k * 13 + (k * k) % 19) % 230;
      const py = 332 + (k * 7) % 14;
      if ((k * 3) % 4 !== 0) ctx.fillRect(px | 0, py | 0, 1, 1);
    }

    // パセリ（緑の葉）
    ctx.fillStyle = '#3a7a3a';
    ctx.beginPath(); ctx.arc(310, 330, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a5a2a';
    ctx.beginPath(); ctx.arc(312, 332, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // 黒パン（ライ麦の塊と切り分けた一切れ）
  function drawRyeBreadDetail() {
    drawWoodTable();
    // まな板の影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(50, 350, 290, 12);
    // 木のまな板
    ctx.fillStyle = '#7a4818';
    ctx.fillRect(46, 270, 296, 80);
    ctx.fillStyle = '#a06820';
    ctx.fillRect(50, 270, 290, 76);
    // まな板の木目
    ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      const yy = 282 + k * 14;
      ctx.moveTo(50, yy);
      ctx.bezierCurveTo(140, yy - 4, 240, yy + 5, 340, yy);
      ctx.stroke();
    }
    // まな板の取手
    ctx.fillStyle = '#7a4818';
    ctx.fillRect(338, 296, 28, 20);
    ctx.beginPath(); ctx.arc(360, 306, 3, 0, Math.PI * 2); ctx.fillStyle = '#2a1408'; ctx.fill();

    // ===== 大きなパンの塊（楕円形）=====
    ctx.save();
    ctx.translate(140, 220);
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(4, 80, 92, 20, 0, 0, Math.PI * 2); ctx.fill();
    // 本体（濃い茶色）
    const grad = ctx.createRadialGradient(-20, -10, 10, 0, 20, 100);
    grad.addColorStop(0, '#6a3818');
    grad.addColorStop(0.5, '#4a2810');
    grad.addColorStop(1, '#2a1408');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(0, 30, 88, 56, 0, 0, Math.PI * 2); ctx.fill();
    // 外皮の質感（ひびと粉）
    ctx.strokeStyle = 'rgba(20,10,4,0.7)'; ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      const sx = -60 + k * 20;
      ctx.moveTo(sx, -10);
      ctx.bezierCurveTo(sx + 5, 20, sx - 5, 50, sx + 8, 80);
      ctx.stroke();
    }
    // 上面のキャラウェイシード
    ctx.fillStyle = '#1a0a04';
    for (let k = 0; k < 22; k++) {
      const ang = (k * 1.7) % (Math.PI * 2);
      const dist = 50 + (k * 3 % 28);
      const sx = Math.cos(ang) * dist;
      const sy = -10 + Math.sin(ang) * dist * 0.4 + (k % 5);
      ctx.fillRect(sx | 0, sy | 0, 2, 1);
    }
    // ハイライト
    ctx.fillStyle = 'rgba(180,120,60,0.45)';
    ctx.beginPath(); ctx.ellipse(-22, -4, 40, 8, -0.1, 0, Math.PI * 2); ctx.fill();
    // 粉の白
    ctx.fillStyle = 'rgba(240,220,180,0.55)';
    for (let k = 0; k < 28; k++) {
      const px = -70 + (k * 11) % 140;
      const py = -30 + (k * 7) % 100;
      ctx.fillRect(px | 0, py | 0, 1, 1);
    }
    ctx.restore();

    // ===== 切り分けた一切れ（断面が見える）=====
    ctx.save();
    ctx.translate(280, 290);
    ctx.rotate(0.15);
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-44, 32, 90, 8);
    // クラム（中身：ライ麦のしっとり感）
    ctx.fillStyle = '#7a5028';
    ctx.fillRect(-44, -28, 88, 60);
    // 気泡
    ctx.fillStyle = '#4a2810';
    for (let k = 0; k < 14; k++) {
      const px = -38 + (k * 13) % 78;
      const py = -22 + (k * 19) % 50;
      const rr = 1 + (k % 4);
      ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
    }
    // 上下のクラスト（外皮）
    ctx.fillStyle = '#2a1408';
    ctx.fillRect(-44, -34, 88, 8);
    ctx.fillRect(-44, 28, 88, 6);
    // 表面のキャラウェイ
    ctx.fillStyle = '#0a0402';
    for (let k = 0; k < 8; k++) {
      ctx.fillRect(-36 + k * 11, -32, 2, 1);
    }
    // ハイライト
    ctx.fillStyle = 'rgba(255,220,170,0.4)';
    ctx.fillRect(-42, -18, 30, 2);
    ctx.restore();

    // 蜂蜜の小皿（黄金色の点）
    ctx.fillStyle = '#3a2008';
    ctx.beginPath(); ctx.arc(78, 320, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dac030';
    ctx.beginPath(); ctx.arc(78, 318, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4e060';
    ctx.beginPath(); ctx.arc(75, 315, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,200,0.7)';
    ctx.beginPath(); ctx.arc(73, 314, 2, 0, Math.PI * 2); ctx.fill();
  }

  // シャコティス（リトアニアの伝統円錐ケーキ）
  function drawSakotisDetail() {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 木のテーブル背景（暖色グラデ）
    for (let y = 0; y < CANVAS_H; y++) {
      const t = y / CANVAS_H;
      const rr = Math.floor(95 + t * 35);
      const gg = Math.floor(60 + t * 22);
      const bb = Math.floor(34 + t * 10);
      r(0, y, CANVAS_W, 1, `rgb(${rr},${gg},${bb})`);
    }
    // 木目
    ctx.strokeStyle = 'rgba(48,26,10,0.45)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const yy = 30 + i * 50 + (i % 2 ? 8 : 0);
      ctx.moveTo(-10, yy);
      ctx.bezierCurveTo(120, yy - 6, 260, yy + 8, 400, yy - 2);
      ctx.stroke();
    }
    // 節
    ctx.fillStyle = 'rgba(40,20,8,0.5)';
    ctx.beginPath(); ctx.ellipse(80, 110, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(310, 250, 6, 3, 0, 0, Math.PI * 2); ctx.fill();

    // 落ち影（テーブル上）
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(208, 350, 95, 10, 0, 0, Math.PI * 2); ctx.fill();

    // 皿
    ctx.fillStyle = '#5a4028';
    ctx.beginPath(); ctx.ellipse(192, 350, 152, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e0c8';
    ctx.beginPath(); ctx.ellipse(192, 342, 146, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bcb498';
    ctx.beginPath(); ctx.ellipse(192, 345, 130, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4ecd4';
    ctx.beginPath(); ctx.ellipse(192, 341, 125, 12, 0, 0, Math.PI * 2); ctx.fill();
    // 皿ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(140, 335, 30, 3, -0.2, 0, Math.PI * 2); ctx.fill();

    // ===== シャコティス本体 =====
    const cx = 192;
    const baseY = 334;
    const topY = 78;
    const totalH = baseY - topY;
    const layers = 14;

    for (let i = layers - 1; i >= 0; i--) {
      const t = i / (layers - 1); // 0=top, 1=bottom
      const yy = topY + t * totalH;
      const layerH = (totalH / layers) + 1;
      const halfW = 7 + t * 48; // 上7 → 下55

      const baseR = Math.floor(208 - t * 55);
      const baseG = Math.floor(142 - t * 38);
      const baseB = Math.floor(62 - t * 22);
      const body      = `rgb(${baseR},${baseG},${baseB})`;
      const bodyShade = `rgb(${Math.floor(baseR * 0.65)},${Math.floor(baseG * 0.65)},${Math.floor(baseB * 0.6)})`;
      const bodyHi    = `rgb(${Math.min(255, baseR + 32)},${Math.min(255, baseG + 28)},${Math.min(255, baseB + 18)})`;
      const bodyDeep  = `rgb(${Math.floor(baseR * 0.45)},${Math.floor(baseG * 0.4)},${Math.floor(baseB * 0.35)})`;

      // 枝（突起）— 左右に複数本
      const spikes = 2 + Math.floor(t * 2);
      const sH = 2 + Math.floor(t * 2);
      // 左の枝（光側のため少し明るめ）
      for (let k = 0; k < spikes; k++) {
        const sy = yy + 1 + k * (layerH / spikes);
        const sLen = 5 + Math.abs(Math.sin(i * 1.7 + k * 0.9)) * 9 + t * 6;
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(cx - halfW + 1, sy);
        ctx.lineTo(cx - halfW - sLen, sy + sH / 2);
        ctx.lineTo(cx - halfW + 1, sy + sH);
        ctx.closePath(); ctx.fill();
        // 先端のハイライト
        ctx.fillStyle = bodyHi;
        ctx.fillRect(cx - halfW - sLen, sy + sH / 2 - 1, 2, 1);
      }
      // 右の枝（影側）
      for (let k = 0; k < spikes; k++) {
        const sy = yy + 1 + k * (layerH / spikes);
        const sLen = 5 + Math.abs(Math.sin(i * 1.3 + k * 1.1 + 2)) * 9 + t * 6;
        ctx.fillStyle = bodyShade;
        ctx.beginPath();
        ctx.moveTo(cx + halfW - 1, sy);
        ctx.lineTo(cx + halfW + sLen, sy + sH / 2);
        ctx.lineTo(cx + halfW - 1, sy + sH);
        ctx.closePath(); ctx.fill();
      }

      // 中央ボディ（左から光）
      // 影色のベース
      ctx.fillStyle = bodyShade;
      ctx.fillRect(cx - halfW, yy, halfW * 2, layerH);
      // 明色（左 2/3）
      ctx.fillStyle = body;
      ctx.fillRect(cx - halfW + 1, yy, Math.floor(halfW * 1.3) + 1, layerH - 1);
      // ハイライト（さらに左寄り）
      ctx.fillStyle = bodyHi;
      ctx.fillRect(cx - halfW + 2, yy + 1, 3, layerH - 3);
      // 段境目の濃い線
      ctx.fillStyle = bodyDeep;
      ctx.fillRect(cx - halfW, yy + layerH - 1, halfW * 2, 1);
      // 焦げの点
      if (t > 0.25) {
        ctx.fillStyle = bodyDeep;
        ctx.fillRect(cx - halfW + 6 + (i * 7) % 12, yy + 2, 1, 1);
        ctx.fillRect(cx + halfW - 9 - (i * 5) % 10, yy + 3, 1, 1);
      }
    }

    // 頂上の焼き軸の穴
    ctx.fillStyle = '#2a1408';
    ctx.beginPath(); ctx.ellipse(cx, topY + 2, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0402';
    ctx.beginPath(); ctx.ellipse(cx, topY + 2, 3, 1, 0, 0, Math.PI * 2); ctx.fill();
    // 上端のフチ
    ctx.fillStyle = 'rgba(255,232,180,0.65)';
    ctx.beginPath(); ctx.ellipse(cx - 2, topY, 7, 1, 0, 0, Math.PI * 2); ctx.fill();

    // 粉砂糖（雪のように）
    ctx.fillStyle = 'rgba(255,250,235,0.55)';
    for (let k = 0; k < 50; k++) {
      const px = cx - 65 + (k * 13 + (k * k) % 19) % 130;
      const py = topY + 15 + (k * 23 + (k * k * 3) % 27) % 220;
      if ((k * 7) % 3 === 0) ctx.fillRect(px | 0, py | 0, 1, 1);
    }

    // 添え物: ベリー2粒＋葉
    ctx.fillStyle = '#a02828';
    ctx.beginPath(); ctx.arc(82, 342, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(91, 345, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a1818';
    ctx.beginPath(); ctx.arc(83, 343, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,200,0.7)';
    ctx.fillRect(80, 339, 1, 1);
    ctx.fillRect(89, 342, 1, 1);
    // 葉
    ctx.fillStyle = '#3a6a3a';
    ctx.beginPath();
    ctx.moveTo(96, 340); ctx.lineTo(106, 336); ctx.lineTo(102, 344);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1a4a1a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(96, 340); ctx.lineTo(105, 339); ctx.stroke();
  }
  // ========== /料理紹介 ==========

  function renderBuildingInfo() {
    const t = state.buildingInfoT;
    // 空のグラデーション
    const g = ctx.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, '#3a4a7e'); g.addColorStop(0.6, '#7a8eb8'); g.addColorStop(1, '#dac0a0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, 248);
    // 雲（簡素）
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(40, 30, 60, 6); ctx.fillRect(48, 24, 44, 6);
    ctx.fillRect(240, 50, 80, 6); ctx.fillRect(252, 44, 56, 6);
    // 地面
    ctx.fillStyle = '#5a4a32'; ctx.fillRect(0, 248, CANVAS_W, CANVAS_H - 248);
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(0, 248, CANVAS_W, 4);
    // 草
    ctx.fillStyle = '#3a6a3a';
    for (let x = 0; x < CANVAS_W; x += 16) {
      ctx.fillRect(x + (Math.random() * 2 | 0), 252 + (x % 8 ? 0 : 2), 4, 2);
    }
    // 建物本体（中央に配置）
    drawBuildingDetail(t);
    // フレーム（古地図っぽい角飾り）
    ctx.strokeStyle = '#dac030'; ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, CANVAS_W - 12, CANVAS_H - 12);
    ctx.strokeStyle = '#7a5020'; ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, CANVAS_W - 20, CANVAS_H - 20);
  }

  function drawBuildingDetail(t) {
    // 専用詳細絵がある建物はそれを使う。なければ既存のオーバーレイ／タイルを拡大。
    if (t === T.GEDIMINAS)  { drawGediminasDetail();  return; }
    if (t === T.GATES)      { drawGatesDetail();      return; }
    if (t === T.ANNE)       { drawAnneDetail();       return; }
    if (t === T.CATHEDRAL)  { drawCathedralDetail();  return; }
    if (t === T.BERNARDINE) { drawBernardineDetail(); return; }
    if (t === T.VU)         { drawVUDetail();         return; }
    if (t === T.CROSSES)    { drawCrossesDetail();    return; }
    if (t === T.PRESIDENT)  { drawPresidentDetail();  return; }
    if (t === T.UZUPIS)     { drawUzupisDetail();     return; }
    if (t === T.PILIES)     { drawPiliesDetail();     return; }
    if (t === T.INN || t === T.AKHALL || t === T.RESTAURANT || t === T.SHOP || t === T.TOWNHALL) {
      // 既存の32×96オーバーレイをスケールアップ
      const scale = 3;
      const w = 32 * scale;
      const cx = (CANVAS_W - w) / 2;
      const cy = 36;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      drawBuildingOverlay(t, 0, 64, 'all');
      ctx.restore();
      return;
    }
    // フォールバック: 32x32タイル中央拡大
    const scale = 6;
    const cx = (CANVAS_W - 32 * scale) / 2;
    const cy = 60;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    drawTile(t, 0, 0);
    ctx.restore();
  }

  // ファミコンADV風 詳細絵（ゲディミナス塔 — 丘の上の煉瓦の塔＋旗）
  function drawGediminasDetail() {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 空のグラデーション
    for (let y = 0; y < 200; y++) {
      const t = y / 200;
      const rr = Math.floor(80 + t * 90);
      const gg = Math.floor(110 + t * 80);
      const bb = Math.floor(170 - t * 30);
      r(0, y, 384, 1, `rgb(${rr},${gg},${bb})`);
    }
    // 雲（淡く2片）
    r(40, 50, 60, 6, '#e8e0d0');
    r(50, 56, 50, 4, '#e8e0d0');
    r(260, 35, 80, 6, '#e8e0d0');
    r(270, 41, 70, 4, '#e8e0d0');
    // 丘
    ctx.fillStyle = '#3a5a3a';
    ctx.beginPath();
    ctx.moveTo(0, 240); ctx.lineTo(80, 200); ctx.lineTo(160, 170);
    ctx.lineTo(240, 180); ctx.lineTo(320, 210); ctx.lineTo(384, 240);
    ctx.lineTo(384, 248); ctx.lineTo(0, 248); ctx.closePath(); ctx.fill();
    // 丘の影
    ctx.fillStyle = '#2a4a2a';
    for (let x = 0; x < 384; x += 6) {
      const yy = 240 - Math.sin((x / 384) * Math.PI) * 65;
      ctx.fillRect(x, yy + 4, 4, 2);
    }
    // 塔の本体（中央、煉瓦タワー）
    const tx = 156, ty = 70, tw = 72, th = 110;
    r(tx, ty, tw, th, '#a85838'); // 煉瓦色
    // 煉瓦パターン
    for (let yy = ty + 4; yy < ty + th; yy += 8) {
      const off = ((yy - ty) / 8) % 2 === 0 ? 0 : 8;
      for (let xx = tx + off; xx < tx + tw; xx += 16) {
        r(xx, yy, 14, 1, '#7a3a20');
        r(xx, yy + 4, 1, 4, '#7a3a20');
      }
    }
    // 塔の縁の影
    r(tx, ty, 3, th, '#7a3a20');
    r(tx + tw - 3, ty, 3, th, '#7a3a20');
    r(tx, ty + th - 4, tw, 4, '#5a2a18');
    // 銃眼（てっぺん）
    for (let xx = tx; xx < tx + tw; xx += 12) {
      r(xx, ty - 8, 8, 8, '#a85838');
      r(xx, ty - 8, 1, 8, '#7a3a20');
      r(xx + 7, ty - 8, 1, 8, '#7a3a20');
    }
    r(tx, ty - 4, tw, 4, '#5a2a18');
    // 窓2段
    [ty + 30, ty + 70].forEach(wy => {
      r(tx + 18, wy, 8, 16, '#1a1018');
      r(tx + 19, wy + 1, 6, 14, '#3a4a8e');
      r(tx + tw - 26, wy, 8, 16, '#1a1018');
      r(tx + tw - 25, wy + 1, 6, 14, '#3a4a8e');
    });
    // 入口アーチ
    ctx.fillStyle = '#1a0a14';
    ctx.beginPath();
    ctx.arc(tx + tw / 2, ty + th - 14, 10, Math.PI, 0);
    ctx.fill();
    r(tx + tw / 2 - 10, ty + th - 14, 20, 14, '#1a0a14');
    // 旗ポール＋旗（リトアニア国旗 黄/緑/赤）
    r(tx + tw / 2 - 1, ty - 32, 2, 24, '#c0c0c8');
    r(tx + tw / 2 + 1, ty - 30, 18, 6,  '#dac030'); // 黄
    r(tx + tw / 2 + 1, ty - 24, 18, 6,  '#3aae5a'); // 緑
    r(tx + tw / 2 + 1, ty - 18, 18, 6,  '#c83030'); // 赤
    // 木（左右）
    drawTinyTree(60, 200);
    drawTinyTree(310, 200);
    drawTinyTree(95, 215);
    drawTinyTree(285, 215);
  }

  function drawTinyTree(x, y) {
    const r = (rx, ry, rw, rh, c) => { ctx.fillStyle = c; ctx.fillRect(x + rx, y + ry, rw, rh); };
    r(6, 14, 4, 10, '#5a3a20');
    r(0, 0, 16, 16, '#3a7a3a');
    r(2, 2, 12, 12, '#4a8e4a');
    r(4, 4, 8, 8, '#5aae5a');
  }

  // 夜明けの門（門上に礼拝堂のあるアーチ門）
  function drawGatesDetail() {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 朝焼けの空（夜明けの門にちなんで）
    for (let y = 0; y < 80; y++) {
      const t = y / 80;
      const rr = Math.floor(180 + t * 50);
      const gg = Math.floor(140 + t * 60);
      const bb = Math.floor(120 + t * 50);
      r(0, y, 384, 1, `rgb(${rr},${gg},${bb})`);
    }
    // 道
    r(120, 240, 144, 8, '#888070');
    // 石畳の継ぎ目
    for (let x = 124; x < 264; x += 14) { r(x, 240, 1, 8, '#5a4a30'); }
    // 門の本体（広い壁）
    const gx = 100, gy = 80, gw = 184, gh = 168;
    r(gx, gy, gw, gh, '#dac0a0');
    // 影
    r(gx, gy, gw, 4, '#a89070');
    r(gx, gy + gh - 8, gw, 8, '#a89070');
    r(gx, gy, 4, gh, '#a89070');
    r(gx + gw - 4, gy, 4, gh, '#a89070');
    // アーチ（中央）
    ctx.fillStyle = '#1a0a14';
    ctx.beginPath();
    ctx.arc(192, gy + gh - 30, 36, Math.PI, 0);
    ctx.fill();
    r(192 - 36, gy + gh - 30, 72, 30, '#1a0a14');
    // アーチの縁石
    ctx.strokeStyle = '#7a5a40'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(192, gy + gh - 30, 36, Math.PI, 0);
    ctx.stroke();
    // 上部の礼拝堂（聖母マリアの居場所）
    r(140, gy + 16, 104, 50, '#e8d8b0');
    r(140, gy + 14, 104, 4, '#a89070');
    // 礼拝堂の窓（金色の輝き）
    r(180, gy + 24, 24, 32, '#dac030');
    r(184, gy + 28, 16, 24, '#f0e090');
    r(192, gy + 28, 1, 24, '#a87020');
    r(184, gy + 38, 16, 1, '#a87020');
    // 礼拝堂屋根
    ctx.fillStyle = '#aa6a32';
    ctx.beginPath();
    ctx.moveTo(132, gy + 16); ctx.lineTo(192, gy - 4); ctx.lineTo(252, gy + 16);
    ctx.closePath(); ctx.fill();
    // 屋根の影
    ctx.strokeStyle = '#7a3a18'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(132, gy + 16); ctx.lineTo(192, gy - 4); ctx.lineTo(252, gy + 16);
    ctx.stroke();
    // 十字
    r(190, gy - 18, 4, 14, '#dac030');
    r(184, gy - 12, 16, 4, '#dac030');
    // 巡礼者（小さなドット人）
    r(184, 232, 4, 8, '#3a3a8e');
    r(184, 228, 4, 4, '#dac0a0');
  }

  // 聖アンナ教会（赤レンガ後期ゴシック）
  function drawAnneDetail() {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 空
    for (let y = 0; y < 200; y++) {
      const t = y / 200;
      const rr = Math.floor(120 + t * 60);
      const gg = Math.floor(140 + t * 70);
      const bb = Math.floor(180 - t * 20);
      r(0, y, 384, 1, `rgb(${rr},${gg},${bb})`);
    }
    // 道
    r(80, 240, 224, 8, '#7a5a3a');
    // 主塔（中央）
    const cx = 192;
    const tw = 60, th = 160;
    r(cx - tw / 2, 88, tw, th, '#a82828');
    r(cx - tw / 2, 88, 2, th, '#5a1010');
    r(cx + tw / 2 - 2, 88, 2, th, '#5a1010');
    // 主塔の尖塔
    ctx.fillStyle = '#a82828';
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2, 88); ctx.lineTo(cx, 50); ctx.lineTo(cx + tw / 2, 88);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5a1010'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2, 88); ctx.lineTo(cx, 50); ctx.lineTo(cx + tw / 2, 88);
    ctx.stroke();
    // アーチ群（特徴的なゴシックの細部）
    [98, 122, 146].forEach(wy => {
      ctx.fillStyle = '#1a0a14';
      ctx.beginPath();
      ctx.arc(cx, wy + 6, 7, Math.PI, 0); ctx.fill();
      r(cx - 7, wy + 6, 14, 8, '#1a0a14');
    });
    // 入口アーチ（大）
    ctx.fillStyle = '#1a0a14';
    ctx.beginPath();
    ctx.arc(cx, 240, 14, Math.PI, 0); ctx.fill();
    r(cx - 14, 226, 28, 14, '#1a0a14');
    // 左副塔
    r(cx - 60, 110, 24, 138, '#a82828');
    r(cx - 60, 110, 1, 138, '#5a1010');
    ctx.fillStyle = '#a82828';
    ctx.beginPath();
    ctx.moveTo(cx - 60, 110); ctx.lineTo(cx - 48, 80); ctx.lineTo(cx - 36, 110);
    ctx.closePath(); ctx.fill();
    // 右副塔
    r(cx + 36, 110, 24, 138, '#a82828');
    r(cx + 59, 110, 1, 138, '#5a1010');
    ctx.fillStyle = '#a82828';
    ctx.beginPath();
    ctx.moveTo(cx + 36, 110); ctx.lineTo(cx + 48, 80); ctx.lineTo(cx + 60, 110);
    ctx.closePath(); ctx.fill();
    // 副塔の尖塔の十字
    r(cx - 49, 70, 2, 8, '#dac030');
    r(cx + 47, 70, 2, 8, '#dac030');
    r(cx - 1, 38, 2, 12, '#dac030');
    r(cx - 4, 42, 8, 2, '#dac030');
    // 木
    drawTinyTree(50, 215);
    drawTinyTree(320, 215);
  }

  // ヴィリニュス大聖堂（白い列柱の新古典様式）
  function drawCathedralDetail() {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 空
    for (let y = 0; y < 200; y++) {
      const t = y / 200;
      const rr = Math.floor(110 + t * 70);
      const gg = Math.floor(140 + t * 70);
      const bb = Math.floor(180 - t * 20);
      r(0, y, 384, 1, `rgb(${rr},${gg},${bb})`);
    }
    // 広場
    r(0, 240, 384, 8, '#aaa090');
    // 広場の石畳
    for (let x = 0; x < 384; x += 14) { r(x, 240, 1, 8, '#888070'); }
    // 基礎
    r(40, 220, 304, 28, '#c0b8a0');
    r(40, 218, 304, 2, '#888070');
    // 列柱（前面6本）
    const colYs = 110;
    const colH = 110;
    for (let i = 0; i < 6; i++) {
      const cx = 60 + i * 52;
      r(cx, colYs, 14, colH, '#f0e8d0');
      r(cx, colYs, 1, colH, '#888070');
      r(cx + 13, colYs, 1, colH, '#a89878');
      // 縦溝
      r(cx + 4, colYs + 6, 1, colH - 12, '#c8b898');
      r(cx + 9, colYs + 6, 1, colH - 12, '#c8b898');
      // 柱頭
      r(cx - 2, colYs - 6, 18, 6, '#c0b090');
      r(cx - 2, colYs - 6, 18, 1, '#a89070');
      // 柱礎
      r(cx - 2, colYs + colH, 18, 6, '#c0b090');
    }
    // ペディメント（三角破風）
    ctx.fillStyle = '#f0e8d0';
    ctx.beginPath();
    ctx.moveTo(40, colYs - 8); ctx.lineTo(192, 56); ctx.lineTo(344, colYs - 8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a89070'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, colYs - 8); ctx.lineTo(192, 56); ctx.lineTo(344, colYs - 8);
    ctx.stroke();
    // 上部のエンタブラチュア
    r(40, colYs - 8, 304, 8, '#dad0b0');
    // 中央の大扉
    r(180, 184, 24, 56, '#3a2a1a');
    r(180, 184, 1, 56, '#1a0a0a');
    r(203, 184, 1, 56, '#1a0a0a');
    r(191, 184, 2, 56, '#1a0a0a');
    // 小窓
    [76, 308].forEach(wx => {
      r(wx, 130, 12, 22, '#1a0a14');
      r(wx + 1, 132, 10, 18, '#3a4a8e');
    });
    // 鐘楼（左の独立）
    r(8, 90, 28, 158, '#f0e8d0');
    r(8, 90, 1, 158, '#888070');
    r(35, 90, 1, 158, '#a89878');
    // 鐘楼上部
    r(4, 84, 36, 6, '#dad0b0');
    r(12, 70, 20, 14, '#f0e8d0');
    r(12, 70, 1, 14, '#888070');
    r(31, 70, 1, 14, '#888070');
    // 鐘
    r(18, 76, 8, 6, '#dac030');
    // 屋根の十字
    ctx.fillStyle = '#dac030';
    r(20, 56, 4, 14, '#dac030');
    r(15, 60, 14, 4, '#dac030');
  }

  // ベルナルディン教会（赤レンガ後期ゴシック、聖アンナの兄貴分）
  function drawBernardineDetail() {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 道
    r(60, 240, 264, 8, '#7a5a3a');
    // 本堂（横長、聖アンナより一回り大きい印象）
    r(80, 110, 224, 130, '#984040');
    r(80, 110, 224, 3, '#5a1818');
    r(80, 237, 224, 3, '#4a1010');
    r(80, 110, 3, 130, '#5a1818');
    r(301, 110, 3, 130, '#5a1818');
    // 急勾配の屋根
    ctx.fillStyle = '#7a2828';
    ctx.beginPath();
    ctx.moveTo(80, 110); ctx.lineTo(192, 60); ctx.lineTo(304, 110);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3a0808'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 110); ctx.lineTo(192, 60); ctx.lineTo(304, 110); ctx.stroke();
    // 屋根の煉瓦テクスチャ
    for (let y = 70; y < 108; y += 6) {
      const w = ((y - 60) / 50) * 224;
      const cx = 192 - w / 2;
      r(cx, y, w, 1, '#5a1010');
    }
    // 縦長の尖頭アーチ窓（5本）
    for (let i = 0; i < 5; i++) {
      const wx = 96 + i * 42;
      r(wx, 140, 16, 60, '#1a0a14');
      ctx.fillStyle = '#1a0a14';
      ctx.beginPath();
      ctx.arc(wx + 8, 140, 8, Math.PI, 0); ctx.fill();
      r(wx + 1, 142, 14, 58, '#3a4a8e');
      ctx.fillStyle = '#3a4a8e';
      ctx.beginPath();
      ctx.arc(wx + 8, 141, 7, Math.PI, 0); ctx.fill();
      // 縦の桟
      r(wx + 7, 140, 2, 60, '#1a0a14');
      r(wx + 1, 168, 14, 1, '#1a0a14');
    }
    // 入口（中央大アーチ）
    ctx.fillStyle = '#1a0a14';
    ctx.beginPath();
    ctx.arc(192, 218, 18, Math.PI, 0); ctx.fill();
    r(174, 218, 36, 22, '#1a0a14');
    r(190, 218, 4, 22, '#3a2a1a');
    r(177, 222, 1, 14, '#dac030');
    // 鐘楼（左にちょこんと）
    r(58, 130, 24, 110, '#984040');
    r(58, 130, 24, 3, '#5a1818');
    r(58, 130, 1, 110, '#5a1818');
    r(81, 130, 1, 110, '#5a1818');
    ctx.fillStyle = '#7a2828';
    ctx.beginPath();
    ctx.moveTo(56, 130); ctx.lineTo(70, 100); ctx.lineTo(84, 130);
    ctx.closePath(); ctx.fill();
    // 鐘楼の窓
    r(64, 150, 12, 18, '#1a0a14');
    r(65, 152, 10, 14, '#3a4a8e');
    // 屋根の十字（中央＋鐘楼）
    r(190, 44, 4, 18, '#dac030');
    r(184, 50, 16, 4, '#dac030');
    r(68, 88, 4, 14, '#dac030');
    r(62, 92, 16, 4, '#dac030');
    // 木
    drawTinyTree(30, 215);
    drawTinyTree(340, 215);
  }

  // ヴィリニュス大学（中庭のある古い学府、列柱と塔）
  function drawVUDetail() {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 道
    r(0, 240, 384, 8, '#a09080');
    // 本館（横長3階建て）
    r(30, 100, 324, 140, '#e8d8a8');
    r(30, 100, 324, 4, '#a89070');
    r(30, 236, 324, 4, '#7a6040');
    r(30, 100, 3, 140, '#a89070');
    r(351, 100, 3, 140, '#a89070');
    // 屋根
    r(20, 90, 344, 12, '#7a5030');
    r(20, 88, 344, 2, '#5a3a18');
    // 1階アーケード（半円アーチ7連）
    for (let i = 0; i < 7; i++) {
      const ax = 50 + i * 42;
      ctx.fillStyle = '#1a0a14';
      ctx.beginPath();
      ctx.arc(ax + 14, 220, 14, Math.PI, 0); ctx.fill();
      r(ax, 220, 28, 16, '#1a0a14');
      ctx.fillStyle = '#3a2a18';
      ctx.beginPath();
      ctx.arc(ax + 14, 220, 11, Math.PI, 0); ctx.fill();
      r(ax + 3, 222, 22, 14, '#3a2a18');
    }
    // 2階・3階の窓（縦に整然）
    for (let row = 0; row < 2; row++) {
      const wy = 120 + row * 40;
      for (let i = 0; i < 7; i++) {
        const wx = 56 + i * 42;
        r(wx, wy, 18, 26, '#3a2a1a');
        r(wx + 1, wy + 1, 16, 24, '#3a4a8e');
        r(wx + 9, wy, 1, 26, '#1a0a0a');
        r(wx, wy + 12, 18, 1, '#1a0a0a');
        // 窓辺の反射
        r(wx + 2, wy + 2, 4, 6, '#7a8acc');
      }
    }
    // 中央ペディメント
    ctx.fillStyle = '#e8d8a8';
    ctx.beginPath();
    ctx.moveTo(140, 100); ctx.lineTo(192, 70); ctx.lineTo(244, 100);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a89070'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(140, 100); ctx.lineTo(192, 70); ctx.lineTo(244, 100); ctx.stroke();
    // 鐘楼（聖ヨハネ教会、本館右奥に高くそびえる）
    r(290, 40, 36, 60, '#e8d8a8');
    r(290, 40, 36, 4, '#a89070');
    r(290, 40, 3, 60, '#a89070');
    r(323, 40, 3, 60, '#a89070');
    // 鐘楼の窓
    r(298, 60, 8, 14, '#1a0a14');
    r(310, 60, 8, 14, '#3a4a8e');
    // 鐘楼ドーム
    ctx.fillStyle = '#7a5030';
    ctx.beginPath();
    ctx.arc(308, 40, 20, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#a87030';
    ctx.beginPath();
    ctx.arc(308, 40, 16, Math.PI, 0); ctx.fill();
    // 鐘楼の十字
    r(306, 14, 4, 12, '#dac030');
    r(300, 18, 16, 4, '#dac030');
    // 中央エンブレム（本のマーク）
    r(180, 80, 24, 18, '#fff8e0');
    r(180, 80, 24, 1, '#3a2a1a');
    r(180, 97, 24, 1, '#3a2a1a');
    r(180, 80, 1, 18, '#3a2a1a');
    r(203, 80, 1, 18, '#3a2a1a');
    r(191, 82, 2, 14, '#3a2a1a');
    // 木
    drawTinyTree(2, 215);
    drawTinyTree(360, 215);
  }

  // 三つの十字架の丘（白い3本の十字架）
  function drawCrossesDetail() {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 空のグラデ風（夕焼け）
    for (let y = 0; y < 200; y++) {
      const t = y / 200;
      const r1 = Math.floor(40 + t * 60);
      const g1 = Math.floor(40 + t * 80);
      const b1 = Math.floor(80 + t * 40);
      r(0, y, 384, 1, `rgb(${r1},${g1},${b1})`);
    }
    // 遠景の街並み（シルエット）
    ctx.fillStyle = '#1a1a3a';
    for (let i = 0; i < 12; i++) {
      const sx = i * 32 + 4;
      const sh = 8 + Math.sin(i * 1.7) * 6 + 12;
      r(sx, 180 - sh, 28, sh, '#1a1a3a');
    }
    // 丘
    ctx.fillStyle = '#4a6a3a';
    ctx.beginPath();
    ctx.moveTo(0, 240); ctx.lineTo(60, 220); ctx.lineTo(140, 200);
    ctx.lineTo(220, 195); ctx.lineTo(300, 210); ctx.lineTo(384, 230); ctx.lineTo(384, 248); ctx.lineTo(0, 248);
    ctx.closePath(); ctx.fill();
    // 丘の影模様
    ctx.fillStyle = '#3a5a2a';
    for (let x = 0; x < 384; x += 6) {
      const yy = 230 - Math.sin((x / 384) * Math.PI) * 35;
      r(x, yy + 6, 4, 2, '#3a5a2a');
    }
    // 3本の白い十字架（中央が一番大きい）
    const crosses = [
      { cx: 130, base: 200, h: 80, w: 6,  arm: 30 },
      { cx: 192, base: 195, h: 100, w: 7, arm: 36 },
      { cx: 254, base: 200, h: 80, w: 6,  arm: 30 },
    ];
    crosses.forEach(c => {
      // 影
      r(c.cx - c.w / 2 + 1, c.base - c.h + 1, c.w, c.h, '#aaaaaa');
      r(c.cx - c.arm / 2 + 1, c.base - c.h + 19, c.arm, c.w, '#aaaaaa');
      // 本体
      r(c.cx - c.w / 2, c.base - c.h, c.w, c.h, '#fff8e0');
      r(c.cx - c.arm / 2, c.base - c.h + 18, c.arm, c.w, '#fff8e0');
      // 縁
      r(c.cx - c.w / 2, c.base - c.h, 1, c.h, '#dac0a0');
      r(c.cx + c.w / 2 - 1, c.base - c.h, 1, c.h, '#a89070');
    });
    // 巡礼者の小さなドット人
    r(170, 232, 4, 8, '#3a3a8e');
    r(170, 228, 4, 4, '#dac0a0');
    r(212, 232, 4, 8, '#aa3030');
    r(212, 228, 4, 4, '#dac0a0');
    // 木
    drawTinyTree(40, 218);
    drawTinyTree(330, 218);
  }

  // 大統領官邸（白い新古典様式の旧司教館）
  function drawPresidentDetail() {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 前庭（石畳）
    r(0, 240, 384, 8, '#bbb098');
    for (let x = 0; x < 384; x += 12) {
      r(x, 240, 1, 8, '#888070');
    }
    // 本館（横長2階建て）
    r(40, 110, 304, 130, '#f0e8d0');
    r(40, 110, 304, 4, '#a89070');
    r(40, 236, 304, 4, '#7a6040');
    r(40, 110, 3, 130, '#a89070');
    r(341, 110, 3, 130, '#a89070');
    // 屋根
    r(30, 100, 324, 12, '#888070');
    r(30, 98, 324, 2, '#5a4a30');
    // 中央ポルチコ（4本の柱が突き出る）
    r(150, 100, 84, 140, '#f0e8d0');
    r(150, 100, 84, 4, '#a89070');
    // ポルチコ屋根（三角破風）
    ctx.fillStyle = '#f0e8d0';
    ctx.beginPath();
    ctx.moveTo(146, 100); ctx.lineTo(192, 64); ctx.lineTo(238, 100);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a89070'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(146, 100); ctx.lineTo(192, 64); ctx.lineTo(238, 100); ctx.stroke();
    // ポルチコの柱（4本）
    for (let i = 0; i < 4; i++) {
      const cx = 158 + i * 22;
      r(cx, 130, 12, 110, '#fff8e0');
      r(cx, 130, 1, 110, '#a89070');
      r(cx + 11, 130, 1, 110, '#a89070');
      // 柱頭
      r(cx - 2, 124, 16, 6, '#dac0a0');
      // 縦溝
      r(cx + 4, 134, 1, 100, '#c8b898');
      r(cx + 8, 134, 1, 100, '#c8b898');
    }
    // 中央扉
    r(184, 184, 16, 56, '#3a2a1a');
    r(184, 184, 1, 56, '#1a0a0a');
    r(199, 184, 1, 56, '#1a0a0a');
    r(191, 184, 2, 56, '#1a0a0a');
    r(196, 210, 2, 2, '#dac030');
    // 左右の窓（2階）
    for (let i = 0; i < 4; i++) {
      const wx = i < 2 ? 60 + i * 32 : 250 + (i - 2) * 32;
      r(wx, 130, 18, 26, '#3a2a1a');
      r(wx + 1, 131, 16, 24, '#3a4a8e');
      r(wx + 9, 130, 1, 26, '#1a0a0a');
      r(wx, 142, 18, 1, '#1a0a0a');
    }
    // 1階の窓
    for (let i = 0; i < 4; i++) {
      const wx = i < 2 ? 60 + i * 32 : 250 + (i - 2) * 32;
      r(wx, 180, 18, 30, '#3a2a1a');
      r(wx + 1, 181, 16, 28, '#3a4a8e');
      r(wx + 9, 180, 1, 30, '#1a0a0a');
    }
    // リトアニア国旗（屋根中央）
    r(190, 44, 2, 22, '#888070');
    r(192, 46, 18, 5, '#dac030');
    r(192, 51, 18, 5, '#3aae5a');
    r(192, 56, 18, 5, '#c83030');
    // 衛兵（小さなドット人2人）
    r(168, 230, 4, 10, '#1a2a4a');
    r(168, 226, 4, 4, '#dac0a0');
    r(212, 230, 4, 10, '#1a2a4a');
    r(212, 226, 4, 4, '#dac0a0');
  }

  // ウジュピス（自称共和国への橋。芸術家街）
  function drawUzupisDetail() {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 空（くすんだ青）
    r(0, 0, 384, 130, '#5a6a8a');
    // ヴィルニャ川
    r(0, 130, 384, 110, '#3a5a7a');
    // 川の波模様
    for (let y = 140; y < 230; y += 8) {
      for (let x = 0; x < 384; x += 16) {
        r(x + ((y / 8) % 2) * 8, y, 6, 1, '#5a7a9a');
      }
    }
    // 川岸（手前）
    r(0, 230, 384, 18, '#7a6a4a');
    r(0, 230, 384, 2, '#5a4a2a');
    // 石造りの橋
    const bx0 = 80, bx1 = 304;
    // 橋脚
    r(120, 170, 14, 60, '#888070');
    r(250, 170, 14, 60, '#888070');
    // アーチ（3連）
    [120, 192, 264].forEach(ax => {
      ctx.fillStyle = '#3a5a7a';
      ctx.beginPath();
      ctx.arc(ax, 200, 22, Math.PI, 0); ctx.fill();
      r(ax - 22, 200, 44, 30, '#3a5a7a');
    });
    // 橋床
    r(bx0, 150, bx1 - bx0, 24, '#a89878');
    r(bx0, 148, bx1 - bx0, 2, '#dac0a0');
    r(bx0, 174, bx1 - bx0, 4, '#5a4a30');
    // 欄干
    r(bx0, 138, bx1 - bx0, 6, '#888070');
    for (let i = 0; i <= (bx1 - bx0) / 16; i++) {
      r(bx0 + i * 16, 144, 4, 8, '#888070');
    }
    // 対岸の家々（カラフルな芸術家街）
    const houses = [
      { x: 30,  y: 90,  c: '#dab070' },
      { x: 70,  y: 80,  c: '#aa6030' },
      { x: 110, y: 86,  c: '#d8c060' },
      { x: 270, y: 84,  c: '#aa3030' },
      { x: 310, y: 78,  c: '#3a8050' },
      { x: 350, y: 88,  c: '#7060a8' },
    ];
    houses.forEach(h => {
      r(h.x, h.y, 26, 60, h.c);
      r(h.x, h.y, 26, 2, '#3a2a1a');
      r(h.x, h.y, 1, 60, '#3a2a1a');
      r(h.x + 25, h.y, 1, 60, '#3a2a1a');
      // 屋根
      ctx.fillStyle = '#5a3a18';
      ctx.beginPath();
      ctx.moveTo(h.x - 2, h.y); ctx.lineTo(h.x + 13, h.y - 12); ctx.lineTo(h.x + 28, h.y);
      ctx.closePath(); ctx.fill();
      // 窓2つ
      r(h.x + 4, h.y + 14, 6, 8, '#3a4a8e');
      r(h.x + 16, h.y + 14, 6, 8, '#3a4a8e');
      r(h.x + 4, h.y + 30, 6, 8, '#dac030');
      r(h.x + 16, h.y + 30, 6, 8, '#3a4a8e');
    });
    // 「Užupio Respublika」看板（橋の中央）
    r(174, 122, 36, 14, '#fff8e0');
    r(174, 122, 36, 1, '#3a2a1a');
    r(174, 135, 36, 1, '#3a2a1a');
    r(174, 122, 1, 14, '#3a2a1a');
    r(209, 122, 1, 14, '#3a2a1a');
    r(178, 126, 28, 2, '#aa3030');
    r(178, 130, 28, 2, '#3a2a1a');
    // 人魚像（橋脚の根元の岩に、橋の左下）
    r(108, 218, 8, 12, '#dac0a0');
    r(108, 214, 8, 4, '#dac0a0');
    r(110, 230, 4, 8, '#3a8050');
  }

  // ピリエス通り（旧市街の目抜き通り、両側に色とりどりの家々）
  function drawPiliesDetail() {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 空
    r(0, 0, 384, 80, '#7a8aaa');
    // 通りの石畳（手前から奥へ遠近）
    for (let y = 240; y > 80; y -= 2) {
      const t = (240 - y) / 160;
      const w = 384 - t * 280;
      const cx = 192;
      r(cx - w / 2, y, w, 2, t > 0.5 ? '#888070' : '#a89878');
    }
    // 石畳の継ぎ目
    for (let y = 240; y > 100; y -= 12) {
      const t = (240 - y) / 160;
      const w = 384 - t * 280;
      const cx = 192;
      r(cx - w / 2, y, w, 1, '#5a4a30');
    }
    // 左側の建物（手前から奥へ並ぶ）
    const leftBuildings = [
      { x: 0,   y: 80,  w: 80, h: 160, c: '#dab070' },
      { x: 30,  y: 95,  w: 64, h: 145, c: '#aa3030' },
      { x: 60,  y: 110, w: 50, h: 130, c: '#d8c060' },
      { x: 90,  y: 122, w: 38, h: 118, c: '#7a8a50' },
    ];
    leftBuildings.forEach(b => {
      r(b.x, b.y, b.w, b.h, b.c);
      r(b.x, b.y, b.w, 3, '#5a3a18');
      r(b.x, b.y - 8, b.w + 2, 8, '#7a4a20');
      r(b.x, b.y - 10, b.w + 2, 2, '#3a1a08');
      // 窓2列
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          const wx = b.x + 8 + col * (b.w / 2 - 4);
          const wy = b.y + 16 + row * 32;
          if (wy + 18 < b.y + b.h - 24) {
            r(wx, wy, 12, 18, '#3a2a1a');
            r(wx + 1, wy + 1, 10, 16, '#3a4a8e');
            r(wx + 5, wy, 1, 18, '#1a0a0a');
          }
        }
      }
      // 1階の入口
      r(b.x + b.w / 2 - 6, b.y + b.h - 22, 12, 22, '#3a2a1a');
      r(b.x + b.w / 2 - 5, b.y + b.h - 21, 10, 21, '#5a3a1a');
    });
    // 右側の建物
    const rightBuildings = [
      { x: 304, y: 80,  w: 80, h: 160, c: '#7060a8' },
      { x: 290, y: 95,  w: 64, h: 145, c: '#dac060' },
      { x: 274, y: 110, w: 50, h: 130, c: '#3a8050' },
      { x: 256, y: 122, w: 38, h: 118, c: '#aa6030' },
    ];
    rightBuildings.forEach(b => {
      r(b.x, b.y, b.w, b.h, b.c);
      r(b.x, b.y, b.w, 3, '#5a3a18');
      r(b.x - 2, b.y - 8, b.w + 2, 8, '#7a4a20');
      r(b.x - 2, b.y - 10, b.w + 2, 2, '#3a1a08');
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          const wx = b.x + 8 + col * (b.w / 2 - 4);
          const wy = b.y + 16 + row * 32;
          if (wy + 18 < b.y + b.h - 24) {
            r(wx, wy, 12, 18, '#3a2a1a');
            r(wx + 1, wy + 1, 10, 16, '#3a4a8e');
            r(wx + 5, wy, 1, 18, '#1a0a0a');
          }
        }
      }
      r(b.x + b.w / 2 - 6, b.y + b.h - 22, 12, 22, '#3a2a1a');
      r(b.x + b.w / 2 - 5, b.y + b.h - 21, 10, 21, '#5a3a1a');
    });
    // 通りの先に大聖堂の塔がうっすら見える
    r(180, 60, 24, 40, '#e0d8b0');
    r(180, 60, 24, 2, '#a89070');
    r(180, 60, 2, 40, '#a89070');
    r(202, 60, 2, 40, '#a89070');
    ctx.fillStyle = '#aa6a32';
    ctx.beginPath();
    ctx.moveTo(178, 60); ctx.lineTo(192, 44); ctx.lineTo(206, 60);
    ctx.closePath(); ctx.fill();
    r(190, 36, 4, 10, '#dac030');
    r(186, 40, 12, 4, '#dac030');
    // 通りの旅人（小さなドット人2人）
    r(174, 226, 4, 12, '#aa3030');
    r(174, 222, 4, 4, '#dac0a0');
    r(206, 230, 4, 10, '#3a3a8e');
    r(206, 226, 4, 4, '#dac0a0');
    // 街灯（左右）
    r(120, 180, 2, 60, '#3a2a1a');
    r(116, 178, 10, 4, '#dac030');
    r(262, 180, 2, 60, '#3a2a1a');
    r(258, 178, 10, 4, '#dac030');
  }

  // ============================================================
  // 建物オーバーレイ（入口タイル基点に上方向2タイル分まで大型描画）
  // ============================================================
  function drawBuildingOverlay(t, sx, sy, mode) {
    // sx, sy = 入口タイルの画面左上
    // 建物は (sx, sy-64) を左上に 32×96 で描く
    // mode: 'all'(default) | 'top'(上2タイル=オーバーハング) | 'base'(入口行)
    const m = mode || 'all';
    if (m !== 'all') {
      ctx.save();
      ctx.beginPath();
      if (m === 'top')  ctx.rect(sx, sy - 64, 32, 64);
      if (m === 'base') ctx.rect(sx, sy,       32, 32);
      ctx.clip();
    }
    const bx = sx, by = sy - 64;
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(bx + x, by + y, w, h); };
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(bx + x, by + y, 1, 1); };

    if (t === T.INN) {
      // ★ 赤い切妻屋根の宿屋（3階建て） ★
      // 屋根の三角部
      for (let yy = 0; yy < 14; yy++) {
        const w = (yy + 1) * 2;
        const x = 16 - w / 2;
        r(x, yy, w, 1, '#aa2828');
      }
      // 屋根の縁の濃影
      for (let yy = 0; yy < 14; yy++) {
        const w = (yy + 1) * 2;
        const x = 16 - w / 2;
        r(x, yy, 1, 1, '#5a1010');
        r(x + w - 1, yy, 1, 1, '#5a1010');
      }
      // 屋根のひさし（広め）
      r(0, 14, 32, 4, '#aa2828');
      r(0, 14, 32, 1, '#dac030');  // 金縁
      r(0, 17, 32, 1, '#5a1010');
      r(0, 18, 32, 1, '#3a0808');
      // 棟の十字（教会的な飾り）
      r(15, 0, 2, 4, '#dac030');
      // 壁（クリーム木造）
      r(0, 19, 32, 41, '#dab070');
      r(0, 19, 1, 41, '#7a4a2a');
      r(31, 19, 1, 41, '#7a4a2a');
      // 横木材ライン
      r(0, 28, 32, 1, '#7a4a2a');
      r(0, 50, 32, 1, '#7a4a2a');
      // 縦の柱（コーナー）
      r(2, 19, 1, 41, '#a8804a');
      r(29, 19, 1, 41, '#a8804a');
      // 窓2つ（明るい黄色、十字格子）
      r(4, 31, 9, 13, '#3a2a1a');
      r(5, 32, 7, 11, '#dac030');
      r(8, 31, 1, 13, '#3a2a1a');
      r(5, 36, 7, 1, '#3a2a1a');
      // 出窓のひさし
      r(3, 30, 11, 1, '#7a4a2a');
      r(19, 31, 9, 13, '#3a2a1a');
      r(20, 32, 7, 11, '#dac030');
      r(23, 31, 1, 13, '#3a2a1a');
      r(20, 36, 7, 1, '#3a2a1a');
      r(18, 30, 11, 1, '#7a4a2a');
      // 窓のあかり（ハイライト）
      r(6, 33, 1, 2, '#fff8a0');
      r(21, 33, 1, 2, '#fff8a0');
      // 大きな看板（ベッド絵）
      r(8, 51, 16, 9, '#fff8e0');
      r(8, 51, 16, 1, '#3a2a1a');
      r(8, 59, 16, 1, '#3a2a1a');
      r(8, 51, 1, 9, '#3a2a1a');
      r(23, 51, 1, 9, '#3a2a1a');
      // ベッド絵（マットレス＋枕）
      r(10, 56, 12, 2, '#3a4abe');
      r(11, 54, 4, 2, '#fff');
      r(10, 58, 1, 2, '#7a4a2a');
      r(21, 58, 1, 2, '#7a4a2a');

      // === 入口階（下32px） ===
      r(0, 60, 32, 2, '#5a3a1a');
      r(0, 60, 32, 1, '#3a2a1a');
      r(0, 62, 32, 30, '#dab070');
      r(0, 62, 1, 30, '#7a4a2a');
      r(31, 62, 1, 30, '#7a4a2a');
      // ドア
      r(11, 68, 10, 22, '#3a2a1a');
      r(11, 68, 1, 22, '#1a0a0a');
      r(20, 68, 1, 22, '#1a0a0a');
      r(11, 68, 10, 1, '#1a0a0a');
      r(15, 68, 1, 22, '#5a3a1a'); // 板目
      r(18, 78, 2, 2, '#dac030');  // ノブ
      // ランタン（ドアの両脇）
      r(5, 70, 3, 5, '#3a2a1a');
      r(6, 71, 1, 3, '#dac030');
      r(24, 70, 3, 5, '#3a2a1a');
      r(25, 71, 1, 3, '#dac030');
      // 段差
      r(0, 91, 32, 5, '#888070');
      r(0, 91, 32, 1, '#aaa090');
    } else if (t === T.AKHALL) {
      // ★ 青屋根の音楽集会所 ★
      // 屋根の三角
      for (let yy = 0; yy < 14; yy++) {
        const w = (yy + 1) * 2;
        const x = 16 - w / 2;
        r(x, yy, w, 1, '#3a4abe');
      }
      for (let yy = 0; yy < 14; yy++) {
        const w = (yy + 1) * 2;
        const x = 16 - w / 2;
        r(x, yy, 1, 1, '#1a2a8e');
        r(x + w - 1, yy, 1, 1, '#1a2a8e');
      }
      // 屋根のひさし
      r(0, 14, 32, 4, '#3a4abe');
      r(0, 14, 32, 1, '#dac030');
      r(0, 17, 32, 1, '#1a2a8e');
      r(0, 18, 32, 1, '#08184e');
      // 棟の音符飾り
      r(15, 0, 2, 4, '#dac030');
      // 壁（白い石造）
      r(0, 19, 32, 41, '#e0d8c0');
      r(0, 19, 1, 41, '#888070');
      r(31, 19, 1, 41, '#888070');
      r(0, 28, 32, 1, '#888070');
      // 大きなステンドグラス丸窓
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(bx + 16, by + 38, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a4a8e';
      ctx.beginPath(); ctx.arc(bx + 16, by + 38, 7, 0, Math.PI * 2); ctx.fill();
      // ステンド模様（4分割）
      ctx.fillStyle = '#dac030';
      ctx.fillRect(bx + 16, by + 31, 1, 14);
      ctx.fillRect(bx + 9, by + 38, 14, 1);
      ctx.fillStyle = '#aa3030';
      ctx.fillRect(bx + 11, by + 33, 4, 4);
      ctx.fillStyle = '#3aae5a';
      ctx.fillRect(bx + 17, by + 33, 4, 4);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(bx + 11, by + 39, 4, 4);
      ctx.fillStyle = '#aa3030';
      ctx.fillRect(bx + 17, by + 39, 4, 4);
      // 窓枠の縁取り
      ctx.fillStyle = '#dac030';
      ctx.beginPath();
      ctx.arc(bx + 16, by + 38, 7.5, 0, Math.PI * 2);
      ctx.lineWidth = 1; ctx.strokeStyle = '#dac030'; ctx.stroke();
      // 壁の柱
      r(2, 19, 2, 41, '#888070');
      r(28, 19, 2, 41, '#888070');
      // 看板（音符プレート）
      r(8, 51, 16, 9, '#fff8e0');
      r(8, 51, 16, 1, '#3a2a1a');
      r(8, 59, 16, 1, '#3a2a1a');
      r(8, 51, 1, 9, '#3a2a1a');
      r(23, 51, 1, 9, '#3a2a1a');
      // 音符（八分音符×2＋連桁）
      r(11, 53, 1, 5, '#3a2a1a');
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(bx + 11, by + 58, 1.5, 0, Math.PI * 2); ctx.fill();
      r(15, 53, 1, 5, '#3a2a1a');
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(bx + 15, by + 58, 1.5, 0, Math.PI * 2); ctx.fill();
      r(11, 53, 5, 1, '#3a2a1a');
      r(20, 53, 1, 5, '#3a2a1a');
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(bx + 20, by + 58, 1.5, 0, Math.PI * 2); ctx.fill();

      // === 入口階 ===
      r(0, 60, 32, 2, '#5a3a1a');
      r(0, 62, 32, 30, '#e0d8c0');
      r(0, 62, 1, 30, '#888070');
      r(31, 62, 1, 30, '#888070');
      // 階段（前）
      r(0, 88, 32, 4, '#a89878');
      r(0, 88, 32, 1, '#c8b898');
      // 大きなアーチドア
      r(10, 68, 12, 24, '#3a2a1a');
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.arc(bx + 16, by + 68, 6, Math.PI, 0);
      ctx.fill();
      r(10, 68, 1, 24, '#1a0a0a');
      r(21, 68, 1, 24, '#1a0a0a');
      r(15, 70, 2, 22, '#5a3a1a');
      r(19, 80, 2, 2, '#dac030');
      r(11, 80, 2, 2, '#dac030');
      // 段差
      r(0, 92, 32, 4, '#888070');
    } else if (t === T.RESTAURANT) {
      // ★ 緑屋根のレストラン（煙突付き） ★
      // 煙突＆煙
      r(22, 0, 4, 6, '#7a4a2a');
      r(22, 0, 4, 1, '#3a2a1a');
      ctx.fillStyle = 'rgba(220,220,220,0.85)';
      ctx.beginPath(); ctx.arc(bx + 24, by - 1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(220,220,220,0.6)';
      ctx.beginPath(); ctx.arc(bx + 26, by - 4, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(220,220,220,0.45)';
      ctx.beginPath(); ctx.arc(bx + 23, by - 6, 2, 0, Math.PI * 2); ctx.fill();
      // 屋根の三角
      for (let yy = 0; yy < 14; yy++) {
        const w = (yy + 1) * 2;
        const x = 16 - w / 2;
        r(x, yy, w, 1, '#3a8a4a');
      }
      for (let yy = 0; yy < 14; yy++) {
        const w = (yy + 1) * 2;
        const x = 16 - w / 2;
        r(x, yy, 1, 1, '#1a5a2a');
        r(x + w - 1, yy, 1, 1, '#1a5a2a');
      }
      r(0, 14, 32, 4, '#3a8a4a');
      r(0, 14, 32, 1, '#dac030');
      r(0, 17, 32, 1, '#1a5a2a');
      r(0, 18, 32, 1, '#0a3a1a');
      r(15, 0, 2, 4, '#dac030');
      // 壁
      r(0, 19, 32, 41, '#dab070');
      r(0, 19, 1, 41, '#7a4a2a');
      r(31, 19, 1, 41, '#7a4a2a');
      // 大きな窓（テラス感）
      r(3, 26, 26, 18, '#3a2a1a');
      r(4, 27, 24, 16, '#ffaa50');
      r(15, 26, 2, 18, '#3a2a1a');
      r(4, 35, 24, 1, '#3a2a1a');
      // テーブル＆食事の影
      r(8, 39, 4, 3, '#3a2a1a');
      r(20, 39, 4, 3, '#3a2a1a');
      // 蒸気エフェクト（窓上から）
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(bx + 10, by + 24, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + 14, by + 22, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + 18, by + 24, 1.5, 0, Math.PI * 2); ctx.fill();
      // 看板（ナイフ＆フォーク）
      r(7, 49, 18, 10, '#fff8e0');
      r(7, 49, 18, 1, '#3a2a1a');
      r(7, 58, 18, 1, '#3a2a1a');
      r(7, 49, 1, 10, '#3a2a1a');
      r(24, 49, 1, 10, '#3a2a1a');
      // ナイフ
      r(11, 51, 1, 5, '#cccccc');
      r(10, 51, 3, 1, '#cccccc');
      r(11, 56, 1, 2, '#7a4a2a');
      // フォーク
      r(20, 51, 1, 5, '#cccccc');
      r(19, 51, 1, 2, '#cccccc');
      r(21, 51, 1, 2, '#cccccc');
      r(20, 56, 1, 2, '#7a4a2a');
      // 皿
      ctx.fillStyle = '#cccccc';
      ctx.beginPath(); ctx.arc(bx + 16, by + 54, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a4030';
      ctx.beginPath(); ctx.arc(bx + 16, by + 54, 2, 0, Math.PI * 2); ctx.fill();

      // === 入口階 ===
      r(0, 60, 32, 2, '#5a3a1a');
      r(0, 62, 32, 30, '#dab070');
      r(0, 62, 1, 30, '#7a4a2a');
      r(31, 62, 1, 30, '#7a4a2a');
      // 半開きの両開きドア
      r(11, 68, 10, 22, '#3a2a1a');
      r(11, 68, 1, 22, '#1a0a0a');
      r(20, 68, 1, 22, '#1a0a0a');
      r(11, 68, 10, 1, '#1a0a0a');
      r(15, 68, 2, 22, '#1a0a0a');
      r(13, 78, 1, 2, '#dac030');
      r(18, 78, 1, 2, '#dac030');
      // メニュー黒板（ドア横）
      r(2, 70, 8, 16, '#1a1a08');
      r(2, 70, 8, 1, '#7a4a2a');
      r(9, 70, 1, 16, '#7a4a2a');
      r(2, 85, 8, 1, '#7a4a2a');
      ctx.fillStyle = '#fff8e0';
      ctx.font = '5px sans-serif';
      ctx.fillText('Menu', bx + 3, by + 76);
      r(3, 78, 5, 1, '#dac030');
      r(3, 81, 5, 1, '#dac030');
      r(3, 84, 4, 1, '#dac030');
      // 段差
      r(0, 91, 32, 5, '#888070');
    } else if (t === T.SHOP) {
      // ★ 黄＋赤縞天幕の雑貨屋 ★
      // 上部壁（屋根の上）
      r(0, 0, 32, 12, '#dab070');
      r(0, 0, 32, 1, '#7a4a2a');
      r(0, 11, 32, 1, '#7a4a2a');
      // 上部の小窓2つ
      r(6, 4, 6, 6, '#3a2a1a');
      r(7, 5, 4, 4, '#aadaee');
      r(20, 4, 6, 6, '#3a2a1a');
      r(21, 5, 4, 4, '#aadaee');
      // 縞模様の天幕（屋根代わり）
      for (let i = 0; i < 8; i++) {
        const ax = i * 4;
        ctx.fillStyle = (i % 2 === 0) ? '#dac030' : '#c83030';
        ctx.fillRect(bx + ax, by + 12, 4, 14);
      }
      // 天幕の波打ち（下端）
      ctx.fillStyle = '#3a2a1a';
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(bx + i * 4, by + 25, 1, 1);
        ctx.fillRect(bx + i * 4 + 2, by + 25, 1, 1);
      }
      r(0, 26, 32, 1, '#3a2a1a');
      // 紐の影
      r(0, 12, 32, 1, '#3a2a1a');
      // 看板（金貨）下げ紐
      r(15, 27, 2, 4, '#3a2a1a');
      // 看板円形
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(bx + 16, by + 36, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#dac030';
      ctx.beginPath(); ctx.arc(bx + 16, by + 36, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a6a10';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('G', bx + 16, by + 39);
      ctx.textAlign = 'left';

      // 中段：陳列窓（オープンマーケット）
      r(0, 44, 32, 16, '#dab070');
      r(0, 44, 32, 1, '#7a4a2a');
      r(0, 59, 32, 1, '#7a4a2a');
      r(0, 44, 1, 16, '#7a4a2a');
      r(31, 44, 1, 16, '#7a4a2a');
      // 陳列カウンター
      r(2, 50, 28, 8, '#3a2a1a');
      r(2, 50, 28, 1, '#1a0a0a');
      r(2, 57, 28, 1, '#1a0a0a');
      // カウンターに置かれた商品（壺・本・布）
      r(5, 46, 4, 4, '#aa6020');
      r(5, 46, 1, 4, '#7a3a10');
      r(5, 46, 4, 1, '#7a3a10');
      r(13, 45, 5, 5, '#3a8abe');
      r(13, 45, 1, 5, '#1a5a8e');
      r(13, 45, 5, 1, '#1a5a8e');
      r(14, 46, 1, 1, '#fff');
      r(22, 46, 5, 4, '#aa3030');
      r(22, 46, 1, 4, '#7a1818');

      // === 入口階 ===
      r(0, 60, 32, 2, '#5a3a1a');
      r(0, 62, 32, 30, '#dab070');
      r(0, 62, 1, 30, '#7a4a2a');
      r(31, 62, 1, 30, '#7a4a2a');
      // ドア（右側）
      r(20, 68, 10, 22, '#3a2a1a');
      r(20, 68, 10, 1, '#1a0a0a');
      r(20, 68, 1, 22, '#1a0a0a');
      r(29, 68, 1, 22, '#1a0a0a');
      r(28, 78, 2, 2, '#dac030');
      // 樽（左側）
      r(2, 78, 10, 12, '#7a4a2a');
      r(2, 78, 10, 1, '#3a2a1a');
      r(2, 81, 10, 1, '#3a2a1a');
      r(2, 85, 10, 1, '#3a2a1a');
      r(2, 89, 10, 1, '#3a2a1a');
      // 段差
      r(0, 91, 32, 5, '#888070');
    } else if (t === T.TOWNHALL) {
      // ★ 旧市庁舎（白い石造、4本柱、三色旗） ★
      // 旗ポール＋三色旗
      r(15, -8, 2, 14, '#5a3a1a');
      r(17, -7, 9, 2, '#dac030');
      r(17, -5, 9, 2, '#3aae5a');
      r(17, -3, 9, 2, '#c83030');
      r(17, -1, 1, 2, '#3a2a1a');
      // 三角ペディメント
      for (let yy = 0; yy < 14; yy++) {
        const w = (yy + 1) * 2;
        const x = 16 - w / 2;
        r(x, yy, w, 1, '#e0d8c0');
      }
      for (let yy = 0; yy < 14; yy++) {
        const w = (yy + 1) * 2;
        const x = 16 - w / 2;
        r(x, yy, 1, 1, '#888070');
        r(x + w - 1, yy, 1, 1, '#888070');
      }
      // 中央の盾紋章
      r(13, 8, 6, 6, '#3a4abe');
      r(13, 8, 6, 1, '#888070');
      r(13, 8, 1, 6, '#888070');
      r(18, 8, 1, 6, '#888070');
      r(13, 13, 6, 1, '#888070');
      r(15, 9, 2, 4, '#dac030');
      r(14, 11, 4, 1, '#dac030');
      // ペディメント下の太い帯
      r(0, 14, 32, 5, '#a89878');
      r(0, 14, 32, 1, '#c8b898');
      r(0, 18, 32, 1, '#3a2a1a');

      // 中段：列柱4本＋アーチ
      r(0, 19, 32, 41, '#e8e0d0');
      // 床
      r(0, 56, 32, 4, '#a89878');
      r(0, 56, 32, 1, '#888070');
      // 列柱（4本、上下に台座）
      const colXs = [3, 11, 18, 25];
      colXs.forEach(cx0 => {
        r(cx0, 21, 4, 35, '#e0d0b0');
        r(cx0, 21, 1, 35, '#888070');
        r(cx0 + 3, 21, 1, 35, '#a89878');
        // 柱頭
        r(cx0 - 1, 20, 6, 2, '#a89878');
        r(cx0 - 1, 20, 6, 1, '#c8b898');
        // 柱礎
        r(cx0 - 1, 54, 6, 3, '#a89878');
        // 縦の溝
        r(cx0 + 1, 22, 1, 32, '#c8b898');
      });
      // 柱と柱の間に小さな窓
      [7, 14, 21].forEach(wx => {
        r(wx, 27, 4, 14, '#3a2a1a');
        r(wx + 1, 28, 2, 12, '#3a4a8e');
        r(wx + 1, 31, 2, 1, '#1a2a4e');
        r(wx + 1, 35, 2, 1, '#1a2a4e');
      });

      // === 入口階（中央扉） ===
      r(0, 60, 32, 2, '#5a3a1a');
      r(0, 62, 32, 30, '#e8e0d0');
      r(0, 62, 1, 30, '#888070');
      r(31, 62, 1, 30, '#888070');
      // 大きな両開き扉＋アーチ
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.arc(bx + 16, by + 70, 8, Math.PI, 0);
      ctx.fill();
      r(8, 70, 16, 22, '#3a2a1a');
      r(8, 70, 1, 22, '#1a0a0a');
      r(23, 70, 1, 22, '#1a0a0a');
      r(15, 70, 2, 22, '#1a0a0a');
      // 装飾（板目）
      r(10, 74, 1, 16, '#5a3a1a');
      r(13, 74, 1, 16, '#5a3a1a');
      r(18, 74, 1, 16, '#5a3a1a');
      r(21, 74, 1, 16, '#5a3a1a');
      // ノブ
      r(13, 82, 1, 2, '#dac030');
      r(18, 82, 1, 2, '#dac030');
      // 段差（重厚な石段）
      r(0, 91, 32, 5, '#888070');
      r(0, 91, 32, 1, '#aaa090');
    }
    if (m !== 'all') ctx.restore();
  }

  function renderField() {
    clear('#000');
    // スムーズスクロール用のカメラ（プレイヤーの補間位置に追従）
    let pxf = state.px, pyf = state.py;
    if (state.move) {
      const tt = Math.min(1, (performance.now() - state.move.t0) / state.move.dur);
      pxf = state.px + state.move.dx * tt;
      pyf = state.py + state.move.dy * tt;
    }
    let cxF = pxf - VIEW_COLS / 2 + 0.5;
    let cyF = pyf - VIEW_ROWS / 2 + 0.5;
    cxF = Math.max(0, Math.min(MAP_COLS - VIEW_COLS, cxF));
    cyF = Math.max(0, Math.min(MAP_ROWS - VIEW_ROWS, cyF));
    const cxi = Math.floor(cxF), cyi = Math.floor(cyF);
    const ox = -Math.round((cxF - cxi) * TILE);
    const oy = -Math.round((cyF - cyi) * TILE);

    // タイル描画（端を1タイル多く描いて隙間を埋める）
    for (let y = 0; y <= VIEW_ROWS; y++) {
      for (let x = 0; x <= VIEW_COLS; x++) {
        const mx = cxi + x;
        const my = cyi + y;
        if (mx < 0 || mx >= MAP_COLS || my < 0 || my >= MAP_ROWS) continue;
        drawTile(MAP[my][mx], x * TILE + ox, y * TILE + oy, mx, my);
      }
    }
    // 建物オーバーレイ：入口行（base）はNPC/プレイヤーの背後に
    const buildings = [];
    for (let y = 0; y <= VIEW_ROWS; y++) {
      for (let x = 0; x <= VIEW_COLS; x++) {
        const mx = cxi + x;
        const my = cyi + y;
        if (mx < 0 || mx >= MAP_COLS || my < 0 || my >= MAP_ROWS) continue;
        const t = MAP[my][mx];
        if (t === T.INN || t === T.AKHALL || t === T.RESTAURANT || t === T.SHOP || t === T.TOWNHALL) {
          buildings.push({ t, sx: x * TILE + ox, sy: y * TILE + oy });
        }
      }
    }
    buildings.forEach(b => drawBuildingOverlay(b.t, b.sx, b.sy, 'base'));

    // NPC・プレイヤー・仲間2人をy座標でソートして描画（前後関係を正しく）
    const now = performance.now();
    const sprites = [];
    NPCS.forEach(n => {
      if (n.kind === 'guardian' && state.flags.guardian) return;
      let alpha = 1;
      if (n.fading) {
        const elapsed = now - n.fading.t0;
        if (elapsed >= n.fading.dur) return;
        const blink = (Math.floor(elapsed / 120) % 2 === 0) ? 1 : 0.25;
        alpha = blink * (1 - (elapsed / n.fading.dur) * 0.8);
      }
      let nxF = n.x, nyF = n.y;
      if (n.walking) {
        const tt = Math.min(1, (now - n.walking.t0) / n.walking.dur);
        nxF = n.x + n.walking.dx * tt;
        nyF = n.y + n.walking.dy * tt;
      }
      sprites.push({ yWorld: nyF, x: nxF, y: nyF, dir: n.dir || 'down', look: n.look, alpha });
    });
    // 仲間2人（party[1], party[2]）— follower配列の補間位置で描画
    if (state.followers && state.party[1] && state.party[2]) {
      state.followers.forEach((f, i) => {
        if (!f) return;
        let fxF = f.x, fyF = f.y;
        if (f.move) {
          const tt = Math.min(1, (now - f.move.t0) / f.move.dur);
          fxF = f.x + f.move.dx * tt;
          fyF = f.y + f.move.dy * tt;
        }
        sprites.push({ yWorld: fyF, x: fxF, y: fyF, dir: f.dir || 'down', look: state.party[i + 1].look });
      });
    }
    // プレイヤー（補間位置）
    sprites.push({ yWorld: pyf, x: pxf, y: pyf, dir: state.pdir, look: state.party[0].look });
    // y座標でソートして描画（同じyの場合プレイヤーが後）
    sprites.sort((a, b) => a.yWorld - b.yWorld);
    for (const s of sprites) {
      const sx = (s.x - cxi) * TILE + ox;
      const sy = (s.y - cyi) * TILE + oy;
      if (sx < -TILE || sx >= CANVAS_W || sy < -TILE || sy >= CANVAS_H) continue;
      const prevAlpha = ctx.globalAlpha;
      if (s.alpha != null && s.alpha < 1) ctx.globalAlpha = Math.max(0, s.alpha);
      drawChar(sx, sy, s.dir, s.look);
      ctx.globalAlpha = prevAlpha;
    }

    // 建物オーバーレイ：上部（top）はNPC/プレイヤーの手前に上書き
    buildings.forEach(b => drawBuildingOverlay(b.t, b.sx, b.sy, 'top'));
    // 都市到着バナー（最前面）
    drawCityBanner();
  }

  // ============================================================
  // 戦闘演出（FXキュー＋アニメーションループ）
  // ============================================================
  let _animRaf = 0;
  function startAnimLoop() {
    if (_animRaf) return;
    function tick() {
      _animRaf = 0;
      if (state.scene !== 'battle' && state.scene !== 'win' && state.scene !== 'lose') return;
      const now = performance.now();
      state.battleFx = (state.battleFx || []).filter(f => now - f.t0 < f.dur);
      const shaking = (state.shakeTime || 0) > now;
      const active  = state.activeActor != null && state.activeActor >= 0;
      renderBattle();
      if (state.battleFx.length > 0 || shaking || active) {
        _animRaf = requestAnimationFrame(tick);
      }
    }
    _animRaf = requestAnimationFrame(tick);
  }
  function pushFx(fx) {
    fx.t0 = performance.now();
    if (!state.battleFx) state.battleFx = [];
    state.battleFx.push(fx);
    startAnimLoop();
  }
  function setBattleLog(text) {
    state.battleLog = text;
    const d = document.getElementById('dialog');
    if (state.battleStep === 'menu') {
      showBattleUI();
    } else {
      d.innerHTML = '<div style="font-size:13px;line-height:1.5;min-height:90px;">' + text + ' <span style="font-size:10px;color:#888;">[Enter で送る]</span></div>';
    }
  }

  // 戦闘の演出待ち（Enter/A/Z/Spaceでスキップ可能）
  // 仕掛中のwaitを溜め、skipBattleWait()で順に即時実行する
  let _battlePending = [];
  function battleWait(fn, ms) {
    const h = {};
    h.id = setTimeout(() => {
      const i = _battlePending.indexOf(h);
      if (i >= 0) _battlePending.splice(i, 1);
      fn();
    }, ms);
    h.fn = fn;
    _battlePending.push(h);
  }
  function skipBattleWait() {
    // クライマックス演出中はスキップさせない（演出と音源が中断されるのを防ぐ）
    if (state.noSkipBattle) return false;
    if (_battlePending.length === 0) return false;
    const queued = _battlePending.slice();
    _battlePending = [];
    queued.forEach(h => clearTimeout(h.id));
    queued.forEach(h => { try { h.fn(); } catch (e) { /* noop */ } });
    return true;
  }

  // 音符を描画（小さな♪マーク）
  function drawNote(x, y, color, size) {
    size = size || 1;
    ctx.fillStyle = color;
    // 棒
    ctx.fillRect(x + 2 * size, y - 6 * size, 1 * size, 8 * size);
    // 玉
    ctx.beginPath();
    ctx.ellipse(x, y + 2 * size, 3 * size, 2 * size, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // 旗
    ctx.fillRect(x + 2 * size, y - 6 * size, 4 * size, 1 * size);
    ctx.fillRect(x + 2 * size, y - 4 * size, 3 * size, 1 * size);
  }

  function renderBattle() {
    clear('#1a1a2a');
    const now = performance.now();
    if (state.enemy && state.enemy.type === 'audience_30k') {
      // ===== ラスボス：野外フェス（昼空） =====
      // 空グラデーション
      const sg = ctx.createLinearGradient(0, 0, 0, 180);
      sg.addColorStop(0, '#6aa8e0');
      sg.addColorStop(0.6, '#a8d4f0');
      sg.addColorStop(1, '#dceeff');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, CANVAS_W, 180);
      // 雲（ふわっとした塊）
      const clouds = [[20,18,60,8],[110,10,72,8],[210,22,80,8],[300,14,68,8],[60,38,40,6],[260,40,52,6]];
      ctx.fillStyle = '#fff';
      clouds.forEach(([cx,cy,cw,ch]) => {
        ctx.fillRect(cx, cy, cw, ch);
        ctx.fillRect(cx + 4, cy - 3, cw - 8, 3);
        ctx.fillRect(cx + 8, cy + ch, cw - 16, 2);
      });
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      clouds.forEach(([cx,cy,cw,ch]) => {
        ctx.fillRect(cx + 6, cy + 2, cw - 12, 2);
      });
      // 紙吹雪
      const conf = ['#ffe040','#ff60a0','#60c0ff','#a0ff60','#ff8040','#fff','#dac030','#3aae6a','#c83040'];
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = conf[i % conf.length];
        const cx = (i * 47) % CANVAS_W;
        const cy = (i * 13) % 110;
        ctx.fillRect(cx, cy, 2, 2);
      }
      // 遠景の山並み
      ctx.fillStyle = '#7aa0c0';
      for (let i = 0; i < 24; i++) {
        const mx = i * 18, mh = 14 + (i % 3) * 6;
        ctx.fillRect(mx, 60 - mh, 18, mh);
      }
      // 遠景の木（横一列）
      ctx.fillStyle = '#2a4a2a';
      ctx.fillRect(0, 70, CANVAS_W, 8);
      for (let i = 0; i < 24; i++) {
        const tx = i * 16;
        ctx.fillStyle = (i % 2) ? '#1a3a1a' : '#2a4a2a';
        ctx.fillRect(tx, 64, 6, 8);
        ctx.fillStyle = '#3a5a3a';
        ctx.fillRect(tx + 2, 62, 3, 4);
      }
      // ===== ステージ（中央奥） =====
      const stageX = 110, stageY = 56, stageW = 164, stageH = 36;
      // トラス（鉄骨）
      ctx.fillStyle = '#aaa';
      ctx.fillRect(stageX - 4, stageY - 14, stageW + 8, 3);
      ctx.fillRect(stageX - 4, stageY - 14, 4, stageH + 18);
      ctx.fillRect(stageX + stageW, stageY - 14, 4, stageH + 18);
      ctx.fillStyle = '#888';
      for (let i = 0; i < 12; i++) {
        ctx.fillRect(stageX + i * 14, stageY - 12, 2, 2);
      }
      // ステージ幕（黒背景）
      ctx.fillStyle = '#0a0a18';
      ctx.fillRect(stageX, stageY - 8, stageW, stageH + 6);
      ctx.fillStyle = '#2a2a4a';
      ctx.fillRect(stageX, stageY - 8, stageW, 2);
      // スクリーン
      ctx.fillStyle = '#1a1a3a';
      ctx.fillRect(stageX + 12, stageY - 4, stageW - 24, stageH - 8);
      ctx.fillStyle = '#5a5a8a';
      ctx.fillRect(stageX + 12, stageY - 4, stageW - 24, 2);
      // スクリーン内のシルエット
      ctx.fillStyle = '#fadcb0';
      ctx.fillRect(stageX + stageW / 2 - 6, stageY + 2, 12, 14);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(stageX + stageW / 2 - 6, stageY + 2, 12, 5);
      ctx.fillStyle = '#aa3030';
      ctx.fillRect(stageX + stageW / 2 - 12, stageY + 16, 24, 8);
      // ステージ床
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(stageX, stageY + stageH - 8, stageW, 6);
      ctx.fillStyle = '#1a0a08';
      ctx.fillRect(stageX, stageY + stageH - 2, stageW, 2);
      // ===== サイドテント =====
      // 左テント
      ctx.fillStyle = '#dadada';
      for (let h = 0; h < 18; h++) {
        const w = 18 - h;
        ctx.fillRect(40 - w, 50 + h, w * 2, 1);
      }
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(20, 68, 40, 24);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(20, 68, 40, 2);
      ctx.fillRect(20, 90, 40, 2);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(40, 50, 1, 4);
      // 右テント
      ctx.fillStyle = '#dadada';
      for (let h = 0; h < 18; h++) {
        const w = 18 - h;
        ctx.fillRect(344 - w, 50 + h, w * 2, 1);
      }
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(324, 68, 40, 24);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(324, 68, 40, 2);
      ctx.fillRect(324, 90, 40, 2);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(344, 50, 1, 4);
      // ===== ステージ脇のリトアニア国旗 =====
      const flagPos = [[stageX - 22, stageY - 4], [stageX + stageW + 18, stageY - 4],
                        [stageX - 38, stageY + 8], [stageX + stageW + 34, stageY + 8]];
      flagPos.forEach(([fx, fy]) => {
        // ポール
        ctx.fillStyle = '#aaa';
        ctx.fillRect(fx, fy - 18, 1, 36);
        // 旗（黄/緑/赤）
        ctx.fillStyle = '#dac030'; ctx.fillRect(fx + 1, fy - 18, 14, 4);
        ctx.fillStyle = '#3aae6a'; ctx.fillRect(fx + 1, fy - 14, 14, 4);
        ctx.fillStyle = '#c83040'; ctx.fillRect(fx + 1, fy - 10, 14, 4);
        ctx.fillStyle = '#fff'; ctx.fillRect(fx + 1, fy - 18, 14, 1);
      });
      // ===== 観衆エリアの地面 =====
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(0, 92, CANVAS_W, 88);
    } else {
      // 通常戦闘の夜空
      ctx.fillStyle = '#2a3a5a';
      ctx.fillRect(0, 0, CANVAS_W, 180);
      ctx.fillStyle = '#5a8aae';
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(30 + i * 48, 36 + (i % 2) * 24, 18, 10);
      }
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 20; i++) {
        const x = (i * 79) % CANVAS_W;
        const y = (i * 31) % 100;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // 敵（被弾時にシェイク）
    let ex = 130, ey = 30;
    if ((state.shakeTime || 0) > now) {
      const k = Math.max(0, (state.shakeTime - now) / 350);
      ex += (Math.random() - 0.5) * 12 * k;
      ey += (Math.random() - 0.5) * 8  * k;
    }
    drawEnemy(ex, ey, state.enemy.type, getEnemyExpr());
    // 敵HPバー
    const hpRatio = state.enemy.hp / state.enemy.maxHp;
    rect(60, 195, 264, 12, '#3a2a1a');
    rect(62, 197, 260 * Math.max(0, hpRatio), 8, '#dac030');
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.enemy.name + ' 感動度 ' + Math.max(0, state.enemy.hp) + '/' + state.enemy.maxHp, CANVAS_W / 2, 190);

    // 地面
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(0, 215, CANVAS_W, 4);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(0, 219, CANVAS_W, 165);

    // パーティ3人を立ち絵で表示（左から並べる）
    ctx.textAlign = 'left';
    state.party.forEach((p, i) => {
      const slotW = 128;
      const px = i * slotW;
      const py = 222;
      // スロット背景
      ctx.fillStyle = p.alive ? 'rgba(0,0,0,0.3)' : 'rgba(60,20,20,0.6)';
      ctx.fillRect(px + 2, py, slotW - 4, 162);
      // 立ち絵を2倍拡大で描画
      const cx = px + (slotW - CHAR_W * 2) / 2;
      const cy = py + 0;
      const tmp = document.createElement('canvas');
      tmp.width = CHAR_W; tmp.height = CHAR_H;
      const tctx = tmp.getContext('2d');
      drawCharDetailed(tctx, 0, 0, 'down', p.look);
      ctx.imageSmoothingEnabled = false;
      // 倒れ表現: 透明度＋90度回転（中心軸基準）
      if (!p.alive) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.translate(cx + CHAR_W, cy + CHAR_H);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(tmp, -CHAR_H, -CHAR_W, CHAR_H * 2, CHAR_W * 2);
        ctx.restore();
      } else {
        ctx.drawImage(tmp, cx, cy, CHAR_W * 2, CHAR_H * 2);
      }
      // 名前
      ctx.fillStyle = p.alive ? '#fff' : '#888';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, px + slotW / 2, py + CHAR_H * 2 + 12);
      // HPバー
      const barW = slotW - 16;
      const bx = px + 8;
      const byH = py + CHAR_H * 2 + 16;
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(bx, byH, barW, 6);
      const hpCol = p.hp / p.maxHp < 0.3 ? '#c83030' : '#3aae5a';
      ctx.fillStyle = hpCol;     ctx.fillRect(bx, byH, barW * Math.max(0, p.hp / p.maxHp), 6);
      ctx.fillStyle = '#fff';    ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`HP ${Math.max(0, p.hp)}/${p.maxHp}`, bx, byH + 14);
      // MPバー
      const byM = byH + 18;
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(bx, byM, barW, 5);
      ctx.fillStyle = '#3a8abe'; ctx.fillRect(bx, byM, barW * Math.max(0, p.mp / p.maxMp), 5);
      ctx.fillStyle = '#fff';
      ctx.fillText(`MP ${Math.max(0, p.mp)}/${p.maxMp}`, bx, byM + 12);
    });

    if (state.buff > 0) {
      ctx.fillStyle = '#dac030';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('★エホーマイ残' + state.buff + 'T', CANVAS_W - 6, 213);
    }

    // ============ アクティブ俳優ハイライト ============
    if (state.activeActor != null && state.activeActor >= 0 && state.activeActor <= 2) {
      const i = state.activeActor;
      const slotW = 128;
      const slotX = i * slotW;
      const py = 222;
      // 床に光る輪
      const pulse = 0.5 + 0.5 * Math.sin(now / 120);
      ctx.fillStyle = `rgba(218,192,48,${0.15 + 0.2 * pulse})`;
      ctx.fillRect(slotX + 2, py, slotW - 4, 162);
      ctx.strokeStyle = `rgba(218,192,48,${0.7 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(slotX + 3, py + 1, slotW - 6, 160);
      // 頭上の♪
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#dac030';
      ctx.textAlign = 'center';
      const noteY = py + 4 - 8 + Math.sin(now / 100) * 3;
      ctx.fillText('♪', slotX + slotW / 2 + 22, noteY);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('うた中', slotX + slotW / 2, py - 4);
    }

    // ============ FX（音符が飛ぶ／ダメージ数字／回復） ============
    (state.battleFx || []).forEach(f => {
      const t = Math.min(1, (now - f.t0) / f.dur);
      if (f.kind === 'note') {
        const arc = -Math.sin(t * Math.PI) * 40;
        const x = f.x0 + (f.x1 - f.x0) * t;
        const y = f.y0 + (f.y1 - f.y0) * t + arc;
        drawNote(x, y, f.color || '#dac030', 1.2);
      } else if (f.kind === 'dmg') {
        const y = f.y - t * 30;
        const a = 1 - Math.max(0, t - 0.6) / 0.4;
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(0,0,0,${a})`;
        ctx.fillStyle   = `rgba(255,210,40,${a})`;
        ctx.strokeText(String(f.value), f.x, y);
        ctx.fillText(String(f.value), f.x, y);
      } else if (f.kind === 'heal') {
        const y = f.y - t * 30;
        const a = 1 - Math.max(0, t - 0.6) / 0.4;
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(0,0,0,${a})`;
        ctx.fillStyle   = `rgba(120,220,140,${a})`;
        ctx.strokeText('+' + f.value, f.x, y);
        ctx.fillText('+' + f.value, f.x, y);
      } else if (f.kind === 'flash') {
        // 画面全体を白く一瞬光らせる（エホーマイ用）
        const a = (1 - t) * 0.5;
        ctx.fillStyle = `rgba(255,240,200,${a})`;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
    });
    ctx.textAlign = 'left';
  }

  function render() {
    // 戦闘中はキャンバスを縮めてコマンドメニューを広げる（コマンドがスクロールで見切れるのを防ぐ）
    const inBattle = (state.scene === 'battle' || state.scene === 'win' || state.scene === 'lose');
    document.body.classList.toggle('battle-mode', inBattle);
    if (state.scene === 'title') return; // titleはhtml側
    if (state.scene === 'newgame') return;
    if (state.scene === 'buildingInfo') { renderBuildingInfo(); updateStatus(); return; }
    if (state.scene === 'foodInfo') { renderFoodInfo(); updateStatus(); return; }
    if (state.scene === 'overworld') { renderOverworld(); updateStatus(); return; }
    if (inBattle) { renderBattle(); updateStatus(); return; }
    {
      // フィールド系シーンに入ったらNPC初期化＋ループ開始（多重呼び出しは無視される）
      if (typeof initNPCWalk === 'function' && NPCS[0].homeX === undefined) initNPCWalk();
      if (typeof startFieldLoop === 'function') startFieldLoop();
      renderField();
    }
    updateStatus();
  }
  function renderAndUpdate() { render(); updateStatus(); }

  function updateStatus() {
    const s = document.getElementById('status');
    if (s.dataset.flash) { s.textContent = s.dataset.flash; return; }
    if (state.scene === 'title' || state.scene === 'newgame') { s.textContent = ''; return; }
    const pb = state.piecesBySong || { soran: 0, dynamic: 0, mano: 0, kur: 0 };
    const songSummary = `ソ:${pb.soran||0} ダ:${pb.dynamic||0} マ:${pb.mano||0} ク:${pb.kur||0}`;
    const p = state.party[0];
    s.innerHTML =
      `<span>Lv ${state.lv} ${p.name} HP${p.hp}/${p.maxHp} MP${p.mp}/${p.maxMp}</span>` +
      `<span>${songSummary} €${state.gold}</span>`;
  }

  // ============================================================
  // ダイアログ
  // ============================================================
  // ============================================================
  // リト語TTS（Web Speech API）＋カタカナルビ
  // ============================================================
  // リト語フレーズ → カタカナ表記対応表
  // ダイアログ表示時に「Labas」→「Labas（ラバス）」のように自動でルビを付ける
  const LT_KATAKANA = {
    'Labas vakaras': 'ラバス・ヴァカラス',
    'Kaip sekasi': 'カイプ・セカシ',
    'Mano kraštas': 'マノ・クラシュタス',
    'Mano krastas': 'マノ・クラシュタス',
    'Kur giria': 'クル・ギリャ',
    'Aš esu': 'アシュ・エス',
    'As esu': 'アシュ・エス',
    'Kiek kainuoja': 'キェク・カイヌオヤ',
    'Kur yra': 'クル・イラ',
    'Atsiprašau': 'アツィプラシャウ',
    'Atsiprasau': 'アツィプラシャウ',
    'Sveiki': 'スヴェイキ',
    'Puikiai': 'プイキャイ',
    'Labas': 'ラバス',
    'Ačiū': 'アチュー',
    'Aciu': 'アチュー',
    'Taip': 'タイプ',
    'Iki': 'イキ',
    'Iki pasimatymo': 'イキ・パシマティモ',
    'Daina': 'ダイナ',
    'Knyga': 'クニガ',
    'Vanduo': 'ヴァンドゥオ',
    'Malda': 'マルダ',
    'Sapnas': 'サプナス',
    'Ne': 'ニェ',
    'Prašau': 'プラシャウ',
    'Prasau': 'プラシャウ',
    'Gerai': 'ゲライ',
  };
  const LT_PHRASES = Object.keys(LT_KATAKANA);
  // 長いフレーズから先に処理（部分一致による誤置換を避ける）
  const LT_PHRASES_SORTED = LT_PHRASES.slice().sort((a, b) => b.length - a.length);
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function annotateLT(line) {
    if (!line || typeof line !== 'string') return line;
    let out = line;
    // 長いフレーズから処理。一度カナ付与した範囲はプレースホルダで隠して、
    // 後続の短いフレーズ（"Labas vakaras" 内の "Labas" 等）が二重マッチしないようにする
    const placeholders = [];
    for (const k of LT_PHRASES_SORTED) {
      // すでに「（カナ）」が後続している場合はスキップ
      const re = new RegExp(escapeRegex(k) + '(?!\\s*[（(])', 'g');
      out = out.replace(re, (match) => {
        const id = placeholders.length;
        placeholders.push(match + '（' + LT_KATAKANA[k] + '）');
        return '\x00' + id + '\x00';
      });
    }
    out = out.replace(/\x00(\d+)\x00/g, (_, id) => placeholders[parseInt(id, 10)]);
    return out;
  }
  let _ltVoice = null;
  function pickLtVoice() {
    if (!('speechSynthesis' in window)) return null;
    if (_ltVoice) return _ltVoice;
    const voices = window.speechSynthesis.getVoices();
    _ltVoice = voices.find(v => /^lt(-|_)?/i.test(v.lang)) || null;
    return _ltVoice;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    // 初回のvoices取得は非同期
    window.speechSynthesis.onvoiceschanged = () => { _ltVoice = null; pickLtVoice(); };
  }
  let _lastLtAudio = null;
  let _ltSpeakSeq = 0;
  function _googleTtsFallback(text, seq) {
    try {
      if (_lastLtAudio) { try { _lastLtAudio.pause(); } catch (e) {} }
      const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=lt&q=' + encodeURIComponent(text);
      const a = new Audio(url);
      a.volume = 1.0;
      a.preload = 'auto';
      a.addEventListener('error', () => { console.warn('[LT-TTS] Google audio error', a.error); });
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.catch(err => { console.warn('[LT-TTS] Google play() rejected:', err && err.message); });
      }
      _lastLtAudio = a;
    } catch (e) { console.warn('[LT-TTS] Google fallback threw:', e); }
  }
  function speakLT(text) {
    if (!text) return;
    // ポリシー: lt-LT voice が確実にインストールされている端末でだけ再生する。
    //   - 他言語voiceで「Labas」を英語読みすると違和感が大きいため、変な発音を避けて無音にする。
    //   - Google翻訳TTSはCORS等で不安定なので使わない。
    //   - 将来 lt-LT voice がOSにインストールされれば自動で鳴るようになる。
    if (!('speechSynthesis' in window)) return;
    const v = pickLtVoice();
    if (!v) return; // lt-LT voice が無い → 無音
    try { audio.duckBGM(0.15, 3.0); } catch (e) {}
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'lt-LT'; u.voice = v;
      u.rate = 0.9; u.pitch = 1.0; u.volume = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { console.warn('[LT-TTS] speak threw:', e); }
  }
  function extractLithuanian(line) {
    if (!line || typeof line !== 'string') return null;
    const found = [];
    for (const w of LT_PHRASES) {
      // 単語境界を厳密に取らず、含有判定（句読点等の前後に対応）
      const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(esc, 'i');
      if (re.test(line)) found.push(w);
    }
    if (found.length === 0) return null;
    return found.join('. ');
  }

  // ============================================================
  // BGM / SE 再生フレームワーク
  // assets/<filename> に mp3 / ogg を置けば自動で鳴る。
  // ファイル不在時は 404 を握りつぶして無音動作（ゲーム進行は止めない）。
  // ============================================================
  // 仮BGM用の手書きメロディ（Web Audio API合成）。
  // 各値: [周波数Hz or null=休符, 拍数(1拍=8分音符)]
  const PROC_BGM = {
    title:  { tempo: 90,  wave: 'triangle', gain: 0.05, notes: [
      [440,2],[523,2],[659,4],[587,2],[523,2],[440,4],[null,2],
      [392,2],[440,2],[523,4],[440,2],[392,2],[330,4],[null,2],
    ]},
    field:  { tempo: 140, wave: 'square',   gain: 0.04, notes: [
      [523,1],[659,1],[784,1],[659,1],[523,1],[440,1],[523,2],[null,1],
      [523,1],[587,1],[659,1],[587,1],[440,1],[523,1],[440,2],[null,1],
      [659,1],[784,1],[880,1],[784,1],[659,1],[523,1],[587,2],[null,1],
      [523,1],[659,1],[784,2],[659,1],[523,1],[392,2],[null,2],
    ]},
    battle: { tempo: 160, wave: 'square',   gain: 0.045, notes: [
      [523,1],[622,1],[523,1],[392,1],[523,1],[622,1],[698,1],[523,1],
      [466,1],[523,1],[466,1],[349,1],[392,1],[466,1],[523,1],[392,1],
      [523,1],[622,1],[784,1],[622,1],[523,1],[466,1],[523,2],[null,1],
    ]},
    boss:   { tempo: 110, wave: 'sawtooth', gain: 0.05, notes: [
      [247,2],[294,2],[247,2],[207,2],[247,4],[null,1],
      [277,2],[247,2],[207,2],[185,2],[207,4],[null,1],
      [247,1],[294,1],[330,1],[294,1],[247,1],[207,1],[247,2],[null,1],
    ]},
    win:    { tempo: 130, wave: 'triangle', gain: 0.06, notes: [
      [523,1],[659,1],[784,1],[1047,2],[null,1],[784,1],[1047,4],[null,2],
    ]},
    inn:    { tempo: 80,  wave: 'sine',     gain: 0.05, notes: [
      [349,2],[523,2],[440,4],[523,2],[440,2],[349,4],[null,2],
      [392,2],[523,2],[466,4],[440,2],[349,2],[392,4],[null,2],
    ]},
    ending: { tempo: 110, wave: 'triangle', gain: 0.35, oneshot: true, notes: [
      // 1: C5 D5 E5(2) D5(2) C5(2) G5(4) F5(4)
      [523,1],[587,1],[659,2],[587,2],[523,2],[784,4],[698,4],
      // 2: E5 D5 G5(2) F5(2) E5(2) D5(8)
      [659,1],[587,1],[784,2],[698,2],[659,2],[587,8],
      // 3: E5 F5 G5(2) F5(3) A5 G5(4) F5(4)
      [659,1],[698,1],[784,2],[698,3],[880,1],[784,4],[698,4],
      // 4: E5 D5 E5(2) G5(2) F5(2) E5(6) G5(2)
      [659,1],[587,1],[659,2],[784,2],[698,2],[659,6],[784,2],
      // 5: G5(4) G5(3) F5 E5(4) D5(4)
      [784,4],[784,3],[698,1],[659,4],[587,4],
      // 6: C5 D5 E5(2) F5(2) A5(2) G5(6) C6(2)
      [523,1],[587,1],[659,2],[698,2],[880,2],[784,6],[1047,2],
      // 7: C6(4) B5(3) A5 G5(4) F5(4)
      [1047,4],[988,3],[880,1],[784,4],[698,4],
      // 8: E5 F5 G5(2) A5(2) A5(2) G5(7) G4
      [659,1],[698,1],[784,2],[880,2],[880,2],[784,7],[392,1],
      // 9: C5(4) B4(3) D5 C5(4) C4(4)
      [523,4],[494,3],[587,1],[523,4],[262,4],
      // 10: C4 D4 E4(2) D4(2) C4(2) G4(6) G4(2)
      [262,1],[294,1],[330,2],[294,2],[262,2],[392,6],[392,2],
      // 11: E5(4) D5(3) D5 G5(4) F5(4)
      [659,4],[587,3],[587,1],[784,4],[698,4],
      // 12: E5 D5 E5(2) F5 E5 D5(2) C5(8)
      [659,1],[587,1],[659,2],[698,1],[659,1],[587,2],[523,8],
      // ループ前の小休止
      [null,4],
    ]},
  };

  // 歌詞ピース完成時(long ~5秒)＆戦闘中の歌コマンド時(short ~2秒)に流す主旋律
  // メロディはケイさんのフィードバックで微調整する想定
  const SONG_BGM = {
    // ソーラン節（ケイさん指定 / 0.5拍=16分音符相当）
    soran: { tempo: 105, wave: 'triangle', gain: 0.09,
      // 拍数据え置き（short=8 / long=16）なのでテンポは前回と同じ
      shortTempo: 107, longTempo: 102,
      // short 計8拍: D5(2) D5(2.5) C5(0.5) F5(1) D5(1) C5(0.5) A4(0.5)
      short: [ [587,2],[587,2.5],[523,0.5],[698,1],[587,1],[523,0.5],[440,0.5] ],
      // long 計16拍:
      // D5(2) D5(2.5) C5(0.5) F5(1) D5(1) C5(0.5) A4(1)
      // D5(0.5) D5(1) C5(1) C5(0.5) C5(0.5) D5(1) D5(0.5) D5(2.5)
      long:  [ [587,2],[587,2.5],[523,0.5],[698,1],[587,1],[523,0.5],[440,1],
               [587,0.5],[587,1],[523,1],[523,0.5],[523,0.5],[587,1],[587,0.5],[587,2.5] ],
    },
    // ダイナミック琉球（ケイさん指定）
    dynamic: { tempo: 154, wave: 'triangle', gain: 0.09,
      // 旧:200,19拍=2.85s → 新:16拍 → 168 / 旧:170,39拍=6.88s → 新:32拍 → 140
      shortTempo: 168, longTempo: 140,
      // short 計16拍: G5(1) F#5(1) E5(5) D5(1) E5(1) E5(1) B4(1) B4(0.5) E5(4.5)
      short: [ [784,1],[740,1],[659,5],[587,1],[659,1],[659,1],[494,1],[494,0.5],[659,4.5] ],
      // long 計32拍: short + 1行 (G5 F#5 E5(2)) + 1行
      long:  [ [784,1],[740,1],[659,5],[587,1],[659,1],[659,1],[494,1],[494,0.5],[659,4.5],
               [784,1],[740,1],[659,2],
               [659,1],[784,1],[880,1],[988,0.5],[880,0.5],[784,1],[880,1],[988,6] ],
    },
    // Mano kraštas（ケイさん指定。short=long同一旋律）
    mano: { tempo: 120, wave: 'triangle', gain: 0.09,
      // ケイさん指示でテンポを少しゆっくり目に（160→145 / 87→80）
      shortTempo: 145, longTempo: 80,
      // 計16拍: C5(1) E5(1) F5(4) F5(2) F5(2) F5(1) C5(5)
      short: [ [523,1],[659,1],[698,4],[698,2],[698,2],[698,1],[523,5] ],
      long:  [ [523,1],[659,1],[698,4],[698,2],[698,2],[698,1],[523,5] ],
    },
    // Kur giria（ケイさん指定）
    kur: { tempo: 110, wave: 'triangle', gain: 0.09,
      // 旧:110,16拍=4.36s → 新:16拍 → 110(同じ) / 旧:110,28拍=7.64s → 新:32拍 → 126 / climaxは29拍同じ→110
      shortTempo: 110, longTempo: 126, climaxTempo: 129,
      // short 計16拍: C5 D5 E5(2) D5(2) C5(2) G5(4) F5(4)
      short: [ [523,1],[587,1],[659,2],[587,2],[523,2],[784,4],[698,4] ],
      // long 計32拍: short + 1行 (E5 D5 G5(2) F5(2) E5(2) D5(8))
      long:  [ [523,1],[587,1],[659,2],[587,2],[523,2],[784,4],[698,4],
               [659,1],[587,1],[784,2],[698,2],[659,2],[587,8] ],
      // climax 計34拍:
      // G4(2) E5(4) D5(3) D5 G5(4) F5(4)
      // E5 D5 E5(2) F5 E5 D5(2) C5(8)
      // 旧29拍@110=7.91s に揃えるため tempo を 129 にUP
      climax: [ [392,2],[659,4],[587,3],[587,1],[784,4],[698,4],
                [659,1],[587,1],[659,2],[698,1],[659,1],[587,2],[523,8] ],
    },
  };

  const audio = {
    files: {
      bgm: {
        title:   'assets/bgm_title.mp3',
        field:   'assets/bgm_field.mp3',
        battle:  'assets/bgm_battle.ogg',
        boss:    'assets/bgm_boss.ogg',
        win:     'assets/bgm_win.wav',
        inn:     'assets/bgm_inn.mp3',
        // ending は procedural（PROC_BGM.ending）で再生する。ファイルが無いと
        // playBGM の play() が解決→失敗の順で発火してフォールバックが
        // 走らないことがあるため、最初から procedural に流す。
      },
      se: {
        decide:    'assets/se_decide.mp3',
        cancel:    'assets/se_cancel.mp3',
        step:      'assets/se_step.mp3',
        encounter: 'assets/se_encounter.mp3',
        sing:      'assets/se_sing.mp3',
        damage:    'assets/se_damage.mp3',
        heal:      'assets/se_heal.mp3',
        piece:     'assets/se_piece.mp3',
        levelup:   'assets/se_levelup.mp3',
        ehomai:    'assets/se_ehomai.mp3',
        victory:   'assets/se_victory.mp3',
      },
    },
    vol: { bgm: 0.40, se: 0.7, master: 1.0 },
    duckLevel: 1.0, _duckTimer: null,
    bgm: null, bgmKey: null,
    bgmGain: null, bgmSrc: null, // Web Audio 経由のBGMルーティング（iOSで .volume が効かない問題対策）
    actx: null, procTimer: null, procToken: 0,
    _applyBGMVolume() {
      // GainNode（あれば）または HTMLAudio.volume に現在のレベルを反映
      const v = this.vol.bgm * this.duckLevel * this.vol.master;
      if (this.bgmGain && this.actx) {
        try {
          const t = this.actx.currentTime;
          this.bgmGain.gain.cancelScheduledValues(t);
          this.bgmGain.gain.setTargetAtTime(v, t, 0.04);
        } catch (e) {}
      }
      if (this.bgm) {
        // GainNode 経由なら .volume は意味ないが、未対応端末用フォールバックで残す
        try { this.bgm.volume = v; } catch (e) {}
      }
    },
    duckBGM(level, sec) {
      // TTS等の音声を聞きやすくするためBGMを一時的に絞る
      this.duckLevel = level;
      this._applyBGMVolume();
      if (this._duckTimer) clearTimeout(this._duckTimer);
      this._duckTimer = setTimeout(() => {
        this.duckLevel = 1.0;
        this._applyBGMVolume();
        this._duckTimer = null;
      }, Math.max(500, sec * 1000));
    },
    ensureCtx() {
      if (!this.actx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        this.actx = new C();
      }
      // iOS Safari は他アプリの音が割り込むと 'interrupted' 状態になり、
      // 'suspended' しか見ていないと復帰漏れで以降のオシレータが無音化する。
      if (this.actx.state === 'suspended' || this.actx.state === 'interrupted') {
        try { this.actx.resume(); } catch (e) {}
      }
      // ユーザー操作で初めてここに到達したタイミングで保留中のBGMを再試行
      this.retryPending();
      // ctx を起こしっぱなしにする「見張り役」オシレータを常駐させる。
      // これが無いとモバイルブラウザで stopBGM 直後にコンテキストが
      // 休止し、続く playSongPhrase / playProcedural が無音になることがある。
      if (!this._aliveOsc) {
        try {
          const osc = this.actx.createOscillator();
          const g = this.actx.createGain();
          // 0.00001 だと iOS が「実質無音」と判定して出力経路を切ってしまう
          // ことがあるため、可聴限界より少し上の -66dB 相当に上げる。
          g.gain.value = 0.0005;
          osc.frequency.value = 1;
          osc.type = 'sine';
          osc.connect(g).connect(this.actx.destination);
          osc.start();
          this._aliveOsc = osc;
        } catch (e) {}
      }
      return this.actx;
    },
    playBGM(key) {
      if (this.bgmKey === key && (this.bgm || this.procToken)) return;
      if (this.bgm) { try { this.bgm.pause(); } catch (e) {} this.bgm = null; }
      // 旧 MediaElementSource は disconnect（Audio要素1つにつき1回しか作れないため、
      // 新しい Audio に都度 source を作り直す）
      if (this.bgmSrc) { try { this.bgmSrc.disconnect(); } catch (e) {} this.bgmSrc = null; }
      this.stopProcedural();
      // 新しいBGMトラックに切り替えるときは進行中のダックをキャンセルしてフル音量に戻す。
      // （climax の duckBGM(0.0, 22) が残っていると次の 'win'/'ending' BGM が無音になる）
      if (this._duckTimer) { clearTimeout(this._duckTimer); this._duckTimer = null; }
      this.duckLevel = 1.0;
      this.bgmKey = key;
      const url = this.files.bgm[key];
      if (url) {
        const a = new Audio(url);
        a.loop = true;
        // ★ iOS Safari は HTMLAudio.volume を無視する（ハードボタン制御のみ）。
        // 対策として Web Audio の MediaElementSource → GainNode にルーティングし、
        // GainNode で実際の音量を制御する。これで duckBGM(0.02) が iOS でも効く。
        const ctx = this.ensureCtx();
        let routed = false;
        if (ctx) {
          try {
            if (!this.bgmGain) {
              this.bgmGain = ctx.createGain();
              this.bgmGain.connect(ctx.destination);
            }
            this.bgmGain.gain.value = this.vol.bgm * this.duckLevel * this.vol.master;
            const src = ctx.createMediaElementSource(a);
            src.connect(this.bgmGain);
            this.bgmSrc = src;
            // 要素自体の volume はフルにしておく（GainNode 側で絞る）
            a.volume = 1.0;
            routed = true;
          } catch (e) {
            // MediaElementSource 失敗時は従来の .volume にフォールバック
          }
        }
        if (!routed) {
          a.volume = this.vol.bgm * this.duckLevel * this.vol.master;
        }
        // play() のPromise解決を待たずに即座に登録する（次のplayBGMが確実にpauseできるよう）
        this.bgm = a;
        const p = a.play();
        if (p && p.then) {
          p.then(() => { this._pendingBGM = null; }).catch((err) => {
            // 失敗 → bgm参照をクリアして必要ならフォールバック
            if (this.bgm === a) this.bgm = null;
            if (this.bgmSrc) { try { this.bgmSrc.disconnect(); } catch (e) {} this.bgmSrc = null; }
            const name = err && err.name;
            if (name === 'NotAllowedError' || name === 'AbortError') {
              // 自動再生ブロック → 次のユーザー操作で再試行する
              this._pendingBGM = key;
            } else {
              // ファイルなし等 → procedural にフォールバック
              this.playProcedural(key);
            }
          });
        }
      } else {
        this.playProcedural(key);
      }
    },
    retryPending() {
      if (this._pendingBGM && this.bgmKey === this._pendingBGM && !this.bgm) {
        const key = this._pendingBGM;
        this._pendingBGM = null;
        this.bgmKey = null; // playBGM が再開できるよう一度クリア
        this.playBGM(key);
      }
    },
    stopBGM() {
      if (this.bgm) { try { this.bgm.pause(); } catch (e) {} this.bgm = null; }
      if (this.bgmSrc) { try { this.bgmSrc.disconnect(); } catch (e) {} this.bgmSrc = null; }
      this.stopProcedural();
      this.bgmKey = null;
    },
    playProcedural(key) {
      const def = PROC_BGM[key];
      if (!def) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const token = ++this.procToken;
      let i = 0;
      const beatSec = 60 / def.tempo / 2; // 1拍=8分音符
      const playNext = () => {
        if (token !== this.procToken) return; // 上書きされたら停止
        // oneshot指定の曲は最後まで来たらループせず終了
        if (def.oneshot && i >= def.notes.length) { this.procTimer = null; return; }
        const [freq, beats] = def.notes[i % def.notes.length];
        const dur = beatSec * beats;
        if (freq) {
          try {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = def.wave;
            osc.frequency.value = freq;
            const t0 = ctx.currentTime;
            const peak = def.gain * this.vol.bgm * this.duckLevel * this.vol.master;
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.linearRampToValueAtTime(peak, t0 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.92);
            osc.connect(g).connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + dur);
          } catch (e) {}
        }
        i++;
        this.procTimer = setTimeout(playNext, dur * 1000);
      };
      playNext();
    },
    stopProcedural() {
      this.procToken++;
      if (this.procTimer) { clearTimeout(this.procTimer); this.procTimer = null; }
    },
    // 歌詞ピース完成時(long)＆戦闘の歌コマンド時(short)用のワンショット主旋律。
    // 既存BGMと並行して鳴らす（procToken と独立）。
    // ダッキングの影響を受けないよう duckLevel を掛けず、SE並みに前面で鳴らす。
    playSongPhrase(songKey, variant) {
      const def = SONG_BGM[songKey];
      if (!def) return 0;
      const notes = def[variant || 'short'];
      if (!notes || notes.length === 0) return 0;
      const ctx = this.ensureCtx();
      if (!ctx) return 0;
      // suspended/interrupted なら再開（モバイルで他アプリ割り込み後の保険）
      const wasFrozen = (ctx.state === 'suspended' || ctx.state === 'interrupted');
      if (wasFrozen) { try { ctx.resume(); } catch (e) {} }
      // variant別にテンポを上書きしたい曲は shortTempo/longTempo を持たせる
      const tempo = def[(variant || 'short') + 'Tempo'] || def.tempo;
      const beatSec = 60 / tempo / 2;
      // climax は他のBGMが完全停止した直後に鳴らすので立ち上がりに余裕を持たせる。
      // バックグラウンド復帰直後（wasFrozen）も ctx.resume() が非同期なため同様に確保。
      // 「思い出した」(long) と同じフォルマント合成パスを通す方が iOS Safari でも
      // 確実に発音するため、climax 専用のシンプル合成パスは廃止した。
      const startDelay = (variant === 'climax' || wasFrozen) ? 0.3 : 0.05;
      let t = ctx.currentTime + startDelay;
      const startT = t;
      // 母音「あ」風フォルマント (F1=730, F2=1090, F3=2440Hz)
      const FORMANTS = [
        { f: 730,  q: 6,  gain: 1.0  },
        { f: 1090, q: 8,  gain: 0.7  },
        { f: 2440, q: 10, gain: 0.35 },
      ];
      // 全variant同一音量で揃える（ケイさん指示: 音量はすべて同じ）
      const variantBoost = 4.0;
      notes.forEach(([freq, beats]) => {
        const dur = beatSec * beats;
        if (freq) {
          try {
            const peak = def.gain * this.vol.se * this.vol.master * variantBoost * 0.7;
            // メイン音源：sawtooth（倍音多め）→ ローパス → フォルマント → 出力
            // 声に近づけるため LP を 2400Hz まで下げて高域のジャリつきを抑える
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 2400;
            lp.Q.value = 0.7;
            // フォルマント・ピーク（並列バンドパスを足し合わせ）
            const formantSum = ctx.createGain();
            formantSum.gain.value = 1.0;
            FORMANTS.forEach(F => {
              const bp = ctx.createBiquadFilter();
              bp.type = 'bandpass';
              bp.frequency.value = F.f;
              bp.Q.value = F.q;
              const fg = ctx.createGain();
              fg.gain.value = F.gain;
              lp.connect(bp); bp.connect(fg); fg.connect(formantSum);
            });
            // フォルマントだけだと痩せるので、ドライ信号も少し混ぜる
            const dry = ctx.createGain();
            dry.gain.value = 0.35;
            lp.connect(dry); dry.connect(formantSum);
            // 振幅エンベロープ（人の声に近い緩やかなアタック・サステイン・リリース）
            const env = ctx.createGain();
            const attack = Math.min(0.09, dur * 0.18);
            env.gain.setValueAtTime(0.0001, t);
            env.gain.linearRampToValueAtTime(peak, t + attack);
            env.gain.setValueAtTime(peak, t + Math.max(attack, dur * 0.7));
            env.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
            formantSum.connect(env); env.connect(ctx.destination);
            // ビブラート LFO（5.5Hz・±8cents → ±約0.46%）
            // 立ち上がりではビブラートを抑え、伸ばし音で揺らす（自然な歌唱）
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 5.5;
            const lfoGain = ctx.createGain();
            const vibAmt = freq * 0.0046;
            const vibDelay = Math.min(0.18, dur * 0.4);
            lfoGain.gain.setValueAtTime(0.0001, t);
            lfoGain.gain.setValueAtTime(0.0001, t + vibDelay);
            lfoGain.gain.linearRampToValueAtTime(vibAmt, t + vibDelay + 0.12);
            lfo.connect(lfoGain);
            // 主オシレータ（sawtooth）
            const osc1 = ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc1.frequency.value = freq;
            lfoGain.connect(osc1.frequency);
            // デチューン重ね（+6cents、軽くコーラス感）
            const osc2 = ctx.createOscillator();
            osc2.type = 'sawtooth';
            osc2.frequency.value = freq;
            osc2.detune.value = 6;
            lfoGain.connect(osc2.frequency);
            // ミックス
            const mix = ctx.createGain();
            mix.gain.value = 0.5;
            osc1.connect(mix); osc2.connect(mix);
            mix.connect(lp);
            // 開始/停止
            lfo.start(t); osc1.start(t); osc2.start(t);
            lfo.stop(t + dur); osc1.stop(t + dur); osc2.stop(t + dur);
          } catch (e) {}
        }
        t += dur;
      });
      return t - startT;
    },
    playSE(key) {
      const url = this.files.se[key];
      if (url) {
        try {
          const a = new Audio(url);
          a.volume = this.vol.se * this.vol.master;
          const p = a.play();
          if (p && p.catch) p.catch(() => this.playProceduralSE(key));
          return;
        } catch (e) {}
      }
      this.playProceduralSE(key);
    },
    playProceduralSE(key) {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const beep = (freq, dur, type, gain) => {
        try {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = type || 'square';
          osc.frequency.value = freq;
          const peak = (gain || 0.1) * this.vol.se * this.vol.master;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
          osc.connect(g).connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + dur);
        } catch (e) {}
      };
      const slide = (f1, f2, dur, type, gain) => {
        try {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = type || 'square';
          osc.frequency.setValueAtTime(f1, t0);
          osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
          const peak = (gain || 0.1) * this.vol.se * this.vol.master;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
          osc.connect(g).connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + dur);
        } catch (e) {}
      };
      switch (key) {
        case 'decide':    beep(880, 0.06, 'square', 0.08); break;
        case 'cancel':    beep(440, 0.08, 'square', 0.08); break;
        case 'step':      beep(220, 0.03, 'square', 0.04); break;
        case 'encounter': slide(330, 880, 0.25, 'sawtooth', 0.12); break;
        case 'sing':      beep(660, 0.12, 'triangle', 0.10); break;
        case 'damage':    slide(300, 80, 0.18, 'sawtooth', 0.12); break;
        case 'heal':      slide(523, 1047, 0.30, 'sine', 0.10); break;
        case 'piece':     slide(659, 1318, 0.40, 'triangle', 0.12); break;
        case 'levelup':   slide(523, 1568, 0.55, 'square', 0.10); break;
        case 'ehomai':    slide(440, 1760, 0.70, 'triangle', 0.12); break;
        case 'victory':   slide(659, 1568, 0.50, 'triangle', 0.12); break;
        default:          beep(660, 0.08, 'square', 0.08);
      }
    },
  };

  function setDialog(lines, after, choices, onChoice) {
    state.dialog = Array.isArray(lines) ? lines : [lines];
    state.dialogIdx = 0;
    state._lastSongTriggerIdx = -1;
    state.afterDialog = after || null;
    state.choices = choices || null;
    state.onChoice = onChoice || null;
    if (state.scene !== 'battle' && state.scene !== 'win' && state.scene !== 'lose' &&
        state.scene !== 'title' && state.scene !== 'newgame') {
      state.scene = 'dialog';
    }
    showDialog();
  }
  function showDialog() {
    const d = document.getElementById('dialog');
    if (state.dialog.length === 0) { d.textContent = ''; return; }
    let rawLine = state.dialog[state.dialogIdx];
    // 「思い出した」ファンファーレのセンチネル検出（先頭に \x02SONG:<key>\x02 が付いていればその曲を流す）
    if (typeof rawLine === 'string' && rawLine.indexOf('\x02SONG:') === 0) {
      const m = rawLine.match(/^\x02SONG:([a-z]+)\x02/);
      if (m) {
        const songKey = m[1];
        rawLine = rawLine.slice(m[0].length);
        // 既に同じ行で発火済みなら二重再生を避ける
        if (state._lastSongTriggerIdx !== state.dialogIdx) {
          state._lastSongTriggerIdx = state.dialogIdx;
          let songDur = 6.0;
          try { songDur = audio.playSongPhrase(songKey, 'long') || 6.0; } catch (e) {}
          // BGMはほぼ消す（0.02 = 2%）。曲の尺＋余韻 0.5 秒だけダック
          try { audio.duckBGM(0.02, songDur + 0.5); } catch (e) {}
        }
      }
    }
    const currentLine = annotateLT(rawLine);
    let html = currentLine;
    // リト語が含まれていれば音声出力（生のテキストから検出）
    const lt = extractLithuanian(rawLine);
    if (lt) speakLT(lt);
    if (state.dialogIdx === state.dialog.length - 1 && state.choices) {
      html += '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">';
      state.choices.forEach((c, i) => {
        html += `<button data-choice="${i}" style="text-align:left;padding:6px 10px;font-size:13px;background:#222;border:1px solid #555;border-radius:6px;color:#fff;cursor:pointer;">${i + 1}. ${c}</button>`;
      });
      html += '</div>';
    } else if (state.dialogIdx < state.dialog.length - 1) {
      html += '<div style="margin-top:6px;font-size:11px;color:#888;">▼ Aで次へ</div>';
    } else {
      html += '<div style="margin-top:6px;font-size:11px;color:#888;">▼ Aで閉じる</div>';
    }
    d.innerHTML = html;
    d.querySelectorAll('[data-choice]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.choice, 10);
        const fn = state.onChoice;
        state.choices = null; state.onChoice = null; state.dialog = [];
        document.getElementById('dialog').textContent = '';
        // 選択肢ハンドラが新しいダイアログを開かない場合に備えて
        // ここで scene を 'field' に戻しておく（ハンドラ内で setDialog すれば 'dialog' に戻る）
        if (state.scene === 'dialog') state.scene = 'field';
        if (fn) fn(i);
      });
    });
  }
  function advanceDialog() {
    // 最後のセリフで選択肢が表示されている時はAで進めない（ボタンで選んでもらう）
    if (state.choices && state.dialogIdx >= state.dialog.length - 1) return;
    if (state.dialogIdx < state.dialog.length - 1) {
      state.dialogIdx++; showDialog();
    } else {
      state.dialog = [];
      document.getElementById('dialog').textContent = '';
      const fn = state.afterDialog;
      state.afterDialog = null;
      if (state.scene === 'dialog') state.scene = 'field';
      if (fn) fn();
      render();
    }
  }
  function pickChoice(i) {
    if (!state.choices) return;
    if (i < 0 || i >= state.choices.length) return;
    const fn = state.onChoice;
    state.choices = null; state.onChoice = null; state.dialog = [];
    document.getElementById('dialog').textContent = '';
    if (state.scene === 'dialog') state.scene = 'field';
    if (fn) fn(i);
  }

  // ============================================================
  // 駅・切符・電車（共用）
  // ============================================================
  const TRAIN_FARE = 10;
  // 切符代を払って電車に乗る。所持金不足なら断る。
  function payAndRideTrain(destKey) {
    if (state.gold < TRAIN_FARE) {
      setDialog([
        `駅員：「あら、 切符代 ${TRAIN_FARE}€ が足りないようですね…」`,
        '「街でもう少しお金を貯めてから、 また来てください。」',
      ]);
      return;
    }
    state.gold -= TRAIN_FARE;
    saveGame();
    playTrainTransition(destKey, () => changeCity(destKey));
  }
  function openStationVilnius() {
    const soranCount = (state.piecesBySong && state.piecesBySong.soran) || 0;
    const SORAN_REQUIRED = 4;
    const metFriends = !!(state.flags.mantas && state.flags.ieva);
    const piecesReady = soranCount >= SORAN_REQUIRED;
    // 条件を満たしていれば切符を発行（初回1枚だけ無料、以降は一律10€）
    if (metFriends && piecesReady && !state.flags.kaunas_ticket) {
      state.flags.kaunas_ticket = true;
      saveGame();
      setDialog([
        '駅員：「Labas! ヴィリニュス中央駅へようこそ。」',
        '「お、あなた…マンタスとイエヴァから話は聞いてますよ。」',
        '「ヴィリニュスでの歌詞集めも一区切りついたみたいですね。」',
        '「カウナス行きの切符、特別に1枚お渡ししますね。」',
        '【カウナス行き切符 を入手！】',
        `「次回からは一律 ${TRAIN_FARE}€ になりますので、 また来てください。」`,
        '「電車はもう間もなく出ます。 そのまま乗車してくださいね。」',
      ], () => {
        playTrainTransition('kaunas', () => changeCity('kaunas'));
      });
      return;
    }
    if (!state.flags.kaunas_ticket) {
      const lines = [
        '駅員：「Labas! ヴィリニュス中央駅へようこそ。」',
        '「カウナス行き、いま窓口は閉まってるんですよ…」',
      ];
      if (!metFriends) {
        lines.push('「マンタスとイエヴァに会ってからまた来てください。」');
      }
      if (!piecesReady) {
        lines.push('「それと、ヴィリニュスで集めるべき歌詞のピースが ' + soranCount + '/' + SORAN_REQUIRED + ' のようですね。」');
        lines.push('「街の人ともっと話して、ピースを集めてから出発しましょう。」');
      }
      setDialog(lines);
      return;
    }
    // 切符あり → 行先選択（訪問済みの全都市から選べる）
    const visited = state.visitedCities || {};
    const choices = ['カウナスへ向かう'];
    if (visited.klaipeda) choices.push('クライペダへ向かう');
    if (visited.trakai)   choices.push('トラカイへ向かう');
    if (visited.siauliai) choices.push('シャウレイへ向かう');
    choices.push('やめる');
    setDialog(
      [`駅員：「次の電車はカウナス行きです。 他の方面の臨時便もありますよ。」`,
       `「切符は一律 ${TRAIN_FARE}€ です。 (所持金: ${state.gold}€)」`],
      null, choices,
      (i) => {
        const pick = choices[i];
        if (pick === 'カウナスへ向かう') {
          payAndRideTrain('kaunas');
        } else if (pick === 'クライペダへ向かう') {
          payAndRideTrain('klaipeda');
        } else if (pick === 'トラカイへ向かう') {
          payAndRideTrain('trakai');
        } else if (pick === 'シャウレイへ向かう') {
          payAndRideTrain('siauliai');
        } else {
          setDialog(['駅員：「では、また。」']);
        }
      }
    );
  }

  function openStationKaunas() {
    const dynCount = (state.piecesBySong && state.piecesBySong.dynamic) || 0;
    const klaipedaReady = dynCount >= 4;
    const visited = state.visitedCities || {};
    const choices = ['ヴィリニュスへ戻る'];
    if (klaipedaReady) choices.push('クライペダへ向かう');
    if (visited.trakai)   choices.push('トラカイへ戻る');
    if (visited.siauliai) choices.push('シャウレイへ戻る');
    choices.push('やめる');
    const intro = klaipedaReady
      ? ['駅員：「Labas! カウナス駅です。」',
         '「お、ダイナミック琉球の譜面、だいぶ集まりましたね。」',
         '「クライペダ行きの臨時便、出せますよ。」',
         `「切符は一律 ${TRAIN_FARE}€ です。 (所持金: ${state.gold}€)」`]
      : ['駅員：「Labas! カウナス駅です。」',
         '「ヴィリニュス行きの電車もすぐ来ますよ。」',
         '「（クライペダ方面はもう少しピースを集めてからまた来てください。）」',
         `「切符は一律 ${TRAIN_FARE}€ です。 (所持金: ${state.gold}€)」`];
    setDialog(intro, null, choices, (i) => {
      const pick = choices[i];
      if (pick === 'ヴィリニュスへ戻る') {
        payAndRideTrain('vilnius');
      } else if (pick === 'クライペダへ向かう') {
        payAndRideTrain('klaipeda');
      } else if (pick === 'トラカイへ戻る') {
        payAndRideTrain('trakai');
      } else if (pick === 'シャウレイへ戻る') {
        payAndRideTrain('siauliai');
      } else {
        setDialog(['駅員：「行ってらっしゃい。」']);
      }
    });
  }

  function openStationKlaipeda() {
    const manoCount = (state.piecesBySong && state.piecesBySong.mano) || 0;
    const trakaiReady = manoCount >= 3; // クライペダで3個集めたらトラカイ行きが解禁
    const slVisited = !!(state.visitedCities && state.visitedCities.siauliai);
    const choices = ['カウナスへ戻る', 'ヴィリニュスへ戻る'];
    if (trakaiReady) choices.push('トラカイへ向かう');
    if (slVisited)   choices.push('シャウレイへ戻る');
    choices.push('やめる');
    const intro = trakaiReady
      ? ['駅員：「Labas! クライペダ駅です。」',
         '「Mano kraštas の譜面、3つ集まりましたね。残りはトラカイの湖畔に。」',
         '「トラカイ行きの臨時便、出せますよ。」',
         `「切符は一律 ${TRAIN_FARE}€ です。 (所持金: ${state.gold}€)」`]
      : ['駅員：「Labas! クライペダ駅です。」',
         '「西の港町へようこそ。Mano kraštas のメロディが、海風と一緒に流れてきますよ。」',
         '「電車はカウナス・ヴィリニュス方面に出ています。」',
         `「切符は一律 ${TRAIN_FARE}€ です。 (所持金: ${state.gold}€)」`];
    setDialog(intro, null, choices,
      (i) => {
        const pick = choices[i];
        if (pick === 'カウナスへ戻る') {
          payAndRideTrain('kaunas');
        } else if (pick === 'ヴィリニュスへ戻る') {
          payAndRideTrain('vilnius');
        } else if (pick === 'トラカイへ向かう') {
          payAndRideTrain('trakai');
        } else if (pick === 'シャウレイへ戻る') {
          payAndRideTrain('siauliai');
        } else {
          setDialog(['駅員：「またのお越しを。」']);
        }
      }
    );
  }

  function openStationTrakai() {
    const manoCount = (state.piecesBySong && state.piecesBySong.mano) || 0;
    const siauliaiReady = manoCount >= 5;
    const choices = ['ヴィリニュスへ戻る', 'カウナスへ戻る', 'クライペダへ戻る'];
    if (siauliaiReady) choices.push('シャウレイへ向かう');
    choices.push('やめる');
    const intro = siauliaiReady
      ? ['駅員：「Labas! トラカイ駅です。」',
         '「Mano kraštas、見事に思い出されたようですね。」',
         '「北のシャウレイ行き、臨時便を出せますよ。十字架の丘の街です。」',
         `「切符は一律 ${TRAIN_FARE}€ です。 (所持金: ${state.gold}€)」`]
      : ['駅員：「Labas! トラカイ駅です。」',
         '「湖と城の街へようこそ。Mano kraštas は、湖の音とともに完成します。」',
         '「電車はヴィリニュス・カウナス・クライペダ方面に出ています。」',
         `「切符は一律 ${TRAIN_FARE}€ です。 (所持金: ${state.gold}€)」`];
    setDialog(intro, null, choices,
      (i) => {
        const pick = choices[i];
        if (pick === 'ヴィリニュスへ戻る') {
          payAndRideTrain('vilnius');
        } else if (pick === 'カウナスへ戻る') {
          payAndRideTrain('kaunas');
        } else if (pick === 'クライペダへ戻る') {
          payAndRideTrain('klaipeda');
        } else if (pick === 'シャウレイへ向かう') {
          payAndRideTrain('siauliai');
        } else {
          setDialog(['駅員：「またのお越しを。」']);
        }
      }
    );
  }

  function openStationSiauliai() {
    const choices = ['ヴィリニュスへ戻る', 'カウナスへ戻る', 'クライペダへ戻る', 'トラカイへ戻る', 'やめる'];
    setDialog(
      ['駅員：「Labas! シャウレイ駅です。」',
       '「北の十字架の丘の街、ようこそ。」',
       '「電車はヴィリニュス・カウナス・クライペダ・トラカイ方面に出ています。」',
       `「切符は一律 ${TRAIN_FARE}€ です。 (所持金: ${state.gold}€)」`],
      null, choices,
      (i) => {
        const pick = choices[i];
        if (pick === 'ヴィリニュスへ戻る') {
          payAndRideTrain('vilnius');
        } else if (pick === 'カウナスへ戻る') {
          payAndRideTrain('kaunas');
        } else if (pick === 'クライペダへ戻る') {
          payAndRideTrain('klaipeda');
        } else if (pick === 'トラカイへ戻る') {
          payAndRideTrain('trakai');
        } else {
          setDialog(['駅員：「またのお越しを。」']);
        }
      }
    );
  }

  // ============================================================
  // NPC会話
  // ============================================================
  function talkNPC(npc) {
    if (npc.kind === 'station_v')  { openStationVilnius();  return; }
    if (npc.kind === 'station_k')  { openStationKaunas();   return; }
    if (npc.kind === 'station_kl') { openStationKlaipeda(); return; }
    if (npc.kind === 'station_tr') { openStationTrakai();   return; }
    if (npc.kind === 'station_sl') { openStationSiauliai(); return; }
    // クイズ設定があるNPCは独自のkindブロックがあっても先取りして共通処理に流す
    if (npc.quiz) { ltQuizOpen(npc); return; }
    if (npc.kind === 'maria') {
      if (state.flags.kl_maria) {
        setDialog([
          'マリア：「コトリーナ姉さんは、街の南で雑貨屋をやってるわ。」',
          '「妹のイエヴァ、元気にしてた？ ヴィリニュスで会ったでしょう？」',
        ]);
        return;
      }
      setDialog(
        ['マリア：「Labas vakaras… 旅の方ですね。」',
         '4姉妹の3女、ヴィオラ奏者。物静かで気品のある女性。',
         '「私はクライペダの劇場で演奏してるの。海の音と弦の音が、よく似合う街なんです。」',
         '「私ね、演奏の前には必ず聴き手と挨拶を交わすことにしているの。」',
         '「あなたは歌い手なのでしょう？ ── では一つだけ。」',
         '「リト語で『こんにちは』、なんて言うかご存じ？」'],
        null,
        ['Labas!', 'Ačiū!', 'Kaip sekasi?'],
        (i) => {
          if (i === 0) {
            state.flags.kl_maria = true;
            const a = awardPiece('mano', 'マリア');
            setDialog([
              'マリア：「Puikiai. 良い発音ね。」',
              '「気持ちのこもった『Labas』は、 もう半分は歌のようなもの。」',
              '「Mano kraštas — 私の故郷、という歌をご存じ？」',
              '「リトアニア人なら誰でも知っている、心の支えのような曲。」',
              '「私が演奏会で使っている譜面、一枚あなたに差し上げます。」',
              '「歌い手のあなたなら、きっと活かしてくれるでしょう。」',
            ].concat(pieceLines(a)), () => saveGame());
          } else if (i === 1) {
            setDialog([
              'マリア：「ふふ、 Ačiū は『ありがとう』ね。」',
              '「気持ちは嬉しいけれど、 まだ何もして差し上げていないわ。」',
              '（…うまく通じなかったようだ。 もう一度話しかけてみよう。）',
            ]);
          } else {
            setDialog([
              'マリア：「Kaip sekasi? は『お元気？』── 気遣ってくれてありがとう。」',
              '「でも今、私が伺ったのは『こんにちは』のほうなの。」',
              '（…うまく通じなかったようだ。 もう一度話しかけてみよう。）',
            ]);
          }
        }
      );
      return;
    }
    if (npc.kind === 'kotryna') {
      setDialog(
        ['コトリーナ：「Sveiki! いらっしゃい！」',
         '4姉妹の長女。面倒見のよさが顔ににじむ女性。雑貨屋の店主。',
         '「あなた、歌い手なんですってね。マリアから聞いたわ。」',
         '「それと、お礼の言葉、リト語で言える？」'],
        null,
        ['Labas!', 'Ačiū!', 'Kaip sekasi?'],
        (i) => {
          if (i === 1) {
            if (!state.flags.kl_kotryna) {
              state.flags.kl_kotryna = true;
              const a = awardPiece('mano', 'コトリーナ');
              setDialog([
                'コトリーナ：「Labai gerai! 上手ね。」',
                '「うちの店、変わったものも置いてるの。古い譜面とか、海の向こうの楽譜とか。」',
                '「これ、Mano kraštas の譜面の写し。お客さんが置いていったの。」',
                '「あなたが持って行ったほうが、よっぽど活きるわ。」',
                '「あ、娘のルツィアがそこにいるでしょ。リト語の練習相手にしてあげて♪」',
              ].concat(pieceLines(a)), () => saveGame());
            } else {
              setDialog([
                'コトリーナ：「Ačiū! ルツィアと遊んでくれてありがとうね。」',
                '「あの子、最近ちょっとおませでね…内緒で物を集める癖があって。」',
              ]);
            }
          } else {
            setDialog(['コトリーナ：「？ 何かしら？」']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'rutsia') {
      // 4歳の天真爛漫な女の子。リト語の練習相手＆おつかいクエストB依頼主。
      // ヴィリニュス再訪時に隠し持っていたKur giriaピースを渡す（仕様準拠）— 将来実装
      const f = state.flags;
      const dynCount = (state.piecesBySong && state.piecesBySong.dynamic) || 0;
      // 未挨拶（初回）はあいさつクイズに分岐
      if (!f.kl_rutsia) {
        setDialog(
          ['ルツィア：「あ、しらないひと！」',
           'コトリーナの娘。4歳。瞳がキラキラしている。',
           '「ねぇねぇ、リトアニアごのあいさつ、しってる？」'],
          null,
          ['Labas!', 'Ačiū!', 'Kaip sekasi?'],
          (i) => {
            if (i === 0) {
              f.kl_rutsia = true;
              saveGame();
              setDialog([
                'ルツィア：「Labas! きゃはは、じょうず！」',
                `「わたしね、おうたうたうのだいすき。${sib()}も？」`,
                '「そうだ、これ、ないしょ。」',
                'ルツィアは何かを大事そうに握りしめている…が、見せてはくれなかった。',
                '（…またどこかで会えそうだ）',
              ]);
            } else {
              setDialog(['ルツィア：「ふぇ〜、わかんない〜」']);
            }
          }
        );
        return;
      }
      // クエスト完了済み
      if (f.fq_kvas_done) {
        setDialog([
          'ルツィア：「クヴァス、 ままにわたしたら、 にっこりわらってくれた〜！」',
          `「ままも、 おばちゃん（マリア）も、 ${sib()}にありがとうって！」`,
          '「またあそぼ〜！」',
        ]);
        return;
      }
      // 持参して届けに来た
      if (f.fq_kvas_carry) {
        f.fq_kvas_carry = false;
        f.fq_kvas_done = true;
        const a = awardPiece('dynamic', 'ルツィア');
        setDialog([
          'ルツィア：「わぁ〜！ ほんとに もってきてくれたの！？」',
          '「ままの だいすきな カウナスのクヴァス！」',
          '「まま、よろこぶよ〜！ ありがとう！」',
          '「あのね、これね、 ままの たいせつなはこから みつけたの。 へんなじ かいてある。」',
          `「『はーいやーさーさ』って よむんだって。 ${sib()}にあげる！」`,
        ].concat(pieceLines(a)), () => saveGame());
        return;
      }
      // 依頼受諾済み・運搬中ではない
      if (f.fq_kvas_req) {
        setDialog([
          'ルツィア：「ままのクヴァス、まだ〜？」',
          '「カウナスのレストランで うってるんだって！」',
        ]);
        return;
      }
      // ダイナミック琉球4個揃ったら依頼開始
      if (dynCount >= 4) {
        f.fq_kvas_req = true;
        saveGame();
        setDialog([
          'ルツィア：「ねぇねぇ、おねがいしていい？」',
          '「ままがね、 さいきんおみせ いそがしくて、 ずっとつかれてるの。」',
          '「カウナスのクヴァス のんだら ぜったいげんきになるって おばちゃん（マリア）が いってた！」',
          '「でもね、 おばちゃんも えんそうかいで カウナス いけないの。」',
          '「カウナス、いったら 1ぽんだけ かってきてほしいなぁ…」',
          '「もってきてくれたら、 ないしょのもの あげる！」',
          '【おつかい：カウナスのクヴァスを持ち帰る】',
        ]);
        return;
      }
      // 通常（依頼条件未達）
      setDialog([
        'ルツィア：「ねぇねぇ、おうたきかせて〜！」',
        '「あ、ままに、ないしょだよ？」',
      ]);
      return;
    }
    if (npc.kind === 'fisher') {
      setDialog(
        ['老漁師：「…おう、旅の人かい。」',
         '日に焼けた顔、節くれだった手、でも目元はやさしい老人。桟橋に座っている。',
         '「クライペダの海はな、毎朝ちがう顔をしとる。」',
         '「── ところで、 旅をしてりゃリト語もいくつか覚えただろう。」',
         '「別れ際にひとこと、 リト語で『またね』ってなんて言うか、 覚えとるかい？」'],
        null,
        ['Iki!', 'Taip', 'Atsiprašau'],
        (i) => {
          if (i === 0) {
            if (!state.flags.kl_fisher) {
              state.flags.kl_fisher = true;
              const a = awardPiece('mano', '老漁師');
              setDialog([
                '老漁師：「Puikiai! はっは、若いのにリト語うまいな。」',
                '「儂はな、若い頃は遠洋漁船に乗っとった。寄港のたびに港の歌を覚えてな。」',
                '「中でも Mano kraštas は、嵐の夜に何度も口ずさんだもんだ。」',
                '「故郷を想う歌は、どこの国でも似とるな。」',
                '「これは儂の宝物の譜面だが…あんたに渡すよ。歌い手なんだろう？」',
              ].concat(pieceLines(a)), () => saveGame());
            } else {
              const manoCount = (state.piecesBySong && state.piecesBySong.mano) || 0;
              if (manoCount >= 3 && !state.flags.witches_done) {
                setDialog([
                  '老漁師：「…ふむ、Mano kraštas を ここまで集めたな。」',
                  '「だったら、桟橋の先まで行ってみな。」',
                  '「霧の向こうに、いつもの小舟が見える日と、見えん日があるんだ。」',
                  '「今日は…見える気がする。」',
                ]);
              } else {
                setDialog([
                  '老漁師：「海風はうそをつかん。きっとあんたの歌も遠くへ届くさ。」',
                  '「桟橋の先の小舟── 風もないのに揺れる夜があってな。 海のほうから歌みたいな声が、 ぽつぽつ聞こえてくるんだ。」',
                ]);
              }
            }
          } else {
            setDialog(['老漁師：「ん？　それじゃ別れの挨拶にならんぞ。 また旅して、 街の連中と話してこい。」']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'sailor') {
      // ダイナミック琉球5個目はおつかいクエストB（ルツィア）に移譲。
      // 船員はヒント役として残す。
      const dynCount = (state.piecesBySong && state.piecesBySong.dynamic) || 0;
      if (state.piecesBySong && state.piecesBySong.dynamic >= 5) {
        setDialog([
          '日本人船員：「いやぁ、ダイナミック琉球、思い出してくれて嬉しいよ！」',
          '「リトアニアから琉球まで、歌は海を越えるんだなぁ。」',
        ]);
        return;
      }
      if (dynCount < 4) {
        setDialog([
          '日本人船員：「やぁ、日本の人だよね？　俺もだよ、横浜から船で来た。」',
          '「『ダイナミック琉球』、知ってるかい？　最近この街で口ずさんでる人を見るよ。」',
          '「カウナスのほうで譜面が広まってるって聞いた。集めてみたら？」',
        ]);
        return;
      }
      // dynCount >= 4：最後の1個はルツィアの方にあるよ、と誘導
      setDialog([
        '日本人船員：「ずいぶん譜面が揃ってきたね。」',
        '「最後のひとつ…？ ふふ、こないだ街で小さな女の子が変な紙を握ってたよ。」',
        '「『はーいやーさーさ』って読み上げてたから、それじゃないかな。」',
        '「劇場前の通りで遊んでた、コトリーナの娘だよ。」',
      ]);
      return;
    }
    if (npc.kind === 'kl_citizen') {
      setDialog(
        ['港町の人：「Labas! クライペダは初めて？」',
         '潮焼けした肌に、人懐っこい笑顔。',
         '「お礼の言葉、リト語で言える？」'],
        null,
        ['Labas!', 'Ačiū!', 'Kaip sekasi?'],
        (i) => {
          if (i === 1) {
            setDialog([
              '港町の人：「Labai gerai! 上手だね。」',
              '「クライペダはね、ドイツ語だとメーメル（Memel）って呼ばれてた港町なんだ。」',
              '「歴史のある場所だよ。劇場前のマリアの演奏は絶対聴いていきな。」',
              '「あと、桟橋の先の小舟── 誰も乗ってないのに、 ときどき男の歌声が漏れてくるって噂だよ。 怖いような、 ありがたいような…」',
            ]);
          } else {
            setDialog(['港町の人：「うーん、なんて言ったの？」']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'spirit_witches') {
      // 中央聖域のチョルリョーニス精霊。試練（ボス戦）→カンクレス授与の流れ。
      if (state.flags.has_kankles) {
        setDialog([
          'チョルリョーニス：「カンクレスは、君の手の中で眠っている。」',
          '「正しい人の手に渡れば、ふたたび鳴り出すだろう。」',
          '「歌え、魂のままに。── 旅の途中で、また会おう。」',
        ]);
      } else if (!state.flags.witches_trial) {
        // 初訪：ボス試練（丘じゅうの彫刻が動き出す） — 挑戦するか選べる
        setDialog(
          ['チョルリョーニス：「よく来たね、歌い手よ。」',
           '「ここは魔女の丘 Raganų kalnas。木々は祈り、彫刻は記憶を抱く場所だ。」',
           '「君に渡したい楽器がある。── カンクレス。」',
           '「だが、彼らは誰にでも手渡しはしない。」',
           'チョルリョーニス：「── 試練に挑むかね？ 丘じゅうの木彫り像が、歌で目覚める。」'],
          null,
          ['挑む', 'まだやめておく'],
          (i) => {
            if (i === 0) {
              setDialog([
                '精霊が手を上げると、丘じゅうの木彫り像がきしみながら目を開いた。',
                '魔女・悪魔・英雄たちが、輪になって踊り始める。',
                '「歌い鎮めなさい。 ── 君の歌が、本物かどうか彼らが見ている。」',
              ], () => startBattle({
                type: 'witches_idols', name: '踊り出した彫刻たち',
                hp: 160, maxHp: 160, atk: 9, xp: 70, gold: 0, boss: true,
              }));
            } else {
              setDialog([
                'チョルリョーニス：「うむ、 焦ることはない。」',
                '「歌は、 心が満ちたときに最も遠くまで届く。」',
                '「準備が整ったら、 また私のもとへ来なさい。」',
              ]);
            }
          }
        );
      } else {
        // 試練クリア後：カンクレス授与
        setDialog([
          'チョルリョーニス：「── 見事だった、歌い手よ。」',
          '「彼らは満足して、また木の中へ眠りに戻った。」',
          '台座の上に、古い弦楽器がひとつ静かに現れた。',
          '木目に光が走り、湖のように透き通った音が、ひとつだけ響いた。',
          '【カンクレス を入手！】',
          '「これは、誰かのために弾く楽器だ。いずれ、それを必要とする人と会うだろう。」',
          '「── ヴィリニュスへ戻ったとき、着物の歌い手を探しなさい。」',
          '「彼女は、自分の音をなくして泣いている。」',
        ], () => {
          state.flags.has_kankles = true;
          state.flags.witches_done = true;
          saveGame();
        });
      }
      return;
    }
    if (npc.kind === 'witches_elder') {
      setDialog([
        '森の老女：「ここに来たのかい、若いの。」',
        '「この丘の彫刻は、80もの数があってね。」',
        '「魔女、悪魔、英雄、農夫…リトアニアの伝説をぜんぶ刻んである。」',
        '「夜になるとな、みんな少しだけ動くんだよ。 ── 嘘だけどね。」',
        '老女は皺だらけの顔で、にっと笑った。',
      ]);
      return;
    }
    // ========== トラカイのNPC ==========
    if (npc.kind === 'spirit_trakai') {
      // 湖上の橋の上に現れるチョルリョーニス精霊（C演出） — 1度話すと消える
      setDialog([
        'チョルリョーニス：「── 湖の上で、また会えたな。」',
        '湖面に薄く映る彼の姿は、影とも光ともつかない。',
        '「ここトラカイは、リトアニアの心臓に近い。」',
        '「Mano kraštas── 私の故郷。 言葉ではなく、土地そのものが歌になる場所だ。」',
        '「歌い手よ、君が探している旋律は、もう君のすぐそばにある。」',
        '「湖の音、城の影、家路の風。── すべてが Mano kraštas だ。」',
        '精霊は微笑み、湖の波紋とともに静かに薄れていった。',
      ], () => {
        const spirit = NPCS.find(n => n.kind === 'spirit_trakai');
        if (spirit) {
          spirit.fading = { t0: performance.now(), dur: 2000 };
          state.flags.spirit_trakai_seen = true;
          saveGame();
          const fadeInt = setInterval(() => {
            render();
            if (performance.now() - spirit.fading.t0 >= 2000) {
              clearInterval(fadeInt);
              rebuildNPCs('trakai');
              render();
            }
          }, 80);
        } else {
          state.flags.spirit_trakai_seen = true;
          saveGame();
        }
      });
      return;
    }
    if (npc.kind === 'tr_fisher') {
      // 漁師：Mano kraštas 4個目
      if (state.flags.tr_fisher) {
        setDialog([
          '漁師：「城には吟遊詩人の年寄りが居るぞ。」',
          '「彼の歌う Mano kraštas は、湖の音そのものだ。」',
        ]);
        return;
      }
      setDialog(
        ['トラカイの漁師：「Labas. 旅人かい。」',
         '湖畔で網を繕いながら、しゃがれた声で話しかけてくる老人。',
         '「この湖はね、私の故郷そのものなんだ。 父も祖父も、ここで魚を獲ってきた。」',
         '「── ところで、 リト語で『ふるさと』ってなんて言うか分かるかね？」'],
        null,
        ['Mano kraštas', 'Labas vakaras', 'Iki pasimatymo'],
        (i) => {
          if (i === 0) {
            state.flags.tr_fisher = true;
            const a = awardPiece('mano', 'トラカイの漁師');
            setDialog([
              '漁師：「Puikiai! ── そう、Mano kraštas。 私のふるさと、という意味だ。」',
              '「あんたが集めてる曲の名前そのものだよ。」',
              '「譜面の切れ端、長年舟に置いてあったやつをやろう。」',
              '「歌のうまい人間に渡るほうが、紙だって嬉しかろうて。」',
            ].concat(pieceLines(a)), () => saveGame());
          } else {
            setDialog(['漁師：「ふむ、それは別の意味だな。 もう一度よく考えてみい。」']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'tr_bard') {
      // 老吟遊詩人：Mano kraštas 5個目（→ 思い出した！）
      if (state.flags.tr_bard) {
        setDialog([
          '老吟遊詩人：「もう私の役目は終わった。」',
          '「歌うのは、君だ。」',
        ]);
        return;
      }
      setDialog(
        ['老吟遊詩人：「── ようこそ、トラカイ城へ。」',
         '湖の窓辺に佇む白髭の老人。古びたカンクレス…ではない、別の弦楽器を抱えている。',
         '「私はもう声が出ぬ。だが、譜面ならいくらでもある。」',
         '「Mano kraštas を、最後の一葉まで集めに来たのだろう？」',
         '「最後の譜面を渡そう。 ── ところで、 リト語で『歌』をなんと言うか知っているか？」'],
        null,
        ['Daina', 'Knyga', 'Vanduo'],
        (i) => {
          if (i === 0) {
            state.flags.tr_bard = true;
            const a = awardPiece('mano', '老吟遊詩人');
            setDialog([
              '老吟遊詩人：「Puikiai. ── そう、Daina。」',
              '「君が目指す祭典 Dainų šventė も、 Daina から来ている。 『歌の祭典』だ。」',
              '「これが最後の譜面だ。私が若き日に、湖の上で書きとめた一節。」',
              '老人は震える手で羊皮紙を差し出した。風が湖面を渡り、紙を一度だけそよがせた。',
            ].concat(pieceLines(a)), () => saveGame());
          } else {
            setDialog(['老吟遊詩人：「ふむ、それは別の言葉だ。 もう一度よく考えてみるがよい。」']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'tr_karaim') {
      setDialog([
        'カライム女性：「Labas. 私はカライムの民の末裔よ。」',
        '東欧でも珍しい民族。トラカイには600年以上前から暮らしている。',
        '「うちの店のキビナイは、本場のカライム風よ。 食べてみてね。」',
      ]);
      return;
    }
    if (npc.kind === 'tr_kid') {
      setDialog([
        '街の少女：「Labas! 城に行くの？ 橋の途中で何か光るものを見たって、お父さんが言ってた。」',
        '「精霊かもね。ここはそういう街だから。」',
      ]);
      return;
    }
    // ========== シャウレイのNPC ==========
    if (npc.kind === 'victoria') {
      // 歌姫対決（友好戦闘） — 勝っても負けてもピース貰える設計
      if (state.flags.victoria_done) {
        setDialog([
          'ヴィクトリア：「あの歌、素敵だったわ。」',
          '「十字架の丘で、白いマントの男性を見たの。きっとあなたの旅の道しるべよ。」',
        ]);
        return;
      }
      setDialog(
        ['ヴィクトリア：「あら、旅の歌い手？」',
         '艶やかな黒髪を肩に流した、立ち姿だけで歌姫と分かる女性。',
         '「ちょうどよかった。ここシャウレイの広場で、私と一本勝負しない？」',
         '「歌姫対決── どちらが心を震わせるか、街の人に決めてもらいましょ。」',
         '「もちろん勝っても負けても、Kur giria の譜面はあなたに渡すわ。 約束よ。」'],
        null,
        ['応じる', '今はやめておく'],
        (i) => {
          if (i === 0) {
            startBattle({
              type: 'victoria', name: 'ヴィクトリア',
              hp: 200, maxHp: 200, atk: 11, xp: 90, gold: 0, boss: true,
            });
          } else {
            setDialog(['ヴィクトリア：「ふふ、いつでもいらっしゃい。 私は逃げないわ。」']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'sl_pilgrim') {
      // 十字架の丘で巡礼している老人 — Kur giria 1個目
      if (state.flags.sl_pilgrim) {
        setDialog([
          '巡礼者：「丘の頂のあたりに、白い影がときどき見えると噂です。」',
          '「── あなたを呼んでいるのかもしれません。」',
        ]);
        return;
      }
      setDialog(
        ['巡礼者：「Labas. ここに来たのは、初めてですか。」',
         '丘いっぱいに立つ十字架を、ひとつひとつ確かめるように歩いている老人。',
         '「私の家系は代々ここに十字架を立ててきた。 ソ連時代も、夜のあいだに何度も。」',
         '「祈りと音楽は、同じだと思いませんか。 ── ところで、 リト語で『祈り』をなんと言うか分かりますか？」'],
        null,
        ['Malda', 'Sapnas', 'Daina'],
        (i) => {
          if (i === 0) {
            state.flags.sl_pilgrim = true;
            const a = awardPiece('kur', '巡礼者');
            setDialog([
              '巡礼者：「Puikiai. ── そう、Malda。」',
              '「私たちはここで毎日 Malda を捧げています。 歌もまた、ひとつの Malda です。」',
              '「歌い手のあなたに、ひとつ譜面を譲りましょう。」',
              '「Kur giria —— どこに森があるのか。 リトアニアの心の深いところに響く歌です。」',
            ].concat(pieceLines(a)), () => saveGame());
          } else {
            setDialog(['巡礼者：「ふむ、それは別の言葉ですね。 もう一度ゆっくり考えてみましょう。」']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'sl_elder') {
      // 街の老婦人 — 街の語り部（ピース授与なし）
      setDialog(
        ['街の老婦人：「Labas vakaras… ここは静かでいいでしょう。」',
         '広場のベンチで、編み物の手を止めて旅人を見上げる女性。',
         '「私はね、若い頃にこの街の合唱団で歌っていたの。 今でも家事の合間に口ずさんでいるのよ。」',
         '「あなたは旅の歌い手でしょう。 調子はいかが？」'],
        null,
        ['Labas!', 'Ačiū!', 'Kaip sekasi?'],
        (i) => {
          if (i === 2) {
            setDialog([
              '街の老婦人：「Puikiai. やさしい発音ね。」',
              '「十字架の丘はね、誰かを思って釘を打つ場所なの。 願いと祈りが、長い年月で森になっていったのよ。」',
              '「歌もそう。 ひとりひとりの声が積み重なって、街そのものが歌い出すの。」',
              '「丘の上のヴィクトリアに会ってきなさい。 街じゅうの自慢の歌姫よ。」',
              '「それから、北のレストランの黒パン── あれは蜂蜜酒に合うの。 旅のお土産にぜひね。」',
            ]);
          } else {
            setDialog(['街の老婦人：「ふふ、まずはお互いの調子からよ。」']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'spirit_siauliai') {
      // チョルリョーニス精霊（C演出）— ヴィクトリア対決後に十字架の丘に出現、1度話したら消える
      setDialog([
        'チョルリョーニス：「── ここでも、また会えたな。」',
        '丘の風が止み、十字架の影が一斉に薄くなった。',
        '「祈りと音楽は、同じだ。」',
        '「人がそこに立ち、何かを願う── その瞬間に、世界はわずかに鳴る。」',
        '「君の歌も、ひとつの十字架だ。 誰かのために、ここに立てなさい。」',
        '「── そろそろ、最初の街へ戻るときだ。」',
        '「君が旅立った場所に、まだ歌い残した声がある。」',
        '精霊は微笑み、丘の風とともに静かに薄れていった。',
      ], () => {
        const spirit = NPCS.find(n => n.kind === 'spirit_siauliai');
        if (spirit) {
          spirit.fading = { t0: performance.now(), dur: 2000 };
          state.flags.spirit_siauliai_seen = true;
          saveGame();
          const fadeInt = setInterval(() => {
            render();
            if (performance.now() - spirit.fading.t0 >= 2000) {
              clearInterval(fadeInt);
              rebuildNPCs('siauliai');
              render();
            }
          }, 80);
        } else {
          state.flags.spirit_siauliai_seen = true;
          saveGame();
        }
      });
      return;
    }
    if (npc.kind === 'elena') {
      setDialog(
        ['エレナ：「Labas! カウナスへようこそ。」',
         'ピアノ教室を開いている、4姉妹の2女。陽気で笑顔がまぶしい。',
         '「あなた、歌うのが好きなのね。リト語のあいさつ、覚えてる？」'],
        null,
        ['Labas!', 'Ačiū!', 'Kaip sekasi?'],
        (i) => {
          if (i === 0) {
            if (!state.flags.kaunas_elena) {
              state.flags.kaunas_elena = true;
              const a = awardPiece('dynamic', 'エレナ');
              setDialog([
                'エレナ：「Puikiai! 良い発音！」',
                '「夫のマリウスは無口だけど、優しいの。話しかけてみて。」',
                '「そうだ、ピアノ教室の生徒さんが沖縄旅行のお土産にくれた譜面があるの。」',
                '「あなたみたいな歌い手にこそ似合うわ。受け取って？」',
              ].concat(pieceLines(a)), () => saveGame());
            } else {
              setDialog([
                'エレナ：「Puikiai! いつ聞いても良い発音ね。」',
                '「街の北の白い建物、チョルリョーニス美術館は必ず寄ってほしい場所よ。」',
              ]);
            }
          } else {
            setDialog(['エレナ：「うふふ、まずは Labas! からよ。」']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'marius') {
      if (!state.flags.kaunas_marius) {
        state.flags.kaunas_marius = true;
        const a = awardPiece('dynamic', 'マリウス');
        setDialog([
          'マリウス：「…Labas。」',
          '熊のように大柄で、口数は少ないがやさしい目をした男。',
          'アーティスト兼ITエンジニアという二刀流。',
          '「カウナスは、川と歴史の街だ。…ゆっくり見ていけ。」',
          '「…そういえば、書斎の引き出しに古い譜面が入ってた。」',
          '「俺には読めん。お前さん、歌い手なんだろ？ 持っていけ。」',
        ].concat(pieceLines(a)), () => saveGame());
      } else {
        setDialog([
          'マリウス：「…元気か。」',
          '「美術館に行くなら、エレナと一緒のほうが楽しいぞ。」',
        ]);
      }
      return;
    }
    if (npc.kind === 'kid_k') {
      setDialog(
        ['少年：「Labas! あんた旅の人だろ？」',
         '駆け回っている地元の少年。',
         '「な、リト語クイズ出していい？ ── 『元気？』ってリト語でなんて言うか知ってる？」'],
        null,
        ['Labas!', 'Ačiū!', 'Kaip sekasi?'],
        (i) => {
          if (i === 2) {
            if (!state.flags.kaunas_kid) {
              state.flags.kaunas_kid = true;
              const a = awardPiece('dynamic', 'カウナスの少年');
              setDialog([
                '少年：「Puikiai! あんた、リト語うまいな！」',
                '「な、これあげるよ。父ちゃんが昔ヨットレースで沖縄行ったときのおみやげの譜面。」',
                '「でも俺は楽譜読めないし、歌うのもうまくないから。」',
              ].concat(pieceLines(a)), () => saveGame());
            } else {
              setDialog([
                '少年：「Puikiai! あんた、リト語うまいな！」',
                '「カウナス城は北西、川の合流するとこにあるんだぜ！」',
              ]);
            }
          } else {
            setDialog(['少年：「ちがーう！ 正解は『Kaip sekasi?』だよ！」']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'citizen') {
      // おつかいクエストA: ソーラン節5個目を「ヴィリニュスのキビナイ持ち帰り」で解禁
      const f = state.flags;
      const soranCount = (state.piecesBySong && state.piecesBySong.soran) || 0;
      if (f.fq_kibinai_done) {
        setDialog([
          npc.name + '：「いやぁ、あのキビナイは美味かった…ありがとうな。」',
          '「ソーラン節、思い出せたかい？ よかったよかった。」',
          '「次は…ダイナミック琉球ってやつかい？ 街の連中に聞いて回るといいさ。」',
        ]);
      } else if (f.fq_kibinai_carry) {
        // 持参して届けに来た
        f.fq_kibinai_carry = false;
        f.fq_kibinai_done = true;
        const a = awardPiece('soran', npc.name);
        setDialog([
          npc.name + '：「お、おお…これは、ヴィリニュスのキビナイ！」',
          '「焼きたての香りまでするじゃないか…ありがとう、ありがとう。」',
          '「年寄りの戯言につきあってくれてすまんな。 これは礼だ。」',
          '「半年前、ヴィリニュスの古本市で買った変な紙切れだ。」',
          '「日本語っぽい文字でな…『ハイハイ ソーラン ソーラン』って書いてある。」',
          '「あんたなら使えるかもしれん。持っていきな。」',
        ].concat(pieceLines(a)), () => saveGame());
      } else if (f.fq_kibinai_req) {
        setDialog([
          npc.name + '：「キビナイ、まだかい？」',
          '「ヴィリニュスのレストランなら包んでくれるはずだ。」',
          '「年寄りはあの味が忘れられんでなぁ…。」',
        ]);
      } else if (soranCount >= 4) {
        // 依頼開始
        f.fq_kibinai_req = true;
        saveGame();
        setDialog([
          npc.name + '：「カウナスはね、第二の首都って呼ばれてるんだよ。」',
          '「戦間期はここが首都だった時代もあるんだ。」',
          '「ところで、あんた歌い手だろ？ ヴィリニュスから来たんだよな。」',
          '「…なぁ、頼みごとがあるんだが、いいかい？」',
          '「ヴィリニュスのキビナイが、無性に食いたいんだ。」',
          '「年寄りの足じゃ、もうあそこまで行けんでな。」',
          '「持ってきてくれたら、礼に古い譜面を譲るよ。 日本語っぽい字のやつだ。」',
          '【おつかい：ヴィリニュスのキビナイを持ち帰る】',
        ]);
      } else {
        setDialog([
          npc.name + '：「カウナスはね、第二の首都って呼ばれてるんだよ。」',
          '「戦間期はここが首都だった時代もあるんだ。」',
          '「チョルリョーニス美術館は、僕らの誇りさ。」',
        ]);
      }
      return;
    }
    if (npc.kind === 'rutsia_v') {
      // ルツィア（ヴィリニュス再訪 Phase 6）— 家族でダイヌシュベンテ観覧に来ている
      // クライペダ初対面時に「ないしょ」と握っていた紙片を、ここでようやく渡す
      const f = state.flags;
      if (f.rutsia_v_done) {
        setDialog([
          'ルツィア：「ままも、 おばちゃん（マリア）も、 ヴィリニュスのおいしいごはん たべてる！」',
          '「シャコティスもキビナイも、ぜんぶ おいしかった〜！」',
          `「${sib()}の うた、ぜったいきくね！」`,
        ]);
        return;
      }
      const kurCount = (state.piecesBySong && state.piecesBySong.kur) || 0;
      // すでに5/5に到達している場合（既存セーブの救済）はピース授与をスキップして温かい再会だけ
      if (kurCount >= 5) {
        f.rutsia_v_done = true;
        saveGame();
        setDialog([
          `ルツィア：「あ、${sib()}！ ヴィリニュスでも あえた〜！」`,
          '「ままと、おばちゃん（マリア）と、 ダイヌシュベンテみにきたの！」',
          '「あのとき ないしょのもの、わたしたかったんだけど…」',
          `「もう、${sib()}の うた、 きこえてくるよ。」`,
          '（ルツィアは握っていた紙片を、 そっと旅の鞄に挟んでくれた）',
        ]);
        return;
      }
      f.rutsia_v_done = true;
      const a = awardPiece('kur', 'ルツィア');
      setDialog([
        `ルツィア：「あ、${sib()}！ ヴィリニュスでも あえた〜！」`,
        '「ままと、おばちゃん（マリア）と、 ダイヌシュベンテみにきたの！」',
        `「あのね、${sib()}に また あいたくて、 これずーっと もってたの。」`,
        'ルツィアは小さな手のひらを そっと開いた── 古びた紙片が一葉。',
        '「ままの ほんの あいだに はさんであったやつ。 ふるい えのうた、なんだって。」',
        `「${sib()}に わたすって、 きめてたの！」`,
      ].concat(pieceLines(a)), () => saveGame());
      return;
    }
    if (npc.kind === 'yamasaki') {
      // ユウコヤマサキ（ヴィリニュス再訪 Phase 6）
      // 着物のカンクレス奏者。リトアニアで絶大な人気の日本人。
      // 魔女の丘で授かったカンクレス（state.flags.has_kankles）と引き換えに Kur giria ピース1個。
      const f = state.flags;
      if (f.yamasaki_done) {
        setDialog([
          'ユウコヤマサキ：「あなたのおかげで、また弾けるわ。」',
          '「ダイヌシュベンテ、楽しみにしてる。お互い、いい歌を。」',
          'ふわりと風が吹き、彼女の着物の袖がそよいだ。',
        ]);
        return;
      }
      if (!f.yamasaki_met) {
        f.yamasaki_met = true;
        saveGame();
        setDialog([
          '紅の着物に身を包んだ女性が、空のカンクレス台のそばに腰を下ろしている。',
          'ユウコヤマサキ：「Labas. ── ああ、日本の方？ 久しぶりに故郷の言葉が聞ける。」',
          '「私はユウコ・ヤマサキ。 こちらでカンクレスを弾いて、もう10年になるかしら。」',
          '「実は…大切なカンクレスをなくしてしまって。 旅の途中で、置き忘れてきてしまったのよ。」',
          '「ダイヌシュベンテで弾く約束をしているのに、 楽器なしじゃ どうにもならなくて。」',
          '「もし旅先で、 古いカンクレスを見かけたら── 知らせてくれない？」',
        ]);
        return;
      }
      if (f.has_kankles) {
        // カンクレス交換 → Kur giriaピース授与
        f.has_kankles = false;
        f.yamasaki_done = true;
        const a = awardPiece('kur', 'ユウコヤマサキ');
        setDialog([
          'ユウコヤマサキ：「── あら、それ…」',
          '「魔女の丘の…！ まさか、本当に届けてくれるなんて。」',
          '【カンクレス を ユウコヤマサキ に渡した！】',
          'ユウコヤマサキは目を細め、そっと弦をつま弾いた。',
          '澄んだ音が、ピリエス通りの石畳に染み込んでいく。',
          '「お礼に、これを。 むかし師匠に教わった、 リトアニアの古い歌の一節。」',
          '「『Kur giria』── 緑の森のあるところ。 きっと、あなたの旅にも力をくれる。」',
        ].concat(pieceLines(a)), () => saveGame());
        return;
      }
      // 再訪してるけど、まだカンクレスを持ってきていない
      setDialog([
        'ユウコヤマサキ：「カンクレス…どこかで見つかると いいんだけど。」',
        '「魔女の丘── クルシュー砂州のあのあたりに、 古い楽器の伝承があるのよ。」',
        '「もし旅の途中で出会ったら、 ぜひ持ってきてね。」',
      ]);
      return;
    }
    if (npc.kind === 'gintere') {
      // ギンターレ（ヴィリニュス、Phase 7 送り出し役）
      // Kur giria 5/5達成で出現するが、 他の3曲が未完なら送り出さずに不足を伝える。
      // 「揃った状態での初対面」と「不揃い状態での初対面」は別フラグで管理し、
      // 不揃い時に挨拶した後に揃えて再訪したときも、 きちんと「正規の初対面」が走るようにする。
      const f = state.flags;
      const pb = state.piecesBySong || {};
      const SONG_NAMES = { soran:'ソーラン節', dynamic:'ダイナミック琉球', mano:'Mano kraštas', kur:'Kur giria' };
      const missing = [];
      ['soran','dynamic','mano','kur'].forEach(k => {
        const c = pb[k] || 0;
        if (c < 5) missing.push(`${SONG_NAMES[k]} (${c}/5)`);
      });
      const allFull = missing.length === 0;
      const missingLine = '　' + missing.join(' / ');

      // 既に会場入り済み（少なくとも一度はVingisパークへ行った）→ 再ワープ案内
      if (f.vingis_arrived) {
        if (!allFull) {
          setDialog([
            'ギンターレ：「── まだ歌が完全ではないようね。」',
            '「思い出しきれていない歌詞：」',
            missingLine,
            '「Vingisパークのステージは、 4曲すべてを取り戻した者だけが立てる場所。」',
            '「もう一度、 旅した街を巡ってきなさい。」',
          ]);
          return;
        }
        setDialog([
          'ギンターレ：「もういちど Vingisパークへ？」',
          `「いいわよ。 ${state.party[0].name}さん、 行ってらっしゃい。」`,
        ], null, ['Vingisパークへ', 'やっぱりやめる'], (i) => {
          if (i !== 0) { setDialog(['ギンターレ：「気が向いたら、 いつでも。」']); return; }
          setDialog(['（ギンターレに導かれ、 Vingisパークへ向かった── ）'], () => {
            fadeCanvas(800, 1);
            setTimeout(() => { changeCity('vingis'); fadeCanvas(800, 0); }, 900);
          });
        });
        return;
      }

      // 揃っているケース
      if (allFull) {
        // 4曲揃った状態で初めて会う → 正規の長い挨拶
        if (!f.gintere_met) {
          f.gintere_met = true;
          saveGame();
          setDialog([
            '広場の北で、 深い色のドレスをまとった女性がじっと旅人を見ている。',
            '佇まいだけで「歌の人」と分かる、 静かな威厳。',
            'ギンターレ：「Sveiki. ── あなたが、 4曲を取り戻した歌い手ね。」',
            '「私はギンターレ。 もうずいぶん長くこの国の歌を歌ってきた。」',
            '「ダイヌシュベンテの最終ステージは Vingisパーク。 リトアニア人なら誰もが、 一生に一度はあそこで歌うことを夢見るの。」',
            '「ピースは揃った。 心の準備が出来たら、 私のところへ来なさい。 道を開けるわ。」',
          ]);
          return;
        }
        // 既に挨拶済 → 通常の選択肢
        setDialog([
          'ギンターレ：「準備はできた？」',
          '「Vingisパークの大ステージは、 行けば分かるわ。 3万の声があなたを迎える。」',
        ], null, ['行く', 'まだ準備中'], (i) => {
          if (i !== 0) {
            setDialog([
              'ギンターレ：「焦らなくていい。 街の人と話して、 心を整えてからいらっしゃい。」',
            ]);
            return;
          }
          f.vingis_arrived = true;
          saveGame();
          setDialog([
            'ギンターレ：「では、行きましょう。 道はもう開いている。」',
            '（ギンターレに導かれ、 Vingisパークへ向かった── ）',
          ], () => {
            fadeCanvas(800, 1);
            setTimeout(() => { changeCity('vingis'); fadeCanvas(800, 0); }, 900);
          });
        });
        return;
      }

      // 揃っていないケース
      // 不揃い状態で初めて会う → 長い不完全挨拶（ただし f.gintere_met は据え置き）
      if (!f.gintere_met_incomplete) {
        f.gintere_met_incomplete = true;
        saveGame();
        setDialog([
          '広場の北で、 深い色のドレスをまとった女性がじっと旅人を見ている。',
          '佇まいだけで「歌の人」と分かる、 静かな威厳。',
          'ギンターレ：「Sveiki. ── あなたが、 Kur giria を思い出した歌い手ね。」',
          '「私はギンターレ。 もうずいぶん長くこの国の歌を歌ってきた。」',
          'ギンターレ：「── でも、 あなたの歌声には、 まだ欠けた音があるわ。」',
          '「思い出しきれていない歌詞：」',
          missingLine,
          '「ダイヌシュベンテのステージは、 すべての歌を取り戻した者だけが立てる場所。」',
          '「もう一度、 旅した街を巡って── 残った旋律を集めてきなさい。」',
        ]);
        return;
      }
      // 不揃いで2回目以降 → 短い再案内
      setDialog([
        'ギンターレ：「── まだ歌が完全ではないようね。」',
        '「思い出しきれていない歌詞：」',
        missingLine,
        '「ダイヌシュベンテで歌うのは、 全部の歌を取り戻したあなたよ。」',
        '「もう一度、 旅した街を巡ってらっしゃい。 焦らずに。」',
      ]);
      return;
    }
    if (npc.kind === 'gintere_v') {
      // ギンターレ（Vingisパーク側）— Phase 7-3 で最終戦への進行役
      const pb = state.piecesBySong || {};
      const allSongs = (pb.soran||0) >= 5 && (pb.dynamic||0) >= 5 && (pb.mano||0) >= 5 && (pb.kur||0) >= 5;
      const done = !!state.flags.dainusvente_done;
      // ダイヌシュベンテクリア後 — ねぎらいの会話のみ
      if (done) {
        setDialog([
          'ギンターレ：「あの夜の歌声、 リトアニア中の人がまだ覚えている。」',
          `「${state.party[0].name}さん── あなたは、 私たちにとって永遠の歌い手よ。」`,
          '（…ヴィリニュス市街へいったん戻るか？）',
        ], null, ['ヴィリニュスへ戻る', 'まだ会場にいる', '[テスト] もう一度戦う'], (i) => {
          if (i === 2) {
            // ▼テスト用：本番をもう一度。フラグを倒してから再突入。
            //   リリース時はこの選択肢ごと削除すること。
            state.flags.dainusvente_done = false;
            startDainusvente();
            return;
          }
          if (i !== 0) { setDialog(['ギンターレ：「ゆっくりしていきなさい。」']); return; }
          setDialog(['（ヴィリニュス市街へ戻った── ）'], () => {
            state.flags._returnFromVingis = true;
            fadeCanvas(800, 1);
            setTimeout(() => { changeCity('vilnius'); fadeCanvas(800, 0); }, 900);
          });
        });
        return;
      }
      // 全曲集まっていれば「ステージへ上がる」を提示
      if (allSongs) {
        setDialog([
          'ギンターレ：「── 4曲、 全部取り戻したのね。」',
          '「会場には、 あなたの旅で出会ったみんなが集まっているわ。」',
          '「本番のステージへ上がる前に、 ひとことずつ話しておかなくて大丈夫？」',
        ], null, ['会場に残る', 'ヴィリニュスへ戻る', 'ステージへ上がる'], (i) => {
          if (i === 0) {
            setDialog(['ギンターレ：「焦らなくていい。 みんなと話して、 心が決まったら 私のところへ。」']);
          } else if (i === 1) {
            setDialog(['（ヴィリニュス市街へ戻った── ）'], () => {
              state.flags._returnFromVingis = true;
              fadeCanvas(800, 1);
              setTimeout(() => { changeCity('vilnius'); fadeCanvas(800, 0); }, 900);
            });
          } else {
            startDainusvente();
          }
        });
        return;
      }
      // 通常（曲が揃っていない場合のフォールバック）
      setDialog([
        'ギンターレ：「Vingisパークへようこそ。 ここが最終ステージ。」',
        '「会場の準備はまだ続いている。 心の整理がついたら、 ステージへ進みなさい。」',
        '（…ヴィリニュス市街へいったん戻るか？）',
      ], null, ['ヴィリニュスへ戻る', 'まだ会場を見ていく'], (i) => {
        if (i !== 0) {
          setDialog(['ギンターレ：「ゆっくり眺めるといい。 ここはあなたのために用意された場所よ。」']);
          return;
        }
        setDialog(['（ヴィリニュス市街へ戻った── ）'], () => {
          state.flags._returnFromVingis = true;
          fadeCanvas(800, 1);
          setTimeout(() => { changeCity('vilnius'); fadeCanvas(800, 0); }, 900);
        });
      });
      return;
    }
    // ============================================================
    // Vingisパーク・ステージ前のキーパーソン（Phase 7-2）
    // ============================================================
    if (npc.kind === 'akihiro_vp') {
      setDialog([
        'あきちゃん：「ついにここまで来たねぇ…！ ぼくも何度もダイヌシュベンテに来たけど、今日はぜんぜん違うよ。」',
        `「${state.party[0].name}さんが、ぼくらAKクワイアの代表として、3万人の前で歌うんだ。」`,
        '「ぼくは観客席で全力で応援してる。 思いっきりやっておいで。」',
      ]);
      return;
    }
    if (npc.kind === 'miho_vp') {
      setDialog([
        `みほさん：「${state.party[0].name}さん、${state.party[1].name}さん、${state.party[2].name}さん。 ここまで本当によくがんばったね。」`,
        '「ステージの上でも、 いつも通りの3人でいいのよ。」',
        '「終わったら、 おいしいご飯を用意して待ってるからね。」',
      ]);
      return;
    }
    if (npc.kind === 'mantas_vp') {
      setDialog([
        `マンタス：「${state.party[0].name}さん！ ついにこの日が来たな。」`,
        '「あの黒パンを届けてくれた時から、 あなたならやれると思ってたよ。」',
        '「Vingisパークで歌う日本人歌手なんて、 リトアニアでも珍しいぞ。 今夜のニュースになるな！」',
      ]);
      return;
    }
    if (npc.kind === 'ieva_vp') {
      setDialog([
        `イエヴァ：「Labas! ${state.party[0].name}さん、 ステージ前にちゃんと食べた？ 空腹じゃ歌えないわよ！」`,
        '「私たち4姉妹も、 4人揃って今日は応援してる。 家族の音楽祭ね。」',
      ]);
      return;
    }
    if (npc.kind === 'elena_vp') {
      setDialog([
        `エレナ：「${state.party[0].name}さん、 Vingisパークの音響は最高なのよ。 ピアノで何度も演奏したから、 よく分かる。」`,
        '「あなたの歌、 ここで思いっきり響かせて。」',
      ]);
      return;
    }
    if (npc.kind === 'marius_vp') {
      setDialog([
        'マリウス：「…がんばれ。」',
        '「観てるよ、 ずっと。」',
      ]);
      return;
    }
    if (npc.kind === 'maria_vp') {
      setDialog([
        'マリア：「ヴィオラの音は、 人の声に一番近いって言うの。」',
        '「…だから、 あなたの歌、 私が一番ちゃんと受け止めるわ。」',
        '「大丈夫、 伝わるから。」',
      ]);
      return;
    }
    if (npc.kind === 'kotryna_vp') {
      setDialog([
        `コトリーナ：「${state.party[0].name}さん、 いよいよ本番ね。」`,
        '「マリアもエレナもイエヴァも、 4姉妹みんなで応援してるからね。」',
        '「ルツィアも今日はずっとあなたを見てるわよ。 安心して歌ってきて。」',
      ]);
      return;
    }
    if (npc.kind === 'rutsia_vp') {
      setDialog([
        `ルツィア：「${sib()}！ ルツィア、 いっしょうけんめい応援するよ！」`,
        '「リト語、 まだうまくしゃべれないけど、 ルツィアにも歌わかるよ！」',
        `「${state.party[0].name}${sib()}の歌、 だいすき！」`,
      ]);
      return;
    }
    if (npc.kind === 'victoria_vp') {
      setDialog([
        `ヴィクトリア：「${state.party[0].name}さん、 いよいよね。」`,
        '「私たちの歌姫対決の続き、 今日のステージで決着…って言いたいところだけど。」',
        '「今日は3万人みんなの心を奪ってきなさい。 私も観客席から声で応援するわ。」',
      ]);
      return;
    }
    if (npc.kind === 'yamasaki_vp') {
      setDialog([
        `ユウコヤマサキ：「${state.party[0].name}さん、 ついにここまで…。」`,
        '「カンクレスを取り戻したあなたを、 ずっと心から応援してきました。」',
        '「日本とリトアニア、 二つの国の歌が今夜、 ここで響くんですね。」',
      ]);
      return;
    }
    if (npc.kind === 'akihiro') {
      // ヴィリニュス再訪以降は「いよいよ迫るダイヌシュベンテ」モード
      if (state.flags.vilnius_revisit) {
        setDialog([
          'あきちゃん：「おかえり！ ずいぶん歌い手の顔つきになったじゃない。」',
          `「${state.party[0].name}さん、もう本番までほんとに目と鼻の先だよ。」`,
          '「Vingisパークの大ステージ、ぼくも何度もリハーサルで足を運んでる。」',
          '「3万人のお客さんの前で歌うんだ。 ふつう、めちゃくちゃ怖いよ？」',
          '「でもさ、ここまで4曲ぶんのピースを取り戻してきた君なら、もう大丈夫。」',
          `「${state.party[1].name}と${state.party[2].name}と一緒に、 君の歌を、君のまま届けてきな。」`,
          '「Vingisパークまでの道は、ギンターレが開けてくれるはず。 ぼくは会場で待ってるよ。」',
          '「ギンターレ？ ヴィリニュス大聖堂の前あたりで見かけたような。」',
          '「準備ができたら探しに行ってごらん。」',
        ]);
        return;
      }
      setDialog([
        'あきちゃん：「Labas! やっと着いたね〜！」',
        `「${state.party[0].name}さん、ダイヌシュベンテはもうすぐだよ。」`,
        'あきちゃん：「えっ、歌詞をぜんぶ忘れちゃったのー！？」',
        '「まあ、本番までまだ少し時間がある。」',
        '「街を歩きまわって、がんばって思い出すんだ！」',
        `「${state.party[1].name}と${state.party[2].name}も連れて行きなね。頼りになるから。」`,
        '「あ、そうだ。 旅の途中で歌の力を試される場面があったら── ぼくらの合言葉、 エホーマイ を思い出してね。」',
        '「練習のはじまりに、 いつもみんなで手をつないで歌ってる、 あの祈りの歌だよ。」',
        '「3人とも元気なときに唱えると、 そのあと3ターン、 歌の威力が2倍になるんだ。 ここぞって場面でね。」',
        '「それと── もし誰かが感動の波にのまれて泣き崩れちゃったら、 励ます コマンドで現実に引き戻してあげて。」',
        '「合唱はひとりじゃ成り立たない。 仲間を立て直すのも、 立派な役目だからね。」',
        '「街の人にはリト語のあいさつから話しかけよう：',
        '・Labas（ラバス）= こんにちは',
        '・Ačiū（アチュー）= ありがとう',
        '・Kaip sekasi（カイプ・セカシ）= 元気？',
        '「マンタスはシティホールのレストランで料理長をやってるよ。会いに行ってみな。」',
        '「奥さんのイエヴァは…さっき街の北東のほうへ散歩に行ったって言ってたな。」',
      ]);
      return;
    }
    if (npc.kind === 'miho') {
      if (state.cityKey === 'kaunas') {
        setDialog([
          'みほさん：「あら、お疲れさま♪」',
          '「ふふ…『なんでみほさんがカウナスにも！？』って顔してるね？」',
          '「実はね、私こう見えて 各地のamiにワープできちゃう の。」',
          '「あきちゃんから『みんなを支えてあげて』って頼まれてるからね。」',
          '「ここは amiカウナス。HPもMPも全回復するわよ。」',
          '「冒険の記録もここで自動セーブだから、安心して寄ってちょうだい♪」',
        ]);
      } else if (state.cityKey === 'klaipeda') {
        setDialog([
          'みほさん：「ようこそクライペダへ♪」',
          '「ここは amiクライペダ。窓を開けるとバルト海の潮の香りがするのよ。」',
          '「マリアもコトリーナも、私の昔からの友達なの。」',
          '「困ったら遠慮なく頼ってね。HP/MP全回復＆セーブはいつもどおり♪」',
          '「桟橋の先の小舟── 誰も乗ってないのに、 ときどき不思議な歌声がするって噂よ。 ちょっと気になるわよね？」',
        ]);
      } else if (state.cityKey === 'trakai') {
        setDialog([
          'みほさん：「あら、トラカイにも来てくれたのね♪」',
          '「ここは amiトラカイ。窓を開けるとガルヴェ湖と城が見えるの。」',
          '「湖のほとりは空気が澄んでて、歌の練習にちょうどいいのよ。」',
          '「橋のほうに、湖を渡る橋を見てた精霊みたいな人がいる気がする…って噂よ？」',
          '「HP/MP全回復＆セーブはいつもどおり♪ ゆっくりしていってね。」',
        ]);
      } else if (state.cityKey === 'siauliai') {
        setDialog([
          'みほさん：「ふふ、シャウレイにもちゃんと来てくれたのね♪」',
          '「ここは amiシャウレイ。 北の風がちょっぴり冷たいでしょ？」',
          '「窓の向こうに見える丘── あれが噂の十字架の丘よ。」',
          '「広場には街じゅう自慢の歌姫がいるって聞いたわ。 会いに行ってみたら？」',
          '「HP/MP全回復＆セーブはいつもどおり♪ ゆっくり休んでいってね。」',
        ]);
      } else if (state.cityKey === 'vilnius' && state.flags.vilnius_revisit) {
        setDialog([
          'みほさん：「おかえりなさい♪ ヴィリニュスもいよいよ本番ムードね。」',
          `「${state.party[0].name}さん、ずいぶん歌い手の顔つきになったわね。」`,
          '「ダイヌシュベンテ、私もVingisパークで歌うの。 一緒のステージよ。」',
          '「3万人の声が重なる瞬間って、ほんとうに鳥肌もので…」',
          '「みんなと一緒に歌えるの、ほんっとに楽しみにしてるんだから♪」',
          '「本番までは いつもどおり amiホテル で支えるわ。 HP/MP全回復＆セーブもね。」',
        ]);
      } else {
        setDialog([
          'みほさん：「あら、いらっしゃい！」',
          '「ここは私の宿屋、amiホテルよ。」',
          '「HPもMPも全回復するから、いつでも寄ってね。」',
          '「冒険の記録もここで自動セーブしておくから安心してね。」',
          '「（宿屋の入口（赤屋根のベッド看板）でAボタンで休める）」',
          '「あ、それと…私、ちょっとした特技があってね。」',
          '「他の街のamiにもひょいっと現れるから、見かけても驚かないでね♪」',
        ]);
      }
      return;
    }
    if (npc.kind === 'mantas') {
      const f = state.flags;
      // ヴィリニュス再訪 → おつかいクエストC（食いしん坊マンタスがシャウレイの黒パンを所望）
      if (f.vilnius_revisit) {
        if (f.fq_rye_done) {
          setDialog([
            'マンタス：「いやぁ、あの黒パンうまかったよ。 ありがとうな。」',
            '「君がダイヌシュベンテで歌うの、楽しみにしてるよ。」',
          ]);
          return;
        }
        if (f.fq_rye_carry) {
          f.fq_rye_carry = false;
          f.fq_rye_done = true;
          const a = awardPiece('kur', 'マンタス');
          setDialog([
            'マンタス：「お、ほんとに買ってきてくれたのか！　助かるよ。」',
            '（マンタスはパンを軽く香って、満足そうに笑った）',
            '「うん、 焼きたて寄りだな。 やっぱり違うんだよ、これが。」',
            '「ありがとな。 約束の譜面、 渡しとくよ。」',
            '「妻のイエヴァが、ある時ふと書き留めた古い歌のフレーズなんだ。」',
            '「Kur giria… 君が探してた歌だろ？」',
          ].concat(pieceLines(a)), () => saveGame());
          return;
        }
        if (f.fq_rye_req) {
          setDialog([
            'マンタス：「黒パン、ついでで構わないからな〜。」',
            '「シャウレイの市場、 早朝だと焼きたてが並ぶらしいぞ。」',
          ]);
          return;
        }
        // 依頼開始
        f.fq_rye_req = true;
        saveGame();
        setDialog([
          'マンタス：「お、戻ってきたな！　シャウレイにも行ってきたのか。」',
          '「ところで、シャウレイの市場って まだやってた？」',
          '「あそこの黒パン、 焼きたての日は格別なんだよ。」',
          '「ヴィリニュスでも食えなくはないんだが、 やっぱり現地のが一番でな。」',
          '「次の仕入れに行く時間がなくてさ── ついでに1本、頼めないか？」',
          '「礼に、 妻イエヴァが書き留めた古い歌のフレーズを譲るよ。 君の探し物だと思う。」',
          '【おつかい：シャウレイの黒パンを持ち帰る】',
        ]);
        return;
      }
      // 初訪問時の通常分岐
      const greet = ['Labas! いらっしゃい！', 'Sveiki! 今日のキビナイは絶品だよ。'];
      setDialog(
        [`マンタス：「${greet[Math.floor(Math.random() * greet.length)]}」`,
         'シティホールのレストランで料理長を務める紳士。',
         '色白でほっそり、眼鏡の似合う、よく食べてよく話す男。',
         'マンタス：「ヴィリニュスは初めて？じゃあリト語のあいさつ、覚えていこう。」',
         'マンタスが何かをくれそうだ。お礼にあたる言葉は？'],
        null,
        ['Labas!', 'Ačiū!', 'Kaip sekasi?'],
        (i) => {
          if (i === 1) {
            if (!state.flags.mantas) {
              state.flags.mantas = true;
              state.gold += 30;
              setDialog([
                'マンタス：「Ačiū! 良い発音だ。」',
                '「これは餞別だ。旅の足しに。」',
                '【€30 を受け取った！】',
                '「ピースの噂か？塔の番人のところに1つあると聞いたぞ。気をつけてな。」',
                '「そうそう、妻のイエヴァが街の北東のほうにいたよ。」',
                '「散歩しがてら歌のことを考えたいんだとさ。会いに行ってやってくれ。」',
              ], () => saveGame());
            } else {
              setDialog(['マンタス：「Ačiū! 今日も良い日だな。」']);
            }
          } else {
            setDialog(['マンタス：「???」', '（うまく通じなかったようだ…）']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'ieva') {
      // ヴィリニュス再訪以降はダイヌシュベンテに向けた台詞
      if (state.flags.vilnius_revisit) {
        setDialog([
          'イエヴァ：「あら、また会えましたね。」',
          '「ピース、ずいぶん集まったみたいですね。 顔つきでわかります。」',
          '「ダイヌシュベンテ、私もVingisパークで歌います。 同じステージですね。」',
          '「あの場の3万人の声って、ほんとうに不思議で…」',
          '「最初はこちらが歌うんですけど、 途中から客席のほうから歌がのぼってくるんです。」',
          '「気負わなくて大丈夫。 そのときが来たら、自然と声が出ますから。」',
          '「マンタスから黒パンの話、聞きました。 ふふ、 あの人らしい。」',
        ]);
        return;
      }
      setDialog(
        ['イエヴァ：「Labas vakaras… 旅の方ですか？」',
         'マンタスの妻。透き通った声の歌手で、手には楽譜を持っている。',
         '4姉妹の4女、陽気だけど必要以上には話さない。',
         '「あなたの歌、聴いてみたいです。」',
         '「── ところで、リト語で『元気？』と尋ねるときは何て言うか、ご存じ？」'],
        null,
        ['Labas!', 'Ačiū!', 'Kaip sekasi?'],
        (i) => {
          if (i === 2) {
            if (!state.flags.ieva) {
              state.flags.ieva = true;
              setDialog([
                'イエヴァ：「Puikiai! 私も歌うのが大好きで…」',
                '「歌は気持ちを伝えるただひとつの言葉、だと思うんです。」',
                '「ピースの噂、わたしも気にしておきます。また会いましょう。」',
              ]);
            } else {
              setDialog(['イエヴァ：「また会えてうれしい。」']);
            }
          } else {
            setDialog(['イエヴァ：「???」', '（うまく通じなかったようだ…）']);
          }
        }
      );
      return;
    }
    if (npc.kind === 'guardian') {
      if (state.flags.guardian) {
        setDialog('（塔の番人は感動の涙を流して去っていった…）');
        return;
      }
      setDialog(
        ['塔の番人：「おや、旅の歌い手たちか。」',
         '「この塔の上で、長らくこの街と歌を見守ってきた者だ。」',
         '「歌詞のピースが欲しい── そう聞こえたな。」',
         '「悪いが、これは大切な預かりもの。 ただで渡すわけにはいかぬ。」',
         '「── どうだろう、ひとつ歌で勝負しないか？」',
         '「我の心を震わせてくれたら、迷わず譲ろう。」',
         '塔の番人：「── どうする、勝負するか？」'],
        null,
        ['勝負する', 'やめておく'],
        (i) => {
          if (i === 0) {
            startBattle({
              type: 'guardian', name: '塔の番人',
              hp: 110, maxHp: 110, atk: 7, xp: 40, gold: 70, boss: true,
            });
          } else {
            setDialog([
              '塔の番人：「うむ、無理は良くない。 力を蓄えてからまた来るがよい。」',
              '「街の者と歌を交わし、心を磨いてくることだ。」',
            ]);
          }
        }
      );
      return;
    }

    // 一般NPC（あいさつ学習）
    // npc.quiz が定義されていれば、それを使った3択クイズ（場面ごとのリト語バリエーション用）
    if (npc.quiz) { ltQuizOpen(npc); return; }
    const hintMap = {
      labas: { q: npc.name + 'があなたに微笑みかけている。なんとあいさつする？', correct: 0 },
      aciu:  { q: npc.name + 'が何かをくれそうだ。お礼にあたる言葉は？',         correct: 1 },
      kaip:  { q: npc.name + 'の調子をたずねたい。なんと声をかける？',           correct: 2 },
    };
    const greetWord = (k) =>
      k === 'labas' ? 'Labas! 旅の人かい？'
      : k === 'aciu' ? 'Sveiki! 焼きたてのキビナイがあるよ。'
      : k === 'kaip' ? 'Labas vakaras… ふぅ、疲れたねぇ。'
      : '';
    const h = hintMap[npc.hint];
    setDialog(
      [npc.name + '：「' + greetWord(npc.hint) + '」', h.q],
      null,
      ['Labas!', 'Ačiū!', 'Kaip sekasi?'],
      (i) => {
        if (i === h.correct) afterCorrect(npc);
        else setDialog([npc.name + '：「???」', '（うまく通じなかったようだ…）']);
      }
    );
  }

  // ============================================================
  // 場面ごとリト語クイズ（npc.quiz）
  //   quiz: { intro:[...], teach:[...], question:'...', choices:['…','…','…'], correct:0|1|2,
  //           wrongMsg?:'…', learnedFlag?:'lt_taip' }
  //   - intro: 名前付き挨拶（自動で 'NPC：「...」' に整形しない＝必要なら呼び出し側で含めること）
  //   - teach: 新出リト語の意味解説（学習用）
  //   - question: 3択クイズの設問
  //   - 正解 → afterCorrect(npc)（既存のピース付与/ヒント表示ロジックを再利用）
  //   - learnedFlag があれば、2回目以降は teach をスキップ
  // ============================================================
  function ltQuizOpen(npc) {
    const q = npc.quiz;
    const learned = q.learnedFlag && state.flags && state.flags[q.learnedFlag];
    const lines = [];
    if (q.intro) q.intro.forEach(s => lines.push(s));
    if (q.teach && !learned) q.teach.forEach(s => lines.push(s));
    if (q.question) lines.push(q.question);
    setDialog(
      lines,
      null,
      q.choices.slice(),
      (i) => {
        if (i === q.correct) {
          if (q.learnedFlag) { state.flags[q.learnedFlag] = true; saveGame(); }
          // ピース付与なし・独自台詞のNPC向け: correctLines があればそれを表示するだけ
          if (q.correctLines) {
            setDialog(q.correctLines.slice(), () => saveGame());
            return;
          }
          afterCorrect(npc);
        } else {
          setDialog([npc.name + '：「' + (q.wrongMsg || '???') + '」', '（うまく通じなかったようだ…）']);
        }
      }
    );
  }

  function afterCorrect(npc) {
    if (npc.kind === 'shop' && !state.flags.shop) {
      state.flags.shop = true;
      const a = awardPiece('soran', npc.name);
      setDialog([
        npc.name + '：「Ačiū! きれいなリト語だね。」',
        '「これはおまけだよ」と歌詞のピースをくれた！',
      ].concat(pieceLines(a)), () => saveGame());
      return;
    }
    if (npc.kind === 'child' && !state.flags.child) {
      state.flags.child = true;
      const a = awardPiece('soran', npc.name);
      setDialog([
        npc.name + '：「わぁ、リト語じょうず！」',
        '子どもは大切にしていた紙切れを差し出した。',
      ].concat(pieceLines(a)), () => saveGame());
      return;
    }
    if (npc.kind === 'bard' && !state.flags.bard) {
      state.flags.bard = true;
      const a = awardPiece('soran', npc.name);
      setDialog([
        npc.name + '：「お、リト語が話せるのか。気に入った。」',
        '「俺の弟子に渡そうと思ってた歌詞だ、譲ろう。」',
      ].concat(pieceLines(a)), () => saveGame());
      return;
    }
    const hints = {
      priest:  '「大聖堂は静かに祈る場所。心を静めるのに良い。」',
      elder:   '「ゲディミナス塔の番人は感動が深い者にしか心を開かない。」',
    };
    const hint = hints[npc.kind] || '「Lietuva にようこそ。」';
    setDialog([npc.name + '：「Ačiū! きれいなリト語だね。」', npc.name + '：' + hint]);
  }

  // ============================================================
  // 観光名所＋特殊タイル
  // ============================================================
  function checkLandmark(t, fx, fy) {
    if (t === T.GEDIMINAS) {
      setDialog(['【ゲディミナス塔】',
        'ヴィリニュスの旧市街を見下ろす赤レンガの塔。',
        'リトアニア大公国の象徴であり、塔の上には三色旗が翻る。',
        '（塔の前に番人が立ちはだかっている…）']);
      return true;
    }
    if (t === T.GATES) {
      setDialog(['【夜明けの門】',
        '街の南の入り口にあたる古い城門。',
        '門の上の小さな礼拝堂には黒いマドンナの聖画像が祀られている。',
        '（不思議と心が落ち着いた。HP/MPが少し回復）'],
        () => { state.party.forEach(p => { p.hp = Math.min(p.maxHp, p.hp + 10); p.mp = Math.min(p.maxMp, p.mp + 5); }); });
      return true;
    }
    if (t === T.ANNE) {
      setDialog(['【聖アンナ教会】',
        '赤レンガで建てられた後期ゴシック様式の教会。',
        'ナポレオンが「手のひらに乗せてパリに持ち帰りたい」と言ったという伝説。']);
      return true;
    }
    if (t === T.CIURLIONIS) {
      // 美術館: 絵画調査でダイナミック琉球の4ピース目とチョルリョーニス精霊B演出
      if (!state.flags.kaunas_museum) {
        setDialog(
          ['【チョルリョーニス美術館】',
           'リトアニアが誇る音楽家・画家 M.K.チョルリョーニスの作品館。',
           '《ソナタ・海》《ソナタ・星》── 絵から音が立ちのぼってくるよう。',
           '（一枚の絵の前で、足が止まった…）'],
          null,
          ['絵画を調べる', '見るだけにする'],
          (i) => {
            if (i === 0) {
              state.flags.kaunas_museum = true;
              const a = awardPiece('dynamic', 'チョルリョーニス美術館');
              setDialog([
                '絵の中の波の渦に吸い込まれそうになる…',
                '── ふいに、館内の空気がやわらかく揺れた。',
                'チョルリョーニス：「……よく来た、歌い手よ。」',
                '「絵と音は、根を同じくする。海の音が、君に渡したいものがある。」',
                '絵の前に、見覚えのある譜面が一枚そっと置かれている。',
              ].concat(pieceLines(a)), () => saveGame());
            } else {
              setDialog(['（また落ち着いて来よう。）']);
            }
          }
        );
      } else {
        setDialog(['【チョルリョーニス美術館】',
          '《ソナタ・海》《ソナタ・星》── 何度見ても飽きない。',
          '（あの絵の前に立つと、不思議と心が澄んでいく…）']);
      }
      return true;
    }
    if (t === T.CATHEDRAL) {
      setDialog(['【ヴィリニュス大聖堂】',
        '街の中心、白い列柱の堂々たる聖堂。',
        '隣接する鐘楼は街のシンボルでもある。']);
      return true;
    }
    if (t === T.INN) {
      // みほさん宿屋（各地のami）— 入室時はBGM切替なし
      const innName =
        state.cityKey === 'kaunas'   ? 'amiカウナス'   :
        state.cityKey === 'klaipeda' ? 'amiクライペダ' :
        state.cityKey === 'trakai'   ? 'amiトラカイ'   :
                                       'amiヴィリニュス';
      // 宿泊料：全都市一律 €40
      const innFee = 40;
      const innGreet =
        state.cityKey === 'kaunas'   ? `みほさん：「ふふっ、また会ったね♪ 一晩 €${innFee} でいいよ。」` :
        state.cityKey === 'klaipeda' ? `みほさん：「あら、クライペダまで来たのね♪ 一晩 €${innFee} でいいよ。」` :
        state.cityKey === 'trakai'   ? `みほさん：「湖のそばは気持ちいいでしょ♪ 一晩 €${innFee} でいいよ。」` :
                                       `みほさん：「いらっしゃい！ 一晩 €${innFee} でいいよ♪」`;
      setDialog(['【' + innName + '（みほさんの宿屋）】',
        innGreet,
        '「ぐっすり休んで、目が覚めたら全回復よ。」'],
        null,
        [`泊まる（€${innFee}）`, '泊まらない'],
        (i) => {
          if (i === 0) {
            if (state.gold < innFee) {
              setDialog([
                `みほさん：「あらら、€${innFee} には足りないみたい…。」`,
                '「お金が貯まったら、また来てね♪」',
              ]);
              return;
            }
            state.gold -= innFee;
            state.party.forEach(p => { p.hp = p.maxHp; p.mp = p.maxMp; p.alive = true; });
            saveGame();
            // 3秒かけて暗転、その途中で宿屋BGMをフェードイン
            audio.stopBGM();
            setDialog([`（€${innFee} を支払って…眠りに落ちる…）`]);
            fadeCanvas(3000, 1);
            setTimeout(() => audio.playBGM('inn'), 800);
            setTimeout(() => {
              setDialog([
                'Zzz... ぐっすり眠った。',
                '☀ 朝が来た。HP/MP全回復＆セーブ完了！',
                'みほさん：「いってらっしゃい♪」',
              ], () => {
                // 暗転を1.5秒かけて解除し、フィールドBGMに復帰
                fadeCanvas(1500, 0);
                setTimeout(() => audio.playBGM('field'), 1200);
              });
            }, 3000);
          } else {
            setDialog(['みほさん：「またのお越しを♪」']);
          }
        }
      );
      return true;
    }
    if (t === T.AKHALL) {
      setDialog(['【AKクワイア集会所】',
        'みんなで歌の練習をしている。',
        '「ダイヌシュベンテの本番、楽しみだね！」']);
      return true;
    }
    if (t === T.STATION) {
      if (state.cityKey === 'kaunas')        openStationKaunas();
      else if (state.cityKey === 'klaipeda') openStationKlaipeda();
      else if (state.cityKey === 'trakai')   openStationTrakai();
      else                                   openStationVilnius();
      return true;
    }
    if (t === T.BOAT) {
      openBoat();
      return true;
    }
    if (t === T.SCULPTURE) {
      const lines = [
        '【木彫りの彫刻】',
        'クルシュー砂州の伝説に登場する魔女や精霊たち。',
        '木に刻まれた表情が、風と一緒にこちらを見ているようだ。',
      ];
      if (state.cityKey === 'witches' && !state.flags.witches_lore) {
        state.flags.witches_lore = true;
        lines.push('（ぞわっと背筋が冷えた。──しかしどこか懐かしい。）');
      }
      setDialog(lines);
      return true;
    }
    return false;
  }

  // 桟橋の小舟（クライペダ⇔魔女の丘）
  function openBoat() {
    if (state.cityKey === 'klaipeda') {
      const manoCount = (state.piecesBySong && state.piecesBySong.mano) || 0;
      // 条件: クライペダで Mano kraštas を 3 つ集めた、かつチョルリョーニスの導きが立った
      if (state.flags.witches_done) {
        // 既に魔女の丘から戻った後でも、再訪可
        setDialog(
          ['（小舟が静かに揺れている。）',
           '「もう一度、あの砂州へ渡るかい？」'],
          null,
          ['渡る', 'やめる'],
          (i) => {
            if (i === 0) {
              setDialog(['船頭：「Aī. ……出すぞ。」'], () => {
                state.scene = 'boat';
                fadeCanvas(2000, 1);
                setTimeout(() => { changeCity('witches'); state.scene = 'field'; }, 2200);
                setTimeout(() => fadeCanvas(1500, 0), 2400);
              });
            } else {
              setDialog(['（やめておいた。）']);
            }
          }
        );
        return;
      }
      if (manoCount < 3) {
        setDialog([
          '（小舟がぽつんと桟橋の先につながれている。）',
          '（船頭はいない。今は出航できそうもない…。）',
        ]);
        return;
      }
      // 初回：チョルリョーニス精霊が現れて、砂州へ導く
      setDialog([
        '小舟を覗き込んでいると、ふわりと風が変わった。',
        'チョルリョーニス：「……Mano kraštas、ここまで来たね。」',
        '海の向こうに白く霞む砂州が見えた。クルシュー砂州、Juodkrantė。',
        '「あの森に、君が受け取るべきものがある。──さあ、行こう。」',
        '（船頭が音もなく艫に立ち、櫂を取った。）',
      ], () => {
        state.flags.witches_intro = true;
        state.scene = 'boat';
        fadeCanvas(2200, 1);
        setTimeout(() => { changeCity('witches'); state.scene = 'field'; }, 2400);
        setTimeout(() => fadeCanvas(1800, 0), 2800);
      });
      return;
    }
    if (state.cityKey === 'witches') {
      setDialog(
        ['（小舟が砂浜に引き上げられている。）',
         '「クライペダへ戻るかい？」'],
        null,
        ['戻る', 'やめる'],
        (i) => {
          if (i === 0) {
            setDialog(['船頭：「Aī. ……出すぞ。」'], () => {
              state.flags = state.flags || {};
              state.flags._returnFromWitches = true;
              state.scene = 'boat';
              fadeCanvas(2000, 1);
              setTimeout(() => { changeCity('klaipeda'); state.scene = 'field'; }, 2200);
              setTimeout(() => fadeCanvas(1500, 0), 2400);
            });
          } else {
            setDialog(['（もう少し、この島を歩いてみよう。）']);
          }
        }
      );
      return;
    }
  }

  // ============================================================
  // 歌詞ピース（曲別）
  // ============================================================
  const SONG_DATA = {
    soran:   { name: 'ソーラン節',         max: 5 },
    dynamic: { name: 'ダイナミック琉球',   max: 5 },
    mano:    { name: 'Mano kraštas',       max: 5 },
    kur:     { name: 'Kur giria',          max: 5 },
  };
  const SONG_KEYS = ['soran', 'dynamic', 'mano', 'kur'];
  const SONG_LYRICS = {
    soran: [
      '🎵「どっこいしょー　どっこいしょー／そーらん　そーらん／やーれんそーらん　そらんそーらんそーらん」🎵',
      '🎵「ニシン来たかとカモメにとえばー／わたしゃたつとりーなみーにーきけ ちょい」🎵',
      '🎵「やさえー えんやー　さーあのどっこいしょ」🎵',
      '🎵「おとこどきょうだ　ごしゃくのからだー／どんとのりだせーなみーのうえ ちょい」🎵',
      '🎵「せかいへいわののぼりをかかげ／こえをかさねてーひとつにーなれ ちょい」🎵',
    ],
    dynamic: [
      '🎵「うみよー　いのりのうみよー／なみのこえ ひーびくそーらーよー」🎵',
      '🎵「だいちー踏み鳴らしたたくー／しーまーのー　てーぐぬー　ひびきー」🎵',
      '🎵「ばいぬかじふく　うりずんぬぐとぅに／むにぬうむいゆ　かたてぃはなさにゃ」🎵',
      '🎵「そらよー　もえるてぃだのー／いのちーの　いーぶーきーにゆめー」🎵',
      '🎵「おおしくひろげたつばさー／てんたーかーくー　宙をまーうー」🎵',
    ],
    mano: [
      '🎵「Šita žeme man likimas dovanojo／Pilka dangų sniego sodus ir pilis」🎵',
      '🎵「Man jos grožio kiek yra tiek ir pakanka／Jos kalba mane užbūrė amžinai」🎵',
      '🎵「Vien tik ji yra prasme tikroji／nepakeis jos niekas niekada」🎵',
      '🎵「いとしきだいちと ともに いのちは いかされる／母なる ガイアに生まれ あなたのなかに 還っていく」🎵',
      '🎵「わたしがこのほしに かえるときは／はるに咲く はなになろう」🎵',
    ],
    kur: [
      '🎵「クール ギリャ ジャルワイャ ターン マノ ナマーイ／クール ナムーンス バングァイャ テーヴィネーs クラーs ターィ」🎵',
      '🎵「テーヴィネ タン マノ シャラレ sケイs ティー／トゥラーs ニャイs マノ コ デル ティp gラ ジー」🎵',
      '🎵「ジャルー マーs ギリュー ジュー パー ピールドゥ ニャウス ムース チュール／ビーイームs パゥクs トゥ ジュー イール ディジャイ メイ ルース」🎵',
      '🎵「クラン ターイ ナーム ネリォ リーグ リュ トゥ ダル ジャーイ」🎵',
      '🎵「タン ダーイ ノース ベル ナ リォ sカン バ テイp gラー ジェーイ」🎵',
    ],
  };

  // ピース授与（曲＆配布元から）
  function awardPiece(song, fromName) {
    if (!state.piecesBySong) state.piecesBySong = { soran: 0, dynamic: 0, mano: 0, kur: 0 };
    if (!state.piecesLog) state.piecesLog = [];
    state.piecesBySong[song] = (state.piecesBySong[song] || 0) + 1;
    state.pieces = SONG_KEYS.reduce((sum, k) => sum + (state.piecesBySong[k] || 0), 0);
    const idx = state.piecesBySong[song] - 1;
    const lyric = (SONG_LYRICS[song] && SONG_LYRICS[song][idx]) || '';
    state.piecesLog.push({ song, lyric, from: fromName });
    audio.playSE('piece');
    const justCompleted = (idx + 1 === SONG_DATA[song].max);
    // 「思い出した」ファンファーレは pieceLines のセンチネルから showDialog で発火する
    if (typeof rebuildSongs === 'function') rebuildSongs();
    // ピース取得で出現条件が変わるNPC（例: Kur giria 5/5 → ギンターレ）が
    // 同じ街で即座に出るように、現在街のNPCリストを再構築する
    if (state.cityKey && typeof rebuildNPCs === 'function') rebuildNPCs(state.cityKey);
    return {
      song,
      songName: SONG_DATA[song].name,
      curr: idx + 1,
      max: SONG_DATA[song].max,
      lyric,
      justCompleted,
    };
  }

  // 「思い出した」ライン用の音楽トリガセンチネル（showDialog で検出して発火）
  const SONG_TRIGGER_SENTINEL = '\x02SONG:';
  function pieceLines(a) {
    const lines = [
      '【' + a.songName + ' ピース ' + a.curr + '/' + a.max + ' 入手】',
      a.lyric,
    ];
    if (a.justCompleted) {
      lines.push('');
      // 行の先頭にセンチネルを埋め込み、showDialog でこの行に到達した瞬間に音楽を流す
      lines.push(SONG_TRIGGER_SENTINEL + a.song + '\x02★★★ ' + a.songName + ' を思い出した！ ★★★');
      lines.push('（戦闘で「' + a.songName + '」を歌えるようになった！）');
    }
    return lines;
  }

  // 「歌詞の記憶」メニュー
  function showMemory() {
    const lines = ['【歌詞の記憶】'];
    SONG_KEYS.forEach(k => {
      const c = state.piecesBySong[k] || 0;
      const m = SONG_DATA[k].max;
      const bar = '★'.repeat(c) + '・'.repeat(m - c);
      lines.push(SONG_DATA[k].name + '：' + bar + ' ' + c + '/' + m);
    });
    lines.push('合計：♪' + (state.pieces || 0) + '/20');
    if (state.piecesLog && state.piecesLog.length > 0) {
      lines.push('── 思い出した歌詞 ──');
      // 曲ごとにまとめる
      SONG_KEYS.forEach(k => {
        const entries = state.piecesLog.filter(e => e.song === k);
        if (entries.length === 0) return;
        lines.push('▼' + SONG_DATA[k].name);
        entries.forEach(e => lines.push('　' + e.lyric));
      });
    } else {
      lines.push('（まだ何も思い出せていない…）');
    }
    setDialog(lines);
  }

  // ============================================================
  // リトアニア全体マップ画面
  // ============================================================
  function showOverworldMap() {
    state.scene = 'overworld';
    render();
  }
  function renderOverworld() {
    // 背景：海と空のグラデ
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, '#1a3a6a');
    g.addColorStop(1, '#0a1a3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // タイトル
    ctx.fillStyle = '#dac030';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('リトアニア', CANVAS_W / 2, 28);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#c0d0e0';
    ctx.fillText('Lietuva', CANVAS_W / 2, 44);

    // マップエリア（タイトル下〜下端の少し上まで）
    const PAD_X = 40, TOP = 60, BOT = CANVAS_H - 60;
    const W = CANVAS_W - PAD_X * 2;
    const H = BOT - TOP;
    // 海（マップ全体の背景）
    ctx.fillStyle = '#3a6aae';
    ctx.fillRect(PAD_X, TOP, W, H);

    // リトアニア国土の簡略シルエット（実形寄り、時計回り）
    const px = (rx) => PAD_X + W * rx;
    const py = (ry) => TOP + H * ry;
    const outline = [
      // 北辺（ラトヴィアとの境）
      [0.07, 0.20], [0.20, 0.13], [0.38, 0.09], [0.56, 0.10], [0.74, 0.13], [0.88, 0.18],
      // 北東〜東辺（ラトヴィア／ベラルーシ）
      [0.93, 0.28], [0.96, 0.42], [0.93, 0.55],
      // 南東（ヴィリニュス側の張り出し）
      [0.90, 0.68], [0.85, 0.78], [0.78, 0.86],
      // 南辺（ベラルーシ／ポーランド）
      [0.62, 0.92], [0.42, 0.93], [0.28, 0.88],
      // 南西（カリーニングラード／ポーランド）
      [0.18, 0.82], [0.13, 0.74], [0.16, 0.68],
      // 西海岸（バルト海・クルシュー潟）
      [0.10, 0.58], [0.05, 0.45], [0.03, 0.32], [0.05, 0.24],
    ];
    ctx.fillStyle = '#4a8a4a';
    ctx.beginPath();
    outline.forEach(([rx, ry], i) => {
      const x = px(rx), y = py(ry);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // クルシュー砂州（西海岸沖の細長い砂州）
    ctx.fillStyle = '#dac09a';
    ctx.beginPath();
    ctx.moveTo(px(0.02), py(0.34));
    ctx.lineTo(px(0.04), py(0.34));
    ctx.lineTo(px(0.05), py(0.50));
    ctx.lineTo(px(0.04), py(0.62));
    ctx.lineTo(px(0.02), py(0.62));
    ctx.lineTo(px(0.01), py(0.50));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 川（ネムナス川 — 国の中央を東西に流れる）
    ctx.strokeStyle = '#3a8acc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px(0.07), py(0.55));      // 西海岸から
    ctx.bezierCurveTo(px(0.30), py(0.62), px(0.45), py(0.66), px(0.55), py(0.65)); // カウナスへ
    ctx.bezierCurveTo(px(0.65), py(0.62), px(0.78), py(0.58), px(0.88), py(0.50)); // 東へ
    ctx.stroke();
    // ネリス川（ヴィリニュス→カウナス）
    ctx.strokeStyle = '#5aa0d8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px(0.74), py(0.69));
    ctx.bezierCurveTo(px(0.62), py(0.66), px(0.55), py(0.65), px(0.50), py(0.62));
    ctx.stroke();

    // 周辺国ラベル
    ctx.fillStyle = '#7090a0';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ラトヴィア', px(0.50), py(0.04));
    ctx.fillText('ベラルーシ', px(0.97), py(0.72));
    ctx.fillText('ポーランド', px(0.45), py(0.99));
    ctx.fillText('ロシア', px(0.13), py(0.92));
    // バルト海
    ctx.fillStyle = '#88aacc';
    ctx.font = 'italic 10px sans-serif';
    ctx.fillText('バルト海', PAD_X + 18, TOP + H * 0.18);

    // 都市マーカー（Vingisパークは現実でもヴィリニュス市内の公園のため、全体マップでは独立表示しない）
    Object.entries(CITIES).forEach(([key, c]) => {
      if (key === 'vingis') return;
      const x = px(c.realX);
      const y = py(c.realY);
      const visited = !!(state.visitedCities && state.visitedCities[key]);
      const here = (state.cityKey === key);
      // ピン
      ctx.fillStyle = visited ? c.color : '#666';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 現在地は二重丸＋拍動
      if (here) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 都市名（labelBelow が true の都市は近接ピンとの重なり回避のため下に表示）
      ctx.fillStyle = visited ? '#fff' : '#aaa';
      ctx.font = (here ? 'bold ' : '') + '12px sans-serif';
      ctx.textAlign = 'center';
      const labelY = c.labelBelow ? y + 20 : y - 10;
      ctx.fillText(c.name, x, labelY);
    });

    // 凡例
    ctx.textAlign = 'left';
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#dac030';
    ctx.fillText('● 訪問済み', PAD_X, CANVAS_H - 36);
    ctx.fillStyle = '#666';
    ctx.fillText('● 未踏', PAD_X + 90, CANVAS_H - 36);
    ctx.fillStyle = '#fff';
    ctx.fillText('○ 現在地', PAD_X + 150, CANVAS_H - 36);
    // 操作案内
    ctx.fillStyle = '#aaa';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A / B で閉じる', CANVAS_W / 2, CANVAS_H - 14);
    ctx.textAlign = 'left';
  }

  // ============================================================
  // 戦闘システム（3人パーティ）
  // ============================================================
  // SONGS は基本3曲＋歌詞ピース完成で解禁される4曲。rebuildSongs() で再構築する。
  const BASE_SONGS = [
    { n: 'やさしい歌', mp: 2, base: 6  },
    { n: '故郷の歌',   mp: 4, base: 11 },
    { n: '魂の合唱',   mp: 8, base: 20 },
  ];
  const UNLOCK_SONGS = {
    soran:   { n: 'ソーラン節',         mp: 6,  base: 15, key: 'soran'   },
    dynamic: { n: 'ダイナミック琉球',   mp: 8,  base: 20, key: 'dynamic' },
    mano:    { n: 'Mano kraštas',       mp: 10, base: 25, key: 'mano'    },
    kur:     { n: 'Kur giria',          mp: 12, base: 30, key: 'kur'     },
  };
  const SONGS = [];
  function rebuildSongs() {
    SONGS.length = 0;
    BASE_SONGS.forEach(s => SONGS.push(s));
    const pb = state.piecesBySong || {};
    SONG_KEYS.forEach(k => {
      if ((pb[k] || 0) >= SONG_DATA[k].max) SONGS.push(UNLOCK_SONGS[k]);
    });
  }
  rebuildSongs();

  // ============================================================
  // エンカウントアニメーション
  // ============================================================
  function playEncounterAnim(onDone) {
    // フィールドを最後にレンダリングして固定
    state.scene = 'encounter';
    audio.playSE('encounter');
    renderField();
    // プレイヤーの位置に "！" 表示用座標
    const { cx, cy } = getCamera();
    let pxf = state.px, pyf = state.py;
    if (state.move) {
      const t = Math.min(1, (performance.now() - state.move.t0) / state.move.dur);
      pxf = state.px + state.move.dx * t;
      pyf = state.py + state.move.dy * t;
    }
    const heroX = (pxf - cx) * TILE + TILE / 2;
    const heroY = (pyf - cy) * TILE;

    // 固定背景（フィールドのスナップショット）を取る
    const bg = document.createElement('canvas');
    bg.width = CANVAS_W; bg.height = CANVAS_H;
    bg.getContext('2d').drawImage(cvs, 0, 0);

    const t0 = performance.now();
    const TOTAL = 950;
    function tick() {
      const now = performance.now();
      const elapsed = now - t0;
      const t = elapsed / TOTAL;
      // 背景再描画
      ctx.drawImage(bg, 0, 0);
      if (elapsed < 350) {
        // フェーズ1: "！" マークが頭上に飛び出す＋少し画面シェイク
        const pop = Math.min(1, elapsed / 200);
        const shY = (Math.random() - 0.5) * 4;
        const shX = (Math.random() - 0.5) * 4;
        ctx.save();
        ctx.translate(shX, shY);
        // フィールド再描画（背景はもうコピーされてる）
        ctx.font = 'bold ' + Math.floor(28 * pop) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#dac030';
        ctx.strokeText('！', heroX, heroY - 4 - 8 * pop);
        ctx.fillText('！',  heroX, heroY - 4 - 8 * pop);
        ctx.restore();
      } else if (elapsed < 500) {
        // フェーズ2: 画面全体が白くフラッシュ
        const f = (elapsed - 350) / 150;
        const a = f < 0.5 ? f * 2 : (1 - f) * 2;
        ctx.fillStyle = `rgba(255,240,200,${a})`;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      } else {
        // フェーズ3: ダイヤ wipe in（黒い菱形が広がって覆う）
        const f = (elapsed - 500) / (TOTAL - 500);
        const cellW = 32, cellH = 32;
        for (let yy = 0; yy < CANVAS_H; yy += cellH) {
          for (let xx = 0; xx < CANVAS_W; xx += cellW) {
            const delay = ((xx + yy) / (CANVAS_W + CANVAS_H)) * 0.5;
            const tt = Math.max(0, Math.min(1, (f - delay) * 2));
            if (tt <= 0) continue;
            const size = Math.min(cellW, cellH) * tt;
            ctx.fillStyle = '#0a0a14';
            // 菱形を描く
            ctx.beginPath();
            ctx.moveTo(xx + cellW / 2, yy + cellH / 2 - size / 2);
            ctx.lineTo(xx + cellW / 2 + size / 2, yy + cellH / 2);
            ctx.lineTo(xx + cellW / 2, yy + cellH / 2 + size / 2);
            ctx.lineTo(xx + cellW / 2 - size / 2, yy + cellH / 2);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
      if (elapsed < TOTAL) {
        requestAnimationFrame(tick);
      } else {
        // 完全に黒で覆って次へ
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        // ここで本当はSEを鳴らす（後ほど）
        if (typeof onDone === 'function') onDone();
      }
    }
    requestAnimationFrame(tick);
    // SEプレースホルダー：将来 audio.play() を入れる場所
    // playSound('encounter');
  }

  // ============================================================
  // ダイヌシュベンテ最終戦（Phase 7-3）
  //  チョルリョーニス精霊C演出 → 「3万人の観衆」群体ボス戦
  // ============================================================
  function startDainusvente() {
    // 「風が止まった」表現と合わせて、まず会場のBGMを止める
    audio.stopBGM();
    // 主人公3人をステージ中央まで自動歩行させ、横一列で観客（下）に振り返ったあとダイアログ開始
    walkPartyToStage(() => {
      setDialog([
        '── ふっと、 風が止まった。',
        '会場の灯りが、 一瞬だけ揺れる。',
        '誰の目にも映らないけれど、 ステージの脇に、 彼が立っていた。',
        'チョルリョーニス：「歌え、 魂のままに。」',
        '「── お前たちの音は、 もうリトアニアそのものだ。」',
        '「だが── 同じ歌ばかりでは、 三万の風には届かぬ。」',
        '「四つの旋律── 取り戻したすべてを響かせよ。」',
        '「そのとき、 観衆の魂は震える。」',
        '── 本番の舞台。 不思議と、 三人の喉に重さは無い。',
        '何度でも、 いくらでも歌える気がした。',
        'ふっと、 また風が動き出す。 観衆のざわめきが遠くから戻ってくる。',
        '3万人の観衆の視線が、 一斉に、 集まる──',
      ], () => {
        startBattle({
          type: 'audience_30k',
          name: '3万人の観衆',
          hp: 9999, maxHp: 9999, atk: 6, xp: 0, gold: 0, boss: true,
        });
      });
    });
  }

  // ============================================================
  // ダイヌシュベンテ最終戦・自動歩行カットシーン
  //  主人公→ステージ中央(16,6)、仲間2人→左右(15,6)/(17,6)、全員観客(下)に振り返る
  // ============================================================
  function walkPartyToStage(onDone) {
    state.scene = 'cutscene';
    const STEP_DUR = 200;
    const f1 = state.followers[0];
    const f2 = state.followers[1];
    // ギンターレはステージ前まで一緒に歩いて、そこで右に避ける役（消さない）
    const gintere = NPCS.find(n => n && n.kind === 'gintere_v');

    // スタート前に仲間2人をリーダー直下の縦列にスナップ
    f1.x = state.px; f1.y = state.py + 1; f1.dir = 'up'; f1.move = null;
    f2.x = state.px; f2.y = state.py + 2; f2.dir = 'up'; f2.move = null;
    state.pdir = 'up';

    // 専用rAFループ（startFieldLoop は scene==='field' の時しか動かないため）
    let alive = true;
    function loop() {
      if (!alive) return;
      renderField();
      requestAnimationFrame(loop);
    }
    loop();

    // ギンターレ＋3人を縦列のまま1タイル分(dx,dy)動かす
    function stepAllWithGintere(dx, dy, callback) {
      const t0 = performance.now();
      const dirName = _dirNameOf(dx, dy);
      state.move = { dx, dy, t0, dur: STEP_DUR };
      f1.move    = { dx, dy, t0, dur: STEP_DUR };
      f2.move    = { dx, dy, t0, dur: STEP_DUR };
      if (dirName) { state.pdir = dirName; f1.dir = dirName; f2.dir = dirName; }
      if (gintere) {
        gintere.walking = { dx, dy, t0, dur: STEP_DUR };
        if (dirName) gintere.dir = dirName;
      }
      setTimeout(() => {
        state.px += dx; state.py += dy; state.move = null;
        f1.x    += dx; f1.y    += dy; f1.move    = null;
        f2.x    += dx; f2.y    += dy; f2.move    = null;
        if (gintere) { gintere.x += dx; gintere.y += dy; gintere.walking = null; }
        audio.playSE('step');
        callback();
      }, STEP_DUR);
    }

    // 3人だけ動かす（ギンターレは置いて行く）
    function stepPartyOnly(dx, dy, callback) {
      const t0 = performance.now();
      const dirName = _dirNameOf(dx, dy);
      state.move = { dx, dy, t0, dur: STEP_DUR };
      f1.move    = { dx, dy, t0, dur: STEP_DUR };
      f2.move    = { dx, dy, t0, dur: STEP_DUR };
      if (dirName) { state.pdir = dirName; f1.dir = dirName; f2.dir = dirName; }
      setTimeout(() => {
        state.px += dx; state.py += dy; state.move = null;
        f1.x    += dx; f1.y    += dy; f1.move    = null;
        f2.x    += dx; f2.y    += dy; f2.move    = null;
        audio.playSE('step');
        callback();
      }, STEP_DUR);
    }

    // ギンターレだけ動かす
    function stepGintereOnly(dx, dy, callback) {
      if (!gintere) { callback(); return; }
      const t0 = performance.now();
      const dirName = _dirNameOf(dx, dy);
      gintere.walking = { dx, dy, t0, dur: STEP_DUR };
      if (dirName) gintere.dir = dirName;
      setTimeout(() => {
        gintere.x += dx; gintere.y += dy; gintere.walking = null;
        audio.playSE('step');
        callback();
      }, STEP_DUR);
    }

    // Phase 1: ギンターレ＋3人で縦列のまま北上、ギンターレが y=5（ステージ前）まで
    function walkAllUpToGintereY5(callback) {
      if (!gintere || gintere.y <= 5) { callback(); return; }
      stepAllWithGintere(0, -1, () => walkAllUpToGintereY5(callback));
    }

    // Phase 2: ギンターレが右に1歩どく（(16,5) → (17,5)）
    function gintereStepAside(callback) {
      stepGintereOnly(1, 0, () => setTimeout(callback, 300));
    }

    // Phase 3: 3人だけステージへ。リーダー (16,6) → (16,3)、F1 (15,3)、F2 (17,3)
    // 縦列のまま3歩登った後、2段階で横一列に展開する（asymmetric な dy=-2 を避ける）。
    function partyClimbStage(callback) {
      // 縦列のまま3歩上に登る
      stepPartyOnly(0, -1, () => {            // P(16,5) F1(16,6) F2(16,7)
        stepPartyOnly(0, -1, () => {          // P(16,4) F1(16,5) F2(16,6)
          stepPartyOnly(0, -1, () => {        // P(16,3) F1(16,4) F2(16,5)
            const SUB_DUR = 260;
            // Sub-step A: F1 (16,4)→(15,4), F2 (16,5)→(16,4)
            //   → P(16,3), F1(15,4), F2(16,4)
            const t0a = performance.now();
            f1.move = { dx: -1, dy:  0, t0: t0a, dur: SUB_DUR }; f1.dir = 'left';
            f2.move = { dx:  0, dy: -1, t0: t0a, dur: SUB_DUR }; f2.dir = 'up';
            setTimeout(() => {
              // 念のため state.followers から取り直して最終位置を強制（参照ずれ対策）
              const ff1 = state.followers && state.followers[0];
              const ff2 = state.followers && state.followers[1];
              if (ff1) { ff1.x = 15; ff1.y = 4; ff1.move = null; ff1.dir = 'up'; }
              if (ff2) { ff2.x = 16; ff2.y = 4; ff2.move = null; ff2.dir = 'up'; }
              // Sub-step B: F1 (15,4)→(15,3), F2 (16,4)→(17,3)
              //   → P(16,3), F1(15,3), F2(17,3) — 横一列完成
              const t0b = performance.now();
              if (ff1) ff1.move = { dx: 0,  dy: -1, t0: t0b, dur: SUB_DUR };
              if (ff2) ff2.move = { dx: 1,  dy: -1, t0: t0b, dur: SUB_DUR };
              setTimeout(() => {
                // 最終スナップ：取り直したうえで明示的に座標を固定
                state.px = 16; state.py = 3; state.move = null; state.pdir = 'up';
                const g1 = state.followers && state.followers[0];
                const g2 = state.followers && state.followers[1];
                if (g1) { g1.x = 15; g1.y = 3; g1.move = null; g1.dir = 'up'; }
                if (g2) { g2.x = 17; g2.y = 3; g2.move = null; g2.dir = 'up'; }
                audio.playSE('step');
                renderField();
                callback();
              }, SUB_DUR);
            }, SUB_DUR);
          });
        });
      });
    }

    function turnToAudience(callback) {
      setTimeout(() => {
        state.pdir = 'down';
        f1.dir    = 'down';
        f2.dir    = 'down';
        renderField();
        setTimeout(callback, 700);
      }, 300);
    }

    walkAllUpToGintereY5(() => {
      gintereStepAside(() => {
        partyClimbStage(() => {
          turnToAudience(() => {
            alive = false;
            state.scene = 'field';
            onDone();
          });
        });
      });
    });
  }

  function startBattle(enemy) {
    state.enemy = Object.assign({}, enemy);
    state.scene = 'battle';
    state.battleLog = enemy.name + 'があらわれた！';
    state.battleStep = 'menu';
    state.buff = 0;
    state.battleFx = [];
    state.shakeTime = 0;
    state.activeActor = -1;
    state.turnIdx = 0;
    state.battleCursor = 0;
    // 4曲ギミック用トラッキング（audience_30k で使用、他戦闘では参照されないだけで害はない）
    state.battleLastSong = null;
    state.battleSongsUsed = {};
    state.battleAllSongsBonusFired = false;
    if (!state.party[0].alive) advanceTurnToAlive();
    audio.playBGM(enemy.boss ? 'boss' : 'battle');
    render();
    showBattleUI();
  }

  function advanceTurnToAlive() {
    // 生存している次のキャラまで turnIdx を進める。全員行動済みなら -1 を返す
    while (state.turnIdx <= 2 && !state.party[state.turnIdx].alive) state.turnIdx++;
    return state.turnIdx <= 2 ? state.turnIdx : -1;
  }

  function nextActor() {
    state.turnIdx++;
    if (advanceTurnToAlive() < 0) {
      // 全員行動完了 → 敵ターン
      battleWait(enemyTurn, 500);
    } else {
      state.battleStep = 'menu';
      state.battleCursor = 0;
      showBattleUI();
    }
  }

  // 攻撃のFX演出（音符が actor → enemy へ飛び、命中時に shake + ダメージ表示）
  function playSingFx(actorIdx, dmg, color, onHit) {
    state.activeActor = actorIdx;
    audio.playSE('sing');
    const slotW = 128;
    const x0 = actorIdx * slotW + slotW / 2;
    const y0 = 222 + 4 + 16;
    const x1 = 130 + 60;
    const y1 = 30 + 60;
    const noteCol = color || '#dac030';
    // 3つ音符を時間差で飛ばす
    pushFx({ kind: 'note', x0, y0, x1, y1, color: noteCol, dur: 600 });
    setTimeout(() => pushFx({ kind: 'note', x0, y0, x1, y1, color: noteCol, dur: 600 }), 100);
    setTimeout(() => pushFx({ kind: 'note', x0, y0, x1, y1, color: noteCol, dur: 600 }), 200);
    // 着弾
    battleWait(() => {
      state.shakeTime = performance.now() + 380;
      pushFx({ kind: 'dmg', x: x1, y: y1 - 20, value: dmg, dur: 900 });
      onHit();
    }, 700);
  }

  // 現在のアクター・状況に応じた戦闘メニューの選択肢一覧を組み立てる
  function buildBattleActions() {
    const idx = state.turnIdx;
    const actor = state.party[idx];
    const list = [];
    if (!actor || !actor.alive) return list;
    // 1. 声援（MP0、最初）
    list.push({
      act: 'cheer',
      label: '📣 声援',
      sub: 'MP0/威2-4',
      enabled: true,
      special: false,
    });
    // 2. 歌コマンド
    SONGS.forEach((s, i) => {
      if (s.key) {
        // 解禁済み4曲は3人合体技：主人公ターンのみ・全員生存必須
        if (idx !== 0) return;
        const allAlive = state.party.every(p => p.alive);
        const isDain = state.enemy && state.enemy.type === 'audience_30k';
        const split = mpSplit(s.mp);
        let canMp = true;
        if (!isDain) {
          canMp = state.party[0].mp >= split[0] && state.party[1].mp >= split[1] && state.party[2].mp >= split[2];
        }
        const subMp = isDain ? 'MP0(本番)' : ('MP' + split.join('/'));
        list.push({
          act: 'sing-' + i,
          label: '♪ ' + s.n,
          sub: subMp + ' / 3人合体技',
          enabled: allAlive && canMp,
          special: true,
        });
      } else {
        list.push({
          act: 'sing-' + i,
          label: '♪ ' + s.n,
          sub: 'MP' + s.mp + '/威' + s.base + '±',
          enabled: actor.mp >= s.mp,
          special: false,
        });
      }
    });
    // 3. 励ます
    const downAlly = state.party.find((p, i) => i !== idx && !p.alive);
    list.push({
      act: 'encourage',
      label: '★ 励ます',
      sub: '倒れた仲間1人を復活',
      enabled: !!downAlly,
      special: false,
    });
    // 4. 主人公だけ：エホーマイ＋逃げる を最下段に固定。
    //    現在の長さが偶数なら padding して必ず2行目に来るようにする
    if (idx === 0) {
      if (list.length % 2 === 1) {
        list.push({ act: '_filler', label: '', sub: '', enabled: false, special: false, filler: true });
      }
      const allAlive = state.party.every(p => p.alive);
      const ehoOk = allAlive && state.party[0].mp >= 6 && state.party[1].mp >= 1 && state.party[2].mp >= 1;
      list.push({
        act: 'ehomai',
        label: '★エホーマイ',
        sub: '3人合唱 / 3T威力2倍',
        enabled: ehoOk,
        special: true,
      });
      list.push({
        act: 'flee',
        label: '逃げる',
        sub: '',
        enabled: true,
        special: false,
      });
    }
    return list;
  }

  function executeBattleAction(a) {
    const cur = state.party[state.turnIdx];
    if (!cur || !cur.alive) return;
    if (a.startsWith('sing-')) {
      const i = parseInt(a.split('-')[1], 10);
      const s = SONGS[i];
      if (!s) return;
      if (s.key) {
        // 3人合体技：主人公ターン・全員生存必須
        if (state.turnIdx !== 0) return;
        if (!state.party.every(p => p.alive)) return;
        const isDain = state.enemy && state.enemy.type === 'audience_30k';
        if (!isDain) {
          const sp = mpSplit(s.mp);
          if (state.party[0].mp < sp[0] || state.party[1].mp < sp[1] || state.party[2].mp < sp[2]) return;
        }
        partySing(s);
      } else {
        if (cur.mp < s.mp) return;
        actorSing(state.turnIdx, s);
      }
    } else if (a === 'encourage') {
      if (state.party.find((p, i) => i !== state.turnIdx && !p.alive)) actorEncourage(state.turnIdx);
    } else if (a === 'cheer') {
      actorCheer(state.turnIdx);
    } else if (a === 'ehomai') {
      const ok = state.turnIdx === 0 && state.party.every(p => p.alive) && state.party[0].mp >= 6 && state.party[1].mp >= 1 && state.party[2].mp >= 1;
      if (ok) heroEhomai();
    } else if (a === 'flee') {
      if (state.turnIdx !== 0) return;
      if (state.enemy.boss) { state.battleLog = 'ボスからは逃げられない！'; showBattleUI(); return; }
      if (Math.random() < 0.6) { state.scene = 'field'; audio.stopBGM(); audio.playBGM('field'); setDialog('（うまく逃げ切った…）'); }
      else { state.battleStep = 'anim'; setBattleLog('逃げられなかった！'); battleWait(() => { state.turnIdx = 0; advanceTurnToAlive(); enemyTurn(); }, 1100); }
    }
  }

  // カーソル移動（2列グリッド）。MP不足／filler セルは自動スキップ
  function moveBattleCursor(dx, dy) {
    const list = state.battleActions || [];
    const len = list.length;
    if (len === 0) return;
    const cols = 2;
    let i = state.battleCursor || 0;
    if (i < 0 || i >= len) i = 0;
    const rows = Math.ceil(len / cols);
    const isPickable = (n) => {
      const it = list[n];
      return !!(it && it.enabled && !it.filler);
    };
    if (dx !== 0) {
      // 水平移動：同じ行の対象列が有効ならそこへ。無効なら距離が近い行を上下交互に探す
      const targetCol = ((i % cols) + dx + cols) % cols;
      const curRow = Math.floor(i / cols);
      const sameRowIdx = curRow * cols + targetCol;
      if (sameRowIdx < len && isPickable(sameRowIdx)) {
        state.battleCursor = sameRowIdx;
      } else {
        for (let dist = 1; dist < rows; dist++) {
          let found = -1;
          for (const r of [curRow + dist, curRow - dist]) {
            if (r < 0 || r >= rows) continue;
            const n = r * cols + targetCol;
            if (n < len && isPickable(n)) { found = n; break; }
          }
          if (found >= 0) { state.battleCursor = found; break; }
        }
      }
    } else if (dy !== 0) {
      // 垂直移動：同じ列内で現在位置から方向に進めて次の有効スロット（端でラップ）
      const curCol = i % cols;
      const curRow = Math.floor(i / cols);
      for (let step = 1; step <= rows; step++) {
        const r = ((curRow + step * dy) % rows + rows) % rows;
        const n = r * cols + curCol;
        if (n < len && isPickable(n)) { state.battleCursor = n; break; }
      }
    }
    showBattleUI();
  }

  function selectBattleAction() {
    const actions = state.battleActions || [];
    const c = state.battleCursor || 0;
    const item = actions[c];
    if (!item) return;
    if (!item.enabled) { audio.playSE('cancel'); return; }
    audio.playSE('decide');
    executeBattleAction(item.act);
  }

  function showBattleUI() {
    const d = document.getElementById('dialog');
    const idx = state.turnIdx;
    const actor = state.party[idx];
    let html = '<div style="font-size:13px;margin-bottom:6px;">' + state.battleLog + '</div>';
    if (state.battleStep === 'menu' && actor && actor.alive) {
      // メニュー切替時にアクション一覧を再構築
      state.battleActions = buildBattleActions();
      if (state.battleCursor == null || state.battleCursor >= state.battleActions.length) state.battleCursor = 0;
      // 無効スロットから開始しないように、最初の有効インデックスへ寄せる
      if (state.battleActions.length > 0) {
        const cur = state.battleActions[state.battleCursor];
        if (!cur || !cur.enabled || cur.filler) {
          const firstOk = state.battleActions.findIndex(x => x.enabled && !x.filler);
          if (firstOk >= 0) state.battleCursor = firstOk;
        }
      }
      html += '<div style="font-size:11px;color:#aaa;margin-bottom:4px;">▼ ' + actor.name + ' のコマンド (HP' + actor.hp + ' MP' + actor.mp + ') <span style="color:#666;">[↑↓←→で選択 / Enterで決定]</span></div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
      state.battleActions.forEach((it, i) => {
        if (it.filler) {
          // 透明スペーサ（見た目を空けつつクリック・選択不可）
          html += '<div style="padding:6px;font-size:12px;visibility:hidden;">.</div>';
          return;
        }
        const sel = (i === state.battleCursor);
        const dim = it.enabled ? '' : 'opacity:0.4;';
        const bg  = it.special ? '#3a2a4a' : '#222';
        const baseBorder = it.special ? '#dac030' : '#555';
        const border = sel ? '#dac030' : baseBorder;
        const bg2 = sel ? (it.special ? '#5a4a6a' : '#3a3a4a') : bg;
        const txt = it.special ? '#dac030' : '#fff';
        const subColor = sel ? '#fff' : '#aaa';
        const sub = it.sub ? '<br><span style="font-size:10px;color:' + subColor + ';">' + it.sub + '</span>' : '';
        const arrow = sel ? '<span style="color:#dac030;">▶ </span>' : '';
        html += `<button data-act="${it.act}" data-idx="${i}" style="${dim}padding:6px;font-size:12px;background:${bg2};border:2px solid ${border};border-radius:6px;color:${txt};cursor:pointer;text-align:left;">${arrow}${it.label}${sub}</button>`;
      });
      html += '</div>';
    }
    d.innerHTML = html;
    d.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.idx, 10);
        if (!isNaN(i)) state.battleCursor = i;
        const item = (state.battleActions || [])[i];
        if (item && !item.enabled) { audio.playSE('cancel'); return; }
        audio.playSE('decide');
        executeBattleAction(b.dataset.act);
      });
    });
    // 選択中のボタンを必ず可視範囲に収める（小さな画面でレイアウトがあふれた場合の保険）
    if (state.battleStep === 'menu') {
      const sel = d.querySelector('[data-idx="' + state.battleCursor + '"]');
      if (sel && typeof sel.scrollIntoView === 'function') {
        try { sel.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
      }
    }
  }

  const SONG_COLORS = ['#dac030', '#3aae5a', '#3a8abe', '#aa6aee', '#c83030'];

  // 3人合体技のMPを均等分割。total=6→[2,2,2], 8→[3,3,2], 10→[4,3,3], 12→[4,4,4]
  function mpSplit(total) {
    const a = Math.ceil(total / 3);
    const b = Math.ceil((total - a) / 2);
    const c = total - a - b;
    return [a, b, c];
  }

  // 解禁4曲：3人合体技。基本ダメージ約3倍、audience_30k 戦は MP消費なし＋4曲ギミック。
  function partySing(s) {
    const isDain = state.enemy && state.enemy.type === 'audience_30k';
    if (!isDain) {
      const sp = mpSplit(s.mp);
      state.party[0].mp -= sp[0];
      state.party[1].mp -= sp[1];
      state.party[2].mp -= sp[2];
    }
    state.songCounter++;

    // 4曲ギミック：その曲が今戦闘で既出ならリピート扱い（直前曲かどうかは問わない）
    state.battleSongsUsed = state.battleSongsUsed || {};
    const isRepeat = !!state.battleSongsUsed[s.key];
    state.battleSongsUsed[s.key] = true;
    state.battleLastSong = s.key;

    // ダメージ：3倍ベース＋揺らぎ＋レベル
    let dmg = s.base * 3 + Math.floor(Math.random() * 6) - 2 + state.lv;
    if (state.buff > 0) dmg *= 2;
    if (state.enemy.boss) dmg = Math.max(1, dmg - 3);

    // ダイヌシュベンテ専用：同曲リピートで激減 / 4曲達成でボーナス
    let bonusDmg = 0;
    let preMsg = null;
    let postMsg = null;
    if (isDain) {
      if (isRepeat) {
        dmg = Math.max(1, Math.floor(dmg * 0.05));
        preMsg = '観衆は同じ歌に飽きてしまった…';
      }
      const used = state.battleSongsUsed;
      const allFour = !!(used.soran && used.dynamic && used.mano && used.kur);
      if (allFour && !state.battleAllSongsBonusFired) {
        state.battleAllSongsBonusFired = true;
        bonusDmg = 9999;
        postMsg = '★リトアニアの魂が震えた！ 4つの旋律が、 観衆の心を貫いた！';
      }
    }

    state.battleStep = 'anim';
    audio.playSE('sing');
    audio.duckBGM(0.15, 2.8);
    audio.playSongPhrase(s.key, 'short');
    setBattleLog(`★3人で ♪「${s.n}」 を歌い上げる！`);
    pushFx({ kind: 'flash', dur: 500 });

    // 3人それぞれから音符が敵へ飛ぶ
    const slotW = 128;
    const ex = 130 + 60;
    const ey = 30 + 60;
    [0, 1, 2].forEach((i, k) => {
      setTimeout(() => {
        const x0 = i * slotW + slotW / 2;
        pushFx({ kind: 'note', x0, y0: 222 + 4 + 16, x1: ex, y1: ey, color: SONG_COLORS[k % SONG_COLORS.length], dur: 700 });
      }, 120 * k);
    });

    battleWait(() => {
      state.shakeTime = performance.now() + 480;
      pushFx({ kind: 'dmg', x: ex, y: ey - 20, value: dmg, dur: 900 });
      state.enemy.hp -= dmg;
      if (preMsg) {
        setBattleLog(`${preMsg} 感動${dmg}…`);
      } else {
        setBattleLog(`感動${dmg}！ ${state.enemy.name} の心が大きく揺れた！`);
      }
      // 4曲達成フィニッシャー演出（多段カットシーン）
      if (bonusDmg > 0) {
        // 演出中のスキップを禁止（音源が途切れるため）
        state.noSkipBattle = true;
        battleWait(() => {
          setBattleLog('── ふっと、 風が、 止まった。');
          // BGM は MediaElementSource → GainNode 経由でルーティングしているため、
          // iOS Safari でも duckBGM で実際に音量を絞れる。
          // HTMLAudio 自体の再生は継続させて音声セッションを維持し、
          // 続く Web Audio (climax) が確実に出力されるようにする。
          audio.duckBGM(0.0, 22);
          audio.ensureCtx();
        }, 1500);
        battleWait(() => {
          setBattleLog('ソーラン節 ── ダイナミック琉球 ──');
          pushFx({ kind: 'flash', dur: 700 });
          // 4色の音符が3人から空へ昇る
          ['soran','dynamic','mano','kur'].forEach((k, idx) => {
            const col = SONG_COLORS[(idx + 1) % SONG_COLORS.length];
            [0, 1, 2].forEach((p, pi) => {
              setTimeout(() => {
                const x0 = p * slotW + slotW / 2;
                pushFx({ kind: 'note', x0, y0: 222, x1: x0 + (Math.random() - 0.5) * 40, y1: 30, color: col, dur: 1400 });
              }, idx * 180 + pi * 60);
            });
          });
        }, 3000);
        battleWait(() => {
          setBattleLog('Mano kraštas ── Kur giria ──');
        }, 4500);
        battleWait(() => {
          setBattleLog('★ 4つの旋律が、 ひとつに重なる──');
          pushFx({ kind: 'flash', dur: 1200 });
          // BGMは「風が止まった」で2%まで絞ってあるので、ほぼ無音の中に響き渡る。
          const climaxSec = audio.playSongPhrase('kur', 'climax') || 8.0;
          // 全3人から敵へ無数の音符
          for (let n = 0; n < 12; n++) {
            setTimeout(() => {
              const p = n % 3;
              const x0 = p * slotW + slotW / 2;
              const col = SONG_COLORS[n % SONG_COLORS.length];
              pushFx({ kind: 'note', x0, y0: 222, x1: ex + (Math.random() - 0.5) * 50, y1: ey + (Math.random() - 0.5) * 30, color: col, dur: 800 });
            }, n * 80);
          }
          // クライマックスが完全に鳴り終わるまで待ってから決着へ。
          //   tailMs … 曲終了から余韻
          const climaxMs = climaxSec * 1000;
          const tailMs = 600;
          battleWait(() => {
            state.shakeTime = performance.now() + 1200;
            pushFx({ kind: 'flash', dur: 600 });
            pushFx({ kind: 'dmg', x: ex, y: ey - 20, value: bonusDmg, dur: 1400 });
            state.enemy.hp -= bonusDmg;
            setBattleLog(postMsg);
          }, climaxMs + tailMs);
          battleWait(() => {
            setBattleLog(`観衆の心が、 ついに弾けた！ 感動 ${bonusDmg}！`);
          }, climaxMs + tailMs + 1300);
          battleWait(() => {
            state.noSkipBattle = false;
            state.activeActor = -1;
            if (state.enemy.hp <= 0) { victory(); return; }
            state.turnIdx = 3;
            enemyTurn();
          }, climaxMs + tailMs + 2700);
        }, 6500);
        return;
      }
      // 通常の終了処理
      battleWait(() => {
        state.activeActor = -1;
        if (state.enemy.hp <= 0) { victory(); return; }
        // 3人合体技：全員のターンを消費して敵ターンへ
        state.turnIdx = 3;
        enemyTurn();
      }, 1400);
    }, 800);
  }

  function actorSing(idx, s) {
    const a = state.party[idx];
    a.mp -= s.mp;
    state.songCounter++;
    let dmg = s.base + Math.floor(Math.random() * 4) - 1 + state.lv;
    // 仲間はやや威力減（idx===0以外は -1）。底なし回避
    if (idx !== 0) dmg = Math.max(1, dmg - 1);
    if (state.buff > 0) dmg *= 2;
    if (state.enemy.boss) dmg = Math.max(1, dmg - 3);
    state.battleStep = 'anim';
    setBattleLog(`${a.name}は ♪「${s.n}」 を歌った！`);
    // 4曲（解禁済み）の場合は主旋律ワンフレーズも鳴らす（その間BGMを絞る）
    if (s.key) {
      audio.duckBGM(0.15, 2.5);
      audio.playSongPhrase(s.key, 'short');
    }
    playSingFx(idx, dmg, SONG_COLORS[state.songCounter % SONG_COLORS.length], () => {
      state.enemy.hp -= dmg;
      setBattleLog(`感動${dmg}！ ${state.enemy.name} の心が揺れた！`);
      battleWait(() => {
        state.activeActor = -1;
        if (state.enemy.hp <= 0) { victory(); return; }
        nextActor();
      }, 1200);
    });
  }

  function actorEncourage(idx) {
    const down = state.party.find((p, i) => i !== idx && !p.alive);
    if (!down) return;
    down.alive = true;
    down.hp = Math.floor(down.maxHp / 2);
    state.battleStep = 'anim';
    state.activeActor = idx;
    const dIdx = state.party.indexOf(down);
    const slotW = 128;
    pushFx({ kind: 'heal', x: dIdx * slotW + slotW / 2, y: 240, value: down.hp, dur: 1000 });
    setBattleLog(`${state.party[idx].name}は ${down.name} を励ました！ ${down.name}は涙を拭いて立ち上がった！`);
    battleWait(() => {
      state.activeActor = -1;
      nextActor();
    }, 1600);
  }

  function actorCheer(idx) {
    // MP消費なしの簡易攻撃。MP切れ時の選択肢
    const a = state.party[idx];
    const dmg = 2 + Math.floor(Math.random() * 3);
    state.battleStep = 'anim';
    setBattleLog(`${a.name}：声援を送った！`);
    playSingFx(idx, dmg, '#aaa', () => {
      state.enemy.hp -= dmg;
      setBattleLog(`${a.name}：感動${dmg}！`);
      battleWait(() => {
        state.activeActor = -1;
        if (state.enemy.hp <= 0) { victory(); return; }
        nextActor();
      }, 900);
    });
  }

  function heroEhomai() {
    state.party[0].mp -= 6; state.party[1].mp -= 1; state.party[2].mp -= 1;
    // バフ技：このターンは攻撃せず、次のターンから3ターン威力2倍。
    // enemyTurnの先頭でbuff--されるので、ここでは4にしておく
    state.buff = 4;
    state.battleStep = 'anim';
    audio.playSE('ehomai');
    setBattleLog('★エホーマイ！ 3人が手を繋ぎ、声を重ねた！');
    pushFx({ kind: 'flash', dur: 600 });
    // 3人それぞれから音符が天に向かって昇る（祈り風）
    [0, 1, 2].forEach((i, k) => {
      setTimeout(() => {
        const slotW = 128;
        const x0 = i * slotW + slotW / 2;
        pushFx({ kind: 'note', x0, y0: 240, x1: x0, y1: 60, color: SONG_COLORS[k % 3], dur: 1000 });
      }, 150 * k);
    });
    battleWait(() => {
      setBattleLog('全員の歌の力が高まった！ (この後3ターン 威力2倍)');
    }, 1400);
    battleWait(() => {
      state.activeActor = -1;
      // 3人合体技のため全員のターンを消費して敵ターンへ
      state.turnIdx = 3;
      enemyTurn();
    }, 2700);
  }

  function enemyTurn() {
    if (state.buff > 0) state.buff--;
    const aliveIdx = state.party.map((p, i) => p.alive ? i : -1).filter(i => i >= 0);
    if (aliveIdx.length === 0) { defeat(); return; }
    const tgt = aliveIdx[Math.floor(Math.random() * aliveIdx.length)];
    const atk = state.enemy.atk + Math.floor(Math.random() * 3);
    state.battleStep = 'anim';
    setBattleLog(`${state.enemy.name}の批判！`);
    // 敵から黒い"批判"が飛ぶ
    const slotW = 128;
    const tx = tgt * slotW + slotW / 2;
    const ty = 240;
    pushFx({ kind: 'note', x0: 190, y0: 90, x1: tx, y1: ty, color: '#aa3030', dur: 600 });
    battleWait(() => {
      state.party[tgt].hp -= atk;
      pushFx({ kind: 'dmg', x: tx, y: ty - 30, value: atk, dur: 900 });
      // パーティスロットも軽くシェイク（簡易：再描画タイミング）
      let msg = `${state.party[tgt].name} HP${atk}減少！`;
      if (state.party[tgt].hp <= 0) {
        state.party[tgt].hp = 0;
        state.party[tgt].alive = false;
        msg += ` ${state.party[tgt].name}は泣き崩れた！`;
      }
      setBattleLog(msg);
      battleWait(() => {
        if (state.party.every(p => !p.alive)) { defeat(); return; }
        // 次ラウンドの先頭（最初に生存しているメンバー）からメニュー
        state.turnIdx = 0;
        if (advanceTurnToAlive() < 0) { defeat(); return; }
        state.battleStep = 'menu';
        showBattleUI();
      }, 1300);
    }, 900);
  }

  function victory() {
    state.scene = 'win';
    state.xp += state.enemy.xp;
    state.gold += state.enemy.gold;
    audio.playBGM('win');
    audio.playSE('victory');
    const msg = [
      `${state.enemy.name}は感動して泣き出した！`,
      `経験値 ${state.enemy.xp} と €${state.enemy.gold} を得た！`,
    ];
    let leveled = false;
    while (state.xp >= state.nextXp) {
      state.lv++;
      state.xp -= state.nextXp;
      state.nextXp = Math.floor(state.nextXp * 1.6);
      state.party.forEach(p => { p.maxHp += 4; p.hp = p.maxHp; p.maxMp += 2; p.mp = p.maxMp; });
      msg.push(`♪レベルアップ！ Lv${state.lv}！ パーティ全員が成長した！`);
      leveled = true;
    }
    if (leveled) audio.playSE('levelup');
    if (state.enemy.boss) {
      if (state.enemy.type === 'guardian' && !state.flags.guardian) {
        state.flags.guardian = true;
        const a = awardPiece('soran', '塔の番人');
        audio.playSE('piece');
        msg.push('塔の番人：「── 見事だ。 我の心が、 確かに震えた。」');
        msg.push('塔の番人：「我も若き頃は、 この塔の上で歌ったものだ。」');
        msg.push('塔の番人：「リトアニアの空に、 お前たちの声を響かせよ。」');
        msg.push('塔の番人は静かに歌詞ピースを差し出した…');
        pieceLines(a).forEach(l => msg.push(l));
      } else if (state.enemy.type === 'witches_idols' && !state.flags.witches_trial) {
        state.flags.witches_trial = true;
        msg.push('動き出した彫刻たちは、満ち足りた表情で再び木の像へ戻っていった…');
        msg.push('丘に深い静けさが戻り、中央の台座だけがほのかに光り始めた。');
      } else if (state.enemy.type === 'victoria' && !state.flags.victoria_done) {
        state.flags.victoria_done = true;
        const a = awardPiece('kur', 'ヴィクトリア');
        audio.playSE('piece');
        msg.push('ヴィクトリア：「あなたの歌、心に届いたわ。」');
        msg.push('「── これは私からの贈り物。Kur giria の旋律よ。」');
        pieceLines(a).forEach(l => msg.push(l));
      } else if (state.enemy.type === 'audience_30k' && !state.flags.dainusvente_done) {
        state.flags.dainusvente_done = true;
        msg.push('── 最後の音が、 会場全体に響き渡った。');
        // 「★ ダイヌシュベンテ、 大成功！ ★」は Scene A の歓声が広がりきった
        // タイミングで初めて出すよう移動（ここでは出さない）
      }
    }
    const enemyType = state.enemy ? state.enemy.type : null;
    setDialog(msg, () => {
      // ダイヌシュベンテ勝利後はエンディング演出へ
      if (enemyType === 'audience_30k') {
        playEnding();
        return;
      }
      state.scene = 'field';
      // win→field の遷移を確実にクリーンに：再生中BGMを停止してからフィールドBGMを鳴らす
      audio.stopBGM();
      audio.playBGM('field');
      // 勝利でフラグが変わると新NPCが出現する場合があるので、現在街のNPCリストを再構築
      if (state.cityKey) rebuildNPCs(state.cityKey);
      saveGame();
      render();
    });
  }

  // ============================================================
  // ダイヌシュベンテ勝利後 — エンディング演出（Phase 7-4）
  //   A. ステージ上の3人＋あきちゃん・みほさん
  //   B. キーパーソン祝福
  //   C. チョルリョーニス最後の登場
  //   D. スタッフロール
  //   E. フィールド復帰（Vingisパーク）
  // ============================================================
  function playEnding() {
    const p0 = state.party[0].name;
    const p1 = state.party[1].name;
    const p2 = state.party[2].name;
    const sibStr = sib();

    // Scene A〜B は勝利BGMをそのまま流し続ける（無音はScene Cまで取っておく）

    // Scene A: ステージ上、3万人の歓声と3人の感想
    setDialog([
      '── ふっと、 静寂が、 訪れた。',
      '観衆は息を飲んでいた。',
      'やがて── 一人が拍手を始めた。',
      'もう一人。 また一人。',
      '波が広がるように、 3万人の歓声が会場を満たしていく。',
      '★★★ ダイヌシュベンテ、 大成功！ ★★★',
      `${p1}：「やった── やったよ、 ${p0}さん！」`,
      `${p2}：「3万人だよ、 3万人。 …本当に、 歌い切ったね。」`,
      `${p0}：「歌が── ぼくたちのところに、 戻ってきたんだ。」`,
      '── ステージ袖から、 あきちゃんとみほさんが駆け寄ってくる。',
      'あきちゃん：「やったやったやった！ ぼくの自慢の3人だよ、 ほんとにもう！」',
      'みほさん：「お疲れさま、 みんな── 立派だったよ。 涙が止まらないわ。」',
    ], playEndingSceneB);
  }

  function playEndingSceneB() {
    // Scene B: キーパーソンが順に祝福
    const sibStr = sib();
    setDialog([
      '── 舞台袖から、 リトアニアの友人たちが、 一人、 また一人と集まってくる。',
      'マンタス：「やられたよ！ ぼくの店の客も、 街じゅうのみんなも、 君たちの歌にぜんぶ持っていかれたよ！」',
      'イエヴァ：「あなたたちの故郷の歌── ほんとうに素敵だった。 あとでうちのレストランに来てね、 ご馳走するから。」',
      'エレナ：「ピアノで合わせたかったわ。 でも、 あなたたち3人で十分だった。」',
      'マリウス：「‥‥うん。 よかった。 心から、 そう思う。」',
      'マリア：「ヴィオラじゃ、 あの感動は出せない。 歌って、 すごい。」',
      'コトリーナ：「あの紙切れ、 渡せて本当によかった。 子どもたちの宝物が、 ちゃんと届いた気がする。」',
      `ルツィア：「${sibStr}！ ルーちゃんね、 おうたきいて、 むねが ぽかぽかしたの〜！」`,
      'ヴィクトリア：「── 認めるわ。 今日のあなたたちは、 私より、 ずっと良い歌い手だった。」',
      'ユウコヤマサキ：「カンクレスを取り戻してくれたあなたたちが、 こうして歌い上げる── 本当に、 嬉しいです。」',
      'ギンターレ：「あの夜、 私が見たのは── リトアニアの未来。 ありがとう。」',
    ], playEndingSceneC);
  }

  function playEndingSceneC() {
    // Scene C: チョルリョーニスの最後の登場
    // ギンターレの最後のセリフが画面に残ったままBGMだけ消えると順番がズレて見えるため、
    // ダイアログ枠を即時クリアして「セリフ→無音」を視覚的にも揃える。
    // setTimeout の隙間に A 連打で「特に何もない」が出ないよう scene を cutscene に固定。
    state.scene = 'cutscene';
    const dialog = document.getElementById('dialog');
    if (dialog) dialog.innerHTML = '';
    // win BGM を完全停止すると iOS Safari で Audio セッションが落ち、
    // 続く手続き合成の ending BGM が無音になる。鳴らしたまま音量だけ 0 に絞り、
    // セッションを維持する（クライマックス時にボスBGMを ducking で残すのと同じ手）。
    // ユーザー読みが長引いても復帰しないよう 120s と長めに取る。
    audio.duckBGM(0.0, 120);
    fadeCanvas(2000, 0.4);
    setTimeout(() => {
      setDialog([
        '── そのとき、 風が、 静かに吹き抜けた。',
        '誰も気づかないけれど、 ステージの端に、 彼が立っていた。',
        'チョルリョーニス：「── お前たちの音は、 リトアニアの森にも、 海にも、 空にも届いた。」',
        '「歌い終えた声は、 大地に還り、 また誰かの歌になる。」',
        '「私たちはみな── 消えゆく旋律の、 一部にすぎない。」',
        '「いい旅だった。 もう、 言うことはない。」',
        '── 風が止む。 ステージの端には、 もう誰もいない。',
      ], () => {
        // setTimeout(rollCredits) の隙間でも A 連打が field に漏れないようにロック
        state.scene = 'cutscene';
        fadeCanvas(2000, 1);
        setTimeout(rollCredits, 2200);
      });
    }, 2200);
  }

  function rollCredits() {
    // Scene D: スタッフロール（DOMオーバーレイで縦スクロール）
    state.scene = 'credits';
    // ★ ending は手続き合成のため ctx.destination に直接出力する。
    //   ここで stopBGM すると win HTMLAudio が止まり、iOS Safari で
    //   Audio セッションが落ちて以降の手続き音が無音化するため、
    //   win BGM は鳴らしたまま（音量だけ 0）にして上に重ねて鳴らす。
    //   ただし duckBGM だと duckLevel が 0 になり、playProcedural の peak も
    //   0 倍されて ending が無音化するので、ここでは bgmGain だけを直接絞り、
    //   JS 側 duckLevel は 1.0 に戻す（procedural が full volume で鳴るように）。
    if (audio._duckTimer) { clearTimeout(audio._duckTimer); audio._duckTimer = null; }
    audio.duckLevel = 1.0;
    if (audio.bgmGain && audio.actx) {
      try {
        const t = audio.actx.currentTime;
        audio.bgmGain.gain.cancelScheduledValues(t);
        audio.bgmGain.gain.setTargetAtTime(0, t, 0.04);
      } catch (e) {}
    }
    audio.ensureCtx();
    // 直接 playProcedural を呼ぶ（playBGM だと win を pause してしまう）
    setTimeout(() => audio.playProcedural('ending'), 120);
    const dialog = document.getElementById('dialog');
    if (dialog) dialog.innerHTML = '<div style="text-align:center;color:#888;font-size:11px;">エンドロール</div>';

    const root = document.getElementById('game-root');
    const screen = document.getElementById('screen');
    const overlay = document.createElement('div');
    overlay.id = 'creditsOverlay';
    const r = screen.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    overlay.style.cssText =
      'position:absolute;background:#000;color:#fff;overflow:hidden;z-index:20;border-radius:8px;' +
      `left:${r.left - rr.left}px;top:${r.top - rr.top}px;width:${r.width}px;height:${r.height}px;` +
      'font-family:system-ui,-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;';
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
    root.appendChild(overlay);

    const p0 = state.party[0].name;
    const p1 = state.party[1].name;
    const p2 = state.party[2].name;

    const scroll = document.createElement('div');
    scroll.style.cssText =
      'position:absolute;left:0;right:0;top:100%;text-align:center;padding:20px;line-height:1.9;font-size:14px;';
    scroll.innerHTML = `
      <div style="font-size:22px;color:#dac030;margin-bottom:8px;">リトアニア音楽紀行</div>
      <div style="font-size:13px;color:#aaa;margin-bottom:36px;">〜失われた歌詞のピース〜</div>

      <div style="color:#dac030;margin-bottom:6px;">［ 主人公 ］</div>
      <div style="margin-bottom:24px;">${escapeHtml(p0)}</div>

      <div style="color:#dac030;margin-bottom:6px;">［ 仲間 ］</div>
      <div>${escapeHtml(p1)}</div>
      <div style="margin-bottom:24px;">${escapeHtml(p2)}</div>

      <div style="color:#dac030;margin-bottom:6px;">［ AKクワイア ］</div>
      <div>あきちゃん</div>
      <div style="margin-bottom:24px;">みほさん</div>

      <div style="color:#dac030;margin-bottom:6px;">［ リトアニアの友人たち ］</div>
      <div>マンタス　／　イエヴァ</div>
      <div>エレナ　／　マリウス</div>
      <div>マリア　／　コトリーナ　／　ルツィア</div>
      <div>ヴィクトリア</div>
      <div>ユウコヤマサキ</div>
      <div style="margin-bottom:24px;">ギンターレ</div>

      <div style="color:#dac030;margin-bottom:6px;">［ 精霊 ］</div>
      <div style="margin-bottom:24px;">M.K.チョルリョーニス</div>

      <div style="color:#dac030;margin-bottom:6px;">［ 音楽モチーフ ］</div>
      <div>ソーラン節　／　ダイナミック琉球</div>
      <div style="margin-bottom:24px;">Mano kraštas　／　Kur giria</div>

      <div style="color:#dac030;margin-bottom:6px;">［ 制作 ］</div>
      <div style="margin-bottom:24px;">ケイ</div>

      <div style="color:#dac030;margin-bottom:6px;">［ 協力 ］</div>
      <div style="margin-bottom:36px;">AKクワイアのみなさん</div>

      <div style="font-size:18px;color:#dac030;margin-bottom:8px;">── Ačiū! ──</div>
      <div style="font-size:11px;color:#888;">ありがとう</div>
    `;
    overlay.appendChild(scroll);

    // CSSスクロールアニメーション。期待コンテンツ約 700px、画面高 384px。
    // 開始: top:100% (画面下) → 終了: top:-(コンテンツ高 + 余白)
    requestAnimationFrame(() => {
      const contentH = scroll.offsetHeight;
      const overlayH = overlay.offsetHeight;
      const totalDist = overlayH + contentH + 40;
      const durSec = 38; // ゆっくり目
      scroll.style.transition = `top ${durSec}s linear`;
      scroll.style.top = `-${contentH + 40}px`;

      // 完了後の終局画面（スキップ不可・誤タップでバグらないようにイベントは付けない）
      setTimeout(showCreditsFinal, durSec * 1000);

      function showCreditsFinal() {
        // 「Ačiū!」を中央に大きく表示してフィールド復帰待ち
        scroll.style.transition = 'opacity 1.2s ease-in-out';
        scroll.style.opacity = '0';
        setTimeout(() => {
          overlay.innerHTML = `
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;">
              <div style="font-size:34px;color:#dac030;letter-spacing:0.2em;">Ačiū !</div>
              <div style="font-size:12px;color:#aaa;">A を押してタイトルに戻る</div>
            </div>
          `;
          const btnAEl = document.getElementById('btnA');
          const finish = () => {
            window.removeEventListener('keydown', onFinKey);
            overlay.removeEventListener('click', finish);
            if (btnAEl) btnAEl.removeEventListener('click', finish);
            overlay.remove();
            fadeCanvas(0, 0);
            // ダイヌシュベンテ達成セーブを残したままタイトルに戻す
            saveGame();
            audio.stopBGM();
            audio.playBGM('title');
            showTitleMenu();
          };
          const onFinKey = (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z' ||
                e.key === 'a' || e.key === 'A') finish();
          };
          window.addEventListener('keydown', onFinKey);
          overlay.addEventListener('click', finish);
          if (btnAEl) btnAEl.addEventListener('click', finish);
        }, 1200);
      }
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  function defeat() {
    state.scene = 'lose';
    audio.playBGM('inn');
    // ヴィクトリア戦は友好戦闘 — 負けてもピースが貰える
    const isVictoria = !!(state.enemy && state.enemy.type === 'victoria' && !state.flags.victoria_done);
    const introLines = isVictoria
      ? ['ヴィクトリア：「ふふ、私の勝ち。 でも、あなたの歌── 心に残ったわ。」',
         '「── これは約束よ。 受け取って。」',
         '気がつくと、みほさんの宿屋のベッドで目を覚ましていた。']
      : [`${state.party[0].name}は感動させられて倒れた…`,
         'みほさんの宿屋で目を覚ました。'];
    setDialog(
      introLines,
      () => {
        state.party.forEach(p => { p.hp = p.maxHp; p.mp = p.maxMp; p.alive = true; });
        // 直近の宿屋前へ（都市別）。魔女の丘で倒れた場合はクライペダの宿屋へ。
        if (state.cityKey === 'witches') {
          state.cityKey = 'klaipeda';
          buildKlaipeda();
          rebuildNPCs('klaipeda');
        }
        const innFront =
          state.cityKey === 'kaunas'   ? { x: 12, y: 15 } :
          state.cityKey === 'klaipeda' ? { x: 8,  y: 15 } :
          state.cityKey === 'trakai'   ? { x: 10, y: 19 } :
          state.cityKey === 'siauliai' ? { x: 10, y: 18 } :
                                          { x: 10, y: 19 };
        state.px = innFront.x; state.py = innFront.y;
        state.pdir = 'up';
        resetFollowersToLeader();
        state.scene = 'field';
        audio.stopBGM();
        audio.playBGM('field');
        // ヴィクトリア負け処理 — ピース授与
        if (isVictoria) {
          state.flags.victoria_done = true;
          const a = awardPiece('kur', 'ヴィクトリア');
          audio.playSE('piece');
          setDialog(
            ['ヴィクトリア：「あなたの歌、心に届いたわ。」',
             '「── これは私からの贈り物。Kur giria の旋律よ。」']
              .concat(pieceLines(a)),
            () => { saveGame(); render(); }
          );
        } else {
          saveGame();
          render();
        }
      }
    );
  }

  // ============================================================
  // 入力処理
  // ============================================================
  function isWalkable(x, y) {
    if (x < 0 || x >= MAP_COLS || y < 0 || y >= MAP_ROWS) return false;
    const t = MAP[y][x];
    // 通行不可: 壁・木・水・観光建物・大聖堂・追加ランドマーク・ドア
    if (t === T.WALL || t === T.TREE || t === T.WATER || t === T.DOOR) return false;
    if (t === T.GEDIMINAS || t === T.GATES || t === T.ANNE || t === T.CATHEDRAL) return false;
    if (t === T.BERNARDINE || t === T.VU || t === T.CROSSES) return false;
    if (t === T.PRESIDENT || t === T.UZUPIS) return false;
    if (t === T.KAUNAS_CASTLE || t === T.CIURLIONIS) return false;
    if (t === T.SCULPTURE || t === T.BOAT) return false;
    // 建物入口タイル（INN/AKHALL/RESTAURANT/SHOP/TOWNHALL）はAボタン専用、踏み込み不可
    if (t === T.INN || t === T.AKHALL || t === T.RESTAURANT || t === T.SHOP || t === T.TOWNHALL) return false;
    return true;
    // PILIES (市場通り)・STATION（ホーム）は通行可能。ドアはAボタン専用
  }
  function npcAt(x, y) {
    return NPCS.find(n => {
      if (n.kind === 'guardian' && state.flags.guardian) return false;
      if (n.x === x && n.y === y) return true;
      // 歩行中NPCは行先タイルも占有とみなす
      if (n.walking && (n.x + n.walking.dx) === x && (n.y + n.walking.dy) === y) return true;
      return false;
    });
  }

  // ============================================================
  // NPC ランダム歩行
  // ============================================================
  const NPC_WALK_DUR = 600; // タイル間の歩行時間 ms（ゆっくり）
  const NPC_WALK_RADIUS = 2; // 自宅からの最大距離
  function initNPCWalk() {
    const now = performance.now();
    NPCS.forEach(n => {
      if (n.homeX == null) { n.homeX = n.x; n.homeY = n.y; }
      n.dir = n.dir || 'down';
      n.walking = null;
      // 起動を時間差にして同時歩行を避ける
      n.walkNext = now + 1500 + Math.random() * 3000;
    });
  }
  function tickNPCs(now) {
    for (const n of NPCS) {
      if (n.stationary) continue;
      if (n.kind === 'guardian' && state.flags.guardian) continue;
      // 歩行中の完了判定
      if (n.walking) {
        if (now - n.walking.t0 >= n.walking.dur) {
          n.x += n.walking.dx;
          n.y += n.walking.dy;
          n.walking = null;
          n.walkNext = now + 1800 + Math.random() * 3500;
        }
        continue;
      }
      if (now < n.walkNext) continue;
      // 次の方向を抽選（4方向＋止まる確率）
      const dirs = ['up','down','left','right'];
      // シャッフル
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }
      let started = false;
      for (const d of dirs) {
        const v = _dirVec(d);
        const tx = n.x + v.dx;
        const ty = n.y + v.dy;
        // 自宅範囲内か
        if (Math.abs(tx - n.homeX) > NPC_WALK_RADIUS) continue;
        if (Math.abs(ty - n.homeY) > NPC_WALK_RADIUS) continue;
        if (!isWalkable(tx, ty)) continue;
        if (npcAt(tx, ty)) continue;
        if (state.px === tx && state.py === ty) continue;
        // プレイヤー移動先とも衝突回避
        if (state.move) {
          const ptx = state.px + state.move.dx;
          const pty = state.py + state.move.dy;
          if (ptx === tx && pty === ty) continue;
        }
        n.dir = d;
        n.walking = { dx: v.dx, dy: v.dy, t0: now, dur: NPC_WALK_DUR };
        started = true;
        break;
      }
      if (!started) {
        // どこにも行けないなら少し待つ
        n.walkNext = now + 1200 + Math.random() * 1800;
      }
    }
  }

  // 押しっぱなし対応: 現在押されている方向（最後の1つを優先）
  const _heldDirs = new Set();
  let _fieldRaf = 0;
  const MOVE_DUR = 140; // タイル間補間の所要時間 ms

  function startFieldLoop() {
    if (_fieldRaf) return;
    function tick() {
      _fieldRaf = 0;
      if (state.scene !== 'field') return;
      const now = performance.now();
      tickNPCs(now);
      if (state.move) {
        const elapsed = now - state.move.t0;
        if (elapsed >= state.move.dur) {
          state.px += state.move.dx;
          state.py += state.move.dy;
          const finishedDx = state.move.dx;
          const finishedDy = state.move.dy;
          state.move = null;
          // 仲間2人の移動も同時にコミット
          if (state.followers) {
            state.followers.forEach(f => {
              if (f && f.move) {
                f.x += f.move.dx;
                f.y += f.move.dy;
                f.move = null;
              }
            });
          }
          onMoveComplete(finishedDx, finishedDy);
          // onMoveComplete might switch scene (battle); guard
          if (state.scene !== 'field') return;
        }
      }
      renderField();
      _fieldRaf = requestAnimationFrame(tick);
    }
    _fieldRaf = requestAnimationFrame(tick);
  }
  // 旧名互換
  function startMoveLoop() { startFieldLoop(); }

  function onMoveComplete(prevDx, prevDy) {
    audio.playSE('step');
    // 到達タイルがエンカウントなら戦闘へ
    const t = MAP[state.py][state.px];
    if (t === T.ENC && Math.random() < 0.16) {
      const tier = state.lv < 3
        ? { hp: 30, atk: 4, xp: 6, gold: 9 }
        : { hp: 50, atk: 6, xp: 9, gold: 14 };
      const names = ['通りすがりの市民', '陽気なおじさん', '頑固な老婦人', '若い学生'];
      const enemy = {
        type: 'citizen',
        name: names[Math.floor(Math.random() * names.length)],
        hp: tier.hp, maxHp: tier.hp,
        atk: tier.atk, xp: tier.xp, gold: tier.gold,
        paletteIdx: Math.floor(Math.random() * 4),
      };
      render();
      playEncounterAnim(() => startBattle(enemy));
      return;
    }
    render();
    // 押しっぱなしなら次のタイルへ続ける
    if (state.scene === 'field' && _heldDirs.size > 0) {
      // 直前と同じ方向を最優先（自然な歩き）
      const samePrev = (prevDx !== 0 || prevDy !== 0) && _heldDirs.has(_dirNameOf(prevDx, prevDy));
      const dirName = samePrev ? _dirNameOf(prevDx, prevDy) : Array.from(_heldDirs).pop();
      const dd = _dirVec(dirName);
      if (dd) tryMove(dd.dx, dd.dy, dirName);
    }
  }

  function _dirNameOf(dx, dy) {
    if (dx === -1) return 'left';
    if (dx === 1)  return 'right';
    if (dy === -1) return 'up';
    if (dy === 1)  return 'down';
    return null;
  }
  function _dirVec(name) {
    if (name === 'left')  return { dx: -1, dy: 0 };
    if (name === 'right') return { dx: 1,  dy: 0 };
    if (name === 'up')    return { dx: 0,  dy: -1 };
    if (name === 'down')  return { dx: 0,  dy: 1 };
    return null;
  }

  function tryMove(dx, dy, dir) {
    if (state.scene !== 'field') return;
    if (state.move) return; // 移動中は新規受付なし
    state.pdir = dir;
    const nx = state.px + dx;
    const ny = state.py + dy;
    if (!isWalkable(nx, ny)) { render(); return; }
    if (npcAt(nx, ny))       { render(); return; }
    const t0 = performance.now();
    state.move = { dx, dy, t0, dur: MOVE_DUR };
    // 仲間2人を「ヘビ列」追従させる（F1=旧リーダー位置, F2=旧F1位置）
    const f1 = state.followers && state.followers[0];
    const f2 = state.followers && state.followers[1];
    if (f1 && f2) {
      const oldLx = state.px, oldLy = state.py;
      const oldF1x = f1.x, oldF1y = f1.y;
      const newLx = state.px + dx, newLy = state.py + dy;
      const f1dx = oldLx - f1.x, f1dy = oldLy - f1.y;
      const f2dx = oldF1x - f2.x, f2dy = oldF1y - f2.y;
      if (f1dx !== 0 || f1dy !== 0) {
        f1.move = { dx: f1dx, dy: f1dy, t0, dur: MOVE_DUR };
        f1.dir = _dirNameOf(f1dx, f1dy) || f1.dir;
      } else {
        f1.move = null;
      }
      // F2の到達点がリーダーの到達点と被るとスタックするので（Uターン時）、その場合はF2は停止
      const f2TargetX = oldF1x, f2TargetY = oldF1y;
      if ((f2dx !== 0 || f2dy !== 0) && !(f2TargetX === newLx && f2TargetY === newLy)) {
        f2.move = { dx: f2dx, dy: f2dy, t0, dur: MOVE_DUR };
        f2.dir = _dirNameOf(f2dx, f2dy) || f2.dir;
      } else {
        f2.move = null;
      }
    }
    startMoveLoop();
  }

  function pressA() {
    if (state.scene === 'cutscene') return; // 自動歩行カットシーン中は入力無効
    if (state.scene === 'newgame') {
      audio.ensureCtx();
      audio.playSE('decide');
      // 名前入力中は「名前を決定」（緑のけっていボタンと同じ）。
      // 見た目選択・確認は従来どおりカーソル位置の決定（Enter）。
      if (state.titleStep && state.titleStep.startsWith('name')) {
        const ok = document.querySelector('#dialog [data-act="ok"]');
        if (ok) ok.click(); else dispatchSyntheticKey('Enter');
      } else {
        dispatchSyntheticKey('Enter');
      }
      return;
    }
    if (state.scene === 'title') return; // タイトルはダイアログ内ボタンで進める
    audio.ensureCtx();
    if (state.scene === 'buildingInfo') { closeBuildingInfo(); return; }
    if (state.scene === 'foodInfo') { closeFoodInfo(); return; }
    if (state.scene === 'overworld') { state.scene = 'field'; render(); return; }
    if (state.dialog.length > 0) { audio.playSE('decide'); advanceDialog(); return; }
    // 電車演出中はAボタンを無効化（駅員NPCに再度話しかけるのを防ぐ）
    if (state.scene === 'train') return;
    if (state.scene === 'boat') return;
    if (state.scene === 'credits') return; // クレジットはオーバーレイ側で処理
    if (state.scene === 'battle') {
      // メニュー中：選択中コマンドを決定
      if (state.battleStep === 'menu') { selectBattleAction(); return; }
      // 演出中：早送り
      if (skipBattleWait()) audio.playSE('decide');
      return;
    }

    const dx = state.pdir === 'left' ? -1 : state.pdir === 'right' ? 1 : 0;
    const dy = state.pdir === 'up'   ? -1 : state.pdir === 'down'  ? 1 : 0;
    const fx = state.px + dx;
    const fy = state.py + dy;
    const npc = NPCS.find(n => n.x === fx && n.y === fy && !(n.kind === 'guardian' && state.flags.guardian));
    if (npc) { audio.playSE('decide'); talkNPC(npc); return; }
    if (fx >= 0 && fx < MAP_COLS && fy >= 0 && fy < MAP_ROWS) {
      let t = MAP[fy][fx];
      let tx = fx, ty = fy;
      // ドアスルー：DOORの先に建物があればその建物として扱う
      if (t === T.DOOR) {
        const bx = fx + dx, by = fy + dy;
        if (bx >= 0 && bx < MAP_COLS && by >= 0 && by < MAP_ROWS) {
          const t2 = MAP[by][bx];
          if (BUILDING_INFO[t2] || t2 === T.INN || t2 === T.AKHALL ||
              t2 === T.RESTAURANT || t2 === T.SHOP || t2 === T.TOWNHALL) {
            t = t2; tx = bx; ty = by;
          }
        }
      }
      // 建物タイルなら詳細パネル（ゲディミナス塔は番人を倒すまで閉鎖）
      const lockedTower = (t === T.GEDIMINAS && !state.flags.guardian);
      // 機能タイル（宿屋・集会所・店等）は先にcheckLandmarkで処理（休む等のアクション優先）
      const functional = (t === T.INN || t === T.AKHALL || t === T.RESTAURANT || t === T.SHOP || t === T.TOWNHALL || t === T.STATION || t === T.CIURLIONIS || t === T.BOAT || t === T.SCULPTURE);
      if (functional && checkLandmark(t, tx, ty)) { audio.playSE('decide'); return; }
      if (BUILDING_INFO[t] && !lockedTower) { audio.playSE('decide'); openBuildingInfo(t, tx, ty); return; }
      if (checkLandmark(t, tx, ty)) { audio.playSE('decide'); return; }
    }
    setDialog('（…特に何もない。）');
  }
  function pressB() {
    if (state.scene === 'cutscene') return; // 自動歩行カットシーン中は入力無効
    audio.ensureCtx();
    if (state.scene === 'newgame') {
      audio.playSE('cancel');
      dispatchSyntheticKey('Backspace');
      return;
    }
    if (state.scene === 'buildingInfo') { audio.playSE('cancel'); closeBuildingInfo(); return; }
    if (state.scene === 'foodInfo') { audio.playSE('cancel'); closeFoodInfo(); return; }
    if (state.scene === 'overworld') { audio.playSE('cancel'); state.scene = 'field'; render(); return; }
    if (state.dialog.length > 0) {
      // 末尾でなければ末尾へ早送り、末尾なら閉じる動き
      if (state.dialogIdx < state.dialog.length - 1) {
        state.dialogIdx = state.dialog.length - 1;
        showDialog();
      }
      return;
    }
    if (state.scene === 'field') {
      audio.playSE('decide');
      openMenu();
    }
  }
  function openMenu() {
    setDialog(
      ['【メニュー】どうしますか？'],
      null,
      ['歌詞の記憶', 'リトアニア全体マップ', 'とじる'],
      (i) => {
        if (i === 0) showMemory();
        else if (i === 1) showOverworldMap();
        // else とじる：何もしない
      }
    );
  }

  // ============================================================
  // イベント登録
  // ============================================================
  // 仮想パッド: 押しっぱなし対応（pointerdown/pointerup）
  document.querySelectorAll('.pad').forEach(b => {
    const d = b.dataset.dir;
    if (!d) return;
    const dv = _dirVec(d);
    const DIR_TO_KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const press = (ev) => {
      ev.preventDefault();
      _heldDirs.add(d);
      if (state.scene === 'newgame') {
        // 名前入力中はオンスクリーン十字キーを無効化（ひらがなパネルの直接タップで入力する）。
        // 見た目選択（look）・確認（confirm）では十字キーで選択するので従来通り通す。
        if (state.titleStep && state.titleStep.startsWith('name')) return;
        audio.ensureCtx();
        dispatchSyntheticKey(DIR_TO_KEY[d]);
        return;
      }
      // 戦闘メニュー中：合成キー経由で moveBattleCursor → showBattleUI（カーソルを可視範囲へ自動スクロール）
      if (state.scene === 'battle' && state.battleStep === 'menu') {
        audio.ensureCtx();
        dispatchSyntheticKey(DIR_TO_KEY[d]);
        return;
      }
      if (state.scene === 'field' && !state.move && dv) tryMove(dv.dx, dv.dy, d);
    };
    const release = () => { _heldDirs.delete(d); };
    b.addEventListener('pointerdown', press);
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('pointerleave', release);
  });
  document.getElementById('btnA').addEventListener('click', pressA);
  document.getElementById('btnB').addEventListener('click', pressB);

  // ダイアログ枠タップ＝Aボタン（会話・戦闘ログの送り）
  // ※選択肢／戦闘アクションのボタンクリックがバブルしてA扱いになると次メッセージを飛ばすので除外
  document.getElementById('dialog').addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (state.dialog && state.dialog.length > 0) { pressA(); return; }
    if (state.scene === 'battle' && state.battleStep !== 'menu') { pressA(); return; }
  });

  // キャンバス・タップで方向移動
  // タップ位置とキャンバス中央の差分から上下左右を判定（カメラは主人公追従なので中央=主人公）
  (function setupCanvasTapMove() {
    const canvas = document.getElementById('screen');
    let canvasHeldDir = null;
    function dirFromEvent(ev) {
      const r = canvas.getBoundingClientRect();
      const x = ev.clientX - r.left - r.width / 2;
      const y = ev.clientY - r.top  - r.height / 2;
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return null; // 中央デッドゾーン
      if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
      return y < 0 ? 'up' : 'down';
    }
    function clearCanvasDir() {
      if (canvasHeldDir) { _heldDirs.delete(canvasHeldDir); canvasHeldDir = null; }
    }
    canvas.addEventListener('pointerdown', (ev) => {
      // 会話・戦闘・メニュー等では canvas タップは送り扱いにする
      if (state.dialog && state.dialog.length > 0) { ev.preventDefault(); pressA(); return; }
      if (state.scene !== 'field') return;
      ev.preventDefault();
      const d = dirFromEvent(ev);
      if (!d) return;
      clearCanvasDir();
      canvasHeldDir = d;
      _heldDirs.add(d);
      const dv = _dirVec(d);
      if (dv && !state.move) tryMove(dv.dx, dv.dy, d);
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!canvasHeldDir) return;
      const d = dirFromEvent(ev);
      if (!d || d === canvasHeldDir) return;
      _heldDirs.delete(canvasHeldDir);
      canvasHeldDir = d;
      _heldDirs.add(d);
    });
    canvas.addEventListener('pointerup', clearCanvasDir);
    canvas.addEventListener('pointercancel', clearCanvasDir);
    canvas.addEventListener('pointerleave', clearCanvasDir);
  })();
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','z','x','b',' ','Enter','1','2','3'].includes(e.key)) {
      e.preventDefault();
    }
    // タイトル画面のキーボード操作
    if (state.scene === 'title') {
      if (e.repeat) return;
      if (state.titleStep === 'tap') {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
          audio.ensureCtx();
          audio.playBGM('title');
          audio.playSE('decide');
          showTitleMenuPhase2();
        }
        return;
      }
      if (state.titleStep === 'menu') {
        const hasSaveData = hasSave();
        if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && hasSaveData) {
          state.titleSel = 0;
          audio.playSE('decide');
          showTitleMenuPhase2();
          return;
        }
        if ((e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') && hasSaveData) {
          state.titleSel = 1;
          audio.playSE('decide');
          showTitleMenuPhase2();
          return;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
          confirmTitleMenu();
          return;
        }
        return;
      }
    }
    // ニューゲーム（名前/見た目/確認）画面のキーボード操作
    if (state.scene === 'newgame') {
      const idx = (state.tmp && state.tmp.whoIdx) || 0;
      const isArrow = (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' ||
                       e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' ||
                       e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' ||
                       e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D');
      // 矢印は連打OK、それ以外は連打防止
      if (e.repeat && !isArrow) return;

      if (state.titleStep && state.titleStep.startsWith('name')) {
        if (state.tmp.kanaR == null) state.tmp.kanaR = 0;
        if (state.tmp.kanaC == null) state.tmp.kanaC = 0;
        // r==KANA.length は仮想行（けす/けっていボタン）。c=0:けす, c=1:けってい
        const ACTION_ROW = KANA.length;
        let r = state.tmp.kanaR, c = state.tmp.kanaC;
        const onAction = (r === ACTION_ROW);
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          if (onAction) {
            r = KANA.length - 1;
            if (c >= KANA[r].length) c = KANA[r].length - 1;
          } else {
            r -= 1;
            if (r < 0) { r = ACTION_ROW; if (c > 1) c = 1; }
            else if (c >= KANA[r].length) c = KANA[r].length - 1;
          }
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          if (onAction) {
            r = 0;
            if (c >= KANA[r].length) c = KANA[r].length - 1;
          } else {
            r += 1;
            if (r >= KANA.length) { r = ACTION_ROW; if (c > 1) c = 1; }
            else if (c >= KANA[r].length) c = KANA[r].length - 1;
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          if (onAction) {
            c = (c - 1 + 2) % 2;
          } else {
            c -= 1;
            if (c < 0) { r = (r - 1 + KANA.length) % KANA.length; c = KANA[r].length - 1; }
          }
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          if (onAction) {
            c = (c + 1) % 2;
          } else {
            c += 1;
            if (c >= KANA[r].length) { r = (r + 1) % KANA.length; c = 0; }
          }
        } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
          if (onAction) {
            if (c === 0) {
              state.tmp.names[idx] = state.tmp.names[idx].slice(0, -1);
              renderNewGameStep();
              return;
            } else {
              if (!state.tmp.names[idx]) { flashStatus('名前を入力してください'); return; }
              state.titleStep = 'look' + (idx + 1);
              state.tmp.lookIdx = PLAYER_LOOKS.findIndex(L => L.id === state.tmp.looks[idx]);
              if (state.tmp.lookIdx < 0) state.tmp.lookIdx = 0;
              state.tmp.kanaR = 0; state.tmp.kanaC = 0;
              renderNewGameStep();
              return;
            }
          }
          if (state.tmp.names[idx].length < 6) state.tmp.names[idx] += KANA[r][c];
          renderNewGameStep();
          return;
        } else if (e.key === 'Backspace' || e.key === 'x' || e.key === 'X') {
          state.tmp.names[idx] = state.tmp.names[idx].slice(0, -1);
          renderNewGameStep();
          return;
        } else if (e.key === '0') {
          if (!state.tmp.names[idx]) { flashStatus('名前を入力してください'); return; }
          state.titleStep = 'look' + (idx + 1);
          state.tmp.lookIdx = PLAYER_LOOKS.findIndex(L => L.id === state.tmp.looks[idx]);
          if (state.tmp.lookIdx < 0) state.tmp.lookIdx = 0;
          renderNewGameStep();
          return;
        } else {
          return;
        }
        state.tmp.kanaR = r; state.tmp.kanaC = c;
        renderNewGameStep();
        return;
      }
      if (state.titleStep && state.titleStep.startsWith('look')) {
        const COLS = 4;
        const total = PLAYER_LOOKS.length;
        if (state.tmp.lookIdx == null) {
          state.tmp.lookIdx = PLAYER_LOOKS.findIndex(L => L.id === state.tmp.looks[idx]);
          if (state.tmp.lookIdx < 0) state.tmp.lookIdx = 0;
        }
        let li = state.tmp.lookIdx;
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')        li = (li - COLS + total) % total;
        else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') li = (li + COLS) % total;
        else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') li = (li - 1 + total) % total;
        else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') li = (li + 1) % total;
        else if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
          state.tmp.looks[idx] = PLAYER_LOOKS[li].id;
          if (idx < 2) {
            state.tmp.whoIdx++;
            state.titleStep = 'name' + (state.tmp.whoIdx + 1);
            state.tmp.kanaR = 0; state.tmp.kanaC = 0;
          } else {
            state.titleStep = 'confirm';
            state.tmp.confirmSel = 1;
          }
          renderNewGameStep();
          return;
        } else {
          return;
        }
        state.tmp.lookIdx = li;
        state.tmp.looks[idx] = PLAYER_LOOKS[li].id;
        renderNewGameStep();
        return;
      }
      if (state.titleStep === 'confirm') {
        if (state.tmp.confirmSel == null) state.tmp.confirmSel = 1;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')        state.tmp.confirmSel = 0;
        else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')  state.tmp.confirmSel = 1;
        else if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
          if (state.tmp.confirmSel === 0) startNewGame();
          else finalizeNewGame();
          return;
        } else {
          return;
        }
        renderNewGameStep();
        return;
      }
      return;
    }
    // 数字キーで会話の選択肢を選ぶ
    if (state.dialog && state.dialog.length > 0 && state.choices &&
        state.dialogIdx >= state.dialog.length - 1) {
      if      (e.key === '1') { pickChoice(0); return; }
      else if (e.key === '2') { pickChoice(1); return; }
      else if (e.key === '3') { pickChoice(2); return; }
      else if (e.key === '4') { pickChoice(3); return; }
      else if (e.key === '5') { pickChoice(4); return; }
    }
    // 戦闘メニュー: 矢印キーで選択カーソル移動 / Enterで決定
    if (state.scene === 'battle' && state.battleStep === 'menu') {
      let dx = 0, dy = 0;
      if      (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') dy = -1;
      else if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') dy = 1;
      else if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') dx = -1;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 1;
      if (dx || dy) { moveBattleCursor(dx, dy); return; }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
        if (e.repeat) return;
        selectBattleAction();
        return;
      }
      // 戦闘メニュー中はそれ以外のキーは無視（フィールド移動を発動させない）
      return;
    }
    // フィールド: 矢印/WASD は押しっぱなしで連続移動
    let dirName = null;
    if      (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') dirName = 'up';
    else if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') dirName = 'down';
    else if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') dirName = 'left';
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dirName = 'right';
    if (dirName) {
      _heldDirs.add(dirName);
      if (state.scene === 'field' && !state.move) {
        const dv = _dirVec(dirName);
        tryMove(dv.dx, dv.dy, dirName);
      }
      return;
    }
    if (e.repeat) return; // A/Bの連打防止
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter' || e.key === ' ') pressA();
    if (e.key === 'x' || e.key === 'X' || e.key === 'b' || e.key === 'B' || e.key === 'Escape') pressB();
  });
  window.addEventListener('keyup', (e) => {
    if      (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') _heldDirs.delete('up');
    else if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') _heldDirs.delete('down');
    else if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') _heldDirs.delete('left');
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') _heldDirs.delete('right');
  });
  // フォーカスを失ったら全方向リリース（押しっぱなし状態固定の防止）
  window.addEventListener('blur', () => { _heldDirs.clear(); });

  // バックグラウンド時はBGMを停止（スマホでタブ切替後も鳴り続ける問題への対策）
  // requestAnimationFrame はブラウザが自動で停止するためゲーム本体は実質ポーズ状態。
  // 復帰時は当時鳴っていたBGMキーを再生し直す。
  let _pausedBGMKey = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _heldDirs.clear();
      if (audio.bgmKey) {
        _pausedBGMKey = audio.bgmKey;
        audio.stopBGM();
      }
      if (audio.actx && audio.actx.state === 'running') {
        try { audio.actx.suspend(); } catch (e) {}
      }
    } else {
      // iOS Safari では割り込み中に「見張り役オシレータ」が破棄される場合があるため、
      // 復帰時はリセットして ensureCtx で作り直させる（無いと以降のオシレータが無音化する）
      if (audio._aliveOsc) {
        try { audio._aliveOsc.stop(); } catch (e) {}
        audio._aliveOsc = null;
      }
      if (audio.actx && (audio.actx.state === 'suspended' || audio.actx.state === 'interrupted')) {
        try { audio.actx.resume(); } catch (e) {}
      }
      // ensureCtx() を明示的に呼んで _aliveOsc を再構築（resume完了前でも予約される）
      if (audio.actx) audio.ensureCtx();
      if (_pausedBGMKey) {
        const key = _pausedBGMKey;
        _pausedBGMKey = null;
        audio.playBGM(key);
      }
    }
  });

  // ============================================================
  // 起動
  // ============================================================
  showTitleMenu();

})();
