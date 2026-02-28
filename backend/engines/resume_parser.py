import pdfplumber
import json
import io


def extract_text_from_pdf(file_bytes):
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages).strip()
    except Exception as e:
        return None


def parse_resume(client, resume_text):
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""Parse this resume into JSON:
{{
  "name": "student name",
  "skills": ["every technical and soft skill mentioned"],
  "experience": [
    {{"title": "role", "company": "company", "bullets": ["what they did"]}}
  ],
  "projects": [{{"name": "project", "description": "brief", "technologies": ["tech"]}}],
  "experience_summary": "2-3 sentence summary of background"
}}

Resume:
{resume_text}

Return ONLY valid JSON."""
        }]
    )
    text = response.content[0].text
    try:
        return json.loads(text)
    except:
        s, e = text.find('{'), text.rfind('}') + 1
        if s != -1 and e > s:
            return json.loads(text[s:e])
        return {"name": "Student", "skills": [], "experience": [], "projects": [], "experience_summary": ""}
