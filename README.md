# EVADE 45

A first-person 3D game about avoiding drones for 45 seconds on foot, by motorcycle, or in a light armored vehicle.

## Run

Requires Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:5173/evade45/>.

To create a production build:

```sh
npm run build
```

## License

Three.js is licensed under the MIT License. Its license text is included at `dist/vendor/THREE-LICENSE.txt` in the production build.

## Speed References and Scope

Only the drones' maximum speeds are based on published civilian specifications.

| Difficulty |     Maximum speed | Reference                                                    |
| ---------- | ----------------: | ------------------------------------------------------------ |
| Practice   |  16 m/s (58 km/h) | [DJI Avata 2 Sport mode](https://www.dji.com/avata-2/specs)  |
| Normal     |  27 m/s (97 km/h) | [DJI Avata 2 Manual mode](https://www.dji.com/avata-2/specs) |
| Hard       | 39 m/s (140 km/h) | [DJI FPV Manual mode](https://www.dji.com/dji-fpv/specs)     |

References checked on September 19, 2026. Published test conditions and regional limits may apply.

Everything else—including appearance, steering, tracking, collisions, jumping, armor, and approach behavior—is fictional game design. EVADE 45 does not simulate military drone performance, battlefield survivability, or real-world evasion methods.
