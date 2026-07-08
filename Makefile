.PHONY: setup up down logs build rebuild open help

PORT ?= $(or $(DASHBOARD_PORT),3000)

help:  ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup:  ## Create required data files if they don't exist
	@mkdir -p job_scraper
	@[ -f job_scraper/seen_jobs.json ] || echo '{"seen":{}}' > job_scraper/seen_jobs.json
	@[ -f job_search_tracker.csv ] || printf 'Company,Role,Date Applied,Status,Notes\n' > job_search_tracker.csv
	@echo "Data files ready."

up: setup  ## Build (if needed) and start the dashboard in the background
	@docker compose up -d --build
	@echo "Dashboard running at http://localhost:$(PORT)"

down:  ## Stop the dashboard
	@docker compose down

logs:  ## Tail dashboard logs
	@docker compose logs -f dashboard

build:  ## Build the Docker image
	@docker compose build

rebuild:  ## Force-rebuild the image from scratch and restart
	@docker compose build --no-cache
	@docker compose up -d

open:  ## Open the dashboard in your browser
	@open http://localhost:$(PORT) 2>/dev/null || xdg-open http://localhost:$(PORT) 2>/dev/null || echo "Open http://localhost:$(PORT) in your browser"
