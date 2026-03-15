#!/usr/bin/env python3
"""Agent pool manager — maintains N concurrent Docker agents.

Each agent runs in a Docker container via `docker compose run --rm -d agent`.
Agents claim their own GitHub issues via AGENTS.md Step 0.
This script just manages the container lifecycle: launch, stream logs, replace
finished agents, and handle shutdown.

Usage:
    python3 scripts/launch-agents.py [-n 3]

Ctrl-C once:  drain — no new agents, running ones finish
Ctrl-C twice: stop all running containers immediately
"""

import argparse
import json
import signal
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from queue import Queue
from typing import List, Optional


@dataclass
class AgentResult:
    """Result of a finished agent container."""
    agent_id: int
    container_id: str
    exit_code: Optional[int]
    start_time: float
    end_time: float

    @property
    def duration_s(self) -> float:
        return self.end_time - self.start_time

    @property
    def ok(self) -> bool:
        return self.exit_code == 0


@dataclass
class AgentRunner:
    """Manages a single agent container: launch, log streaming, wait."""
    agent_id: int
    container_id: str
    start_time: float
    _log_thread: threading.Thread = field(repr=False, default=None)  # type: ignore[assignment]
    _wait_thread: threading.Thread = field(repr=False, default=None)  # type: ignore[assignment]

    @staticmethod
    def launch(agent_id: int, result_queue: "Queue[AgentResult]") -> "AgentRunner":
        """Launch a new agent container and start log/wait threads."""
        proc = subprocess.run(
            ["docker", "compose", "run", "--rm", "-d", "agent"],
            capture_output=True, text=True, check=True,
        )
        container_id = proc.stdout.strip()
        start_time = time.time()
        runner = AgentRunner(
            agent_id=agent_id,
            container_id=container_id,
            start_time=start_time,
        )
        runner._start_threads(result_queue)
        return runner

    def _start_threads(self, result_queue: "Queue[AgentResult]") -> None:
        self._log_thread = threading.Thread(
            target=self._stream_logs, daemon=True, name=f"logs-{self.agent_id}",
        )
        self._wait_thread = threading.Thread(
            target=self._wait_and_report, args=(result_queue,),
            daemon=True, name=f"wait-{self.agent_id}",
        )
        self._log_thread.start()
        self._wait_thread.start()

    def _stream_logs(self) -> None:
        """Stream docker logs, parsing stream-json from Claude Code into readable output."""
        try:
            proc = subprocess.Popen(
                ["docker", "logs", "--follow", self.container_id],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            )
            prefix = f"[agent-{self.agent_id}]"
            for line in proc.stdout:  # type: ignore[union-attr]
                formatted = _format_stream_line(line.rstrip("\n"))
                if formatted is not None:
                    for fline in formatted:
                        print(f"{prefix} {fline}", flush=True)
            proc.wait()
        except Exception:
            pass  # container gone — expected on shutdown

    def _wait_and_report(self, result_queue: "Queue[AgentResult]") -> None:
        """Block on docker wait, then push result to the shared queue.

        If the docker-wait subprocess is interrupted (e.g. by SIGINT during
        drain), retry until the container actually exits.  This prevents
        reporting running containers as "FAILED (exit None)".
        """
        exit_code: Optional[int] = None
        while True:
            try:
                proc = subprocess.run(
                    ["docker", "wait", self.container_id],
                    capture_output=True, text=True,
                )
                if proc.returncode == 0 and proc.stdout.strip():
                    exit_code = int(proc.stdout.strip())
                    break
                # docker wait returned but with no useful output (signal
                # interrupted it) — check if container is still running
                if not self._is_running():
                    exit_code = self._inspect_exit_code()
                    break
                # Container still running, retry docker wait
                time.sleep(0.5)
            except Exception:
                if not self._is_running():
                    exit_code = self._inspect_exit_code()
                    break
                time.sleep(0.5)

        result_queue.put(AgentResult(
            agent_id=self.agent_id,
            container_id=self.container_id,
            exit_code=exit_code,
            start_time=self.start_time,
            end_time=time.time(),
        ))

    def _is_running(self) -> bool:
        """Check if the container is still running."""
        try:
            proc = subprocess.run(
                ["docker", "inspect", "-f", "{{.State.Running}}", self.container_id],
                capture_output=True, text=True, timeout=5,
            )
            return proc.returncode == 0 and proc.stdout.strip() == "true"
        except Exception:
            return False

    def _inspect_exit_code(self) -> Optional[int]:
        """Retrieve exit code from a stopped container."""
        try:
            proc = subprocess.run(
                ["docker", "inspect", "-f", "{{.State.ExitCode}}", self.container_id],
                capture_output=True, text=True, timeout=5,
            )
            if proc.returncode == 0 and proc.stdout.strip():
                return int(proc.stdout.strip())
        except Exception:
            pass
        return None

    def stop(self) -> None:
        """Send docker stop to this container."""
        subprocess.run(
            ["docker", "stop", self.container_id],
            capture_output=True, timeout=30,
        )

    @property
    def short_id(self) -> str:
        return self.container_id[:12]


def _format_stream_line(line: str) -> Optional[List[str]]:
    """Parse a line from docker logs and return readable output lines.

    Lines before Claude Code starts (git clone, npm install) are plain text.
    Once Claude Code starts, lines are newline-delimited JSON (stream-json format).
    Returns None to suppress a line entirely.
    """
    if not line:
        return None

    try:
        event = json.loads(line)
    except (json.JSONDecodeError, ValueError):
        # Not JSON — pre-Claude-Code output (git clone, npm install, etc.)
        return [line]

    etype = event.get("type")

    if etype == "system":
        subtype = event.get("subtype", "")
        if subtype == "init":
            return ["--- Claude Code session started ---"]
        return None

    if etype == "assistant":
        lines = []
        for block in event.get("message", {}).get("content", []):
            if block.get("type") == "text":
                text = block.get("text", "").strip()
                if text:
                    lines.append(text)
            elif block.get("type") == "tool_use":
                name = block.get("name", "?")
                inp = block.get("input", {})
                summary = _summarize_tool_input(name, inp)
                lines.append(f">>> {name}: {summary}")
        return lines if lines else None

    if etype == "user":
        lines = []
        for block in event.get("message", {}).get("content", []):
            if block.get("type") == "tool_result":
                content = block.get("content", "")
                if isinstance(content, str):
                    trimmed = content.strip()
                    if trimmed:
                        # Show first 3 lines of tool output
                        output_lines = trimmed.split("\n")
                        if len(output_lines) > 3:
                            for ol in output_lines[:3]:
                                lines.append(f"    {ol}")
                            lines.append(f"    ... ({len(output_lines) - 3} more lines)")
                        else:
                            for ol in output_lines:
                                lines.append(f"    {ol}")
        return lines if lines else None

    if etype == "result":
        subtype = event.get("subtype", "")
        cost = event.get("total_cost_usd")
        turns = event.get("num_turns")
        parts = ["--- Claude Code session ended"]
        if subtype:
            parts[0] += f" ({subtype})"
        if cost is not None:
            parts.append(f"    cost: ${cost:.4f}")
        if turns is not None:
            parts.append(f"    turns: {turns}")
        parts[0] += " ---"
        return parts

    # Unknown event type — skip
    return None


def _summarize_tool_input(name: str, inp: dict) -> str:  # type: ignore[type-arg]
    """Produce a short summary of a tool call's input."""
    if name == "Bash":
        return inp.get("command", "")[:200]
    if name in ("Read", "Write"):
        return inp.get("file_path", "")
    if name == "Edit":
        path = inp.get("file_path", "")
        old = inp.get("old_string", "")
        preview = old[:60].replace("\n", "\\n")
        return f"{path} (replacing '{preview}...')" if len(old) > 60 else f"{path}"
    if name in ("Glob", "Grep"):
        pattern = inp.get("pattern", "")
        return pattern
    if name == "Agent":
        return inp.get("description", "")[:100]
    # Fallback: dump keys
    return ", ".join(f"{k}=..." for k in list(inp.keys())[:3])


class PoolSupervisor:
    """Maintains a pool of N concurrent agent containers."""

    REPO = "sam0109/chem_sim"

    def __init__(self, pool_size: int) -> None:
        self.pool_size = pool_size
        self.result_queue: Queue[AgentResult] = Queue()
        self.runners: List[AgentRunner] = []
        self.results: List[AgentResult] = []
        self.next_agent_id = 1
        self.draining = False

    # --- Startup checks ---

    def preflight(self) -> bool:
        """Verify prerequisites. Returns True if all checks pass."""
        ok = True

        # gh auth
        proc = subprocess.run(
            ["gh", "auth", "status"], capture_output=True, text=True,
        )
        if proc.returncode != 0:
            print("ERROR: gh auth status failed. Run `gh auth login` first.")
            print(proc.stderr)
            ok = False

        # docker compose config
        proc = subprocess.run(
            ["docker", "compose", "config", "--quiet"], capture_output=True, text=True,
        )
        if proc.returncode != 0:
            print("ERROR: docker compose config failed. Check docker-compose.yml.")
            print(proc.stderr)
            ok = False

        return ok

    def build_image(self) -> bool:
        """Pre-build the agent image. Returns True on success."""
        print("Building agent image...")
        proc = subprocess.run(
            ["docker", "compose", "build", "agent"],
            text=True,
        )
        if proc.returncode != 0:
            print("ERROR: docker compose build agent failed.")
            return False
        print("Image ready.")
        return True

    # --- Issue checking ---

    def unclaimed_issue_count(self) -> int:
        """Return the number of open, unassigned issues."""
        proc = subprocess.run(
            ["gh", "issue", "list", "--repo", self.REPO,
             "--assignee", "", "--state", "open",
             "--json", "number", "--jq", "length"],
            capture_output=True, text=True,
        )
        if proc.returncode != 0:
            return 0
        try:
            return int(proc.stdout.strip())
        except ValueError:
            return 0

    # --- Pool management ---

    def _launch_one(self) -> None:
        """Launch a single agent and add it to the pool."""
        aid = self.next_agent_id
        self.next_agent_id += 1
        print(f"Launching agent-{aid}...")
        try:
            runner = AgentRunner.launch(aid, self.result_queue)
        except subprocess.CalledProcessError as e:
            print(f"ERROR: Failed to launch agent-{aid}: {e.stderr}")
            return
        self.runners.append(runner)
        print(f"  agent-{aid} → container {runner.short_id}")

    def _fill_pool(self) -> None:
        """Launch agents until the pool is full."""
        while len(self.runners) < self.pool_size and not self.draining:
            available = self.unclaimed_issue_count()
            if available == 0:
                print("No open unclaimed issues — stopping launches.")
                self.draining = True
                break
            self._launch_one()

    def _remove_runner(self, container_id: str) -> None:
        """Remove a finished runner from the active list."""
        self.runners = [r for r in self.runners if r.container_id != container_id]

    def run(self) -> None:
        """Main loop: fill pool, wait for finishes, replace."""
        self._fill_pool()

        while self.runners:
            # Block until any agent finishes
            result = self.result_queue.get()
            self.results.append(result)
            self._remove_runner(result.container_id)

            status = "OK" if result.ok else f"FAILED (exit {result.exit_code})"
            duration = format_duration(result.duration_s)
            print(f"\nagent-{result.agent_id} finished: {status} ({duration})")
            print(f"  Active agents: {len(self.runners)}")

            # Replace the finished agent if not draining
            if not self.draining:
                available = self.unclaimed_issue_count()
                if available > 0:
                    print(f"  {available} unclaimed issue(s) remain — launching replacement...")
                    self._launch_one()
                else:
                    print("  No unclaimed issues remain — draining.")
                    self.draining = True

    def stop_all(self) -> None:
        """Stop all running containers."""
        print("\nStopping all running containers...")
        threads = []
        for runner in self.runners:
            print(f"  Stopping agent-{runner.agent_id} ({runner.short_id})...")
            t = threading.Thread(target=runner.stop, daemon=True)
            t.start()
            threads.append(t)
        for t in threads:
            t.join(timeout=35)
        print("All containers stopped.")

    def print_summary(self) -> None:
        """Print an exit summary table."""
        if not self.results:
            print("\nNo agents were run.")
            return

        print("\n" + "=" * 60)
        print("  AGENT POOL SUMMARY")
        print("=" * 60)
        print(f"  {'Agent':<10} {'Container':<14} {'Status':<18} {'Duration'}")
        print(f"  {'-'*10} {'-'*14} {'-'*18} {'-'*10}")
        ok_count = 0
        for r in self.results:
            status = "OK" if r.ok else f"FAILED ({r.exit_code})"
            if r.ok:
                ok_count += 1
            print(f"  agent-{r.agent_id:<4} {r.container_id[:12]:<14} {status:<18} {format_duration(r.duration_s)}")
        print(f"  {'-'*10} {'-'*14} {'-'*18} {'-'*10}")
        total = len(self.results)
        print(f"  {ok_count}/{total} succeeded, {total - ok_count} failed")
        print("=" * 60)


def format_duration(seconds: float) -> str:
    """Format seconds into a human-readable duration string."""
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}h {m}m {s}s"
    if m > 0:
        return f"{m}m {s}s"
    return f"{s}s"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Maintain a pool of N concurrent Docker agents.",
    )
    parser.add_argument(
        "-n", type=int, default=3,
        help="Number of concurrent agents to maintain (default: 3)",
    )
    args = parser.parse_args()

    supervisor = PoolSupervisor(pool_size=args.n)

    # Signal handling: first Ctrl-C drains, second stops all containers
    def handle_signal(signum: int, frame: object) -> None:
        if supervisor.draining:
            # Second interrupt — force stop
            supervisor.stop_all()
            supervisor.print_summary()
            sys.exit(1)
        else:
            print("\n\nInterrupt received — draining (no new agents).")
            print("Running agents will finish. Press Ctrl-C again to stop them.")
            supervisor.draining = True

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    # Preflight checks
    if not supervisor.preflight():
        sys.exit(1)

    if not supervisor.build_image():
        sys.exit(1)

    print(f"\nStarting agent pool (max {args.n} concurrent)...\n")
    supervisor.run()
    supervisor.print_summary()


if __name__ == "__main__":
    main()
