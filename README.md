# node-supervisor

A little supervisor script for nodejs.  It runs your program, and watches for code changes, so you can have hot-code reloading-ish behavior, without worrying about memory leaks and making sure you clean up all the inter-module references, and without a whole new `require` system.

## usage

`./configure && make && sudo make install`

Then do `node-supervisor --help` to learn more.

## todo

1. Re-attach to a process by pid.  If the supervisor is backgrounded, and then disowned, the child will keep running.  At that point, the supervisor may be killed, but the child will keep on running.  It'd be nice to have two supervisors that kept each other up, and could also perhaps run a child program.
2. Run more types of programs than just "node blargh.js".
3. Be able to run more than one program, so that you can have two supervisors supervise each other, and then also keep some child server up.
4. When watching, it'd be good to perhaps bring up a new child and then kill the old one gently, rather than just crashing the child abruptly.
5. Keep the pid in a safe place, so another supervisor can pull it out if told to supervise the same program.
6. It'd be pretty cool if this program could be run just like doing `node blah.js`, but could somehow "know" which files had been loaded, and restart whenever a touched file changes.
