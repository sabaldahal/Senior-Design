#ifndef ROBOT_CONFIG_H
#define ROBOT_CONFIG_H

#include <Arduino.h>

namespace RobotConfig
{
  static const uint8_t DRIVE_SPEED_DEFAULT = 170;
  static const uint8_t TURN_SPEED_DEFAULT = 160;
  static const uint8_t STRAIGHT_KP = 8;
  static const uint8_t STRAIGHT_UPPER_LIMIT = 255;

  static const uint16_t MARKER_DARK_THRESHOLD = 250;
  static const uint16_t MARKER_BRIGHT_THRESHOLD = 850;
  static const uint16_t MARKER_CONFIRM_COUNT = 3;

  static const uint16_t SHELF_ALIGN_MS = 700;
  static const uint16_t CAPTURE_HOLD_MS = 1500;
  static const uint16_t LOOP_PERIOD_MS = 20;

  static const uint8_t CAMERA_SERVO_ID = 1;
  static const uint8_t CAMERA_SERVO_FORWARD_ANGLE = 90;
  static const uint8_t CAMERA_SERVO_SHELF_ANGLE = 35;
}

#endif
