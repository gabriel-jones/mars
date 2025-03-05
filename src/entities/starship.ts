import * as Phaser from "phaser";
import { TILE_SIZE } from "../constants";

export enum StarshipState {
  LANDED = "landed",
  TAKING_OFF = "taking_off",
  FLYING = "flying",
  LANDING = "landing",
}

export class Starship extends Phaser.GameObjects.Container {
  private starshipSprite: Phaser.GameObjects.Sprite;
  private engineFlame: Phaser.GameObjects.Sprite;
  private currentState: StarshipState;
  private landingPad: Phaser.GameObjects.Image;
  private landingTimer: Phaser.Time.TimerEvent;
  private takeoffTimer: Phaser.Time.TimerEvent;
  private landingCoordinates: { x: number; y: number };
  private flightHeight: number = 1000; // How high the ship flies off screen
  private landingDuration: number = 5000; // 5 seconds for landing animation
  private takeoffDuration: number = 5000; // 5 seconds for takeoff animation
  private cycleInterval: number = 30000; // 30 seconds in milliseconds (for testing)

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // Create landing pad using the SVG image instead of a rectangle
    this.landingPad = scene.add
      .image(x, y, "landingpad")
      .setOrigin(0.5)
      .setScale(1)
      .setDisplaySize(TILE_SIZE * 4, TILE_SIZE * 4)
      .setDepth(0);

    // Create the starship sprite
    this.starshipSprite = scene.add
      .sprite(0, 0, "starship")
      .setOrigin(0.5, 1) // Set origin to bottom center for landing effect
      .setScale(1)
      .setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 8)
      .setDepth(5);
    this.add(this.starshipSprite);

    // Create engine flame sprite
    this.engineFlame = scene.add
      .sprite(0, 0, "engine-flame")
      .setOrigin(0.5, 0) // Set origin to top center
      .setScale(0.8)
      .setVisible(false)
      .setDepth(99); // Set depth lower than starship
    this.add(this.engineFlame);

    // Position the flame at the bottom of the rocket
    this.engineFlame.setPosition(0, -25); // Position at the same point as the starship's bottom

    // Set initial state
    this.currentState = StarshipState.LANDED;
    this.landingCoordinates = { x, y };

    // Add to scene
    scene.add.existing(this);

    // Start the cycle
    this.startCycle();
  }

  preload() {
    // Preload is handled in the MainScene
  }

  startCycle() {
    // Schedule first takeoff after a short delay
    this.takeoffTimer = this.scene.time.delayedCall(5000, () => {
      this.takeOff();
    });
  }

  takeOff() {
    if (this.currentState !== StarshipState.LANDED) return;

    this.currentState = StarshipState.TAKING_OFF;

    // Show engine flame
    this.engineFlame.setVisible(true);

    // Create flame animation
    this.scene.tweens.add({
      targets: this.engineFlame,
      scaleX: { from: 0.6, to: 0.8 },
      scaleY: { from: 0.6, to: 1.2 },
      alpha: { from: 0.7, to: 1 },
      duration: 1000,
      repeat: 4,
      yoyo: true,
    });

    // Create takeoff animation - animate the container instead of individual sprites
    this.scene.tweens.add({
      targets: this,
      y: this.y - this.flightHeight,
      duration: this.takeoffDuration,
      ease: "Cubic.easeIn",
      onComplete: () => {
        // Ship has left the screen
        this.currentState = StarshipState.FLYING;
        this.setVisible(false);

        // Schedule landing
        this.landingTimer = this.scene.time.delayedCall(
          this.cycleInterval - this.takeoffDuration - this.landingDuration,
          () => {
            this.land();
          }
        );
      },
    });
  }

  land() {
    if (this.currentState !== StarshipState.FLYING) return;

    this.currentState = StarshipState.LANDING;

    // Reset position above landing pad
    this.setPosition(
      this.landingCoordinates.x,
      this.landingCoordinates.y - this.flightHeight
    );
    this.setVisible(true);
    this.engineFlame.setVisible(true);

    // Create flame animation
    this.scene.tweens.add({
      targets: this.engineFlame,
      scaleX: { from: 0.8, to: 0.6 },
      scaleY: { from: 1.2, to: 0.6 },
      alpha: { from: 1, to: 0.7 },
      duration: 1000,
      repeat: 4,
      yoyo: true,
    });

    // Create landing animation - animate the container instead of individual sprites
    this.scene.tweens.add({
      targets: this,
      y: this.landingCoordinates.y,
      duration: this.landingDuration,
      ease: "Cubic.easeOut",
      onComplete: () => {
        // Ship has landed
        this.currentState = StarshipState.LANDED;
        this.engineFlame.setVisible(false);

        // Schedule next takeoff
        this.takeoffTimer = this.scene.time.delayedCall(
          this.cycleInterval,
          () => {
            this.takeOff();
          }
        );
      },
    });
  }

  update() {
    // Any per-frame updates can go here
  }
}
