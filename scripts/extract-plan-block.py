"""Copy the first fenced code block that follows a marker line in the plan into a file.
usage: extract.py PLAN MARKER OUT [--append] [--nth N]"""
import sys, io
plan, marker, out = sys.argv[1], sys.argv[2], sys.argv[3]
append = "--append" in sys.argv
nth = int(sys.argv[sys.argv.index("--nth") + 1]) if "--nth" in sys.argv else 1
lines = io.open(plan, encoding="utf-8").read().split("\n")
idx = next(i for i, l in enumerate(lines) if marker in l)
found = 0
i = idx + 1
while i < len(lines):
    if lines[i].lstrip().startswith("```") and lines[i].strip() != "```":
        found += 1
        fence = lines[i][: len(lines[i]) - len(lines[i].lstrip())] + lines[i].lstrip()[:3]
        j = i + 1
        body = []
        while not lines[j].strip().startswith("```") or lines[j].strip() != "```":
            body.append(lines[j]); j += 1
        if found == nth:
            text = "\n".join(body) + "\n"
            with io.open(out, "a" if append else "w", encoding="utf-8", newline="\n") as f:
                if append: f.write("\n")
                f.write(text)
            print(f"wrote {len(body)} lines -> {out}")
            sys.exit(0)
        i = j + 1
        continue
    i += 1
sys.exit(f"no code block after marker: {marker}")
