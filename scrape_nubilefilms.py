#!/usr/bin/env python3
"""
NubileFilms Login & Scraper
Usage: python scrape_nubilefilms.py
"""

import re
import sys
import json
import time
from urllib.parse import urljoin, urlparse, parse_qs

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
EMAIL = "gpanter22@aol.com"
PASSWORD = "7911MAge21"
LOGIN_URL = "https://nubilefilms.com/login"
GALLERY_URL = "https://members.nubilefilms.com/video/gallery"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"

# ── Session ──
s = requests.Session()
s.headers.update({
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
    "Sec-Fetch-Dest": "document",
})


def get_csrf():
    """GET login page and extract CSRF token."""
    print("[1/4] GET login page...")
    # First, hit the main site to get initial cookies
    print("    Pre-flight to nubilefilms.com...")
    pre = s.get("https://nubilefilms.com/", allow_redirects=True)
    print(f"    Pre-flight status: {pre.status_code}, cookies: {len(pre.cookies)}")

    time.sleep(1)

    r = s.get(LOGIN_URL, allow_redirects=True)
    print(f"    Login page status: {r.status_code}")
    print(f"    URL after redirects: {r.url}")
    print(f"    Cookies: {dict(s.cookies)}")

    # Try multiple patterns for CSRF
    patterns = [
        r'name=["\']csrf-token["\']\s*type=["\']hidden["\']\s*value=["\']([^"\']+)["\']',
        r'type=["\']hidden["\']\s*name=["\']csrf-token["\']\s*value=["\']([^"\']+)["\']',
        r'name=["\']csrf-token["\']\s*value=["\']([^"\']+)["\']',
        r'value=["\']([^"\']+)["\']\s*name=["\']csrf-token["\']',
        r'csrf-token["\']?\s*value=["\']([^"\']+)["\']',
    ]
    for pat in patterns:
        m = re.search(pat, r.text, re.I)
        if m:
            print(f"    CSRF found: {m.group(1)[:40]}...")
            return m.group(1), s.cookies

    print("[!] CSRF token not found. Dumping HTML (first 4000 chars):")
    print(r.text[:4000])
    raise SystemExit(1)


def do_login(csrf, initial_cookies):
    """POST login with CSRF token."""
    print("[2/4] POST login...")
    data = {
        "username": EMAIL,
        "password": PASSWORD,
        "r": "members.nubilefilms.com/",
        "csrf-token": csrf,
        "sign-in": "Sign In",
    }
    r = s.post(LOGIN_URL, data=data, allow_redirects=False)
    print(f"    Status: {r.status_code}")
    print(f"    Location: {r.headers.get('Location', 'none')}")
    print(f"    Set-Cookie: {len(r.cookies)} cookies")
    return r


def follow_redirects(response):
    """Follow any redirect chain after login."""
    print("[3/4] Following redirects...")
    location = response.headers.get("Location")
    if not location:
        print("    No redirect, checking if login succeeded...")
        return

    redirect_count = 0
    while location and redirect_count < 5:
        url = location if location.startswith("http") else urljoin("https://nubilefilms.com", location)
        print(f"    -> {url}")
        r = s.get(url, allow_redirects=False)
        print(f"       Status: {r.status_code}, cookies: {len(r.cookies)}")
        location = r.headers.get("Location")
        redirect_count += 1

    print(f"    Final cookies: {dict(s.cookies)}")


def scrape_gallery():
    """Fetch and parse the video gallery."""
    print("[4/4] Fetching gallery...")
    r = s.get(GALLERY_URL, headers={
        "Referer": "https://members.nubilefilms.com/",
    })
    print(f"    Status: {r.status_code}")

    if r.status_code == 429:
        print("[!] Rate limited (429). Waiting 5s and retrying...")
        time.sleep(5)
        r = s.get(GALLERY_URL, headers={"Referer": "https://members.nubilefilms.com/"})
        print(f"    Retry status: {r.status_code}")

    if not r.ok:
        print(f"[!] Failed: {r.status_code}")
        print(r.text[:500])
        return []

    soup = BeautifulSoup(r.text, "html.parser")

    # Try multiple selectors to find video cards
    videos = []

    # Pattern 1: Common adult site card structure
    for card in soup.find_all("a", href=re.compile(r"/video/")):
        img = card.find("img")
        if img:
            title = img.get("alt") or img.get("title") or "Untitled"
            thumb = img.get("src") or img.get("data-src") or ""
            url = urljoin(GALLERY_URL, card.get("href", ""))
            videos.append({"title": title.strip(), "url": url, "thumbnail": thumb})

    # Pattern 2: Look for figure/figcaption
    if not videos:
        for figure in soup.find_all("figure"):
            a = figure.find("a", href=re.compile(r"/video/"))
            img = figure.find("img")
            caption = figure.find("figcaption") or figure.find("span", class_=re.compile(r"title|caption"))
            if a and img:
                videos.append({
                    "title": (caption.get_text(strip=True) if caption else img.get("alt", "Untitled")),
                    "url": urljoin(GALLERY_URL, a.get("href", "")),
                    "thumbnail": img.get("src") or img.get("data-src", ""),
                })

    # Pattern 3: Generic thumbnail + link
    if not videos:
        thumbs = soup.find_all("img", src=re.compile(r"thumbnail|preview|cover|poster"))
        for img in thumbs[:30]:
            parent = img.find_parent("a")
            if parent:
                videos.append({
                    "title": img.get("alt", "Untitled").strip(),
                    "url": urljoin(GALLERY_URL, parent.get("href", "")),
                    "thumbnail": img.get("src") or img.get("data-src", ""),
                })

    # Deduplicate by URL
    seen = set()
    unique = []
    for v in videos:
        if v["url"] and v["url"] not in seen:
            seen.add(v["url"])
            unique.append(v)

    return unique


def save_results(videos):
    """Save structured data to JSON and print summary."""
    print(f"\n{'='*60}")
    print(f"Found {len(videos)} unique videos")
    print(f"{'='*60}")

    for i, v in enumerate(videos[:10]):
        print(f"\n{i+1}. {v['title']}")
        print(f"   URL: {v['url']}")
        print(f"   Thumb: {v['thumbnail'][:80]}...")

    # Save full results
    with open("nubilefilms_videos.json", "w", encoding="utf-8") as f:
        json.dump(videos, f, indent=2, ensure_ascii=False)
    print(f"\nSaved to nubilefilms_videos.json")

    # Save raw HTML for inspection
    # with open("nubilefilms_gallery.html", "w", encoding="utf-8") as f:
    #     f.write(s.get(GALLERY_URL).text)
    # print("Raw HTML saved to nubilefilms_gallery.html")


def main():
    print("="*60)
    print("NubileFilms Login & Scraper")
    print("="*60)

    csrf, _ = get_csrf()
    print(f"    CSRF: {csrf[:30]}...")

    login_resp = do_login(csrf, None)
    follow_redirects(login_resp)

    # Small delay to avoid rate limit
    time.sleep(2)

    videos = scrape_gallery()
    save_results(videos)


if __name__ == "__main__":
    main()
