(function() {
  var crash, crash_queued, fileExtensionPattern, findAllWatchFiles, fs, help, mtime, run, spawn, startProgram, timer, util, watchGivenFile;

  util = require('util');

  fs = require('fs');

  spawn = require('child_process').spawn;

  fileExtensionPattern = void 0;

  exports.run = run = function(args) {
    var arg, executor, extensions, poll_interval, program, programArgs, programExt, watch, watchItems;
    while (arg = args.shift()) {
      if (arg === "--help" || arg === "-h" || arg === "-?") {
        return help();
      } else if (arg === "--watch" || arg === "-w") {
        watch = args.shift();
      } else if (arg === "--poll-interval" || arg === "-p") {
        poll_interval = parseInt(args.shift());
      } else if (arg === "--extensions" || arg === "-e") {
        extensions = args.shift();
      } else if (arg === "--exec" || arg === "-x") {
        executor = args.shift();
      } else if (arg === "--") {
        program = args.shift();
        programArgs = args.slice(0);
        break;
      } else if (arg.indexOf("-") && !args.length) {
        program = arg;
      }
    }
    if (!program) return help();
    if (!watch) watch = ".";
    if (!poll_interval) poll_interval = 0;
    programExt = program.match(/.*\.(.*)/);
    programExt = programExt && programExt[1];
    if (!extensions) {
      extensions = "node|js";
      if (programExt && extensions.indexOf(programExt) === -1) {
        extensions += "|" + programExt;
      }
    }
    fileExtensionPattern = new RegExp("^.*.(" + extensions + ")$");
    if (!executor) executor = programExt === "coffee" ? "coffee" : "node";
    util.puts("");
    util.debug("Running node-supervisor with");
    util.debug("  program '" + program + "'");
    util.debug("  --watch '" + watch + "'");
    util.debug("  --extensions '" + extensions + "'");
    util.debug("  --exec '" + executor + "'");
    util.puts("");
    startProgram(program, executor, programArgs);
    watchItems = watch.split(",");
    return watchItems.forEach(function(watchItem) {
      if (!watchItem.match(/^\/.*/)) watchItem = process.cwd() + "/" + watchItem;
      util.debug("Watching directory '" + watchItem + "' for changes.");
      return findAllWatchFiles(watchItem, function(f) {
        return watchGivenFile(f, poll_interval);
      });
    });
  };

  /*
  print = (m, n) ->
    util.print m + (if not n then "\n" else "")
    print
  */

  help = function() {
    return util.print('\nNode Supervisor is used to restart programs when they crash.\nIt can also be used to restart programs when a *.js file changes.\n\nUsage:\n  supervisor [options] <program>\n\nRequired:\n  <program>\n    The program to run.\n\nOptions:\n  -w|--watch <watchItems>\n    A comma-delimited list of folders or js files to watch for changes.\n    When a change to a js file occurs, reload the program\n    Default is \'.\'\n\n  -p|--poll-interval <milliseconds>\n    How often to poll watched files for changes.\n    Defaults to Node default.\n\n  -e|--extensions <extensions>\n    Specific file extensions to watch in addition to defaults.\n    Used when --watch option includes folders\n    Default is \'node|js\'\n\n  -x|--exec <executable>\n    The executable that runs the specified program.\n    Default is \'node\'\n\n  -h|--help|-?\n    Display these usage instructions.\n\nExamples:\n  supervisor myapp.js\n  supervisor myapp.coffee\n  supervisor -w scripts -e myext -x myrunner myapp\n');
  };

  startProgram = function(prog, exec, args) {
    var child, spawnme;
    if (args) {
      util.debug("Starting child process with '" + exec + " " + prog + " " + args + "'");
    } else {
      util.debug("Starting child process with '" + exec + " " + prog + "'");
    }
    spawnme = args ? [prog].concat(args) : [prog];
    child = exports.child = spawn(exec, spawnme);
    child.stdout.addListener("data", function(chunk) {
      return chunk && util.print(chunk);
    });
    child.stderr.addListener("data", function(chunk) {
      return chunk && util.debug(chunk);
    });
    return child.addListener("exit", function() {
      return startProgram(prog, exec, args);
    });
  };

  timer = null;

  mtime = null;

  crash_queued = false;

  crash = function(oldStat, newStat) {
    var child;
    if (newStat.mtime.getTime() === oldStat.mtime.getTime() || crash_queued) {
      return;
    }
    crash_queued = true;
    child = exports.child;
    return setTimeout((function() {
      util.debug("crashing child");
      process.kill(child.pid);
      return crash_queued = false;
    }), 50);
  };

  watchGivenFile = function(watch, poll_interval) {
    return fs.watchFile(watch, {
      persistent: true,
      interval: poll_interval
    }, crash);
  };

  findAllWatchFiles = function(path, callback) {
    return fs.stat(path, function(err, stats) {
      if (err) {
        return util.error("Error retrieving stats for file: " + path);
      } else {
        if (stats.isDirectory()) {
          return fs.readdir(path, function(err, fileNames) {
            if (err) {
              return util.puts("Error reading path: " + path);
            } else {
              return fileNames.forEach(function(fileName) {
                return findAllWatchFiles(path + "/" + fileName, callback);
              });
            }
          });
        } else {
          if (path.match(fileExtensionPattern)) return callback(path);
        }
      }
    });
  };

}).call(this);
