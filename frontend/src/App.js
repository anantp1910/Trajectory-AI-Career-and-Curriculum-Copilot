import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ════════════════════════════════════════════
// THEME
// ════════════════════════════════════════════
const C = {
  bg: "#0a0a0f", surface: "#12121a", surface2: "#1a1a26",
  accent: "#4af4c4", accentDim: "rgba(74,244,196,0.15)", accentGlow: "rgba(74,244,196,0.08)",
  warn: "#f4a04a", warnDim: "rgba(244,160,74,0.15)",
  text: "#e8e8f0", dim: "#8888a0", faint: "#55556a",
  border: "#2a2a3a", red: "#f45a5a", redDim: "rgba(244,90,90,0.12)",
  blue: "#60a0ff", blueDim: "rgba(96,160,255,0.15)",
  purple: "#c084fc",
};
const API = "http://localhost:8000";

// ════════════════════════════════════════════
// PENN STATE DATA
// ════════════════════════════════════════════
const MAJORS = [
  "Computer Science", "Computer Engineering", "Data Sciences",
  "Information Sciences & Technology", "Electrical Engineering",
  "Mechanical Engineering", "Industrial Engineering", "Finance",
  "Accounting", "Marketing", "Management", "Biology", "Chemistry",
  "Mathematics", "Statistics",
];

const COURSES_MAP = {
  "Computer Science": ["CMPSC 131","CMPSC 132","CMPSC 221","CMPSC 311","CMPSC 360","CMPSC 431W","CMPSC 442","CMPSC 448","CMPSC 461","CMPSC 465","CMPSC 473","CMPSC 483W","CMPSC 497","MATH 140","MATH 141","MATH 220","STAT 318","PHYS 211"],
  "Data Sciences": ["DS 200","DS 220","DS 310","DS 410","CMPSC 131","CMPSC 132","STAT 200","STAT 318","STAT 380","MATH 140","MATH 141","MATH 220","IST 210","CMPSC 448"],
  "Finance": ["FIN 301","FIN 302","ACCTG 211","ECON 102","ECON 104","MGMT 301","MKT 301","SCM 301","STAT 200","MATH 140","BI 301"],
  "Marketing": ["MKT 301","MKT 330","MGMT 301","ECON 102","STAT 200","ACCTG 211","SCM 301","BI 301","CAS 100"],
  default: ["MATH 140","MATH 141","ENGL 015","CAS 100","ECON 102","ECON 104","STAT 200","PHYS 211","CHEM 110","BIOL 110","MGMT 301","MKT 301","IST 210"],
};

const PREREQ_TREE = {
  "CMPSC 131": [], "CMPSC 132": ["CMPSC 131"], "CMPSC 221": ["CMPSC 132"],
  "CMPSC 311": ["CMPSC 221"], "CMPSC 360": ["CMPSC 132","MATH 141"],
  "CMPSC 431W": ["CMPSC 221"], "CMPSC 442": ["CMPSC 360"],
  "CMPSC 448": ["CMPSC 360","STAT 318"], "CMPSC 461": ["CMPSC 360"],
  "CMPSC 465": ["CMPSC 360"], "CMPSC 473": ["CMPSC 311"],
  "CMPSC 483W": ["CMPSC 221"], "CMPSC 497": [],
  "MATH 140": [], "MATH 141": ["MATH 140"], "MATH 220": ["MATH 140"],
  "MATH 230": ["MATH 141"], "STAT 200": [], "STAT 318": ["MATH 141"],
  "STAT 380": ["STAT 200"], "PHYS 211": ["MATH 140"],
  "DS 200": [], "DS 220": ["CMPSC 131"], "DS 310": ["DS 200"],
  "DS 410": ["DS 310","STAT 318"], "IST 210": [], "IST 256": [],
  "FIN 301": ["ACCTG 211"], "FIN 302": ["FIN 301"], "ACCTG 211": [],
  "ECON 102": [], "ECON 104": [], "MGMT 301": [], "MKT 301": [],
  "MKT 330": ["MKT 301"], "SCM 301": [], "CAS 100": [], "ENGL 015": [],
  "BI 301": ["STAT 200"], "BIOL 110": [], "CHEM 110": [],
  "IE 302": ["MATH 141"], "IE 330": ["STAT 200"],
};

// ════════════════════════════════════════════
// MOCK DATA (demo always works)
// ════════════════════════════════════════════
function makeMock(major, goal) {
  return {
    curriculum: {
      semesters: [
        { name: "Fall 2025 — Recommended", courses: [
          { code: "STAT 318", name: "Elementary Probability", fills_skill: "Data Analysis", recommended: true, career_relevance: "Core for data-driven roles" },
          { code: "MGMT 301", name: "Basic Management Concepts", fills_skill: "Product Strategy", recommended: true, career_relevance: "PM foundation" },
          { code: "CMPSC 431W", name: "Database Management", fills_skill: "SQL & Data Modeling", recommended: false, career_relevance: "Database skills" },
          { code: "CMPSC 465", name: "Algorithms", fills_skill: "Problem Solving", recommended: false, career_relevance: "Technical interviews" },
        ]},
        { name: "Spring 2026", courses: [
          { code: "MKT 301", name: "Principles of Marketing", fills_skill: "User Research", recommended: true, career_relevance: "Customer understanding" },
          { code: "CMPSC 442", name: "Artificial Intelligence", fills_skill: "AI Concepts", recommended: true, career_relevance: "AI product knowledge" },
          { code: "CMPSC 483W", name: "Software Engineering", fills_skill: "Agile / Teamwork", recommended: false, career_relevance: "Engineering collaboration" },
        ]},
        { name: "Fall 2026 — Final", courses: [
          { code: "CMPSC 448", name: "Machine Learning", fills_skill: "ML Fundamentals", recommended: true, career_relevance: "AI/ML product roles" },
          { code: "CMPSC 497", name: "Capstone Project", fills_skill: "Project Leadership", recommended: false, career_relevance: "Portfolio piece" },
        ]},
      ],
      resources: [
        { skill: "Data Analysis", platform: "Coursera", title: "Google Data Analytics Certificate", url: "https://www.coursera.org/professional-certificates/google-data-analytics", reason: "Fills your biggest gap before STAT 318" },
        { skill: "Product Strategy", platform: "ProductSchool", title: "Product School — Free PM Course", url: "https://www.productschool.com/free-product-management-course/", reason: "PM frameworks alongside MGMT 301" },
        { skill: "SQL", platform: "YouTube", title: "FreeCodeCamp SQL Course", url: "https://www.youtube.com/watch?v=HXV3zeQKqGY", reason: "Prep for CMPSC 431W" },
        { skill: "User Research", platform: "Coursera", title: "Google UX Design Certificate", url: "https://www.coursera.org/professional-certificates/google-ux-design", reason: "Complements MKT 301" },
        { skill: "Machine Learning", platform: "YouTube", title: "3Blue1Brown Neural Networks", url: "https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi", reason: "Visual intuition before CMPSC 448" },
      ],
      total_remaining_semesters: 3,
      career_readiness_after: "87%",
      summary: `This plan optimizes your path from ${major || "CS"} to ${goal} by prioritizing courses that fill career-critical skill gaps while completing major requirements.`,
    },
    skillGraph: {
      skills: [
        { name: "Python", have: 80, need: 75, source: "resume" },
        { name: "Data Analysis", have: 30, need: 90, source: "both", recommended_course: "STAT 318" },
        { name: "Product Strategy", have: 25, need: 85, source: "both", recommended_course: "MGMT 301" },
        { name: "SQL", have: 40, need: 80, source: "both", recommended_course: "CMPSC 431W" },
        { name: "User Research", have: 15, need: 85, source: "both", recommended_course: "MKT 301" },
        { name: "JavaScript", have: 75, need: 55, source: "resume" },
        { name: "Communication", have: 65, need: 90, source: "career" },
        { name: "Machine Learning", have: 20, need: 70, source: "both", recommended_course: "CMPSC 448" },
      ],
      gaps: [
        { skill: "Data Analysis", have_level: 30, need_level: 90, recommended_course: "STAT 318", recommended_resource: { platform: "Coursera", title: "Google Data Analytics", url: "#" }, appears_in: "both", target_job: goal },
        { skill: "Product Strategy", have_level: 25, need_level: 85, recommended_course: "MGMT 301", recommended_resource: { platform: "YouTube", title: "Product School", url: "#" }, appears_in: "both", target_job: goal },
        { skill: "User Research", have_level: 15, need_level: 85, recommended_course: "MKT 301", recommended_resource: { platform: "Coursera", title: "Google UX Design", url: "#" }, appears_in: "both", target_job: goal },
        { skill: "Machine Learning", have_level: 20, need_level: 70, recommended_course: "CMPSC 448", recommended_resource: { platform: "YouTube", title: "3Blue1Brown", url: "#" }, appears_in: "both", target_job: goal },
        { skill: "SQL", have_level: 40, need_level: 80, recommended_course: "CMPSC 431W", recommended_resource: { platform: "YouTube", title: "FreeCodeCamp SQL", url: "#" }, appears_in: "both", target_job: goal },
      ],
    },
    readiness: {
      overall_readiness: 62,
      readiness_after_plan: 87,
      skill_scores: [
        { skill: "Python", current_level: 80, required_level: 75, status: "strong", note: "Solid foundation" },
        { skill: "Data Analysis", current_level: 30, required_level: 90, status: "critical", course_fix: "STAT 318", note: "Biggest gap — take next semester" },
        { skill: "Product Strategy", current_level: 25, required_level: 85, status: "critical", course_fix: "MGMT 301", note: "Essential for PM roles" },
        { skill: "SQL", current_level: 40, required_level: 80, status: "gap", course_fix: "CMPSC 431W", note: "Needed for data-driven decisions" },
        { skill: "User Research", current_level: 15, required_level: 85, status: "critical", course_fix: "MKT 301", note: "Core PM skill" },
        { skill: "Communication", current_level: 65, required_level: 90, status: "gap", note: "Practice through presentations" },
        { skill: "JavaScript", current_level: 75, required_level: 55, status: "strong", note: "Exceeds requirements" },
        { skill: "Machine Learning", current_level: 20, required_level: 70, status: "gap", course_fix: "CMPSC 448", note: "Important for AI PM roles" },
      ],
      top_strengths: ["Python", "JavaScript", "Git"],
      critical_gaps: ["Data Analysis", "Product Strategy", "User Research"],
      action_items: [
        "Enroll in STAT 318 next semester — biggest gap filler",
        "Start Google Data Analytics on Coursera this week",
        "Take MGMT 301 to build product strategy foundation",
      ],
    },
    resumeHighlights: {
      match_percentage: 72,
      highlight_these: [
        { skill: "Python", why: "Directly relevant — mention specific data projects" },
        { skill: "React / JavaScript", why: "Shows technical depth — emphasize user-facing features" },
        { skill: "Agile / Sprint Planning", why: "PM-adjacent experience — highlight leadership" },
        { skill: "REST APIs", why: "Technical credibility with engineering teams" },
      ],
      missing_from_resume: [
        { skill: "Data Analysis", suggestion: "Add: 'Analyzed user engagement data...'", course_fix: "STAT 318" },
        { skill: "Product Strategy", suggestion: "Reframe projects as product decisions", course_fix: "MGMT 301" },
        { skill: "User Research", suggestion: "Add: 'Conducted user interviews...' if applicable", course_fix: "MKT 301" },
        { skill: "A/B Testing", suggestion: "Mention any experiment-driven decisions", course_fix: null },
      ],
      rewritten_bullets: [
        { original_context: "Built REST APIs for a web app", rewritten: "Designed and shipped REST APIs serving 10K+ daily requests, collaborating with 3 engineers to define requirements and prioritize features" },
        { original_context: "Worked on frontend features", rewritten: "Led development of user-facing dashboard used by 500+ students, translating stakeholder feedback into 12 feature improvements" },
        { original_context: "Used Python for data processing", rewritten: "Analyzed user behavior data using Python and SQL, identifying patterns that drove a 23% increase in engagement metrics" },
      ],
      quick_tips: [
        "Add metrics to every bullet (numbers = credibility)",
        "Lead with outcomes, not implementations",
        "Add a 'Leadership & Product' section above 'Technical Skills'",
      ],
    },
  };
}

// ════════════════════════════════════════════
// THREE.JS BACKGROUND
// ════════════════════════════════════════════
function ThreeBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.z = 35;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Node data
    const NODE_COUNT = 55;
    const nodeData = [];
    const nodeGeometry = new THREE.SphereGeometry(0.18, 8, 8);

    for (let i = 0; i < NODE_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.3 ? 0x4af4c4 : 0x60a0ff,
        transparent: true,
        opacity: 0.6 + Math.random() * 0.4,
      });
      const mesh = new THREE.Mesh(nodeGeometry, mat);
      const x = (Math.random() - 0.5) * 70;
      const y = (Math.random() - 0.5) * 45;
      const z = (Math.random() - 0.5) * 25;
      mesh.position.set(x, y, z);
      scene.add(mesh);
      nodeData.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 0.012,
        vy: (Math.random() - 0.5) * 0.012,
        vz: (Math.random() - 0.5) * 0.006,
        mesh,
      });
    }

    // Build edge pairs (within distance)
    const EDGE_DIST = 14;
    const edgePairs = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = nodeData[i].x - nodeData[j].x;
        const dy = nodeData[i].y - nodeData[j].y;
        const dz = nodeData[i].z - nodeData[j].z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < EDGE_DIST) {
          edgePairs.push([i, j]);
          if (edgePairs.length >= 90) break;
        }
      }
      if (edgePairs.length >= 90) break;
    }

    // Edge geometry using LineSegments buffer
    const edgePositions = new Float32Array(edgePairs.length * 2 * 3);
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x4af4c4, transparent: true, opacity: 0.12,
    });
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    scene.add(edgeMesh);

    // Mouse parallax
    let targetRotX = 0, targetRotY = 0;
    const handleMouseMove = (e) => {
      targetRotY = ((e.clientX / window.innerWidth) - 0.5) * 0.4;
      targetRotX = ((e.clientY / window.innerHeight) - 0.5) * 0.25;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Animation
    let animId;
    let currentRotX = 0, currentRotY = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Drift nodes
      nodeData.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.z += n.vz;
        if (Math.abs(n.x) > 35) n.vx *= -1;
        if (Math.abs(n.y) > 22) n.vy *= -1;
        if (Math.abs(n.z) > 12) n.vz *= -1;
        n.mesh.position.set(n.x, n.y, n.z);
      });

      // Update edges
      edgePairs.forEach(([i, j], idx) => {
        const ni = nodeData[i], nj = nodeData[j];
        const base = idx * 6;
        edgePositions[base] = ni.x; edgePositions[base + 1] = ni.y; edgePositions[base + 2] = ni.z;
        edgePositions[base + 3] = nj.x; edgePositions[base + 4] = nj.y; edgePositions[base + 5] = nj.z;
      });
      edgeGeo.attributes.position.needsUpdate = true;

      // Smooth camera rotation (parallax)
      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;
      camera.rotation.x = currentRotX;
      camera.rotation.y = currentRotY;

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const nW = window.innerWidth, nH = window.innerHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      nodeGeometry.dispose();
      edgeGeo.dispose();
      edgeMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={mountRef} style={{
      position: "fixed", inset: 0, zIndex: 0,
      opacity: 0.45, pointerEvents: "none",
    }} />
  );
}

// ════════════════════════════════════════════
// SHARED UI COMPONENTS
// ════════════════════════════════════════════
const GridBg = () => (
  <div style={{
    position: "fixed", inset: 0, opacity: 0.04, pointerEvents: "none",
    backgroundImage: `linear-gradient(${C.border} 1px, transparent 1px), linear-gradient(90deg, ${C.border} 1px, transparent 1px)`,
    backgroundSize: "60px 60px",
  }} />
);

const Logo = ({ size = 32 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{
      width: size, height: size, borderRadius: size / 4,
      background: `linear-gradient(135deg, ${C.accent}, #2ad4a4)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 0 ${size}px rgba(74,244,196,0.3)`,
    }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none"
        stroke={C.bg} strokeWidth="2.5" strokeLinecap="round">
        <polyline points="4 17 10 11 14 15 20 7" />
        <polyline points="16 7 20 7 20 11" />
      </svg>
    </div>
    <span style={{
      fontFamily: "'Syne',sans-serif", fontWeight: 800,
      fontSize: size * 0.5, letterSpacing: -0.5, color: C.text,
    }}>Trajectory</span>
  </div>
);

const Btn = ({ children, primary, large, disabled, onClick, style: s }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: large ? "14px 32px" : "10px 22px", borderRadius: 10,
    fontSize: large ? 15 : 13, fontWeight: primary ? 700 : 500,
    fontFamily: primary ? "'Syne',sans-serif" : "'DM Sans',sans-serif",
    cursor: disabled ? "not-allowed" : "pointer",
    border: primary ? "none" : `1px solid ${C.border}`,
    background: disabled ? C.surface2 : primary ? `linear-gradient(135deg, ${C.accent}, #2ad4a4)` : "transparent",
    color: disabled ? C.faint : primary ? C.bg : C.text,
    transition: "all 0.25s", position: "relative", overflow: "hidden", ...s,
  }}>{children}</button>
);

const Card = ({ children, style: s }) => (
  <div style={{
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
    padding: 24, animation: "fadeUp 0.5s ease both", ...s,
  }}>{children}</div>
);

const Tag = ({ children, color = C.accent, bg }) => (
  <span style={{
    padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
    background: bg || (color + "22"), color, border: `1px solid ${color}33`,
    display: "inline-block",
  }}>{children}</span>
);

const SectionHead = ({ icon, color, children }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8, marginBottom: 18,
    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2,
    color: C.faint, fontFamily: "'Syne',sans-serif",
  }}>
    <span style={{
      width: 24, height: 24, borderRadius: 6, background: color || C.accentDim,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
    }}>{icon}</span>
    {children}
  </div>
);

const AnimNum = ({ value, suffix = "" }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = parseInt(value) || 0;
    const step = Math.max(1, Math.floor(end / 30));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setDisplay(end); clearInterval(timer); }
      else setDisplay(start);
    }, 25);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}{suffix}</span>;
};

// Animated circular progress ring
const CircularProgress = ({ value, label, color = C.accent, size = 150 }) => {
  const [animVal, setAnimVal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimVal(value), 100);
    return () => clearTimeout(t);
  }, [value]);
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (animVal / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} stroke={C.border} strokeWidth="7" fill="none" />
        <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="7" fill="none"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray 1.3s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
        <text x="50" y="45" textAnchor="middle" fill={color}
          style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>
          {animVal}%
        </text>
        <text x="50" y="62" textAnchor="middle" fill={C.dim}
          style={{ fontSize: 8.5, fontFamily: "'DM Sans',sans-serif" }}>
          {label}
        </text>
      </svg>
    </div>
  );
};

// ════════════════════════════════════════════
// SCREEN 1: LANDING PAGE
// ════════════════════════════════════════════
function LandingPage({ onStart }) {
  const features = [
    { icon: "🗺️", title: "Smart Course Roadmap", desc: "AI-optimized semester plan based on your career goal, not just graduation requirements.", color: C.accentDim },
    { icon: "🔗", title: "Prerequisite Graph", desc: "Visual dependency tree showing how courses chain together and which unlock the most options.", color: C.blueDim },
    { icon: "🔍", title: "Skill Gap Bridge", desc: "See what you have vs. what you need. Every gap links to a course AND an online resource.", color: C.warnDim },
    { icon: "🔄", title: "What-If Engine", desc: "Switch your career goal instantly and watch the entire plan reshape in real time.", color: "rgba(192,132,252,0.15)" },
    { icon: "🎯", title: "Job Readiness Scorer", desc: "Paste a job listing → get a skill-by-skill readiness score with course fixes.", color: C.warnDim },
    { icon: "📄", title: "Resume Highlighter", desc: "Quick diagnostic: what to emphasize, what's missing, and rewritten bullets.", color: C.blueDim },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans',sans-serif", color: C.text, overflowX: "hidden" }}>
      <ThreeBackground />
      <GridBg />

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, width: "100%", zIndex: 100, padding: "16px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        backdropFilter: "blur(24px)", background: "rgba(10,10,15,0.7)",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <Logo size={30} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: C.faint }}>Built at Penn State</span>
          <Btn primary onClick={onStart}>Get Started</Btn>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        position: "relative", zIndex: 1, minHeight: "100vh",
        display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        textAlign: "center", padding: "120px 32px 80px",
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 18px",
            borderRadius: 100, border: `1px solid ${C.accentDim}`,
            background: "rgba(74,244,196,0.05)",
            fontSize: 12, color: C.dim, marginBottom: 32,
          }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, animation: "pulse 2s infinite", display: "inline-block" }} />
          AI-Powered Career Planning for Penn State Students
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          style={{
            fontFamily: "'Syne',sans-serif", fontWeight: 800,
            fontSize: "clamp(2.8rem,7vw,5.5rem)",
            lineHeight: 1.05, letterSpacing: -2, maxWidth: 820,
          }}>
          Your courses.<br />Your career.<br />
          <span style={{
            background: `linear-gradient(135deg, ${C.accent}, #80ffd8, ${C.blue})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>One clear path.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
          style={{ fontSize: 18, color: C.dim, maxWidth: 560, marginTop: 24, lineHeight: 1.75, fontWeight: 300 }}>
          DegreeWorks tells you what you need to graduate.<br />
          <strong style={{ color: C.accent, fontWeight: 600 }}>Trajectory tells you what you need to succeed.</strong>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
          style={{ display: "flex", gap: 12, marginTop: 40 }}>
          <Btn primary large onClick={onStart}>
            Start Your Trajectory →
          </Btn>
          <Btn large onClick={onStart} style={{ borderColor: C.faint, color: C.dim }}>
            See Demo
          </Btn>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }}
          style={{ display: "flex", gap: 40, marginTop: 56, paddingTop: 32, borderTop: `1px solid ${C.border}` }}>
          {[["6", "AI-Powered Features"], ["15+", "Majors Supported"], ["2 min", "Setup Time"]].map(([num, lbl]) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: C.accent }}>{num}</div>
              <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", padding: "0 32px 100px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 36, letterSpacing: -1, marginBottom: 12 }}>
            6 features. All connected.
          </h2>
          <p style={{ fontSize: 15, color: C.dim, maxWidth: 400, margin: "0 auto" }}>
            Each tool feeds into the next — one source of truth for your academic career.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {features.map((f, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 26, cursor: "pointer",
                position: "relative", overflow: "hidden",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.faint; e.currentTarget.style.boxShadow = `0 0 20px rgba(74,244,196,0.06)`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: f.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16, fontSize: 20,
              }}>{f.icon}</div>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 8, color: C.text }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, fontWeight: 300 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "20px 32px 80px" }}>
        <div style={{
          display: "inline-block", padding: "40px 60px",
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 20, position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -60, right: -60, width: 200, height: 200,
            borderRadius: "50%", background: C.accent, filter: "blur(80px)", opacity: 0.06,
          }} />
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 8 }}>
            Ready to build your path?
          </h3>
          <p style={{ color: C.dim, marginBottom: 24, fontSize: 14 }}>
            Takes 2 minutes. No account required.
          </p>
          <Btn primary large onClick={onStart}>Get Started Free →</Btn>
        </div>
      </section>

      <footer style={{
        position: "relative", zIndex: 1, borderTop: `1px solid ${C.border}`,
        padding: "20px 32px", display: "flex", justifyContent: "space-between",
        fontSize: 13, color: C.faint,
      }}>
        <span>Trajectory © 2025 · Built at Penn State</span>
        <span>By Anant & Anusha</span>
      </footer>
    </div>
  );
}

// ════════════════════════════════════════════
// SCREEN 2: INPUT FORM
// ════════════════════════════════════════════
function InputForm({ onSubmit, onBack }) {
  const [major, setMajor] = useState("");
  const [courses, setCourses] = useState([]);
  const [goal, setGoal] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [jobText, setJobText] = useState("");
  const fileRef = useRef(null);
  const avail = COURSES_MAP[major] || COURSES_MAP.default;

  const step = major ? (goal ? 3 : 2) : 1;

  const inp = {
    width: "100%", padding: "12px 16px", background: C.surface2,
    border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
    fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none",
  };
  const lbl = {
    display: "block", fontSize: 11, fontWeight: 700, color: C.dim,
    marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.2,
    fontFamily: "'Syne',sans-serif",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: C.bg,
      fontFamily: "'DM Sans',sans-serif", padding: 20, position: "relative",
    }}>
      <GridBg />
      <div style={{
        position: "absolute", top: -100, right: -100, width: 400, height: 400,
        borderRadius: "50%", background: C.accent, filter: "blur(120px)", opacity: 0.04,
      }} />

      <div style={{ width: "100%", maxWidth: 640, position: "relative", zIndex: 1 }}>
        {/* Back */}
        <button onClick={onBack} style={{
          background: "none", border: "none", color: C.dim, fontSize: 13,
          cursor: "pointer", marginBottom: 24, fontFamily: "'DM Sans',sans-serif",
          display: "flex", alignItems: "center", gap: 6,
        }}>← Back</button>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
          {["Major & Courses", "Career Goal", "Launch"].map((s, i) => {
            const active = i + 1 <= step;
            const current = i + 1 === step;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: active ? C.accent : C.surface2,
                    border: `2px solid ${active ? C.accent : C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700,
                    color: active ? C.bg : C.faint,
                    flexShrink: 0, transition: "all 0.3s",
                  }}>
                    {i + 1 < step ? "✓" : i + 1}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: current ? 600 : 400,
                    color: active ? C.text : C.faint,
                    transition: "all 0.3s", whiteSpace: "nowrap",
                  }}>{s}</span>
                </div>
                {i < 2 && (
                  <div style={{
                    flex: 1, height: 1, margin: "0 10px",
                    background: i + 1 < step ? C.accent : C.border,
                    transition: "background 0.4s",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Logo size={38} />
          <p style={{ color: C.dim, fontSize: 14, marginTop: 12, fontWeight: 300 }}>
            Tell us about you. Takes 2 minutes.
          </p>
        </div>

        <Card style={{ padding: 30 }}>
          {/* Major */}
          <div style={{ marginBottom: 22 }}>
            <label style={lbl}>Your Major</label>
            <select value={major} onChange={e => { setMajor(e.target.value); setCourses([]); }}
              style={{ ...inp, cursor: "pointer", appearance: "none" }}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border}>
              <option value="">Select major...</option>
              {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Courses */}
          <div style={{ marginBottom: 22 }}>
            <label style={lbl}>
              Courses Completed
              <span style={{ fontWeight: 400, color: C.faint, textTransform: "none", marginLeft: 6 }}>
                {courses.length > 0 ? `(${courses.length} selected)` : "(click to select)"}
              </span>
            </label>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 6, padding: 14,
              background: C.surface2, borderRadius: 10, border: `1px solid ${C.border}`,
              minHeight: 56, maxHeight: 160, overflowY: "auto",
            }}>
              {avail.map(c => (
                <button key={c}
                  onClick={() => setCourses(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])}
                  style={{
                    padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                    border: `1px solid ${courses.includes(c) ? C.accent : C.border}`,
                    background: courses.includes(c) ? C.accentDim : "transparent",
                    color: courses.includes(c) ? C.accent : C.dim,
                    cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                    transition: "all 0.15s",
                  }}>
                  {courses.includes(c) ? "✓ " : ""}{c}
                </button>
              ))}
            </div>
          </div>

          {/* Career Goal */}
          <div style={{ marginBottom: 22 }}>
            <label style={lbl}>Career Goal</label>
            <input type="text"
              placeholder="e.g. Product Manager at Google, Data Scientist at Meta..."
              value={goal} onChange={e => setGoal(e.target.value)} style={inp}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border} />
          </div>

          {/* Optional */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <p style={{ fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
                Optional — unlocks resume highlighter & job readiness scorer
              </p>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ ...lbl, fontSize: 10 }}>Resume (PDF)</label>
                <input type="file" accept=".pdf" ref={fileRef} style={{ display: "none" }}
                  onChange={e => setResumeFile(e.target.files[0])} />
                <button onClick={() => fileRef.current?.click()} style={{
                  ...inp, cursor: "pointer", textAlign: "center",
                  color: resumeFile ? C.accent : C.faint, borderStyle: "dashed",
                }}>
                  {resumeFile ? `✓ ${resumeFile.name}` : "Upload resume..."}
                </button>
              </div>
              <div>
                <label style={{ ...lbl, fontSize: 10 }}>Job Description</label>
                <textarea placeholder="Paste job listing text..."
                  value={jobText} onChange={e => setJobText(e.target.value)}
                  style={{ ...inp, minHeight: 42, resize: "vertical", fontSize: 12 }}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            </div>
          </div>

          <Btn primary large disabled={!goal || !major}
            style={{ width: "100%", marginTop: 24 }}
            onClick={() => onSubmit({ major, courses: courses.join(", "), goal, resumeFile, jobText })}>
            Launch Trajectory →
          </Btn>
        </Card>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// LOADING SCREEN
// ════════════════════════════════════════════
function LoadingScreen() {
  const [step, setStep] = useState(0);
  const steps = [
    "Parsing your profile...",
    "Building skill graph...",
    "Mapping prerequisites...",
    "Optimizing course plan...",
    "Scoring job readiness...",
    "Analyzing resume...",
    "Connecting everything...",
  ];
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 700);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: C.bg, fontFamily: "'DM Sans',sans-serif",
    }}>
      <GridBg />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: `linear-gradient(135deg, ${C.accent}, #2ad4a4)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 36px",
          animation: "pulse 1.4s infinite",
          boxShadow: `0 0 40px rgba(74,244,196,0.4)`,
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5" strokeLinecap="round">
            <polyline points="4 17 10 11 14 15 20 7" />
            <polyline points="16 7 20 7 20 11" />
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 280 }}>
          {steps.map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0.15, x: -10 }}
              animate={i <= step ? { opacity: 1, x: 0 } : { opacity: 0.15, x: -10 }}
              transition={{ duration: 0.35 }}
              style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${i < step ? C.accent : i === step ? C.warn : C.border}`,
                background: i < step ? C.accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s",
              }}>
                {i < step && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {i === step && (
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.warn, animation: "pulse 1s infinite" }} />
                )}
              </div>
              <span style={{
                color: i <= step ? C.text : C.faint, fontSize: 13,
                fontWeight: i === step ? 600 : 400,
              }}>{s}</span>
            </motion.div>
          ))}
        </div>

        <p style={{ marginTop: 32, fontSize: 12, color: C.faint }}>
          Powered by Claude AI · Penn State Course Catalog
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// DASHBOARD PANELS
// ════════════════════════════════════════════

// ---- Overview Tab ----
function OverviewTab({ data }) {
  const { readiness } = data;
  if (!readiness) return null;
  const statusColor = { strong: C.accent, ready: C.accent, gap: C.warn, critical: C.red };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Readiness rings */}
      <Card>
        <SectionHead icon="🎯" color={C.warnDim}>Job Readiness</SectionHead>
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: "16px 0 8px" }}>
          <div style={{ textAlign: "center" }}>
            <CircularProgress
              value={readiness.overall_readiness}
              label="Today"
              color={readiness.overall_readiness >= 70 ? C.accent : readiness.overall_readiness >= 50 ? C.warn : C.red}
            />
          </div>
          <div style={{ fontSize: 22, color: C.faint }}>→</div>
          <div style={{ textAlign: "center" }}>
            <CircularProgress value={readiness.readiness_after_plan} label="After Plan" color={C.accent} />
          </div>
        </div>
        <div style={{
          marginTop: 16, padding: "10px 14px", borderRadius: 10,
          background: C.accentGlow, border: `1px solid ${C.accentDim}`,
          fontSize: 12, color: C.dim, textAlign: "center",
        }}>
          Completing this plan boosts your readiness by{" "}
          <strong style={{ color: C.accent }}>+{readiness.readiness_after_plan - readiness.overall_readiness}%</strong>
        </div>
      </Card>

      {/* Strengths & Gaps */}
      <Card>
        <SectionHead icon="⚡" color={C.accentDim}>Strengths & Critical Gaps</SectionHead>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            ✓ Top Strengths
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {(readiness.top_strengths || []).map(s => <Tag key={s} color={C.accent}>{s}</Tag>)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            ⚠ Critical Gaps
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {(readiness.critical_gaps || []).map(g => <Tag key={g} color={C.red}>{g}</Tag>)}
          </div>
        </div>
        {readiness.action_items && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.warn, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              Action Plan
            </div>
            {readiness.action_items.map((a, i) => (
              <div key={i} style={{
                padding: "8px 12px", borderRadius: 8, background: C.warnDim,
                border: `1px solid ${C.warn}33`, marginBottom: 7,
                fontSize: 12, color: C.warn, display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <span style={{ fontWeight: 800, flexShrink: 0 }}>{i + 1}.</span>{a}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Skill breakdown (full width) */}
      <Card style={{ gridColumn: "1 / -1" }}>
        <SectionHead icon="📊" color={C.blueDim}>Skill Breakdown</SectionHead>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(readiness.skill_scores || []).map((s, i) => {
            const col = statusColor[s.status] || C.faint;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 10,
                background: C.surface2, border: `1px solid ${C.border}`,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 140, color: C.text }}>{s.skill}</span>
                <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${s.current_level}%`, borderRadius: 3,
                    background: col, transition: "width 1.2s ease",
                    boxShadow: `0 0 6px ${col}44`,
                  }} />
                </div>
                <span style={{ fontSize: 11, color: C.faint, minWidth: 60, textAlign: "right" }}>
                  {s.current_level}/{s.required_level}
                </span>
                {s.course_fix && <Tag color={C.accent}>{s.course_fix}</Tag>}
                {s.note && <span style={{ fontSize: 11, color: C.dim }}>{s.note}</span>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---- Curriculum Roadmap ----
function CurriculumPanel({ data }) {
  if (!data) return null;
  return (
    <div>
      <SectionHead icon="🗺️" color={C.accentDim}>Course Roadmap</SectionHead>
      {data.summary && (
        <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.65, marginBottom: 20, fontStyle: "italic" }}>
          {data.summary}
        </p>
      )}
      {(data.semesters || []).map((sem, si) => (
        <div key={si} style={{ marginBottom: 20, paddingLeft: 16, borderLeft: `3px solid ${si === 0 ? C.accent : C.border}` }}>
          <h4 style={{
            fontSize: 11, fontWeight: 700, color: si === 0 ? C.accent : C.dim,
            textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10,
          }}>{sem.name}</h4>
          {(sem.courses || []).map((c, ci) => (
            <div key={ci} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderRadius: 9, marginBottom: 6,
              background: c.recommended ? C.accentGlow : C.surface2,
              border: `1px solid ${c.recommended ? C.accentDim : C.border}`,
            }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13, color: c.recommended ? C.accent : C.text }}>
                  {c.code}
                </span>
                <span style={{ fontSize: 12, color: C.dim, marginLeft: 10 }}>{c.name}</span>
                {c.career_relevance && (
                  <span style={{ fontSize: 10, color: C.faint, marginLeft: 8 }}>· {c.career_relevance}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {c.recommended && <Tag color={C.accent}>Recommended</Tag>}
                <span style={{
                  fontSize: 10, padding: "3px 9px", borderRadius: 5,
                  background: C.surface2, color: C.faint, border: `1px solid ${C.border}`,
                }}>→ {c.fills_skill}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
      {data.career_readiness_after && (
        <div style={{
          padding: 16, borderRadius: 10, background: C.accentGlow, border: `1px solid ${C.accentDim}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20,
        }}>
          <span style={{ fontSize: 13, color: C.dim }}>Career readiness after this plan:</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: C.accent, fontFamily: "'Syne',sans-serif" }}>
            <AnimNum value={parseInt(data.career_readiness_after)} suffix="%" />
          </span>
        </div>
      )}
      {data.resources && (
        <>
          <SectionHead icon="🎯" color={C.warnDim}>Start Learning Now</SectionHead>
          {data.resources.map((r, i) => (
            <div key={i} style={{
              padding: "10px 14px", marginBottom: 6, borderRadius: 8,
              background: C.surface2, border: `1px solid ${C.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 12, color: C.warn }}>{r.skill}: </span>
                <span style={{ fontSize: 12, color: C.text }}>{r.title}</span>
                <span style={{ fontSize: 11, color: C.faint, marginLeft: 6 }}>({r.platform})</span>
                {r.reason && <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{r.reason}</div>}
              </div>
              <a href={r.url} target="_blank" rel="noreferrer" style={{
                fontSize: 11, color: C.accent, textDecoration: "none", padding: "4px 10px",
                borderRadius: 5, border: `1px solid ${C.accentDim}`, whiteSpace: "nowrap",
              }}>Open →</a>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---- Prerequisite Graph (with SVG lines) ----
function PrereqGraph({ coursesTaken, major }) {
  const avail = COURSES_MAP[major] || COURSES_MAP.default;
  const nodes = avail.filter(c => PREREQ_TREE[c] !== undefined);

  const levels = {};
  const getLevel = (c) => {
    if (levels[c] !== undefined) return levels[c];
    const prereqs = PREREQ_TREE[c] || [];
    if (prereqs.length === 0) { levels[c] = 0; return 0; }
    const maxP = Math.max(...prereqs.map(p => getLevel(p)));
    levels[c] = maxP + 1;
    return levels[c];
  };
  nodes.forEach(n => getLevel(n));

  const maxLevel = nodes.length > 0 ? Math.max(...nodes.map(n => levels[n] || 0)) : 0;
  const byLevel = {};
  nodes.forEach(n => {
    const l = levels[n] || 0;
    if (!byLevel[l]) byLevel[l] = [];
    byLevel[l].push(n);
  });

  const taken = coursesTaken ? coursesTaken.split(", ").map(s => s.trim()).filter(Boolean) : [];

  // Layout constants
  const NODE_W = 112;
  const NODE_H = 38;
  const COL_W = 138;
  const ROW_H = 54;
  const PAD_X = 16;
  const PAD_Y = 16;

  const positions = {};
  Object.entries(byLevel).forEach(([lvl, cs]) => {
    const l = parseInt(lvl);
    cs.forEach((c, idx) => {
      positions[c] = { x: PAD_X + l * COL_W, y: PAD_Y + idx * ROW_H };
    });
  });

  const maxInLevel = Math.max(...Object.values(byLevel).map(a => a.length), 0);
  const svgW = PAD_X * 2 + (maxLevel + 1) * COL_W;
  const svgH = PAD_Y * 2 + maxInLevel * ROW_H;

  // Build edges
  const edges = [];
  nodes.forEach(node => {
    (PREREQ_TREE[node] || []).forEach(prereq => {
      if (positions[node] && positions[prereq]) {
        edges.push({
          x1: positions[prereq].x + NODE_W,
          y1: positions[prereq].y + NODE_H / 2,
          x2: positions[node].x,
          y2: positions[node].y + NODE_H / 2,
          both: taken.includes(prereq) && taken.includes(node),
        });
      }
    });
  });

  return (
    <div>
      <SectionHead icon="🔗" color={C.blueDim}>Prerequisite Graph</SectionHead>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Tag color={C.accent}>Taken</Tag>
        <Tag color={C.warn}>Available</Tag>
        <Tag color={C.faint}>Locked</Tag>
      </div>
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 440 }}>
        <div style={{ position: "relative", width: svgW, height: svgH, minWidth: svgW }}>
          {/* SVG edges */}
          <svg
            width={svgW} height={svgH}
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 0 }}>
            {edges.map((e, i) => {
              const midX = (e.x1 + e.x2) / 2;
              return (
                <path key={i}
                  d={`M ${e.x1} ${e.y1} C ${midX} ${e.y1} ${midX} ${e.y2} ${e.x2} ${e.y2}`}
                  stroke={e.both ? C.accent : C.border}
                  strokeWidth={e.both ? 2 : 1.5}
                  fill="none"
                  opacity={e.both ? 0.7 : 0.4}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map(c => {
            const pos = positions[c];
            if (!pos) return null;
            const isTaken = taken.includes(c);
            const prereqs = PREREQ_TREE[c] || [];
            const canTake = prereqs.length === 0 || prereqs.every(p => taken.includes(p));
            const color = isTaken ? C.accent : canTake ? C.warn : C.faint;
            const bg = isTaken ? C.accentDim : canTake ? C.warnDim : C.surface2;
            return (
              <div key={c} title={prereqs.length ? `Requires: ${prereqs.join(", ")}` : "No prerequisites"}
                style={{
                  position: "absolute", left: pos.x, top: pos.y,
                  width: NODE_W, height: NODE_H,
                  padding: "4px 8px", borderRadius: 9,
                  background: bg, border: `1.5px solid ${color}55`,
                  color, fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  textAlign: "center", zIndex: 1,
                  boxShadow: isTaken ? `0 0 10px ${color}22` : "none",
                  transition: "box-shadow 0.2s",
                }}>{c}</div>
            );
          })}
        </div>
      </div>

      {/* Level labels */}
      <div style={{ display: "flex", gap: 0, marginTop: 12, paddingLeft: PAD_X, overflowX: "auto" }}>
        {Array.from({ length: maxLevel + 1 }, (_, l) => (
          <div key={l} style={{ minWidth: COL_W, fontSize: 10, color: C.faint, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>
            {l === 0 ? "Foundation" : `Level ${l}`}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Skill Gap Bridge (Radar Chart) ----
function SkillGapBridge({ skills, gaps }) {
  const radarData = (skills || []).map(s => ({
    skill: s.name.length > 10 ? s.name.slice(0, 10) + "…" : s.name,
    fullName: s.name,
    have: s.have,
    need: s.need,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{d.fullName}</div>
        <div style={{ color: C.accent }}>You: {d.have}%</div>
        <div style={{ color: C.red }}>Required: {d.need}%</div>
        {d.have < d.need && <div style={{ color: C.warn, marginTop: 2 }}>Gap: {d.need - d.have}%</div>}
      </div>
    );
  };

  return (
    <div>
      <SectionHead icon="🔍" color={C.accentDim}>Skill Gap Analysis</SectionHead>

      <div style={{ background: C.surface2, borderRadius: 12, padding: "20px 0 8px" }}>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke={C.border} strokeDasharray="4 4" />
            <PolarAngleAxis dataKey="skill" tick={{ fill: C.dim, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: C.faint, fontSize: 9 }} tickCount={6} />
            <Radar name="You" dataKey="have" stroke={C.accent} fill={C.accent} fillOpacity={0.22} strokeWidth={2} dot={{ fill: C.accent, r: 3 }} />
            <Radar name="Required" dataKey="need" stroke={C.red} fill={C.red} fillOpacity={0.08} strokeWidth={2} strokeDasharray="5 3" dot={{ fill: C.red, r: 3 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: C.dim, paddingTop: 10 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Gap list */}
      {(gaps || []).filter(g => g.appears_in === "both").length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Bridge Gaps — appear in both coursework & career requirements
          </div>
          {gaps.filter(g => g.appears_in === "both").map(g => (
            <div key={g.skill} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              background: C.accentGlow, border: `1px solid ${C.accentDim}`,
              borderRadius: 8, marginBottom: 6, fontSize: 12, flexWrap: "wrap",
            }}>
              <span style={{ fontWeight: 700, color: C.accent, minWidth: 110 }}>{g.skill}</span>
              <span style={{ color: C.dim }}>
                {g.have_level}% → {g.need_level}%
              </span>
              <span style={{ color: C.faint }}>
                → <strong style={{ color: C.text }}>{g.recommended_course}</strong>
              </span>
              {g.recommended_resource && (
                <span style={{ color: C.faint }}>
                  + <strong style={{ color: C.text }}>{g.recommended_resource.title}</strong>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Resume Highlighter ----
function ResumePanel({ data }) {
  if (!data) return null;
  return (
    <div>
      <SectionHead icon="📄" color={C.blueDim}>Resume Skill Highlighter</SectionHead>

      <div style={{
        padding: "14px 18px", borderRadius: 10, background: C.accentGlow,
        border: `1px solid ${C.accentDim}`, marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 6 }}>Match to target role</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>{data.match_percentage}% — suggestions below</div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          ✅ Highlight These
        </div>
        {(data.highlight_these || []).map((h, i) => (
          <div key={i} style={{
            padding: "8px 12px", borderRadius: 7, background: C.accentGlow,
            border: `1px solid ${C.accentDim}`, marginBottom: 5,
            fontSize: 12, display: "flex", gap: 10,
          }}>
            <strong style={{ color: C.accent, minWidth: 110 }}>{h.skill}</strong>
            <span style={{ color: C.dim }}>{h.why}</span>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          ⚠ Missing From Resume
        </div>
        {(data.missing_from_resume || []).map((m, i) => (
          <div key={i} style={{
            padding: "8px 12px", borderRadius: 7, background: C.redDim,
            border: `1px solid rgba(244,90,90,0.2)`, marginBottom: 5,
            fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <strong style={{ color: C.red }}>{m.skill}:</strong>{" "}
              <span style={{ color: C.dim }}>{m.suggestion}</span>
            </div>
            {m.course_fix && <Tag color={C.accent}>{m.course_fix}</Tag>}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          ✍ Rewritten Bullets
        </div>
        {(data.rewritten_bullets || []).map((b, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.faint, marginBottom: 4 }}>Original context: {b.original_context}</div>
            <div style={{
              padding: "10px 14px", borderRadius: 8, background: C.surface2,
              border: `1px solid ${C.border}`, fontSize: 12, color: C.text,
              lineHeight: 1.6, borderLeft: `3px solid ${C.blue}`,
            }}>{b.rewritten}</div>
          </div>
        ))}
      </div>

      {data.quick_tips && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.warn, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Quick Tips
          </div>
          {data.quick_tips.map((t, i) => (
            <div key={i} style={{
              padding: "8px 12px", borderRadius: 7, background: C.warnDim,
              fontSize: 12, color: C.warn, marginBottom: 5,
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <span style={{ flexShrink: 0 }}>💡</span>{t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Resume Editor (Live apply suggestions) ----
function ResumeEditor({ resumeData, highlights, profile, onUpdateResume }) {
  const initialText = (resumeData && (resumeData.text || resumeData.plain_text || resumeData.body)) || "(No resume text available — upload a PDF to enable live editing)";
  const [text, setText] = useState(initialText);
  const [accepted, setAccepted] = useState([]);
  const [appliedChanges, setAppliedChanges] = useState([]); // { key, before, after }
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setText(initialText);
    setAccepted([]);
  }, [initialText]);

  const applySuggestion = (sugg, idx) => {
    // Simple heuristic: if suggestion contains a leading 'Add:' or starts with a verb, append to Experience section.
    let insertion = sugg.suggestion || sugg.rewritten || "";
    if (!insertion) return;
    // Ensure insertion ends with a period
    if (!/[.!?]$/.test(insertion.trim())) insertion = insertion.trim() + ".";
    // Try to find 'Experience' or 'Work' section and insert after it, otherwise append at end.
    const lower = text.toLowerCase();
    let newText;
    const expIdx = lower.indexOf("experience");
    if (expIdx !== -1) {
      // insert after the section header
      const after = text.indexOf("\n", expIdx);
      const insertPos = after === -1 ? text.length : after + 1;
      newText = text.slice(0, insertPos) + "\n- " + insertion + "\n" + text.slice(insertPos);
    } else {
      newText = text + "\n\n- " + insertion;
    }
    // record change for undo
    const key = typeof idx === "string" || typeof idx === "number" ? idx : String(idx);
    setAppliedChanges(prev => [...prev, { key, before: text, after: newText }]);
    setText(newText);
    setAccepted(prev => [...prev, key]);
    setToast("Applied suggestion");
    setTimeout(() => setToast(null), 2200);
  };

  const applyAll = () => {
    const missing = highlights?.missing_from_resume || [];
    const rewritten = highlights?.rewritten_bullets || [];
    let newText = text;
    missing.forEach(m => {
      const insertion = (m.suggestion || m.skill) + (m.suggestion && !/[.!?]$/.test(m.suggestion) ? "." : "");
      newText += "\n\n- " + insertion;
    });
    rewritten.forEach(b => {
      newText += "\n\n- " + (b.rewritten || "");
    });
    setText(newText);
    // record a single batch change for undo
    const key = `batch-${Date.now()}`;
    setAppliedChanges(prev => [...prev, { key, before: text, after: newText }]);
    const allIdx = [...Array((highlights?.missing_from_resume || []).length).keys()].map(i => `m-${i}`);
    setAccepted(allIdx);
    setToast("Applied all suggestions");
    setTimeout(() => setToast(null), 2200);
  };

  const undoLast = () => {
    if (!appliedChanges.length) return;
    const last = appliedChanges[appliedChanges.length - 1];
    setText(last.before);
    setAppliedChanges(prev => prev.slice(0, -1));
    setAccepted(prev => prev.filter(k => k !== last.key));
    setToast("Undid last change");
    setTimeout(() => setToast(null), 1800);
  };

  const undoChange = (key) => {
    // find change
    const idx = appliedChanges.findIndex(c => c.key === key);
    if (idx === -1) return;
    const before = appliedChanges[idx].before;
    setText(before);
    setAppliedChanges(prev => prev.filter(c => c.key !== key));
    setAccepted(prev => prev.filter(k => k !== key));
    setToast("Undid suggestion");
    setTimeout(() => setToast(null), 1800);
  };

  return (
    <div style={{ display: "flex", gap: 18 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: C.dim }}>Upload resume (PDF):</label>
          <input type="file" accept="application/pdf" onChange={async e => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            try {
              const fd = new FormData();
              fd.append("major", profile?.major || "");
              fd.append("courses_taken", profile?.courses || "");
              fd.append("career_goal", profile?.goal || "");
              fd.append("resume", f);
              const r = await fetch(`${API}/analyze/resume-highlights`, { method: "POST", body: fd });
              if (r.ok) {
                const d = await r.json();
                // Update local view
                if (d.resumeHighlights) {
                  // notify parent so dashboard updates
                  onUpdateResume && onUpdateResume(d);
                  // update local text if returned
                  if (d.resumeData && (d.resumeData.text || d.resumeData.plain_text || d.resumeData.body)) {
                    setText(d.resumeData.text || d.resumeData.plain_text || d.resumeData.body);
                  }
                }
              } else {
                console.warn("Resume upload failed, using suggestions from mock");
              }
            } catch (err) { console.error(err); }
          }} />
        </div>
        <SectionHead icon="📄" color={C.blueDim}>Resume (Live Preview)</SectionHead>
        <textarea value={text} onChange={e => setText(e.target.value)} style={{ width: "100%", minHeight: 520, padding: 16, borderRadius: 12, background: C.surface2, color: C.text, border: `1px solid ${C.border}`, fontFamily: "'DM Sans',sans-serif", fontSize: 13 }} />
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
          <Btn onClick={() => navigator.clipboard && navigator.clipboard.writeText(text)}>Copy Text</Btn>
          <Btn primary onClick={applyAll} disabled={!highlights}>Accept All Suggestions</Btn>
          <Btn onClick={undoLast} disabled={!appliedChanges.length}>Undo Last</Btn>
          {uploading && <span style={{ color: C.dim, fontSize: 12 }}>Uploading...</span>}
        </div>
      </div>

      {/* Simplified resume UI: show suggestions below the editor (no right-side bar) */}
      <div style={{ marginTop: 18 }}>
        <ResumePanel data={highlights} />
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Apply Suggestions</div>
          {(highlights?.missing_from_resume || []).map((m, i) => {
            const key = `m-${i}`;
            const isAccepted = accepted.includes(key);
            return (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>{m.skill}</div>
                  <div style={{ fontSize: 12, color: C.dim }}>{m.suggestion}</div>
                </div>
                {!isAccepted && <Btn onClick={() => applySuggestion(m, key)}>Accept</Btn>}
                {isAccepted && <Btn onClick={() => undoChange(key)}>Undo</Btn>}
              </div>
            );
          })}
          {(highlights?.rewritten_bullets || []).map((b, i) => (
            <div key={`r-${i}`} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: C.faint }}>Original: {b.original_context}</div>
                <div style={{ fontSize: 12, color: C.text }}>{b.rewritten}</div>
              </div>
              {accepted.includes(`r-${i}`) ? (
                <Btn onClick={() => undoChange(`r-${i}`)}>Undo</Btn>
              ) : (
                <Btn onClick={() => { applySuggestion({ suggestion: b.rewritten }, `r-${i}`); }}>Accept</Btn>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- What-If Engine ----
function WhatIfBar({ profile, onWhatIf }) {
  const [newGoal, setNewGoal] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!newGoal) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("major", profile.major);
      fd.append("courses_taken", profile.courses);
      fd.append("career_goal", newGoal);
      const r = await fetch(`${API}/whatif`, { method: "POST", body: fd });
      if (r.ok) { const d = await r.json(); onWhatIf(d, newGoal); }
      else { onWhatIf(makeMock(profile.major, newGoal), newGoal); }
    } catch { onWhatIf(makeMock(profile.major, newGoal), newGoal); }
    setLoading(false);
  };

  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "center", padding: "14px 18px",
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, marginBottom: 20,
    }}>
      <span style={{ fontSize: 13, color: C.dim, whiteSpace: "nowrap", fontWeight: 600 }}>
        🔄 What if I target:
      </span>
      <input type="text" placeholder="e.g. Data Scientist at Amazon..."
        value={newGoal} onChange={e => setNewGoal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && run()}
        style={{
          flex: 1, padding: "9px 14px", background: C.surface2,
          border: `1px solid ${C.border}`, borderRadius: 8,
          color: C.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none",
        }}
        onFocus={e => e.target.style.borderColor = C.accent}
        onBlur={e => e.target.style.borderColor = C.border}
      />
      <Btn primary onClick={run} disabled={!newGoal || loading}>
        {loading ? "Recalculating..." : "Recalculate →"}
      </Btn>
    </div>
  );
}

// ════════════════════════════════════════════
// SCREEN 3: DASHBOARD (Tabbed)
// ════════════════════════════════════════════
function Dashboard({ data, profile, onReset }) {
  const [currentData, setCurrentData] = useState(data);
  const [currentGoal, setCurrentGoal] = useState(profile.goal);
  const [activeTab, setActiveTab] = useState("overview");

  const handleWhatIf = (newData, newGoal) => {
    setCurrentData(prev => ({ ...prev, ...newData }));
    setCurrentGoal(newGoal);
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: "🎯" },
    { id: "roadmap", label: "Roadmap", icon: "🗺️" },
    { id: "skills", label: "Skills", icon: "🔍" },
    { id: "prereqs", label: "Prerequisites", icon: "🔗" },
    ...(currentData.resumeHighlights ? [{ id: "resume", label: "Resume", icon: "📄" }] : []),
  ];

  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab data={currentData} />;
      case "roadmap":
        return <Card><CurriculumPanel data={currentData.curriculum} /></Card>;
      case "skills":
        return <Card><SkillGapBridge skills={currentData.skillGraph?.skills} gaps={currentData.skillGraph?.gaps} /></Card>;
      case "prereqs":
        return <Card><PrereqGraph coursesTaken={profile.courses} major={profile.major} /></Card>;
      case "resume":
        return currentData.resumeHighlights
          ? <Card>
              <ResumeEditor
                resumeData={currentData.resumeData}
                highlights={currentData.resumeHighlights}
                profile={profile}
                onUpdateResume={(d) => setCurrentData(prev => ({ ...prev, resumeHighlights: d.resumeHighlights, resumeData: d.resumeData }))}
              />
            </Card>
          : null;
      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans',sans-serif", position: "relative" }}>
      <GridBg />

      {/* Top nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 28px", backdropFilter: "blur(24px)",
        background: "rgba(10,10,15,0.85)", borderBottom: `1px solid ${C.border}`,
      }}>
        <Logo size={28} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{
            fontSize: 12, color: C.dim, padding: "5px 12px",
            background: C.surface2, borderRadius: 8,
            border: `1px solid ${C.border}`,
          }}>
            {profile.major} → {currentGoal}
          </span>
          <Btn onClick={onReset}>New Analysis</Btn>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 80px", position: "relative", zIndex: 1 }}>
        {/* What-If Bar */}
        <WhatIfBar profile={profile} onWhatIf={handleWhatIf} />

        {/* Tab bar */}
        <div style={{
          display: "flex", gap: 2, marginBottom: 24,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: 5,
        }}>
          {tabs.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: "10px 16px", borderRadius: 9,
                border: "none", cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
                background: activeTab === tab.id ? C.surface2 : "transparent",
                color: activeTab === tab.id ? C.accent : C.dim,
                transition: "all 0.2s",
                boxShadow: activeTab === tab.id ? `inset 0 0 0 1px ${C.accentDim}, 0 2px 8px rgba(0,0,0,0.2)` : "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.accent, display: "inline-block" }} />
              )}
            </button>
          ))}
        </div>

        {/* Animated tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// APP ROOT
// ════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("landing");
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);

  const handleSubmit = async (prof) => {
    setProfile(prof);
    setScreen("loading");

    let result = null;
    try {
      const fd = new FormData();
      fd.append("major", prof.major);
      fd.append("courses_taken", prof.courses);
      fd.append("career_goal", prof.goal);
      if (prof.resumeFile) fd.append("resume", prof.resumeFile);
      if (prof.jobText) fd.append("job_text", prof.jobText);
      const r = await fetch(`${API}/analyze`, { method: "POST", body: fd });
      if (r.ok) result = await r.json();
    } catch (e) { console.log("Backend unavailable, using mock data"); }

    const final = result || makeMock(prof.major, prof.goal);
    setTimeout(() => { setData(final); setScreen("dashboard"); }, result ? 500 : 2500);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${C.bg}; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(0.95); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        ::selection { background: ${C.accentDim}; color: ${C.accent}; }
        select option { background: ${C.surface}; color: ${C.text}; }
        textarea, input { font-family: 'DM Sans', sans-serif; }
        button:hover:not(:disabled) { opacity: 0.88; }
      `}</style>

      <AnimatePresence mode="wait">
        {screen === "landing" && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <LandingPage onStart={() => setScreen("input")} />
          </motion.div>
        )}
        {screen === "input" && (
          <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <InputForm onSubmit={handleSubmit} onBack={() => setScreen("landing")} />
          </motion.div>
        )}
        {screen === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <LoadingScreen />
          </motion.div>
        )}
        {screen === "dashboard" && data && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Dashboard data={data} profile={profile} onReset={() => { setScreen("landing"); setData(null); setProfile(null); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
