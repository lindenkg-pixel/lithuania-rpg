// ============================================================
// リトアニア音楽紀行 — メインゲームロジック
// 現在: ヴィリニュス縦スライス
// 今後: js/maps/, js/data/, js/systems/ に分割予定
// ============================================================

(function () {
  'use strict';

  const cvs = document.getElementById('screen');
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const TILE = 20;
  const COLS = 16;
  const ROWS = 16;

  // ============================================================
  // マップデータ（将来 js/maps/vilnius.js に分離）
  // タイル定義:
  //   0: 草地 / 1: 道 / 2: 建物壁 / 3: 木 / 4: 水
  //   5: 建物入口 / 6: ゲディミナス塔 / 7: 夜明けの門 / 8: 聖アンナ教会
  //   9: エンカウント草むら
  // ============================================================
  const MAP = [
    [3,3,3,3,9,9,9,9,9,9,9,9,9,9,3,3],
    [3,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3],
    [3,1,2,2,1,2,2,2,1,2,2,1,6,1,9,3],
    [3,1,5,2,1,2,5,2,1,5,2,1,1,1,9,3],
    [3,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3],
    [3,1,2,2,1,8,1,1,1,1,2,2,1,1,9,3],
    [3,1,5,2,1,1,1,4,4,1,5,2,1,1,9,3],
    [3,1,1,1,1,1,1,4,4,1,1,1,1,1,9,3],
    [3,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3],
    [3,9,9,1,2,2,1,1,1,2,2,2,1,9,9,3],
    [3,9,9,1,5,2,1,1,1,5,2,2,1,9,9,3],
    [3,9,9,1,1,1,1,1,1,1,1,1,1,9,9,3],
    [3,9,9,9,1,1,1,7,1,1,1,9,9,9,9,3],
    [3,9,9,9,1,1,1,1,1,1,1,9,9,9,9,3],
    [3,3,3,3,1,1,1,1,1,1,1,3,3,3,3,3],
    [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
  ];

  // ============================================================
  // NPC配置（将来 js/data/npcs_vilnius.js に分離）
  // ============================================================
  const NPCS = [
    { x: 2,  y: 3,  name: 'おばさん',          kind: 'greeter',  hint: 'labas' },
    { x: 6,  y: 3,  name: 'パン屋',            kind: 'baker',    hint: 'aciu'  },
    { x: 9,  y: 3,  name: '吟遊詩人',          kind: 'bard',     hint: 'kaip'  },
    { x: 4,  y: 6,  name: '学生',              kind: 'student',  hint: 'labas' },
    { x: 10, y: 6,  name: 'おじいさん',        kind: 'elder',    hint: 'aciu'  },
    { x: 4,  y: 10, name: '子ども',            kind: 'child',    hint: 'kaip'  },
    { x: 9,  y: 10, name: 'AKクワイア仲間',    kind: 'akmate',   hint: null    },
    { x: 12, y: 2,  name: '塔の番人',          kind: 'guardian', hint: null    },
  ];

  // ============================================================
  // ゲーム状態
  // ============================================================
  const state = {
    scene: 'title', // title | field | dialog | battle | win | lose
    px: 7, py: 8, pdir: 'down',
    hp: 20, maxHp: 20,
    mp: 10, maxMp: 10,
    lv: 1, xp: 0, gold: 0,
    nextXp: 8,
    pieces: 0, // 0..3
    flags: { baker: false, child: false, guardian: false },
    dialog: [],
    dialogIdx: 0,
    choices: null,
    onChoice: null,
    afterDialog: null,
    enemy: null,
    battleLog: '',
    songCounter: 0,
  };

  // ============================================================
  // 描画ヘルパー（将来 js/systems/render.js に分離）
  // ============================================================
  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  function drawTile(t, sx, sy) {
    if (t === 0 || t === 9) {
      rect(sx, sy, TILE, TILE, t === 9 ? '#5a8a3a' : '#6ea64a');
      ctx.fillStyle = t === 9 ? '#3e6a26' : '#4d8a36';
      for (let i = 0; i < 6; i++) {
        const dx = (i * 7 + sy) % TILE;
        const dy = (i * 11 + sx) % TILE;
        ctx.fillRect(sx + dx, sy + dy, 2, 2);
      }
    } else if (t === 1) {
      rect(sx, sy, TILE, TILE, '#c8a878');
      ctx.fillStyle = '#a88858';
      ctx.fillRect(sx + 3, sy + 5, 2, 2);
      ctx.fillRect(sx + 12, sy + 12, 2, 2);
    } else if (t === 2) {
      rect(sx, sy, TILE, TILE, '#8a4a2a');
      ctx.fillStyle = '#6a3a1a';
      ctx.fillRect(sx, sy + 9, TILE, 1);
      ctx.fillRect(sx + 9, sy, 1, TILE);
      ctx.fillStyle = '#aa6a3a';
      ctx.fillRect(sx + 1, sy + 1, 3, 3);
      ctx.fillRect(sx + 11, sy + 11, 3, 3);
    } else if (t === 3) {
      rect(sx, sy, TILE, TILE, '#6ea64a');
      rect(sx + 4, sy + 12, 12, 5, '#5a3a1a');
      ctx.fillStyle = '#1e6a2a';
      ctx.beginPath(); ctx.arc(sx + 10, sy + 8, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2e8a3a';
      ctx.beginPath(); ctx.arc(sx + 10, sy + 7, 4, 0, Math.PI * 2); ctx.fill();
    } else if (t === 4) {
      rect(sx, sy, TILE, TILE, '#3a6abe');
      ctx.fillStyle = '#5a8ade';
      ctx.fillRect(sx + 2, sy + 4, 6, 1);
      ctx.fillRect(sx + 10, sy + 12, 6, 1);
    } else if (t === 5) {
      rect(sx, sy, TILE, TILE, '#8a4a2a');
      rect(sx + 6, sy + 6, 8, 14, '#3a2a1a');
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 12, sy + 13, 2, 2);
    } else if (t === 6) {
      rect(sx, sy, TILE, TILE, '#6ea64a');
      rect(sx + 6, sy + 2, 8, 16, '#b06030');
      rect(sx + 5, sy + 1, 10, 3, '#8a4020');
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 9, sy + 10, 2, 4);
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 10, sy, 1, 2);
    } else if (t === 7) {
      rect(sx, sy, TILE, TILE, '#c8a878');
      rect(sx + 3, sy + 4, 14, 14, '#dab070');
      rect(sx + 7, sy + 8, 6, 10, '#3a2a1a');
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 9, sy + 2, 2, 3);
    } else if (t === 8) {
      rect(sx, sy, TILE, TILE, '#c8a878');
      rect(sx + 4, sy + 6, 12, 12, '#a04030');
      ctx.fillStyle = '#702030';
      ctx.beginPath();
      ctx.moveTo(sx + 4, sy + 6);
      ctx.lineTo(sx + 10, sy + 1);
      ctx.lineTo(sx + 16, sy + 6);
      ctx.fill();
      ctx.fillStyle = '#dac030';
      ctx.fillRect(sx + 9, sy, 2, 2);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx + 9, sy + 12, 2, 6);
    }
  }

  function drawHero(sx, sy, dir) {
    rect(sx + 6, sy + 10, 8, 7, '#3a4abe');
    rect(sx + 6, sy + 16, 3, 3, '#3a2a1a');
    rect(sx + 11, sy + 16, 3, 3, '#3a2a1a');
    rect(sx + 7, sy + 4, 6, 7, '#f0c89a');
    rect(sx + 6, sy + 3, 8, 3, '#5a3a1a');
    ctx.fillStyle = '#000';
    if (dir === 'down')      { ctx.fillRect(sx + 8, sy + 7, 1, 2); ctx.fillRect(sx + 11, sy + 7, 1, 2); }
    else if (dir === 'up')   { ctx.fillRect(sx + 8, sy + 3, 1, 1); ctx.fillRect(sx + 11, sy + 3, 1, 1); }
    else if (dir === 'left') { ctx.fillRect(sx + 7, sy + 7, 1, 2); }
    else                     { ctx.fillRect(sx + 12, sy + 7, 1, 2); }
    rect(sx + 4, sy + 11, 2, 4, '#f0c89a');
    rect(sx + 14, sy + 11, 2, 4, '#f0c89a');
    rect(sx + 8, sy + 12, 4, 3, '#fff');
    ctx.fillStyle = '#000';
    ctx.fillRect(sx + 9, sy + 13, 1, 1);
  }

  function drawNPC(sx, sy, kind) {
    const palette = {
      greeter:  { col: '#c83080', hair: '#dac030' },
      baker:    { col: '#dac030', hair: '#8a4020' },
      bard:     { col: '#3aae6a', hair: '#3a2a1a' },
      student:  { col: '#3a8abe', hair: '#5a3a1a' },
      elder:    { col: '#888888', hair: '#ffffff' },
      child:    { col: '#dab070', hair: '#5a3a1a' },
      akmate:   { col: '#9a3aae', hair: '#3a2a1a' },
      guardian: { col: '#3a3a3a', hair: '#aa3030' },
    }[kind] || { col: '#c83030', hair: '#3a2a1a' };

    rect(sx + 6, sy + 10, 8, 7, palette.col);
    rect(sx + 6, sy + 16, 3, 3, '#3a2a1a');
    rect(sx + 11, sy + 16, 3, 3, '#3a2a1a');
    rect(sx + 7, sy + 4, 6, 7, '#f0c89a');
    rect(sx + 6, sy + 3, 8, 3, palette.hair);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx + 8, sy + 7, 1, 2);
    ctx.fillRect(sx + 11, sy + 7, 1, 2);
    rect(sx + 4, sy + 11, 2, 4, '#f0c89a');
    rect(sx + 14, sy + 11, 2, 4, '#f0c89a');
  }

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

  function clear(c) { rect(0, 0, 320, 320, c || '#000'); }

  function renderField() {
    clear('#000');
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        drawTile(MAP[y][x], x * TILE, y * TILE);
      }
    }
    NPCS.forEach(n => {
      if (n.kind === 'guardian' && state.flags.guardian) return;
      drawNPC(n.x * TILE, n.y * TILE, n.kind);
    });
    drawHero(state.px * TILE, state.py * TILE, state.pdir);
  }

  function renderTitle() {
    clear('#1a1a2a');
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('リトアニア音楽紀行', 160, 90);
    ctx.font = '12px sans-serif';
    ctx.fillText('〜失われた歌詞のピース〜', 160, 115);
    ctx.fillStyle = '#dac030';
    ctx.fillText('Aを押してはじめる', 160, 200);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3a4abe';
    ctx.fillRect(40, 140, 240, 3);
    ctx.fillRect(40, 160, 240, 3);
  }

  function renderBattle() {
    clear('#1a1a2a');
    ctx.fillStyle = '#2a3a5a';
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#5a8aae';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(20 + i * 40, 30 + (i % 2) * 20, 15, 8);
    }
    drawEnemy(100, 40, state.enemy.type);
    const hpRatio = state.enemy.hp / state.enemy.maxHp;
    rect(60, 160, 200, 8, '#3a2a1a');
    rect(62, 162, 196 * Math.max(0, hpRatio), 4, '#dac030');
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.enemy.name + ' 感動度 ' + Math.max(0, state.enemy.hp) + '/' + state.enemy.maxHp, 160, 158);
    ctx.textAlign = 'left';
  }

  function render() {
    if (state.scene === 'title') renderTitle();
    else if (state.scene === 'battle' || state.scene === 'win' || state.scene === 'lose') renderBattle();
    else renderField();
    updateStatus();
  }

  function updateStatus() {
    const s = document.getElementById('status');
    if (state.scene === 'title') { s.textContent = ''; return; }
    s.innerHTML =
      `<span>Lv ${state.lv} HP ${state.hp}/${state.maxHp} MP ${state.mp}/${state.maxMp}</span>` +
      `<span>♪${state.pieces}/3 G ${state.gold}</span>`;
  }

  // ============================================================
  // ダイアログ（将来 js/systems/dialog.js に分離）
  // ============================================================
  function setDialog(lines, after, choices, onChoice) {
    state.dialog = Array.isArray(lines) ? lines : [lines];
    state.dialogIdx = 0;
    state.afterDialog = after || null;
    state.choices = choices || null;
    state.onChoice = onChoice || null;
    if (state.scene !== 'battle' && state.scene !== 'win' && state.scene !== 'lose') {
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
        state.choices = null; state.onChoice = null;
        state.dialog = [];
        document.getElementById('dialog').textContent = '';
        if (fn) fn(i);
      });
    });
  }

  function advanceDialog() {
    if (state.choices) return;
    if (state.dialogIdx < state.dialog.length - 1) {
      state.dialogIdx++;
      showDialog();
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
  // NPC会話・リト語学習（将来 js/systems/dialog_npc.js に分離）
  // ============================================================
  function talkNPC(npc) {
    if (npc.kind === 'akmate') {
      setDialog([
        'AKクワイア仲間：「やっとここまで来たか！」',
        '「ダイヌシュベンテはもうすぐだ。歌詞のピースを集めてきてくれ。」',
        '「街の人たちはみんなあいさつから話しかけてくる。リト語のあいさつを覚えるんだ：',
        '・Labas（ラバス）= こんにちは',
        '・Ačiū（アチュー）= ありがとう',
        '・Kaip sekasi?（カイプ・セカシ）= 元気？',
        '「ゲディミナス塔の番人がピースの１つを守ってる。レベルを上げてから挑むといい。」',
      ]);
      return;
    }

    if (npc.kind === 'guardian') {
      if (state.flags.guardian) {
        setDialog('（塔の番人は感動の涙を流して去っていった…）');
        return;
      }
      setDialog(
        [
          '塔の番人：「貴様、何用だ。」',
          '「歌詞のピースが欲しいだと？簡単には渡せん。」',
          '「我を感動させてみよ！」',
        ],
        () => startBattle({
          type: 'guardian',
          name: '塔の番人',
          hp: 60, maxHp: 60,
          atk: 5, xp: 25, gold: 50,
          boss: true,
        })
      );
      return;
    }

    const hintMap = {
      labas: { q: 'NPCがあなたに微笑みかけている。なんとあいさつする？', correct: 0,
               opts: ['Labas!（こんにちは）', 'Ačiū!（ありがとう）', 'Kaip sekasi?（元気？）'] },
      aciu:  { q: 'NPCが何かをくれそうだ。お礼にあたる言葉は？',         correct: 1,
               opts: ['Labas!（こんにちは）', 'Ačiū!（ありがとう）', 'Kaip sekasi?（元気？）'] },
      kaip:  { q: 'NPCの調子をたずねたい。なんと声をかける？',           correct: 2,
               opts: ['Labas!（こんにちは）', 'Ačiū!（ありがとう）', 'Kaip sekasi?（元気？）'] },
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
      h.opts,
      (i) => {
        if (i === h.correct) afterCorrect(npc);
        else setDialog([npc.name + '：「???」', '（うまく通じなかったようだ…）']);
      }
    );
  }

  function afterCorrect(npc) {
    if (npc.kind === 'baker' && !state.flags.baker) {
      state.flags.baker = true; state.pieces++;
      setDialog([
        npc.name + '：「Ačiū! きれいなリト語だね。」',
        '「これはおまけだよ」と歌詞のピースをくれた！',
        '【歌詞ピース ♪' + state.pieces + '/3 入手】',
        '「あんたの歌、聴いてみたいねぇ。」',
      ]);
      return;
    }
    if (npc.kind === 'child' && !state.flags.child) {
      state.flags.child = true; state.pieces++;
      setDialog([
        npc.name + '：「わぁ、リト語じょうず！」',
        '子どもは大切にしていた紙切れを差し出した。',
        '【歌詞ピース ♪' + state.pieces + '/3 入手】',
        '「この紙、おじいちゃんが歌うときの大事な言葉なんだって。」',
      ]);
      return;
    }
    const hints = {
      greeter: '「ゲディミナス塔の番人は、強い感動を与えないと心を開かないよ。」',
      bard:    '「♪歌うコマンドは消費MPと威力が違う。MPが切れたら宿屋でね。」',
      student: '「観光名所に立つと、その場所の話が聞けるよ。」',
      elder:   '「子どもがピースを持ってると噂だ。リト語で話しかけてごらん。」',
    };
    const hint = hints[npc.kind] || '「Lietuva（リトアニア）にようこそ。」';
    setDialog([npc.name + '：「Ačiū! きれいなリト語だね。」', npc.name + '：' + hint]);
  }

  // ============================================================
  // 観光名所
  // ============================================================
  function checkLandmark(t) {
    if (t === 6) {
      setDialog([
        '【ゲディミナス塔】',
        'ヴィリニュスの旧市街を見下ろす赤レンガの塔。',
        'リトアニア大公国の象徴であり、塔の上には三色旗が翻る。',
        '（塔の前に番人が立ちはだかっている…）',
      ]);
      return true;
    }
    if (t === 7) {
      setDialog(
        [
          '【夜明けの門】',
          '街の南の入り口にあたる古い城門。',
          '門の上の小さな礼拝堂には黒いマドンナのイコンが祀られている。',
          '（不思議と心が落ち着いた。HPが全回復した！）',
        ],
        () => { state.hp = state.maxHp; state.mp = state.maxMp; }
      );
      return true;
    }
    if (t === 8) {
      setDialog([
        '【聖アンナ教会】',
        '赤レンガで建てられた後期ゴシック様式の教会。',
        'ナポレオンが「手のひらに乗せてパリに持ち帰りたい」と言ったという伝説。',
      ]);
      return true;
    }
    return false;
  }

  // ============================================================
  // 戦闘システム（将来 js/systems/battle.js に分離）
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
    render();
    showBattleUI();
  }

  function showBattleUI() {
    const d = document.getElementById('dialog');
    let html = '<div style="font-size:13px;margin-bottom:6px;">' + state.battleLog + '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
    SONGS.forEach((s, i) => {
      const dis = state.mp < s.mp ? 'opacity:0.5;' : '';
      html += `<button data-song="${i}" style="${dis}padding:6px;font-size:12px;background:#222;border:1px solid #555;border-radius:6px;color:#fff;cursor:pointer;text-align:left;">♪ ${s.n}<br><span style="font-size:10px;color:#aaa;">MP${s.mp} / 威力${s.base}±</span></button>`;
    });
    html += '<button data-flee="1" style="padding:6px;font-size:12px;background:#222;border:1px solid #555;border-radius:6px;color:#fff;cursor:pointer;">逃げる</button>';
    html += '</div>';
    d.innerHTML = html;

    d.querySelectorAll('[data-song]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.song, 10);
        const s = SONGS[i];
        if (state.mp < s.mp) return;
        playerSing(s);
      });
    });
    d.querySelectorAll('[data-flee]').forEach(b => {
      b.addEventListener('click', () => {
        if (state.enemy.boss) {
          state.battleLog = 'ボスからは逃げられない！';
          showBattleUI();
          return;
        }
        if (Math.random() < 0.6) {
          state.scene = 'field';
          setDialog('（うまく逃げ切った…）');
        } else {
          state.battleLog = '逃げられなかった！';
          enemyTurn();
        }
      });
    });
  }

  function playerSing(s) {
    state.mp -= s.mp;
    state.songCounter++;
    let dmg = s.base + Math.floor(Math.random() * 4) - 1 + state.lv;
    if (state.enemy.boss) dmg = Math.max(1, dmg - 3);
    state.enemy.hp -= dmg;
    state.battleLog = `♪「${s.n}」を歌った！ ${state.enemy.name}に感動${dmg}！`;
    if (state.enemy.hp <= 0) { victory(); return; }
    setTimeout(enemyTurn, 400);
    showBattleUI();
  }

  function enemyTurn() {
    const atk = state.enemy.atk + Math.floor(Math.random() * 3);
    state.hp -= atk;
    state.battleLog = `${state.enemy.name}の批判！ HP${atk}減少！`;
    if (state.hp <= 0) { state.hp = 0; defeat(); return; }
    showBattleUI();
    render();
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
      state.maxHp += 4; state.hp = state.maxHp;
      state.maxMp += 2; state.mp = state.maxMp;
      msg.push(`♪レベルアップ！ Lv${state.lv}になった！`);
    }
    if (state.enemy.boss && !state.flags.guardian) {
      state.flags.guardian = true;
      state.pieces++;
      msg.push('塔の番人は静かに歌詞ピースを差し出した…');
      msg.push('【歌詞ピース ♪' + state.pieces + '/3 入手】');
      if (state.pieces >= 3) {
        msg.push('★ 3つすべての歌詞ピースが揃った！');
        msg.push('（次回：他都市・キーパーソン編へ続く…）');
      }
    }
    setDialog(msg, () => { state.scene = 'field'; render(); });
  }

  function defeat() {
    state.scene = 'lose';
    setDialog(
      [
        `${state.enemy.name}に感動させられてしまった…`,
        'あなたは涙ぐみながら振り出しの宿屋で目を覚ました。',
      ],
      () => {
        state.hp = state.maxHp; state.mp = state.maxMp;
        state.px = 7; state.py = 8;
        state.scene = 'field';
        render();
      }
    );
  }

  // ============================================================
  // 入力処理
  // ============================================================
  function isWalkable(x, y) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
    const t = MAP[y][x];
    return t !== 2 && t !== 3 && t !== 4 && t !== 6 && t !== 7 && t !== 8;
  }

  function npcAt(x, y) {
    return NPCS.find(n => n.x === x && n.y === y && !(n.kind === 'guardian' && state.flags.guardian));
  }

  function tryMove(dx, dy, dir) {
    state.pdir = dir;
    const nx = state.px + dx;
    const ny = state.py + dy;
    if (!isWalkable(nx, ny)) { render(); return; }
    if (npcAt(nx, ny))       { render(); return; }
    state.px = nx; state.py = ny;
    if (MAP[ny][nx] === 9 && Math.random() < 0.18) {
      const tier = state.lv < 3
        ? { hp: 14, atk: 3, xp: 5, gold: 8 }
        : { hp: 22, atk: 4, xp: 7, gold: 12 };
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
    if (state.scene === 'title') {
      state.scene = 'field';
      renderField();
      setDialog([
        'あなたはAKクワイアの一員。',
        'リトアニアの音楽の祭典「ダイヌシュベンテ」で歌うため、はるばるやってきた。',
        'ところが——歌詞をすっかり忘れてしまった！',
        'リトアニア国内に散らばった歌詞のピースを集めて、祭典で歌い上げよう。',
        '（緑の草むらでは戦闘あり。Aで人と話す／観光名所を調べる）',
      ]);
      return;
    }
    if (state.dialog.length > 0) { advanceDialog(); return; }
    if (state.scene === 'battle') return;

    const dx = state.pdir === 'left' ? -1 : state.pdir === 'right' ? 1 : 0;
    const dy = state.pdir === 'up'   ? -1 : state.pdir === 'down'  ? 1 : 0;
    const fx = state.px + dx;
    const fy = state.py + dy;
    const npc = NPCS.find(n => n.x === fx && n.y === fy);
    if (npc) { talkNPC(npc); return; }
    if (fx >= 0 && fx < COLS && fy >= 0 && fy < ROWS) {
      if (checkLandmark(MAP[fy][fx])) return;
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

  render();
})();
