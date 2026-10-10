# AI Knowledge Transfer Assistant

A full-stack hackathon MVP that turns a GitHub repository's README, file tree, commits, open issues, and pull requests into an onboarding guide. It includes a React dashboard, FastAPI backend, SQLite persistence, optional local Ollama model support, and repository Q&A.

## Features
- Analyze public GitHub repositories by URL.
- Display repository metadata, recent commits, open issues, and pull requests.
- Generate downloadable Markdown onboarding documentation.
- Ask repository-grounded questions.
- Browse repository files and a simple file/directory structure visualization.
- Optional local LLM via Ollama; fallback mode works without a model.
- Save analysis results in SQLite.

## Requirements
- Python 3.10+
- Node.js 18+
- Internet access to GitHub API
- Optional: [Ollama](https://ollama.com/) for local model responses

## Run locally

### 1. Backend
Open a terminal in the project root:

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:
```bash
source .venv/bin/activate
```

Install and start:
```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

Optional environment configuration: copy `.env.example` to `.env` and export values in your shell. This minimal project does not automatically load `.env`; set variables in your terminal or install `python-dotenv` and load it explicitly. For PowerShell:
```powershell
$env:GITHUB_TOKEN="YOUR_READ_ONLY_GITHUB_TOKEN"
$env:OLLAMA_MODEL="qwen2.5:3b"
```

### 2. Optional local AI model
Install Ollama, then:
```bash
ollama pull qwen2.5:3b
ollama serve
```
Keep Ollama running. The backend calls `http://localhost:11434`. If Ollama is not available, the app uses a non-generative fallback.

### 3. Frontend
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

If the backend runs on a different address, create `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```
Restart Vite after changing environment variables.

## Demo workflow
1. Start the backend and frontend.
2. Paste a public repository URL, such as `https://github.com/fastapi/fastapi`.
3. Click **Analyze repository**.
4. Show the repository summary, stars, commits, issues, and pull requests.
5. Open **Onboarding docs**, then click **Export .md**.
6. Open **Ask the codebase** and ask “What should a new developer read first?”
7. Open **Repository files** and filter for `src`, `tests`, or `README`.
8. Open **Knowledge graph** to show file/directory relationships.

## API
- `GET /api/health` — backend health
- `POST /api/analyze` — body `{ "repo_url": "https://github.com/owner/repo" }`
- `GET /api/analysis?repo=owner/repo` — fetch saved analysis
- `POST /api/ask` — body `{ "repo_url": "...", "question": "..." }`
- `GET /api/saved` — saved analyses

## Security and limitations
- Never commit tokens or `.env` files.
- Use read-only repository permissions for a demo.
- The app only analyzes repositories you are authorized to access.
- The graph currently visualizes the file tree, not semantic imports/dependency edges.
- The onboarding guide does not execute project code and does not guarantee install commands are correct; verify with the repository's own docs.
- The SQLite database is local to the backend directory.
- For production, add authentication, request throttling, background jobs, caching, pagination, secret management, and stricter CORS settings.
