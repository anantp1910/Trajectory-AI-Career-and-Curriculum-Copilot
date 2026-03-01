import json
import re


def _normalize(s):
    return re.sub(r"[^a-z0-9 ]", "", (s or "").lower())


def _build_prereq_map(course_db):
    """Return {code: [prereq_code, ...]}"""
    return {c["code"]: c.get("prerequisites", []) for c in course_db}


def _topo_sort(codes, prereq_map):
    """Return codes sorted so prerequisites come first."""
    visited, order = set(), []

    def visit(code):
        if code in visited:
            return
        visited.add(code)
        for pre in prereq_map.get(code, []):
            visit(pre)
        order.append(code)

    for code in codes:
        visit(code)
    return order


def _filter_by_major(major, course_db):
    major_lower = (major or "").lower()
    dept_map = {
        "computer science": ["Computer Science"],
        "computer engineering": ["Computer Science", "Electrical Engineering"],
        "data sciences": ["Data Sciences", "Statistics", "Computer Science", "Mathematics"],
        "information sciences": ["IST", "Computer Science"],
        "ist": ["IST", "Computer Science"],
        "electrical engineering": ["Electrical Engineering", "Physics", "Mathematics"],
        "mechanical engineering": ["Mechanical Engineering", "Physics", "Mathematics"],
        "industrial engineering": ["Industrial Engineering", "Statistics", "Mathematics"],
        "finance": ["Finance", "Accounting", "Economics", "Business", "Business Intelligence", "Mathematics", "Statistics", "Supply Chain", "Management"],
        "accounting": ["Accounting", "Finance", "Economics", "Business", "Mathematics", "Statistics"],
        "marketing": ["Marketing", "Management", "Economics", "Statistics", "Business Intelligence"],
        "management": ["Management", "Finance", "Marketing", "Economics", "Supply Chain"],
        "biology": ["Biology", "Chemistry", "Mathematics", "Statistics"],
        "chemistry": ["Chemistry", "Biology", "Physics", "Mathematics"],
        "mathematics": ["Mathematics", "Statistics", "Computer Science"],
        "statistics": ["Statistics", "Mathematics", "Computer Science", "Data Sciences"],
    }
    for key, depts in dept_map.items():
        if key in major_lower:
            return [c for c in course_db if c.get("department") in depts]
    # fallback: use all
    return course_db


def _find_courses_for_skill(skill_norm, course_pool, exclude_codes):
    """Return up to 2 courses that teach this skill, not in exclude_codes."""
    results = []
    for c in course_pool:
        if c.get("code") in exclude_codes:
            continue
        skill_tags = [_normalize(s) for s in c.get("skills", [])]
        if any(skill_norm in tag or tag in skill_norm for tag in skill_tags):
            results.append(c)
        if len(results) >= 2:
            break
    return results


def _ai_curriculum_plan(client, major, courses_taken, career_goal, skill_gaps, course_pool):
    """Use Claude to generate a smart 4-semester plan. Returns the plan dict or None."""
    course_list = [
        {"code": c["code"], "name": c["name"], "skills": c.get("skills", [])[:3],
         "prerequisites": c.get("prerequisites", [])}
        for c in course_pool[:60]  # keep prompt manageable
    ]
    schema = {
        "semesters": [
            {
                "name": "Fall 2025 — Semester 1",
                "courses": [
                    {"code": "FIN 301", "name": "Corporation Finance",
                     "fills_skill": "Financial Analysis, Valuation",
                     "career_relevance": "Core for investment banking",
                     "recommended": True}
                ]
            }
        ],
        "resources": [
            {"skill": "Financial Modeling", "platform": "CFI", "title": "Financial Modeling Course",
             "url": "https://corporatefinanceinstitute.com", "reason": "Covers Excel modeling for IB roles"}
        ],
        "total_remaining_semesters": 4,
        "career_readiness_after": 85,
        "summary": "This plan builds core skills needed for investment banking through structured coursework."
    }
    prompt = (
        f"You are a Penn State academic advisor. Build a semester-by-semester course plan.\n\n"
        f"Student: {major} major, targeting {career_goal}\n"
        f"Already taken: {courses_taken or 'None'}\n"
        f"Skill gaps to address: {json.dumps([g.get('skill') for g in (skill_gaps or [])[:8]])}\n\n"
        f"Available Penn State courses (use ONLY codes from this list):\n"
        f"{json.dumps(course_list, indent=2)}\n\n"
        f"Rules:\n"
        f"- Build exactly 4 semesters: Fall 2025, Spring 2026, Fall 2026, Spring 2027\n"
        f"- Each semester: 4-5 courses\n"
        f"- Respect prerequisites — courses with prereqs must come after the prereq is taken\n"
        f"- Mark the 2-3 most impactful courses per semester as recommended: true\n"
        f"- Include 4-6 online learning resources for key skills\n"
        f"- career_readiness_after must be an INTEGER (0-100), not a string\n\n"
        f"Return ONLY this JSON structure:\n{json.dumps(schema, indent=2)}"
    )
    try:
        response = client.messages.create(
            model="claude-sonnet-4-5", max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text
        parsed = None
        try:
            parsed = json.loads(text)
        except Exception:
            s, e = text.find('{'), text.rfind('}') + 1
            if s != -1 and e > s:
                parsed = json.loads(text[s:e])
        if parsed and "semesters" in parsed and len(parsed["semesters"]) >= 2:
            # ensure career_readiness_after is an int
            raw = parsed.get("career_readiness_after", 80)
            if isinstance(raw, str):
                nums = re.findall(r"\d+", raw)
                parsed["career_readiness_after"] = int(nums[0]) if nums else 80
            return parsed
    except Exception:
        pass
    return None


def generate_curriculum_plan(client, major, courses_taken, career_goal, skill_gaps, course_db):
    """Generate a 4-semester curriculum plan.

    Uses AI when available; falls back to a smarter deterministic planner.
    Returns JSON with semesters, resources, total_remaining_semesters,
    career_readiness_after (int), summary.
    """
    taken = set(c.strip().upper() for c in (courses_taken or "").split(",") if c.strip())
    course_pool = _filter_by_major(major, course_db)
    if not course_pool:
        course_pool = course_db

    # ── AI path ──────────────────────────────────────────────────────
    if client:
        result = _ai_curriculum_plan(client, major, courses_taken, career_goal, skill_gaps, course_pool)
        if result:
            return result

    # ── Deterministic fallback ────────────────────────────────────────
    prereq_map = _build_prereq_map(course_db)
    used = set(taken)

    # Gather candidate courses: match skill gaps first, then fill from pool
    gap_matched = []
    for g in (skill_gaps or []):
        skill_name = g.get("skill") or g.get("skill_name") or str(g)
        key = _normalize(skill_name)
        matches = _find_courses_for_skill(key, course_pool, used)
        for m in matches:
            if m["code"] not in [x["code"] for x in gap_matched] and m["code"] not in used:
                gap_matched.append(m)

    # Fill remaining slots from pool (not already scheduled)
    scheduled_codes = set(c["code"] for c in gap_matched)
    extra = [c for c in course_pool if c["code"] not in scheduled_codes and c["code"] not in used]
    candidates = gap_matched + extra[:20]

    # Topo-sort so prereqs come first
    all_codes = [c["code"] for c in candidates]
    sorted_codes = _topo_sort(all_codes, prereq_map)

    # Build code -> course record map
    code_to_course = {c["code"]: c for c in course_db}

    # Assign to 4 semesters, 4-5 courses each, checking prereqs satisfied
    SEM_NAMES = ["Fall 2025", "Spring 2026", "Fall 2026", "Spring 2027"]
    semesters_data = [[] for _ in SEM_NAMES]
    completed = set(taken)

    for sem_idx, sem_name in enumerate(SEM_NAMES):
        count = 0
        added_this_sem = []
        for code in sorted_codes:
            if count >= 5:
                break
            if code in completed:
                continue
            course = code_to_course.get(code)
            if not course:
                continue
            prereqs = course.get("prerequisites", [])
            if all(p in completed for p in prereqs):
                is_gap_match = code in [c["code"] for c in gap_matched]
                semesters_data[sem_idx].append({
                    "code": code,
                    "name": course.get("name", ""),
                    "fills_skill": ", ".join(course.get("skills", [])[:2]),
                    "career_relevance": ", ".join(course.get("career_relevance", [])[:2]),
                    "recommended": is_gap_match and count < 3,
                })
                added_this_sem.append(code)
                count += 1
        for code in added_this_sem:
            completed.add(code)
        # remove assigned from sorted list to avoid re-adding
        sorted_codes = [c for c in sorted_codes if c not in set(added_this_sem)]

    semesters = [
        {"name": f"{name} — Recommended", "courses": courses}
        for name, courses in zip(SEM_NAMES, semesters_data)
        if courses
    ]
    if not semesters:
        fallback = course_pool[:4]
        semesters = [{"name": "Next Semester — Recommended", "courses": [
            {"code": c["code"], "name": c["name"],
             "fills_skill": ", ".join(c.get("skills", [])[:2]),
             "career_relevance": ", ".join(c.get("career_relevance", [])[:2]),
             "recommended": True}
            for c in fallback
        ]}]

    # Resources
    resources = []
    resource_map = {
        "financial modeling": {"platform": "CFI", "title": "Financial Modeling & Valuation Analyst", "url": "https://corporatefinanceinstitute.com/courses/financial-modeling/"},
        "valuation": {"platform": "Coursera", "title": "Business and Financial Modeling", "url": "https://www.coursera.org/specializations/wharton-business-financial-modeling"},
        "investment banking": {"platform": "Wall Street Prep", "title": "Investment Banking Course", "url": "https://www.wallstreetprep.com/self-study-programs/"},
        "sql": {"platform": "Mode", "title": "SQL Tutorial for Data Analysis", "url": "https://mode.com/sql-tutorial/"},
        "machine learning": {"platform": "Coursera", "title": "Machine Learning Specialization", "url": "https://www.coursera.org/specializations/machine-learning-introduction"},
        "data analysis": {"platform": "Coursera", "title": "Google Data Analytics Certificate", "url": "https://www.coursera.org/professional-certificates/google-data-analytics"},
        "python": {"platform": "YouTube", "title": "Python Full Course – freeCodeCamp", "url": "https://www.youtube.com/watch?v=rfscVS0vtbw"},
        "deep learning": {"platform": "fast.ai", "title": "Practical Deep Learning for Coders", "url": "https://course.fast.ai"},
        "algorithms": {"platform": "LeetCode", "title": "LeetCode – Algorithm Practice", "url": "https://leetcode.com"},
        "statistics": {"platform": "Khan Academy", "title": "Statistics and Probability", "url": "https://www.khanacademy.org/math/statistics-probability"},
        "excel": {"platform": "CFI", "title": "Excel Crash Course", "url": "https://corporatefinanceinstitute.com/courses/excel-fundamentals/"},
        "accounting": {"platform": "Coursera", "title": "Introduction to Financial Accounting", "url": "https://www.coursera.org/learn/wharton-accounting"},
    }
    for g in (skill_gaps or [])[:6]:
        skill = _normalize(g.get("skill", ""))
        for key, res in resource_map.items():
            if key in skill or skill in key:
                resources.append({
                    "skill": g.get("skill"),
                    "platform": res["platform"],
                    "title": res["title"],
                    "url": res["url"],
                    "reason": f"Builds {g.get('skill')} for {career_goal}"
                })
                break

    return {
        "semesters": semesters,
        "resources": resources,
        "total_remaining_semesters": len(semesters),
        "career_readiness_after": 82,
        "summary": f"This plan addresses your top skill gaps for {career_goal} by sequencing {sum(len(s['courses']) for s in semesters)} Penn State courses across {len(semesters)} semesters, respecting prerequisites."
    }
