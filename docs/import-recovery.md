# Import recovery

A catchable browser memory allocation failure stops parsing and keeps completed
rounds available. The error recommends closing other tabs or choosing a shorter
recording. Memory failures are not retried automatically.

This recovery depends on the browser reporting a JavaScript allocation error.
If the browser or operating system kills the tab or worker without reporting the
cause, the application cannot identify that failure as insufficient memory or
recover data lost with the tab.
