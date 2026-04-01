#ifndef MARKER_DETECTOR_H
#define MARKER_DETECTOR_H

#include <Arduino.h>

class MarkerDetector
{
public:
  void begin();
  void update();

  bool markerDetected() const;
  void clearMarkerLatch();

  int leftRaw() const;
  int midRaw() const;
  int rightRaw() const;

private:
  bool markerNow = false;
  bool markerLatched = false;
  uint8_t markerCount = 0;
  int leftValue = 0;
  int midValue = 0;
  int rightValue = 0;
};

#endif
