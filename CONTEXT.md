# Domain glossary

## Subtitle generation task session

The long-lived session for one subtitle-generation request. It owns task identity,
progress, cancellation, restoration after the page remounts, and the user-facing
meaning of completed, partial, stopped, and failed results.

## Video preview session

The session that prepares and plays the selected source video while subtitle ranges
are edited. It chooses between the native-file and FFmpeg-stream adapters and owns
adapter switching, seeking, cleanup, and preview errors.

## Subtitle translation session

The session from selecting an SRT file through settings, connection checks,
translation progress, cancellation, retry, and the translated output.

## Local file import

The operation that resolves a user's file selection or drop into normalized local
paths. It coordinates the browser DataTransfer and macOS native-drop adapters,
including their race and timing rules.
