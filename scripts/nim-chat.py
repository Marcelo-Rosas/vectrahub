#!/usr/bin/env python3
"""CLI chat against NVIDIA NIM (OpenAI-compatible).

Usage (Windows CMD / PowerShell / bash):
  python scripts/nim-chat.py "Oi"
  python scripts/nim-chat.py --stream "Explique CIOT"
  python scripts/nim-chat.py --list-models
  python scripts/nim-chat.py --system "Voce e especialista ANTT." "O que e CIOT?"
  python scripts/nim-chat.py --preset tms --large "O que e CIOT? 2 frases."
  python scripts/nim-chat.py -m nvidia/nemotron-3-nano-30b-a3b --system-file docs/foo.txt "..."

Reads NVIDIA_API_KEY from the environment, or from repo-root .env / .env.local
(key only; never prints the secret).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE = "https://integrate.api.nvidia.com/v1"
DEFAULT_MODEL = "nvidia/nvidia-nemotron-nano-9b-v2"
# Stronger / larger-context default when --large is set
LARGE_MODEL = "nvidia/nemotron-3-nano-30b-a3b"

PRESETS: dict[str, str] = {
    "tms": (
        "Voce e um especialista em transporte rodoviario de cargas no Brasil "
        "(ANTT, TMS, documentos fiscais). Responda em portugues do Brasil, "
        "de forma precisa e sem inventar significados de siglas.\n"
        "Definicoes obrigatorias neste dominio:\n"
        "- CIOT = Codigo Identificador da Operacao de Transporte (Res. ANTT "
        "5.862/2019 e normas correlatas). Nao e imposto, nao e taxa aduaneira, "
        "nao e Cognitive IoT.\n"
        "- CIOT identifica a operacao de frete contratada (contratante ETC → "
        "contratado TAC/ETC/CTC) e e emitido via integradores (ex.: e-FRETE).\n"
        "- CT-e = Conhecimento de Transporte Eletronico (modelo 57).\n"
        "- MDF-e = Manifesto Eletronico de Documentos Fiscais (modelo 58).\n"
        "- RNTRC = registro ANTT do transportador.\n"
        "Se a pergunta for ambigua, prefira o sentido ANTT/TMS acima."
    ),
}


def load_dotenv_files() -> None:
    """Minimal .env loader (no dependency on python-dotenv)."""
    for name in (".env", ".env.local"):
        path = ROOT / name
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = val


def get_api_key() -> str:
    load_dotenv_files()
    key = (
        os.environ.get("NVIDIA_API_KEY")
        or os.environ.get("NGC_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or ""
    ).strip()
    if not key:
        print(
            "Missing API key. Set NVIDIA_API_KEY (or put it in .env).",
            file=sys.stderr,
        )
        sys.exit(1)
    return key


def make_client(api_key: str, base_url: str):
    try:
        from openai import OpenAI
    except ImportError:
        print(
            "Package 'openai' not found. Run: pip install openai",
            file=sys.stderr,
        )
        sys.exit(1)
    return OpenAI(base_url=base_url.rstrip("/"), api_key=api_key)


def cmd_list_models(client) -> int:
    models = client.models.list()
    ids = sorted(m.id for m in models.data)
    for mid in ids:
        print(mid)
    print(f"\n# total: {len(ids)}", file=sys.stderr)
    return 0


def reasoning_of(obj) -> str | None:
    return getattr(obj, "reasoning_content", None) or getattr(obj, "reasoning", None)


def build_messages(system: str | None, prompt: str) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return messages


def resolve_system(
    *,
    system: str | None,
    system_file: str | None,
    preset: str | None,
) -> str | None:
    parts: list[str] = []
    if preset:
        key = preset.strip().lower()
        if key not in PRESETS:
            print(
                f"Unknown preset '{preset}'. Available: {', '.join(sorted(PRESETS))}",
                file=sys.stderr,
            )
            sys.exit(2)
        parts.append(PRESETS[key])
    if system_file:
        path = Path(system_file)
        if not path.is_file():
            path = ROOT / system_file
        if not path.is_file():
            print(f"System file not found: {system_file}", file=sys.stderr)
            sys.exit(2)
        parts.append(path.read_text(encoding="utf-8").strip())
    if system:
        parts.append(system.strip())
    if not parts:
        return None
    return "\n\n".join(p for p in parts if p)


def cmd_chat(
    client,
    *,
    model: str,
    messages: list[dict[str, str]],
    max_tokens: int,
    temperature: float,
    stream: bool,
    show_reasoning: bool,
    min_thinking: int | None,
    max_thinking: int | None,
) -> int:
    extra: dict = {}
    if min_thinking is not None:
        extra["min_thinking_tokens"] = min_thinking
    if max_thinking is not None:
        extra["max_thinking_tokens"] = max_thinking

    kwargs = dict(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=stream,
    )
    if extra:
        kwargs["extra_body"] = extra

    print(f"# model: {model}", file=sys.stderr)
    if any(m["role"] == "system" for m in messages):
        print("# system: yes", file=sys.stderr)

    if stream:
        content_started = False
        if show_reasoning:
            print("--- reasoning ---", file=sys.stderr)
        for chunk in client.chat.completions.create(**kwargs):
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            rc = reasoning_of(delta)
            if show_reasoning and rc:
                print(rc, end="", flush=True, file=sys.stderr)
            if delta.content:
                if show_reasoning and not content_started:
                    print("\n--- content ---", file=sys.stderr)
                    content_started = True
                print(delta.content, end="", flush=True)
        print()
        return 0

    resp = client.chat.completions.create(**kwargs)
    msg = resp.choices[0].message
    if show_reasoning:
        rc = reasoning_of(msg)
        if rc:
            print("--- reasoning ---", file=sys.stderr)
            print(rc, file=sys.stderr)
            print("--- content ---", file=sys.stderr)
    print(msg.content or "")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Chat with NVIDIA NIM (integrate.api.nvidia.com)",
    )
    p.add_argument(
        "prompt",
        nargs="*",
        help="User message (or pass via stdin if empty)",
    )
    p.add_argument(
        "--model",
        "-m",
        default=None,
        help=f"Model id (default: {DEFAULT_MODEL}; with --large: {LARGE_MODEL})",
    )
    p.add_argument(
        "--large",
        action="store_true",
        help=f"Use larger-context model ({LARGE_MODEL}) unless -m is set",
    )
    p.add_argument(
        "--system",
        "-S",
        default=None,
        help="System prompt (domain anchor; reduces acronym hallucination)",
    )
    p.add_argument(
        "--system-file",
        default=None,
        help="Load system prompt from a text file",
    )
    p.add_argument(
        "--preset",
        choices=sorted(PRESETS.keys()),
        default=None,
        help="Built-in system preset (e.g. tms = ANTT/CIOT/CT-e domain)",
    )
    p.add_argument(
        "--base-url",
        default=os.environ.get("NIM_BASE_URL", DEFAULT_BASE),
        help=f"OpenAI-compatible base URL (default: {DEFAULT_BASE})",
    )
    p.add_argument("--max-tokens", type=int, default=1024)
    p.add_argument("--temperature", type=float, default=0.6)
    p.add_argument("--stream", "-s", action="store_true")
    p.add_argument(
        "--no-reasoning",
        action="store_true",
        help="Hide reasoning/thinking on stderr",
    )
    p.add_argument("--min-thinking-tokens", type=int, default=None)
    p.add_argument("--max-thinking-tokens", type=int, default=None)
    p.add_argument(
        "--list-models",
        action="store_true",
        help="List models from GET /v1/models and exit",
    )
    p.add_argument(
        "--list-presets",
        action="store_true",
        help="Print built-in system presets and exit",
    )
    args = p.parse_args(argv)

    if args.list_presets:
        for name, text in PRESETS.items():
            print(f"=== {name} ===")
            print(text)
            print()
        return 0

    api_key = get_api_key()
    client = make_client(api_key, args.base_url)

    if args.list_models:
        return cmd_list_models(client)

    prompt = " ".join(args.prompt).strip()
    if not prompt:
        if sys.stdin.isatty():
            p.print_help()
            print("\nError: provide a prompt.", file=sys.stderr)
            return 2
        prompt = sys.stdin.read().strip()
    if not prompt:
        print("Error: empty prompt.", file=sys.stderr)
        return 2

    env_model = os.environ.get("NIM_MODEL")
    if args.model:
        model = args.model
    elif args.large:
        model = LARGE_MODEL
    elif env_model:
        model = env_model
    else:
        model = DEFAULT_MODEL

    system = resolve_system(
        system=args.system,
        system_file=args.system_file,
        preset=args.preset,
    )
    messages = build_messages(system, prompt)

    return cmd_chat(
        client,
        model=model,
        messages=messages,
        max_tokens=args.max_tokens,
        temperature=args.temperature,
        stream=args.stream,
        show_reasoning=not args.no_reasoning,
        min_thinking=args.min_thinking_tokens,
        max_thinking=args.max_thinking_tokens,
    )


if __name__ == "__main__":
    raise SystemExit(main())
