"""Gera public/app.html a partir de src/app.html (o mesmo código do artifact do Claude)."""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
app = (root / "src/app.html").read_text(encoding="utf-8")
head = ('<!doctype html><html lang="pt-PT"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="robots" content="noindex"><link rel="icon" href="data:,">'
        '<script src="/adapter.js"></script></head><body>')
(root / "public/app.html").write_text(head + app + "</body></html>", encoding="utf-8")
(root / "public/adapter.js").write_text((root / "web/adapter.js").read_text(encoding="utf-8"), encoding="utf-8")
(root / "public/membro.html").write_text((root / "src/membro.html").read_text(encoding="utf-8"), encoding="utf-8")
print("public/app.html", len(head) + len(app))
