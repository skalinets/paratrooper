.PHONY: build deploy commit push all dev clean test lint typecheck check serve stop

PROJECT = paratrooper
BRANCH = main
BUN = PATH="$$HOME/.bun/bin:$$PATH" bun

# Build minified, hashed bundle
build:
	$(BUN) run scripts/build.ts

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

# Dev mode - unminified, no hash, open browser
dev:
	$(BUN) run scripts/build.ts --dev
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

# Clean build artifacts
clean:
	rm -rf dist/*
