# DEMO

## Robot

This demo showcases the robot's ability to autonomously navigate through an environment using its sensors and SLAM (Simultaneous Localization and Mapping) capabilities. Currently, we are using Gazebo for simulation. The robot is equipped with a LiDAR sensor for mapping and localization, as well as a RGB-D camera for enhanced perception. The robot can navigate to a target location while avoiding obstacles, and the generated map and the robot's position are visualized in real-time using Rviz.

### Robot Autonomous Navigation

-   Uses LiDAR to scan the surrounding
-   SLAM for localization and mapping
-   Path planning to navigate to a target location while avoiding obstacles
-   Real-time visualization of the robot's position and the generated map using Rviz
-   Equipped with a RGB-D camera for enhanced perception

### Object Detection

-   Captures video feed from the RGB-D camera
-   Processes the video feed using a pre-trained YOLO model to detect objects
-   Uses depth information from the RGB-D camera to filter out duplicate detections and improve accuracy

### Data Transmission

Once the robot has collected data from its sensors, it can transmit this data to a remote server for further processing and analysis.


## Frontend


### Inventory Dashboard


### Real-time Data Visualization


## Backend

### Data Processing and Storage

### API Development

### Integration with Robot and Frontend


## Synthetic Dataset Generation
We created a synthetic dataset to train our object detection model. The dataset consists of images captured from RGB camera. We used Blender to generate these images, which include various objects commonly found in a warehouse setting, such as boxes, pallets, and shelves. The dataset is annotated with bounding boxes and class labels for each object, which allows us to train our YOLO model effectively. The synthetic dataset helps us to overcome the challenges of collecting and annotating real-world data, and it provides a diverse set of training examples that improve the robustness of our object detection model.

### Simulation Environment
We used Blender to create a 3D simulation environment that mimics a real-world warehouse setting. The environment includes shelves, boxes, and other items in a typical warehouse layout.





