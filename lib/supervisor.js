var util = require("util");
var fs = require("fs");
var spawn = require("child_process").spawn;
var path = require("path");
var fileExtensionPattern;
var startChildProcess;
var noRestartOn = null;
var debug = true;
var verbose = false;
var ignoredPaths = {};
var forceWatchFlag = false;
var log = console.log

exports.run = run;

function run (args) {
  var arg, next, watch, ignore, program, extensions, executor, poll_interval, debugFlag, debugBrkFlag, debugBrkFlagArg, harmony;
  while (arg = args.shift()) {
    if (arg === "--help" || arg === "-h" || arg === "-?") {
      return help();
    } else if (arg === "--quiet" || arg === "-q") {
      debug = false;
      log = function(){};
    } else if (arg === "--harmony") {
      harmony = true;
    } else if (arg === "--verbose" || arg === "-V") {
      verbose = true;
    } else if (arg === "--watch" || arg === "-w") {
      watch = args.shift();
    } else if (arg === "--ignore" || arg === "-i") {
      ignore = args.shift();
    } else if (arg === "--poll-interval" || arg === "-p") {
      poll_interval = parseInt(args.shift());
    } else if (arg === "--extensions" || arg === "-e") {
      extensions = args.shift();
    } else if (arg === "--exec" || arg === "-x") {
      executor = args.shift();
    } else if (arg === "--no-restart-on" || arg === "-n") {
      noRestartOn = args.shift();
    } else if (arg === "--debug") {
      debugFlag = true;
    } else if (arg.indexOf('--debug-brk')>=0) {
      debugBrkFlag = true;
      debugBrkFlagArg = arg;
    } else if (arg === "--force-watch") {
      forceWatchFlag = true;
    } else if (arg === "--") {
      program = args;
      break;
    } else if (arg[0] != "-" && !args.length) {
      // Assume last arg is the program
      program = [arg];
    }
  }
  if (!program) {
    return help();
  }
  if (!watch) {
    watch = ".";
  }
  if (!poll_interval) {
    poll_interval = 1000;
  }

  var programExt = program.join(" ").match(/.*\.(\S*)/);
  programExt = programExt && programExt[1];

  if (!extensions) {
    // If no extensions passed try to guess from the program
    extensions = "node,js";
    if (programExt && extensions.indexOf(programExt) == -1) {
      // Support coffee and litcoffee extensions
      if(programExt === "coffee" || programExt === "litcoffee") {
        extensions += ",coffee,litcoffee";
      } else {
        extensions += "," + programExt;
      }
    }
  }
  fileExtensionPattern = new RegExp("^.*\.(" + extensions.replace(/,/g, "|") + ")$");

  if (!executor) {
    executor = (programExt === "coffee" || programExt === "litcoffee") ? "coffee" : "node";
  }

  if (debugFlag) {
    program.unshift("--debug");
  }
  if (debugBrkFlag) {
    program.unshift(debugBrkFlagArg);
  }
  if (harmony) {
    program.unshift("--harmony");
  }
  if (executor === "coffee" && (debugFlag || debugBrkFlag)) {
    // coffee does not understand debug or debug-brk, make coffee pass options to node
    program.unshift("--nodejs")
  }

  try {
    // Pass kill signals through to child
    [ "SIGTERM", "SIGINT", "SIGHUP", "SIGQUIT" ].forEach( function(signal) {
      process.on(signal, function () {
        var child = exports.child;
        if (child) {
          log("Sending "+signal+" to child...");
          child.kill(signal);
        }
        process.exit();
      });
    });
  } catch(e) {
    // Windows doesn't support signals yet, so they simply don't get this handling.
    // https://github.com/joyent/node/issues/1553
  }

  log("")
  log("Running node-supervisor with");
  log("  program '" + program.join(" ") + "'");
  log("  --watch '" + watch + "'");
  if (ignore) {
    log("  --ignore '" + ignore + "'");
  }
  log("  --extensions '" + extensions + "'");
  log("  --exec '" + executor + "'");
  log("");

  // store the call to startProgramm in startChildProcess
  // in order to call it later
  startChildProcess = function() { startProgram(program, executor); };

  // if we have a program, then run it, and restart when it crashes.
  // if we have a watch folder, then watch the folder for changes and restart the prog
  startChildProcess();

  if (ignore) {
    var ignoreItems = ignore.split(',');
    ignoreItems.forEach(function (ignoreItem) {
      ignoreItem = path.resolve(ignoreItem);
      ignoredPaths[ignoreItem] = true;
      log("Ignoring directory '" + ignoreItem + "'.");
    });
  }

  var watchItems = watch.split(',');
  watchItems.forEach(function (watchItem) {
    watchItem = path.resolve(watchItem);
    log("Watching directory '" + watchItem + "' for changes.");
    findAllWatchFiles(watchItem, function(f) {
      watchGivenFile( f, poll_interval );
    });
  });
};

function print (m, n) { console.log(m+(!n?"\n":"")); return print; }

function help () {
  print
    ("")
    ("Node Supervisor is used to restart programs when they crash.")
    ("It can also be used to restart programs when a *.js file changes.")
    ("")
    ("Usage:")
    ("  supervisor [options] <program>")
    ("  supervisor [options] -- <program> [args ...]")
    ("")
    ("Required:")
    ("  <program>")
    ("    The program to run.")
    ("")
    ("Options:")
    ("  -w|--watch <watchItems>")
    ("    A comma-delimited list of folders or js files to watch for changes.")
    ("    When a change to a js file occurs, reload the program")
    ("    Default is '.'")
    ("")
    ("  -i|--ignore <ignoreItems>")
    ("    A comma-delimited list of folders to ignore for changes.")
    ("    No default")
    ("")
    ("  -p|--poll-interval <milliseconds>")
    ("    How often to poll watched files for changes.")
    ("    Defaults to Node default.")
    ("")
    ("  -e|--extensions <extensions>")
    ("    Specific file extensions to watch in addition to defaults.")
    ("    Used when --watch option includes folders")
    ("    Default is 'node,js'")
    ("")
    ("  -x|--exec <executable>")
    ("    The executable that runs the specified program.")
    ("    Default is 'node'")
    ("")
    ("  --debug")
    ("    Start node with --debug flag.")
    ("")
    ("  --debug-brk[=port]")
    ("    Start node with --debug-brk[=port] flag.")
    ("")
    ("  --harmony")
    ("    Start node with --harmony flag.")
    ("")
    ("  -n|--no-restart-on error|exit")
    ("    Don't automatically restart the supervised program if it ends.")
    ("    Supervisor will wait for a change in the source files.")
    ("    If \"error\", an exit code of 0 will still restart.")
    ("    If \"exit\", no restart regardless of exit code.")
    ("")
    ("  --force-watch")
    ("    Use fs.watch instead of fs.watchFile.")
    ("    This may be useful if you see a high cpu load on a windows machine.")
    ("")
    ("  -h|--help|-?")
    ("    Display these usage instructions.")
    ("")
    ("  -q|--quiet")
    ("    Suppress DEBUG messages")
    ("")
    ("  -V|--verbose")
    ("    Show extra DEBUG messages")
    ("")
    ("Examples:")
    ("  supervisor myapp.js")
    ("  supervisor myapp.coffee")
    ("  supervisor -w scripts -e myext -x myrunner myapp")
    ("  supervisor -- server.js -h host -p port")
    ("");
};

function startProgram (prog, exec) {
  log("Starting child process with '" + exec + " " + prog.join(" ") + "'");
  crash_queued = false;
  var child = exports.child = spawn(exec, prog, {stdio: 'inherit'});
  if (child.stdout) {
    // node < 0.8 doesn't understand the 'inherit' option, so pass through manually
    child.stdout.addListener("data", function (chunk) { chunk && console.log(chunk); });
    child.stderr.addListener("data", function (chunk) { chunk && console.error(chunk); });
  }
  child.addListener("exit", function (code) {
    if (!crash_queued) {
      log("Program " + exec + " " + prog.join(" ") + " exited with code " + code + "\n");
      exports.child = null;
      if (noRestartOn == "exit" || noRestartOn == "error" && code !== 0) return;
    }
    startProgram(prog, exec);
  });
}

var timer = null, mtime = null; crash_queued = false;
function crash () {

  if (crash_queued)
    return;

  crash_queued = true;
  var child = exports.child;
  setTimeout(function() {
    if (child) {
      log("crashing child");
      process.kill(child.pid);
    } else {
      log("restarting child");
      startChildProcess();
    }
  }, 50);
}

function crashWin (event, filename) {
  var shouldCrash = true;
  if( event === 'change' ) {
    if (filename) {
      filename = path.resolve(filename);
      Object.keys(ignoredPaths).forEach(function (ignorePath) {
        if ( filename.indexOf(ignorePath + '\\') === 0 || filename === ignorePath) {
          shouldCrash = false;
        }
      });
    }
    if (shouldCrash)
      crash();
  }
}

function crashOther (oldStat, newStat) {
  // we only care about modification time, not access time.
  if ( newStat.mtime.getTime() !== oldStat.mtime.getTime() )
    crash();
}

var nodeVersion = process.version.split(".");
var isWindowsWithoutWatchFile = process.platform === 'win32' && parseInt(nodeVersion[1]) <= 6;
function watchGivenFile (watch, poll_interval) {
  if (isWindowsWithoutWatchFile || forceWatchFlag)
    fs.watch(watch, { persistent: true, interval: poll_interval }, crashWin);
  else
    fs.watchFile(watch, { persistent: true, interval: poll_interval }, crashOther);
  if (verbose)
    log("watching file '" + watch + "'");
}

var findAllWatchFiles = function(dir, callback) {
  dir = path.resolve(dir);
  if (ignoredPaths[dir])
    return;
  fs.stat(dir, function(err, stats){
    if (err) {
      console.error('Error retrieving stats for file: ' + dir);
    } else {
      if (stats.isDirectory()) {
        if (isWindowsWithoutWatchFile || forceWatchFlag) callback(dir);
        fs.readdir(dir, function(err, fileNames) {
          if(err) {
            console.error('Error reading path: ' + dir);
          }
          else {
            fileNames.forEach(function (fileName) {
              findAllWatchFiles(path.join(dir, fileName), callback);
            });
          }
        });
      } else {
        if ((!isWindowsWithoutWatchFile || !forceWatchFlag) && dir.match(fileExtensionPattern)) {
          callback(dir);
        }
      }
    }
  });
};
