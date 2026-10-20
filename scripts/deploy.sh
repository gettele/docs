#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
exec 9>.deploy.lock
flock 9

git pull -q --ff-only
if [ -d .tele ]; then
  git -C .tele fetch -q --depth 1 origin main
  git -C .tele reset -q --hard FETCH_HEAD
else
  git clone -q --depth 1 https://github.com/nitreojs/tele .tele
fi
release=$(curl -fsS https://api.github.com/repos/nitreojs/tele/releases/latest)
latest=$(printf '%s\n' "$release" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p')
files=$(printf '%s\n' "$release" | grep -o '"digest": *"[^"]*"' | sort | sha256sum | cut -c1-16)
stamp="$(git rev-parse HEAD) $(git -C .tele rev-parse HEAD) $latest $files"
if [ "${1:-}" != "--force" ] && [ -f .stamp ] && [ "$(cat .stamp)" = "$stamp" ]; then
  exit 0
fi

rm -rf .dist-next
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/app" -w /app node:22-slim \
  sh -c 'yarn install --frozen-lockfile --silent && yarn build --outDir .dist-next --emptyOutDir'
rm -rf dist.old
if [ -d dist ]; then mv dist dist.old; fi
mv .dist-next dist
rm -rf dist.old
echo "$stamp" > .stamp
echo "$(date -u +%FT%TZ) deployed $stamp"
