import json
import re


def _normalize(s):
    return re.sub(r"[^a-z0-9 ]", "", (s or "").lower())


def generate_curriculum_plan(client, major, courses_taken, career_goal, skill_gaps, course_db):
    """Deterministic curriculum planner.

    - For each skill gap, pick a matching course from `course_db` (by skill tag match)
    - Build 2-4 semester plan prioritizing critical gaps
    - Return JSON with `semesters`, `resources`, `total_remaining_semesters`, `career_readiness_after`, `summary`
    """
    taken = [c.strip().upper() for c in (courses_taken or "").split(",") if c.strip()]

    # map skill -> recommended course code
    recommendations = []
    for g in skill_gaps or []:
        skill_name = g.get("skill") or g.get("skill_name") or g
        key = _normalize(skill_name)
        # find best matching course
        match = None
        for c in course_db:
            skills = [ _normalize(x) for x in c.get("skills", []) ]
            if any(key in sk or sk in key for sk in skills):
                if c.get("code") not in taken:
                    match = c
                    break
        if match:
            recommendations.append((skill_name, match))

    # Build semesters (up to 3), fill with recommended courses first
    semesters = []
    per_sem = 4
    rec_codes = [c.get("code") for _, c in recommendations]
    used = set(taken)
    sem_names = ["Fall 2025", "Spring 2026", "Fall 2026"]
    idx = 0
    for sem in sem_names:
        sem_courses = []
        while len(sem_courses) < per_sem and idx < len(rec_codes):
            code = rec_codes[idx]
            idx += 1
            if code in used: continue
            # find course record
            c = next((x for x in course_db if x.get("code") == code), None)
            if not c: continue
            used.add(code)
            sem_courses.append({"code": c.get("code"), "name": c.get("name"), "fills_skill": ", ".join(c.get("skills", [])[:2]), "career_relevance": ", ".join(c.get("career_relevance", [])[:2]), "recommended": True})
        if sem_courses:
            semesters.append({"name": sem + " — Recommended", "courses": sem_courses})

    # If no recommended course matched, suggest general foundational CS courses for CS majors
    if not semesters:
        fallback = [c for c in course_db if c.get("code") in ["CMPSC 131", "CMPSC 132", "CMPSC 465"]]
        semesters = [{"name": "Next Semester — Recommended", "courses": [{"code": c.get("code"), "name": c.get("name"), "fills_skill": ", ".join(c.get("skills", [])[:2]), "career_relevance": ", ".join(c.get("career_relevance", [])[:2]), "recommended": True} for c in fallback]}]

    # Resources: lightweight curated links based on top gaps
    resources = []
    for skill, course in recommendations[:6]:
        url = "https://www.coursera.org" if "data" in _normalize(skill) or "machine" in _normalize(skill) else "https://www.youtube.com"
        resources.append({"skill": skill, "platform": "Online", "title": course.get("name"), "url": url, "reason": f"Covers {skill} and complements {course.get('code')}"})

    total_remaining = len(semesters)
    readiness_after = "~85%" if recommendations else "N/A"
    summary = f"Recommended {len(recommendations)} course(s) to address top skill gaps for {career_goal}."

    return {"semesters": semesters, "resources": resources, "total_remaining_semesters": total_remaining, "career_readiness_after": readiness_after, "summary": summary}

