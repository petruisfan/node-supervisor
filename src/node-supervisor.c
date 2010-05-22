#define NODE_SUPERVISOR "/usr/local/lib/node-supervisor/cli-wrapper.js"
#include <unistd.h>
#include <stdlib.h>
int main (int argc, char** argv) {
  char** argv2 = malloc(sizeof(char*) * (2 + argc));
  int i;
  argv2[0] = "node";
  argv2[1] = NODE_SUPERVISOR;
  for (i = 0; i <= argc; i++) {
    argv2[i+2] = argv[i];           
  }
  return execv(
    NODE_BIN,
    argv2
  );
}
