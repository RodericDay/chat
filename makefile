.SILENT:

deploy:
	rsync -atuc --delete --exclude=.git . lab:/lab/
	ssh lab "rsvg-convert -w 256 -h 256 /lab/static/svg/pico.svg -o /lab/static/pico.png"  # apt install librsvg2-bin
	ssh lab "cd /lab/ && docker compose stop && docker compose up -d"
