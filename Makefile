.PHONY: build deploy commit push all dev clean test lint typecheck check serve stop sandbox sandbox-deps sandbox-train sandbox-tune

PROJECT = paratrooper
BRANCH = main
BUN = PATH="$$HOME/.bun/bin:$$PATH" bun

# Build minified bundle
build:
	$(BUN) build src/main.ts --outdir dist --minify
	cp src/index.html dist/index.html

# Deploy dist/ to Cloudflare Pages
deploy: build
	wrangler pages deploy dist --project-name $(PROJECT) --branch $(BRANCH) --commit-dirty=true

# Run tests
test:
	$(BUN) test

# Lint with oxlint
lint:
	npx oxlint src/

# Type-check
typecheck:
	$(BUN) tsc --noEmit

# Lint + typecheck + test
check: lint typecheck test

# Dev mode - build and open
dev:
	$(BUN) build src/main.ts --outdir dist
	cp src/index.html dist/index.html
	open dist/index.html

# Commit all changes
commit:
	git add src/ dist/ package.json Makefile GAME.md index.html
	git commit -m "Update game"

# Push to GitHub
push:
	git push origin $(BRANCH)

# Build, commit, push, and deploy
all: build commit push deploy

# Local server via Docker Compose (http://localhost:8080)
serve: build
	docker compose up -d
	@echo "Game running at http://localhost:3000"

# Stop local server
stop:
	docker compose down

# Start sandbox WebSocket server (default port 8080)
sandbox:
	$(BUN) run sandbox/server.ts $(or $(PORT),9346)

# Install Python dependencies for sandbox
sandbox-deps:
	pip install -r sandbox/python/requirements.txt

# Run PPO training demo (start sandbox server first with `make sandbox`)
sandbox-train:
	python sandbox/python/train_ppo.py --no-auto-server --port $(or $(PORT),9346)

# Run parameter sweep demo (start sandbox server first with `make sandbox`)
sandbox-tune:
	python sandbox/python/tune_params.py --no-auto-server --port $(or $(PORT),9346)

# Clean build artifacts
clean:
	rm -rf dist/*
