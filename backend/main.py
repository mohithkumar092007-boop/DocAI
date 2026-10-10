import os, re, json, sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_DIR = Path(__file__).parent
DB_PATH = APP_DIR / "knowledge.db"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "").strip()
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
GITHUB_API = "https://api.github.com"

app = FastAPI(title="AI Knowledge Transfer Assistant", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    repo_url: str = Field(min_length=10, max_length=300)

class AskRequest(BaseModel):
    repo_url: str = Field(min_length=10, max_length=300)
    question: str = Field(min_length=2, max_length=1000)

def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    with db() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS analyses (
            repo TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL
        )""")
init_db()

def parse_repo_url(value: str):
    parsed = urlparse(value.strip())
    if parsed.scheme not in ("https", "http") or parsed.netloc.lower() not in ("github.com", "www.github.com"):
        raise HTTPException(400, "Enter a GitHub repository URL, e.g. https://github.com/owner/repo")
    parts = [p for p in parsed.path.strip("/").split("/") if p]
    if len(parts) < 2 or not re.fullmatch(r"[A-Za-z0-9_.-]+", parts[0]) or not re.fullmatch(r"[A-Za-z0-9_.-]+", parts[1]):
        raise HTTPException(400, "The URL must contain an owner and repository name.")
    return parts[0], parts[1].removesuffix(".git")

async def gh_get(client, path, params=None):
    response = await client.get(f"{GITHUB_API}{path}", params=params)
    if response.status_code == 404:
        raise HTTPException(404, "Repository or resource not found. Check the URL and repository visibility.")
    if response.status_code == 403:
        raise HTTPException(429, "GitHub rate limit or access restriction. Try again later or configure GITHUB_TOKEN.")
    if response.status_code >= 400:
        raise HTTPException(response.status_code, f"GitHub API error: {response.text[:250]}")
    return response.json()

async def ollama_generate(prompt: str):
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(f"{OLLAMA_URL}/api/generate", json={
                "model": OLLAMA_MODEL, "prompt": prompt, "stream": False
            })
            r.raise_for_status()
            return r.json().get("response", "").strip(), True
    except Exception:
        return "", False

def safe_text(value, limit=5000):
    return (value or "").strip()[:limit]

def make_docs(repo, meta, readme, files_list, commits, issues, prs, ai_summary=""):
    languages = meta.get("language") or "Not specified"
    file_lines = "\n".join(f"- `{x['path']}`" for x in files_list[:45])
    commit_lines = "\n".join(
        f"- {c.get('commit', {}).get('message', '').splitlines()[0]} ({c.get('commit', {}).get('author', {}).get('date', '')[:10]})"
        for c in commits[:8]
    ) or "- No commit history returned."
    issue_lines = "\n".join(f"- #{i['number']} {i['title']} — {i['html_url']}" for i in issues[:8]) or "- No open issues returned."
    pr_lines = "\n".join(f"- #{p['number']} {p['title']} — {p['html_url']}" for p in prs[:8]) or "- No open pull requests returned."
    summary = ai_summary or safe_text(meta.get("description"), 1000) or "Review the repository README and source files to understand the project purpose."
    return f"""# Onboarding Guide: {repo}

Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}

## Project overview
{summary}

- **Repository:** {meta.get('html_url', '')}
- **Default branch:** {meta.get('default_branch', 'unknown')}
- **Primary language:** {languages}
- **Stars:** {meta.get('stargazers_count', 0)}
- **Open issues:** {meta.get('open_issues_count', 0)}

## Getting started
1. Install Git and the language/runtime required by this project.
2. Clone the repository:
   ```bash
   git clone {meta.get('clone_url', '')}
   cd {repo.split('/')[-1]}
   ```
3. Read the README and review configuration/example environment files.
4. Install dependencies using the instructions for the detected stack.
5. Configure required environment variables. Never commit secrets.
6. Run the project's documented development command and tests.

> The exact install and run commands were not inferred unless explicitly documented in the repository README.

## Repository structure (sample)
{file_lines or '- No file listing available.'}

## Recent commits
{commit_lines}

## Open issues to review
{issue_lines}

## Open pull requests
{pr_lines}

## README excerpt
{readme[:5000] if readme else 'No README was found in the repository root.'}

## New developer checklist
- [ ] Read the README and contribution guide.
- [ ] Set up the runtime and dependencies.
- [ ] Configure local environment variables.
- [ ] Run tests and the development server.
- [ ] Review recent commits and open issues.
- [ ] Ask a maintainer before changing unfamiliar modules.

## Important note
This guide is generated from public repository metadata and selected history. Verify setup instructions against the actual project before using them.
"""

@app.get("/api/health")
def health():
    return {"status": "ok", "ai_provider": "ollama_optional", "model": OLLAMA_MODEL}

@app.post("/api/analyze")
async def analyze(body: AnalyzeRequest):
    owner, name = parse_repo_url(body.repo_url)
    repo = f"{owner}/{name}"
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    async with httpx.AsyncClient(headers=headers, timeout=25, follow_redirects=True) as client:
        meta = await gh_get(client, f"/repos/{owner}/{name}")
        readme = ""
        try:
            readme_json = await gh_get(client, f"/repos/{owner}/{name}/readme")
            import base64
            readme = base64.b64decode(readme_json.get("content", "")).decode("utf-8", errors="replace")
        except HTTPException as e:
            if e.status_code not in (404,):
                raise
        tree = await gh_get(client, f"/repos/{owner}/{name}/git/trees/{meta.get('default_branch', 'main')}", {"recursive": "1"})
        files_list = [{"path": x["path"], "type": x["type"]} for x in tree.get("tree", []) if x.get("type") == "blob"][:250]
        commits = await gh_get(client, f"/repos/{owner}/{name}/commits", {"per_page": 10})
        all_issues = await gh_get(client, f"/repos/{owner}/{name}/issues", {"state": "open", "per_page": 15})
        issues = [i for i in all_issues if "pull_request" not in i]
        prs = await gh_get(client, f"/repos/{owner}/{name}/pulls", {"state": "open", "per_page": 10})

    prompt = (
        "You are a careful software onboarding assistant. Summarize only facts supported by this data. "
        "If something is unknown, say so. Keep it under 180 words.\n\n"
        f"Repository: {repo}\nDescription: {meta.get('description')}\nLanguage: {meta.get('language')}\n"
        f"README:\n{readme[:5000]}\nFiles:\n" + "\n".join(x["path"] for x in files_list[:70])
    )
    ai_summary, ai_used = await ollama_generate(prompt)
    if not ai_summary:
        ai_summary = (meta.get("description") or "No repository description is available.") + (
            "\n\n" + readme[:700] if readme else ""
        )
    docs = make_docs(repo, meta, readme, files_list, commits, issues, prs, ai_summary)
    # Simple graph: directories and files, suitable for an initial demo.
    graph_nodes = [{"id": "root", "label": repo, "type": "repository"}]
    graph_edges = []
    seen_dirs = set()
    for item in files_list[:80]:
        parts = item["path"].split("/")
        parent = "root"
        for folder in parts[:-1]:
            folder_id = "/".join(parts[:parts.index(folder)+1]) if folder in parts else folder
            if folder_id not in seen_dirs:
                graph_nodes.append({"id": folder_id, "label": folder, "type": "folder"})
                graph_edges.append({"source": parent, "target": folder_id})
                seen_dirs.add(folder_id)
            parent = folder_id
        graph_nodes.append({"id": item["path"], "label": parts[-1], "type": "file"})
        graph_edges.append({"source": parent, "target": item["path"]})
    payload = {
        "repo": repo,
        "metadata": {
            "name": meta.get("full_name"), "description": meta.get("description"),
            "url": meta.get("html_url"), "language": meta.get("language"),
            "stars": meta.get("stargazers_count"), "forks": meta.get("forks_count"),
            "open_issues": meta.get("open_issues_count"), "default_branch": meta.get("default_branch"),
            "updated_at": meta.get("updated_at"), "license": (meta.get("license") or {}).get("spdx_id")
        },
        "summary": ai_summary,
        "ai_used": ai_used,
        "files": files_list,
        "commits": [{
            "sha": c.get("sha", "")[:7],
            "message": c.get("commit", {}).get("message", "").splitlines()[0],
            "author": (c.get("commit", {}).get("author") or {}).get("name", "Unknown"),
            "date": (c.get("commit", {}).get("author") or {}).get("date", ""),
            "url": c.get("html_url", "")
        } for c in commits],
        "issues": [{"number": i["number"], "title": i["title"], "url": i["html_url"]} for i in issues],
        "pull_requests": [{"number": p["number"], "title": p["title"], "url": p["html_url"]} for p in prs],
        "docs_markdown": docs,
        "graph": {"nodes": graph_nodes, "edges": graph_edges},
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
    with db() as con:
        con.execute("INSERT OR REPLACE INTO analyses(repo,payload,updated_at) VALUES(?,?,?)",
                    (repo, json.dumps(payload), payload["generated_at"]))
    return payload

@app.get("/api/analysis")
def get_analysis(repo: str):
    with db() as con:
        row = con.execute("SELECT payload FROM analyses WHERE repo=?", (repo,)).fetchone()
    if not row:
        raise HTTPException(404, "No saved analysis for this repository. Analyze it first.")
    return json.loads(row["payload"])

@app.post("/api/ask")
async def ask(body: AskRequest):
    owner, name = parse_repo_url(body.repo_url)
    repo = f"{owner}/{name}"
    with db() as con:
        row = con.execute("SELECT payload FROM analyses WHERE repo=?", (repo,)).fetchone()
    if not row:
        raise HTTPException(404, "Analyze the repository before asking questions.")
    payload = json.loads(row["payload"])
    context = (
        f"Repository: {repo}\nSummary: {payload['summary']}\n"
        f"README excerpt and onboarding guide:\n{payload['docs_markdown'][:7000]}\n"
        f"Files:\n" + "\n".join(x["path"] for x in payload["files"][:100]) +
        "\nRecent commits:\n" + "\n".join(c["message"] for c in payload["commits"][:10])
    )
    prompt = (
        "Answer as a senior developer helping a new teammate. Use only the context below. "
        "If the answer is not present, say what is missing instead of guessing. Keep the answer concise.\n\n"
        f"CONTEXT:\n{context}\n\nQUESTION: {body.question}\nANSWER:"
    )
    answer, ai_used = await ollama_generate(prompt)
    if not answer:
        answer = (
            "The local AI model is not available, so here is the repository context I can verify.\n\n"
            f"**Repository:** {repo}\n\n**Summary:** {payload['summary']}\n\n"
            "For exact run commands, check the README and project configuration files. "
            "To enable model-generated answers, start Ollama and pull the configured model."
        )
    return {"repo": repo, "question": body.question, "answer": answer, "ai_used": ai_used}

@app.get("/api/saved")
def saved():
    with db() as con:
        rows = con.execute("SELECT repo, updated_at FROM analyses ORDER BY updated_at DESC LIMIT 25").fetchall()
    return {"items": [dict(r) for r in rows]}
