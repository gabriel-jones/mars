import Phaser from "phaser";
import { DEFAULT_FONT } from "../constants";

/**
 * Applies the default font to a text style object
 * @param style The original text style object (optional)
 * @returns A new text style object with the default font applied
 */
export function applyDefaultFont(
  style?: Phaser.Types.GameObjects.Text.TextStyle
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: DEFAULT_FONT,
    ...style,
  };
}

/**
 * Initializes font utilities by extending Phaser's text factory
 * Call this once at the start of the game
 */
export function initFontUtils(): void {
  // Store the original text factory
  const originalTextFactory =
    Phaser.GameObjects.GameObjectFactory.prototype.text;

  // Override the text factory to use our default font
  Phaser.GameObjects.GameObjectFactory.prototype.text = function (
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle
  ) {
    // Apply the default font to the style
    const mergedStyle = applyDefaultFont(style);

    // Call the original factory method with our merged style
    return originalTextFactory.call(this, x, y, text, mergedStyle);
  };
}
