# Build the Hugo site
build:
	hugo

# Serve the Hugo site locally with drafts and future posts
serve:
	hugo serve --buildDrafts --buildFuture

# Clean, update, and tidy Hugo modules
getmodules:
	hugo mod clean --all && hugo mod get -u ./... && hugo mod tidy

# Preview the site with production settings
preview: 
	hugo server --disableFastRender --navigateToChanged --watch --forceSyncStatic -e production --minify

# Development build with template metrics
dev:
	hugo server --disableFastRender --navigateToChanged --templateMetrics --templateMetricsHints --watch --forceSyncStatic

prod_build_verbose: getmodules
	hugo --cleanDestinationDir --templateMetrics --templateMetricsHints --minify --forceSyncStatic --gc --logLevel info

# Build the site with production settings and optimizations
prod_build: getmodules
	hugo --cleanDestinationDir --minify --forceSyncStatic --gc --logLevel info
