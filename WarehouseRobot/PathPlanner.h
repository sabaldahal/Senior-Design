#ifndef PATH_PLANNER_H
#define PATH_PLANNER_H

#include <Arduino.h>

class PathPlanner
{
public:
  enum SegmentType
  {
    SegmentDriveForwardMs = 0,
    SegmentTurnLeftMs,
    SegmentTurnRightMs,
    SegmentHoldMs
  };

  struct PathSegment
  {
    SegmentType type;
    uint16_t durationMs;
    uint8_t speed;
    bool hasShelfAction;
  };

  void begin();
  bool hasActiveSegment() const;
  const PathSegment &currentSegment() const;
  void advanceSegment();
  void reset();
  bool missionComplete() const;

private:
  static const uint8_t kMaxSegments = 12;
  PathSegment route[kMaxSegments];
  uint8_t routeLength = 0;
  uint8_t activeIndex = 0;
};

#endif
