.PHONY: build deploy commit push all dev clean test lint check serve stop

PROJECT = paratrooper
BRANCH = main
BUN = PATH="$$HOME/.bun/bin:$$PATH" bun

# Build minified bundle
build:
	$(BUN) build src/main.js --outdir dist --minify
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

# Lint + test
check: lint test

# Dev mode - build and open
dev:
	$(BUN) build src/main.js --outdir dist
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

# Clean build artifacts
clean:
	rm -rf dist/*
