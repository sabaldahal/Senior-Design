#include <avr/wdt.h>

#include "MarkerDetector.h"
#include "MissionFSM.h"
#include "MotionController.h"
#include "PathPlanner.h"
#include "RobotConfig.h"

MotionController gMotion;
MarkerDetector gMarker;
PathPlanner gPath;
MissionFSM gMission;

static unsigned long gLoopTickMs = 0;

void setup()
{
  Serial.begin(9600);
  gMotion.begin();
  gMarker.begin();
  gPath.begin();
  gMission.begin(&gMotion, &gMarker, &gPath);
  wdt_enable(WDTO_2S);
}

void loop()
{
  wdt_reset();

  if (millis() - gLoopTickMs < RobotConfig::LOOP_PERIOD_MS)
  {
    return;
  }
  gLoopTickMs = millis();

  gMarker.update();
  gMotion.update();
  gMission.update();

  if (gMission.consumeCaptureRequest())
  {
    // Hook point: notify external capture process (UART/PIN/Wi-Fi bridge).
    Serial.println("CAPTURE_REQUEST");
  }
}
