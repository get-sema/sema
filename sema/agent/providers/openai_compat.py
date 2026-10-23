"""
OpenAI-compatible providers — OpenAI, DeepSeek, OpenRouter, Together.

All four speak the same chat-completions wire format, so one implementation
parameterized by base URL, catalog, and pricing covers them, exactly as the
extension does with ``OpenAICompatibleProvider``.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, AsyncIterator

from ..attachments import materialize, read_base64
from .base import (
    BaseProvider,
    Event,
    ModelInfo,
    Notice,
    TextDelta,
    ThinkingDelta,
    ToolCall,
    TurnEnd,
    TurnRequest,
    Usage,
)


class OpenAICompatibleProvider(BaseProvider):
    """One chat-completions provider, configured by construction."""

    def __init__(
        self,
        id: str,
        label: str,
        models: list[ModelInfo],
        default_model: str,
        key_env: str,
        base_url: str | None = None,
        prices: dict[str, tuple[float, float, float]] | None = None,
        efforts: tuple[str, ...] = (),
    ) -> None:
        self.id = id
        self.label = label
        self.models = models
        self.default_model = default_model
        self.key_env = key_env
        self.base_url = base_url
        self.prices = prices or {}
        self.efforts = efforts
        self.requires_key = True
        self.reads_workspace = False

    def _client(self, api_key: str | None):
        try:
            from openai import AsyncOpenAI
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise RuntimeError(
                "The `openai` package is required for this provider. "
                "Install it with: uv sync --extra chat"
            ) from exc
        key = api_key or os.environ.get(self.key_env) or ""
        kwargs: dict[str, Any] = {"api_key": key}
        if self.base_url:
            kwargs["base_url"] = self.base_url
        return AsyncOpenAI(**kwargs)

    def estimate_cost(self, model: str, usage: Usage) -> float | None:
        price = self.prices.get(model)
        if price is None:
            return None
        fresh_in, cached_in, out = price
        cached = usage.cached_input_tokens
        uncached = max(usage.input_tokens - cached, 0)
        return (
            uncached * fresh_in / 1_000_000
            + cached * cached_in / 1_000_000
            + usage.output_tokens * out / 1_000_000
        )

    def _tool_specs(self, request: TurnRequest) -> list[dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                },
            }
            for t in request.tools
        ]

    def _content(self, message, directory: str | None) -> Any:
        if not message.attachments or not directory:
            return message.content
        parts: list[dict[str, Any]] = []
        for attachment in message.attachments:
            try:
                data = read_base64(Path(directory), attachment)
            except OSError:
                continue
            if attachment.kind == "image":
                parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{attachment.mime};base64,{data}"},
                })
            elif attachment.kind == "pdf":
                parts.append({
                    "type": "file",
                    "file": {"filename": attachment.name, "file_data":
                             f"data:application/pdf;base64,{data}"},
                })
        parts.append({"type": "text", "text": message.content})
        return parts

    def _build_messages(self, request: TurnRequest) -> list[dict[str, Any]]:
        directory = request.attachments_dir
        history = request.messages
        if directory:
            history, _ = materialize(Path(directory), history)
        messages: list[dict[str, Any]] = []
        if request.system:
            messages.append({"role": "system", "content": request.system})
        for message in history:
            messages.append({
                "role": message.role,
                "content": self._content(message, directory),
            })
        messages.extend(request.scratch)
        return messages

    async def stream(self, request: TurnRequest) -> AsyncIterator[Event]:
        try:
            client = self._client(request.api_key)
        except Exception as exc:  # noqa: BLE001 - missing key must not crash the UI
            yield Notice(
                f"{self.label} is not configured: {exc}. "
                f"Set {self.key_env}, or switch provider with /provider."
            )
            yield TurnEnd(stop_reason="error")
            return
        model = request.model or self.default_model
        params: dict[str, Any] = {
            "model": model,
            "messages": self._build_messages(request),
            "max_completion_tokens": request.max_tokens,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if request.tools:
            params["tools"] = self._tool_specs(request)
        if request.effort and request.effort != "default" and self.efforts:
            params["reasoning_effort"] = request.effort

        text_parts: list[str] = []
        # Tool calls arrive as indexed deltas that must be concatenated.
        partial: dict[int, dict[str, Any]] = {}
        usage = Usage()
        chunks_seen = 0
        try:
            stream = await client.chat.completions.create(**params)
            async for chunk in stream:
                chunks_seen += 1
                if getattr(chunk, "usage", None):
                    raw = chunk.usage
                    cached = 0
                    details = getattr(raw, "prompt_tokens_details", None)
                    if details is not None:
                        cached = getattr(details, "cached_tokens", 0) or 0
                    usage = Usage(
                        input_tokens=getattr(raw, "prompt_tokens", 0) or 0,
                        output_tokens=getattr(raw, "completion_tokens", 0) or 0,
                        cached_input_tokens=cached,
                    )
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                reasoning = getattr(delta, "reasoning_content", None)
                if reasoning:
                    yield ThinkingDelta(reasoning)
                if getattr(delta, "content", None):
                    text_parts.append(delta.content)
                    yield TextDelta(delta.content)
                for call in getattr(delta, "tool_calls", None) or []:
                    slot = partial.setdefault(
                        call.index, {"id": "", "name": "", "arguments": ""}
                    )
                    if call.id:
                        slot["id"] = call.id
                    if call.function and call.function.name:
                        slot["name"] = call.function.name
                    if call.function and call.function.arguments:
                        slot["arguments"] += call.function.arguments
        except Exception as exc:  # noqa: BLE001 - surfaced to the user
            yield Notice(f"{self.label} request failed: {exc}")
            yield TurnEnd(stop_reason="error")
            return

        tool_calls: list[ToolCall] = []
        raw_calls: list[dict[str, Any]] = []
        for index in sorted(partial):
            slot = partial[index]
            if not slot["name"]:
                continue
            try:
                arguments = json.loads(slot["arguments"] or "{}")
            except ValueError:
                arguments = {}
            tool_calls.append(
                ToolCall(id=slot["id"] or f"call_{index}", name=slot["name"],
                         arguments=arguments)
            )
            raw_calls.append({
                "id": slot["id"] or f"call_{index}",
                "type": "function",
                "function": {"name": slot["name"], "arguments": slot["arguments"] or "{}"},
            })

        if chunks_seen == 0:
            # A gateway that answers with something other than SSE leaves the
            # SDK iterator empty. Without this the turn looks like a silent
            # empty answer rather than a failure.
            yield Notice(
                f"{self.label} returned no usable response — check the base URL, "
                "the model id, and the API key."
            )
            yield TurnEnd(stop_reason="error")
            return

        usage.cost_usd = self.estimate_cost(model, usage)
        yield usage

        if tool_calls:
            request.scratch.append({
                "role": "assistant",
                "content": "".join(text_parts) or None,
                "tool_calls": raw_calls,
            })
        yield TurnEnd(tool_calls=tool_calls,
                      stop_reason="tool_use" if tool_calls else "end_turn")

    def add_tool_results(
        self, request: TurnRequest, results: list[tuple[ToolCall, str, bool]]
    ) -> None:
        """Chat-completions wants one message per tool result."""
        for call, output, _is_error in results:
            request.scratch.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": output or "(no output)",
            })

    def assistant_text_only(self, request: TurnRequest, text: str) -> None:
        request.scratch.append({"role": "assistant", "content": text})


def openai_provider() -> OpenAICompatibleProvider:
    # Source: developers.openai.com/api/docs/models and /pricing. GPT-6 takes
    # reasoning_effort low..max (`none`/`minimal` 400 on gpt-6.1-sol).
    gpt5 = ("default", "low", "medium", "high", "xhigh")
    return OpenAICompatibleProvider(
        id="openai",
        label="OpenAI",
        key_env="OPENAI_API_KEY",
        default_model="gpt-6.1-sol",
        efforts=("default", "low", "medium", "high", "xhigh", "max"),
        models=[
            ModelInfo("gpt-6.1-sol", "GPT-6.1 Sol", "Recommended for coding",
                      recommended=True, accepts=("image", "text")),
            ModelInfo("gpt-6-astra", "GPT-6 Astra", "Flagship; premium pricing",
                      accepts=("image", "pdf", "text")),
            ModelInfo("gpt-6-luna", "GPT-6 Luna", "Cost-efficient",
                      accepts=("image", "text")),
            ModelInfo("gpt-5.6-sol", "GPT-5.6 Sol", "Previous generation",
                      accepts=("image", "pdf", "text"), efforts=gpt5),
            ModelInfo("gpt-5.6-terra", "GPT-5.6 Terra", "Previous generation",
                      accepts=("image", "pdf", "text"), efforts=gpt5),
        ],
        prices={
            "gpt-6-astra": (10.0, 1.0, 50.0),
            "gpt-6.1-sol": (2.0, 0.1, 10.0),
            "gpt-6-sol": (2.0, 0.2, 10.0),
            "gpt-6-luna": (0.1, 0.01, 0.5),
            # List price; a promotional 4/0.4/20 runs to at least 2026-11-21.
            "gpt-5.6-sol": (5.0, 0.5, 30.0),
            "gpt-5.6": (5.0, 0.5, 30.0),
            "gpt-5.6-terra": (2.0, 0.2, 12.0),
            "gpt-5.6-luna": (0.2, 0.02, 1.2),
            "gpt-5.5": (5.0, 0.5, 30.0),
            "gpt-5.5-pro": (30.0, 30.0, 180.0),
            "gpt-5.4": (2.5, 0.25, 15.0),
            "gpt-5.4-mini": (0.75, 0.075, 4.5),
        },
    )


def deepseek_provider() -> OpenAICompatibleProvider:
    # Source: api-docs.deepseek.com/quick_start/pricing. Peak-hour rates, so the
    # estimate is an upper bound: off-peak bills at half. deepseek-chat and
    # deepseek-reasoner were retired 2026-07-24.
    return OpenAICompatibleProvider(
        id="deepseek",
        label="DeepSeek",
        key_env="DEEPSEEK_API_KEY",
        base_url="https://api.deepseek.com",
        default_model="deepseek-flash",
        models=[
            ModelInfo("deepseek-flash", "DeepSeek Flash", "V4.1 Flash", recommended=True),
            ModelInfo("deepseek-v4-pro", "DeepSeek V4 Pro"),
        ],
        prices={
            "deepseek-flash": (0.30, 0.006, 1.20),
            "deepseek-v4-pro": (1.32, 0.044, 3.96),
        },
    )


def openrouter_provider() -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider(
        id="openrouter",
        label="OpenRouter",
        key_env="OPENROUTER_API_KEY",
        base_url="https://openrouter.ai/api/v1",
        default_model="anthropic/claude-opus-5.5",
        models=[
            ModelInfo("anthropic/claude-opus-5.5", "Claude Opus 5.5", recommended=True,
                      accepts=("image", "pdf", "text")),
            ModelInfo("anthropic/claude-sonnet-5.5", "Claude Sonnet 5.5",
                      accepts=("image", "pdf", "text")),
            ModelInfo("openai/gpt-6.1-sol", "GPT-6.1 Sol", accepts=("image", "text")),
            ModelInfo("google/gemini-4-argon", "Gemini 4 Argon", accepts=("image", "text")),
            ModelInfo("x-ai/grok-4.7", "Grok 4.7"),
            ModelInfo("deepseek/deepseek-v4.1-flash", "DeepSeek V4.1 Flash"),
            ModelInfo("z-ai/glm-5.3", "GLM 5.3"),
            ModelInfo("moonshotai/kimi-k3", "Kimi K3"),
        ],
    )


def together_provider() -> OpenAICompatibleProvider:
    # Source: docs.together.ai/docs/serverless/models. The Qwen3 Coder and
    # meta-llama chat models have left serverless.
    return OpenAICompatibleProvider(
        id="together",
        label="Together AI",
        key_env="TOGETHER_API_KEY",
        base_url="https://api.together.ai/v1",
        default_model="zai-org/GLM-5.3",
        models=[
            ModelInfo("zai-org/GLM-5.3", "GLM 5.3", "Together's pick for coding agents",
                      recommended=True),
            ModelInfo("moonshotai/Kimi-K3", "Kimi K3"),
            ModelInfo("deepseek-ai/DeepSeek-V4-Pro-0813", "DeepSeek V4 Pro"),
            ModelInfo("deepseek-ai/DeepSeek-V4.1-Flash", "DeepSeek V4.1 Flash"),
            ModelInfo("Qwen/Qwen3.6-Plus", "Qwen3.6 Plus"),
            ModelInfo("openai/gpt-oss-120b", "gpt-oss 120B"),
        ],
    )


def avalai_provider() -> OpenAICompatibleProvider:
    """AvalAI — an OpenAI-compatible gateway reachable when vendor APIs are not.

    Selecting it routes every request to api.avalai.ir; the model id only names
    what AvalAI proxies to. No cost is reported: AvalAI's inline
    ``estimated_cost`` is approximate by its own docs.
    """
    vision = ("image", "pdf", "text")
    return OpenAICompatibleProvider(
        id="avalai",
        label="AvalAI",
        key_env="AVALAI_API_KEY",
        base_url="https://api.avalai.ir/v1",
        default_model="claude-opus-5-5",
        models=[
            ModelInfo("claude-opus-5-5", "Claude Opus 5.5", section="Anthropic",
                      recommended=True, accepts=vision),
            ModelInfo("claude-sonnet-5-5", "Claude Sonnet 5.5", section="Anthropic",
                      accepts=vision),
            ModelInfo("claude-haiku-5-5", "Claude Haiku 5.5", section="Anthropic",
                      accepts=vision),
            ModelInfo("gpt-6.1-sol", "GPT-6.1 Sol", section="OpenAI",
                      accepts=("image", "text")),
            ModelInfo("gemini-4-argon", "Gemini 4 Argon", section="Google", accepts=vision),
            ModelInfo("grok-4.7", "Grok 4.7", section="xAI"),
            ModelInfo("deepseek-v4.1-flash", "DeepSeek V4.1 Flash", section="Open models"),
            ModelInfo("glm-5.3", "GLM 5.3", section="Open models"),
        ],
    )
