#include "MissionFSM.h"

#include "RobotConfig.h"

void MissionFSM::begin(MotionController *motion, MarkerDetector *marker, PathPlanner *planner)
{
  motionCtrl = motion;
  markerDet = marker;
  pathPlan = planner;
  state = StateBootInit;
  stateEnterMs = millis();
  segmentStartMs = 0;
  activeSegmentStarted = false;
  pendingCaptureRequest = false;
}

void MissionFSM::update()
{
  if (motionCtrl == NULL || markerDet == NULL || pathPlan == NULL)
  {
    stopAndSafe();
    return;
  }

  switch (state)
  {
  case StateBootInit:
    state = StateFollowPathSegment;
    stateEnterMs = millis();
    break;

  case StateFollowPathSegment:
    if (!pathPlan->hasActiveSegment())
    {
      state = StateMissionDone;
      stateEnterMs = millis();
      break;
    }

    runSegment(pathPlan->currentSegment());

    if (markerDet->markerDetected() && pathPlan->currentSegment().hasShelfAction)
    {
      motionCtrl->stop();
      markerDet->clearMarkerLatch();
      state = StateShelfAlign;
      stateEnterMs = millis();
      break;
    }

    if (activeSegmentStarted && (millis() - segmentStartMs >= pathPlan->currentSegment().durationMs))
    {
      state = StateAdvanceSegment;
      stateEnterMs = millis();
    }
    break;

  case StateShelfAlign:
    motionCtrl->setCameraServoAngle(RobotConfig::CAMERA_SERVO_SHELF_ANGLE);
    if (millis() - stateEnterMs >= RobotConfig::SHELF_ALIGN_MS)
    {
      state = StateCaptureHold;
      stateEnterMs = millis();
      pendingCaptureRequest = true;
    }
    break;

  case StateCaptureHold:
    motionCtrl->stop();
    if (millis() - stateEnterMs >= RobotConfig::CAPTURE_HOLD_MS)
    {
      motionCtrl->setCameraServoAngle(RobotConfig::CAMERA_SERVO_FORWARD_ANGLE);
      state = StateAdvanceSegment;
      stateEnterMs = millis();
    }
    break;

  case StateAdvanceSegment:
    activeSegmentStarted = false;
    pathPlan->advanceSegment();
    if (pathPlan->missionComplete())
    {
      state = StateMissionDone;
    }
    else
    {
      state = StateFollowPathSegment;
    }
    stateEnterMs = millis();
    break;

  case StateMissionDone:
    motionCtrl->stop();
    break;

  case StateSafeStop:
  default:
    motionCtrl->stop();
    break;
  }
}

MissionFSM::State MissionFSM::currentState() const
{
  return state;
}

bool MissionFSM::captureRequested() const
{
  return pendingCaptureRequest;
}

bool MissionFSM::consumeCaptureRequest()
{
  if (!pendingCaptureRequest)
    return false;
  pendingCaptureRequest = false;
  return true;
}

void MissionFSM::runSegment(const PathPlanner::PathSegment &seg)
{
  if (!activeSegmentStarted)
  {
    segmentStartMs = millis();
    activeSegmentStarted = true;
  }

  switch (seg.type)
  {
  case PathPlanner::SegmentDriveForwardMs:
    motionCtrl->driveForward(seg.speed);
    break;
  case PathPlanner::SegmentTurnLeftMs:
    motionCtrl->turnLeftInPlace(seg.speed);
    break;
  case PathPlanner::SegmentTurnRightMs:
    motionCtrl->turnRightInPlace(seg.speed);
    break;
  case PathPlanner::SegmentHoldMs:
  default:
    motionCtrl->stop();
    break;
  }
}

void MissionFSM::stopAndSafe()
{
  if (motionCtrl != NULL)
  {
    motionCtrl->stop();
  }
  state = StateSafeStop;
}
