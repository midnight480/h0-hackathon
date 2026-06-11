.PHONY: install synth deploy diff destroy frontend-install frontend-dev sync-env frontend-deploy

# CDK commands
install:
	cd src && npm install

synth:
	cd src && npx cdk synth

deploy:
	cd src && npx cdk deploy --all --require-approval never

diff:
	cd src && npx cdk diff

destroy:
	cd src && npx cdk destroy --all

# Frontend commands
frontend-install:
	cd frontend && pnpm install

frontend-dev:
	cd frontend && pnpm dev

# Vercel env sync + deploy
# Usage: make sync-env ENV=preview  (production / preview / development, default: production)
ENV ?= production
sync-env:
	@echo "Syncing .env.local to Vercel ($(ENV))..."
	@grep -v '^#' frontend/.env.local | grep -v '^$$' | while IFS='=' read -r key value; do \
		echo "  Setting $$key"; \
		vercel env rm "$$key" "$(ENV)" --yes 2>/dev/null || true; \
		printf '%s' "$$value" | vercel env add "$$key" "$(ENV)"; \
	done
	@echo "Done."

frontend-deploy:
	$(MAKE) sync-env ENV=production
	cd frontend && vercel --prod
