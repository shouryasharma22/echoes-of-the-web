# Silicon Maze: Echoes of the Web

**Live app:** https://echoesoftheweb.onrender.com/
---

## Premise

A surge fractured the Aether Core and scattered six fragments across a three-district city. Swing between the Neon Docks, Frozen Rooftops, and Foundry Heights, restore three local systems, and bring the Core back online.

## Controls

- `A` / `D` or left/right arrows: move
- `Space`, `W`, or up arrow: jump; release early for a shorter jump. While tethered, `W` reels in instead.
- Mouse aim + left click: attach to or retarget a web pivot; clicking empty/blocked space releases the current web
- `E`: fire or retarget the web toward the keyboard aim; `Space`: release the web
- Arrow keys also aim in their direction for keyboard-only play. `I` / `K` / `L` aim up/down/right; `J` is reserved for the field journal.
- `Shift`: shorten the rope; `S` / `Ctrl`: lengthen it
- `J`: field journal; `Esc`: pause/menu; `R`: respawn at the latest checkpoint; `F1`: physics debug overlay

## Technology

The game uses plain HTML, CSS, vanilla JavaScript ES modules, and the Canvas API. It has no runtime packages, framework, or build step. Web Audio generates sound effects. The automated checks use Node's built-in test runner and add no project dependency.

## Run locally

No build, framework, or npm dependencies are needed. ES modules require an HTTP origin, so from this folder run:

```sh
npx serve
```

Then open the local URL printed by `serve` (usually `http://localhost:3000`). VS Code Live Server also works. The static files can be published directly to GitHub Pages.

## Tests

Run the repeatable physics, tether, quest, collection, and save checks with:

```sh
node --test
```

## Physics notes

- The simulation advances with a 1/120-second fixed timestep and an accumulator, independent of render frame rate.
- Horizontal acceleration is stronger on the ground; ground friction and air drag are separate. Jump buffering and coyote time make ledge jumps forgiving, while variable jump height comes from cutting upward velocity on release.
- Gravity and velocity are integrated for the player and crates. Terrain collision resolves X and Y independently with AABBs. Crates have mass-scaled push and tether forces, gravity, and ground friction.
- The web uses a damped spring constraint. Its radial force lets the player swing and retain tangential momentum; reel controls adjust its rest length. A web can also pull crates.
- The camera eases toward the player and clamps to the 4800 by 1200 world. Ice offers very low friction; the pressure plate and bridge/gate are stateful world geometry.

## Known limitations

- Tethers raycast against solid terrain and release when scenery blocks an attached line; they do not wrap around corners.
- Sound is synthesized with Web Audio and begins after a user gesture. Browser storage or audio restrictions are handled gracefully.
- The ice objective expects a fast approach through the switch. Quest objectives activate on arrival or when their physical condition is met. Progress and collected fragments persist locally in this browser only.
- There is no gamepad support, and the single-screen camera has no minimap.

## Deployed link

Not deployed yet. The repository includes a GitHub Pages workflow at `.github/workflows/pages.yml`. Push the `main` branch to GitHub, enable Pages with **GitHub Actions** as the source, then replace this line with the URL shown by the workflow deployment (normally `https://<owner>.github.io/<repository>/`).

## Explanation video

No recording has been uploaded yet. Use [docs/explanation-video-script.md](docs/explanation-video-script.md) as a short recording outline, then add the public video URL here before submission.

## Credits

Designed and implemented for this project. Fonts: Barlow Condensed and DM Mono via Google Fonts, with local system fallbacks. All game graphics are drawn with the Canvas API; sound effects are generated with Web Audio.
