# 🛡️ Yatırım Analiz — AI Destekli Finansal Analiz & Siber Güvenlik Platformu

**Yapay zeka destekli yatırım analizi, dolandırıcılık tespiti ve canlı piyasa takip platformu.**

🌐 **Canlı Demo:** [https://yatirim-analiz-60958.web.app](https://yatirim-analiz-60958.web.app)

---

## 📋 Proje Açıklaması

Yatırım Analiz, bireysel yatırımcılara kurumsal düzeyde analiz ve koruma araçları sunan, tamamen yapay zeka destekli bir finansal analiz platformudur. Platform 4 ana modülden oluşur:

1. **Link Analizi** — Şüpheli yatırım sitelerinin URL yapısını, SSL sertifikasını ve alan adı geçmişini AI ile tarar. Phishing, malware ve scam sitelerini anlık olarak tespit eder.

2. **Mesaj Analizi** — Gelen e-posta, SMS ve sosyal medya mesajlarındaki dolandırıcılık kalıplarını, sahte yatırım tekliflerini ve kimlik avı girişimlerini yapay zeka ile analiz eder.

3. **AI Yatırım Analizi** — Kripto paralar, hisse senetleri ve halka arz projelerinin geçmiş performansını, piyasa duyarlılığını ve balon riskini analiz eder. Risk skoru, trend analizi ve kapsamlı yatırım raporu sunar.

4. **Grafik Analiz** — Hisse, kripto, emtia ve döviz varlıklarının son 2 yıllık fiyat performansını interaktif grafiklerle inceleyin. 100+ varlık desteği, USD/TRY dönüşümü ve detaylı teknik istatistikler.

Ek olarak **Canlı Piyasa Verileri** modülü ile kripto, hisse, altın, döviz ve emtia fiyatlarını gerçek zamanlı takip edebilirsiniz.

---

## 🚀 Kullanılan Teknolojiler

| Katman | Teknoloji | Açıklama |
|--------|-----------|----------|
| **Frontend** | HTML5, CSS3, JavaScript (Vanilla SPA) | Tek sayfa uygulama, dark finance tema, glassmorphism tasarım |
| **Backend** | Python, FastAPI | RESTful API, async yapı, rate limiting |
| **AI Motor 1** | Google Gemini 2.0 Flash | Birincil analiz motoru — link, mesaj ve yatırım analizi |
| **AI Motor 2** | Groq (LLaMA 3) | Yedek AI motoru — Gemini başarısız olursa otomatik devreye girer |
| **Grafik** | Chart.js | İnteraktif fiyat grafikleri ve sparkline'lar |
| **Piyasa Verisi** | yfinance, CoinGecko API | Hisse, kripto, emtia ve döviz fiyatları |
| **Döviz Kuru** | ExchangeRate API | Gerçek zamanlı USD/TRY dönüşümü |
| **Auth** | Firebase Authentication | E-posta/şifre, Google girişi ve misafir modu |
| **Veritabanı** | Firebase Firestore | Kullanıcı profilleri ve analiz geçmişi |
| **Hosting** | Firebase Hosting | Frontend dağıtımı |
| **Backend Hosting** | Render | FastAPI backend deploy |
| **Markdown** | Marked.js | AI raporlarını zengin HTML olarak render etme |

---

## ✨ Özellikler

- 🔗 **URL Risk Taraması** — Phishing, scam ve malware tespiti
- 📧 **Mesaj Dolandırıcılık Analizi** — Sahte yatırım teklifleri ve kimlik avı tespiti
- 📊 **Kapsamlı Yatırım Raporu** — Risk skoru, trend, balon riski ve eylem planı
- 📈 **2 Yıllık Fiyat Grafikleri** — ABD hisseleri, BIST, kripto, emtia, döviz
- 💱 **USD / TRY Para Birimi Dönüşümü** — Anlık kur ile TL karşılığı
- 🔄 **Canlı Piyasa Verileri** — Gerçek zamanlı fiyat ve değişim oranları
- 🤖 **Çift AI Motor** — Gemini + Groq yedeklemeli yapı
- 🔐 **Firebase Auth** — Güvenli kullanıcı girişi
- 📱 **Responsive Tasarım** — Mobil ve masaüstü uyumlu
- 🌙 **Dark Mode** — Göz dostu karanlık tema

---

## 📸 Ekran Görüntüleri

> Demo videosu için: *(YouTube linki eklenecek)*

---

## 🛠️ Kurulum & Çalıştırma

### Gereksinimler
- Python 3.10+
- Node.js (Firebase CLI için)
- Firebase hesabı
- Gemini API Key
- Groq API Key

### Backend (Lokal)

```bash
# Bağımlılıkları yükle
pip install -r requirements.txt

# Ortam değişkenlerini ayarla
set GEMINI_API_KEY=your_key_here
set GROQ_API_KEY=your_key_here

# Sunucuyu başlat
uvicorn main:app --reload --port 8000
```

### Frontend (Lokal)

```bash
# Firebase CLI yükle
npm install -g firebase-tools

# Giriş yap
firebase login

# Lokal sunucu
firebase serve
```

### Deploy

```bash
# Frontend deploy
firebase deploy --only hosting

# Backend deploy (Render - otomatik GitHub entegrasyonu)
git push origin main
```

---

## 📁 Proje Yapısı

```
YatirimAnaliz/
├── index.html          # Ana SPA sayfası (tüm modüller)
├── style.css           # Tüm stiller (dark theme, glassmorphism)
├── script.js           # Frontend mantığı (auth, grafik, analiz)
├── main.py             # FastAPI backend (AI analiz, piyasa verisi)
├── requirements.txt    # Python bağımlılıkları
├── Procfile            # Render deploy konfigürasyonu
├── firebase.json       # Firebase hosting ayarları
├── .firebaserc         # Firebase proje ID
├── favicon.svg         # Site ikonu
└── README.md           # Bu dosya
```

---

## 🌐 Canlı Linkler

- **Platform:** https://yatirim-analiz-60958.web.app
- **Backend API:** https://yatirimanalizapi.onrender.com
- **API Docs:** https://yatirimanalizapi.onrender.com/docs

---

## 👤 Geliştirici

Yapay zeka destekli finansal analiz ve siber güvenlik platformu.

---

## 📄 Lisans

Bu proje yarışma kapsamında geliştirilmiştir. Tüm hakları saklıdır.

© 2025 Yatırım Analiz
