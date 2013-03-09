#!/usr/bin/env node
var args = process.argv.slice(1);
var fs = require("fs");
var path = require("path");

var arg, base;
do {
  arg = args.shift();
} while (fs.realpathSync(arg) !== __filename &&
  (base = path.basename(arg)) !== "node-supervisor" &&
  base !== "supervisor" &&
  base !== "supervisor.js"
);

require("./supervisor").run(args);
