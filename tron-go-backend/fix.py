
import os, glob
for path in glob.glob("**/*.go", recursive=True):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    new_content = content.replace("\"\`n\`t\"", "\"\n\t\"")
    if content != new_content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)

