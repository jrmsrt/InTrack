import json
from contextlib import contextmanager
from typing import Any, Iterator

import pymysql
from pymysql.connections import Connection
from pymysql.cursors import DictCursor

from ..config import get_settings


def connect() -> Connection:
    settings = get_settings()
    return pymysql.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        cursorclass=DictCursor,
        autocommit=False,
        charset="utf8mb4",
    )


@contextmanager
def db_connection() -> Iterator[Connection]:
    connection = connect()
    try:
        yield connection
    finally:
        connection.close()


def parse_json_column(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8")
    if isinstance(value, str):
        return json.loads(value)
    return value


def get_state(state_key: str) -> dict[str, Any] | None:
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT state_json FROM app_state WHERE state_key = %s", (state_key,))
            row = cursor.fetchone()

    if not row:
        return None

    return parse_json_column(row["state_json"])


def save_state(state_key: str, state_json: dict[str, Any]) -> None:
    payload = json.dumps(state_json)

    with db_connection() as connection:
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO app_state (state_key, state_json)
                    VALUES (%s, CAST(%s AS JSON))
                    ON DUPLICATE KEY UPDATE state_json = VALUES(state_json)
                    """,
                    (state_key, payload),
                )
                cursor.execute(
                    "INSERT INTO audit_log (state_key, action) VALUES (%s, %s)",
                    (state_key, "save"),
                )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
