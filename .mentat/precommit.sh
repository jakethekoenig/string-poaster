#!/bin/bash

# Install formatting and linting tools if they don't exist
if ! [ -x "$(command -v eslint)" ]; then
  echo "Installing ESLint..."
  npm install -g eslint prettier eslint-config-prettier eslint-plugin-prettier
fi

if ! [ -x "$(command -v flake8)" ]; then
  echo "Installing Python linting tools..."
  pip3 install flake8 black
fi

# Create ESLint config if it doesn't exist
if [ ! -f ".eslintrc.json" ]; then
  echo "Creating ESLint configuration..."
  cat > .eslintrc.json << EOF
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": ["eslint:recommended", "prettier"],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "plugins": ["prettier"],
  "rules": {
    "prettier/prettier": "error"
  }
}
EOF
fi

# Create Prettier config if it doesn't exist
if [ ! -f ".prettierrc.json" ]; then
  echo "Creating Prettier configuration..."
  cat > .prettierrc.json << EOF
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100
}
EOF
fi

# Create Python formatting config if it doesn't exist
if [ ! -f "pyproject.toml" ]; then
  echo "Creating Black configuration..."
  cat > pyproject.toml << EOF
[tool.black]
line-length = 88
target-version = ['py38']
include = '\.pyi?$'
EOF
fi

echo "Running JavaScript linting and formatting..."
# Format JavaScript files with Prettier
npx prettier --write "*.js" "plugins/*.js"

# Lint JavaScript files with ESLint
npx eslint --fix "*.js" "plugins/*.js"

echo "Running Python linting and formatting..."
# Format Python files with Black
black farcaster_poster.py

# Lint Python files with Flake8
flake8 farcaster_poster.py

# Check for syntax errors in all files
echo "Checking for syntax errors..."
for jsfile in $(find . -name "*.js" -not -path "./node_modules/*"); do
  node --check "$jsfile" || echo "Syntax error in $jsfile"
done

python3 -m py_compile farcaster_poster.py || echo "Syntax error in farcaster_poster.py"

echo "Precommit checks completed!"
