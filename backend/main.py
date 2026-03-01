from dotenv import load_dotenv
load_dotenv()

import json, os, io
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from anthropic import Anthropic
from typing import Optional, List, Dict, Any

from engines.resume_parser import extract_text_from_pdf, parse_resume
from engines.skill_graph import build_skill_graph
from engines.curriculum_engine import generate_curriculum_plan
from engines.career_engine import score_job_readiness, highlight_resume_skills
from engines.job_scraper import scrape_job_url, parse_job_text

app = FastAPI(title="Trajectory API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not API_KEY:
    raise RuntimeError("Missing ANTHROPIC_API_KEY. Put it in backend/.env or export it.")
ai = Anthropic(api_key=API_KEY)

import logging
logger = logging.getLogger("trajectory")
logging.basicConfig(level=logging.INFO)

# ── Load courses ──
data_dir = os.path.join(os.path.dirname(__file__), "data")
merged_path = os.path.join(data_dir, "courses_merged.json")
default_path = os.path.join(data_dir, "courses.json")
use_path = merged_path if os.path.exists(merged_path) else default_path
with open(use_path) as f:
    COURSES = json.load(f).get("courses", [])


@app.get("/health")
async def health():
    return {"status": "ok", "courses": len(COURSES)}


@app.post("/analyze")
async def analyze(
    major: str = Form(...),
    courses_taken: str = Form(...),
    career_goal: str = Form(...),
    resume: UploadFile = File(None),
    job_url: str = Form(None),
    job_text: str = Form(None),
):
    """Full analysis — curriculum + skill graph + job readiness + resume highlights."""
    try:
        result = await compute_full_analysis(
            major=major,
            courses_taken=courses_taken,
            career_goal=career_goal,
            resume_file=resume,
            job_url=job_url,
            job_text=job_text,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def compute_full_analysis(
    major: str,
    courses_taken: str,
    career_goal: str,
    resume_file: Optional[UploadFile] = None,
    job_url: Optional[str] = None,
    job_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Shared analysis logic. Returns the full payload used by /analyze.

    This helper is used by new granular endpoints so the frontend can request
    only the pieces it needs for progressive disclosure and lighter UI flows.
    """
    # 1. Parse resume
    resume_data, resume_skills = None, []
    if resume_file:
        raw = await resume_file.read()
        if len(raw) > 100:
            text = extract_text_from_pdf(raw)
            if text:
                resume_data = parse_resume(ai, text)
                resume_skills = resume_data.get("skills", [])

    # 2. Parse job listing
    job_reqs: List[str] = []
    if job_url and job_url.startswith("http"):
        jd = await scrape_job_url(ai, job_url)
        if jd:
            job_reqs = (jd.get("requirements") or []) + (jd.get("preferred") or [])
    elif job_text and len(job_text or "") > 20:
        jd = parse_job_text(ai, job_text)
        if jd:
            job_reqs = (jd.get("requirements") or []) + (jd.get("preferred") or [])

    # 3. Build skill graph
    sg = build_skill_graph(ai, major, courses_taken, career_goal, resume_skills, job_reqs, COURSES)

    # 4. Curriculum
    curriculum = generate_curriculum_plan(ai, major, courses_taken, career_goal, sg.get("gaps", []), COURSES)

    # 5. Job readiness score
    readiness = score_job_readiness(ai, career_goal, resume_skills, sg.get("gaps", []), job_reqs)

    # 6. Resume highlights
    resume_highlights = None
    if resume_data:
        resume_highlights = highlight_resume_skills(ai, resume_data, job_reqs, sg.get("gaps", []), career_goal)

    return {
        "curriculum": curriculum,
        "skillGraph": {"skills": sg.get("skills_chart", []), "gaps": sg.get("gaps", [])},
        "readiness": readiness,
        "resumeHighlights": resume_highlights,
        "resumeData": resume_data,
    }


def _log_request_context(major, courses_taken, resume_file, job_url, job_text):
    # lightweight logging to help debug per-request signals
    try:
        logger.info("Analyze request context: major=%s, courses_taken=%s, resume=%s, job_url=%s, job_text_len=%d", major, bool(courses_taken), bool(resume_file), bool(job_url), len(job_text or ""))
    except Exception:
        logger.info("Analyze request context: (failed to format context)")


@app.post("/analyze/skillgraph")
async def analyze_skillgraph(
    major: str = Form(...),
    courses_taken: str = Form(...),
    career_goal: str = Form(...),
    resume: UploadFile = File(None),
    job_url: str = Form(None),
    job_text: str = Form(None),
):
    """Return only the skill graph (good for rendering graphs/charts)."""
    try:
        res = await compute_full_analysis(major, courses_taken, career_goal, resume, job_url, job_text)
        return {"skillGraph": res.get("skillGraph")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/curriculum")
async def analyze_curriculum(
    major: str = Form(...),
    courses_taken: str = Form(...),
    career_goal: str = Form(...),
):
    """Return only the curriculum plan for step-by-step views."""
    try:
        res = await compute_full_analysis(major, courses_taken, career_goal, None, None, None)
        return {"curriculum": res.get("curriculum")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/readiness")
async def analyze_readiness(
    major: str = Form(...),
    courses_taken: str = Form(...),
    career_goal: str = Form(...),
    resume: UploadFile = File(None),
    job_url: str = Form(None),
    job_text: str = Form(None),
):
    """Return only the readiness score and skill bars for the UI."""
    try:
        res = await compute_full_analysis(major, courses_taken, career_goal, resume, job_url, job_text)
        return {"readiness": res.get("readiness")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/resume-highlights")
async def analyze_resume_highlights(
    major: str = Form(...),
    courses_taken: str = Form(...),
    career_goal: str = Form(...),
    resume: UploadFile = File(...),
    job_url: str = Form(None),
    job_text: str = Form(None),
):
    """Return only resume highlights (requires a resume upload)."""
    try:
        res = await compute_full_analysis(major, courses_taken, career_goal, resume, job_url, job_text)
        return {"resumeHighlights": res.get("resumeHighlights"), "resumeData": res.get("resumeData")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/summary")
async def analyze_summary(
    major: str = Form(...),
    courses_taken: str = Form(...),
    career_goal: str = Form(...),
    resume: UploadFile = File(None),
    job_url: str = Form(None),
    job_text: str = Form(None),
):
    """Return a condensed summary suitable for a landing or overview card.

    Fields: overall readiness score, top 3 gaps, top 3 recommended courses, brief resume highlights (if present).
    """
    try:
        res = await compute_full_analysis(major, courses_taken, career_goal, resume, job_url, job_text)
        readiness = res.get("readiness")
        gaps = res.get("skillGraph", {}).get("gaps", [])
        top_gaps = gaps[:3]
        curriculum = res.get("curriculum") or {}
        # Try to collect top 3 recommended course titles if available
        recommended = []
        if isinstance(curriculum, dict):
            # If curriculum is structured with semesters, pull a few course names
            for sem_courses in curriculum.get("plan", [])[:3]:
                if isinstance(sem_courses, list):
                    recommended.extend([c.get("title") if isinstance(c, dict) else c for c in sem_courses])
        if not recommended and isinstance(curriculum, list):
            recommended = [c.get("title") if isinstance(c, dict) else c for c in curriculum[:3]]
        recommended = [r for r in recommended if r][:3]

        return {
            "readiness": readiness,
            "topGaps": top_gaps,
            "recommendedCourses": recommended,
            "resumeHighlights": res.get("resumeHighlights"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/whatif")
async def what_if(
    major: str = Form(...),
    courses_taken: str = Form(...),
    career_goal: str = Form(...),
):
    """What-If engine — quick rerun with different major/goal."""
    try:
        # For quick what-if runs we use deterministic engines (no API calls)
        sg = build_skill_graph(None, major, courses_taken, career_goal, [], [], COURSES)
        curriculum = generate_curriculum_plan(None, major, courses_taken, career_goal, sg.get("gaps", []), COURSES)
        readiness = score_job_readiness(None, career_goal, [], sg.get("gaps", []), [])
        return {
            "curriculum": curriculum,
            "skillGraph": {"skills": sg.get("skills_chart", []), "gaps": sg.get("gaps", [])},
            "readiness": readiness,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
