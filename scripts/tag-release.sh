#!/usr/bin/env bash

# 从 package.json 读取版本，创建并推送不可覆盖的发布 tag。
# 使用：./scripts/tag-release.sh [版本号]

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  printf '用法: %s [版本号]\n' "$0"
  printf '示例: %s 1.0.9\n' "$0"
  exit 0
fi

if [[ "$#" -gt 1 ]]; then
  echo "错误：只接受一个版本号参数。" >&2
  exit 2
fi

PACKAGE_VERSION="$(node -p "require('./package.json').version")"
VERSION="${1:-$PACKAGE_VERSION}"
VERSION="${VERSION#v}"
TAG="v$VERSION"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "错误：版本号格式无效：$VERSION" >&2
  exit 2
fi

if [[ "$VERSION" != "$PACKAGE_VERSION" ]]; then
  echo "错误：版本号与 package.json 不一致。" >&2
  echo "  package.json: $PACKAGE_VERSION" >&2
  echo "  requested:    $VERSION" >&2
  echo "请先更新 package.json，再运行此脚本。" >&2
  exit 2
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "错误：工作区有未提交改动，请先提交后再打 tag。" >&2
  git status --short >&2
  exit 1
fi

REMOTE="${RELEASE_REMOTE:-origin}"
if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "错误：找不到 Git remote：$REMOTE" >&2
  exit 1
fi

if git rev-parse --verify --quiet "refs/tags/$TAG" >/dev/null; then
  echo "错误：本地 tag 已存在：$TAG" >&2
  exit 1
fi

if git ls-remote --exit-code --tags "$REMOTE" "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "错误：远端 tag 已存在：$REMOTE/$TAG" >&2
  exit 1
fi

CURRENT_COMMIT="$(git rev-parse --short HEAD)"
echo "创建 $TAG -> $CURRENT_COMMIT"
git tag -a "$TAG" -m "Release $TAG"
git push "$REMOTE" "$TAG"
echo "完成：$REMOTE/$TAG 已推送，tag workflow 将自动开始构建。"
