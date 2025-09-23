export const inputManager = {
  keysPressed: {},
  init() {
    window.addEventListener("keydown", (e) => {
      this.keysPressed[e.code] = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keysPressed[e.code] = false;
    });
  },
};
