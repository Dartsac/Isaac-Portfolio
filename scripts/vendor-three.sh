#!/bin/sh
# Refreshes the copy of three.js the Intro's 3D scene loads (ADR 0002), from the version of @types/three
# in package.json so that the site's scripts are typechecked against the same version they run.
# three.js stopped publishing minified builds, so its two ES modules are minified once here, with no
# bundling, and the site itself still has no build step. Run from the repository root, then commit js/vendor/three/.
set -eu

version=$(node -p "require('@types/three/package.json').version")
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

(cd "$work" && npm pack --silent "three@$version" >/dev/null && tar xzf "three-$version.tgz")
out=js/vendor/three
mkdir -p "$out"
npx --yes esbuild@0.25.0 "$work/package/build/three.core.js" --minify --format=esm --log-level=warning \
  --outfile="$out/three.core.min.js"
npx --yes esbuild@0.25.0 "$work/package/build/three.module.js" --minify --format=esm --log-level=warning \
  --outfile="$out/three.module.min.js"
# three.module.js imports the core by its unminified name.
sed -i.bak 's#"./three.core.js"#"./three.core.min.js"#g' "$out/three.module.min.js" && rm "$out/three.module.min.js.bak"
cp "$work/package/LICENSE" "$out/LICENSE"
echo "three.js $version copied to $out"
