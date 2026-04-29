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
    RESTAURANT:15, SHOP:16, TOWNHALL:17
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
  ];
  const lookById = (id) => LOOKS.find(l => l.id === id) || LOOKS[0];

  // ============================================================
  // マップデータ（ヴィリニュス実物寄せ再配置）
  //  北: 大聖堂広場＋ゲディミナス塔（ネリス川が北を流れる）
  //  中央: 旧市庁舎広場＋マンタスのリトアニア料理店
  //  西: AKクワイア集会所＋みほさんの宿屋
  //  東: 聖アンナ教会
  //  南: 夜明けの門
  // ============================================================
  const MAP = (() => {
    const m = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(T.GRASS));

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
    // 大聖堂を3x3で配置(11,5..13,7)、入口は(12,8)
    for (let y = 5; y <= 7; y++) for (let x = 11; x <= 13; x++) m[y][x] = T.CATHEDRAL;
    m[8][12] = T.DOOR;
    // 広場（草地）
    for (let y = 6; y <= 9; y++) for (let x = 8; x <= 18; x++) {
      if (m[y][x] === T.GRASS) m[y][x] = T.FLOWER; // 花畑
    }
    // ゲディミナス塔（大聖堂の東の丘 16,5）
    m[5][16] = T.GEDIMINAS;
    m[6][16] = T.WALL;
    m[5][15] = T.TREE; m[6][15] = T.TREE; m[5][17] = T.TREE; m[6][17] = T.TREE;

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
    // 旧市庁舎（中央 12,11..14,12）
    m[11][12] = T.WALL; m[11][13] = T.WALL; m[11][14] = T.WALL;
    m[12][12] = T.WALL; m[12][13] = T.TOWNHALL; m[12][14] = T.WALL;

    // マンタスの店（中央広場の北東 17,11..18,12）
    m[11][17] = T.WALL; m[11][18] = T.WALL;
    m[12][17] = T.RESTAURANT; m[12][18] = T.WALL;

    // 雑貨屋（中央広場の北西 8,11..9,12）
    m[11][8] = T.WALL; m[11][9] = T.WALL;
    m[12][8] = T.SHOP; m[12][9] = T.WALL;

    // 西側エリア（AKクワイア集会所＋宿屋 y=15-19）
    // 集会所（5,16..7,18）
    for (let y = 16; y <= 18; y++) for (let x = 5; x <= 7; x++) m[y][x] = T.WALL;
    m[17][6] = T.AKHALL;

    // 宿屋（みほさんの宿、9,16..11,18）
    for (let y = 16; y <= 18; y++) for (let x = 9; x <= 11; x++) m[y][x] = T.WALL;
    m[17][10] = T.INN;

    // 東側エリア（聖アンナ教会 22,16..24,18）
    for (let y = 16; y <= 18; y++) for (let x = 22; x <= 24; x++) m[y][x] = T.ANNE;
    m[19][23] = T.DOOR; // 教会前

    // 南北の中央道（広場から夜明けの門へ）
    for (let y = 15; y <= 28; y++) m[y][14] = T.ROAD;

    // 南北道の左右に旧市街の家
    m[20][10] = T.WALL; m[20][11] = T.WALL; m[21][10] = T.DOOR;
    m[20][17] = T.WALL; m[20][18] = T.WALL; m[21][18] = T.DOOR;
    m[24][10] = T.WALL; m[24][11] = T.WALL; m[25][10] = T.DOOR;
    m[24][17] = T.WALL; m[24][18] = T.WALL; m[25][18] = T.DOOR;

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

    return m;
  })();

  // ============================================================
  // NPC配置（キーパーソン込み）
  // ============================================================
  const NPCS = [
    // AKクワイア主催（固有キャラ：仲間2人とは別人）
    { x: 7, y: 17, name: 'あきちゃん',  kind: 'akihiro', look: 'm3', hint: null },
    { x: 11, y: 17, name: 'みほさん',    kind: 'miho',    look: 'f5', hint: null },
    // リトアニア人キーパーソン
    { x: 17, y: 13, name: 'マンタス',    kind: 'mantas',  look: 'm4', hint: 'aciu'  },
    { x: 22, y: 13, name: 'イエヴァ',    kind: 'ieva',    look: 'f1', hint: 'kaip'  },
    // ヴィリニュス市民
    { x: 12, y: 9,  name: '司祭',        kind: 'priest',  look: 'm2', hint: 'labas' },
    { x: 8,  y: 13, name: '雑貨屋',      kind: 'shop',    look: 'f3', hint: 'aciu'  },
    { x: 18, y: 19, name: '吟遊詩人',    kind: 'bard',    look: 'm3', hint: 'kaip'  },
    { x: 14, y: 21, name: '子ども',      kind: 'child',   look: 'f7', hint: 'labas' },
    { x: 23, y: 19, name: 'おばあさん',  kind: 'elder',   look: 'f6', hint: 'aciu'  },
    // 塔の番人
    { x: 16, y: 7,  name: '塔の番人',    kind: 'guardian', look: 'm2', hint: null },
  ];

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
      px: 14, py: 19, pdir: 'down',
      lv: 1, xp: 0, gold: 30, nextXp: 8,
      pieces: 0,
      flags: { guardian: false, child: false, shop: false, bard: false, mantas: false, ieva: false },
      dialog: [], dialogIdx: 0,
      choices: null, onChoice: null, afterDialog: null,
      enemy: null, battleLog: '', battleStep: 'menu', battleSel: 0,
      buff: 0, // エホーマイ残ターン
      songCounter: 0,
    };
  }
  let state = initialState();

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
      state.scene = 'field';
      return true;
    } catch (e) { return false; }
  }
  function hasSave() { return !!localStorage.getItem(SAVE_KEY); }

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

  function drawTile(t, sx, sy) {
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
      // 大聖堂（白い列柱、ドーム頂上に十字）
      rect(sx, sy, TILE, TILE, '#e8e0d0');
      ctx.fillStyle = '#b0a890';
      ctx.fillRect(sx, sy + TILE - 4, TILE, 4);
      ctx.fillStyle = '#c8c0a8';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(sx + 4 + i * 9, sy + 8, 4, TILE - 14);
      }
      ctx.fillStyle = '#6a3a1a';
      ctx.fillRect(sx, sy, TILE, 3);
      // 中央ドーム＋十字（マップ上の中央列のタイルだけ装飾）
      ctx.fillStyle = '#c8a070';
      ctx.fillRect(sx + 12, sy + 4, 8, 4);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 15, sy - 2, 2, 5);
      ctx.fillRect(sx + 14, sy - 1, 4, 1);
    } else if (t === T.INN) {
      // 宿屋入口（赤屋根＋ベッド看板）
      rect(sx, sy, TILE, TILE, '#aa3030');
      // 屋根の段差
      ctx.fillStyle = '#882020';
      ctx.fillRect(sx, sy + 2, TILE, 1);
      ctx.fillRect(sx, sy + 6, TILE, 1);
      ctx.fillRect(sx, sy + 10, TILE, 1);
      // 壁＋ドア
      rect(sx + 4, sy + 12, 24, 20, '#c8a878');
      rect(sx + 12, sy + 18, 8, 14, '#3a2a1a');
      ctx.fillStyle = '#dac030'; ctx.fillRect(sx + 19, sy + 25, 1, 2);
      // 看板（白地にベッド絵）
      rect(sx + 5, sy + 13, 22, 7, '#fff8e0');
      ctx.strokeStyle = '#6a3a1a'; ctx.lineWidth = 1;
      ctx.strokeRect(sx + 5, sy + 13, 22, 7);
      // ベッド絵
      ctx.fillStyle = '#3a4abe'; ctx.fillRect(sx + 8,  sy + 16, 16, 3);
      ctx.fillStyle = '#fff';    ctx.fillRect(sx + 9,  sy + 15, 6, 2);
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(sx + 8,  sy + 18, 1, 2);
      ctx.fillRect(sx + 23, sy + 18, 1, 2);
    } else if (t === T.AKHALL) {
      // AKクワイア集会所（青屋根＋音符看板）
      rect(sx, sy, TILE, TILE, '#3a4abe');
      ctx.fillStyle = '#2a3a8e';
      ctx.fillRect(sx, sy + 2, TILE, 1);
      ctx.fillRect(sx, sy + 6, TILE, 1);
      ctx.fillRect(sx, sy + 10, TILE, 1);
      // 壁＋ドア
      rect(sx + 4, sy + 12, 24, 20, '#c8a878');
      rect(sx + 12, sy + 18, 8, 14, '#3a2a1a');
      ctx.fillStyle = '#dac030'; ctx.fillRect(sx + 19, sy + 25, 1, 2);
      // 看板
      rect(sx + 5, sy + 13, 22, 7, '#fff8e0');
      ctx.strokeStyle = '#6a3a1a'; ctx.lineWidth = 1;
      ctx.strokeRect(sx + 5, sy + 13, 22, 7);
      // 音符（八分音符×2）
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 9,  sy + 14, 1, 5);
      ctx.beginPath(); ctx.arc(sx + 9,  sy + 19, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(sx + 14, sy + 14, 1, 5);
      ctx.beginPath(); ctx.arc(sx + 14, sy + 19, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(sx + 9, sy + 14, 6, 1); // 連桁
      ctx.fillRect(sx + 19, sy + 14, 1, 5);
      ctx.beginPath(); ctx.arc(sx + 19, sy + 19, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (t === T.BRIDGE) {
      rect(sx, sy, TILE, TILE, '#3a6abe');
      rect(sx + 2, sy + 8, TILE - 4, TILE - 16, '#a88858');
      ctx.fillStyle = '#6a3a1a';
      for (let i = 0; i < 4; i++) ctx.fillRect(sx + 4 + i * 7, sy + 10, 2, TILE - 20);
    } else if (t === T.RESTAURANT) {
      // 料理屋（緑屋根＋フォーク&ナイフ看板）
      rect(sx, sy, TILE, TILE, '#3a8a4a');
      rect(sx + 4, sy + 12, 24, 20, '#8a4a2a');
      rect(sx + 12, sy + 16, 8, 16, '#3a2a1a'); // ドア
      ctx.fillStyle = '#dac030'; ctx.fillRect(sx + 19, sy + 24, 1, 2); // ノブ
      // 看板（白地に料理アイコン）
      rect(sx + 4, sy + 4, 24, 8, '#fff8e0');
      rect(sx + 4, sy + 4, 24, 1, '#6a3a1a');
      rect(sx + 4, sy + 11, 24, 1, '#6a3a1a');
      // ナイフ
      ctx.fillStyle = '#888';     ctx.fillRect(sx + 9,  sy + 6, 2, 4);
      ctx.fillStyle = '#3a2a1a';  ctx.fillRect(sx + 9,  sy + 9, 2, 1);
      // フォーク
      ctx.fillStyle = '#888';     ctx.fillRect(sx + 21, sy + 6, 2, 4);
      ctx.fillRect(sx + 19, sy + 5, 1, 2); ctx.fillRect(sx + 23, sy + 5, 1, 2);
    } else if (t === T.SHOP) {
      // 雑貨屋（黄屋根＋コイン看板）
      rect(sx, sy, TILE, TILE, '#dac030');
      rect(sx + 4, sy + 12, 24, 20, '#8a4a2a');
      rect(sx + 12, sy + 16, 8, 16, '#3a2a1a');
      ctx.fillStyle = '#dac030'; ctx.fillRect(sx + 19, sy + 24, 1, 2);
      // 看板
      rect(sx + 4, sy + 4, 24, 8, '#fff8e0');
      rect(sx + 4, sy + 4, 24, 1, '#6a3a1a');
      rect(sx + 4, sy + 11, 24, 1, '#6a3a1a');
      // コイン
      ctx.fillStyle = '#dac030';
      ctx.beginPath(); ctx.arc(sx + 12, sy + 8, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + 20, sy + 8, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8a6a10';
      ctx.fillRect(sx + 11, sy + 8, 3, 1);
      ctx.fillRect(sx + 19, sy + 8, 3, 1);
    } else if (t === T.TOWNHALL) {
      // 旧市庁舎（白い壁＋三色旗）
      rect(sx, sy, TILE, TILE, '#e8e0d0');
      rect(sx + 2, sy + 14, TILE - 4, TILE - 14, '#e0d8c0');
      // 大きな扉
      rect(sx + 11, sy + 14, 10, 18, '#3a2a1a');
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 19, sy + 22, 1, 2);
      // 列柱
      ctx.fillStyle = '#a89878';
      ctx.fillRect(sx + 4, sy + 16, 3, 16);
      ctx.fillRect(sx + 25, sy + 16, 3, 16);
      // 三色旗（上部）
      ctx.fillStyle = '#6a3a1a'; ctx.fillRect(sx + 15, sy, 2, 14); // ポール
      ctx.fillStyle = '#dac030'; ctx.fillRect(sx + 17, sy + 1, 8, 2);
      ctx.fillStyle = '#3aae5a'; ctx.fillRect(sx + 17, sy + 3, 8, 2);
      ctx.fillStyle = '#c83030'; ctx.fillRect(sx + 17, sy + 5, 8, 2);
      // 屋根
      ctx.fillStyle = '#6a3a1a';
      ctx.fillRect(sx, sy + 12, TILE, 2);
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

  // FFV風チビキャラ描画（32×32、2.5頭身、アウトラインつき）
  // 設計:
  //   y= 0-14: 頭（髪+顔）— タイル上半分
  //   y=15-23: 胴体+腕
  //   y=24-29: 脚+靴
  // sx,sy = 32x32タイル左上
  function drawCharDetailed(c, sx, sy, dir, look) {
    const L = lookById(look);
    const O = '#1a0a14';
    const skin   = L.skin;
    const skinD  = darken(L.skin, 0.78);
    const skinH  = lighten(L.skin, 1.08);
    const hair   = L.hair;
    const hairD  = darken(L.hair, 0.6);
    const hairH  = lighten(L.hair, 1.3);
    const cloth  = L.cloth;
    const clothD = darken(L.cloth, 0.6);
    const clothH = lighten(L.cloth, 1.3);
    const pants  = '#3a2820';
    const pantsD = '#1a1008';
    const boot   = '#2a1810';
    const bootH  = '#5a3820';

    function r(x, y, w, h, col) { c.fillStyle = col; c.fillRect(sx + x, sy + y, w, h); }
    function p(x, y, col)       { c.fillStyle = col; c.fillRect(sx + x, sy + y, 1, 1); }

    // 影（地面）
    r(7, 30, 18, 2, 'rgba(0,0,0,0.35)');

    // ============ 髪・頭の輪郭（後ろ髪→顔→前髪 の順で重ね描き） ============
    // 後ろ髪（longHair時）
    if (L.longHair) {
      r(5, 4, 22, 18, O);              // 輪郭（広め）
      r(6, 5, 20, 16, hair);           // 髪本体
      r(6, 18, 20, 1, hairD);          // 影
    }

    // ============ 頭の輪郭（アウトライン） ============
    // 頭全体のシルエットをアウトラインで描く（角丸風）
    r(8, 1,  16, 1, O);
    r(7, 2,  18, 1, O);
    r(6, 3,  20, 1, O);
    r(5, 4,  22, 1, O);
    r(5, 5,   1, 9, O); r(26, 5,  1, 9, O);   // 側面
    r(6, 14,  1, 1, O); r(25, 14, 1, 1, O);   // 顎角
    r(7, 15, 18, 1, O);                       // 顎下

    // ============ 顔（肌） ============
    r(7, 4, 18, 11, skin);            // 顔ベース（広め、上から髪で塗る）
    r(8, 14, 16, 1, skin);            // 顎ライン
    // 顔の影（左半分）
    r(7, 13, 18, 1, skinD);

    // ============ 髪（前髪・トップ） ============
    if (L.longHair) {
      // 前髪（眉上まで覆う）
      r(7, 4, 18, 4, hair);
      r(7, 8,  4, 4, hair);            // 左サイド
      r(21, 8, 4, 4, hair);            // 右サイド
      // ハイライト
      r(10, 5, 6, 1, hairH);
    } else if (L.ponytail) {
      // 前髪（M字）
      r(7, 4, 18, 3, hair);
      r(7, 7,  4, 2, hair);
      r(21, 7, 4, 2, hair);
      // 後ろの結い目＋ポニー（横向きに少し見える）
      r(24, 7, 3, 3, O);
      r(25, 8, 1, 1, hair);
      r(26, 9,  1, 11, O);
      r(27, 10, 1,  9, hair);
      r(27, 18, 1,  1, hairD);
      // ハイライト
      r(11, 5, 6, 1, hairH);
    } else {
      // 短髪（前髪あり）
      r(7, 4, 18, 4, hair);            // 前髪面
      r(7, 8,  3, 2, hair);            // 左もみあげ
      r(22, 8, 3, 2, hair);            // 右もみあげ
      // ハイライト
      r(10, 5, 4, 1, hairH);
      r(18, 5, 4, 1, hairH);
    }

    // ============ 耳（顔の横、髪の下） ============
    p(6, 10, skin);  p(6, 11, skin);
    p(25, 10, skin); p(25, 11, skin);
    p(6, 12, skinD); p(25, 12, skinD);

    // ============ 目（大きめ。FFV風の白目+黒目） ============
    // 向きごとに位置調整
    if (dir === 'down') {
      // 左目
      r(10, 9, 4, 4, '#fff');
      r(10, 9, 4, 1, O);
      r(10, 12, 4, 1, O);
      r(10, 9, 1, 4, O); r(13, 9, 1, 4, O);
      r(11, 10, 2, 2, O);                 // 黒目
      p(12, 10, '#fff');                  // ハイライト
      // 右目
      r(18, 9, 4, 4, '#fff');
      r(18, 9, 4, 1, O);
      r(18, 12, 4, 1, O);
      r(18, 9, 1, 4, O); r(21, 9, 1, 4, O);
      r(19, 10, 2, 2, O);
      p(20, 10, '#fff');
    } else if (dir === 'up') {
      // 後頭部側 — 髪を下まで延長
      r(7, 9, 18, 5, hair);
      r(7, 9, 18, 1, hairD);
    } else if (dir === 'left') {
      r(9, 9, 4, 4, '#fff');
      r(9, 9, 4, 1, O); r(9, 12, 4, 1, O);
      r(9, 9, 1, 4, O); r(12, 9, 1, 4, O);
      r(9, 10, 2, 2, O);
      p(10, 10, '#fff');
    } else { // right
      r(19, 9, 4, 4, '#fff');
      r(19, 9, 4, 1, O); r(19, 12, 4, 1, O);
      r(19, 9, 1, 4, O); r(22, 9, 1, 4, O);
      r(20, 10, 2, 2, O);
      p(21, 10, '#fff');
    }

    // ============ 眉 ============
    if (dir === 'down') {
      r(10, 8,  4, 1, hairD);
      r(18, 8,  4, 1, hairD);
    } else if (dir === 'left') {
      r(9, 8, 4, 1, hairD);
    } else if (dir === 'right') {
      r(19, 8, 4, 1, hairD);
    }

    // ============ 口 ============
    if (dir === 'down') {
      r(14, 13, 4, 1, '#a02030');
      p(14, 13, O); p(17, 13, O);
    } else if (dir === 'left') {
      r(11, 13, 3, 1, '#a02030');
    } else if (dir === 'right') {
      r(18, 13, 3, 1, '#a02030');
    }

    // ============ 頬の赤み ============
    if (dir === 'down') {
      r(8, 11, 2, 2, 'rgba(230,100,110,0.45)');
      r(22, 11, 2, 2, 'rgba(230,100,110,0.45)');
    }

    // ============ 眼鏡 ============
    if (L.glasses && dir === 'down') {
      r(10, 9, 4, 1, O); r(10, 12, 4, 1, O);
      r(10, 9, 1, 4, O); r(13, 9, 1, 4, O);
      r(18, 9, 4, 1, O); r(18, 12, 4, 1, O);
      r(18, 9, 1, 4, O); r(21, 9, 1, 4, O);
      r(14, 10, 4, 1, O);                  // ブリッジ
      r(11, 10, 2, 2, '#bfdfff');          // レンズ反射
      r(19, 10, 2, 2, '#bfdfff');
      r(11, 10, 2, 2, 'rgba(255,255,255,0.3)');
    }

    // ============ 首 ============
    r(13, 15, 6, 1, skinD);

    // ============ 胴体（服） ============
    // アウトライン（肩〜腰）
    r(7, 16, 18, 1, O);
    r(6, 17, 1,  6, O); r(25, 17, 1, 6, O);
    r(7, 23, 18, 1, O);
    // 服本体
    r(7, 17, 18, 6, cloth);
    // シェード（左下）
    r(7, 22, 18, 1, clothD);
    r(7, 17, 1,  6, clothD);
    // ハイライト（右肩）
    r(8, 17, 6, 1, clothH);
    // 襟（首元）
    r(13, 16, 6, 2, '#fff8e0');
    r(14, 17, 4, 1, clothD);
    p(13, 16, O); p(18, 16, O);
    p(13, 17, O); p(18, 17, O);
    // ボタン
    p(15, 19, '#dac030'); p(15, 21, '#dac030');

    // ============ 腕 ============
    // 左腕
    r(4, 17, 1, 6, O); r(7, 17, 1, 6, O);
    r(4, 23, 4, 1, O);
    r(5, 17, 2, 6, cloth);
    r(5, 22, 2, 1, clothD);
    // 手
    r(5, 21, 2, 2, skin);
    r(4, 21, 1, 2, O);
    // 右腕
    r(24, 17, 1, 6, O); r(27, 17, 1, 6, O);
    r(24, 23, 4, 1, O);
    r(25, 17, 2, 6, cloth);
    r(25, 22, 2, 1, clothD);
    r(25, 21, 2, 2, skin);
    r(27, 21, 1, 2, O);

    // ============ 脚（ズボン） ============
    // 左脚
    r(8, 24, 1, 5, O); r(13, 24, 1, 5, O);
    r(8, 28, 6, 1, O);
    r(9, 24, 4, 4, pants);
    r(9, 28, 4, 1, pantsD);
    // 右脚
    r(18, 24, 1, 5, O); r(23, 24, 1, 5, O);
    r(18, 28, 6, 1, O);
    r(19, 24, 4, 4, pants);
    r(19, 28, 4, 1, pantsD);

    // ============ 靴 ============
    // 左
    r(7, 27, 1, 3, O); r(14, 27, 1, 3, O);
    r(7, 30, 8, 1, O);
    r(8, 28, 6, 2, boot);
    r(8, 28, 6, 1, bootH);
    // 右
    r(17, 27, 1, 3, O); r(24, 27, 1, 3, O);
    r(17, 30, 8, 1, O);
    r(18, 28, 6, 2, boot);
    r(18, 28, 6, 1, bootH);
  }

  function drawChar(sx, sy, dir, look) { drawCharDetailed(ctx, sx, sy, dir, look); }

  function drawEnemy(sx, sy, type) {
    if (type === 'guardian') {
      rect(sx + 30, sy + 50, 60, 60, '#3a3a3a');
      rect(sx + 35, sy + 30, 50, 30, '#888');
      ctx.fillStyle = '#aa3030';
      ctx.fillRect(sx + 45, sy + 38, 3, 5);
      ctx.fillRect(sx + 72, sy + 38, 3, 5);
      rect(sx + 55, sy + 50, 10, 15, '#3a3a3a');
      rect(sx + 15, sy + 55, 15, 40, '#3a3a3a');
      rect(sx + 90, sy + 55, 15, 40, '#3a3a3a');
      rect(sx + 25, sy + 90, 18, 20, '#3a2a1a');
      rect(sx + 77, sy + 90, 18, 20, '#3a2a1a');
    } else {
      const pal = ['#c83030', '#3aae6a', '#3a8abe', '#dac030'][state.songCounter % 4];
      rect(sx + 35, sy + 55, 50, 50, pal);
      rect(sx + 40, sy + 25, 40, 35, '#f0c89a');
      rect(sx + 38, sy + 20, 44, 12, '#5a3a1a');
      ctx.fillStyle = '#000';
      ctx.fillRect(sx + 50, sy + 38, 3, 5);
      ctx.fillRect(sx + 68, sy + 38, 3, 5);
      ctx.fillRect(sx + 55, sy + 50, 12, 2);
      rect(sx + 25, sy + 60, 12, 30, '#f0c89a');
      rect(sx + 85, sy + 60, 12, 30, '#f0c89a');
      rect(sx + 45, sy + 95, 15, 15, '#3a2a1a');
      rect(sx + 62, sy + 95, 15, 15, '#3a2a1a');
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
    ctx.textAlign = 'left';
  }

  function showTitleMenu() {
    state.scene = 'title';
    state.titleStep = 'menu';
    renderTitle();
    const d = document.getElementById('dialog');
    let html = '<div style="font-size:13px;margin-bottom:8px;text-align:center;">メニュー</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    html += '<button data-act="new" class="title-btn" style="padding:10px;background:#222;border:1px solid #555;border-radius:6px;color:#fff;cursor:pointer;">▶ はじめから</button>';
    if (hasSave()) {
      html += '<button data-act="cont" class="title-btn" style="padding:10px;background:#222;border:1px solid #dac030;border-radius:6px;color:#dac030;cursor:pointer;">▶ つづきから</button>';
    } else {
      html += '<button disabled style="padding:10px;background:#111;border:1px solid #333;border-radius:6px;color:#555;">  つづきから（セーブなし）</button>';
    }
    html += '</div>';
    d.innerHTML = html;
    d.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.act === 'cont') {
          if (loadGame()) { renderAndUpdate(); openingResume(); }
        } else {
          startNewGame();
        }
      });
    });
  }

  function startNewGame() {
    state = initialState();
    state.scene = 'newgame';
    state.titleStep = 'name1';
    state.tmp = { names: ['', '', ''], looks: ['m1', 'f5', 'm4'], whoIdx: 0 };
    renderNewGameStep();
  }

  function renderNewGameStep() {
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
      const cx = CANVAS_W / 2 - TILE;
      const cy = 130;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // テンポラリ・キャンバスに描いて2倍拡大
      const tmp = document.createElement('canvas');
      tmp.width = TILE; tmp.height = TILE;
      const tctx = tmp.getContext('2d');
      const orig = ctx;
      // 一時的にctxを切り替え
      window.__tmpctx = ctx;
      // drawCharは外側のctxを使うので、手書きで描く
      ctx.restore();
      drawCharOnCtx(tctx, 0, 0, 'down', state.tmp.looks[idx]);
      ctx.drawImage(tmp, cx, cy, TILE * 2, TILE * 2);
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
      html += '<div style="font-size:12px;margin-bottom:6px;color:#aaa;">名前（最大6文字）</div>';
      html += `<div style="font-size:14px;margin-bottom:8px;background:#222;padding:6px 10px;border-radius:4px;min-height:22px;">${state.tmp.names[idx] || ''}<span style="color:#888;">_</span></div>`;
      html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;font-size:13px;">';
      KANA.forEach(row => {
        for (const ch of row) {
          html += `<button data-kana="${ch}" style="padding:6px 0;background:#222;border:1px solid #555;border-radius:4px;color:#fff;cursor:pointer;">${ch}</button>`;
        }
      });
      html += '</div>';
      html += '<div style="display:flex;gap:6px;margin-top:6px;">';
      html += '<button data-act="bs" style="flex:1;padding:8px;background:#aa3030;border:0;border-radius:4px;color:#fff;cursor:pointer;">けす</button>';
      html += '<button data-act="ok" style="flex:2;padding:8px;background:#3aae5a;border:0;border-radius:4px;color:#fff;cursor:pointer;">けってい</button>';
      html += '</div>';
    } else if (state.titleStep.startsWith('look')) {
      html += '<div style="font-size:12px;margin-bottom:6px;color:#aaa;">12種類から見た目をえらぶ</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">';
      LOOKS.forEach(L => {
        const sel = L.id === state.tmp.looks[idx];
        html += `<button data-look="${L.id}" style="padding:4px;background:${sel ? '#dac030' : '#222'};color:${sel ? '#000' : '#fff'};border:1px solid #555;border-radius:4px;font-size:11px;cursor:pointer;">${L.id}<br>${L.sex === 'm' ? '♂' : '♀'}</button>`;
      });
      html += '</div>';
      html += `<div style="margin-top:6px;font-size:11px;color:#aaa;">選択中: ${lookById(state.tmp.looks[idx]).name}</div>`;
      html += '<button data-act="ok" style="margin-top:8px;width:100%;padding:8px;background:#3aae5a;border:0;border-radius:4px;color:#fff;cursor:pointer;">この見た目で決定</button>';
    } else if (state.titleStep === 'confirm') {
      html += '<div style="font-size:13px;margin-bottom:8px;">この3人で旅立ちますか？</div>';
      for (let i = 0; i < 3; i++) {
        html += `<div style="margin:4px 0;font-size:13px;">${['主人公','仲間1','仲間2'][i]}: <b>${state.tmp.names[i]}</b>（${lookById(state.tmp.looks[i]).name}）</div>`;
      }
      html += '<div style="display:flex;gap:6px;margin-top:8px;">';
      html += '<button data-act="back" style="flex:1;padding:8px;background:#555;border:0;border-radius:4px;color:#fff;cursor:pointer;">最初から</button>';
      html += '<button data-act="go" style="flex:2;padding:8px;background:#dac030;border:0;border-radius:4px;color:#000;font-weight:bold;cursor:pointer;">旅立つ！</button>';
      html += '</div>';
    }

    d.innerHTML = html;
    bindNewGameUI();
  }

  function bindNewGameUI() {
    const d = document.getElementById('dialog');
    const idx = state.tmp.whoIdx;

    d.querySelectorAll('[data-kana]').forEach(b => {
      b.addEventListener('click', () => {
        if (state.tmp.names[idx].length >= 6) return;
        state.tmp.names[idx] += b.dataset.kana;
        renderNewGameStep();
      });
    });
    d.querySelectorAll('[data-look]').forEach(b => {
      b.addEventListener('click', () => {
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
            renderNewGameStep();
          } else {
            // look確定 → 次の人 or 確認画面
            if (idx < 2) {
              state.tmp.whoIdx++;
              state.titleStep = 'name' + (state.tmp.whoIdx + 1);
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
    state.scene = 'field';
    saveGame();
    setDialog([
      'あなたは AKクワイア のメンバーとして、',
      'リトアニア音楽の祭典「ダイヌシュベンテ」で歌うため、',
      'はるばる ヴィリニュス にやってきた。',
      'ところが——歌詞をすっかり忘れてしまった！',
      'リトアニア国内に散らばった歌詞のピースを集めて、祭典で歌い上げよう。',
      '（緑の草むらでは戦闘あり。Aで人と話す／観光名所を調べる）',
      '（西の建物（赤屋根♪）はみほさんの宿屋。HP/MP回復＋セーブ）',
    ]);
  }

  function openingResume() {
    setDialog([`おかえりなさい、${state.party[0].name}！ 旅をつづけよう。`]);
  }

  // ============================================================
  // フィールド描画
  // ============================================================
  function renderField() {
    clear('#000');
    const { cx, cy } = getCamera();
    for (let y = 0; y < VIEW_ROWS; y++) {
      for (let x = 0; x < VIEW_COLS; x++) {
        const mx = cx + x;
        const my = cy + y;
        if (mx < 0 || mx >= MAP_COLS || my < 0 || my >= MAP_ROWS) continue;
        drawTile(MAP[my][mx], x * TILE, y * TILE);
      }
    }
    NPCS.forEach(n => {
      if (n.kind === 'guardian' && state.flags.guardian) return;
      const sx = (n.x - cx) * TILE;
      const sy = (n.y - cy) * TILE;
      if (sx < -TILE || sx >= CANVAS_W || sy < -TILE || sy >= CANVAS_H) return;
      drawChar(sx, sy, 'down', n.look);
    });
    drawChar((state.px - cx) * TILE, (state.py - cy) * TILE, state.pdir, state.party[0].look);
  }

  function renderBattle() {
    clear('#1a1a2a');
    // 敵側の背景（夜空）
    ctx.fillStyle = '#2a3a5a';
    ctx.fillRect(0, 0, CANVAS_W, 180);
    // 雲
    ctx.fillStyle = '#5a8aae';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(30 + i * 48, 36 + (i % 2) * 24, 18, 10);
    }
    // 星
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 20; i++) {
      const x = (i * 79) % CANVAS_W;
      const y = (i * 31) % 100;
      ctx.fillRect(x, y, 1, 1);
    }
    // 敵
    drawEnemy(130, 30, state.enemy.type);
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
      const cx = px + (slotW - TILE * 2) / 2;
      const cy = py + 4;
      const tmp = document.createElement('canvas');
      tmp.width = TILE; tmp.height = TILE;
      const tctx = tmp.getContext('2d');
      drawCharDetailed(tctx, 0, 0, 'down', p.look);
      ctx.imageSmoothingEnabled = false;
      // 倒れ表現: 透明度＋傾けるかわりに反転
      if (!p.alive) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.translate(cx + TILE, cy + TILE * 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(tmp, 0, 0, TILE * 2, TILE * 2);
        ctx.restore();
      } else {
        ctx.drawImage(tmp, cx, cy, TILE * 2, TILE * 2);
      }
      // 名前
      ctx.fillStyle = p.alive ? '#fff' : '#888';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, px + slotW / 2, py + TILE * 2 + 18);
      // HPバー
      const barW = slotW - 16;
      const bx = px + 8;
      const byH = py + TILE * 2 + 22;
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
    ctx.textAlign = 'left';
  }

  function render() {
    if (state.scene === 'title') return; // titleはhtml側
    if (state.scene === 'newgame') return;
    if (state.scene === 'battle' || state.scene === 'win' || state.scene === 'lose') renderBattle();
    else renderField();
    updateStatus();
  }
  function renderAndUpdate() { render(); updateStatus(); }

  function updateStatus() {
    const s = document.getElementById('status');
    if (s.dataset.flash) { s.textContent = s.dataset.flash; return; }
    if (state.scene === 'title' || state.scene === 'newgame') { s.textContent = ''; return; }
    s.innerHTML =
      `<span>Lv ${state.lv} ${state.party[0].name} HP${state.party[0].hp}/${state.party[0].maxHp}</span>` +
      `<span>♪${state.pieces} G${state.gold}</span>`;
  }

  // ============================================================
  // ダイアログ
  // ============================================================
  function setDialog(lines, after, choices, onChoice) {
    state.dialog = Array.isArray(lines) ? lines : [lines];
    state.dialogIdx = 0;
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
    let html = state.dialog[state.dialogIdx];
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
        if (fn) fn(i);
      });
    });
  }
  function advanceDialog() {
    if (state.choices) return;
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

  // ============================================================
  // NPC会話
  // ============================================================
  function talkNPC(npc) {
    if (npc.kind === 'akihiro') {
      setDialog([
        'あきちゃん：「Labas! よう、来たね〜！」',
        `「${state.party[0].name}くん（ちゃん）、ダイヌシュベンテはもうすぐだ。」`,
        `「${state.party[1].name}と${state.party[2].name}も連れてるんだね、心強い！」`,
        '「街の人にはリト語のあいさつから話しかけよう：',
        '・Labas（ラバス）= こんにちは',
        '・Ačiū（アチュー）= ありがとう',
        '・Kaip sekasi?（カイプ・セカシ）= 元気？',
        '「マンタスはこの街の顔役だ。レストランで会えるよ。」',
      ]);
      return;
    }
    if (npc.kind === 'miho') {
      setDialog([
        'みほさん：「あら、いらっしゃい！」',
        '「ここは私の宿屋。HPもMPも全回復するから、いつでも寄ってね。」',
        '「冒険の記録もここで自動セーブしておくから安心してね。」',
        '「（宿屋の入口（赤屋根のベッド看板）でAボタンで休める）」',
      ]);
      return;
    }
    if (npc.kind === 'mantas') {
      const greet = ['Labas! いらっしゃい！', 'Sveiki! 今日のキビナイは絶品だよ。'];
      setDialog(
        [`マンタス：「${greet[Math.floor(Math.random() * greet.length)]}」`,
         '色白でほっそり、眼鏡の似合う紳士。声は朗々として通る。',
         'マンタス：「ヴィリニュスは初めて？じゃあリト語のあいさつ、覚えていきな。」',
         'NPCが何かをくれそうだ。お礼にあたる言葉は？'],
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
                '【30G を受け取った！】',
                '「ピースの噂か？塔の番人のところに1つあると聞いたぞ。気をつけてな。」',
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
      setDialog(
        ['イエヴァ：「Labas vakaras… 旅の方ですか？」',
         '物静かで透き通った声の女性。手に楽譜を持っている。',
         '「あなたの歌、聴いてみたいです。元気？」'],
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
        ['塔の番人：「貴様ら、何用だ。」',
         '「歌詞のピースが欲しいだと？簡単には渡せん。」',
         '「我を感動させてみよ！」'],
        () => startBattle({
          type: 'guardian', name: '塔の番人',
          hp: 80, maxHp: 80, atk: 6, xp: 30, gold: 50, boss: true,
        })
      );
      return;
    }

    // 一般NPC（あいさつ学習）
    const hintMap = {
      labas: { q: 'NPCがあなたに微笑みかけている。なんとあいさつする？', correct: 0 },
      aciu:  { q: 'NPCが何かをくれそうだ。お礼にあたる言葉は？',         correct: 1 },
      kaip:  { q: 'NPCの調子をたずねたい。なんと声をかける？',           correct: 2 },
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
      ['Labas!（こんにちは）', 'Ačiū!（ありがとう）', 'Kaip sekasi?（元気？）'],
      (i) => {
        if (i === h.correct) afterCorrect(npc);
        else setDialog([npc.name + '：「???」', '（うまく通じなかったようだ…）']);
      }
    );
  }

  function afterCorrect(npc) {
    if (npc.kind === 'shop' && !state.flags.shop) {
      state.flags.shop = true; state.pieces++;
      setDialog([
        npc.name + '：「Ačiū! きれいなリト語だね。」',
        '「これはおまけだよ」と歌詞のピースをくれた！',
        '【歌詞ピース ♪' + state.pieces + ' 入手】',
      ], () => saveGame());
      return;
    }
    if (npc.kind === 'child' && !state.flags.child) {
      state.flags.child = true; state.pieces++;
      setDialog([
        npc.name + '：「わぁ、リト語じょうず！」',
        '子どもは大切にしていた紙切れを差し出した。',
        '【歌詞ピース ♪' + state.pieces + ' 入手】',
      ], () => saveGame());
      return;
    }
    if (npc.kind === 'bard' && !state.flags.bard) {
      state.flags.bard = true; state.pieces++;
      setDialog([
        npc.name + '：「お、リト語が話せるのか。気に入った。」',
        '「俺の弟子に渡そうと思ってた歌詞だ、譲ろう。」',
        '【歌詞ピース ♪' + state.pieces + ' 入手】',
      ], () => saveGame());
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
        '門の上の小さな礼拝堂には黒いマドンナのイコンが祀られている。',
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
    if (t === T.CATHEDRAL) {
      setDialog(['【ヴィリニュス大聖堂】',
        '街の中心、白い列柱の堂々たる聖堂。',
        '隣接する鐘楼は街のシンボルでもある。']);
      return true;
    }
    if (t === T.INN) {
      // みほさん宿屋
      setDialog(['【みほさんの宿屋】',
        '「いらっしゃい！ 一晩 0G でいいよ♪」',
        '「ぐっすり休んで、目が覚めたら全回復よ。」'],
        null,
        ['泊まる', '泊まらない'],
        (i) => {
          if (i === 0) {
            state.party.forEach(p => { p.hp = p.maxHp; p.mp = p.maxMp; p.alive = true; });
            saveGame();
            setDialog(['Zzz... ぐっすり眠った。HP/MP全回復＆セーブ完了！']);
          } else {
            setDialog(['「またのお越しを♪」']);
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
    return false;
  }

  // ============================================================
  // 戦闘システム（3人パーティ）
  // ============================================================
  const SONGS = [
    { n: 'やさしい歌', mp: 2, base: 6  },
    { n: '故郷の歌',   mp: 4, base: 11 },
    { n: '魂の合唱',   mp: 8, base: 20 },
  ];

  function startBattle(enemy) {
    state.enemy = Object.assign({}, enemy);
    state.scene = 'battle';
    state.battleLog = enemy.name + 'があらわれた！';
    state.battleStep = 'menu';
    state.buff = 0;
    render();
    showBattleUI();
  }

  function showBattleUI() {
    const d = document.getElementById('dialog');
    let html = '<div style="font-size:13px;margin-bottom:6px;">' + state.battleLog + '</div>';
    if (state.battleStep === 'menu') {
      html += '<div style="font-size:11px;color:#aaa;margin-bottom:4px;">▼ ' + state.party[0].name + ' のコマンド</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
      SONGS.forEach((s, i) => {
        const dis = state.party[0].mp < s.mp ? 'opacity:0.5;' : '';
        html += `<button data-act="sing-${i}" style="${dis}padding:6px;font-size:12px;background:#222;border:1px solid #555;border-radius:6px;color:#fff;cursor:pointer;text-align:left;">♪ ${s.n}<br><span style="font-size:10px;color:#aaa;">MP${s.mp}/威${s.base}±</span></button>`;
      });
      // 励ます
      const downAlly = state.party.find((p, i) => i > 0 && !p.alive);
      const encDis = !downAlly ? 'opacity:0.5;' : '';
      html += `<button data-act="encourage" style="${encDis}padding:6px;font-size:12px;background:#222;border:1px solid #555;border-radius:6px;color:#fff;cursor:pointer;text-align:left;">★ 励ます<br><span style="font-size:10px;color:#aaa;">倒れた仲間1人を復活</span></button>`;
      // エホーマイ（コンボ）
      const allAlive = state.party.every(p => p.alive);
      const totalMp = state.party.reduce((s, p) => s + p.mp, 0);
      const ehoOk = allAlive && state.party[0].mp >= 6 && state.party[1].mp >= 1 && state.party[2].mp >= 1;
      const ehoDis = ehoOk ? '' : 'opacity:0.5;';
      html += `<button data-act="ehomai" style="${ehoDis}padding:6px;font-size:12px;background:#3a2a4a;border:1px solid #dac030;border-radius:6px;color:#dac030;cursor:pointer;text-align:left;">★エホーマイ<br><span style="font-size:10px;">3人合唱 / 3T威力2倍</span></button>`;
      html += `<button data-act="flee" style="padding:6px;font-size:12px;background:#222;border:1px solid #555;border-radius:6px;color:#fff;cursor:pointer;">逃げる</button>`;
      html += '</div>';
    }
    d.innerHTML = html;
    d.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        const a = b.dataset.act;
        if (a.startsWith('sing-')) {
          const i = parseInt(a.split('-')[1], 10);
          const s = SONGS[i];
          if (state.party[0].mp < s.mp) return;
          heroSing(s);
        } else if (a === 'encourage') {
          if (state.party.find((p, i) => i > 0 && !p.alive)) heroEncourage();
        } else if (a === 'ehomai') {
          const ok = state.party.every(p => p.alive) && state.party[0].mp >= 6 && state.party[1].mp >= 1 && state.party[2].mp >= 1;
          if (ok) heroEhomai();
        } else if (a === 'flee') {
          if (state.enemy.boss) { state.battleLog = 'ボスからは逃げられない！'; showBattleUI(); return; }
          if (Math.random() < 0.6) { state.scene = 'field'; setDialog('（うまく逃げ切った…）'); }
          else { state.battleLog = '逃げられなかった！'; setTimeout(allyTurns, 300); }
        }
      });
    });
  }

  function heroSing(s) {
    state.party[0].mp -= s.mp;
    state.songCounter++;
    let dmg = s.base + Math.floor(Math.random() * 4) - 1 + state.lv;
    if (state.buff > 0) dmg *= 2;
    if (state.enemy.boss) dmg = Math.max(1, dmg - 3);
    state.enemy.hp -= dmg;
    state.battleLog = `♪「${s.n}」を歌った！ ${state.enemy.name}に感動${dmg}！`;
    if (state.enemy.hp <= 0) { victory(); return; }
    render();
    setTimeout(allyTurns, 500);
  }

  function heroEncourage() {
    const down = state.party.find((p, i) => i > 0 && !p.alive);
    if (!down) return;
    down.alive = true;
    down.hp = Math.floor(down.maxHp / 2);
    state.battleLog = `${state.party[0].name}は ${down.name} を励ました！ HPが半分回復！`;
    render();
    setTimeout(allyTurns, 500);
  }

  function heroEhomai() {
    state.party[0].mp -= 6; state.party[1].mp -= 1; state.party[2].mp -= 1;
    state.buff = 3;
    state.songCounter++;
    let dmg = 25 + state.lv * 2;
    if (state.enemy.boss) dmg = Math.max(1, dmg - 3);
    state.enemy.hp -= dmg;
    state.battleLog = `★エホーマイ！3人の合唱が響き渡る！ 感動${dmg}！ 以後3T威力2倍！`;
    if (state.enemy.hp <= 0) { victory(); return; }
    render();
    setTimeout(allyTurns, 700);
  }

  function allyTurns() {
    // 仲間1
    setTimeout(() => allyAct(1, () => {
      if (state.enemy.hp <= 0) { victory(); return; }
      // 仲間2
      setTimeout(() => allyAct(2, () => {
        if (state.enemy.hp <= 0) { victory(); return; }
        setTimeout(enemyTurn, 400);
      }), 400);
    }), 400);
  }

  function allyAct(idx, cb) {
    const a = state.party[idx];
    if (!a.alive) { cb(); return; }
    // AI: MPあれば歌、なければ普通に応援(微小ダメージ)
    let s = null;
    if (a.mp >= SONGS[1].mp && state.enemy.hp > 30) s = SONGS[1];
    else if (a.mp >= SONGS[0].mp) s = SONGS[0];
    if (s) {
      a.mp -= s.mp;
      let dmg = s.base + Math.floor(Math.random() * 4) - 2 + state.lv;
      if (state.buff > 0) dmg *= 2;
      if (state.enemy.boss) dmg = Math.max(1, dmg - 3);
      state.enemy.hp -= dmg;
      state.battleLog = `${a.name}：♪「${s.n}」 感動${dmg}！`;
    } else {
      const dmg = 2 + Math.floor(Math.random() * 3);
      state.enemy.hp -= dmg;
      state.battleLog = `${a.name}：声援を送った！ 感動${dmg}！`;
    }
    render(); cb();
  }

  function enemyTurn() {
    if (state.buff > 0) state.buff--;
    const aliveIdx = state.party.map((p, i) => p.alive ? i : -1).filter(i => i >= 0);
    if (aliveIdx.length === 0) { defeat(); return; }
    const tgt = aliveIdx[Math.floor(Math.random() * aliveIdx.length)];
    const atk = state.enemy.atk + Math.floor(Math.random() * 3);
    state.party[tgt].hp -= atk;
    state.battleLog = `${state.enemy.name}の批判！ ${state.party[tgt].name} HP${atk}減少！`;
    if (state.party[tgt].hp <= 0) {
      state.party[tgt].hp = 0;
      state.party[tgt].alive = false;
      state.battleLog += ` ${state.party[tgt].name}は気を失った！`;
    }
    if (!state.party[0].alive) { defeat(); return; }
    render(); showBattleUI();
  }

  function victory() {
    state.scene = 'win';
    state.xp += state.enemy.xp;
    state.gold += state.enemy.gold;
    const msg = [
      `${state.enemy.name}は感動して泣き出した！`,
      `経験値 ${state.enemy.xp} と ${state.enemy.gold}G を得た！`,
    ];
    while (state.xp >= state.nextXp) {
      state.lv++;
      state.xp -= state.nextXp;
      state.nextXp = Math.floor(state.nextXp * 1.6);
      state.party.forEach(p => { p.maxHp += 4; p.hp = p.maxHp; p.maxMp += 2; p.mp = p.maxMp; });
      msg.push(`♪レベルアップ！ Lv${state.lv}！ パーティ全員が成長した！`);
    }
    if (state.enemy.boss && !state.flags.guardian) {
      state.flags.guardian = true;
      state.pieces++;
      msg.push('塔の番人は静かに歌詞ピースを差し出した…');
      msg.push('【歌詞ピース ♪' + state.pieces + ' 入手】');
    }
    setDialog(msg, () => { state.scene = 'field'; saveGame(); render(); });
  }

  function defeat() {
    state.scene = 'lose';
    setDialog(
      [`${state.party[0].name}は感動させられて倒れた…`,
       'みほさんの宿屋で目を覚ました。'],
      () => {
        state.party.forEach(p => { p.hp = p.maxHp; p.mp = p.maxMp; p.alive = true; });
        state.px = 11; state.py = 18; // 宿屋前
        state.scene = 'field';
        saveGame();
        render();
      }
    );
  }

  // ============================================================
  // 入力処理
  // ============================================================
  function isWalkable(x, y) {
    if (x < 0 || x >= MAP_COLS || y < 0 || y >= MAP_ROWS) return false;
    const t = MAP[y][x];
    // 通行不可: 壁・木・水・観光建物・大聖堂
    return t !== T.WALL && t !== T.TREE && t !== T.WATER &&
           t !== T.GEDIMINAS && t !== T.GATES && t !== T.ANNE && t !== T.CATHEDRAL;
  }
  function npcAt(x, y) {
    return NPCS.find(n => n.x === x && n.y === y && !(n.kind === 'guardian' && state.flags.guardian));
  }

  let _lastEncTile = null;
  function tryMove(dx, dy, dir) {
    state.pdir = dir;
    const nx = state.px + dx;
    const ny = state.py + dy;
    if (!isWalkable(nx, ny)) { render(); return; }
    if (npcAt(nx, ny))       { render(); return; }
    state.px = nx; state.py = ny;
    if (MAP[ny][nx] === T.ENC && Math.random() < 0.18) {
      const tier = state.lv < 3
        ? { hp: 16, atk: 3, xp: 5, gold: 8 }
        : { hp: 26, atk: 5, xp: 8, gold: 14 };
      const names = ['通りすがりの市民', '陽気なおじさん', '頑固な老婦人', '若い学生'];
      startBattle({
        type: 'citizen',
        name: names[Math.floor(Math.random() * names.length)],
        hp: tier.hp, maxHp: tier.hp,
        atk: tier.atk, xp: tier.xp, gold: tier.gold,
      });
      return;
    }
    render();
  }

  function pressA() {
    if (state.scene === 'title' || state.scene === 'newgame') return; // ボタン操作で進める
    if (state.dialog.length > 0) { advanceDialog(); return; }
    if (state.scene === 'battle') return;

    const dx = state.pdir === 'left' ? -1 : state.pdir === 'right' ? 1 : 0;
    const dy = state.pdir === 'up'   ? -1 : state.pdir === 'down'  ? 1 : 0;
    const fx = state.px + dx;
    const fy = state.py + dy;
    const npc = NPCS.find(n => n.x === fx && n.y === fy && !(n.kind === 'guardian' && state.flags.guardian));
    if (npc) { talkNPC(npc); return; }
    if (fx >= 0 && fx < MAP_COLS && fy >= 0 && fy < MAP_ROWS) {
      if (checkLandmark(MAP[fy][fx], fx, fy)) return;
    }
    setDialog('（…特に何もない。）');
  }
  function pressB() {
    if (state.dialog.length > 0) {
      state.dialogIdx = state.dialog.length - 1;
      showDialog();
    }
  }

  // ============================================================
  // イベント登録
  // ============================================================
  document.querySelectorAll('.pad').forEach(b => {
    b.addEventListener('click', () => {
      if (state.scene !== 'field') return;
      const d = b.dataset.dir;
      if      (d === 'up')    tryMove(0, -1, 'up');
      else if (d === 'down')  tryMove(0,  1, 'down');
      else if (d === 'left')  tryMove(-1, 0, 'left');
      else if (d === 'right') tryMove(1,  0, 'right');
    });
  });
  document.getElementById('btnA').addEventListener('click', pressA);
  document.getElementById('btnB').addEventListener('click', pressB);
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','z','x',' ','Enter'].includes(e.key)) {
      e.preventDefault();
    }
    if (state.scene === 'field') {
      if      (e.key === 'ArrowUp'    || e.key === 'w') tryMove(0, -1, 'up');
      else if (e.key === 'ArrowDown'  || e.key === 's') tryMove(0,  1, 'down');
      else if (e.key === 'ArrowLeft'  || e.key === 'a') tryMove(-1, 0, 'left');
      else if (e.key === 'ArrowRight' || e.key === 'd') tryMove(1,  0, 'right');
    }
    if (e.key === 'z' || e.key === 'Enter' || e.key === ' ') pressA();
    if (e.key === 'x' || e.key === 'Escape') pressB();
  });

  // ============================================================
  // 起動
  // ============================================================
  showTitleMenu();

})();
