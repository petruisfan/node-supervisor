
var sys = require("sys");
var fs = require("fs");
var spawn = require("child_process").spawn;

exports.run = run;

function run (args) {
  sys.debug("args: "+args);
  var arg, next, watch, program;
  while (arg = args.shift()) {
    if (arg === "--help" || arg === "-h" || arg === "-?") {
      return help();
    } else if (arg === "--program" || arg === "-p") {
      program = args.shift();
    } else if (arg === "--watch" || arg === "-w") {
      watch = args.shift();
    }
  }
  
  // if we have a program, then run it, and restart when it crashes.
  // if we have a watch folder, then watch the folder for changes and restart the prog
  if (!program) {
    sys.error("No program specified.");
    throw new Error("No program specified.");
  }
  startProgram(program);
  if(watch) {
    if(!watch.match(/^\/.*/)) { // watch is not an absolute path
      // convert watch item to absolute path
      watch = process.cwd() + '/' + watch;
    }
    findAllJsFiles(watch, watchFile);
  }
  else {
    sys.error("No watch dir or file specified.");
    throw new Error("No watch dir or file specified");
  }
};

function print (m, n) { sys.print(m+(!n?"\n":"")); return print }

function help () {
  print
    ("Supervisor is used to restart programs when they crash.")
    ("It can also be used to restart programs when a folder or file changes.")
    ("Usage:")
    ("  supervisor [options]")
    ("")
    ("Options:")
    ("  -w|--watch <folder>")
    ("    Watch a folder for changes. When a change occurs, reload the program")
    ("")
    ("  -p|--program <program>")
    ("    The program to run")
    ("")
    ("  -h|--help|-?")
    ("    Help")
}

function startProgram (prog) {
  sys.debug("Starting child: "+prog);
  var child = exports.child = spawn("node", [prog]);
  child.stdout.addListener("data", function (chunk) { chunk && sys.print(chunk) });
  child.stderr.addListener("data", function (chunk) { chunk && sys.debug(chunk) });
  child.addListener("exit", function () { startProgram(prog) });
}

var timer = null, counter = -1, mtime = null;
function crash (oldStat, newStat) {
  
  // we only care about modification time, not access time.
  if (
    newStat.mtime.getTime() === oldStat.mtime.getTime()
  ) return;

  if (counter === -1) {
    timer = setTimeout(stopCrashing, 1000);
  }
  counter ++;
  
  var child = exports.child;
  sys.debug("crashing child");
  process.kill(child.pid);
}

function stopCrashing () {
  if (counter > 1) throw new Error("Crashing too much, shutting down");
  else counter = -1;
}

function watchFile (watch) {
  fs.watchFile(watch, crash);
}

var findAllJsFiles = function(path, callback) {
  fs.readdir(path, function(err, fileNames) {
    if(err) {
      sys.error('Error reading path: ' + path);
    }
    else {
      fileNames.forEach(function (fileName) {
        fs.stat(path + '/' + fileName, function(err, stats) {
          if(err) {
            sys.error('Error retrieving stats for file: ' +  path + '/' + fileName);
          }
          else {
            if(stats.isDirectory()) {
              findAllJsFiles(path + '/' + fileName, callback);
            }
            else {
              if(fileName.match(/.*\.js$/)) {
                callback(path + '/' + fileName);
              }
            }
          }
        });
      });
    }
  });
}
