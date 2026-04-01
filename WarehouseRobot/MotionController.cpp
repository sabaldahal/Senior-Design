#include "MotionController.h"

#include "DeviceDriverSet_xxx0.h"
#include "MPU6050_getdata.h"
#include "RobotConfig.h"

namespace
{
  DeviceDriverSet_Motor gMotor;
  DeviceDriverSet_Servo gServo;
  MPU6050_getdata gImu;
}

void MotionController::begin()
{
  gMotor.DeviceDriverSet_Motor_Init();
  gServo.DeviceDriverSet_Servo_Init(RobotConfig::CAMERA_SERVO_FORWARD_ANGLE);
  gImu.MPU6050_dveInit();
  delay(300);
  gImu.MPU6050_calibration();
}

void MotionController::update()
{
  if (millis() - lastImuReadMs >= 10)
  {
    gImu.MPU6050_dveGetEulerAngles(&lastYawDeg);
    lastImuReadMs = millis();
  }

  if (currentMode == MotionDriveForward)
  {
    applyStraightStabilization(true, currentSpeed);
  }
  else if (currentMode == MotionDriveBackward)
  {
    applyStraightStabilization(false, currentSpeed);
  }
}

void MotionController::stop()
{
  currentMode = MotionStop;
  currentSpeed = 0;
  yawReferenceValid = false;
  gMotor.DeviceDriverSet_Motor_control(direction_void, 0, direction_void, 0, control_enable);
}

void MotionController::driveForward(uint8_t speed)
{
  if (!yawReferenceValid)
  {
    yawReference = lastYawDeg;
    yawReferenceValid = true;
  }
  currentMode = MotionDriveForward;
  currentSpeed = speed;
  applyStraightStabilization(true, speed);
}

void MotionController::driveBackward(uint8_t speed)
{
  if (!yawReferenceValid)
  {
    yawReference = lastYawDeg;
    yawReferenceValid = true;
  }
  currentMode = MotionDriveBackward;
  currentSpeed = speed;
  applyStraightStabilization(false, speed);
}

void MotionController::turnLeftInPlace(uint8_t speed)
{
  currentMode = MotionTurnLeft;
  currentSpeed = speed;
  yawReferenceValid = false;
  applyMotorSpeeds(direction_back, speed, direction_just, speed);
}

void MotionController::turnRightInPlace(uint8_t speed)
{
  currentMode = MotionTurnRight;
  currentSpeed = speed;
  yawReferenceValid = false;
  applyMotorSpeeds(direction_just, speed, direction_back, speed);
}

void MotionController::setCameraServoAngle(uint8_t angleDeg)
{
  gServo.DeviceDriverSet_Servo_controls(RobotConfig::CAMERA_SERVO_ID, angleDeg);
}

float MotionController::getYawDeg() const
{
  return lastYawDeg;
}

void MotionController::applyStraightStabilization(bool forward, uint8_t baseSpeed)
{
  const int error = (int)((lastYawDeg - yawReference) * RobotConfig::STRAIGHT_KP);
  int right = (int)baseSpeed + error;
  int left = (int)baseSpeed - error;

  if (right < 0)
    right = 0;
  if (left < 0)
    left = 0;
  if (right > RobotConfig::STRAIGHT_UPPER_LIMIT)
    right = RobotConfig::STRAIGHT_UPPER_LIMIT;
  if (left > RobotConfig::STRAIGHT_UPPER_LIMIT)
    left = RobotConfig::STRAIGHT_UPPER_LIMIT;

  if (forward)
  {
    applyMotorSpeeds(direction_just, (uint8_t)left, direction_just, (uint8_t)right);
  }
  else
  {
    applyMotorSpeeds(direction_back, (uint8_t)left, direction_back, (uint8_t)right);
  }
}

void MotionController::applyMotorSpeeds(bool leftForward, uint8_t leftSpeed, bool rightForward, uint8_t rightSpeed)
{
  gMotor.DeviceDriverSet_Motor_control(
      leftForward, leftSpeed,
      rightForward, rightSpeed,
      control_enable);
}
