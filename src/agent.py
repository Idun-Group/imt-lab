from __future__ import annotations

import os
os.environ.setdefault("LANGGRAPH_DEFAULT_RECURSION_LIMIT", "60")

from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from .nodes import (
    acknowledge_node,
    analyst_node,
    chat_node,
    planner_node,
    report_writer_node,
    responder_node,
    route_intent,
    router_node,
    should_continue,
)
from .state import AnalystState, ChatInput, ChatOutput
from .tools import ANALYST_TOOLS


def build_graph():
    g = StateGraph(AnalystState, input=ChatInput, output=ChatOutput)

    g.add_node("router", router_node)
    g.add_node("chat", chat_node)
    g.add_node("acknowledge", acknowledge_node)
    g.add_node("planner", planner_node)
    g.add_node("analyst", analyst_node)
    g.add_node("tools", ToolNode(ANALYST_TOOLS))
    g.add_node("report_writer", report_writer_node)
    g.add_node("responder", responder_node)

    g.add_edge(START, "router")
    g.add_conditional_edges(
        "router", route_intent, {"chat": "chat", "analysis": "acknowledge"}
    )
    g.add_edge("chat", END)
    g.add_edge("acknowledge", "planner")
    g.add_edge("planner", "analyst")
    g.add_conditional_edges(
        "analyst", should_continue, {"tools": "tools", "report_writer": "report_writer"}
    )
    g.add_edge("tools", "analyst")
    g.add_edge("report_writer", "responder")
    g.add_edge("responder", END)

    return g.compile()


graph = build_graph()
