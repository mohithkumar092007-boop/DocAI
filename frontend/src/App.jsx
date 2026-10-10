import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Activity, BookOpen, Bot, BrainCircuit, CheckCircle2, ChevronRight, CircleHelp, Code2, ExternalLink, FileCode2, GitCommitHorizontal, GitPullRequest, Github, LoaderCircle, Network, RefreshCw, Search, Send, ShieldCheck, Sparkles, Star, Terminal, Waypoints } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const demoRepo = "https://github.com/fastapi/fastapi";

export default function App() {
  const [repoUrl, setRepoUrl] = useState(demoRepo);
  const [analysis, setAnalysis] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [filter, setFilter] = useState("");

  async function analyze() {
    setLoading(true); setError(""); setAnswer(null);
    try {
      const res = await fetch(`${API}/api/analyze`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({repo_url: repoUrl}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Analysis failed");
      setAnalysis(data); setTab("overview");
    } catch (e) { setError(e.message || "Could not reach the backend."); }
    finally { setLoading(false); }
  }
  async function askQuestion(q = question) {
    if (!q.trim()) return;
    setAsking(true); setError(""); setAnswer(null);
    try {
      const res = await fetch(`${API}/api/ask`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({repo_url: repoUrl, question: q}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Question failed");
      setAnswer(data); setQuestion(q);
    } catch (e) { setError(e.message); }
    finally { setAsking(false); }
  }
  const files = useMemo(() => (analysis?.files || []).filter(f => f.path.toLowerCase().includes(filter.toLowerCase())), [analysis, filter]);
  function downloadDocs() {
    if (!analysis) return;
    const blob = new Blob([analysis.docs_markdown], {type:"text/markdown;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `${analysis.repo.replace("/", "-")}-onboarding.md`; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><BrainCircuit size={22}/></div><div><b>TransferAI</b><small>KNOWLEDGE PLATFORM</small></div></div>
      <div className="workspace"><div className="workspace-icon">KT</div><div><b>Developer workspace</b><small>Personal environment</small></div><span className="green-dot"/></div>
      <div className="nav-label">WORKSPACE</div>
      <button className={`nav-item ${tab==="overview"?"active":""}`} onClick={()=>setTab("overview")}><Activity size={17}/> Overview</button>
      <button className={`nav-item ${tab==="docs"?"active":""}`} onClick={()=>setTab("docs")}><BookOpen size={17}/> Onboarding docs</button>
      <button className={`nav-item ${tab==="chat"?"active":""}`} onClick={()=>setTab("chat")}><Bot size={17}/> Ask the codebase</button>
      <button className={`nav-item ${tab==="graph"?"active":""}`} onClick={()=>setTab("graph")}><Network size={17}/> Knowledge graph</button>
      <button className={`nav-item ${tab==="files"?"active":""}`} onClick={()=>setTab("files")}><FileCode2 size={17}/> Repository files</button>
      <div className="sidebar-bottom"><div className="secure-icon"><ShieldCheck size={17}/></div><div><b>Privacy first</b><p>Repository data is analyzed on request. Use authorized access only.</p></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={14}/> <span>{analysis?.repo || "Repository intelligence"}</span></div><div className="top-right"><span className="status-pill"><i/> API workspace</span><div className="avatar">AI</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow"><Sparkles size={14}/> AI-POWERED DEVELOPER ONBOARDING</div><h1>Understand any codebase.<br/><span>Get productive faster.</span></h1><p className="subheading">Turn repository history and project files into actionable engineering knowledge.</p></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-core"><BrainCircuit size={42}/></div><div className="float-icon float-a"><Github size={18}/></div><div className="float-icon float-b"><Code2 size={18}/></div><div className="float-icon float-c"><BookOpen size={18}/></div></div></div>
        <section className="connect-card"><div className="connect-title"><div className="github-box"><Github size={22}/></div><div><h2>Connect a repository</h2><p>Start with a public GitHub URL. Private repositories need a token.</p></div></div><form className="repo-form" onSubmit={e=>{e.preventDefault(); analyze();}}><div className="url-input"><Github size={18}/><input aria-label="GitHub repository URL" value={repoUrl} onChange={e=>setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repository"/></div><button className="primary-btn" disabled={loading || !repoUrl.trim()}>{loading?<LoaderCircle className="spin" size={17}/>:<Sparkles size={17}/>} {loading?"Analyzing...":"Analyze repository"}</button></form><div className="connect-foot"><span><CheckCircle2 size={14}/> Read-only analysis</span><span><CheckCircle2 size={14}/> Markdown export</span><span><CheckCircle2 size={14}/> AI-assisted Q&A</span></div></section>
        {error && <div className="error-box">{error}</div>}
        {!analysis ? <section className="empty-state"><div className="empty-icon"><Waypoints size={28}/></div><h2>Your repository intelligence starts here</h2><p>Connect a repository to generate an onboarding guide, explore project history, and ask questions grounded in the codebase.</p><div className="empty-steps"><div><span>01</span><b>Connect</b><small>Enter a GitHub URL</small></div><ChevronRight size={18}/><div><span>02</span><b>Analyze</b><small>Inspect project signals</small></div><ChevronRight size={18}/><div><span>03</span><b>Explore</b><small>Learn and ask questions</small></div></div></section>
        : <>
          <div className="repo-heading"><div className="repo-title"><div className="repo-symbol"><Github size={22}/></div><div><div className="eyebrow">ANALYSIS COMPLETE</div><h2>{analysis.metadata.name || analysis.repo}</h2><p>{analysis.metadata.description || "No repository description provided."}</p></div></div><a className="external-link" href={analysis.metadata.url} target="_blank" rel="noreferrer">View on GitHub <ExternalLink size={14}/></a></div>
          <div className="stats-grid">
            <Stat icon={<Star size={17}/>} label="Stars" value={Number(analysis.metadata.stars||0).toLocaleString()}/>
            <Stat icon={<GitCommitHorizontal size={17}/>} label="Recent commits" value={analysis.commits.length}/>
            <Stat icon={<CircleHelp size={17}/>} label="Open issues" value={analysis.issues.length}/>
            <Stat icon={<GitPullRequest size={17}/>} label="Open pull requests" value={analysis.pull_requests.length}/>
          </div>
          <div className="tabs">{[["overview","Overview"],["docs","Onboarding docs"],["chat","Ask the codebase"],["graph","Knowledge graph"],["files","Files"]].map(([id,label])=><button key={id} className={tab===id?"tab active-tab": "tab"} onClick={()=>setTab(id)}>{label}</button>)}</div>
          {tab==="overview" && <div className="two-col"><section className="panel"><PanelTitle icon={<Sparkles size={17}/>} title="AI project briefing" subtitle={analysis.ai_used?"Generated with local model":"Repository-grounded fallback summary"}/><p className="summary-text">{analysis.summary}</p><div className="meta-grid"><Meta label="Primary language" value={analysis.metadata.language||"Unknown"}/><Meta label="Default branch" value={analysis.metadata.default_branch||"Unknown"}/><Meta label="License" value={analysis.metadata.license||"Not specified"}/><Meta label="Last updated" value={analysis.metadata.updated_at?.slice(0,10)||"Unknown"}/></div></section><section className="panel"><PanelTitle icon={<GitCommitHorizontal size={17}/>} title="Recent activity" subtitle="Latest repository commits"/><div className="timeline">{analysis.commits.slice(0,5).map(c=><div className="timeline-item" key={c.sha}><span className="timeline-dot"/><div><a href={c.url} target="_blank" rel="noreferrer">{c.message}</a><small>{c.author} · {c.date?.slice(0,10)} · {c.sha}</small></div></div>)}</div></section><section className="panel"><PanelTitle icon={<CircleHelp size={17}/>} title="Open issues" subtitle="Items to understand next"/>{analysis.issues.length?analysis.issues.slice(0,5).map(i=><a className="list-link" key={i.number} href={i.url} target="_blank" rel="noreferrer"><span>#{i.number} {i.title}</span><ExternalLink size={13}/></a>):<p className="muted">No open issues found.</p>}</section><section className="panel"><PanelTitle icon={<GitPullRequest size={17}/>} title="Pull requests" subtitle="Changes under review"/>{analysis.pull_requests.length?analysis.pull_requests.slice(0,5).map(p=><a className="list-link" key={p.number} href={p.url} target="_blank" rel="noreferrer"><span>#{p.number} {p.title}</span><ExternalLink size={13}/></a>):<p className="muted">No open pull requests found.</p>}</section></div>}
          {tab==="docs" && <section className="panel docs-panel"><div className="panel-head"><PanelTitle icon={<BookOpen size={17}/>} title="Generated onboarding guide" subtitle="Markdown documentation based on repository metadata and history"/><button className="secondary-btn" onClick={downloadDocs}><Terminal size={15}/> Export .md</button></div><div className="markdown"><ReactMarkdown>{analysis.docs_markdown}</ReactMarkdown></div></section>}
          {tab==="chat" && <section className="panel chat-panel"><PanelTitle icon={<Bot size={17}/>} title="Ask the codebase" subtitle="Questions are answered from the latest repository analysis"/><div className="chat-intro"><div className="bot-avatar"><BrainCircuit size={22}/></div><div><b>Knowledge Assistant</b><p>Ask about project setup, modules, recent changes, or what to read first.</p></div></div><div className="suggestions">{["How do I get started with this project?","What should a new developer read first?","What are the recent changes?"].map(q=><button key={q} onClick={()=>askQuestion(q)}>{q}<ChevronRight size={14}/></button>)}</div>{answer&&<div className="answer-card"><div className="answer-label"><Sparkles size={14}/> ASSISTANT ANSWER {answer.ai_used?"· LOCAL MODEL":"· FALLBACK"}</div><ReactMarkdown>{answer.answer}</ReactMarkdown></div>}<form className="ask-form" onSubmit={e=>{e.preventDefault();askQuestion();}}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask a question about this repository..." aria-label="Ask a question"/><button className="primary-btn" disabled={asking||!question.trim()}>{asking?<LoaderCircle className="spin" size={17}/>:<Send size={17}/>} Ask</button></form></section>}
          {tab==="graph" && <section className="panel"><PanelTitle icon={<Network size={17}/>} title="Repository structure graph" subtitle="Directory and file relationships, derived from the Git tree"/><div className="graph-legend"><span><i className="legend-root"/> Repository</span><span><i className="legend-folder"/> Folder</span><span><i className="legend-file"/> File</span></div><div className="tree-graph"><div className="tree-root"><Github size={17}/>{analysis.repo}</div>{analysis.graph.nodes.filter(n=>n.id!=="root"&&n.type==="folder").slice(0,24).map(n=><div className="tree-row" key={n.id}><span className="tree-line"/><span className="tree-node"><Network size={14}/>{n.id}</span></div>)}{analysis.graph.nodes.filter(n=>n.type==="file").slice(0,18).map(n=><div className="tree-row file-row" key={n.id}><span className="tree-line"/><span className="tree-node file-node"><FileCode2 size={13}/>{n.id}</span></div>)}</div><p className="muted graph-note">This MVP visualizes file-system relationships. Semantic module dependencies can be added by parsing imports in a later iteration.</p></section>}
          {tab==="files" && <section className="panel"><PanelTitle icon={<FileCode2 size={17}/>} title="Repository files" subtitle={`${analysis.files.length} files indexed (up to 250)`}/><div className="file-search"><Search size={16}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter paths..."/></div><div className="file-list">{files.slice(0,120).map(f=><div key={f.path}><FileCode2 size={15}/><span>{f.path}</span><small>{f.type}</small></div>)}</div></section>}
        </>}
        <footer><span>TransferAI · Hackathon MVP</span><span><i/> Built for faster developer onboarding</span></footer>
      </div>
    </main>
  </div>;
}
function Stat({icon,label,value}){return <div className="stat-card"><div className="stat-icon">{icon}</div><div><small>{label}</small><strong>{value}</strong></div></div>}
function PanelTitle({icon,title,subtitle}){return <div className="panel-title"><div className="panel-icon">{icon}</div><div><h3>{title}</h3><p>{subtitle}</p></div></div>}
function Meta({label,value}){return <div className="meta-item"><small>{label}</small><b>{value}</b></div>}
