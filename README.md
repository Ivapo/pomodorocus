# Pomodorocus

A minimal, installable Pomodoro timer PWA. No frameworks, no build step — just open and focus.

## Features

- **Pomodoro timer** — configurable focus, short break, and long break durations
- **Session tracking** — visual progress dots through your work sessions
- **5 themes** — ocus (default), light, dark, 3.1 (retro DOS), tui (terminal)
- **Audio feedback** — click sounds on start/pause and beeps on timer completion
- **Installable PWA** — works offline, installs like a native app
- **Persistent settings** — your preferences are saved to localStorage

## Usage

Serve the files with any static HTTP server:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. You can also install it as a PWA from the browser's install prompt.

## License

[MIT](LICENSE)
