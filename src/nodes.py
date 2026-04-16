from __future__ import annotations

import json
from pathlib import Path

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_groq import ChatGroq

from .config import GROQ_API_KEY, GROQ_MODEL
from .pdf import build_report
from .prompts import (
    ACKNOWLEDGE_PROMPT,
    ANALYST_PROMPT,
    PLANNER_PROMPT,
    REPORT_PROMPT,
    RESPONDER_PROMPT,
)
from .state import AnalystState
from .tools import ANALYST_TOOLS, get_charts, reset_session


def _llm(temperature: float = 0.3, disable_streaming: bool | str = False) -> ChatGroq:
    return ChatGroq(
        model=GROQ_MODEL,
        api_key=GROQ_API_KEY,
        temperature=temperature,
        disable_streaming=disable_streaming,
        reasoning_format="hidden",
        max_retries=3,
    )


def _last_user_text(messages: list) -> str:
    for m in reversed(messages):
        role = getattr(m, "type", None) or getattr(m, "role", None)
        if role in ("human", "user"):
            content = getattr(m, "content", "")
            if isinstance(content, list):
                content = " ".join(
                    c.get("text", "") if isinstance(c, dict) else str(c)
                    for c in content
                )
            return str(content)
    return ""


def acknowledge_node(state: AnalystState) -> dict:
    query = _last_user_text(state["messages"])
    _llm(temperature=0.5).invoke(
        [
            SystemMessage(content=ACKNOWLEDGE_PROMPT),
            HumanMessage(content=query),
        ]
    )
    return {}


def planner_node(state: AnalystState) -> dict:
    reset_session()
    query = _last_user_text(state["messages"])
    plan = _llm().invoke(
        [
            SystemMessage(content=PLANNER_PROMPT),
            HumanMessage(content=query),
        ]
    )
    return {
        "analysis_plan": plan.content,
        "messages": [
            SystemMessage(content=ANALYST_PROMPT),
            HumanMessage(content=f"Question: {query}\n\nPlan:\n{plan.content}"),
        ],
    }


def analyst_node(state: AnalystState) -> dict:
    bound = _llm(temperature=0.0, disable_streaming="tool_calling").bind_tools(
        ANALYST_TOOLS
    )
    try:
        response = bound.invoke(state["messages"])
    except Exception as exc:
        nudge = HumanMessage(
            content=(
                "Your previous tool call had malformed arguments. "
                "Retry with a SHORTER, SIMPLER Python snippet (under 40 lines) "
                "and keep strings on single lines where possible."
            )
        )
        response = bound.invoke(state["messages"] + [nudge])
    return {"messages": [response]}


def should_continue(state: AnalystState) -> str:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return "report_writer"


def report_writer_node(state: AnalystState) -> dict:
    transcript_parts = []
    for m in state["messages"]:
        if isinstance(m, AIMessage) and m.content:
            transcript_parts.append(f"[assistant] {m.content}")
        elif isinstance(m, ToolMessage):
            body = m.content if len(m.content) < 1200 else m.content[:1200] + "..."
            transcript_parts.append(f"[tool {m.name}] {body}")
    transcript = "\n\n".join(transcript_parts[-16:])
    query = _last_user_text(state["messages"])

    web_context = ""
    try:
        from .tools import web_search

        web_context = web_search.invoke({"query": f"Europe 2026 {query}"})
    except Exception:
        web_context = ""

    response = _llm(temperature=0.2).invoke(
        [
            SystemMessage(content=REPORT_PROMPT),
            HumanMessage(
                content=(
                    f"User question:\n{query}\n\n"
                    f"Analysis transcript (internal tool calls + outputs):\n{transcript}\n\n"
                    f"Web-search context (use to enrich the 'Éclairage externe' section):\n{web_context or '[no results]'}"
                )
            ),
        ]
    )

    raw = response.content.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    try:
        spec = json.loads(raw)
    except json.JSONDecodeError:
        spec = {
            "title": query[:80],
            "executive_summary": response.content,
            "sections": [],
        }

    path = build_report(spec, get_charts())
    return {"report_path": str(path)}


def responder_node(state: AnalystState) -> dict:
    last_ai = next(
        (
            m
            for m in reversed(state["messages"])
            if isinstance(m, AIMessage) and not m.tool_calls and m.content
        ),
        None,
    )
    conclusion = last_ai.content if last_ai else ""
    query = _last_user_text(state["messages"])
    report_name = Path(state["report_path"]).name if state.get("report_path") else ""

    response = _llm(temperature=0.4).invoke(
        [
            SystemMessage(content=RESPONDER_PROMPT),
            HumanMessage(
                content=(
                    f"Question: {query}\n\n"
                    f"Analyst conclusion:\n{conclusion}\n\n"
                    f"A PDF report has been generated: {report_name}"
                )
            ),
        ]
    )
    text = response.content
    if report_name:
        text = f"{text}\n\n<!--REPORT:{report_name}-->"
    return {"messages": [AIMessage(content=text)]}
