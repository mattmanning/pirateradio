# Pirate Radio

## Installation

    brew install node npm
    npm install bounce
    npm install connect-auth
    npm install connect-identity
    npm install couchdb
    npm install cradle
    npm install express
    npm install haml
    npm install oauth
    npm install redis
    npm install redis-node
    npm install sass
    npm install socket.io
    npm install twitter-connect

## Setting up NPM

    export NODE_PATH="/usr/local/lib/node"
    export PATH="/usr/local/share/npm/bin:$PATH"

## Running

    bounce -r -g -w "*.js,app/*.js,lib/*.js,lib/**/*.js" "node server.js"

