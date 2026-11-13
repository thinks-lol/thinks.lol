# Runtime files of the Hexfield instrument, published at /hexfield/.
# The source of truth is the hexfield submodule; tests, docs and repo metadata
# are deliberately not published.
HEXFIELD_FILES = index.html style.css app.js music.js engine.js serial.js \
                 midi-worklet.js icon.svg manifest.webmanifest

publish-hexfield:
	@test -f hexfield/index.html || \
		{ echo "hexfield submodule missing: git submodule update --init"; exit 1; }
	@mkdir -p public/hexfield
	cp $(addprefix hexfield/,$(HEXFIELD_FILES)) public/hexfield/
	@echo "published /hexfield/ ($$(ls public/hexfield | wc -l) files)"

# Build the Hugo site
build:
	hugo
	$(MAKE) publish-hexfield

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
	$(MAKE) publish-hexfield
