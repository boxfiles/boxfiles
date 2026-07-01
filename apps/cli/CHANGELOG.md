# Changelog

## [0.1.0](https://github.com/boxfiles/boxfiles/compare/cli-v0.0.1...cli-v0.1.0) (2026-07-01)


### Features

* **cli:** add apply command execution ([667e9a3](https://github.com/boxfiles/boxfiles/commit/667e9a37cf5580012e0406b9773fa75367f133db))
* **cli:** add plugin management commands ([5c22817](https://github.com/boxfiles/boxfiles/commit/5c228177380a2a68e484870429c3077fdeca0974))
* **cli:** expose context facts command (closes [#5](https://github.com/boxfiles/boxfiles/issues/5)) ([#7](https://github.com/boxfiles/boxfiles/issues/7)) ([eb61927](https://github.com/boxfiles/boxfiles/commit/eb619277f0a709b256830bf83b0f145b8a006b5c))
* **cli:** install plugin declarations ([befc99e](https://github.com/boxfiles/boxfiles/commit/befc99ea01750cf1bde7955f3f187eb013272d18))
* **cli:** publish next assets as prerelease ([1471609](https://github.com/boxfiles/boxfiles/commit/14716095f00476658f535a3d40780f5a4f4b4855))
* **cli:** remove plugin declarations safely ([879ef59](https://github.com/boxfiles/boxfiles/commit/879ef597de83f825fb0545c23f6d3e942af2a974))
* **core:** define plugin config schema ([90a70f1](https://github.com/boxfiles/boxfiles/commit/90a70f1a13dd8aebab911195c5127daca768cc43))
* **core:** load installed plugins ([f5577ba](https://github.com/boxfiles/boxfiles/commit/f5577ba752399ce400a8955ade786258e6600e31))
* **core:** render context properties in manifests ([baa9a65](https://github.com/boxfiles/boxfiles/commit/baa9a65196fd5bbbd94b6d38a4797250c67f7422))
* **docs:** publish release version manifest ([6fc9150](https://github.com/boxfiles/boxfiles/commit/6fc915001e6df5bb24fbe0a2b5bb935bed3e1d9c))
* **plugin-installer:** complete closeout coverage ([2e07188](https://github.com/boxfiles/boxfiles/commit/2e071885e2e27155e6f72af004b87b1e43e1b783))
* **release:** publish npm packages and cli assets ([a6ebac4](https://github.com/boxfiles/boxfiles/commit/a6ebac41ddee553a2e290f0e52c1eed328ff0b3a))


### Bug Fixes

* **cli:** accept kebab dry-run flag ([f123c1c](https://github.com/boxfiles/boxfiles/commit/f123c1c48c51081fda5b6ad96b27cb342353a76d))
* **publish:** centralize publish git tag generation ([6e3b09b](https://github.com/boxfiles/boxfiles/commit/6e3b09bbbcbdfd7238c1ec10f09008da10cac80e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @boxfiles/core bumped from 0.0.1 to 0.1.0
    * @boxfiles/diagnostics bumped from 0.0.1 to 0.1.0
    * @boxfiles/plugin bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-copy bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-gpu bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-link bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-network bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-os bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-ownership bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-packages bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-permissions bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-remove bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-rename bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-run bumped from 0.0.1 to 0.1.0
    * @boxfiles/provider-user bumped from 0.0.1 to 0.1.0
