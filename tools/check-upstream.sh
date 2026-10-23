#!/bin/bash
# 官方 WorkBuddy 插件版本哨兵
#
# 作用：检查 npm 上 @magpie-community/opencode-workbuddy-auth 是否有比
#       本地 fork 基线（BASE）更新的版本。有更新时写状态文件 + 弹 macOS 通知。
#       只提示，不安装、不合并 —— 合并与否由用户决定。
#
# 由 ~/Library/LaunchAgents/com.qingtang.magpie-workbuddy-upstream.plist 每日拉起。

set -u

# launchd 的 PATH 只有 /usr/bin:/bin:/usr/sbin:/sbin，而 npm 的 shebang 是
# `#!/usr/bin/env node` —— 不显式补 PATH 会直接 "env: node: No such file or directory"。
export PATH="/Users/qingtang/.local/node/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

PKG="@magpie-community/opencode-workbuddy-auth"
BASE="0.1.30"                     # 本地 fork 0.1.31 所基于的官方版本
DIR="$HOME/.config/magpie/plugins/local"
STATE="$DIR/upstream-update.json"
NPM="/Users/qingtang/.local/node/bin/npm"
NODE="/Users/qingtang/.local/node/bin/node"

mkdir -p "$DIR"

LATEST=$("$NPM" view "$PKG" version 2>/dev/null | tr -d '[:space:]')
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ -z "$LATEST" ]; then
  "$NODE" -e '
    const fs=require("fs"),p=process.argv[1];
    let s={}; try{s=JSON.parse(fs.readFileSync(p,"utf8"))}catch{}
    s.checked_at=process.argv[2]; s.error="npm view failed";
    fs.writeFileSync(p,JSON.stringify(s,null,2));
  ' "$STATE" "$NOW"
  exit 0
fi

NEWER=$("$NODE" -e '
  const a=process.argv[1].split(".").map(Number);
  const b=process.argv[2].split(".").map(Number);
  for(let i=0;i<3;i++){const x=a[i]||0,y=b[i]||0;if(x!==y){console.log(x>y?"yes":"no");process.exit(0)}}
  console.log("no");
' "$LATEST" "$BASE")

ALREADY=$("$NODE" -e '
  const fs=require("fs"),p=process.argv[1];
  let s={}; try{s=JSON.parse(fs.readFileSync(p,"utf8"))}catch{}
  console.log(s.notified_version||"");
' "$STATE")

"$NODE" -e '
  const fs=require("fs"),p=process.argv[1];
  let s={}; try{s=JSON.parse(fs.readFileSync(p,"utf8"))}catch{}
  s.checked_at=process.argv[2];
  s.latest=process.argv[3];
  s.base=process.argv[4];
  s.update_available=process.argv[5]==="yes";
  s.notified_version=s.notified_version||"";
  delete s.error;
  fs.writeFileSync(p,JSON.stringify(s,null,2)+"\n");
' "$STATE" "$NOW" "$LATEST" "$BASE" "$NEWER"

if [ "$NEWER" = "yes" ] && [ "$ALREADY" != "$LATEST" ]; then
  /usr/bin/osascript -e "display notification \"官方 WorkBuddy 插件已发布 $LATEST（本地基于 $BASE + 修复）——需要合并请找小码酱\" with title \"magpie WorkBuddy 插件有更新\" sound name \"Glass\""
  "$NODE" -e '
    const fs=require("fs"),p=process.argv[1];
    let s={}; try{s=JSON.parse(fs.readFileSync(p,"utf8"))}catch{}
    s.notified_version=process.argv[2];
    fs.writeFileSync(p,JSON.stringify(s,null,2)+"\n");
  ' "$STATE" "$LATEST"
fi

exit 0
