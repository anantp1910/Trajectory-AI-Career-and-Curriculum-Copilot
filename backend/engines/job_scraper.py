import json
import httpx
from bs4 import BeautifulSoup
import re


async def scrape_job_url(client_ai, url):
    """Fetch a job posting and try to extract structured fields (company, role,
    requirements, preferred, description_summary) using DOM heuristics and
    text heuristics. Falls back to a lightweight text parse when DOM parsing
    doesn't reveal sections."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as http:
            r = await http.get(url, headers={"User-Agent": "Mozilla/5.0"})
            html = r.text
            soup = BeautifulSoup(html, "html.parser")
            # Remove noisy sections
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()

            # Try common selectors for title/company
            title = None
            company = None
            # job title heuristics
            h1 = soup.find("h1")
            if h1 and h1.get_text(strip=True):
                title = h1.get_text(strip=True)
            if not title:
                og_title = soup.find("meta", property="og:title")
                if og_title and og_title.get("content"):
                    title = og_title.get("content")

            # company heuristics
            company_tag = soup.find(class_=re.compile(r"company|employer|org", re.I))
            if company_tag:
                company = company_tag.get_text(strip=True)
            else:
                og_site = soup.find("meta", property="og:site_name")
                if og_site and og_site.get("content"):
                    company = og_site.get("content")

            text = soup.get_text(separator="\n", strip=True)
            # extract requirements blocks from text
            reqs, prefs = _extract_requirements_from_text(text)
            summary = _summarize_text(text)
            return {"company": company or "", "role": title or "", "requirements": reqs, "preferred": prefs, "description_summary": summary}
    except Exception:
        return None


def parse_job_text(client_ai, job_text):
    """Parse provided job text (string) into structured job info using text
    heuristics."""
    text = job_text or ""
    reqs, prefs = _extract_requirements_from_text(text)
    summary = _summarize_text(text)
    return {"company": "", "role": "", "requirements": reqs, "preferred": prefs, "description_summary": summary}


def _extract_requirements_from_text(text):
    # Look for headers followed by bullets/lines
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    reqs = []
    prefs = []
    capture = None
    for i, line in enumerate(lines):
        low = line.lower()
        if re.search(r"\b(requirements|qualifications|you should have|you have|must have|what we're looking for)\b", low):
            capture = 'req'
            continue
        if re.search(r"\b(preferred|nice to have|bonus|preferred qualifications)\b", low):
            capture = 'pref'
            continue
        # bullet-ish lines
        if line.startswith(('-', '•', '\u2022', '*')) or re.match(r"^\d+\.", line) or (capture and len(line.split()) < 12):
            target = capture or 'req'
            items = re.split(r"[\u2022\-*•]\s*", line)
            for it in items:
                s = it.strip()
                if not s: continue
                # small cleanup
                s = re.sub(r"\s+\(.*?\)", "", s)
                s = re.sub(r"[\.:]$", "", s)
                if target == 'req':
                    reqs.append(s)
                else:
                    prefs.append(s)
        else:
            # look for inline lists like "Requirements: X, Y, Z"
            m = re.search(r"(?:requirements|qualifications)[:\-]\s*(.+)", line, re.I)
            if m:
                items = re.split(r",|;|\band\b", m.group(1))
                for it in items:
                    s = it.strip()
                    if s:
                        reqs.append(s)

    # dedupe and normalize length
    def clean(arr):
        out = []
        seen = set()
        for a in arr:
            k = a.lower()
            if k in seen: continue
            seen.add(k)
            out.append(a)
        return out[:40]

    return clean(reqs), clean(prefs)


def _summarize_text(text, max_len=300):
    # Naive summary: first 2-3 non-empty lines, truncated
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        return ""
    s = ' '.join(lines[:3])
    return (s[:max_len] + '...') if len(s) > max_len else s
