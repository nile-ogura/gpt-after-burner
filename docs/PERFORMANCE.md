# Rendering measurement — 2026-10-02

Current requirement: the user explicitly accepts low FPS on this PC because its GPU is weak. Minimum FPS, smooth-play and hardware60fps are therefore not adoption blockers. Historical measurements and former gate results are retained below; rendering correctness, visual quality and game behavior still require their own checks.

This is a local software-renderer measurement, not a hardware GPU benchmark or a 60fps claim. The capture tool reports the actual renderer as `ANGLE / Vulkan / SwiftShader Device (Subzero)`.

The paused Stage 1 and Stage 11 scenes were rendered at a 1440×900 viewport in separate runs. Each profile discarded five warmup frames and measured the following 24 requestAnimationFrame intervals. The game simulation remained paused. Rendering continued, including the scene, postprocessing and HUD updates. Active combat, dynamic explosions, input latency, a full campaign and physical hardware remain unmeasured by these benchmarks.

The latest complete measurement is Stage 11 / forest v4, **08:31:55 JST**. Its held-source evidence is `artifacts/review-round10/performance-forest-v4/performance-forest.json`; source hashes match the fixed v4 forest images. The run records all 48 raw intervals, four before/after camera/clock/profile snapshots, ready original textures, and empty browser/shader errors. It follows 8s of pure simulation and separately labelled 8s of environment-only settling, then holds the scene. It is not a natural-motion benchmark or a matched comparison with the older Stage 1 run.

| Stage 11 profile | Pixel ratio | Average frames/sec | 95th-percentile frame time | Draw calls/frame | Triangles/frame |
| --- | --- | --- | --- | --- | --- |
| High | 1.00 | 0.97 | 1083.3ms | 139 | 441,480 |
| Balanced diagnostic | 0.65 | 2.30 | 500.0ms | 90 | 278,759 |

Both profiles retain the same 768 selected crown groups. The forest biome itself uses 209,920/196,480 triangles; the table includes the full rendered scene. Density retention and source-cache audit passes do not establish a frame-rate improvement. Low FPS is accepted under the user's current requirement. Hardware performance and moving selection/pop remain unverified.

Earlier Stage 1 measurement: **07:06:26 JST**, aircraft v7 / eroded-coast-v3 / geology-contrast-v2 / cirrus-lut-v1 / photographic rock / reduced terrain indices / wind-only ocean normals / synchronized HUD. Canyon-floor and forest objects exist but are hidden in this coast-stage measurement. Source hashes identify the measured version, which predates the later forest v2/v3/v4 changes. All four terrain maps were ready; the high profile used 122,112 indices per terrain mesh and the diagnostic balanced profile used 30,528. Shader and browser error count was zero.

| Profile | Pixel ratio | Average frames/sec | 95th-percentile frame time | Draw calls/frame | Triangles/frame |
| --- | --- | --- | --- | --- | --- |
| High | 1.00 | 1.20 | 883.3ms | 118 | 226,328 |
| Balanced diagnostic | 0.65 | 3.21 | 350.0ms | 69 | 77,047 |

The balanced diagnostic disables bloom and shadows. The ordinary balanced menu setting starts at pixel ratio 0.75; the automatic setting can reduce it further. Consequently the table is a controlled diagnostic profile, not a measurement of every menu setting. Raw conditions are frozen in `artifacts/review-round10/performance/performance.json`, including raw frame intervals and four before/after camera/clock/world/profile snapshots. Simulation and presentation are held, and all assets are ready. The preceding round9 measurement was high 1.21fps / 900ms / 118 calls / 226,328 triangles and diagnostic .65 3.20fps / 350.1ms / 69 calls / 77,047 triangles. It had no camera/clock snapshots, so these samples do not isolate the sky revision; no speedup is established. The preceding round7 measurement was high 1.25fps / 850ms / 116 calls / 223,960 triangles and balanced 3.58fps / 300ms / 68 calls / 75,863 triangles; it predates aircraft v7 and the v2/v3 landscape revisions. These small samples do not isolate any individual revision’s cost.

The earlier 02:43 baseline was high 1.23fps / 883.4ms / 116 calls / 204,840 triangles and balanced 3.02fps / 400.0ms / 70 calls / 188,583 triangles, frozen in `artifacts/review-round4/performance-baseline.json`. Aircraft, clouds, materials, HUD and scene startup have also changed. The difference between these small samples does not isolate terrain's effect or guarantee a repeatable frame-rate increase. Terrain's 75% index reduction is separately verified by shared-attribute/index checks; the latest total-frame triangle count also includes other geometry.

Implemented reductions include three distance levels for enemies, shared projectile geometry and reuse, two instanced particle batches and one continuous missile-wake buffer, static cloud PNGs, diffuse terrain shading and shared-attribute lower terrain indices, a smaller sky cube map, a sky shader with one startup-generated cirrus texture sample instead of runtime noise octaves, and an ocean shader with two wind-normal texture samples. These reduce work; they do not establish acceptable real-time performance on this machine.

These software-renderer frame rates failed the former smooth-play performance gate. The user has since accepted low FPS on this PC, so that gate no longer blocks adoption. Commercial AAA visual parity and hardware60fps remain unverified; no hardware-performance claim is made.

The first round10 combined sky/performance run captured four successful static sky frames, then failed because its browser/page/context closed before performance collection. Cause remains unestablished; preserve `artifacts/review-round10/sky-attempt1/run-result.json`. A separate browser produced the complete measurement above. Static sky adoption and that initial failed integrated run are recorded separately from this successful diagnostic measurement.
