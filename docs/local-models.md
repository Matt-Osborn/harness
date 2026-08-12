# Local Models

Set up local inference engines (Ollama, llama.cpp) and connect them to
harness. No API keys, no internet required after the model is downloaded.

## When to use this

You want to run models on your own hardware — for privacy, offline work,
cost savings, or experimentation. Local models are configured identically
to remote providers via the same `base_url` + `kind` pattern.

## Ollama

### 1. Install Ollama

```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# macOS
brew install ollama

# Windows — download from https://ollama.com/download
```

### 2. Pull a model

```bash
ollama pull qwen2.5-coder:7b
```

### 3. Start the server

```bash
ollama serve
```

Ollama runs on `http://localhost:11434` by default.

### 4. Add to harness

```bash
harness model add
```

Select **Ollama** from the local providers section. You'll be prompted for:

- **Name** — a label for this model config (e.g. `qwen-local`)
- **Model name** — the Ollama model tag (e.g. `qwen2.5-coder:7b`)

Or add it manually to `~/.harness/config.toml`:

```toml
[model.qwen-local]
model = "qwen2.5-coder:7b"
base_url = "http://localhost:11434/v1"
name = "Qwen Local"
kind = "openai-compatible"
```

### 5. Make it the default

```bash
harness default model qwen-local
```

Now `harness` will use your local Qwen by default.

## llama.cpp

### 1. Install llama.cpp

```bash
# Clone and build
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
cmake -B build
cmake --build build --config Release

# Or via package managers
brew install llama.cpp        # macOS
```

### 2. Download a model

GGUF-format models are available on Hugging Face:

```bash
# Example: Qwen 2.5 Coder 7B (Q4_K_M quantized)
wget -O models/qwen2.5-coder-7b-q4.gguf \
  https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf
```

### 3. Start the server

```bash
./build/bin/llama-server -m models/qwen2.5-coder-7b-q4.gguf --port 8080
```

The server runs on `http://localhost:8080/v1` by default.

### 4. Add to harness

```bash
harness model add
```

Select **llama.cpp** from the local providers section, or add manually:

```toml
[model.llama-local]
model = "qwen2.5-coder-7b-q4"
base_url = "http://localhost:8080/v1"
name = "Llama.cpp Qwen"
kind = "openai-compatible"
```

### 5. Make it the default

```bash
harness default model llama-local
```

## Using local models

Once configured, local models work identically to remote ones:

```bash
harness                              # interactive (uses default model)
harness -m qwen-local "explain this" # print mode with specific model
harness --model qwen-local           # interactive with specific model
```

### Switching mid-session

In interactive mode, local models are listed in the model config alongside
remote providers. Use `/model` to switch between them (requires the `/model`
slash command, planned for v0.3).

### Troubleshooting: CUDA Out of Memory

Ollama keeps models loaded in GPU VRAM between requests. If you see:

```
cudaMalloc failed: out of memory
```

The GPU doesn't have enough free VRAM for a new model. Ollama is still
holding a previous model in memory.

| Command | What it does |
|---|---|
| `ollama ps` | List models currently loaded in VRAM |
| `ollama stop <name>` | Unload a specific model from VRAM |
| `OLLAMA_KEEP_ALIVE=0 harness` | Start harness without keeping models loaded |
| `export OLLAMA_KEEP_ALIVE=0` | Persist in `~/.bashrc` — never keep models loaded |

Set `OLLAMA_KEEP_ALIVE` to control how long models stay loaded:

```bash
export OLLAMA_KEEP_ALIVE=0      # unload immediately (max free VRAM)
export OLLAMA_KEEP_ALIVE=5m     # unload after 5 minutes
export OLLAMA_KEEP_ALIVE=-1     # keep loaded indefinitely (default)
```

Add the export to your `~/.bashrc` or `~/.zshrc` to make it permanent:

```bash
echo 'export OLLAMA_KEEP_ALIVE=0' >> ~/.bashrc
```

## Related

- `help/init.md` — first-time setup also detects running local providers
- `docs/multi-provider.md` — combine local and remote models
- `man harness` — all flags, commands, and config options