#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

git pull -q --ff-only
if [ -d .tele ]; then
  git -C .tele fetch -q --depth 1 origin main
  git -C .tele reset -q --hard FETCH_HEAD
else
  git clone -q --depth 1 https://github.com/nitreojs/tele .tele
fi
latest=$(curl -fsS https://api.github.com/repos/nitreojs/tele/releases/latest | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p')
stamp="$(git rev-parse HEAD) $(git -C .tele rev-parse HEAD) $latest"
if [ "${1:-}" != "--force" ] && [ -f .stamp ] && [ "$(cat .stamp)" = "$stamp" ]; then
  exit 0
fi

rm -rf .dist-next
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/app" -w /app node:22-slim \
  sh -c 'yarn install --frozen-lockfile --silent && yarn build --outDir .dist-next --emptyOutDir'
rm -rf dist.old
[ -d dist ] && mv dist dist.old
mv .dist-next dist
rm -rf dist.old
echo "$stamp" > .stamp
echo "$(date -u +%FT%TZ) deployed $stamp"
