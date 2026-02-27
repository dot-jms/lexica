# LEXICA V0

A neuro-symbolic knowledge engine that runs entirely in your browser.  
No server. No API keys. No backend. Just a browser and Wikipedia.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Shell — HTML structure only |
| `lexica.css` | All styling (945 lines) |
| `lexica.js` | Full engine — KG, BM25, SLM, synthesis, UI (9300+ lines) |
| `lexica-worker.js` | SLM Web Worker source (loaded dynamically by lexica.js) |

## Deploy to GitHub Pages

1. Push all four files to a repo
2. Go to **Settings → Pages → Source → main branch / root**
3. Done — Lexica runs at `https://yourusername.github.io/yourrepo/`

## Local Dev

Just open `index.html` in Chrome or Edge. Firefox may block certain model downloads due to CORS headers on `file://` — use a local server if needed:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Architecture

- **BM25** — sentence-level retrieval over loaded sources  
- **KnowledgeGraph** — pattern-extracted triples with HyperEdge support  
- **NeuralMouth** — SmolLM2-360M or Flan-T5 (loads from HuggingFace, cached in browser)  
- **NanoCortex** — semantic vector space (PMI-based, no server)  
- **HomeostaticDriveEngine** — curiosity, expression, satiation drives  
- **CuriosityEngine** — detects knowledge gaps, triggers auto-fetch  
- **SocietyOfMind** — Skeptic / Literal / Dreamer synthesis modes  
- **EpisodicMemory** — persists across sessions via localStorage  
