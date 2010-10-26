# Pirate Radio

## Installation

    brew install node npm
    npm install express
    npm install haml
    npm install bounce
    npm install twitter-connect
    npm install connect-identity
    npm install cradle
    
## Setting up NPM

    export NODE_PATH="/usr/local/lib/node"
    export PATH="/usr/local/share/npm/bin:$PATH"

## Running

    bounce -r -g -w "*.js,app/*.js,lib/*.js,lib/**/*.js" "node server.js"
