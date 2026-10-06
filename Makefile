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
# 本番(production)は .env (Clerk Production キー)、
# preview/development は .env.local (Clerk Development キー) を使う。
# ※ いずれも frontend/ 配下。vercel コマンドはリンク済みの frontend/ 内で実行する。
# Usage:
#   make sync-env                                  # production <- frontend/.env
#   make sync-env ENV=preview ENV_FILE=.env.local  # preview <- frontend/.env.local
ENV ?= production
ENV_FILE ?= .env
sync-env:
	@echo "Syncing frontend/$(ENV_FILE) to Vercel ($(ENV))..."
	@cd frontend && grep -v '^#' "$(ENV_FILE)" | grep -v '^$$' | while IFS='=' read -r key value; do \
		echo "  Setting $$key"; \
		vercel env rm "$$key" "$(ENV)" --yes 2>/dev/null || true; \
		printf '%s' "$$value" | vercel env add "$$key" "$(ENV)"; \
	done
	@echo "Done."

frontend-deploy:
	$(MAKE) sync-env ENV=production ENV_FILE=.env
	vercel --prod --yes
