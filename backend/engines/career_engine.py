import json


def score_job_readiness(client, career_goal, skills_have, skill_gaps, job_requirements):
    """Score how ready a student is for a specific job, skill by skill.

    Tries to use the AI client when available; otherwise falls back to a
    deterministic scorer based on the provided `skill_gaps`.
    """
    # Try AI if available, otherwise fall back to deterministic scoring
    try:
        if client:
            schema_example = {
                "overall_readiness": 65,
                "readiness_after_plan": 85,
                "skill_scores": [
                    {"skill": "Python", "current_level": 80, "required_level": 75, "status": "strong", "note": "Solid foundation", "course_fix": None}
                ],
                "top_strengths": ["Python", "Git"],
                "critical_gaps": ["Data Analysis", "SQL"],
                "action_items": ["Take STAT 318 to address Data Analysis gap"]
            }
            prompt = (
                f"You are a career readiness assessor. Score how ready this student is for: {career_goal}\n\n"
                f"Student's current skills: {json.dumps(skills_have)}\n"
                f"Known skill gaps: {json.dumps(skill_gaps[:6])}\n"
                f"Job requirements: {json.dumps(job_requirements) if job_requirements else 'Infer from career goal'}\n\n"
                f"Return ONLY a JSON object with EXACTLY this structure (no extra keys):\n"
                f"{json.dumps(schema_example, indent=2)}\n\n"
                f"Rules:\n"
                f"- overall_readiness: integer 0-100\n"
                f"- readiness_after_plan: integer 0-100, must be >= overall_readiness\n"
                f"- skill_scores: array where status is one of: strong, ready, gap, critical\n"
                f"- course_fix: a course code string or null\n"
                f"- top_strengths, critical_gaps, action_items: arrays of strings"
            )
            response = client.messages.create(
                model="claude-sonnet-4-5", max_tokens=2000,
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
            # Validate required fields before returning
            if parsed and all(k in parsed for k in ("overall_readiness", "readiness_after_plan", "skill_scores")):
                return parsed
    except Exception:
        # fall through to deterministic
        pass

    # Deterministic fallback: compute simple scores from skill_gaps
    skill_scores = []
    total_pct = 0
    count = 0
    for g in (skill_gaps or []):
        skill = g.get('skill') if isinstance(g, dict) else str(g)
        have = int(g.get('have_level', 20) if isinstance(g, dict) else 20)
        need = int(g.get('need_level', 80) if isinstance(g, dict) else 80)
        diff = need - have
        if diff <= 0:
            status = 'ready'
        elif diff < 15:
            status = 'strong'
        elif diff < 40:
            status = 'gap'
        else:
            status = 'critical'
        note = g.get('note') if isinstance(g, dict) and g.get('note') else ''
        course_fix = g.get('recommended_course') if isinstance(g, dict) else None
        skill_scores.append({
            'skill': skill,
            'current_level': have,
            'required_level': need,
            'status': status,
            'note': note,
            'course_fix': course_fix,
        })
        total_pct += max(0, min(100, int((have / (need or 1)) * 100)))
        count += 1

    overall = int(total_pct / count) if count else 50
    top_strengths = [s.get('skill') for s in sorted(skill_scores, key=lambda x: -x.get('current_level', 0))[:3]]
    critical_gaps = [s.get('skill') for s in skill_scores if s.get('status') == 'critical']
    action_items = []
    for s in skill_scores:
        if s.get('course_fix'):
            action_items.append(f"Take {s.get('course_fix')} to address {s.get('skill')}")

    return {
        'overall_readiness': overall,
        'readiness_after_plan': min(100, overall + 20),
        'skill_scores': skill_scores,
        'top_strengths': top_strengths,
        'critical_gaps': critical_gaps,
        'action_items': action_items or ["Follow recommended courses to close gaps"]
    }


def highlight_resume_skills(client, resume_data, job_requirements, skill_gaps, career_goal):
    """Lightweight resume analysis — what to highlight, what's missing, rewritten bullets."""
    prompt = f"You are a resume coach. Analyze this resume for a {career_goal} role.\n\nResume data: {json.dumps(resume_data, indent=2)}\nJob requirements: {json.dumps(job_requirements) if job_requirements else 'Infer from ' + career_goal}\nSkill gaps: {json.dumps([g.get('skill') for g in skill_gaps[:5]])}\n\nReturn JSON."
    try:
        if client:
            response = client.messages.create(
                model="claude-sonnet-4-20250514", max_tokens=2000,
                messages=[{"role": "user", "content": prompt}]
            )
            text = response.content[0].text
            try:
                return json.loads(text)
            except:
                s, e = text.find('{'), text.rfind('}') + 1
                if s != -1 and e > s:
                    return json.loads(text[s:e])
    except Exception:
        # Deterministic fallback
        resume_skills = []
        resume_experience = []
        if isinstance(resume_data, dict):
            resume_skills = resume_data.get('skills', []) or []
            resume_experience = resume_data.get('experience', []) or []

        missing = []
        for g in (skill_gaps or []):
            name = g.get('skill') if isinstance(g, dict) else str(g)
            if name and name not in resume_skills:
                missing.append({'skill': name, 'suggestion': f"Add: '{name} experience...'", 'course_fix': g.get('recommended_course') if isinstance(g, dict) else None})

        rewritten = []
        for exp in resume_experience[:3]:
            title = exp.get('title') or exp.get('company') or 'Experience'
            rewritten.append({'original_context': title, 'rewritten': f"{title} — emphasize impact and metrics (e.g., 'Improved X by Y%')."})

        return {
            'match_percentage': 50 + min(30, len(resume_skills) * 5),
            'highlight_these': [{'skill': s, 'why': 'Relevant to target role'} for s in resume_skills[:5]],
            'missing_from_resume': missing,
            'rewritten_bullets': rewritten,
            'quick_tips': ["Add metrics to bullets", "Lead with outcomes", "Order skills by relevance to role"]
        }
