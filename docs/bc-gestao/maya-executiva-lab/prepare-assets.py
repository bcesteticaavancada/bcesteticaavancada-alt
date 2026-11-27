"""Build-time download of public engine distributions. Never takes user content."""
import argparse
import base64
import hashlib
import io
import json
import tarfile
import tempfile
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parent
assets = root / '.assets'
args = argparse.ArgumentParser()
args.add_argument('--voice', action='store_true', help='Include the Portuguese on-device ASR')
args = args.parse_args()
lock = json.loads((root / 'assets.lock.json').read_text())

def download(url):
    with urlopen(url, timeout=90) as response:
        data = response.read(100_000_001)
    if len(data) > 100_000_000:
        raise ValueError('Distribution exceeds build limit')
    return data

def install(path, data, expected=None):
    if expected and hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('SHA-256 mismatch for ' + path)
    target = assets / path
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as temp:
        temp.write(data)
    Path(temp.name).replace(target)

for name, item in lock['packages'].items():
    if item.get('optional') and not args.voice:
        continue
    data = download(f"https://registry.npmjs.org/{name}/-/{name}-{item['version']}.tgz")
    integrity = 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode()
    if integrity != item['integrity']:
        raise ValueError('Package integrity mismatch for ' + name)
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for member, output in item['files'].items():
            info = archive.getmember('package/' + member)
            if not info.isfile():
                raise ValueError('Unexpected tar entry type')
            install(output['path'], archive.extractfile(info).read(), output.get('sha256'))
for name, item in lock['models'].items():
    if not item.get('optional') or args.voice:
        install(name, download(item['url']), item['sha256'])
print('Motores locais prontos em', assets)
