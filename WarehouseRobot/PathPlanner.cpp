#include "PathPlanner.h"

#include "RobotConfig.h"

void PathPlanner::begin()
{
  // Sample route: To be replaced with warehouse route map.
  route[0] = {SegmentDriveForwardMs, 22000, RobotConfig::DRIVE_SPEED_DEFAULT, false};
  route[1] = {SegmentTurnRightMs, 6500, RobotConfig::TURN_SPEED_DEFAULT, false};
  route[2] = {SegmentDriveForwardMs, 18000, RobotConfig::DRIVE_SPEED_DEFAULT, true}; // Shelf checkpoint
  route[3] = {SegmentHoldMs, 400, 0, false};
  route[4] = {SegmentTurnLeftMs, 6500, RobotConfig::TURN_SPEED_DEFAULT, false};
  route[5] = {SegmentDriveForwardMs, 2500, RobotConfig::DRIVE_SPEED_DEFAULT, true}; // Shelf checkpoint
  routeLength = 6;
  activeIndex = 0;
}

bool PathPlanner::hasActiveSegment() const
{
  return activeIndex < routeLength;
}

const PathPlanner::PathSegment &PathPlanner::currentSegment() const
{
  return route[activeIndex];
}

void PathPlanner::advanceSegment()
{
  if (activeIndex < routeLength)
  {
    activeIndex++;
  }
}

void PathPlanner::reset()
{
  activeIndex = 0;
}

bool PathPlanner::missionComplete() const
{
  return activeIndex >= routeLength;
}
