const GRAVITY = 980; // pixels/s^2
const FLOOR_Y = 500; // y-coordinate of the floor

export function PhysicsSystem(entities, dt) {
  for (const entity of entities) {
    if (entity.components.physics && entity.components.transform) {
      const { physics, transform } = entity.components;

      // Apply gravity
      physics.vy += GRAVITY * dt;

      // Update position
      transform.x += physics.vx * dt;
      transform.y += physics.vy * dt;

      // Simple floor collision
      if (transform.y > FLOOR_Y) {
        transform.y = FLOOR_Y;
        physics.vy = 0;
        if (entity.components.state) {
          entity.components.state.isGrounded = true;
        }
      }
    }
  }
}
