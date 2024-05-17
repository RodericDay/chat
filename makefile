.SILENT:

deploy:
	rsync -atuc --delete . lab:/lab/
	ssh lab "cd /lab/ && docker compose stop && docker compose up -d"
