#define NODE_SUPERVISOR "/usr/local/lib/node-supervisor/cli-wrapper.js"
#include <unistd.h>
int main (int argc, char** argv) {
  return execl(
    NODE_BIN,
    "node",
    NODE_SUPERVISOR,
    argv[argc - 1],
    (char *)NULL
  );
}
