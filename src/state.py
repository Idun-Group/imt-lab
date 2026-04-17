from __future__ import annotations

from typing import Annotated, TypedDict

from langgraph.graph.message import add_messages


class ChatInput(TypedDict):
    messages: Annotated[list, add_messages]


class ChatOutput(TypedDict):
    messages: Annotated[list, add_messages]


class AnalystState(TypedDict):
    messages: Annotated[list, add_messages]
    route: str
    analysis_plan: str
    report_path: str
