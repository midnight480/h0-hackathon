.PHONY: install synth deploy diff destroy

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
