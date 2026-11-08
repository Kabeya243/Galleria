"""Publication feed — API tests (chantier 5/5).

Port of the 7 scaffold tests (~/workspace/drive-homepage-explore/tests/)
plus the SANAA status/visibility tests, adapted to the integrated app
(api/index.py) and to the REAL Prisma schema:

- Exhibition: id, title, slug, ownerId, status, visibility
  (the scaffold fixture used userId + status "published" — neither exists
  in SANAA: the owner column is ownerId, and a published exhibition has
  status "public" AND visibility "public").
- User: id, name (no avatarUrl column in Prisma).

SANAA publication rule (see api/source_schema.py): an exhibition reaches
the feed only when status == "public" AND visibility == "public".

Run from the repo root with the feed test venv:
    ~/workspace/.venv-sanaa-feed/bin/python -m pytest -q
(or: python -m venv .venv-feed && pip install -r api/requirements.txt pytest httpx)
"""
