.SILENT:

test:
	docker compose run --rm chat pytest -q

deploy: static/pico.png
	rsync -atuc --delete --exclude=.git . home:/apps/chat/
	ssh home "cd /apps/chat/ && docker compose stop && docker compose up -d"

static/pico.png:
	docker compose run --rm chat rsvg-convert -w 256 -h 256 pico.svg > static/pico.png

clean:
	docker compose build
