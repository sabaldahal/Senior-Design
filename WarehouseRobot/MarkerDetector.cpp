#include "MarkerDetector.h"

#include "DeviceDriverSet_xxx0.h"
#include "RobotConfig.h"

namespace
{
  DeviceDriverSet_ITR20001 gItr;
}

void MarkerDetector::begin()
{
  gItr.DeviceDriverSet_ITR20001_Init();
}

void MarkerDetector::update()
{
  leftValue = gItr.DeviceDriverSet_ITR20001_getAnaloguexxx_L();
  midValue = gItr.DeviceDriverSet_ITR20001_getAnaloguexxx_M();
  rightValue = gItr.DeviceDriverSet_ITR20001_getAnaloguexxx_R();

  const bool centerOnMark = (midValue < RobotConfig::MARKER_DARK_THRESHOLD);
  const bool sideSupport = (leftValue < RobotConfig::MARKER_BRIGHT_THRESHOLD) || (rightValue < RobotConfig::MARKER_BRIGHT_THRESHOLD);
  markerNow = centerOnMark && sideSupport;

  if (markerNow)
  {
    if (markerCount < 255)
      markerCount++;
  }
  else
  {
    markerCount = 0;
  }

  if (markerCount >= RobotConfig::MARKER_CONFIRM_COUNT)
  {
    markerLatched = true;
  }
}

bool MarkerDetector::markerDetected() const
{
  return markerLatched;
}

void MarkerDetector::clearMarkerLatch()
{
  markerLatched = false;
  markerCount = 0;
}

int MarkerDetector::leftRaw() const
{
  return leftValue;
}

int MarkerDetector::midRaw() const
{
  return midValue;
}

int MarkerDetector::rightRaw() const
{
  return rightValue;
}
