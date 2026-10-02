# Arcade background roll

Additional scoped objective, recorded while the environment improvement goal remains active: implement a bounded manual full-turn arcade roll, preserve deterministic combat and recovery rules, and verify it independently in actual rendered roll poses. This does not replace the active goal.

SEGA's official arcade history explicitly describes a 360-degree background roll controlled by rotating the stick: [After Burner II official history](https://www.sega.jp/history/arcade/product/8346/). This confirms the full-turn visual behavior. The exact original ROM stick gesture and timing were not reproduced or established by this implementation.

The modern control assignment is Q/E, controller shoulder buttons and touch left/right roll buttons, integrated by the main input layer. A new press starts one smooth 1.1-second full turn, with 0.6 seconds of recovery. Holding a button cannot chain turns; pressing both directions is ignored until released. Timing and button assignment are modern adaptations.

`update(dt, input)` accepts `rollLeft` and `rollRight`; public `startRoll(direction)` accepts +1 for left or −1 for right. `player.rollAngle` is the visual angle in radians, added to normal bank. `state.rolling`, `rollProgress`, `rollDirection` and `rollCooldown` expose the animation state. Roll completion returns the angle and progress to zero, the orientation equivalent of a completed 2π turn. Events `roll` have phase `start` or `complete`, with direction; the completed event records signed total `angle`.

Roll is available in flight, canyon runs and the combat portion of resupply stages. Initial tanker reloading, runway service and final carrier return block it. Scripted recovery entry, new aircraft respawn and reset clear orientation. Pause freezes angle, progress and cooldown. Roll changes no position, collision radius, damage, invulnerability, score, ammo or weapon availability; steering and combat keep their ordinary rules.

Four rule tests check both complete-turn directions and held-button recovery, phase availability and recovery cancellation, pause/reset/frame-rate determinism, and simultaneous gun/missile/damage behavior with unchanged combat economy. The complete gameplay test suite passes 22 tests, including the finite unaccelerated 23-stage mission.
