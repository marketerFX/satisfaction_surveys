/* ============================================
   SURVEY ANALYTICS DASHBOARD — app.js
   ============================================ */

// ── State ─────────────────────────────────────
let rawData = [];
let colMap  = {};   // { rating, comment, date, ...cats }
let chartRating = null;
let chartMonth  = null;

// ── DOM refs ──────────────────────────────────
const uploadOverlay  = document.getElementById('uploadOverlay');
const dashboard      = document.getElementById('dashboard');
const fileInput      = document.getElementById('fileInput');
const fileInputBar   = document.getElementById('fileInputBar');
const dropZone       = document.getElementById('dropZone');
const fileInfo       = document.getElementById('fileInfo');
const columnMapper   = document.getElementById('columnMapper');
const analyzeBtn     = document.getElementById('analyzeBtn');
const useDemoBtn     = document.getElementById('useDemoBtn');
const reUploadBtn    = document.getElementById('reUploadBtn');
const fileNameBar    = document.getElementById('fileNameBar');

// ── File upload events ─────────────────────────
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
fileInputBar.addEventListener('change', e => handleFile(e.target.files[0]));

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

analyzeBtn.addEventListener('click', () => buildDashboard());
reUploadBtn.addEventListener('click', () => {
  dashboard.classList.add('hidden');
  uploadOverlay.classList.remove('hidden');
  rawData = []; colMap = {};
  fileInfo.classList.add('hidden');
  columnMapper.classList.add('hidden');
  analyzeBtn.classList.add('hidden');
  fileInput.value = '';
});

useDemoBtn.addEventListener('click', () => {
  rawData  = generateDemoData();
  colMap   = { rating: '__rating', comment: '__comment', date: '__date' };
  buildDashboard();
});

// VoC filter
document.querySelectorAll('.voc-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.voc-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderVoC(btn.dataset.filter);
  });
});

// ── File handler ───────────────────────────────
function handleFile(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  reader.onload = e => {
    let data;
    if (ext === 'csv') {
      data = parseCSV(e.target.result);
    } else {
      const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      data = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' });
    }

    if (!data.length) { alert('ไม่พบข้อมูลในไฟล์'); return; }
    rawData = data;
    fileInfo.classList.remove('hidden');
    fileInfo.innerHTML = `✅ โหลดสำเร็จ: <strong>${file.name}</strong> — ${data.length} แถว, ${Object.keys(data[0]).length} คอลัมน์`;
    fileNameBar.textContent = file.name;
    renderColumnMapper(Object.keys(data[0]));
  };

  if (ext === 'csv') reader.readAsText(file, 'UTF-8');
  else reader.readAsBinaryString(file);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

// ── Column mapper UI ───────────────────────────
function renderColumnMapper(cols) {
  const opts = ['(ไม่ใช้)', ...cols].map(c => `<option value="${c}">${c}</option>`).join('');
  const autoR = cols.find(c => /rating|คะแนน|score|ดาว/i.test(c)) || '(ไม่ใช้)';
  const autoCo = cols.find(c => /comment|ความคิดเห็น|feedback|คิดเห็น|ข้อเสนอ/i.test(c)) || '(ไม่ใช้)';
  const autoDt = cols.find(c => /date|วันที่|เดือน|month|time/i.test(c)) || '(ไม่ใช้)';

  // detect category columns (numeric-looking)
  const catCols = cols.filter(c => {
    const sample = rawData.slice(0, 5).map(r => parseFloat(r[c])).filter(n => !isNaN(n));
    return sample.length >= 2 && sample.every(n => n >= 1 && n <= 5);
  });

  let catRows = catCols.map(c => `
    <div class="mapper-row">
      <label>📊 หมวด: <em>${c}</em></label>
      <select data-cat="${c}"><option value="${c}" selected>${c}</option></select>
    </div>`).join('');

  columnMapper.innerHTML = `
    <h4>🗂 จับคู่คอลัมน์</h4>
    <div class="mapper-row">
      <label>⭐ คะแนน (Rating)</label>
      <select id="mapRating">${opts.replace(`"${autoR}"`, `"${autoR}" selected`)}</select>
    </div>
    <div class="mapper-row">
      <label>💬 ความคิดเห็น</label>
      <select id="mapComment">${opts.replace(`"${autoCo}"`, `"${autoCo}" selected`)}</select>
    </div>
    <div class="mapper-row">
      <label>📅 วันที่ / เดือน</label>
      <select id="mapDate">${opts.replace(`"${autoDt}"`, `"${autoDt}" selected`)}</select>
    </div>
    ${catRows}
  `;
  columnMapper.classList.remove('hidden');
  analyzeBtn.classList.remove('hidden');
}

// ── Build Dashboard ────────────────────────────
function buildDashboard() {
  // read col map from selects (if not using demo)
  if (document.getElementById('mapRating')) {
    colMap.rating  = document.getElementById('mapRating').value;
    colMap.comment = document.getElementById('mapComment').value;
    colMap.date    = document.getElementById('mapDate').value;
    colMap.cats    = [...document.querySelectorAll('[data-cat]')].map(s => s.getAttribute('data-cat'));
  } else {
    colMap.cats = [];
  }

  uploadOverlay.classList.add('hidden');
  dashboard.classList.remove('hidden');

  document.getElementById('lastUpdated').textContent = 'อัปเดต: ' + new Date().toLocaleString('th-TH');

  renderKPIs();
  renderRatingChart();
  renderMonthChart();
  renderCategoryBars();
  renderVoC('all');
  renderInsights();
}

// ── Helpers ────────────────────────────────────
function getRating(row) {
  const v = parseFloat(row[colMap.rating] ?? row['__rating']);
  return isNaN(v) ? null : v;
}

function getComment(row) {
  return (row[colMap.comment] ?? row['__comment'] ?? '').toString().trim();
}

function getDate(row) {
  return (row[colMap.date] ?? row['__date'] ?? '').toString().trim();
}

function allRatings() {
  return rawData.map(getRating).filter(r => r !== null);
}

function stars(n) {
  const full = Math.round(n);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// ── KPIs ───────────────────────────────────────
function renderKPIs() {
  const ratings = allRatings();
  const total   = rawData.length;
  const avg     = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
  const promoters = ratings.filter(r => r === 5).length;
  const pct     = ratings.length ? ((promoters / ratings.length) * 100) : 0;
  const withComment = rawData.filter(r => getComment(r).length > 3).length;

  // KPI Total
  setText('kpiValueTotal', total);
  setText('kpiBadgeTotal', `+${total}`);
  setText('kpiSubTotal', `ทั้งหมด ${total} คำตอบ`);

  // KPI Rating
  setText('kpiValueRating', avg.toFixed(2) + ' / 5');
  setText('kpiBadgeRating', avg >= 4 ? `▲ ${avg.toFixed(2)}` : `▼ ${avg.toFixed(2)}`);
  document.getElementById('kpiBadgeRating').className = 'kpi-badge ' + (avg >= 4 ? 'positive' : 'negative');
  setText('kpiSubRating', `⭐ ${stars(avg)} ระดับความพึงพอใจ`);

  // KPI Promoter
  setText('kpiValuePromoter', pct.toFixed(1) + '%');
  setText('kpiBadgePromoter', `▲ ${pct.toFixed(1)}%`);
  setText('kpiSubPromoter', `${promoters} จาก ${ratings.length} ให้คะแนนสูงสุด`);

  // KPI Comments
  setText('kpiValueComments', withComment);
  const commentPct = total ? ((withComment / total) * 100).toFixed(1) : 0;
  setText('kpiBadgeComments', `+${withComment}`);
  setText('kpiSubComments', `${commentPct}% ของผู้ตอบให้ feedback`);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Rating Distribution Chart ──────────────────
function renderRatingChart() {
  const counts = [1,2,3,4,5].map(s => allRatings().filter(r => Math.round(r) === s).length);
  const ctx = document.getElementById('ratingChart').getContext('2d');
  if (chartRating) chartRating.destroy();
  chartRating = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['1★','2★','3★','4★','5★'],
      datasets: [{
        label: 'จำนวนคำตอบ',
        data: counts,
        backgroundColor: ['#f85149','#f0883e','#d29922','#58a6ff','#3fb950'],
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: chartOptions('จำนวน')
  });
}

// ── Month Chart ────────────────────────────────
function renderMonthChart() {
  const monthMap = {};
  const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  rawData.forEach(row => {
    const d = getDate(row);
    if (!d) return;
    const parsed = new Date(d);
    if (isNaN(parsed)) return;
    const key = thMonths[parsed.getMonth()] + ' ' + (parsed.getFullYear() + 543 - 2500 + 2500);
    monthMap[key] = (monthMap[key] || 0) + 1;
  });

  const labels = Object.keys(monthMap);
  const vals   = Object.values(monthMap);

  const ctx = document.getElementById('monthChart').getContext('2d');
  if (chartMonth) chartMonth.destroy();

  if (!labels.length) {
    // no date — show rating avg per row index grouped by 5s
    const buckets = [];
    const bLabels = [];
    for (let i = 0; i < rawData.length; i += Math.ceil(rawData.length / 8)) {
      const slice = rawData.slice(i, i + Math.ceil(rawData.length / 8));
      const avg = slice.map(getRating).filter(Boolean);
      buckets.push(avg.length ? avg.reduce((a,b)=>a+b,0)/avg.length : 0);
      bLabels.push(`กลุ่ม ${bLabels.length + 1}`);
    }
    chartMonth = new Chart(ctx, {
      type: 'line',
      data: { labels: bLabels, datasets: [{ label: 'คะแนนเฉลี่ย', data: buckets, borderColor: '#58a6ff', backgroundColor: 'rgba(88,166,255,0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#58a6ff', pointRadius: 4 }] },
      options: chartOptions('คะแนน')
    });
    return;
  }

  chartMonth = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'จำนวนคำตอบ',
        data: vals,
        borderColor: '#58a6ff',
        backgroundColor: 'rgba(88,166,255,0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#58a6ff',
        pointRadius: 4
      }]
    },
    options: chartOptions('คำตอบ')
  });
}

function chartOptions(yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e', font: { size: 11, family: 'Inter' } } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e', font: { size: 11, family: 'Inter' } }, title: { display: true, text: yLabel, color: '#8b949e', font: { size: 10 } } }
    }
  };
}

// ── Category Bars ──────────────────────────────
function renderCategoryBars() {
  const cats = colMap.cats || [];
  const section = document.getElementById('categorySection');
  const container = document.getElementById('categoryBars');
  container.innerHTML = '';

  if (!cats.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');

  cats.forEach(cat => {
    const scores = rawData.map(r => parseFloat(r[cat])).filter(n => !isNaN(n) && n >= 1 && n <= 5);
    if (!scores.length) return;
    const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
    const pct = ((avg - 1) / 4) * 100;

    const el = document.createElement('div');
    el.className = 'cat-item';
    el.innerHTML = `
      <div class="cat-label-row">
        <span class="cat-name">${cat}</span>
        <span class="cat-score">${avg.toFixed(2)} / 5</span>
      </div>
      <div class="cat-bar-bg">
        <div class="cat-bar-fill" style="width:0%" data-target="${pct.toFixed(1)}"></div>
      </div>`;
    container.appendChild(el);
  });

  // animate bars
  requestAnimationFrame(() => {
    container.querySelectorAll('.cat-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.target + '%';
    });
  });
}

// ── Voice of Customer ──────────────────────────
function renderVoC(filter) {
  const grid = document.getElementById('vocGrid');
  grid.innerHTML = '';

  let rows = rawData.filter(r => getComment(r).length > 3);

  if (filter === '5') rows = rows.filter(r => Math.round(getRating(r)) === 5);
  else if (filter === '4') rows = rows.filter(r => Math.round(getRating(r)) === 4);
  else if (filter === '3') rows = rows.filter(r => Math.round(getRating(r)) === 3);
  else if (filter === 'low') rows = rows.filter(r => getRating(r) !== null && getRating(r) <= 2);

  if (!rows.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:16px;">ไม่พบความคิดเห็นในกลุ่มนี้</p>';
    return;
  }

  rows.slice(0, 40).forEach(row => {
    const r = getRating(row);
    const c = getComment(row);
    const d = getDate(row);

    const card = document.createElement('div');
    card.className = 'voc-card';
    const starColor = r >= 4 ? '#3fb950' : r === 3 ? '#d29922' : '#f85149';
    card.innerHTML = `
      <div class="voc-stars" style="color:${starColor}">
        ${r !== null ? stars(r) : '—'}
        <span class="voc-rating-num">${r !== null ? r + '/5' : ''}</span>
      </div>
      <div class="voc-text">${escHtml(c)}</div>
      ${d ? `<div class="voc-meta">📅 ${d}</div>` : ''}
    `;
    grid.appendChild(card);
  });
}

// ── Key Insights ────────────────────────────────
function renderInsights() {
  const ratings = allRatings();
  const avg = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : 0;
  const promoters = ratings.filter(r => r === 5).length;
  const detractors = ratings.filter(r => r <= 2).length;
  const withComment = rawData.filter(r => getComment(r).length > 3).length;

  const insights = [];

  if (avg >= 4.5) insights.push({ icon: '🏆', title: 'คะแนนระดับดีเยี่ยม', desc: `คะแนนเฉลี่ย ${avg.toFixed(2)}/5 อยู่ในระดับดีเยี่ยม ผู้ใช้มีความพึงพอใจสูงมาก` });
  else if (avg >= 3.5) insights.push({ icon: '📈', title: 'คะแนนระดับดี', desc: `คะแนนเฉลี่ย ${avg.toFixed(2)}/5 อยู่ในระดับดี มีโอกาสพัฒนาเพิ่มเติมได้` });
  else insights.push({ icon: '⚠️', title: 'คะแนนต่ำกว่าเกณฑ์', desc: `คะแนนเฉลี่ย ${avg.toFixed(2)}/5 ควรทบทวนและปรับปรุงอย่างเร่งด่วน`, alert: true });

  const pPct = ratings.length ? ((promoters/ratings.length)*100).toFixed(1) : 0;
  insights.push({ icon: '🚀', title: `Promoters ${pPct}%`, desc: `${promoters} คน (${pPct}%) ให้คะแนนสูงสุด 5 ดาว — กลุ่มผู้สนับสนุนหลักของบริการ` });

  if (detractors > 0) {
    const dPct = ((detractors/ratings.length)*100).toFixed(1);
    insights.push({ icon: '🔴', title: `Detractors ${dPct}%`, desc: `${detractors} คน (${dPct}%) ให้คะแนน 1-2 ดาว ควรติดตามและแก้ไขข้อกังวล`, alert: true });
  }

  const cPct = rawData.length ? ((withComment/rawData.length)*100).toFixed(1) : 0;
  insights.push({ icon: '💬', title: `Engagement ${cPct}%`, desc: `${withComment} คน ให้ความคิดเห็นเพิ่มเติม — ข้อมูลเชิงลึกที่มีคุณค่าสำหรับการพัฒนา` });

  if (colMap.cats && colMap.cats.length) {
    const catAvgs = colMap.cats.map(cat => {
      const s = rawData.map(r => parseFloat(r[cat])).filter(n => !isNaN(n) && n >= 1 && n <= 5);
      return { cat, avg: s.length ? s.reduce((a,b)=>a+b,0)/s.length : 0 };
    });
    const best = catAvgs.sort((a,b)=>b.avg-a.avg)[0];
    const worst = catAvgs[catAvgs.length-1];
    if (best) insights.push({ icon: '🌟', title: `จุดแข็ง: ${best.cat}`, desc: `คะแนนเฉลี่ย ${best.avg.toFixed(2)}/5 — หมวดที่ได้รับการชื่นชมสูงสุด` });
    if (worst && worst.cat !== best.cat) insights.push({ icon: '🔧', title: `พัฒนา: ${worst.cat}`, desc: `คะแนนเฉลี่ย ${worst.avg.toFixed(2)}/5 — หมวดที่ควรให้ความสำคัญในการปรับปรุง`, alert: true });
  }

  const list = document.getElementById('insightsList');
  list.innerHTML = insights.map(ins => `
    <div class="insight-item" style="${ins.alert ? 'border-color:rgba(248,81,73,0.25);' : ''}">
      <div class="insight-icon">${ins.icon}</div>
      <div class="insight-body">
        <div class="insight-title">${ins.title}</div>
        <div class="insight-desc">${ins.desc}</div>
      </div>
    </div>`).join('');
}

// ── Demo Data ───────────────────────────────────
function generateDemoData() {
  const months = ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07'];
  const comments5 = ['ใช้งานง่าย ขอบคุณมาก','สวยมาก พัฒนาได้ดีมากเลย','ดีมาก ใช้งานได้ดีเยี่ยม','ตอบโจทย์มาก แนะนำให้เพื่อนใช้','โปรแกรมดีมาก ใช้งานง่ายมาก','ดี ใช้งานได้สะดวก','แนะนำได้เลย ดีมาก'];
  const comments4 = ['ดีมาก แต่ยังมีบางส่วนที่ปรับปรุงได้','ใช้งานดี แต่หน้าจอบางอันสับสนนิดนึง','ระบบดี แต่โหลดช้าเล็กน้อย','ดีมาก แค่อยากให้เพิ่ม feature เพิ่มเติม'];
  const comments3 = ['พอใช้ได้ แต่ยังมีปัญหาบางอย่าง','ปานกลาง ต้องปรับปรุงเรื่อง UI','ใช้ได้แต่ไม่ค่อยสะดวก'];
  const comments2 = ['มีปัญหาเรื่องความเร็ว','ใช้งานยาก ควรปรับปรุง UI ใหม่'];

  const data = [];
  const cats = ['ความง่ายในการใช้งาน','การออกแบบ UI','ความเร็ว','ฟีเจอร์ครบ'];

  for (let i = 0; i < 27; i++) {
    const rand = Math.random();
    let rating, comment;
    if (rand < 0.56) { rating = 5; comment = comments5[i % comments5.length]; }
    else if (rand < 0.78) { rating = 4; comment = comments4[i % comments4.length]; }
    else if (rand < 0.90) { rating = 3; comment = comments3[i % comments3.length]; }
    else { rating = Math.random() < 0.5 ? 2 : 1; comment = comments2[i % comments2.length]; }

    const row = {
      __rating: rating,
      __comment: i % 3 === 0 ? comment : comment,
      __date: months[i % months.length] + '-' + String(1 + (i % 28)).padStart(2,'0'),
    };
    cats.forEach(cat => {
      row[cat] = Math.min(5, Math.max(1, rating + (Math.random() * 1.4 - 0.7))).toFixed(1);
    });
    data.push(row);
  }
  colMap.cats = cats;
  return data;
}

// ── Utils ───────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
