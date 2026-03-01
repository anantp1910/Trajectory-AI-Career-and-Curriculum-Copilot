import json
import re


def _normalize(s):
  return re.sub(r"[^a-z0-9 ]", "", (s or "").lower())


def _find_course_for_skill(skill, course_db):
  key = _normalize(skill)
  # prefer exact skill in course 'skills' lists
  for c in course_db:
    skills = [_normalize(x) for x in c.get("skills", [])]
    if any(key in sk or sk in key for sk in skills):
      return c.get("code")
  # fallback: match in course name
  for c in course_db:
    name = _normalize(c.get("name", ""))
    if key.split()[0] in name:
      return c.get("code")
  return None


def build_skill_graph(client, major, courses_taken, career_goal, resume_skills, job_requirements, course_db):
  """Deterministic skill graph builder.

  Rules:
  - Extract target skills from `job_requirements` (free text list) and from course_db
  - Use `resume_skills` to set higher 'have' levels
  - Map skills to recommended course codes using course_db
  - Return `skills_chart` (8-12 items) and `gaps` ordered by severity
  """
  # Normalize inputs
  resume_set = set([_normalize(s) for s in (resume_skills or [])])
  job_reqs = job_requirements or []
  job_skills = set()

  # Narrow course pool by major when possible to avoid unrelated recommendations.
  major_lower = (major or "").lower()
  filtered_course_db = course_db
  try:
    if "computer" in major_lower or major_lower.strip() in ("cs", "c.s.", "computer science"):
      filtered_course_db = [c for c in course_db if str(c.get("code", "")).upper().startswith("CMPSC") or "computer" in (c.get("department", "") or "").lower()]
    elif major_lower:
      # for other majors, prefer courses whose code or department contains the major token
      token = major_lower.split()[0]
      filtered_course_db = [c for c in course_db if token in (c.get("code", "") + " " + (c.get("department", "") or "")).lower()]
  except Exception:
    filtered_course_db = course_db

  # naive extraction: split requirement lines and pick nouns/key tokens
  for r in job_reqs:
    parts = re.split(r"[,;/()\\|\\-]", r)
    for p in parts:
      p_norm = _normalize(p)
      if len(p_norm.split()) <= 1 and len(p_norm) < 2:
        continue
      # heuristics: skip long sentences, keep 1-4 word candidates
      tokens = p_norm.split()
      if 1 <= len(tokens) <= 5:
        job_skills.add(p_norm.strip())
      else:
        # extract key terms like 'python', 'sql', 'machine learning'
        for term in ["python", "sql", "javascript", "java", "c++", "docker", "git", "react", "machine learning", "data analysis", "algorithms", "systems", "linux", "api"]:
          if term in p_norm:
            job_skills.add(term)

  # Seed candidate skill list: union of resume, job skills, and common course skills
  common_skills = set()
  for c in filtered_course_db:
    for sk in c.get("skills", []):
      common_skills.add(_normalize(sk))

  # prioritize: job_skills > resume_skills > common_skills (by prominence)
  prioritized = []
  for s in list(job_skills):
    if s and s not in prioritized:
      prioritized.append(s)
  for s in resume_set:
    if s and s not in prioritized:
      prioritized.append(s)
  for s in list(common_skills)[:40]:
    if s and s not in prioritized:
      prioritized.append(s)

  # Trim or extend to 8-12 skills
  skill_targets = prioritized[:12]
  if len(skill_targets) < 8:
    # pad with common skills
    for s in list(common_skills):
      if s not in skill_targets:
        skill_targets.append(s)
      if len(skill_targets) >= 8:
        break

  # Build chart entries
  def have_level_for(skill_norm):
    if skill_norm in resume_set:
      return min(90, 60 + int(len(skill_norm) * 3))
    # if student lists courses_taken containing related course codes, boost
    if courses_taken:
      # parse provided course codes and check if any taken course teaches this skill
      ct = [x.strip().upper() for x in courses_taken.split(",") if x.strip()]
      try:
        for code in ct:
          # if the student took a course whose record contains this skill, boost have level
          for course in filtered_course_db:
            if course.get("code", "").upper() == code:
              skills = [_normalize(k) for k in course.get("skills", [])]
              if skill_norm in skills or any(skill_norm in s or s in skill_norm for s in skills):
                return 70
      except Exception:
        pass
    return 20

  skills_chart = []
  gaps = []
  for s in skill_targets:
    need = 80 if any(s in _normalize(r) for r in job_reqs) else 60
    have = have_level_for(s)
    recommended_course = _find_course_for_skill(s, filtered_course_db)
    source = "resume" if s in resume_set else ("career" if any(s in _normalize(r) for r in job_reqs) else "course")
    # human-friendly skill display (handle acronyms and common terms)
    def _pretty_skill(k):
      k = k.strip()
      m = {
        'seo': 'SEO', 'ab testing': 'A/B Testing', 'a b testing': 'A/B Testing',
        'api': 'API', 'sql': 'SQL', 'ml': 'Machine Learning', 'ai': 'AI'
      }
      low = k.lower()
      if low in m:
        return m[low]
      # capitalize common words
      parts = [p.upper() if p.lower() in ('sql','api','ai','ml','seo') else p.title() for p in k.split()]
      return ' '.join(parts)

    display_name = _pretty_skill(s)
    skills_chart.append({"name": display_name, "have": have, "need": need, "source": source, "recommended_course": recommended_course, "target_job": career_goal})
    if need - have >= 20:
      severity = "critical" if need - have >= 40 else "major"
      gaps.append({"skill": display_name, "have_level": have, "need_level": need, "gap_severity": severity, "recommended_course": recommended_course, "recommended_resource": None, "appears_in": "both" if source == "resume" and any(s in _normalize(r) for r in job_reqs) else source, "target_job": career_goal})

  # sort gaps by severity then size
  gaps = sorted(gaps, key=lambda g: (0 if g["gap_severity"] == "critical" else 1, -(g["need_level"] - g["have_level"])))

  return {"skills_chart": skills_chart, "gaps": gaps}

