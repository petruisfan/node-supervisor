#!/usr/bin/env node
var path = require("path")
  , args = process.argv.slice(1)

do var arg = args.shift()
while ( arg !== __filename && path.basename(arg) !== "node-supervisor"
        && path.basename(arg) !== "supervisor.js"
      )

require("./supervisor").run(args)
