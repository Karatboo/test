import { entityManager } from "./core/entityManager.js";
import { humanoidTypes } from "./entities/npcDefinitions.js";

export function createPlayerMascot(x, y) {
  const player = entityManager.createEntity();
  entityManager.addComponent(player, "transform", { x, y });
  entityManager.addComponent(player, "physics", { vx: 0, vy: 0 });
  entityManager.addComponent(player, "render", {
    type: "rect",
    color: "purple",
    width: 30,
    height: 50,
  });
  entityManager.addComponent(player, "playerInput", {});
  entityManager.addComponent(player, "state", { isGrounded: false });
  return player;
}

export function createHumanoidTypeA(x, y) {
  const humanoid = entityManager.createEntity();
  const definition = humanoidTypes.TYPE_A;
  entityManager.addComponent(humanoid, "transform", { x, y });
  entityManager.addComponent(humanoid, "physics", { vx: 0, vy: 0 }); // NPCs are also affected by gravity
  entityManager.addComponent(humanoid, "render", { ...definition.render });
  return humanoid;
}
