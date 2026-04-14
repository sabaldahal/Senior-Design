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

The frontend is built with React (Vite) and serves as the main operator dashboard for monitoring and managing warehouse inventory data coming from manual updates and robot-assisted inference.

### Inventory Dashboard

The inventory dashboard provides a centralized view of all tracked items, including product details, quantity, source, and image references. Users can add, edit, delete, and upload inventory items through the UI, and they can review newly detected items pushed through the inference pipeline.

### Real-time Data Visualization

The dashboard surfaces live inventory state and low-stock alerts based on backend API responses. During demo runs, updates from camera/inference submissions are reflected quickly in the interface, allowing users to verify detections and stock changes without needing direct database access.

## Backend

### Data Processing and Storage

The backend is implemented in Node.js/Express and persists data in Azure SQL. It stores core inventory records, captured image metadata, inference-related fields (such as confidence and metadata), and alert logging information used for low-stock email cooldown tracking.
### API Development

REST APIs were developed for inventory CRUD operations, image uploads, camera capture ingestion, inference submission, dashboard summary retrieval, and alerts. The inference endpoint supports flexible payloads (for example object name aliases, quantity, aisle context, and metadata) so robotics and ML components can integrate without strict coupling.
### Integration with Robot and Frontend

The backend acts as the integration layer between the robot pipeline and the web application. Robot-side detection outputs are transformed into API requests (object class counts and aisle information) and sent to the inference endpoint; the frontend then consumes the updated inventory and alert APIs to present the latest operational state to users.

## Synthetic Dataset Generation
We created a synthetic dataset to train our object detection model. The dataset consists of images captured from RGB camera. We used Blender to generate these images, which include various objects commonly found in a warehouse setting, such as boxes, pallets, and shelves. The dataset is annotated with bounding boxes and class labels for each object, which allows us to train our YOLO model effectively. The synthetic dataset helps us to overcome the challenges of collecting and annotating real-world data, and it provides a diverse set of training examples that improve the robustness of our object detection model.

### Simulation Environment
We used Blender to create a 3D simulation environment that mimics a real-world warehouse setting. The environment includes shelves, boxes, and other items in a typical warehouse layout.





