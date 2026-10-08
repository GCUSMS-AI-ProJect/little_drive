#!/usr/bin/env python3
"""Publish this checkout to the Share driving demo, without modifying Share pages."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().parents[1]


def publish(target):
    target = target.resolve()
    if target == SOURCE or SOURCE in target.parents:
        raise ValueError('Publish destination must be outside the source checkout')
    html = (SOURCE / 'index.html').read_text()
    references = re.findall(r'(?:src|href)="(assets/[^"?#]+)', html)
    if not references or any(not (SOURCE / path).is_file() for path in references):
        raise ValueError('The project has missing HTML assets')
    node = shutil.which('node')
    if not node:
        candidates = sorted((Path.home() / '.nvm/versions/node').glob('*/bin/node'))
        node = str(candidates[-1]) if candidates else None
    if not node:
        raise ValueError('Node.js 20 or newer is required to run the pre-publish checks')
    subprocess.run([node, str(SOURCE / 'tests/traffic.mjs')], check=True)
    subprocess.run([node, str(SOURCE / 'tests/collision.mjs')], check=True)
    files = sorted(path for path in (SOURCE / 'assets').rglob('*') if path.is_file())
    if any(path.is_symlink() for path in files):
        raise ValueError('Symbolic links are not publishable assets')
    version = hashlib.sha256(b''.join(path.read_bytes() for path in files) + html.encode()).hexdigest()[:12]
    traffic = next(path for path in files if path.name == 'car-traffic.js')
    html = html.replace('"assets/', '"../assets/')
    html = re.sub(r'(../assets/[^"?#]+)(?:\?v=[^"#]+)?', lambda m: m[1] + '?v=' + version, html)
    target.mkdir(parents=True, exist_ok=True)
    (target / 'demos').mkdir(exist_ok=True)
    for source in files:
        destination = target / source.relative_to(SOURCE)
        destination.parent.mkdir(parents=True, exist_ok=True)
        content = source.read_bytes()
        if source.suffix == '.js' and source.parent == SOURCE / 'assets':
            content = re.sub(rb"(car-[a-z-]+\.js)(?:\?v=[^']+)?", lambda match: match[1] + ('?v=' + version).encode(), content)
        if source.name == 'car.css':
            content = re.sub(rb'(fonts/car-songti-[^)?]+\.woff2)(?:\?v=[^)]*)?', lambda match: match[1] + ('?v=' + version).encode(), content)
        # Replace each file atomically; assets are in place before the new HTML.
        with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as handle:
            handle.write(content)
            temporary = handle.name
        os.replace(temporary, destination)
        os.chmod(destination, 0o644)
    destination = target / 'demos/car.html'
    with tempfile.NamedTemporaryFile(dir=destination.parent, mode='w', delete=False) as handle:
        handle.write(html)
        temporary = handle.name
    os.replace(temporary, destination)
    os.chmod(destination, 0o644)
    print(json.dumps({'published': str(destination), 'version': version, 'assets': len(files)}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', type=Path, default=Path('/home/ubuntu/pi-web/shop'))
    publish(parser.parse_args().target)
