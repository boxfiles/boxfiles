# Changelog

## [0.1.0](https://github.com/boxfiles/boxfiles/compare/core-v0.0.1...core-v0.1.0) (2026-07-01)


### Features

* **cli:** add apply command execution ([667e9a3](https://github.com/boxfiles/boxfiles/commit/667e9a37cf5580012e0406b9773fa75367f133db))
* **cli:** expose context facts command (closes [#5](https://github.com/boxfiles/boxfiles/issues/5)) ([#7](https://github.com/boxfiles/boxfiles/issues/7)) ([eb61927](https://github.com/boxfiles/boxfiles/commit/eb619277f0a709b256830bf83b0f145b8a006b5c))
* **cli:** install plugin declarations ([befc99e](https://github.com/boxfiles/boxfiles/commit/befc99ea01750cf1bde7955f3f187eb013272d18))
* **cli:** remove plugin declarations safely ([879ef59](https://github.com/boxfiles/boxfiles/commit/879ef597de83f825fb0545c23f6d3e942af2a974))
* **config:** add shared config package and wire core to it ([bea1654](https://github.com/boxfiles/boxfiles/commit/bea16548a9cd32ff25b7c4848dd6efebf9fdf251))
* **core:** add boxfilesrc ingestion helper ([2b276ee](https://github.com/boxfiles/boxfiles/commit/2b276eeb717eb27f9b68b7c11e0042db74846ada))
* **core:** cache git plugin sources ([4c438f1](https://github.com/boxfiles/boxfiles/commit/4c438f1fef76158460f83f154acaef2a0665d0f7))
* **core:** cache npm plugin sources ([b48e931](https://github.com/boxfiles/boxfiles/commit/b48e93126d1e8bfe55240e82890ded8fc2c7c985))
* **core:** define plugin config schema ([90a70f1](https://github.com/boxfiles/boxfiles/commit/90a70f1a13dd8aebab911195c5127daca768cc43))
* **core:** derive plugin cache keys ([c4df827](https://github.com/boxfiles/boxfiles/commit/c4df82713b8156b974c6181ab668eefe8acfd02b))
* **core:** load installed plugins ([f5577ba](https://github.com/boxfiles/boxfiles/commit/f5577ba752399ce400a8955ade786258e6600e31))
* **core:** parse plugin source strings ([9d770fe](https://github.com/boxfiles/boxfiles/commit/9d770fe57547dd665c604647774769b2be7b150e))
* **core:** render context properties in manifests ([baa9a65](https://github.com/boxfiles/boxfiles/commit/baa9a65196fd5bbbd94b6d38a4797250c67f7422))
* **core:** resolve file plugin sources ([0d0df98](https://github.com/boxfiles/boxfiles/commit/0d0df98f72a3ea13625d427b9a18d0aac13b823a))
* **plugin-installer:** complete closeout coverage ([2e07188](https://github.com/boxfiles/boxfiles/commit/2e071885e2e27155e6f72af004b87b1e43e1b783))
* **plugin:** add plugin source lifecycle support ([ca953c7](https://github.com/boxfiles/boxfiles/commit/ca953c7e4df1cd5ad762c1424563eef951002863))
* **release:** publish npm packages and cli assets ([a6ebac4](https://github.com/boxfiles/boxfiles/commit/a6ebac41ddee553a2e290f0e52c1eed328ff0b3a))


### Bug Fixes

* **core:** discover root boxfiles manifests ([2000190](https://github.com/boxfiles/boxfiles/commit/200019042f08963a0743e8e6375a13f761cb7f91))
* **core:** ignore reserved root boxfiles manifest ([83f02c3](https://github.com/boxfiles/boxfiles/commit/83f02c3c3828b26cd8cad519c9cf4c49e743cab1))
* **core:** pass context facts into action planning ([4dd0d37](https://github.com/boxfiles/boxfiles/commit/4dd0d37f7863ed028efe922739e261d5b5ad87fb))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @boxfiles/config bumped from 0.0.1 to 0.1.0
    * @boxfiles/diagnostics bumped from 0.0.1 to 0.1.0
