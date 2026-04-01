#ifndef MISSION_FSM_H
#define MISSION_FSM_H

#include <Arduino.h>

#include "MarkerDetector.h"
#include "MotionController.h"
#include "PathPlanner.h"

class MissionFSM
{
public:
  enum State
  {
    StateBootInit = 0,
    StateFollowPathSegment,
    StateShelfAlign,
    StateCaptureHold,
    StateAdvanceSegment,
    StateMissionDone,
    StateSafeStop
  };

  void begin(MotionController *motion, MarkerDetector *marker, PathPlanner *planner);
  void update();

  State currentState() const;
  bool captureRequested() const;
  bool consumeCaptureRequest();

private:
  void runSegment(const PathPlanner::PathSegment &seg);
  void stopAndSafe();

private:
  MotionController *motionCtrl = NULL;
  MarkerDetector *markerDet = NULL;
  PathPlanner *pathPlan = NULL;

  State state = StateBootInit;
  unsigned long stateEnterMs = 0;
  unsigned long segmentStartMs = 0;
  bool activeSegmentStarted = false;
  bool pendingCaptureRequest = false;
};

#endif
