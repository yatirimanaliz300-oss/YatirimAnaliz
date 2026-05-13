'use strict';
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:8000'
  : 'https://yatirimanalizapi.onrender.com';

// ===== TAB SLIDER NAVİGASYON =====
function tabGit(type, idx) {
  const track = document.getElementById(type + '-track');
  const tabs = document.getElementById(type + '-tabs');
  const counter = document.getElementById(type + '-counter');
  if (!track) return;
  const panels = track.querySelectorAll('.spanel');
  const tabBtns = tabs?.querySelectorAll('.stab');
  panels.forEach(p => { p.classList.remove('active'); p.style.animation = 'none'; });
  tabBtns?.forEach(t => t.classList.remove('active'));
  if (panels[idx]) { panels[idx].offsetHeight; panels[idx].style.animation = ''; panels[idx].classList.add('active'); }
  if (tabBtns?.[idx]) tabBtns[idx].classList.add('active');
  if (counter) counter.textContent = (idx + 1) + ' / ' + panels.length;
  // Chart.js gizli tab'dan açılınca resize gerektirir
  setTimeout(() => { window._yChart?.resize(); }, 50);
}
function tabNav(type, dir) {
  const track = document.getElementById(type + '-track');
  if (!track) return;
  const panels = track.querySelectorAll('.spanel');
  let cur = Array.from(panels).findIndex(p => p.classList.contains('active'));
  if (cur === -1) cur = 0;
  let next = cur + dir;
  if (next < 0) next = panels.length - 1;
  if (next >= panels.length) next = 0;
  tabGit(type, next);
}

// ===== AUTH (Firebase) =====
const auth = firebase.auth();
const db = firebase.firestore();

// Auth mesajlarını göster
function authMesaj(msg, tip) {
  var el = document.getElementById('auth-mesaj');
  if (!el) return;
  el.textContent = msg;
  el.className = 'auth-mesaj ' + (tip || 'hata');
  el.style.display = 'block';
  if (tip === 'basari') setTimeout(function(){ el.style.display='none'; }, 3000);
}

// Sekme değiştir
function authSekme(tab) {
  document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('auth-mesaj').style.display = 'none';
  if (tab === 'giris') {
    document.querySelectorAll('.auth-tab')[0].classList.add('active');
    document.getElementById('giris-form').style.display = '';
    document.getElementById('kayit-form').style.display = 'none';
  } else {
    document.querySelectorAll('.auth-tab')[1].classList.add('active');
    document.getElementById('giris-form').style.display = 'none';
    document.getElementById('kayit-form').style.display = '';
  }
}

// Kullanıcı bilgilerini Firestore'a kaydet
async function kullaniciyiKaydet(user, name) {
  try {
    await db.collection('users').doc(user.uid).set({
      name: name || user.displayName || 'Kullanıcı',
      email: user.email || '',
      type: user.isAnonymous ? 'misafir' : (user.providerData[0]?.providerId === 'google.com' ? 'google' : 'email'),
      registered: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch(e) { console.warn('Firestore kayıt hatası:', e); }
}

// Profil bilgilerini güncelle
async function profilGuncelle(user) {
  if (!user) { document.getElementById('login-overlay')?.classList.remove('gizli'); return; }
  document.getElementById('login-overlay')?.classList.add('gizli');

  var name = user.displayName || 'Kullanıcı';
  var email = user.email || (user.isAnonymous ? 'Misafir Hesap' : '-');

  // Firestore'dan ek bilgi çek
  try {
    var doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
      var d = doc.data();
      if (d.name) name = d.name;
    }
  } catch(e) {}

  var initials = name.split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0,2);
  document.getElementById('profile-name').textContent = name;
  document.getElementById('avatar-text').textContent = initials || 'YR';

  var hour = new Date().getHours();
  var selamlama = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi Günler' : 'İyi Akşamlar';
  var hg = document.getElementById('hero-greeting');
  if (hg) hg.textContent = selamlama + ', ' + name.split(' ')[0] + '!';

  var pi = document.getElementById('profil-isim'); if(pi) pi.textContent = name;
  var pi2 = document.getElementById('profil-isim2'); if(pi2) pi2.textContent = name;
  var pe = document.getElementById('profil-email'); if(pe) pe.textContent = email;
  var pe2 = document.getElementById('profil-email2'); if(pe2) pe2.textContent = email;
  var pa = document.getElementById('profil-avatar'); if(pa) pa.textContent = initials || 'YR';
  var pt = document.getElementById('profil-tarih');
  var regDate = user.metadata?.creationTime || new Date().toISOString();
  if(pt) pt.textContent = new Date(regDate).toLocaleDateString('tr-TR');
  var daysSince = Math.max(1, Math.floor((Date.now() - new Date(regDate).getTime()) / 86400000));
  var gunEl = document.getElementById('profil-stat-gun'); if(gunEl) gunEl.textContent = daysSince;
  var analizCount = parseInt(localStorage.getItem('yr_analiz_count') || '0');
  var analizEl = document.getElementById('profil-stat-analiz'); if(analizEl) analizEl.textContent = analizCount;
}

// Firebase auth durumu izle
auth.onAuthStateChanged(function(user) { profilGuncelle(user); });

function oturumKontrol() { profilGuncelle(auth.currentUser); }

// E-posta ile Kayıt
async function emailKayit(e) {
  e.preventDefault();
  var name = document.getElementById('kayit-name').value.trim();
  var email = document.getElementById('kayit-email').value.trim();
  var pass = document.getElementById('kayit-password').value;
  var pass2 = document.getElementById('kayit-password2').value;
  if (pass !== pass2) { authMesaj('Şifreler eşleşmiyor!', 'hata'); return; }
  if (pass.length < 6) { authMesaj('Şifre en az 6 karakter olmalı!', 'hata'); return; }

  var btn = document.getElementById('kayit-btn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kayıt olunuyor...';
  try {
    var cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    await kullaniciyiKaydet(cred.user, name);
    authMesaj('Kayıt başarılı! Hoş geldiniz.', 'basari');
  } catch(err) {
    var msg = 'Bir hata oluştu.';
    if (err.code === 'auth/email-already-in-use') msg = 'Bu e-posta zaten kayıtlı!';
    else if (err.code === 'auth/weak-password') msg = 'Şifre çok zayıf!';
    else if (err.code === 'auth/invalid-email') msg = 'Geçersiz e-posta adresi!';
    authMesaj(msg, 'hata');
  }
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Kayıt Ol';
}

// E-posta ile Giriş
async function emailGiris(e) {
  e.preventDefault();
  var email = document.getElementById('giris-email').value.trim();
  var pass = document.getElementById('giris-password').value;

  var btn = document.getElementById('giris-btn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Giriş yapılıyor...';
  try {
    var cred = await auth.signInWithEmailAndPassword(email, pass);
    await db.collection('users').doc(cred.user.uid).set({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } catch(err) {
    var msg = 'Giriş başarısız.';
    if (err.code === 'auth/user-not-found') msg = 'Bu e-posta kayıtlı değil!';
    else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Şifre yanlış!';
    else if (err.code === 'auth/invalid-email') msg = 'Geçersiz e-posta!';
    else if (err.code === 'auth/too-many-requests') msg = 'Çok fazla deneme! Biraz bekleyin.';
    authMesaj(msg, 'hata');
  }
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-arrow-right"></i> Giriş Yap';
}

// Google ile Giriş (Firebase Auth)
async function googleGiris() {
  try {
    var provider = new firebase.auth.GoogleAuthProvider();
    var result = await auth.signInWithPopup(provider);
    await kullaniciyiKaydet(result.user, result.user.displayName);
  } catch(err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      authMesaj('Google giriş hatası: ' + err.message, 'hata');
    }
  }
}

// Misafir Girişi (Firebase Anonymous Auth)
async function misafirGirisYap() {
  try {
    var result = await auth.signInAnonymously();
    await kullaniciyiKaydet(result.user, 'Misafir');
  } catch(err) {
    authMesaj('Misafir giriş hatası.', 'hata');
  }
}

// Çıkış
async function cikisYap(e) {
  if (e) e.preventDefault();
  try { await auth.signOut(); } catch(err) {}
  document.getElementById('profile-dropdown')?.classList.remove('acik');
}

function toggleProfileMenu() {
  document.getElementById('profile-dropdown')?.classList.toggle('acik');
}

// Dropdown dışına tıklayınca kapat
document.addEventListener('click', (e) => {
  const prof = document.getElementById('profile-btn');
  const dd = document.getElementById('profile-dropdown');
  if (dd && prof && !prof.contains(e.target)) {
    dd.classList.remove('acik');
  }
});

// ===== HİSSE GRAFİĞİ =====
var _hisseChart = null;
var _grafikCur = 'usd';
var _grafikLastData = null;
var _grafikUsdTry = null;

async function grafikCurrency(cur) {
  _grafikCur = cur;
  document.querySelectorAll('#grafik-currency-toggle .cur-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.cur === cur);
  });
  if (_grafikLastData) {
    await _getUsdTry();
    hisseGrafikCiz(_grafikLastData);
  }
}

async function _getUsdTry() {
  if (_grafikUsdTry) return _grafikUsdTry;
  try {
    var r = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    var d = await r.json();
    if (d && d.rates && d.rates.TRY) {
      _grafikUsdTry = d.rates.TRY;
      return _grafikUsdTry;
    }
  } catch(e) {}
  _grafikUsdTry = 38;
  return _grafikUsdTry;
}

function hisseGrafikSec(symbol) {
  document.getElementById('hisse-grafik-input').value = symbol;
  hisseGrafikYukle();
}

async function hisseGrafikYukle() {
  var sym = (document.getElementById('hisse-grafik-input').value || '').trim().toUpperCase();
  if (!sym) return;
  document.getElementById('hisse-grafik-loading').style.display = 'block';
  document.getElementById('hisse-grafik-sonuc').style.display = 'none';
  document.getElementById('hisse-grafik-error').style.display = 'none';
  var bosEl = document.getElementById('hisse-grafik-bos');
  if (bosEl) bosEl.style.display = 'none';
  try {
    var res = await fetch(API_BASE + '/api/prices/history/' + encodeURIComponent(sym));
    var data = await res.json();
    if (data.error) {
      document.getElementById('hisse-grafik-error-text').textContent = data.error;
      document.getElementById('hisse-grafik-error').style.display = 'block';
      document.getElementById('hisse-grafik-loading').style.display = 'none';
      return;
    }
    _grafikLastData = data;
    await _getUsdTry();
    hisseGrafikCiz(data);
  } catch(e) {
    document.getElementById('hisse-grafik-error-text').textContent = 'Bağlantı hatası.';
    document.getElementById('hisse-grafik-error').style.display = 'block';
  }
  document.getElementById('hisse-grafik-loading').style.display = 'none';
}

function hisseGrafikCiz(data) {
  document.getElementById('hisse-grafik-sonuc').style.display = 'block';
  var origCur = (data.currency || 'USD').toUpperCase();
  var wantTry = _grafikCur === 'try';
  var alreadyTry = origCur === 'TRY';
  var rate = (wantTry && !alreadyTry) ? (_grafikUsdTry || 38) : 1;
  var displayCur = wantTry ? 'TRY' : origCur;
  var curSymbol = displayCur === 'TRY' ? '₺' : (displayCur === 'USD' ? '$' : displayCur + ' ');

  var current = data.current * rate;
  var high = data.high_2y * rate;
  var low = data.low_2y * rate;
  var closes = data.closes.map(function(c) { return Math.round(c * rate * 100) / 100; });

  document.getElementById('hisse-grafik-title').textContent = data.name || data.symbol;
  document.getElementById('hisse-grafik-subtitle').textContent = data.symbol + ' · ' + displayCur;
  document.getElementById('hisse-grafik-price').textContent = curSymbol + current.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2});
  var chgEl = document.getElementById('hisse-grafik-change');
  var pct = data.change_pct;
  chgEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '% (2 Yıl)';
  chgEl.style.color = pct >= 0 ? 'var(--green)' : 'var(--red)';

  document.getElementById('hg-stat-high').textContent = curSymbol + high.toLocaleString('tr-TR', {minimumFractionDigits:2});
  document.getElementById('hg-stat-low').textContent = curSymbol + low.toLocaleString('tr-TR', {minimumFractionDigits:2});
  var chgStatEl = document.getElementById('hg-stat-change');
  chgStatEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
  chgStatEl.style.color = pct >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('hg-stat-currency').textContent = displayCur;

  // Grafik
  if (_hisseChart) _hisseChart.destroy();
  var ctx = document.getElementById('hisse-grafik-canvas').getContext('2d');
  var labels = data.dates.map(function(d) { return d.substring(0,7); });
  var isUp = pct >= 0;
  var gradient = ctx.createLinearGradient(0, 0, 0, 320);
  gradient.addColorStop(0, isUp ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  _hisseChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: data.symbol,
        data: closes,
        borderColor: isUp ? '#10b981' : '#ef4444',
        backgroundColor: gradient,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: isUp ? '#10b981' : '#ef4444',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,15,30,0.9)',
          titleColor: '#e2e8f0',
          bodyColor: '#fff',
          borderColor: 'rgba(201,168,76,0.3)',
          borderWidth: 1,
          callbacks: {
            label: function(c) { return curSymbol + c.parsed.y.toLocaleString('tr-TR', {minimumFractionDigits:2}) + ' ' + displayCur; }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: 'rgba(255,255,255,0.4)', maxTicksLimit: 12, font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 }, callback: function(v) { return v.toLocaleString('tr-TR'); } }
        }
      }
    }
  });
}

// Sayfa yüklenince oturum kontrol
document.addEventListener('DOMContentLoaded', () => {
  oturumKontrol();
});

function gitSayfa(page, e) {
  if (e) e.preventDefault();
  document.querySelectorAll('.topnav-link').forEach(l => {
    l.classList.remove('active');
    if (l.dataset.page === page) l.classList.add('active');
  });
  document.querySelectorAll('.sayfa').forEach(s => s.classList.remove('aktif'));
  const t = document.getElementById('sayfa-' + page);
  if (t) t.classList.add('aktif');
  document.querySelector('.topnav-links')?.classList.remove('mobil-acik');
}

function sifirla(type) {
  document.getElementById(type + '-giris').style.display = 'block';
  document.getElementById(type + '-yukleniyor').style.display = 'none';
  document.getElementById(type + '-sonuc').style.display = 'none';
  // Tab'ları sıfırla
  tabGit(type, 0);
  if (type === 'link') document.getElementById('link-url').value = '';
  else if (type === 'eposta') document.getElementById('eposta-icerik').value = '';
  else if (type === 'yatirim') {
    document.getElementById('yatirim-isim').value = '';
    if (window._yChart) { window._yChart.destroy(); window._yChart = null; }
    // Tier badge ve animasyonu sıfırla
    const tierBadge = document.getElementById('yatirim-tier-badge');
    if (tierBadge) tierBadge.style.display = 'none';
    const skorKutu = document.getElementById('yatirim-skor-kutu');
    if (skorKutu) skorKutu.classList.remove('skor-animated');
    // Gizlenebilir alanları sıfırla
    ['yatirim-ozet-wrap','yatirim-quick-stats','yatirim-pros-cons','yatirim-metrics-wrap','yatirim-oneri-wrap'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }
}

async function apiFetch(path, body) {
  try {
    const r = await fetch(API_BASE + path, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const data = await r.json();
    // Analiz sayacını artır
    if (path.startsWith('/analyze/')) {
      var cnt = parseInt(localStorage.getItem('yr_analiz_count') || '0') + 1;
      localStorage.setItem('yr_analiz_count', String(cnt));
    }
    return data;
  } catch(e) { console.error(e); return null; }
}

function esc(s) { if(!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderSonuc(type, data) {
  document.getElementById(type+'-yukleniyor').style.display = 'none';
  document.getElementById(type+'-sonuc').style.display = 'block';
  if (!data) { alert('Hata oluştu.'); sifirla(type); return; }

  document.getElementById(type+'-durum-yazi').textContent = data.status || '?';
  document.getElementById(type+'-skor-rakam').textContent = data.score ?? 0;
  const sk = document.getElementById(type+'-skor-kutu');
  if (sk) { sk.style.color = data.risk_color || '#06b6d4'; sk.style.borderColor = data.risk_color || '#06b6d4'; }
  if (type==='link') document.getElementById('link-hedef-url').textContent = data.target || '';

  // Site Amacı (sadece link)
  const siteAmac = document.getElementById(type+'-site-amaci');
  const amacMetin = document.getElementById(type+'-amac-metin');
  if (siteAmac && data.site_purpose) {
    amacMetin.textContent = data.site_purpose;
    siteAmac.style.display = 'block';
  }

  // Bulgular - kutu formatında
  const rac = document.getElementById(type+'-rac');
  if (rac) {
    if (data.reasons?.length) {
      rac.innerHTML = '<div style="padding:16px 28px;"><div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:16px 18px;">' +
        '<div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;display:flex;align-items:center;gap:6px;"><i class="fas fa-search"></i> Bulgular</div>' +
        data.reasons.map(r => '<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.85rem;color:var(--text-sec);"><i class="fas fa-circle" style="font-size:0.35rem;margin-top:7px;color:'+(data.risk_color||'var(--accent)')+'"></i> '+esc(r)+'</div>').join('') +
        '</div></div>';
    } else {
      rac.innerHTML = '<div style="padding:8px 28px;color:var(--text-muted);font-size:0.85rem;">Risk bulgusu tespit edilmedi.</div>';
    }
  }

  // Açıklama - kompakt kutu
  const ac = document.getElementById(type+'-aciklama');
  if (ac && data.explanation) {
    ac.innerHTML = '<div style="padding:0 28px 12px;"><div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:16px 18px;">' +
      '<div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><i class="fas fa-file-lines"></i> Detaylı Analiz</div>' +
      '<p style="font-size:0.86rem;color:var(--text-sec);line-height:1.7;margin:0;">'+esc(data.explanation)+'</p></div></div>';
  }

  // AI Yorumu
  const aiWrap = document.getElementById(type+'-ai-yorum-wrap');
  const aiText = document.getElementById(type+'-ai-yorum');
  if (aiWrap && data.ai_comment) {
    aiText.textContent = data.ai_comment;
    aiWrap.style.display = 'block';
  }

  // Eylem planı
  const eg = document.getElementById(type+'-eylem-grid');
  if (eg) eg.innerHTML = data.action_plan?.length ? data.action_plan.map(a=>'<div class="eylem-kart"><i class="fas fa-check-circle" style="color:var(--green);margin-right:8px"></i> '+esc(a)+'</div>').join('') : '<div class="eylem-kart">Eylem gerekmiyor.</div>';

  // Göstergeler
  const ag = document.getElementById(type+'-anomali-grid');
  if (ag) {
    let items = [];
    if (data.threat_type) items.push('<i class="fas fa-tag" style="color:'+(data.risk_color||'var(--accent)')+'"></i> '+data.threat_type);
    if (data.risk_level) items.push('<i class="fas fa-gauge-high" style="color:'+(data.risk_color||'var(--accent)')+'"></i> '+data.risk_level+' Risk');
    ag.innerHTML = items.length ? items.map(i=>'<div class="anomali-kart" style="display:flex;align-items:center;gap:8px;border-left:3px solid '+(data.risk_color||'var(--accent)')+';padding-left:10px;margin-bottom:8px">'+i+'</div>').join('') : '<div class="anomali-kart">Temiz.</div>';
  }
}

async function linkAnalizEt(e) {
  e.preventDefault();
  const u = document.getElementById('link-url').value.trim();
  if (!u) return;
  document.getElementById('link-giris').style.display = 'none';
  document.getElementById('link-yukleniyor').style.display = 'block';
  renderSonuc('link', await apiFetch('/analyze/link', {url:u}));
}

async function epostaAnalizEt(e) {
  e.preventDefault();
  const c = document.getElementById('eposta-icerik').value.trim();
  if (!c) return;
  document.getElementById('eposta-giris').style.display = 'none';
  document.getElementById('eposta-yukleniyor').style.display = 'block';
  renderSonuc('eposta', await apiFetch('/analyze/email', {content:c}));
}

// ===== SKOR ANİMASYONU =====
function animateScore(elementId, targetScore, duration) {
  duration = duration || 1200;
  const el = document.getElementById(elementId);
  if (!el) return;
  let start = null;
  const step = function(timestamp) {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    // easeOutQuart for smooth deceleration
    const eased = 1 - Math.pow(1 - progress, 4);
    el.textContent = Math.floor(eased * targetScore);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = targetScore;
  };
  requestAnimationFrame(step);
}

// ===== TIER HESAPLAMA =====
function getTier(score) {
  if (score >= 96) return { name: 'ELMAS', cls: 'tier-elmas', icon: 'fa-gem' };
  if (score >= 89) return { name: 'PLATİN', cls: 'tier-platin', icon: 'fa-crown' };
  if (score >= 76) return { name: 'ALTIN', cls: 'tier-altin', icon: 'fa-trophy' };
  if (score >= 61) return { name: 'GÜMÜŞ', cls: 'tier-gumus', icon: 'fa-medal' };
  if (score >= 41) return { name: 'BRONZ', cls: 'tier-bronz', icon: 'fa-medal' };
  if (score >= 21) return { name: 'RİSKLİ', cls: 'tier-riski', icon: 'fa-triangle-exclamation' };
  return { name: 'TEHLİKELİ', cls: 'tier-tehlike', icon: 'fa-skull-crossbones' };
}

async function yatirimAnalizEt(e) {
  e.preventDefault();
  const n = document.getElementById('yatirim-isim').value.trim();
  if (!n) return;
  document.getElementById('yatirim-giris').style.display = 'none';
  document.getElementById('yatirim-yukleniyor').style.display = 'block';
  const d = await apiFetch('/analyze/invest', {asset_name:n});
  document.getElementById('yatirim-yukleniyor').style.display = 'none';
  document.getElementById('yatirim-sonuc').style.display = 'block';
  if (!d) { alert('Hata.'); sifirla('yatirim'); return; }

  // Header
  document.getElementById('yatirim-hedef-isim').textContent = n.toUpperCase();
  document.getElementById('yatirim-durum-yazi').textContent = d.status || 'Analiz Tamamlandı';
  // Skor animasyonu
  const finalScore = d.score || 0;
  animateScore('yatirim-skor-rakam', finalScore, 1200);

  // Renk hesaplama
  let c = '#10b981';
  if (finalScore < 40) c = '#ef4444';
  else if (finalScore < 70) c = '#f59e0b';
  const skorKutu = document.getElementById('yatirim-skor-kutu');
  skorKutu.style.color = c;
  skorKutu.style.borderColor = c;
  skorKutu.classList.add('skor-animated');

  // Tier badge göster
  const tier = getTier(finalScore);
  const tierBadge = document.getElementById('yatirim-tier-badge');
  const tierIcon = document.getElementById('yatirim-tier-icon');
  const tierText = document.getElementById('yatirim-tier-text');
  if (tierBadge && tierIcon && tierText) {
    tierBadge.className = 'yatirim-tier-badge ' + tier.cls;
    tierIcon.className = 'fas ' + tier.icon;
    tierText.textContent = tier.name;
    tierBadge.style.display = 'inline-flex';
  }

  // Özet
  if (d.summary) {
    document.getElementById('yatirim-ozet').textContent = d.summary;
    document.getElementById('yatirim-ozet-wrap').style.display = 'block';
  }

  // Hızlı İstatistikler
  const colorMap = {
    'Düşük':'#10b981','Orta':'#f59e0b','Yüksek':'#ef4444','Çok Yüksek':'#ff1744',
    'Pozitif':'#10b981','Nötr':'#f59e0b','Negatif':'#ef4444',
    'Güçlü Yükseliş':'#10b981','Yükseliş':'#10b981','Yatay':'#f59e0b','Düşüş':'#ef4444','Güçlü Düşüş':'#ff1744'
  };
  const statsFields = [
    {id:'ys-risk-val', val:d.risk_level},
    {id:'ys-volatility-val', val:d.volatility},
    {id:'ys-sentiment-val', val:d.market_sentiment},
    {id:'ys-trend-val', val:d.trend},
    {id:'ys-horizon-val', val:d.investment_horizon},
    {id:'ys-category-val', val:d.category}
  ];
  let hasStats = false;
  statsFields.forEach(sf => {
    const el = document.getElementById(sf.id);
    if (el && sf.val) {
      el.textContent = sf.val;
      if (colorMap[sf.val]) el.style.color = colorMap[sf.val];
      hasStats = true;
    }
  });
  if (hasStats) document.getElementById('yatirim-quick-stats').style.display = 'block';

  // Hesaplayıcı
  document.getElementById('yatirim-hesap-metin').innerHTML = d.calculator_text || '';

  // Grafik
  if (window._yChart) window._yChart.destroy();
  const ctx = document.getElementById('yatirimChart').getContext('2d');
  window._yChart = new Chart(ctx, {
    type:'line',
    data:{ labels:['6 Ay','5 Ay','4 Ay','3 Ay','2 Ay','Şu An'], datasets:[{data:d.chart_data||[0,0,0,0,0,0], borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,0.15)', borderWidth:2, fill:true, tension:0.4, pointRadius:3, pointBackgroundColor:'#f59e0b'}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{display:false},x:{ticks:{color:'rgba(255,255,255,0.4)',font:{size:11}}}} }
  });

  // Avantajlar & Riskler
  if (d.pros?.length || d.cons?.length) {
    const prosEl = document.getElementById('yatirim-pros');
    const consEl = document.getElementById('yatirim-cons');
    if (prosEl) prosEl.innerHTML = (d.pros||[]).map(p=>'<div class="eylem-kart" style="display:flex;align-items:flex-start;gap:8px;"><i class="fas fa-circle-check" style="color:var(--green);margin-top:3px;font-size:0.7rem;flex-shrink:0;"></i> '+esc(p)+'</div>').join('');
    if (consEl) consEl.innerHTML = (d.cons||[]).map(r=>'<div class="eylem-kart" style="display:flex;align-items:flex-start;gap:8px;"><i class="fas fa-circle-xmark" style="color:var(--red);margin-top:3px;font-size:0.7rem;flex-shrink:0;"></i> '+esc(r)+'</div>').join('');
    document.getElementById('yatirim-pros-cons').style.display = 'block';
  }

  // Temel Metrikler
  if (d.key_metrics) {
    const km = d.key_metrics;
    const metrics = [
      {icon:'fa-arrow-up-right-dots', label:'Potansiyel Getiri', val:km.potential_return, color:'var(--green)'},
      {icon:'fa-scale-balanced', label:'Risk / Ödül', val:km.risk_reward, color:'var(--gold)'},
      {icon:'fa-earth-americas', label:'Piyasa Hakimiyeti', val:km.market_dominance, color:'var(--blue)'},
      {icon:'fa-droplet', label:'Likidite', val:km.liquidity, color:'var(--accent3)'}
    ];
    const mg = document.getElementById('yatirim-metrics');
    if (mg) {
      mg.innerHTML = metrics.map(m =>
        '<div class="yt-metric-item"><div class="yt-metric-icon" style="color:'+m.color+'"><i class="fas '+m.icon+'"></i></div><div><div class="yt-metric-label">'+m.label+'</div><div class="yt-metric-val">'+esc(m.val||'—')+'</div></div></div>'
      ).join('');
      document.getElementById('yatirim-metrics-wrap').style.display = 'block';
    }
  }

  // AI Tavsiyesi
  if (d.recommendation) {
    document.getElementById('yatirim-oneri').textContent = d.recommendation;
    document.getElementById('yatirim-oneri-wrap').style.display = 'block';
  }

  // Markdown Rapor
  document.getElementById('yatirim-markdown-alani').innerHTML = window.marked ? marked.parse(d.markdown||'') : d.markdown||'';
}

// ===== SPARKLINE MINI CHARTS =====
let _sparkInited = false;
const _sparkInstances = {};

function drawSparkline(id, data, color) {
  const el = document.getElementById(id);
  if (!el) return;
  if (_sparkInstances[id]) { _sparkInstances[id].destroy(); }
  _sparkInstances[id] = new Chart(el, {
    type:'line',
    data:{ labels:data.map((_,i)=>i), datasets:[{data, borderColor:color, backgroundColor:'transparent', borderWidth:1.5, pointRadius:0, tension:0.4}] },
    options:{ responsive:false, maintainAspectRatio:false, animation:false, plugins:{legend:{display:false},tooltip:{enabled:false}}, scales:{x:{display:false},y:{display:false}} }
  });
}

function updateCard(id, value, change, changeClass) {
  const card = document.getElementById(id)?.closest('.mini-chart-item');
  if (!card) return;
  const valEl = card.querySelector('.mc-value');
  const chgEl = card.querySelector('.mc-change');
  if (valEl) valEl.textContent = value;
  if (chgEl) {
    chgEl.className = 'mc-change ' + changeClass;
    const icon = changeClass === 'mc-up' ? 'fa-caret-up' : 'fa-caret-down';
    chgEl.innerHTML = `<i class="fas ${icon}"></i> ${change}`;
  }
}

async function fetchLiveMarket() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&sparkline=true&price_change_percentage=24h');
    const coins = await res.json();
    if (!Array.isArray(coins)) throw new Error('API yanıtı dizi değil');

    coins.forEach(coin => {
      const sparkData = coin.sparkline_in_7d?.price || [];
      const last20 = sparkData.slice(-20);
      const pctChange = coin.price_change_percentage_24h || 0;
      const isUp = pctChange >= 0;
      const changeStr = (isUp ? '+' : '') + pctChange.toFixed(1) + '%';
      const color = isUp ? '#10b981' : '#ef4444';

      if (coin.id === 'bitcoin') {
        updateCard('spark-btc', '$' + coin.current_price.toLocaleString('en-US'), changeStr, isUp ? 'mc-up' : 'mc-down');
        drawSparkline('spark-btc', last20, color);
      } else if (coin.id === 'ethereum') {
        updateCard('spark-eth', '$' + coin.current_price.toLocaleString('en-US'), changeStr, isUp ? 'mc-up' : 'mc-down');
        drawSparkline('spark-eth', last20, color);
      }
    });
  } catch(e) {
    console.warn('CoinGecko API hatası:', e);
    updateCard('spark-btc', '$104,250', '+2.1%', 'mc-up');
    updateCard('spark-eth', '$2,480', '+1.8%', 'mc-up');
    drawSparkline('spark-btc',[42,44,41,48,52,55,53,58,62,67],'#10b981');
    drawSparkline('spark-eth',[28,30,27,32,34,33,36,35,37,38],'#10b981');
  }

  // USD/TRY ve Altın - exchangerate API + yaklaşık veri
  try {
    const fxRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const fxData = await fxRes.json();
    const tryRate = fxData.rates?.TRY || 38.45;
    updateCard('spark-usd', '₺' + tryRate.toFixed(2), '+0.12%', 'mc-up');
    drawSparkline('spark-usd',[37.8,37.9,38.0,38.1,38.0,38.2,38.3,38.2,38.4,tryRate],'#10b981');
  } catch(e) {
    updateCard('spark-usd', '₺38.45', '+0.12%', 'mc-up');
    drawSparkline('spark-usd',[37.8,37.9,38.0,38.1,38.0,38.2,38.3,38.2,38.4,38.45],'#10b981');
  }

  // Altın yaklaşık veri
  updateCard('spark-gold', '$3,220', '+0.45%', 'mc-up');
  drawSparkline('spark-gold',[3100,3120,3150,3140,3180,3190,3200,3210,3215,3220],'#10b981');
}

// ===== PİYASA SAYFASI =====
let _piyasaLoaded = false;
let _piyasaCurrency = 'usd';
let _piyasaTRY = 38.45; // USD/TRY kuru
let _piyasaCoins = [];
let _piyasaGold = null;
let _piyasaStocks = null;
let _piyasaCommodities = null;

function setCurrency(cur) {
  _piyasaCurrency = cur;
  document.querySelectorAll('.cur-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.cur === cur);
  });
  renderPiyasaData();
}

function fmtPrice(usdVal) {
  if (_piyasaCurrency === 'try') {
    var v = usdVal * _piyasaTRY;
    return '₺' + v.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2});
  }
  return '$' + usdVal.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function fmtBig(usdVal) {
  var v = _piyasaCurrency === 'try' ? usdVal * _piyasaTRY : usdVal;
  var sym = _piyasaCurrency === 'try' ? '₺' : '$';
  if (v >= 1e12) return sym + (v/1e12).toFixed(1) + 'T';
  if (v >= 1e9) return sym + (v/1e9).toFixed(1) + 'B';
  if (v >= 1e6) return sym + (v/1e6).toFixed(1) + 'M';
  return sym + v.toLocaleString();
}

function piyasaCard(img, name, sub, price, pct, extra) {
  var isUp = pct >= 0;
  var clr = isUp ? 'var(--green)' : 'var(--red)';
  var ico = isUp ? 'fa-caret-up' : 'fa-caret-down';
  var imgHtml = img.startsWith('http') ?
    '<img src="'+img+'" alt="'+sub+'" style="width:30px;height:30px;border-radius:50%;">' :
    '<span style="font-size:1.4rem;">'+img+'</span>';
  var extraHtml = extra ?
    '<div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-muted);padding-top:8px;border-top:1px solid var(--border);">'+extra+'</div>' : '';
  return '<div class="piyasa-item">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;'+(extra?'margin-bottom:10px;':'')+'">' +
      '<div style="display:flex;align-items:center;gap:10px;">'+imgHtml+
        '<div><div style="font-weight:700;font-size:0.9rem;">'+name+'</div>' +
        '<div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;">'+sub+'</div></div>' +
      '</div>' +
      '<div style="text-align:right;">' +
        '<div style="font-weight:700;font-size:1rem;">'+price+'</div>' +
        '<div style="font-size:0.78rem;color:'+clr+';font-weight:600;"><i class="fas '+ico+'"></i> '+(isUp?'+':'')+pct.toFixed(2)+'%</div>' +
      '</div>' +
    '</div>'+extraHtml+'</div>';
}

function renderPiyasaData() {
  // --- KRİPTO ---
  var grid = document.getElementById('kripto-grid');
  if (grid && _piyasaCoins.length) {
    grid.innerHTML = _piyasaCoins.map(function(c) {
      return piyasaCard(c.image, c.name, c.symbol,
        fmtPrice(c.current_price), c.price_change_percentage_24h || 0,
        '<span>Hacim: '+fmtBig(c.total_volume)+'</span><span>P. Değeri: '+fmtBig(c.market_cap)+'</span>');
    }).join('');
  }

  // --- DÖVİZ ---
  var dovizItems = [
    { name:'USD / TRY', flag:'🇺🇸', rate: _piyasaTRY },
    { name:'EUR / TRY', flag:'🇪🇺', rate: _piyasaTRY * (_piyasaFxRates['EUR'] || 1.087) },
    { name:'GBP / TRY', flag:'🇬🇧', rate: _piyasaTRY * (_piyasaFxRates['GBP'] || 1.265) },
    { name:'CHF / TRY', flag:'🇨🇭', rate: _piyasaTRY * (_piyasaFxRates['CHF'] || 1.13) },
    { name:'JPY / TRY', flag:'🇯🇵', rate: _piyasaTRY / (_piyasaFxRates['JPY_INV'] || 149.5) }
  ];
  var dg = document.getElementById('doviz-grid');
  if (dg) {
    dg.innerHTML = dovizItems.map(function(d) {
      return '<div class="piyasa-item">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<div style="display:flex;align-items:center;gap:12px;">' +
            '<span style="font-size:1.6rem;">'+d.flag+'</span>' +
            '<div><div style="font-weight:700;font-size:0.9rem;">'+d.name+'</div>' +
            '<div style="font-size:0.68rem;color:var(--text-muted);">1 birim karşılığı</div></div>' +
          '</div>' +
          '<div style="font-weight:700;font-size:1.1rem;color:var(--accent);">₺'+d.rate.toFixed(4)+'</div>' +
        '</div></div>';
    }).join('');
  }

  // --- ALTIN ---
  var ag = document.getElementById('altin-grid');
  if (ag && _piyasaGold && _piyasaGold.types) {
    ag.innerHTML = _piyasaGold.types.map(function(a) {
      return piyasaCard(a.icon, a.name, '', fmtPrice(a.price_usd), a.change, '');
    }).join('');
  }

  // --- HİSSE ---
  var hisseMeta = {
    'AAPL':{name:'Apple',icon:'🍎'},'MSFT':{name:'Microsoft',icon:'🪟'},'NVDA':{name:'NVIDIA',icon:'🟢'},
    'TSLA':{name:'Tesla',icon:'⚡'},'AMZN':{name:'Amazon',icon:'📦'},'GOOGL':{name:'Google',icon:'🔍'},
    'GARAN.IS':{name:'Garanti BBVA',icon:'🏦'},'THYAO.IS':{name:'THY',icon:'✈️'},
    'KCHOL.IS':{name:'Koç Holding',icon:'🏢'},'AKBNK.IS':{name:'Akbank',icon:'🏦'}
  };
  var hg = document.getElementById('hisse-grid');
  if (hg && _piyasaStocks) {
    var syms = ['AAPL','MSFT','NVDA','TSLA','AMZN','GOOGL','GARAN.IS','THYAO.IS','KCHOL.IS','AKBNK.IS'];
    hg.innerHTML = syms.map(function(s) {
      var d = _piyasaStocks[s] || {price:0, change:0};
      var m = hisseMeta[s] || {name:s, icon:'📊'};
      return piyasaCard(m.icon, m.name, s, fmtPrice(d.price), d.change, '');
    }).join('');
  }

  // --- EMTİA ---
  var eg = document.getElementById('emtia-grid');
  if (eg && _piyasaCommodities && Array.isArray(_piyasaCommodities)) {
    eg.innerHTML = _piyasaCommodities.map(function(d) {
      return piyasaCard(d.icon, d.name, '', fmtPrice(d.price_usd), d.change, '');
    }).join('');
  }

  var upd = document.getElementById('piyasa-son-guncelleme');
  if (upd) upd.textContent = 'Son güncelleme: ' + new Date().toLocaleTimeString('tr-TR');
}

let _piyasaFxRates = {};

async function populatePiyasaPage() {
  // Döviz kuru al
  try {
    var fxRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    var fxData = await fxRes.json();
    _piyasaTRY = fxData.rates?.TRY || 38.45;
    // Çapraz kurlar için oranları sakla
    var eur = fxData.rates?.EUR || 0.92;
    var gbp = fxData.rates?.GBP || 0.79;
    var chf = fxData.rates?.CHF || 0.88;
    var jpy = fxData.rates?.JPY || 149.5;
    _piyasaFxRates = { EUR: 1/eur, GBP: 1/gbp, CHF: 1/chf, JPY_INV: jpy };
  } catch(e) { console.warn('Döviz kuru hatası:', e); }

  // Kripto verileri - CoinGecko
  try {
    var res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,binancecoin,solana,ripple,dogecoin,cardano,polkadot,avalanche-2,chainlink,toncoin,shiba-inu&order=market_cap_desc&per_page=12&page=1&sparkline=false&price_change_percentage=24h');
    var data = await res.json();
    if (Array.isArray(data) && data.length) _piyasaCoins = data;
  } catch(e) {
    console.warn('Kripto verisi hatası:', e);
    var kg = document.getElementById('kripto-grid');
    if (kg) kg.innerHTML = '<div class="piyasa-item" style="grid-column:1/-1;text-align:center;color:var(--text-muted);"><i class="fas fa-exclamation-triangle" style="margin-right:6px;"></i>Kripto verileri yüklenemedi.</div>';
  }

  renderPiyasaData();

  // Canlı Altın Verileri (backend)
  try {
    var goldRes = await fetch(API_BASE + '/api/prices/gold');
    _piyasaGold = await goldRes.json();
  } catch(e) {
    console.warn('Altın verisi hatası:', e);
    var ag2 = document.getElementById('altin-grid');
    if (ag2) ag2.innerHTML = '<div class="piyasa-item" style="grid-column:1/-1;text-align:center;color:var(--text-muted);"><i class="fas fa-exclamation-triangle" style="margin-right:6px;"></i>Altın verileri yüklenemedi.</div>';
  }

  // Canlı Hisse Verileri (backend)
  try {
    var stockRes = await fetch(API_BASE + '/api/prices/stocks');
    _piyasaStocks = await stockRes.json();
  } catch(e) {
    console.warn('Hisse verisi hatası:', e);
    var hg2 = document.getElementById('hisse-grid');
    if (hg2) hg2.innerHTML = '<div class="piyasa-item" style="grid-column:1/-1;text-align:center;color:var(--text-muted);"><i class="fas fa-exclamation-triangle" style="margin-right:6px;"></i>Hisse verileri yüklenemedi.</div>';
  }

  // Canlı Emtia Verileri (backend)
  try {
    var comRes = await fetch(API_BASE + '/api/prices/commodities');
    var comData = await comRes.json();
    if (Array.isArray(comData)) _piyasaCommodities = comData;
  } catch(e) {
    console.warn('Emtia verisi hatası:', e);
    var eg2 = document.getElementById('emtia-grid');
    if (eg2) eg2.innerHTML = '<div class="piyasa-item" style="grid-column:1/-1;text-align:center;color:var(--text-muted);"><i class="fas fa-exclamation-triangle" style="margin-right:6px;"></i>Emtia verileri yüklenemedi.</div>';
  }

  // Tüm verileri renderla
  renderPiyasaData();

  _piyasaLoaded = true;
}

// Sayfa değiştiğinde piyasa verisini yükle
var _origGitSayfa = gitSayfa;
gitSayfa = function(page, e) {
  _origGitSayfa(page, e);
  if (page === 'piyasa' && !_piyasaLoaded) {
    populatePiyasaPage();
  }
};

// Ana sayfa nabız widgetı
async function loadMarketPulse() {
  var el = document.getElementById('market-pulse-text');
  if (!el) return;
  try {
    var r = await fetch(API_BASE + '/analyze/market_pulse', {method:'POST'});
    var d = await r.json();
    el.textContent = d.pulse_text || 'Piyasa verileri yükleniyor...';
    var sentEl = document.getElementById('market-pulse-sentiment');
    if (sentEl && d.sentiment) {
      sentEl.textContent = d.sentiment;
      var colors = {'Pozitif':'var(--green)','Negatif':'var(--red)','Kararsız':'var(--gold)','Bekle-Gör':'var(--blue)'};
      sentEl.style.color = colors[d.sentiment] || 'var(--text-sec)';
    }
    var focusEl = document.getElementById('market-pulse-focus');
    if (focusEl && d.focus_asset) focusEl.textContent = d.focus_asset;
  } catch(e) { console.warn('Nabız hatası:', e); }
}

// Ticker güncelle (TL cinsinden)
let _tickerData = {};
function updateTickerValues() {
  document.querySelectorAll('.tick-val').forEach(function(el) {
    var key = el.dataset.tick;
    if (_tickerData[key]) el.textContent = _tickerData[key];
  });
}
async function fetchTickerData() {
  var tryRate = _piyasaTRY || 38.45;
  // BTC & ETH - CoinGecko
  try {
    var r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=try');
    var d = await r.json();
    if (d.bitcoin) _tickerData.btc = '₺' + Math.round(d.bitcoin.try).toLocaleString('tr-TR');
    if (d.ethereum) _tickerData.eth = '₺' + Math.round(d.ethereum.try).toLocaleString('tr-TR');
  } catch(e) {}
  // USD/TRY
  _tickerData.usd = '₺' + tryRate.toFixed(2);
  // Altın & Hisseler (backend)
  try {
    var gRes = await fetch(API_BASE + '/api/prices/gold');
    var gData = await gRes.json();
    if (gData.gram_usd) _tickerData.gold = '₺' + Math.round(gData.gram_usd * tryRate).toLocaleString('tr-TR') + '/gr';
  } catch(e) {}
  try {
    var sRes = await fetch(API_BASE + '/api/prices/stocks');
    var sData = await sRes.json();
    if (sData['AAPL']) _tickerData.aapl = '₺' + Math.round(sData['AAPL'].price * tryRate).toLocaleString('tr-TR');
    if (sData['NVDA']) _tickerData.nvda = '₺' + Math.round(sData['NVDA'].price * tryRate).toLocaleString('tr-TR');
  } catch(e) {}
  updateTickerValues();
}

// Bento card glow mouse tracking
document.addEventListener('mousemove', function(e) {
  document.querySelectorAll('.bento-card.glow-border').forEach(function(card) {
    var rect = card.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', x + 'px');
    card.style.setProperty('--mouse-y', y + 'px');
  });
});

// Counter animasyonu
function animateCounters() {
  document.querySelectorAll('.counter[data-target]').forEach(function(el) {
    var target = parseInt(el.dataset.target);
    var current = 0;
    var step = Math.ceil(target / 30);
    var timer = setInterval(function() {
      current += step;
      if (current >= target) { current = target; clearInterval(timer); }
      el.textContent = current;
    }, 50);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (_sparkInited) return;
  _sparkInited = true;
  fetchLiveMarket();
  setInterval(fetchLiveMarket, 60000);
  // Ticker'ı TL fiyatlarıyla güncelle
  setTimeout(fetchTickerData, 1000);
  setInterval(fetchTickerData, 90000);
  setTimeout(populatePiyasaPage, 2000);
  animateCounters();
  setTimeout(loadMarketPulse, 1500);
});


