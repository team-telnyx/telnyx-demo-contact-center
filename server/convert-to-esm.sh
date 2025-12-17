#!/bin/bash

# Convert CommonJS require/module.exports to ES modules

# List of files to convert
files=(
  "routes/inboundVoiceRoutes.js"
  "routes/outboundVoiceRoutes.js"
  "routes/telnyxRoutes.js"
  "routes/websocket.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Converting $file..."
    
    # Backup original
    cp "$file" "$file.backup"
    
    # Convert require statements
    sed -i '' "s/const express = require('express')/import express from 'express'/g" "$file"
    sed -i '' "s/const { /import { /g" "$file"
    sed -i '' "s/ } = require('/} from '/g" "$file"
    sed -i '' "s/const .* = require('/import & from '/g" "$file"
    sed -i '' "s/require('/import '/g" "$file"
    
    # Convert module.exports
    sed -i '' 's/module\.exports = /export default /g' "$file"
    sed -i '' 's/module\.exports\.default = /export default /g' "$file"
    
    # Add .js extensions to local imports
    sed -i '' "s/from '\\.\\.\\//from '\\.\\.\\/'/g" "$file"
    sed -i '' "s/from '\\.\\/'/from '\\.\\//g" "$file"
    
    echo "Converted $file"
  fi
done

echo "Conversion complete!"
