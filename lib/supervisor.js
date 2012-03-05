var util = require("util");
var fs = require("fs");
var spawn = require("child_process").spawn;
var fileExtensionPattern;
var startChildProcess;
var noRestartOn = 'exit';
var debug = false;

require("colors");

exports.run = run;

function run (args) {
  var arg, next, watch, program, programArgs, extensions, executor, poll_interval;
  while (arg = args.shift()) {
    if (arg === "--help" || arg === "-h" || arg === "-?" || arg === '-help') {
      return help();
    } else if (arg === "--debug" || arg === "-d") {
      debug = true;
    } else if (arg === "--quiet" || arg === "-q") {
      debug = false; //assure debugging off. This arg basically doesn't do anything.
    } else if (arg === "--watch" || arg === "-w") {
      watch = args.shift();
    } else if (arg === "--poll-interval" || arg === "-p") {
      poll_interval = parseInt(args.shift());
    } else if (arg === "--extensions" || arg === "-e") {
      extensions = args.shift();
    } else if (arg === "--exec" || arg === "-x") {
      executor = args.shift();
    } else if (arg === "--no-restart-on" || arg === '-n') {
      
      var restartArg = args.shift();
      if (restartArg === 'exit') {
        console.log('node-supervisor defaults to --no-restart-on exit. You can omit this option.'.yellow);
        noRestartOn = 'exit'; //assure what was requested.
      } else if (restartArg === 'error') {
        noRestartOn = 'error';
      } else {
        console.log('Please pass either \'error\' or \'exit\' (`--no-restart-on exit` is the default though)'.red);
        return '';
      }
      
    } else if (arg === "--keep-restarting" || arg === '-k') {
      noRestartOn = null;
    } else if (arg === "--no-restart-on-error" || arg === '-k') {
      noRestartOn = 'error';
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
    watch = program;
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

  if (debug) {
    util.puts("");
    util.puts("  program '" + program + "'");
    util.puts("  --watch '" + watch + "'");
    util.puts("  --extensions '" + extensions + "'");
    util.puts("  --exec '" + executor + "'");
    util.puts("");
  }

  // store the call to startProgramm in startChildProcess
  // in order to call it later
  startChildProcess = function() { startProgram(program, executor, programArgs); };

  // if we have a program, then run it, and restart when it crashes.
  // if we have a watch folder, then watch the folder for changes and restart the prog
  startChildProcess();

  var watchItems = watch.split(',');
  watchItems.forEach(function (watchItem) {
    util.puts("Watching " + watchItem + " for changes.");
    if (!watchItem.match(/^\/.*/)) { // watch is not an absolute path
      // convert watch item to absolute path
      watchItem = process.cwd() + '/' + watchItem;
    }
    findAllWatchFiles(watchItem, function(f) {
      watchGivenFile( f, poll_interval );
    });
  });
  util.puts("Node will restart on any changes.".green);
};

function print (m, n) { util.print(m+(!n?"\n":"")); return print; }

function help () {
  print
    ("")
    ("Node Supervisor is used to restart programs when they crash.")
    ("It can be used to restart programs when a *.js file changes.")
    ("")
    ("Usage:")
    ("  supervisor [options] <program>")
    ("  supervisor [options] -- <program> [args ...]")
    ("")
    ("Recommended usage:".green.underline)
    ("  supervisor server.js".green.bold)
    ("  Defaults: --no-restart-on exit, watches only your <program.js>.")
    ("")
    ("Options:")
    ("  --watch <list of files/folders>")
    ("    A comma-seperated list of folders or js files to watch for changes.")
    ("    When a change to a js file occurs, the server restarts")
    ("    Defaults to watching your server.js file (whatever the file may be called). -w shortcut")
    ("")
    ("  --poll-interval <milliseconds>")
    ("    How often to poll watched files for changes.")
    ("    Defaults to 100 milliseconds (node default) -p shortcut")
    ("")
    ("  --extensions <file extensions>")
    ("    Specific file extensions to watch in addition to defaults.")
    ("    Used when --watch option includes folders")
    ("    Default is 'node|js' -e shortcut")
    ("")
    ("  --exec <executable>")
    ("    The executable that runs the specified program.")
    ("    Default is 'node' -x shortcut")
    ("")
    ("  --no-restart-on-exit")
    ("    Never automatically restart the server, regardless of exit code.")
    ("    -n shortcut (don't forget exit)")
    ("")
    ("  --keep-restarting")
    ("    Whenever the server dies, restart it. May result in the server infinitely restarting.")
    ("")
    ("  --help")
    ("    Display these usage instructions. -h or -? shortcut")
    ("")
    ("  --debug")
    ("    Show DEBUG messages. -d shortcut")
    ("")
    ("Examples:")
    ("  supervisor myapp.js".green)
    ("  supervisor myapp.coffee")
    ("  supervisor -w scripts -e myext -x myrunner myapp")
    ("  supervisor -- server.js -h host -p port")
    ("  supervisor -w server.js --no-restart-on error server.js")
    ("");
};

function startProgram (prog, exec, args) {
  
  if (debug) {
    if (args)
      util.puts("Starting child process with '" + exec + " " + prog + " " + args + "'");
    else
      util.puts("Starting child process with '" + exec + " " + prog + "'");
  }
  
  var spawnme = args ? [prog].concat(args) : [prog];
  crash_queued = false;
  var child = exports.child = spawn(exec, spawnme);
  child.stdout.addListener("data", function (chunk) {
    chunk && util.print(chunk);
  });
  child.stderr.addListener("data", function (chunk) {
    chunk && util.puts(chunk);
  });
  child.addListener("exit", function (code) {
    if (!crash_queued) {
      util.puts(prog + " exited with code " + code);
      util.puts("Try fixing the problem, save, and see if this error reoccurs\n".yellow);
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
      util.puts("crashing child");
      process.kill(child.pid);
    } else {
      util.puts("restarting child");
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
