import re
from pathlib import Path

import psycopg2


def test_connection_is_alive():
    env_string = Path('.env').read_text()
    variables = dict(re.findall(r'^(.+)=(.+)$', env_string, flags=re.MULTILINE))
    conn_string = 'postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@lab.redsails.org:5432/{POSTGRES_DB}'
    psycopg2.connect(conn_string.format_map(variables))
