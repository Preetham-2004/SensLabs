# SensLab

SensLab is a visual sensitivity and settings advisor for FPS gamers. Instead of typing numbers and guessing, players move their mouse in a 3D shooting range, and SensLab turns that movement into a starting sensitivity for their own game.

## Features

### Available now

- **Game conversion:** choose CS2 or VALORANT and get in-game sensitivity values based on your mouse DPI.
- **Swipe measurement:** make one comfortable swipe across your mousepad, and SensLab maps it to a 180 degree turn.
- **Three candidates:** lower, middle and higher sensitivity options, so you choose what feels right.
- **3D shooting range:** an original, plain range with pointer lock and raw mouse input.
- **Measured drills:** flick (30 targets), tracking (20 seconds) and precision (20 small targets), each with a countdown.
- **Detailed results:** hit rate, time to hit, overshoot, undershoot and angular error, built from raw mouse samples and click times.
- **Session history:** compare your own results between candidates within the same session.
- **Crosshair options:** choose the shape, color, size and gap.

### Planned

- **Guided sensitivity test:** random-order rounds, scoring and a recommended sensitivity range with a confidence note.
- **More games:** Apex Legends, Overwatch 2, Fortnite and Call of Duty, each added only with verified values.
- **Settings advice:** scoped (ADS) sensitivity matching and a shareable result card.
- **Recoil practice:** a recoil drill with original spray patterns, plus rule-based advice from your results.
- **Accounts and saved results:** history, retest comparison and a paid report through UPI (Razorpay).
- **Windows background tracker:** a mouse-only tray app that reports flick and overshoot trends, with data kept on your computer.
- **Mobile games:** touch aim tests and settings for mobile titles.

## Tech stack

| Part | Technology |
| --- | --- |
| Web app | Next.js, TypeScript, Three.js |
| API | FastAPI (Python) |
| Database | PostgreSQL |
| Environment | Docker Compose |
| Planned | Razorpay for payments, a Windows tray app in C# (.NET) or Tauri |

## Principles

- SensLab only measures and recommends. It never reads a game's screen or memory and never changes game input.
- It uses only original, plain visuals and no real game assets.
- Results are starting points, and the player decides what feels right.
- Practice results stay in the browser session and are not sent anywhere.
- The planned Windows tracker uses Windows Raw Input only, logs mouse movement and click times (never keystrokes), and keeps data local unless the player opts in.
