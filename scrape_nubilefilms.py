#!/usr/bin/env python3
"""
NubileFilms Login & Scraper
Usage: python scrape_nubilefilms.py
"""

import re
import sys
import json
import time
from urllib.parse import urljoin

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Installing beautifulsoup4...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "beautifulsoup4", "-q"])
    from bs4 import BeautifulSoup

# ── Config ──
USERNAME = "gpanter22@aol.com"
PASSWORD = "7911MAge21"
AUTH_URL = "https://nubilefilms.com/authentication/login"
GALLERY_URL = "https://members.nubilefilms.com/video/gallery"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"

# ── Exact browser headers ──
GET_HEADERS = {
    "host": "nubilefilms.com",
    "cache-control": "max-age=0",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "upgrade-insecure-requests": "1",
    "user-agent": UA,
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "navigate",
    "sec-fetch-user": "?1",
    "sec-fetch-dest": "document",
    "referer": "https://nubilefilms.com/",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",
}

# ── Session ──
s = requests.Session()


def get_csrf():
    """GET /login to fetch CSRF token."""
    url = "https://nubilefilms.com/login"
    print("[1/3] GET", url)

    headers = {
        "host": "nubilefilms.com",
        "connection": "keep-alive",
        "cache-control": "max-age=0",
        "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "origin": "https://nubilefilms.com",
        "content-type": "application/x-www-form-urlencoded",
        "upgrade-insecure-requests": "1",
        "user-agent": UA,
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        "referer": "https://nubilefilms.com/",
        "accept-language": "en-GB,en;q=0.9",
        "accept-encoding": "gzip, deflate",
    }

    r = s.get(url, headers=headers, allow_redirects=True)
    print(f"    Status: {r.status_code}")
    print(f"    URL: {r.url}")
    print(f"    Cookies: {dict(s.cookies)}")

    # Check for captcha/ban
    if 'turnstile-card' in r.text or 'Just a moment' in r.text or 'Security Check' in r.text:
        print("[!] Cloudflare captcha/ban detected")
        print(r.text[:2000])
        raise SystemExit(1)

    m = re.search(r'name=["\']csrf-token["\']\s*type=["\']hidden["\']\s*value=["\']([^"\']+)["\']', r.text, re.I)
    if not m:
        print("[!] CSRF not found. Dumping HTML:")
        print(r.text[:3000])
        raise SystemExit(1)

    print(f"    CSRF: {m.group(1)[:50]}...")
    return m.group(1)


def do_login(csrf):
    """POST /authentication/login with exact config body."""
    url = "https://nubilefilms.com/authentication/login"
    print("[2/3] POST", url)

    body = f"username={USERNAME.replace('@', '%40')}&password={PASSWORD}&r=members.nubilefilms.com%2Fvideo%2Fgallery&csrf-token={csrf}&sign-in=Sign+In"

    headers = {
        "host": "nubilefilms.com",
        "connection": "keep-alive",
        "cache-control": "max-age=0",
        "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "origin": "https://nubilefilms.com",
        "content-type": "application/x-www-form-urlencoded",
        "upgrade-insecure-requests": "1",
        "user-agent": UA,
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        "referer": "https://nubilefilms.com/",
        "accept-language": "en-GB,en;q=0.9",
        "accept-encoding": "gzip, deflate",
    }

    r = s.post(url, headers=headers, data=body, allow_redirects=False)
    print(f"    Status: {r.status_code}")
    print(f"    Location: {r.headers.get('Location', 'none')}")
    print(f"    Cookies: {dict(s.cookies)}")

    # Check login result
    if 'The username or password you\'ve entered is incorrect or blocked' in r.text:
        print("[!] Invalid credentials")
        raise SystemExit(1)
    if 'Your subscription has expired' in r.text:
        print("[!] Subscription expired")
        raise SystemExit(1)

    return r


def follow_redirects(resp):
    """Follow redirect chain if any."""
    loc = resp.headers.get("Location")
    count = 0
    while loc and count < 5:
        url = loc if loc.startswith("http") else urljoin("https://nubilefilms.com", loc)
        print(f"    -> follow: {url}")
        r = s.get(url, allow_redirects=False)
        print(f"       status: {r.status_code}")
        loc = r.headers.get("Location")
        count += 1


def scrape_gallery():
    """Fetch and parse the members gallery."""
    print("[3/3] GET", GALLERY_URL)
    r = s.get(GALLERY_URL, headers={"Referer": "https://members.nubilefilms.com/"})
    print(f"    Status: {r.status_code}")

    if r.status_code == 429:
        print("[!] Rate limited. Waiting 5s...")
        time.sleep(5)
        r = s.get(GALLERY_URL)
        print(f"    Retry: {r.status_code}")

    if not r.ok:
        print("[!] Failed. Dumping response:")
        print(r.text[:1000])
        return []

    # Save raw HTML for inspection
    with open("gallery_raw.html", "w", encoding="utf-8") as f:
        f.write(r.text)
    print("    Raw HTML saved to gallery_raw.html")

    soup = BeautifulSoup(r.text, "html.parser")
    videos = []

    # Pattern 1: Cards with video links
    for a in soup.find_all("a", href=re.compile(r"/video/")):
        img = a.find("img")
        if img:
            videos.append({
                "title": (img.get("alt") or img.get("title") or "Untitled").strip(),
                "url": urljoin(GALLERY_URL, a.get("href", "")),
                "thumbnail": img.get("src") or img.get("data-src") or "",
            })

    # Pattern 2: Figure blocks
    if not videos:
        for fig in soup.find_all("figure"):
            a = fig.find("a", href=re.compile(r"/video/"))
            img = fig.find("img")
            cap = fig.find("figcaption")
            if a and img:
                videos.append({
                    "title": (cap.get_text(strip=True) if cap else img.get("alt", "Untitled")),
                    "url": urljoin(GALLERY_URL, a.get("href", "")),
                    "thumbnail": img.get("src") or img.get("data-src", ""),
                })

    # Deduplicate
    seen = set()
    unique = []
    for v in videos:
        if v["url"] and v["url"] not in seen:
            seen.add(v["url"])
            unique.append(v)

    return unique


def main():
    print("="*60)
    print("NubileFilms Login & Scraper")
    print("="*60)

    csrf = get_csrf()
    login_resp = do_login(csrf)
    follow_redirects(login_resp)

    time.sleep(1)
    videos = scrape_gallery()

    print(f"\n{'='*60}")
    print(f"Found {len(videos)} videos")
    print(f"{'='*60}")
    for i, v in enumerate(videos[:10]):
        print(f"\n{i+1}. {v['title']}")
        print(f"   URL: {v['url']}")
        print(f"   Thumb: {v['thumbnail'][:80]}")

    with open("videos.json", "w", encoding="utf-8") as f:
        json.dump(videos, f, indent=2, ensure_ascii=False)
    print(f"\nSaved to videos.json")


if __name__ == "__main__":
    main()
