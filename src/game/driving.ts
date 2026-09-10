import { cornerSpeed, type CircuitSample } from "./circuit";

export const MAX_SPEED = 2120;
export const BRAKING = 2700;
export type Vehicle = { x: number; speed: number };
export type DrivingInput = {
  steering: number;
  brake: boolean;
  drift: boolean;
  boost: boolean;
  hit: boolean;
  speedLimit?: number;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

// Both human and computer drivers obey these grip, braking and shoulder rules.
export function drive(
  vehicle: Vehicle,
  input: DrivingInput,
  road: CircuitSample,
  tuning: { speed: number; handling: number },
  dt: number,
) {
  const offroad = Math.abs(vehicle.x) > road.width * 0.97;
  const cornerDrift =
    input.drift &&
    Math.abs(road.curve) > 0.65 &&
    input.steering * road.curve > 0 &&
    !offroad &&
    vehicle.speed > 650;
  const safeSpeed =
    MAX_SPEED * cornerSpeed(road.curve, tuning.handling, cornerDrift);
  const target = Math.min(
    MAX_SPEED *
      tuning.speed *
      (input.boost ? 1.42 : 1) *
      (input.brake ? 0.46 : 1) *
      (offroad ? 0.43 : 1) *
      (input.hit ? 0.55 : 1),
    input.speedLimit ?? Infinity,
  );
  vehicle.speed += clamp(target - vehicle.speed, -dt * BRAKING, dt * 1000);
  const excess = Math.max(0, vehicle.speed / safeSpeed - 1.06);
  // Entering too fast scrubs speed and pushes the car wide; brake before the apex.
  vehicle.speed = Math.max(0, vehicle.speed - excess * 1350 * dt);
  const ratio = vehicle.speed / MAX_SPEED;
  const steeringForce =
    input.steering *
    (cornerDrift ? 1.3 : 0.92) *
    tuning.handling *
    (0.35 + ratio * 0.65);
  const centrifugalForce = road.curve * ratio * ratio * (0.34 + excess * 0.2);
  vehicle.x = clamp(
    vehicle.x + (steeringForce - centrifugalForce) * dt,
    -1.65,
    1.65,
  );
  return {
    offroad,
    cornerDrift,
    sliding: !offroad && excess > 0.07,
    safeSpeed,
  };
}
