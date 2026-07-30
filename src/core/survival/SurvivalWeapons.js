// ============================================================
// SURVIVAL WEAPONS — Light Bolt plus one run-locked transformation.
// ============================================================
import * as THREE from 'three';
import { COMBAT } from '../../config.js';
import {
  SURVIVAL_LIGHT_BOLT,
  SURVIVAL_WEAPON_PATHS,
  getSurvivalBuildEffects,
} from './SurvivalUpgrades.js';

const ALAB_CADENCE_MULTIPLIER = 1.75;
const LASER_COOL_RATE = 1.25;

// Beam presentation. A THREE.Line is one pixel wide on every GPU regardless of
// `linewidth`, so the beam is two aimed unit cylinders instead: an opaque core and
// a wider additive sleeve for glow.
const BEAM = Object.freeze({
  CORE_RADIUS: 0.055,
  SLEEVE_SCALE: 2.1,        // sleeve radius as a multiple of the core's
  HEAT_SWELL: 0.35,         // extra width at full heat, as a fraction
  SPUTTER_FROM: 0.78,       // heat fraction where the overheat flicker starts
  SPUTTER_HZ: 26,
  SPUTTER_DEPTH: 0.3,       // how far the flicker cuts width and sleeve opacity
});
const BEAM_FORWARD = new THREE.Vector3(0, 0, 1);

export class SurvivalWeapons {
  constructor(combat, scene, camera, viewmodel, audio) {
    this.combat = combat;
    this.scene = scene;
    this.camera = camera;
    this.viewmodel = viewmodel;
    this.audio = audio;

    this.build = null;
    this.effects = null;
    this.firing = false;
    this.cooldown = 0;
    this.heat = 0;
    this.overheatLockout = 0;
    this._laserTick = 0;
    this._laserAudible = false;

    this._muzzle = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._beamEnd = new THREE.Vector3();
    this._beamAxis = new THREE.Vector3();
    this._buildBeam(scene);
  }

  // One unit-length cylinder lying along +Z, so a single aim quaternion on the
  // parent group orients core and sleeve together and each frame only rescales.
  _buildBeam(scene) {
    this._beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
    this._beamGeo.rotateX(Math.PI / 2);
    this._beamGeo.translate(0, 0, 0.5);   // origin at the muzzle end

    this._beamCoreMat = new THREE.MeshBasicMaterial({
      color: 0xdffdff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._beamSleeveMat = new THREE.MeshBasicMaterial({
      color: 0x5fd8ff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._beamCore = new THREE.Mesh(this._beamGeo, this._beamCoreMat);
    this._beamSleeve = new THREE.Mesh(this._beamGeo, this._beamSleeveMat);
    this.beam = new THREE.Group();
    this.beam.add(this._beamCore, this._beamSleeve);
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    scene.add(this.beam);
  }

  setBuild(build) {
    this.build = build;
    this.effects = getSurvivalBuildEffects(build);
    if (build.weaponPath !== 'laser') {
      this.heat = 0;
      this.overheatLockout = 0;
      this._setLaserActive(false);
    }
  }

  setFiring(flag) {
    this.firing = !!flag;
    if (!this.firing) this._setLaserActive(false);
  }

  cancelInput() {
    this.firing = false;
    this._setLaserActive(false);
  }

  reset() {
    this.cancelInput();
    this.cooldown = 0;
    this.heat = 0;
    this.overheatLockout = 0;
    this._laserTick = 0;
  }

  get weaponId() { return this.build?.weaponPath || SURVIVAL_LIGHT_BOLT.id; }

  get weaponName() {
    return SURVIVAL_WEAPON_PATHS[this.build?.weaponPath]?.label ||
      SURVIVAL_LIGHT_BOLT.label;
  }

  get heatCapacity() {
    if (this.weaponId !== 'laser') return 0;
    return SURVIVAL_WEAPON_PATHS.laser.heatCapacitySeconds +
      this.effects.pathMastery.laser.heatCapacityBonus;
  }

  get snapshot() {
    return {
      id: this.weaponId,
      name: this.weaponName,
      heat: this.heat,
      heatCapacity: this.heatCapacity,
      overheated: this.overheatLockout > 0,
    };
  }

  update(dt, overdriveActive = false) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.overheatLockout = Math.max(0, this.overheatLockout - dt);
    if (this.weaponId === 'laser') {
      this._updateLaser(dt, overdriveActive);
      return;
    }
    this._coolLaser(dt);
    if (!this.firing || this.cooldown > 0) return;
    this._fireProjectile(overdriveActive);
  }

  _fireProjectile(overdriveActive) {
    const mastery = this.effects.pathMastery;
    const damageMultiplier = this.effects.primaryDamageMultiplier *
      this.combat.primaryDamageMultiplier;
    let spec;
    if (this.weaponId === 'rapid') {
      const path = SURVIVAL_WEAPON_PATHS.rapid;
      spec = {
        kind: 'rapid',
        damage: path.damage * damageMultiplier,
        speed: path.projectileSpeed,
        cooldown: path.cooldownSeconds,
        radius: COMBAT.BOLT.RADIUS,
        pierce: 1 + mastery.rapid.pierceBonus,
      };
    } else if (this.weaponId === 'lance') {
      const path = SURVIVAL_WEAPON_PATHS.lance;
      spec = {
        kind: 'lance',
        damage: path.damage * damageMultiplier,
        speed: path.projectileSpeed,
        cooldown: path.cooldownSeconds,
        radius: COMBAT.BOLT.RADIUS * 1.45 * mastery.lance.radiusMultiplier,
        pierce: path.pierceTargets + mastery.lance.pierceBonus,
      };
    } else {
      // Survival's own bolt tuning; COMBAT.BOLT still supplies the shared visual
      // radius so the starting weapon looks identical to the campaign's.
      spec = {
        kind: 'light-bolt',
        damage: SURVIVAL_LIGHT_BOLT.damage * damageMultiplier,
        speed: SURVIVAL_LIGHT_BOLT.projectileSpeed,
        cooldown: SURVIVAL_LIGHT_BOLT.cooldownSeconds,
        radius: COMBAT.BOLT.RADIUS,
        pierce: 1,
      };
    }

    if (!this.combat.firePrimaryProjectile(spec)) return;
    const cadence = overdriveActive ? ALAB_CADENCE_MULTIPLIER : 1;
    this.cooldown = spec.cooldown / cadence;
    if (spec.kind === 'lance') this.audio?.playSurvivalLance?.();
  }

  _updateLaser(dt, overdriveActive) {
    if (this.overheatLockout > 0 || !this.firing) {
      this._coolLaser(dt);
      this._setLaserActive(false);
      return;
    }

    const path = SURVIVAL_WEAPON_PATHS.laser;
    const range = path.range + this.effects.pathMastery.laser.rangeBonus;
    const cadence = overdriveActive ? ALAB_CADENCE_MULTIPLIER : 1;
    const tickInterval = 1 / (path.ticksPerSecond * cadence);
    this._laserTick -= dt;
    let tickCount = 0;
    while (this._laserTick <= 0 && tickCount < 16) {
      tickCount++;
      this._laserTick += tickInterval;
    }
    if (this._laserTick <= -tickInterval * 3) this._laserTick = 0;
    const damage = tickCount * path.damagePerTick *
      this.effects.primaryDamageMultiplier * this.combat.primaryDamageMultiplier;

    this.viewmodel.getMuzzleWorld(this._muzzle);
    this.camera.getWorldDirection(this._direction);
    this.combat.resolveLaserAttack(
      this._muzzle,
      this._direction,
      range,
      damage,
      this._beamEnd,
    );
    // Audio still follows `firing`, not visibility — a beam pressed into a wall is
    // held, so it should keep humming even on the frame it has no length to draw.
    this._setLaserActive(true, this._drawBeam(this._muzzle, this._beamEnd));
    if (!overdriveActive) {
      this.heat = Math.min(this.heatCapacity, this.heat + dt);
      if (this.heat >= this.heatCapacity) {
        this.overheatLockout = path.overheatLockoutSeconds;
        this._setLaserActive(false);
      }
    }
  }

  _coolLaser(dt) {
    this.heat = Math.max(0, this.heat - dt * LASER_COOL_RATE);
    if (this.overheatLockout <= 0) this._laserTick = Math.min(this._laserTick, 0);
  }

  // Aim the pair down the shot and rescale: `z` to the resolved hit distance, the
  // cross-section to the live width. The beam thickens with heat and then sputters
  // just before lockout, so the cutout is telegraphed rather than sudden.
  _drawBeam(start, end) {
    this._beamAxis.copy(end).sub(start);
    const length = this._beamAxis.length();
    // Muzzle flush against a wall: there is no beam to orient, and normalizing a
    // zero vector would leave the pair pointing at whatever it aimed at last.
    if (length <= 1e-4) return false;
    this.beam.position.copy(start);
    this.beam.quaternion.setFromUnitVectors(
      BEAM_FORWARD,
      this._beamAxis.multiplyScalar(1 / length),
    );

    const capacity = this.heatCapacity;
    const heatFraction = capacity > 0 ? Math.min(1, this.heat / capacity) : 0;
    let width = BEAM.CORE_RADIUS
      * (this.effects?.pathMastery.laser.widthMultiplier || 1)
      * (1 + BEAM.HEAT_SWELL * heatFraction);
    let sleeveOpacity = 0.3;
    if (heatFraction > BEAM.SPUTTER_FROM) {
      const into = (heatFraction - BEAM.SPUTTER_FROM) / (1 - BEAM.SPUTTER_FROM);
      const flicker = 1 - BEAM.SPUTTER_DEPTH * into
        * (0.5 + 0.5 * Math.sin(this.heat * BEAM.SPUTTER_HZ));
      width *= flicker;
      sleeveOpacity *= flicker;
    }
    this._beamCore.scale.set(width, width, length);
    const sleeve = width * BEAM.SLEEVE_SCALE;
    this._beamSleeve.scale.set(sleeve, sleeve, length);
    this._beamSleeveMat.opacity = sleeveOpacity;
    return true;
  }

  _setLaserActive(active, drawn = active) {
    this.beam.visible = !!active && !!drawn;
    if (this._laserAudible === !!active) return;
    this._laserAudible = !!active;
    this.audio?.setSurvivalBeam?.(this._laserAudible);
  }

  dispose() {
    this._setLaserActive(false);
    this.scene.remove(this.beam);
    this._beamGeo.dispose();          // shared by core and sleeve
    this._beamCoreMat.dispose();
    this._beamSleeveMat.dispose();
  }
}
