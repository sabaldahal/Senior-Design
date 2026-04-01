#ifndef MOTION_CONTROLLER_H
#define MOTION_CONTROLLER_H

#include <Arduino.h>

class MotionController
{
public:
  enum MotionMode
  {
    MotionStop = 0,
    MotionDriveForward,
    MotionDriveBackward,
    MotionTurnLeft,
    MotionTurnRight
  };

  void begin();
  void update();

  void stop();
  void driveForward(uint8_t speed);
  void driveBackward(uint8_t speed);
  void turnLeftInPlace(uint8_t speed);
  void turnRightInPlace(uint8_t speed);

  void setCameraServoAngle(uint8_t angleDeg);
  float getYawDeg() const;

private:
  void applyStraightStabilization(bool forward, uint8_t baseSpeed);
  void applyMotorSpeeds(bool leftForward, uint8_t leftSpeed, bool rightForward, uint8_t rightSpeed);

private:
  MotionMode currentMode = MotionStop;
  uint8_t currentSpeed = 0;
  float yawReference = 0.0f;
  bool yawReferenceValid = false;
  float lastYawDeg = 0.0f;
  unsigned long lastImuReadMs = 0;
};

#endif
