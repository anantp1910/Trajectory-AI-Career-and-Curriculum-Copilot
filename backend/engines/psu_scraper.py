import re
import json
from typing import List, Dict
import httpx
from bs4 import BeautifulSoup

COURSE_CODE_RE = re.compile(r"([A-Z]{2,6})\s*(\d{3}[A-Z]?)")


def _find_course_lines(soup: BeautifulSoup) -> List[str]:
    text = soup.get_text(separator="\n")
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    # return lines that look like they contain a course code
    out = []
    for i, line in enumerate(lines):
        if COURSE_CODE_RE.search(line):
            # include a small context window to capture title/desc
            window = " ".join(lines[max(0, i-1): i+3])
            out.append(window)
    return out


def parse_course_from_line(line: str) -> Dict:
    m = COURSE_CODE_RE.search(line)
    if not m:
        return {}
    dept = m.group(1)
    code = f"{m.group(1)} {m.group(2)}"
    # Try to split title after the code
    after = line[m.end():].strip(' -–—:')
    title = after.split(' — ')[0].split(' - ')[0].split(' : ')[0].strip()
    # Heuristic: if title is too long, take first 6 words
    if len(title.split()) > 12:
        title = ' '.join(title.split()[:8])
    return {"code": code, "name": title or None, "department": None, "skills": [], "prerequisites": [], "career_relevance": []}


async def scrape_urls(urls: List[str]) -> List[Dict]:
    results = []
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers={"User-Agent": "psu-scraper/1.0"}) as client:
        for url in urls:
            try:
                r = await client.get(url)
                soup = BeautifulSoup(r.text, "html.parser")
                # remove scripts/styles
                for t in soup(["script", "style", "nav", "footer", "header"]):
                    t.decompose()
                lines = _find_course_lines(soup)
                for ln in lines:
                    c = parse_course_from_line(ln)
                    if c and c.get("code"):
                        # avoid duplicates
                        if not any(x.get("code") == c.get("code") for x in results):
                            # set department from url when possible
                            if "/cmpsc/" in url or "cmpsc" in url.lower():
                                c["department"] = "Computer Science"
                            elif "data-sciences" in url.lower():
                                c["department"] = "Data Sciences"
                            results.append(c)
            except Exception as e:
                # continue on error
                print(f"Failed to fetch {url}: {e}")
    return results


def save_results(path: str, courses: List[Dict]):
    with open(path, "w") as f:
        json.dump({"courses": courses}, f, indent=2)


if __name__ == "__main__":
    import asyncio
    import sys
    urls = sys.argv[1:]
    if not urls:
        print("Usage: psu_scraper.py <url1> <url2> ...")
        raise SystemExit(1)
    found = asyncio.run(scrape_urls(urls))
    out_path = "data/courses_psu.json"
    save_results(out_path, found)
    print(f"Scraped {len(found)} courses -> {out_path}")
