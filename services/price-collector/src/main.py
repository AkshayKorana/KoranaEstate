from __future__ import annotations

import json

from collectors.coffee_board import build_failed_output as build_coffee_board_failed_output
from collectors.coffee_board import run as run_coffee_board


def main() -> int:
    try:
        payload = run_coffee_board()
    except Exception as error:
        payload = build_coffee_board_failed_output(str(error))

    print(json.dumps(payload, ensure_ascii=False), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
