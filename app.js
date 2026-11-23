// Quiz engine: no login, all records live in the browser's localStorage.
(() => {
  const QUIZ_SIZE = 20;          // questions per round
  const WRONG_CLEAR_STREAK = 2;  // consecutive correct answers needed to leave the wrong-answer notebook
  const KEY = { hist: 'quiz.v1.history', wrong: 'quiz.v1.wrong', cur: 'quiz.v1.current' };
  const app = document.getElementById('app');
  let BANK = [];
  let TITLE = '線上練習測驗';
  let state = null; // current round

  // ---------- storage ----------
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { alert('瀏覽器儲存空間無法寫入,紀錄可能不會保留。'); } };

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const byId = id => BANK.find(q => q.id === id);
  const fmt = t => new Date(t).toLocaleString('zh-TW', { hour12: false });
  const randomIds = () => shuffle(BANK.map(q => q.id)).slice(0, QUIZ_SIZE);

  // Build a round: pick questions, shuffle option order, remember the mapping
  function buildRound(ids, mode) {
    const qs = ids.map(id => {
      const q = byId(id);
      const order = shuffle(Object.keys(q.options)); // original keys in shown order
      return { id, order, picked: null };            // picked = original key
    });
    return { mode, qs, idx: 0, startedAt: Date.now() };
  }

  // ---------- views ----------
  function home() {
    state = null;
    const hist = load(KEY.hist, []);
    const wrong = load(KEY.wrong, {});
    const wrongIds = Object.keys(wrong).filter(id => byId(id));
    const best = hist.length ? Math.max(...hist.map(h => Math.round(h.score / h.total * 100))) : null;
    const resume = load(KEY.cur, null);
    app.innerHTML = `
      <h1>${esc(TITLE)}</h1>
      <p class="sub">不需登入。每次隨機抽 ${Math.min(QUIZ_SIZE, BANK.length)} 題,紀錄只存在這個瀏覽器。</p>
      <div class="card stat">
        <div><b>${hist.length}</b>測驗次數</div>
        <div><b>${best === null ? '-' : best + '%'}</b>最高分</div>
        <div><b>${wrongIds.length}</b>錯題本</div>
      </div>
      <div class="grid">
        ${resume ? '<button class="btn pri" id="resume">繼續上次未完成的測驗</button>' : ''}
        <button class="btn pri" id="start">開始隨機測驗</button>
        <button class="btn" id="wrongPractice" ${wrongIds.length ? '' : 'disabled'}>練習錯題本(${wrongIds.length} 題)</button>
        <div class="grid two">
          <button class="btn" id="viewWrong">檢視錯題</button>
          <button class="btn" id="viewHist">歷史紀錄</button>
        </div>
      </div>
      <p class="note">換瀏覽器、使用無痕模式或清除網站資料,紀錄就會消失。可到「歷史紀錄」匯出備份。</p>`;
    document.getElementById('start').onclick = () => startRound(randomIds(), 'random');
    document.getElementById('wrongPractice').onclick = () => startRound(shuffle(wrongIds).slice(0, QUIZ_SIZE), 'wrong');
    document.getElementById('viewWrong').onclick = viewWrong;
    document.getElementById('viewHist').onclick = viewHist;
    if (resume) document.getElementById('resume').onclick = () => {
      // Drop questions that no longer exist in the bank before resuming
      resume.qs = resume.qs.filter(x => byId(x.id));
      if (!resume.qs.length) { localStorage.removeItem(KEY.cur); home(); return; }
      resume.idx = Math.min(resume.idx, resume.qs.length - 1);
      state = resume; renderQ();
    };
  }

  function startRound(ids, mode) {
    if (!ids.length) return;
    state = buildRound(ids, mode);
    save(KEY.cur, state);
    renderQ();
  }

  function renderQ() {
    const s = state, item = s.qs[s.idx], q = byId(item.id);
    const answered = s.qs.filter(x => x.picked).length;
    const opts = item.order.map((k, i) => `
      <button class="opt ${item.picked === k ? 'sel' : ''}" data-k="${k}">
        <span class="k">${'ABCD'[i]}</span><span>${esc(q.options[k])}</span>
      </button>`).join('');
    const dots = s.qs.map((x, i) => `<button data-i="${i}" class="${x.picked ? 'done' : ''} ${i === s.idx ? 'cur' : ''}">${i + 1}</button>`).join('');
    app.innerHTML = `
      <div class="row"><span class="sub">${s.mode === 'wrong' ? '錯題練習' : '隨機測驗'}・第 ${s.idx + 1} / ${s.qs.length} 題</span>
        <button class="btn" id="quit">離開</button></div>
      <div class="bar"><i style="width:${answered / s.qs.length * 100}%"></i></div>
      <div class="card">
        ${q.chapter ? `<span class="tag">${esc(q.chapter)}</span>` : ''}
        <div class="q">${esc(q.question)}</div>${opts}
      </div>
      <div class="row">
        <button class="btn" id="prev" ${s.idx === 0 ? 'disabled' : ''}>上一題</button>
        ${s.idx < s.qs.length - 1
          ? '<button class="btn pri" id="next">下一題</button>'
          : '<button class="btn pri" id="submit">交卷</button>'}
      </div>
      <div class="dots">${dots}</div>
      <p class="note">已作答 ${answered} / ${s.qs.length}。交卷前都可以修改答案。</p>`;
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => { item.picked = b.dataset.k; save(KEY.cur, s); renderQ(); });
    app.querySelectorAll('.dots button').forEach(b => b.onclick = () => { s.idx = +b.dataset.i; save(KEY.cur, s); renderQ(); });
    document.getElementById('prev').onclick = () => { s.idx--; save(KEY.cur, s); renderQ(); };
    const nx = document.getElementById('next'); if (nx) nx.onclick = () => { s.idx++; save(KEY.cur, s); renderQ(); };
    const sb = document.getElementById('submit'); if (sb) sb.onclick = submit;
    document.getElementById('quit').onclick = () => { if (confirm('離開後會保留目前進度,可從首頁繼續。')) home(); };
    window.scrollTo(0, 0);
  }

  function submit() {
    const s = state, left = s.qs.filter(x => !x.picked).length;
    if (left && !confirm(`還有 ${left} 題未作答,確定要交卷嗎?(未作答視為答錯)`)) return;
    const wrong = load(KEY.wrong, {});
    const items = s.qs.map(x => {
      const q = byId(x.id), ok = x.picked === q.answer;
      const w = wrong[x.id];
      if (!ok) wrong[x.id] = { streak: 0, misses: (w ? w.misses : 0) + 1, last: Date.now() };
      else if (w) { w.streak++; if (w.streak >= WRONG_CLEAR_STREAK) delete wrong[x.id]; }
      return { id: x.id, picked: x.picked, order: x.order, ok };
    });
    const rec = { t: Date.now(), mode: s.mode, total: items.length, score: items.filter(i => i.ok).length, items };
    const hist = load(KEY.hist, []); hist.unshift(rec);
    save(KEY.hist, hist.slice(0, 200)); save(KEY.wrong, wrong);
    localStorage.removeItem(KEY.cur);
    state = null;
    showResult(rec);
  }

  function reviewList(items) {
    return items.map((it, n) => {
      const q = byId(it.id); if (!q) return '';
      const opts = it.order.map((k, i) => {
        const cls = k === q.answer ? 'ok' : (k === it.picked ? 'bad' : '');
        const mark = k === q.answer ? '(正解)' : (k === it.picked ? '(你的答案)' : '');
        return `<div class="opt ${cls}"><span class="k">${'ABCD'[i]}</span><span>${esc(q.options[k])} ${mark}</span></div>`;
      }).join('');
      return `<div class="card"><span class="tag">${n + 1}</span><span class="tag">${it.ok ? '答對' : (it.picked ? '答錯' : '未作答')}</span>
        <div class="q">${esc(q.question)}</div>${opts}
        ${q.explanation ? `<div class="exp">${esc(q.explanation)}</div>` : ''}</div>`;
    }).join('');
  }

  function showResult(rec) {
    const pct = Math.round(rec.score / rec.total * 100);
    const wrongCount = rec.total - rec.score;
    app.innerHTML = `
      <h1>測驗結果</h1>
      <div class="card"><div class="score">${pct} 分</div>
        <p class="sub" style="text-align:center">答對 ${rec.score} / ${rec.total} 題</p></div>
      <div class="grid two">
        <button class="btn pri" id="again">再測一次</button>
        <button class="btn" id="home">回首頁</button>
      </div>
      ${wrongCount ? '<p class="note">答錯的題目已加入錯題本。</p>' : ''}
      <h1 style="margin-top:18px">逐題檢討</h1>${reviewList(rec.items)}`;
    document.getElementById('again').onclick = () => startRound(randomIds(), 'random');
    document.getElementById('home').onclick = home;
    window.scrollTo(0, 0);
  }

  function viewWrong() {
    const wrong = load(KEY.wrong, {});
    const ids = Object.keys(wrong).filter(id => byId(id));
    const list = ids.map(id => {
      const q = byId(id), w = wrong[id];
      return `<div class="card"><span class="tag">答錯 ${w.misses} 次</span><span class="tag">連續答對 ${w.streak} / ${WRONG_CLEAR_STREAK}</span>
        <div class="q">${esc(q.question)}</div>
        <div class="opt ok"><span class="k">✔</span><span>${esc(q.options[q.answer])}</span></div>
        ${q.explanation ? `<div class="exp">${esc(q.explanation)}</div>` : ''}</div>`;
    }).join('') || '<div class="card sub">目前沒有錯題,太棒了!</div>';
    app.innerHTML = `<div class="row"><h1>錯題本</h1><button class="btn" id="home">回首頁</button></div>
      <p class="sub">連續答對 ${WRONG_CLEAR_STREAK} 次的題目會自動移出。</p>${list}
      ${ids.length ? '<button class="btn pri" id="practice">練習這些錯題</button>' : ''}`;
    document.getElementById('home').onclick = home;
    const p = document.getElementById('practice'); if (p) p.onclick = () => startRound(shuffle(ids).slice(0, QUIZ_SIZE), 'wrong');
  }

  function viewHist() {
    const hist = load(KEY.hist, []);
    const rows = hist.map((h, i) => `<div class="hist"><span>${fmt(h.t)}・${h.mode === 'wrong' ? '錯題' : '隨機'}</span>
      <span><b>${Math.round(h.score / h.total * 100)} 分</b>(${h.score}/${h.total}) <a href="#" data-i="${i}">檢討</a></span></div>`).join('')
      || '<p class="sub">還沒有紀錄。</p>';
    app.innerHTML = `<div class="row"><h1>歷史紀錄</h1><button class="btn" id="home">回首頁</button></div>
      <div class="card">${rows}</div>
      <div class="grid two">
        <button class="btn" id="export">匯出備份</button>
        <label class="btn" style="text-align:center">匯入備份<input type="file" id="import" accept="application/json" hidden></label>
      </div>
      <button class="btn danger" id="clear" style="margin-top:10px">清除所有紀錄</button>`;
    document.getElementById('home').onclick = home;
    app.querySelectorAll('.hist a').forEach(a => a.onclick = e => { e.preventDefault(); showResult(hist[+a.dataset.i]); });
    document.getElementById('export').onclick = () => {
      const blob = new Blob([JSON.stringify({ history: load(KEY.hist, []), wrong: load(KEY.wrong, {}) }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'quiz-backup.json'; a.click(); URL.revokeObjectURL(a.href);
    };
    document.getElementById('import').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => {
        const d = JSON.parse(t);
        if (!Array.isArray(d.history) || typeof d.wrong !== 'object' || d.wrong === null) throw new Error('format');
        if (!confirm('匯入會覆蓋目前這個瀏覽器的紀錄,確定嗎?')) return;
        save(KEY.hist, d.history); save(KEY.wrong, d.wrong); viewHist();
      }).catch(() => alert('檔案格式不正確,匯入失敗。'));
    };
    document.getElementById('clear').onclick = () => {
      if (confirm('確定清除所有測驗紀錄與錯題本嗎?此動作無法復原。')) { [KEY.hist, KEY.wrong, KEY.cur].forEach(k => localStorage.removeItem(k)); home(); }
    };
  }

  // ---------- boot ----------
  // 'no-cache' = revalidate with the server on every load, so updated questions show up immediately
  fetch('questions.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(d => {
      BANK = d.questions || []; TITLE = d.title || TITLE; document.title = TITLE;
      const bad = BANK.filter(q => !q.id || !q.question || !q.options || !q.options[q.answer]);
      if (!BANK.length || bad.length) throw new Error('題庫格式錯誤:' + bad.map(q => q.id).join(','));
      home();
    })
    .catch(e => { app.innerHTML = `<div class="card"><b>無法載入題庫</b><p class="sub">${esc(e.message)}<br>請透過網站(http/https)開啟,直接用檔案開啟無法讀取題庫。</p></div>`; });
})();
