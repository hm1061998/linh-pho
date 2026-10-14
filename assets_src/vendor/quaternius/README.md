# Quaternius Universal Animation Library — Standard

Downloaded free from https://quaternius.itch.io/universal-animation-library on 2026-10-14, through the website's “No thanks, just take me to the downloads” flow. No purchase or login was required.

Original archive: `standard.zip`. Extracted original files and CC0 license: `standard/Universal Animation Library[Standard]/`.

Selected source: `Unreal-Godot/UAL1_Standard.glb`, which has root motion disabled. Current selected clips: `Walk_Formal_Loop` (1.333 seconds), `Idle_Loop` (2.5 seconds) and `Jog_Fwd_Loop` (0.933 seconds). The `_RM` counterpart was inspected for stride and stance speed; it is not embedded in the game.

Current idle is a custom relaxed bind-pose breathing loop, replacing the donor idle's bent-knee ready stance. Formal walk retains the donor leg motion, with a visible opposing arm pendulum (24° total swing, elbows 4–8°). Jog uses 40° total arm swing with elbows 18–26°, rather than the donor's guarded upper-body pose. Sleeves have coherent arm weights blended at the elbow, and transitions are smoothed over mesh topology and welded UV seams. Rear torso cloth is kept on the spine.

Every retarget runs `validate_player_sleeves.py` on the exported GLB. It checks each frame of walk/run for actual arm movement, elbow limits and cloth edge stretch. Results are saved in `sleeve_validation.json`; the latest run reports 95th-percentile edge stretch around 1.03× for walk and 1.04× for run.

`assets_src/retarget_quaternius.py` maps source poses onto the player's skeleton, adapts the T-pose arm orientation, adds a pelvis joint, adjusts knee proportions/weights, grounds the shoe soles, and exports only the player's model with `walk`/`idle`/`run` clips. The jog retains its airborne phase. The source mannequin is not used as the game character.

Run retarget after `adapt_supplied_models.py` and `compact_supplied_sources.py` when rebuilding the player. `retarget_report.json` records clip lengths and the ground corrections applied during the latest bake. Runtime cadence uses source foot stance velocities scaled to the character's leg length (approximately 0.815 m/s for formal walking and 4.51 m/s for jogging after resampling at playback speed 1). Jog's fractional source duration is resampled to 23 whole frame intervals so the exported loop includes its closing pose. Walk speed is 2.2 m/s; holding either Shift key raises movement speed to 5.4 m/s and blends into `run`. Blur, dialogue and pause clear held sprint input.

Latest stance correction: two-bone IK places ankles in 19 cm walking lanes and removes outward toe direction while preserving sagittal gait and heel lift. Runtime brisk walking cadence uses a 1.3 m/s reference; jogging retains 4.51 m/s. These are gameplay cadence settings, not a guarantee of physically exact foot contact.

Arm swing update: walk ±24 degrees, jog ±32 degrees; elbow angles unchanged. Sleeve weights use 48 topology smoothing passes. Exported validation reports 48/63.7 degrees of swing and passes the existing cloth deformation bounds.
