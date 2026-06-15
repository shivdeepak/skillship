---
name: block-scalar
description: >-
  This description uses a folded block scalar so it spans multiple lines in the
  source but folds to a single line under two hundred characters total.
license: MIT
metadata:
  version: "1.0.0" # x-release-please-version
  author: test-suite
---

# block-scalar

Proves the parser handles `>-` block scalars and nested `metadata:` maps without
mis-joining the folded description into the following key.
