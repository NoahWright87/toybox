/**
 * One monotonic id generator shared by every pooled entity that anything
 * else tracks a *relationship* to across frames.
 *
 * Pooled sprites are reused, so an object reference doesn't identify a
 * life: `PlayerBullet` remembers which targets it has already pierced, and
 * `GrazeTracker` remembers which incoming projectiles the player is
 * currently grazing — both must key on "this spawn," not "this object," or
 * a recycled sprite inherits the previous occupant's history.
 *
 * It is shared (rather than a per-class static counter) because those
 * consumers now see more than one class: an authored projectile
 * (`AuthoredUnit`) and a built-in `EnemyBullet` both land in the same graze
 * map, and a player bullet's hit-list holds both `Enemy` and `AuthoredUnit`
 * targets. Two independent counters would eventually hand out the same
 * number to one of each, and the collision would silently read as "already
 * hit / still grazing."
 */
let next = 1;

export function nextSpawnId(): number {
  return next++;
}
