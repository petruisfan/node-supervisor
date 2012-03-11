var util = require("util");
var fs = require("fs");
var spawn = require("child_process").spawn;
var fileExtensionPattern;
var startChildProcess;
var noRestartOn = null;
var debug = true;
var nodeArgs = [];

exports.run = run;

function run (args) {
  var arg, next, watch, program, programArgs, extensions, executor, poll_interval;
  while (arg = args.shift()) {
    if (arg === "--help" || arg === "-h" || arg === "-?") {
      return help();
    } else if (arg === "--quiet" || arg === "-q") {
      debug = false;
      util.debug = function(){};
      util.puts = function(){};
    } else if (arg === "--watch" || arg === "-w") {
      watch = args.shift();
    } else if (arg === "--poll-interval" || arg === "-p") {
      poll_interval = parseInt(args.shift());
    } else if (arg === "--extensions" || arg === "-e") {
      extensions = args.shift();
    } else if (arg === "--exec" || arg === "-x") {
      executor = args.shift();
    } else if ( arg === "--debug" || arg === "-d" ) {
      nodeArgs.push('--debug');
    } else if ( arg === "--debug-brk" || arg === "-k" ) {
      nodeArgs.push('--debug-brk');
    } else if (arg === "--no-restart-on" || arg === "-n") {
      noRestartOn = args.shift();
    } else if (arg === "--") {
      // Remaining args are: program [args, ...]
      program = args.shift();
      programArgs = args.slice(0);
      break;
    } else if (arg.indexOf("-") && !args.length) {
      // Assume last arg is the program
      program = arg;
    }
  }
  if (!program) {
    return help();
  }
  if (!watch) {
    watch = ".";
  }
  if (!poll_interval) {
    poll_interval = 100;
  }

  var programExt = program.match(/.*\.(.*)/);
  programExt = programExt && programExt[1];

  if (!extensions) {
    // If no extensions passed try to guess from the program
    extensions = "node|js";
    if (programExt && extensions.indexOf(programExt) == -1)
      extensions += "|" + programExt;
  }
  extensions = extensions.replace(/,/g, "|");
  fileExtensionPattern = new RegExp("^.*\.(" + extensions + ")$");

  if (!executor) {
    executor = (programExt === "coffee") ? "coffee" : "node";
  }

  util.puts("")
  util.debug("Running node-supervisor with");
  util.debug("  program '" + program + "'");
  util.debug("  --watch '" + watch + "'");
  util.debug("  --extensions '" + extensions + "'");
  util.debug("  --exec '" + executor + "'");
  util.puts("");

  // store the call to startProgramm in startChildProcess
  // in order to call it later
  startChildProcess = function() { startProgram(program, executor, programArgs); };

  // if we have a program, then run it, and restart when it crashes.
  // if we have a watch folder, then watch the folder for changes and restart the prog
  startChildProcess();

  var watchItems = watch.split(',');
  watchItems.forEach(function (watchItem) {
    if (!watchItem.match(/^\/.*/)) { // watch is not an absolute path
      // convert watch item to absolute path
      watchItem = process.cwd() + '/' + watchItem;
    }
    util.debug("Watching directory '" + watchItem + "' for changes.");
    findAllWatchFiles(watchItem, function(f) {
      watchGivenFile( f, poll_interval );
    });
  });
};

function print (m, n) { util.print(m+(!n?"\n":"")); return print; }

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
    ("  -d|--debug")
    ("    Start node with --debug flag.")
    ("")
    ("  -k|--debug-brk")
    ("    Start node with --debug-brk flag.")
    ("")
    ("  -p|--poll-interval <milliseconds>")
    ("    How often to poll watched files for changes.")
    ("    Defaults to Node default.")
    ("")
    ("  -e|--extensions <extensions>")
    ("    Specific file extensions to watch in addition to defaults.")
    ("    Used when --watch option includes folders")
    ("    Default is 'node|js'")
    ("")
    ("  -x|--exec <executable>")
    ("    The executable that runs the specified program.")
    ("    Default is 'node'")
    ("")
    ("  -n|--no-restart-on error|exit")
    ("    Don't automatically restart the supervised program if it ends.")
    ("    Supervisor will wait for a change in the source files.")
    ("    If \"error\", an exit code of 0 will still restart.")
    ("    If \"exit\", no restart regardless of exit code.")
    ("")
    ("  -h|--help|-?")
    ("    Display these usage instructions.")
    ("")
    ("  -q|--quiet")
    ("    Suppress DEBUG messages")
    ("")
    ("Examples:")
    ("  supervisor myapp.js")
    ("  supervisor myapp.coffee")
    ("  supervisor -w scripts -e myext -x myrunner myapp")
    ("  supervisor -- server.js -h host -p port")
    ("");
};

function startProgram (prog, exec, args) {
  if (args)
    util.debug("Starting child process with '" + exec + " " + prog + " " + args + "'");
  else
    util.debug("Starting child process with '" + exec + " " + prog + "'");
  var spawnme = args ? [prog].concat(args) : [prog];
  if ( nodeArgs ) {
    spawnme = nodeArgs.concat(spawnme)
  }
  crash_queued = false;
  var child = exports.child = spawn(exec, spawnme);
  child.stdout.addListener("data", function (chunk) { chunk && util.print(chunk); });
  child.stderr.addListener("data", function (chunk) { chunk && util.debug(chunk); });
  child.addListener("exit", function (code) {
    if (!crash_queued) {
      util.debug("Program " + prog + " exited with code " + code + "\n");
      exports.child = null;
      if (noRestartOn == "exit" || noRestartOn == "error" && code !== 0) return;
    }
    startProgram(prog, exec, args);
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
      util.debug("crashing child");
      process.kill(child.pid);
    } else {
      util.debug("restarting child");
      startChildProcess();
    }
  }, 50);
}

function crashWin (event) {
  if( event === 'change' )
    crash();
}

function crashOther (oldStat, newStat) {
  // we only care about modification time, not access time.
  if ( newStat.mtime.getTime() !== oldStat.mtime.getTime() )
    crash();
}

var isWindows = process.platform === 'win32';
function watchGivenFile (watch, poll_interval) {
  if (isWindows)
    fs.watch(watch, { persistent: true, interval: poll_interval }, crashWin);
  else
    fs.watchFile(watch, { persistent: true, interval: poll_interval }, crashOther);
}

var findAllWatchFiles = function(path, callback) {
  fs.stat(path, function(err, stats){
    if (err) {
      util.error('Error retrieving stats for file: ' + path);
    } else if (isWindows) {
      callback(path);
    } else {
      if (stats.isDirectory()) {
        fs.readdir(path, function(err, fileNames) {
          if(err) {
            util.error('Error reading path: ' + path);
          }
          else {
            fileNames.forEach(function (fileName) {
              findAllWatchFiles(path + '/' + fileName, callback);
            });
          }
        });
      } else {
        if (path.match(fileExtensionPattern)) {
          callback(path);
        }
      }
    }
  });
};
