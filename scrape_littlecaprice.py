#!/usr/bin/env python3
"""
LittleCaprice-Dreams Login & Scraper
Usage: python scrape_littlecaprice.py
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
USERNAME = "jj2367836794@gmail.com"
PASSWORD = "4042179971"
LOGIN_URL = "https://www.littlecaprice-dreams.com/myaccount"
POST_URL = "https://www.littlecaprice-dreams.com/myaccount/?redirect_to=%2F"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"

# ── Session ──
s = requests.Session()


def get_nonce():
    """GET /myaccount to fetch woocommerce-login-nonce."""
    print("[1/3] GET", LOGIN_URL)

    headers = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    r = s.get(LOGIN_URL, headers=headers, allow_redirects=True)
    print(f"    Status: {r.status_code}")

    # Check for region block/ban
    if 'We are sorry to inform you that this website cant be accessed by this region' in r.text:
        print("[!] Region blocked")
        raise SystemExit(1)
    if r.status_code == 429:
        print("[!] Rate limited (429)")
        raise SystemExit(1)
    if 'Access Denied</title>' in r.text:
        print("[!] Access denied")
        raise SystemExit(1)

    m = re.search(r'name="woocommerce-login-nonce" value="([^"]+)"', r.text)
    if not m:
        print("[!] Nonce not found. Dumping HTML:")
        print(r.text[:3000])
        raise SystemExit(1)

    print(f"    Nonce: {m.group(1)[:50]}...")
    return m.group(1)


def do_login(nonce):
    """POST login with nonce and credentials."""
    print("[2/3] POST", POST_URL)

    body = f"lcd_redirect_to=%2F&username={USERNAME}&password={PASSWORD}&woocommerce-login-nonce={nonce}&_wp_http_referer=%2Fmyaccount%2F%3Fredirect_to%3D%252F&login=Log+in&redirect=%2F"

    headers = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://www.littlecaprice-dreams.com",
        "Referer": "https://www.littlecaprice-dreams.com/myaccount/?redirect_to=%2F",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    r = s.post(POST_URL, headers=headers, data=body, allow_redirects=False)
    print(f"    Status: {r.status_code}")
    print(f"    Location: {r.headers.get('Location', 'none')}")

    # Check for region block/ban
    if 'We are sorry to inform you that this website cant be accessed by this region' in r.text:
        print("[!] Region blocked")
        raise SystemExit(1)
    if r.status_code == 429:
        print("[!] Rate limited (429)")
        raise SystemExit(1)
    if 'Access Denied</title>' in r.text:
        print("[!] Access denied")
        raise SystemExit(1)

    return r


def verify_login():
    """GET /myaccount/ to verify login success."""
    print("[3/3] GET https://www.littlecaprice-dreams.com/myaccount/")

    headers = {
        "User-Agent": UA,
        "Pragma": "no-cache",
        "Accept": "*/*",
    }

    r = s.get("https://www.littlecaprice-dreams.com/myaccount/", headers=headers, allow_redirects=True)
    print(f"    Status: {r.status_code}")

    # Check for region block/ban
    if 'We are sorry to inform you that this website cant be accessed by this region' in r.text:
        print("[!] Region blocked")
        raise SystemExit(1)
    if r.status_code == 429:
        print("[!] Rate limited (429)")
        raise SystemExit(1)
    if 'Access Denied</title>' in r.text:
        print("[!] Access denied")
        raise SystemExit(1)

    # Check login success
    if 'The password you entered for the email address' in r.text:
        print("[!] Invalid password")
        raise SystemExit(1)
    if 'From your account dashboard you can view your' not in r.text and '">Log out<' not in r.text and 'Hello <strong' not in r.text:
        print("[!] Login failed - not on account dashboard")
        print(r.text[:1000])
        raise SystemExit(1)

    print("    Login successful!")
    return r


def get_video_embed(video_url):
    """Fetch individual video page and extract embed URL."""
    headers = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        r = s.get(video_url, headers=headers, allow_redirects=True, timeout=10)
        if not r.ok:
            return None

        soup = BeautifulSoup(r.text, "html.parser")

        # Look for video player sources
        # Pattern 1: video source in source tag
        for source in soup.find_all("source"):
            src = source.get("src", "")
            if src and (".mp4" in src or ".m3u8" in src):
                return src

        # Pattern 2: video tag with src
        video = soup.find("video")
        if video:
            src = video.get("src", "")
            if src:
                return src

        # Pattern 3: iframe embed
        for iframe in soup.find_all("iframe"):
            src = iframe.get("src", "")
            if src:
                return src

        # Pattern 4: Look for trailer URL in data attributes
        for a in soup.find_all("a"):
            trailer = a.get("data-trailer-url") or a.get("data-video-url")
            if trailer:
                return trailer

        return None
    except Exception as e:
        print(f"    Error fetching {video_url}: {e}")
        return None


def scrape_videos():
    """Fetch and parse the videos page."""
    print("[4/4] GET https://www.littlecaprice-dreams.com/videos/")

    headers = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    r = s.get("https://www.littlecaprice-dreams.com/videos/", headers=headers, allow_redirects=True)
    print(f"    Status: {r.status_code}")

    if r.status_code == 429:
        print("[!] Rate limited. Waiting 5s...")
        time.sleep(5)
        r = s.get("https://www.littlecaprice-dreams.com/videos/", headers=headers)
        print(f"    Retry: {r.status_code}")

    if not r.ok:
        print("[!] Failed. Dumping response:")
        print(r.text[:1000])
        return []

    # Save raw HTML
    with open("videos.html", "w", encoding="utf-8") as f:
        f.write(r.text)
    print("    Saved to videos.html")

    soup = BeautifulSoup(r.text, "html.parser")
    videos = []

    # Parse project-preview cards
    for a in soup.find_all("a", class_="project-preview"):
        href = a.get("href", "")
        if not href:
            continue

        img = a.find("img", class_="preview-thumb")
        if not img:
            continue

        title_elem = a.find("h2")
        title = title_elem.get_text(strip=True) if title_elem else "Untitled"

        video_url = urljoin("https://www.littlecaprice-dreams.com", href)

        videos.append({
            "title": title,
            "url": video_url,
            "thumbnail": img.get("src", ""),
            "embed": None,
        })

    # Deduplicate
    seen = set()
    unique = []
    for v in videos:
        if v["url"] and v["url"] not in seen:
            seen.add(v["url"])
            unique.append(v)

    print(f"[5/5] Fetching embed URLs (test: first video only)...")
    # Test with just the first video
    if unique:
        video = unique[0]
        print(f"    1/1: {video['title'][:50]}...")
        embed = get_video_embed(video["url"])
        video["embed"] = embed
        if embed:
            print(f"    Found embed: {embed}")
        else:
            print(f"    No embed found")

    return unique


def main():
    print("="*60)
    print("LittleCaprice-Dreams Login & Scraper")
    print("="*60)

    nonce = get_nonce()
    do_login(nonce)
    verify_login()
    videos = scrape_videos()

    print(f"\n{'='*60}")
    print(f"Found {len(videos)} videos")
    print(f"{'='*60}")
    for i, v in enumerate(videos[:10]):
        print(f"\n{i+1}. {v['title']}")
        print(f"   URL: {v['url']}")
        print(f"   Thumb: {v['thumbnail'][:80]}")

    with open("littlecaprice_videos.json", "w", encoding="utf-8") as f:
        json.dump(videos, f, indent=2, ensure_ascii=False)
    print(f"\nSaved to littlecaprice_videos.json")


if __name__ == "__main__":
    main()
