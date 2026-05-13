import json
import os
import asyncio
import functools
import time
from pathlib import Path
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from urllib.parse import urlparse

try:
    import yfinance as yf
    _YF_OK = True
    print("[OK] yfinance aktif.")
except ImportError:
    _YF_OK = False
    print("[WARN] yfinance bulunamadı. Canlı fiyatlar devre dışı.")

# --- Price Cache ---
_price_cache: Dict[str, Any] = {}
_CACHE_TTL = 300  # 5 dakika

# --- AI Setup ---
try:
    from google import genai as _genai
    _gemini_keys = [os.getenv("GOOGLE_API_KEY", "").strip()]
    _gemini_keys = [k for k in _gemini_keys if k]
    _GEMINI_CLIENTS = [_genai.Client(api_key=key) for key in _gemini_keys]
    _GEMINI_CLIENT_INDEX = 0
    print(f"[OK] Gemini aktif. Anahtar sayısı: {len(_GEMINI_CLIENTS)}")
except:
    _GEMINI_CLIENTS = []

try:
    from groq import Groq as _GroqClient
    _groq_keys = [os.getenv("GROQ_API_KEY", "").strip()]
    _groq_keys = [k for k in _groq_keys if k]
    _GROQ_CLIENTS = [_GroqClient(api_key=k) for k in _groq_keys]
    if _GROQ_CLIENTS:
        print(f"[OK] Groq aktif. Anahtar sayısı: {len(_GROQ_CLIENTS)}")
except:
    _GROQ_CLIENTS = []

GEMINI_MODELS = ["models/gemini-2.0-flash", "models/gemini-2.0-flash-lite"]
_GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

URL_SHORTENERS = frozenset({"bit.ly", "tinyurl.com", "t.co", "goo.gl"})
RISKY_TLDS = frozenset({".xyz", ".tk", ".ml", ".ga", ".pw", ".top"})

STYLE_PROMPT = """
YAZIM KURALLARI: Sadece profesyonel Türkçe. Sadece JSON formatında çıktı ver.
"""

# --- Schemas ---
class LinkRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)
    @field_validator("url")
    @classmethod
    def check_url(cls, v: str) -> str:
        v = v.strip()
        if v and "://" not in v: return f"https://{v}"
        return v

class EmailRequest(BaseModel):
    content: str = Field(..., min_length=5, max_length=50_000)

class InvestRequest(BaseModel):
    asset_name: str = Field(..., min_length=1, max_length=500)

class AnalysisResult(BaseModel):
    score: int
    status: str
    type: str
    target: str
    threat_type: str = "Şüpheli İçerik"
    explanation: str = ""
    reasons: List[str] = []
    action_plan: List[str] = []
    risk_level: str = "Orta"
    risk_color: str = "#ffab00"
    model_config = {"extra": "allow"}

# --- FastAPI App ---
BASE_DIR = Path(__file__).resolve().parent
limiter = Limiter(key_func=get_remote_address, default_limits=["300/hour"])

app = FastAPI(title="Yatırım & Siber Analiz Platformu")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.mount("/static", StaticFiles(directory=str(BASE_DIR)), name="static")

@app.get("/")
async def read_index():
    return FileResponse(str(BASE_DIR / "index.html"))

@app.get("/script.js")
async def read_script():
    return FileResponse(str(BASE_DIR / "script.js"))

@app.get("/style.css")
async def read_style():
    return FileResponse(str(BASE_DIR / "style.css"))

@app.get("/favicon.svg")
async def read_favicon():
    return FileResponse(str(BASE_DIR / "favicon.svg"))

def clean_json(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        return text[start: end + 1].strip()
    return "{}"

async def run_gemini(prompt: str) -> Optional[dict]:
    if not _GEMINI_CLIENTS: return None
    global _GEMINI_CLIENT_INDEX
    client = _GEMINI_CLIENTS[_GEMINI_CLIENT_INDEX % len(_GEMINI_CLIENTS)]
    _GEMINI_CLIENT_INDEX += 1
    for model in GEMINI_MODELS:
        try:
            _fn = functools.partial(client.models.generate_content, model=model, contents=prompt)
            loop = asyncio.get_running_loop()
            resp = await asyncio.wait_for(loop.run_in_executor(None, _fn), timeout=30.0)
            return json.loads(clean_json(resp.text or ""))
        except Exception as e:
            print(f"[WARN] Gemini {model} hata: {e}")
            continue
    return None

async def run_groq(prompt: str) -> Optional[dict]:
    if not _GROQ_CLIENTS: return None
    for client in _GROQ_CLIENTS:
        for model in _GROQ_MODELS:
            try:
                _fn = functools.partial(client.chat.completions.create, model=model, messages=[{"role": "user", "content": prompt}], response_format={"type": "json_object"})
                loop = asyncio.get_running_loop()
                resp = await asyncio.wait_for(loop.run_in_executor(None, _fn), timeout=30.0)
                return json.loads(clean_json(resp.choices[0].message.content or ""))
            except Exception as e:
                err_str = str(e)
                # Groq bazen JSON üretir ama validation'dan geçemez, failed_generation'ı parse edelim
                if "failed_generation" in err_str:
                    try:
                        import re
                        fg_match = re.search(r"'failed_generation':\s*'(.*?)'", err_str, re.DOTALL)
                        if fg_match:
                            fg_text = fg_match.group(1).replace("\\n", "\n")
                            return json.loads(clean_json(fg_text))
                    except:
                        pass
                print(f"[WARN] Groq {model} hata: {e}")
                continue
    return None

async def run_ai(prompt: str) -> Optional[dict]:
    res = await run_gemini(prompt)
    if res: return res
    return await run_groq(prompt)

def _enrich(raw: dict, atype: str, target: str) -> AnalysisResult:
    score = max(0, min(100, int(raw.get("score", 0))))
    st = raw.get("status", "").strip().lower()
    if st in ("güvenli", "temiz") and score > 50: score = 100 - score
    
    color = "#00e676" if score <= 20 else "#ffab00" if score <= 50 else "#ff6d00" if score <= 80 else "#ff1744"
    level = "Düşük" if score <= 20 else "Orta" if score <= 50 else "Yüksek" if score <= 80 else "Kritik"
    status_text = "Güvenli" if score <= 20 else "Şüpheli" if score <= 50 else "Tehlikeli" if score <= 80 else "Kritik Tehdit"

    return AnalysisResult(
        score=score, status=status_text, type=atype, target=target,
        threat_type=raw.get("threat_type", "Şüpheli"), explanation=raw.get("explanation", "Analiz bitti."),
        reasons=raw.get("reasons", []), action_plan=raw.get("action_plan", ["Dikkatli olun."]),
        risk_level=level, risk_color=color
    )

TRUSTED_DOMAINS = {
    "yatirim-analiz-60958.web.app", "yatirim-analiz-60958.firebaseapp.com",
    "yatirimanalizapi.onrender.com",
    "google.com", "youtube.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
    "linkedin.com", "github.com", "microsoft.com", "apple.com", "amazon.com",
    "wikipedia.org", "reddit.com", "netflix.com", "whatsapp.com",
    "borsaistanbul.com", "tcmb.gov.tr", "spk.gov.tr", "isbank.com.tr",
    "garanti.com.tr", "akbank.com", "yapikredi.com.tr", "qnb.com.tr",
    "firebase.google.com", "web.app", "firebaseapp.com",
}

def _static_url(url: str) -> tuple:
    findings, bonus = [], 0
    try:
        p = urlparse(url)
        domain = (p.netloc or "").lower().removeprefix("www.")
        # Güvenilir domain kontrolü
        is_trusted = False
        for td in TRUSTED_DOMAINS:
            if domain == td or domain.endswith("." + td):
                is_trusted = True
                break
        if is_trusted:
            findings.append("Alan adı güvenilir yapısı doğrulanmış.")
            bonus -= 40
            return findings, max(bonus, -40)
        if url.startswith("http://"):
            findings.append("HTTP protokolü — şifrelenmemiş.")
            bonus += 15
        if domain in URL_SHORTENERS:
            findings.append(f"Kısaltıcı servis ({domain}).")
            bonus += 25
        for tld in RISKY_TLDS:
            if domain.endswith(tld):
                findings.append(f"Riskli uzantı: {tld}")
                bonus += 20
                break
    except: pass
    return findings, min(bonus, 50)

@app.post("/analyze/link", tags=["Analiz"])
@limiter.limit("20/minute")
async def analyze_link(request: Request, data: LinkRequest):
    findings, bonus = _static_url(data.url)
    ctx = "\n".join(findings) if findings else "Statik bulgu yok."
    prompt = f"""Sen profesyonel bir siber güvenlik ve web analiz uzmanısın.
Aşağıdaki URL'yi detaylı analiz et:

URL: {data.url}
Statik Bulgular: {ctx}

Analiz Kapsamı:
1. **Site Amacı**: Bu site ne için kullanılıyor? (e-ticaret, haber, finans, sosyal medya, devlet, eğitim vb.)
2. **Güvenilirlik**: Alan adı yapısı, HTTPS durumu, TLD güvenilirliği
3. **Tehdit Analizi**: Phishing, malware, scam, sahte yatırım sitesi riski
4. **Detaylı Açıklama**: Profesyonel, kapsamlı, en az 3-4 cümlelik bir değerlendirme yaz. Sitenin ne amaçla kullanıldığını, güvenlik durumunu, dikkat edilmesi gereken noktaları ve genel yorumunu yaz.
5. **AI Yorumu**: Yapay zeka olarak bu site hakkında kişisel değerlendirmen.

{STYLE_PROMPT}

Sadece JSON dön:
{{
  "score": <0-100 tehdit skoru, 0=çok güvenli, 100=çok tehlikeli>,
  "status": "Güvenli" | "Şüpheli" | "Tehlikeli" | "Kritik Tehdit",
  "threat_type": "<tehdit türü: Phishing | Scam | Malware | Güvenli Site | Bilinmiyor>",
  "site_purpose": "<sitenin kullanım amacı - 1-2 cümle>",
  "reasons": ["bulgu 1", "bulgu 2", "bulgu 3"],
  "explanation": "<Kapsamlı profesyonel analiz - en az 3-4 cümle>",
  "ai_comment": "<Yapay zekanın kişisel değerlendirmesi - 2-3 cümle>",
  "action_plan": ["eylem 1", "eylem 2", "eylem 3"]
}}"""
    raw = await run_ai(prompt) or {"score": 50, "reasons": ["AI Hatası"], "explanation": "Yapay zekaya ulaşılamadı.", "site_purpose": "Belirlenemedi", "ai_comment": ""}
    # Güvenilir domain bonus'unu AI skoruna uygula
    raw["score"] = max(0, min(100, int(raw.get("score", 50)) + bonus))
    res = _enrich(raw, "link", data.url)
    res.site_purpose = raw.get("site_purpose", "Belirlenemedi")
    res.ai_comment = raw.get("ai_comment", "")
    res.reasons.extend(f for f in findings if f not in res.reasons)
    return res

@app.post("/analyze/email", tags=["Analiz"])
@limiter.limit("20/minute")
async def analyze_email(request: Request, data: EmailRequest):
    prompt = f"""Sen profesyonel bir siber güvenlik uzmanısın. Aşağıdaki mesajı detaylı analiz et:

Mesaj İçeriği:
{data.content[:2000]}

Analiz Kapsamı:
1. Dolandırıcılık, phishing, sahte yatırım teklifi, kimlik avı riski
2. Aciliyet dili, manipülasyon teknikleri, sahte bağlantılar
3. Kapsamlı profesyonel değerlendirme (en az 3-4 cümle)
4. AI yorumu ve önerileri

{STYLE_PROMPT}

Sadece JSON dön:
{{
  "score": <0-100 tehdit skoru>,
  "status": "Güvenli" | "Şüpheli" | "Tehlikeli" | "Kritik Tehdit",
  "threat_type": "<tehdit türü>",
  "reasons": ["bulgu 1", "bulgu 2", "bulgu 3"],
  "explanation": "<Kapsamlı analiz - en az 3-4 cümle>",
  "ai_comment": "<AI yorumu - 2-3 cümle>",
  "action_plan": ["eylem 1", "eylem 2", "eylem 3"]
}}"""
    raw = await run_ai(prompt) or {"score": 50, "reasons": ["AI Hatası"], "explanation": "Yapay zekaya ulaşılamadı.", "ai_comment": ""}
    target = data.content[:60] + "..." if len(data.content)>60 else data.content
    res = _enrich(raw, "email", target)
    res.ai_comment = raw.get("ai_comment", "")
    return res

@app.post("/analyze/invest", tags=["Analiz"])
@limiter.limit("10/minute")
async def analyze_invest(request: Request, data: InvestRequest):
    prompt = f"""Sen uzman finans analisti, ekonomist ve yatırım danışmanısın.
Analiz edilecek varlık: "{data.asset_name}"

ÇOK KAPSAMLI bir analiz yap. Şu başlıkları mutlaka değerlendir:
1. Genel Değerlendirme: Bu varlık nedir, hangi kategoride, kısa tanıtım.
2. Geçmiş Performans: 1-5 yıllık artış/düşüş yüzdeleri, önemli dönüm noktaları.
3. Risk Analizi: Risk seviyesi, volatilite, balon/scam riski.
4. Piyasa Duyarlılığı: Yatırımcı duygusu, sosyal medya ve haber etkisi.
5. Trend Analizi: Mevcut trend yönü, kısa ve uzun vadeli görünüm.
6. Avantajlar ve Riskler: En az 4'er madde.
7. Temel Metrikler: Potansiyel getiri, risk/ödül oranı, piyasa hakimiyeti, likidite.
8. Yatırım Vadesi: Kısa/orta/uzun vadeye uygunluk.
9. "Ne Kadar Kazanırdım?": Geçmişe dönük hesaplama (HTML formatında, <strong>, <br> kullan).
10. AI Tavsiyesi: Detaylı, anlaşılır yatırım önerisi (3-4 cümle).
11. Detaylı Rapor: Markdown formatında tablolar, listeler, başlıklarla zengin rapor.

YAZIM KURALLARI:
- Profesyonel Türkçe, teknik terimleri parantez içinde açıkla.
- "markdown" alanı mutlaka düz metin STRING olmalı, obje/nesne OLMAMALI. Satır atlama için \\n kullan.
- Sadece JSON formatında çıktı ver.

Sadece JSON:
{{
  "score": <0-100 güven puanı>,
  "status": "Güvenilir" | "Dikkatli Ol" | "Riskli" | "Tehlikeli",
  "category": "<Kripto | Hisse Senedi | Emtia | Döviz | Halka Arz | DeFi | NFT | Fon | Diğer>",
  "summary": "<2 cümlelik kısa özet>",
  "risk_level": "<Düşük | Orta | Yüksek | Çok Yüksek>",
  "volatility": "<Düşük | Orta | Yüksek>",
  "market_sentiment": "<Pozitif | Nötr | Negatif>",
  "trend": "<Güçlü Yükseliş | Yükseliş | Yatay | Düşüş | Güçlü Düşüş>",
  "investment_horizon": "<Kısa Vadeli (1-3 ay) | Orta Vadeli (3-12 ay) | Uzun Vadeli (1-5 yıl)>",
  "pros": ["avantaj 1", "avantaj 2", "avantaj 3", "avantaj 4"],
  "cons": ["risk 1", "risk 2", "risk 3", "risk 4"],
  "key_metrics": {{
    "potential_return": "<potansiyel getiri açıklaması>",
    "risk_reward": "<risk/ödül oranı>",
    "market_dominance": "<piyasa hakimiyeti>",
    "liquidity": "<Çok Yüksek | Yüksek | Orta | Düşük>"
  }},
  "recommendation": "<AI yatırım tavsiyesi - 3-4 cümle>",
  "chart_data": [<6 gerçekçi trend puanı>],
  "calculator_text": "<HTML formatında hesap özeti>",
  "markdown": "<Kapsamlı Markdown raporu>"
}}"""
    raw = await run_ai(prompt) or {}
    km = raw.get("key_metrics", {}) if isinstance(raw.get("key_metrics"), dict) else {}
    # markdown bazen dict olarak dönebiliyor, string'e çevir
    md = raw.get("markdown", "")
    if isinstance(md, dict):
        md = json.dumps(md, ensure_ascii=False)
    elif not isinstance(md, str):
        md = str(md) if md else ""

    # Markdown boşsa mevcut verilerden otomatik rapor oluştur
    if not md or md.strip() in ("", "Yapay zekaya ulaşılamadı."):
        asset = data.asset_name
        score = raw.get("score", 50)
        status = raw.get("status", "Bilinmiyor")
        summary = raw.get("summary", "")
        risk_level = raw.get("risk_level", "Belirtilmemiş")
        volatility = raw.get("volatility", "Belirtilmemiş")
        sentiment = raw.get("market_sentiment", "Belirtilmemiş")
        trend = raw.get("trend", "Belirtilmemiş")
        horizon = raw.get("investment_horizon", "Belirtilmemiş")
        pros = raw.get("pros", [])
        cons = raw.get("cons", [])
        rec = raw.get("recommendation", "")

        md_lines = [
            f"# 📊 {asset} — Yatırım Analiz Raporu\n",
            f"## Genel Değerlendirme\n",
            f"**Güven Skoru:** {score}/100 | **Durum:** {status}\n",
            f"{summary}\n" if summary else "",
            f"## 📈 Piyasa Göstergeleri\n",
            f"| Gösterge | Değer |",
            f"|----------|-------|",
            f"| Risk Seviyesi | {risk_level} |",
            f"| Volatilite | {volatility} |",
            f"| Piyasa Duyarlılığı | {sentiment} |",
            f"| Trend | {trend} |",
            f"| Yatırım Vadesi | {horizon} |",
            f""
        ]
        if pros:
            md_lines.append("## ✅ Avantajlar\n")
            for p in pros:
                md_lines.append(f"- {p}")
            md_lines.append("")
        if cons:
            md_lines.append("## ⚠️ Riskler\n")
            for c in cons:
                md_lines.append(f"- {c}")
            md_lines.append("")
        if rec:
            md_lines.append(f"## 💡 AI Tavsiyesi\n")
            md_lines.append(f"{rec}\n")
        if km:
            md_lines.append("## 📊 Temel Metrikler\n")
            md_lines.append(f"- **Potansiyel Getiri:** {km.get('potential_return', '—')}")
            md_lines.append(f"- **Risk/Ödül:** {km.get('risk_reward', '—')}")
            md_lines.append(f"- **Piyasa Hakimiyeti:** {km.get('market_dominance', '—')}")
            md_lines.append(f"- **Likidite:** {km.get('liquidity', '—')}")

        md = "\n".join(md_lines)

    return {
        "score": raw.get("score", 50),
        "status": raw.get("status", "Bilinmiyor"),
        "category": raw.get("category", ""),
        "summary": raw.get("summary", ""),
        "risk_level": raw.get("risk_level", ""),
        "volatility": raw.get("volatility", ""),
        "market_sentiment": raw.get("market_sentiment", ""),
        "trend": raw.get("trend", ""),
        "investment_horizon": raw.get("investment_horizon", ""),
        "pros": raw.get("pros", []),
        "cons": raw.get("cons", []),
        "key_metrics": {
            "potential_return": km.get("potential_return", "—"),
            "risk_reward": km.get("risk_reward", "—"),
            "market_dominance": km.get("market_dominance", "—"),
            "liquidity": km.get("liquidity", "—")
        },
        "recommendation": raw.get("recommendation", ""),
        "markdown": md,
        "chart_data": raw.get("chart_data", [0]*6),
        "calculator_text": raw.get("calculator_text", "Hesaplanamadı.")
    }

def _yf_fetch(symbols: list, period="1d") -> dict:
    """yfinance ile fiyat çek, cache'le."""
    results = {}
    now = time.time()
    to_fetch = []
    for s in symbols:
        cached = _price_cache.get(s)
        if cached and (now - cached["ts"]) < _CACHE_TTL:
            results[s] = cached["data"]
        else:
            to_fetch.append(s)
    if to_fetch and _YF_OK:
        try:
            tickers = yf.Tickers(" ".join(to_fetch))
            for s in to_fetch:
                try:
                    t = tickers.tickers[s]
                    info = t.fast_info
                    price = float(info.last_price) if hasattr(info, "last_price") else 0
                    prev = float(info.previous_close) if hasattr(info, "previous_close") else price
                    chg = ((price - prev) / prev * 100) if prev else 0
                    d = {"price": round(price, 4), "change": round(chg, 2)}
                    results[s] = d
                    _price_cache[s] = {"ts": now, "data": d}
                except Exception as e:
                    print(f"[WARN] yfinance {s}: {e}")
                    results[s] = {"price": 0, "change": 0}
        except Exception as e:
            print(f"[WARN] yfinance toplu hata: {e}")
    return results

@app.get("/api/prices/stocks", tags=["Fiyatlar"])
async def get_stock_prices():
    symbols = ["AAPL","MSFT","NVDA","TSLA","AMZN","GOOGL","GARAN.IS","THYAO.IS","KCHOL.IS","AKBNK.IS"]
    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(None, functools.partial(_yf_fetch, symbols))
    return data

@app.get("/api/prices/gold", tags=["Fiyatlar"])
async def get_gold_prices():
    symbols = ["GC=F"]
    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(None, functools.partial(_yf_fetch, symbols))
    oz_usd = data.get("GC=F", {}).get("price", 0)
    chg = data.get("GC=F", {}).get("change", 0)
    gram_usd = oz_usd / 31.1035 if oz_usd else 0
    gold_types = [
        {"name": "Gram Altın", "icon": "🥇", "gram": 1, "karat": 1},
        {"name": "Çeyrek Altın", "icon": "💰", "gram": 1.75, "karat": 0.916},
        {"name": "Yarım Altın", "icon": "🪙", "gram": 3.5, "karat": 0.916},
        {"name": "Tam Altın", "icon": "🏅", "gram": 7.0, "karat": 0.916},
        {"name": "Cumhuriyet Altını", "icon": "🎖️", "gram": 7.216, "karat": 0.916},
        {"name": "Ata Altın", "icon": "⭐", "gram": 7.216, "karat": 0.916},
        {"name": "22 Ayar Bilezik (gr)", "icon": "💍", "gram": 1, "karat": 0.916},
        {"name": "14 Ayar Altın (gr)", "icon": "✨", "gram": 1, "karat": 0.585}
    ]
    result = []
    for g in gold_types:
        p = gram_usd * g["gram"] * g["karat"]
        result.append({"name": g["name"], "icon": g["icon"], "price_usd": round(p, 2), "change": round(chg, 2)})
    return {"ounce_usd": round(oz_usd, 2), "gram_usd": round(gram_usd, 2), "types": result}

@app.get("/api/prices/commodities", tags=["Fiyatlar"])
async def get_commodity_prices():
    symbols = ["GC=F","SI=F","PL=F","PA=F","BZ=F","CL=F","NG=F","HG=F"]
    names = {"GC=F":"Altın (XAU)","SI=F":"Gümüş (XAG)","PL=F":"Platin","PA=F":"Paladyum","BZ=F":"Brent Petrol","CL=F":"WTI Petrol","NG=F":"Doğal Gaz","HG=F":"Bakır"}
    icons = {"GC=F":"🥇","SI=F":"🥈","PL=F":"⚪","PA=F":"🔘","BZ=F":"🛢️","CL=F":"⛽","NG=F":"🔥","HG=F":"🟤"}
    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(None, functools.partial(_yf_fetch, symbols))
    result = []
    for s in symbols:
        d = data.get(s, {"price": 0, "change": 0})
        result.append({"symbol": s, "name": names[s], "icon": icons[s], "price_usd": d["price"], "change": d["change"]})
    return result

@app.post("/analyze/market_pulse", tags=["Analiz"])
@limiter.limit("5/minute")
async def market_pulse(request: Request):
    today = datetime.now().strftime("%d %B %Y")
    prompt = f"""Sen küresel bir baş stratejist ve finans editörüsün. 
Bugünün tarihi: {today}

Piyasaların genel durumunu özetleyen ÇOK KISA ve vurucu bir 'Piyasa Nabzı' özeti hazırla. 
- Global piyasalar (ABD, Avrupa, Asya), Kripto ve Emtia dünyasındaki genel hava nedir?
- Yatırımcılar bugün neye odaklanmalı?
- 2-3 kısa cümleyle özetle. Profesyonel, ciddi ve içgörülü olsun.

{STYLE_PROMPT}

Sadece JSON:
{{
  "pulse_text": "<AI tarafından hazırlanan nabız özeti>",
  "sentiment": "<Pozitif | Negatif | Kararsız | Bekle-Gör>",
  "focus_asset": "<Bugünün odak noktası olan varlık veya sektör>"
}}"""
    raw = await run_ai(prompt) or {"pulse_text": "Piyasa verilerine şu an ulaşılamıyor.", "sentiment": "Kararsız", "focus_asset": "N/A"}
    return raw

