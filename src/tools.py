from __future__ import annotations

import json
import uuid

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from langchain_core.tools import tool
from langchain_experimental.tools.python.tool import PythonAstREPLTool

from .config import DATA_DIR, DATASETS, EU_PALETTE, OUTPUT_DIR

plt.rcParams.update({
    "axes.prop_cycle": plt.cycler(color=EU_PALETTE),
    "axes.facecolor": "white",
    "figure.facecolor": "white",
    "axes.grid": True,
    "grid.alpha": 0.25,
    "grid.linestyle": "--",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.titlesize": 13,
    "axes.titleweight": "bold",
    "font.family": "DejaVu Sans",
})

_namespace: dict = {}
_charts: list[str] = []
_repl: PythonAstREPLTool | None = None


def reset_session() -> None:
    global _namespace, _charts, _repl
    _namespace = {"pd": pd, "plt": plt}
    for csv in sorted(DATA_DIR.glob("*.csv")):
        _namespace[f"df_{csv.stem}"] = pd.read_csv(csv)
    _charts = []
    _repl = PythonAstREPLTool(locals=_namespace, globals=_namespace)


def get_charts() -> list[str]:
    return list(_charts)


@tool
def list_datasets() -> str:
    """List all pre-loaded datasets, their Python variable names, columns and coverage."""
    catalogue = {
        name: {"variable": f"df_{name.removesuffix('.csv')}", **meta}
        for name, meta in DATASETS.items()
    }
    return json.dumps(catalogue, indent=2)


@tool
def execute_python(code: str) -> str:
    """Run Python in a persistent session. pandas is pd, matplotlib is plt.
    Every dataset is pre-loaded as df_<name>. Use print(...) to show values.
    Any matplotlib figure you create is saved automatically."""
    if _repl is None:
        reset_session()
    plt.close("all")
    try:
        out = _repl.run(code)
    except Exception as exc:
        return f"[error] {type(exc).__name__}: {exc}"

    paths: list[str] = []
    for fnum in plt.get_fignums():
        fig = plt.figure(fnum)
        fig.text(0.99, 0.01, "Source: Eurostat", ha="right", va="bottom",
                 fontsize=7, color="#666666", style="italic")
        path = OUTPUT_DIR / f"chart_{uuid.uuid4().hex[:8]}.png"
        fig.savefig(path, dpi=140, bbox_inches="tight")
        paths.append(str(path))
        _charts.append(str(path))
    plt.close("all")

    text = str(out) if out is not None else ""
    if len(text) > 4000:
        text = text[:4000] + "\n... [truncated]"
    if paths:
        text += "\n\n[saved charts]\n" + "\n".join(paths)
    return text or "[ok]"


@tool
def web_search(query: str) -> str:
    """Search the web via DuckDuckGo for recent context. Returns top 3 results."""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))
    except Exception as exc:
        return f"[search failed: {type(exc).__name__}: {exc}]"
    if not results:
        return "[no results]"
    return "\n\n".join(
        f"- {r.get('title','')}\n  {r.get('body','')}\n  {r.get('href','')}"
        for r in results
    )


ANALYST_TOOLS = [list_datasets, execute_python, web_search]
