#!/bin/sh
# Headless Chrome for the interactive page's checks on GitHub's Linux runners (idea #125): the
# runner's own google-chrome with --no-sandbox, because Ubuntu's AppArmor rules can stop Chrome's
# sandbox from starting there (the page under test is our own). pages/tests/cdp.mjs adds every
# other flag. Point CHROME at this file; CHROME_BIN picks another browser binary.
exec "${CHROME_BIN:-google-chrome}" --no-sandbox "$@"
