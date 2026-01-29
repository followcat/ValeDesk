# Execution Logging

ValeDesk includes a structured logging system that records LLM execution details for debugging and optimization.

## Log Location

Logs are stored in `{app_data_dir}/logs/execution-{date}.jsonl`:
- **Linux**: `~/.config/ValeDesk/logs/execution-2026-01-29.jsonl`
- **macOS**: `~/Library/Application Support/ValeDesk/logs/execution-2026-01-29.jsonl`
- **Windows**: `%APPDATA%\ValeDesk\logs\execution-2026-01-29.jsonl`

## Log Format

Each log line is a JSON object (JSON Lines format).

### Log Types

**LLM Request**: Model, message count, tool count, attachments  
**LLM Response**: Finish reason, text/token length, tool calls, duration  
**Tool Execution**: Name, input, status, result, duration  
**Iteration**: Iteration number, cumulative tokens and elapsed time

## Usage Examples

```bash
# View today's logs
tail -f ~/.config/ValeDesk/logs/execution-$(date +%Y-%m-%d).jsonl

# Pretty-print
cat execution-2026-01-29.jsonl | jq '.'

# Filter by session
grep '"sessionId":"abc-123"' execution-2026-01-29.jsonl | jq '.'

# Analyze tool usage
jq 'select(.type=="tool_execution") | {tool: .toolName, status: .status, duration: .durationMs}' execution-2026-01-29.jsonl

# Find slow responses (>5s)
jq 'select(.type=="llm_response" and .durationMs > 5000)' execution-2026-01-29.jsonl
```

## Use Cases

- **Debugging**: Trace exact tool inputs/outputs and LLM responses
- **Performance Analysis**: Identify slow operations and token usage  
- **Cost Tracking**: Calculate API costs based on token usage
- **Model Optimization**: Analyze prompt effectiveness
- **Error Analysis**: Find common failure patterns
