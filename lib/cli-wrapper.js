var path = require("path"),
  args = process.argv.slice(0);

for (
  var arg = args.shift();
  arg !== __filename && path.basename(arg) !== "node-supervisor"
     && path.basename(arg) !== "supervisor.js";
  arg = args.shift()
) {
  require("sys").debug("-->"+arg);
}

require("./supervisor").run(args);
